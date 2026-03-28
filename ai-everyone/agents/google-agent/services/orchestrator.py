"""
Orchestrator Service
Analyzes user intent and routes to appropriate agents or direct LLM response
"""

import logging
from typing import Any, Dict, List, Optional

from services.llm_service import llm_service

logger = logging.getLogger(__name__)


ORCHESTRATOR_SYSTEM_PROMPT = """You are an intelligent orchestrator for a Personal AI Assistant.

Your job is to analyze the user's message and determine:
1. Whether to answer directly (mode: "direct") or execute agent tasks (mode: "agent")
2. Which agents are needed
3. What sub-tasks are required

Available agents:
- calendar: Create, update, delete, list Google Calendar events
- gmail: Send, draft, reply, summarize Gmail emails
- meet: Schedule Google Meet meetings, generate links
- contacts: Search Google Contacts by name
- calling: Make phone calls via Twilio
- drive: List, search, and upload Google Drive files
- tasks: Create, list, and complete Google Tasks
- task_planner: Break complex multi-step tasks into sub-tasks
- web_search: Search the web for real-time information
- notes: Create, list, and delete personal notes stored locally in MongoDB

Rules:
- Use "direct" mode for general questions, explanations, coding help, creative writing
- Use "notes" for local personal notes stored in MongoDB
- Use "tasks" for Google Tasks actions
- Use "agent" mode for anything involving Google services, scheduling, emails, contacts, files, or searches
- If multiple agents needed, include all of them
- Always include "task_planner" if 2+ agents are needed

Respond in this exact JSON format:
{
  "mode": "direct" | "agent",
  "agents_required": ["agent1", "agent2"],
  "primary_intent": "Brief description of what user wants",
  "sub_tasks": ["task 1", "task 2"],
  "confidence": 0.0-1.0
}"""


class OrchestratorService:
    """Routes user requests to appropriate handlers."""

    async def analyze_intent(
        self,
        user_message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        chat_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Analyze user intent to determine execution mode and required agents."""
        conversation_history = conversation_history or []
        chat_context = chat_context or {}
        pending_task = chat_context.get("pending_task")

        if pending_task and self._should_continue_pending_task(user_message, pending_task):
            return {
                "mode": "agent",
                "agents_required": [pending_task["agent"]],
                "primary_intent": f"Continue pending {pending_task['agent']} task",
                "sub_tasks": [f"Collect missing details for {pending_task['action']}"],
                "confidence": 1.0,
            }

        heuristic_intent = self._rule_based_intent(user_message)
        if heuristic_intent:
            logger.info("[orchestrator] heuristic agent routing: %s", heuristic_intent)
            return heuristic_intent

        messages = self._build_context_messages(
            conversation_history=conversation_history,
            chat_context=chat_context,
            limit=12,
        )
        messages.append({"role": "user", "content": f"Analyze this request: {user_message}"})

        result = await llm_service.complete_json(
            messages=messages,
            system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
        )

        if "error" in result:
            return {
                "mode": "direct",
                "agents_required": [],
                "primary_intent": user_message,
                "sub_tasks": [],
                "confidence": 0.5,
            }

        return result

    async def execute(
        self,
        user_message: str,
        intent: Dict[str, Any],
        user_id: str,
        chat_id: str,
        access_token: str,
        refresh_token: str = "",
        conversation_history: Optional[List[Dict[str, str]]] = None,
        llm_provider: str = "ollama",
        chat_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute the orchestrated response based on intent analysis.

        Returns:
            {response, agent_logs, execution_steps, mode}
        """
        conversation_history = conversation_history or []
        chat_context = chat_context or {}

        mode = intent.get("mode", "direct")
        execution_steps: List[str] = []
        agent_logs: List[Dict[str, Any]] = []

        if mode == "direct":
            logger.info(f"[orchestrator] direct response mode for: {intent.get('primary_intent', user_message)}")
            execution_steps.append("Analyzing request...")
            execution_steps.append("Generating response...")

            response = await llm_service.complete(
                messages=self._build_context_messages(
                    conversation_history=conversation_history,
                    chat_context=chat_context,
                    limit=30,
                )
                + [{"role": "user", "content": user_message}],
                provider=llm_provider,
                system_prompt=self._get_direct_system_prompt(),
            )

            return {
                "response": response,
                "agent_logs": [],
                "execution_steps": execution_steps,
                "mode": "direct",
            }

        agents_required = self._prepare_agents_for_execution(intent.get("agents_required", []))
        sub_tasks = intent.get("sub_tasks", [])
        logger.info(f"[orchestrator] agent mode - agents: {agents_required}")

        if len(agents_required) > 1 or "task_planner" in agents_required:
            execution_steps.append("Planning multi-step execution...")
            plan = await self._create_execution_plan(user_message, agents_required, sub_tasks)
            execution_steps.extend([f"Step {index + 1}: {step}" for index, step in enumerate(plan)])
        else:
            agent_name = agents_required[0] if agents_required else "assistant"
            execution_steps.append(f"Activating {agent_name} agent...")

        results = []
        shared_agent_outputs: Dict[str, Any] = {}
        for agent_name in agents_required:
            if agent_name == "task_planner":
                continue

            try:
                agent_result = await self._run_agent(
                    agent_name=agent_name,
                    user_message=user_message,
                    user_id=user_id,
                    access_token=access_token,
                    refresh_token=refresh_token,
                    context={
                        "intent": intent,
                        "chat_id": chat_id,
                        "conversation_history": conversation_history[-20:],
                        "memory_summary": chat_context.get("memory_summary", ""),
                        "pending_task": chat_context.get("pending_task"),
                        "agent_outputs": shared_agent_outputs,
                    },
                )
                results.append(agent_result)
                if agent_result.get("data") is not None:
                    shared_agent_outputs[agent_name] = agent_result.get("data")
                agent_logs.append(
                    {
                        "agent": agent_name,
                        "status": agent_result.get("status", "unknown"),
                        "summary": agent_result.get("summary", ""),
                    }
                )
                execution_steps.append(f"{agent_name} agent completed")
            except Exception as exc:
                logger.error(f"Agent {agent_name} failed: {exc}")
                agent_logs.append({"agent": agent_name, "status": "failed", "error": str(exc)})
                execution_steps.append(f"{agent_name} agent failed: {exc}")

        needs_input_results = [result for result in results if result.get("status") == "needs_input"]
        if needs_input_results:
            pending_task = dict(needs_input_results[0].get("pending_task") or {})
            if shared_agent_outputs:
                pending_task["agent_outputs"] = shared_agent_outputs
            return {
                "response": needs_input_results[0].get("summary", ""),
                "agent_logs": agent_logs,
                "execution_steps": execution_steps,
                "mode": "agent",
                "pending_task": pending_task,
            }

        error_results = [result for result in results if result.get("status") == "error"]
        success_results = [result for result in results if result.get("status") == "success"]
        if error_results and not success_results:
            return {
                "response": error_results[0].get("summary", error_results[0].get("error", "Agent failed")),
                "agent_logs": agent_logs,
                "execution_steps": execution_steps,
                "mode": "agent",
                "clear_pending_task": any(result.get("clear_pending_task") for result in error_results),
            }

        execution_steps.append("Synthesizing response...")
        response = await self._synthesize_response(
            user_message=user_message,
            agent_results=results,
            intent=intent,
            llm_provider=llm_provider,
        )

        return {
            "response": response,
            "agent_logs": agent_logs,
            "execution_steps": execution_steps,
            "mode": "agent",
            "clear_pending_task": any(result.get("clear_pending_task") for result in results),
        }

    async def _run_agent(
        self,
        agent_name: str,
        user_message: str,
        user_id: str,
        access_token: str,
        refresh_token: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Dynamically import and run an agent."""
        from agents.calendar_agent import CalendarAgent
        from agents.calling_agent import CallingAgent
        from agents.contacts_agent import ContactsAgent
        from agents.drive_agent import DriveAgent
        from agents.gmail_agent import GmailAgent
        from agents.meet_agent import MeetAgent
        from agents.notes_agent import NotesAgent
        from agents.tasks_agent import TasksAgent
        from agents.web_search_agent import WebSearchAgent

        agent_map = {
            "calendar": CalendarAgent,
            "gmail": GmailAgent,
            "meet": MeetAgent,
            "contacts": ContactsAgent,
            "drive": DriveAgent,
            "calling": CallingAgent,
            "web_search": WebSearchAgent,
            "notes": NotesAgent,
            "tasks": TasksAgent,
        }

        agent_class = agent_map.get(agent_name)
        if not agent_class:
            return {"status": "error", "summary": f"Unknown agent: {agent_name}"}

        agent = agent_class(
            access_token=access_token,
            user_id=user_id,
            refresh_token=refresh_token,
        )
        return await agent.handle(user_message, context)

    async def _create_execution_plan(
        self,
        user_message: str,
        agents: List[str],
        sub_tasks: List[str],
    ) -> List[str]:
        """Use LLM to create an execution plan."""
        prompt = f"""Create a step-by-step execution plan for: "{user_message}"
Available agents: {', '.join(agents)}
Sub-tasks identified: {', '.join(sub_tasks)}

Return a JSON array of steps (strings only):
["Step 1 description", "Step 2 description", ...]"""

        result = await llm_service.complete_json(messages=[{"role": "user", "content": prompt}])
        if isinstance(result, list):
            return result
        return sub_tasks or [f"Execute {agent}" for agent in agents]

    async def _synthesize_response(
        self,
        user_message: str,
        agent_results: List[Dict[str, Any]],
        intent: Dict[str, Any],
        llm_provider: str,
    ) -> str:
        """Synthesize a natural language response from agent results."""
        results_summary = "\n".join(
            f"- {result.get('agent', 'Agent')}: {result.get('summary', str(result))}"
            for result in agent_results
        )

        prompt = f"""User requested: "{user_message}"

Agent execution results:
{results_summary}

Provide a clear, helpful, conversational response summarizing what was accomplished.
Be specific about what actions were taken. If anything failed, mention it and suggest alternatives."""

        return await llm_service.complete(
            messages=[{"role": "user", "content": prompt}],
            provider=llm_provider,
            system_prompt="You are a helpful personal AI assistant. Summarize agent actions clearly and helpfully.",
        )

    def _get_direct_system_prompt(self) -> str:
        return """You are a highly capable Personal AI Assistant with broad knowledge and skills.

You can help with:
- Answering questions on any topic
- Writing, editing, and brainstorming
- Coding and technical problems
- Analysis and research
- Creative tasks

Use the conversation context to maintain continuity inside this chat.
Be helpful, concise, and precise. Use markdown formatting when appropriate.
If the user asks to do something that requires Google services (email, calendar, etc.),
let them know you can do that - they just need to phrase it as a command."""

    def _prepare_agents_for_execution(self, agents: List[str]) -> List[str]:
        ordered_unique: List[str] = []
        for agent_name in agents:
            if agent_name not in ordered_unique:
                ordered_unique.append(agent_name)

        if "meet" in ordered_unique and "calendar" in ordered_unique:
            ordered_unique = [agent for agent in ordered_unique if agent != "calendar"]

        priority = {
            "meet": 1,
            "calendar": 2,
            "gmail": 3,
            "contacts": 4,
            "drive": 5,
            "tasks": 6,
            "notes": 7,
            "web_search": 8,
            "calling": 9,
            "task_planner": 99,
        }
        return sorted(ordered_unique, key=lambda agent_name: priority.get(agent_name, 50))
    def _build_context_messages(
        self,
        conversation_history: List[Dict[str, str]],
        chat_context: Dict[str, Any],
        limit: int,
    ) -> List[Dict[str, str]]:
        messages: List[Dict[str, str]] = []

        memory_summary = chat_context.get("memory_summary")
        if memory_summary:
            messages.append(
                {
                    "role": "system",
                    "content": f"Conversation memory for this chat:\n{memory_summary}",
                }
            )

        pending_task = chat_context.get("pending_task")
        if pending_task:
            messages.append(
                {
                    "role": "system",
                    "content": f"There is a pending task in this chat: {pending_task}",
                }
            )

        messages.extend(conversation_history[-limit:])
        return messages

    def _rule_based_intent(self, user_message: str) -> Optional[Dict[str, Any]]:
        lower_message = user_message.lower()
        command_verbs = [
            "schedule",
            "send",
            "draft",
            "create",
            "book",
            "set up",
            "setup",
            "add",
            "list",
            "show",
            "find",
            "search",
            "look up",
            "upload",
            "mark",
            "complete",
            "delete",
            "remove",
        ]

        if not any(verb in lower_message for verb in command_verbs):
            return None

        agents_required: List[str] = []
        sub_tasks: List[str] = []

        if any(keyword in lower_message for keyword in ["calendar", "event", "appointment"]):
            agents_required.append("calendar")
            sub_tasks.append("Handle Google Calendar request")

        if any(keyword in lower_message for keyword in ["schedule", "book", "set up", "setup"]) and any(
            marker in lower_message for marker in ["today", "tomorrow", "am", "pm", ":", " with ", "@"]
        ):
            agents_required.append("calendar")
            sub_tasks.append("Handle scheduling request")

        if any(keyword in lower_message for keyword in ["meet", "meeting", "meetig", "invite"]):
            agents_required.append("meet")
            sub_tasks.append("Handle Google Meet scheduling")

        if any(keyword in lower_message for keyword in ["schedule", "book", "set up", "setup"]) and any(
            marker in lower_message for marker in ["meet", "meeting", "meetig", " with ", "@"]
        ):
            agents_required.append("meet")
            sub_tasks.append("Handle meeting scheduling")

        if any(keyword in lower_message for keyword in ["gmail", "email", "mail", "inbox", "reply"]):
            agents_required.append("gmail")
            sub_tasks.append("Handle Gmail request")

        if any(keyword in lower_message for keyword in ["contact", "contacts", "phone number"]):
            agents_required.append("contacts")
            sub_tasks.append("Handle Google Contacts lookup")

        if any(keyword in lower_message for keyword in ["drive", "upload file", "google drive"]):
            agents_required.append("drive")
            sub_tasks.append("Handle Google Drive request")

        if any(keyword in lower_message for keyword in ["google task", "google tasks", "mark complete", "complete task"]):
            agents_required.append("tasks")
            sub_tasks.append("Handle Google Tasks request")

        if any(keyword in lower_message for keyword in ["note", "notes", "memo", "remember this"]):
            agents_required.append("notes")
            sub_tasks.append("Handle local notes request")

        if any(keyword in lower_message for keyword in ["search web", "look up", "latest", "news"]):
            agents_required.append("web_search")
            sub_tasks.append("Handle web search request")

        deduped_agents: List[str] = []
        for agent_name in agents_required:
            if agent_name not in deduped_agents:
                deduped_agents.append(agent_name)

        if not deduped_agents:
            return None

        if len(deduped_agents) > 1:
            deduped_agents.append("task_planner")

        return {
            "mode": "agent",
            "agents_required": deduped_agents,
            "primary_intent": user_message,
            "sub_tasks": sub_tasks,
            "confidence": 0.92,
        }

    def _should_continue_pending_task(self, user_message: str, pending_task: Dict[str, Any]) -> bool:
        lower_message = user_message.lower().strip()
        if not lower_message:
            return False

        if lower_message in {"cancel", "cancel it", "never mind", "nevermind", "stop"}:
            return False

        explicit_new_task_markers = [
            "schedule",
            "calendar",
            "meeting",
            "meet",
            "call",
            "search",
            "drive",
            "note",
            "todo",
            "task",
            "google task",
            "send email",
            "draft email",
            "reply to",
            "email to",
            "another email",
            "new email",
        ]
        if any(marker in lower_message for marker in explicit_new_task_markers):
            return False

        if pending_task.get("agent") == "gmail" and any(
            marker in lower_message for marker in ["summarize inbox", "list emails", "reply to"]
        ):
            return False

        missing_fields = pending_task.get("missing_fields", [])
        if any(field in lower_message for field in missing_fields):
            return True

        if "@" in lower_message or ":" in lower_message:
            return True

        return len(lower_message.split()) <= 18


orchestrator = OrchestratorService()


