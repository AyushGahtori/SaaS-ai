# Agent Orchestration Rebuild

Last updated: April 27, 2026

## Why The Old Flow Failed

The previous chat pipeline made the parent LLM responsible for routing by emitting tagged JSON:

1. User asks for a task.
2. Parent model streams text.
3. Backend guesses whether the stream is text or `<AGENT_INTENT>`.
4. Backend regex-parses JSON from the model output.
5. A child agent receives a loosely shaped payload.

That creates several choke points:

- Any malformed tag or JSON breaks the turn.
- Streaming text detection can misclassify the first tokens.
- Common tasks like Gmail listing depend on the model choosing the right agent and shape.
- Follow-up turns lose the previous agent output, so "this email" or "same person" becomes ambiguous.
- Child-agent `needs_input` state was not consistently preserved across the Next.js -> Python bridge.

## New Core Flow

The rebuilt flow is:

1. Normalize the latest user message.
2. Try deterministic routing first for high-confidence agent domains.
3. If deterministic routing matches, create and execute the agent task directly.
4. If no deterministic route matches, call the parent LLM.
5. Parse any fallback model intent with tolerant JSON recovery.
6. Pass recent agent context into both the parent prompt and the child agent payload.
7. Return one stable outcome: chat answer, agent task, install/connect prompt, or explicit follow-up.

## Deterministic Routes

The deterministic router handles obvious, high-volume requests without asking the model to choose:

- Gmail: list/search/read/summarize/reply/send/mark read
- Drive: list/search/read/summarize files
- Calendar, Meet, Google Tasks
- To-do/reminders
- Maps
- Emergency triage
- Stara/Strata, SEO, ShopGenie, Travel

Example:

`retrieve my last 5 mails` becomes:

```json
{
  "agent_required": "google-agent",
  "action": "list_emails",
  "parameters": {
    "agent_type": "gmail",
    "parameters": "retrieve my last 5 mails",
    "limit": "5"
  }
}
```

## Follow-Up Context

Before each chat turn, the backend loads recent `agentTasks` for the same chat and builds a compact context:

- Recent Gmail rows
- Recent Drive rows
- Last task status/action
- Pending child-agent task details

That context is passed into:

- The parent prompt, so fallback model routing can resolve references.
- The child agent input, so Python agents can resolve "this mail", "same person", or missing fields.

## Result Contract

Every agent task should resolve to one of:

- `success`
- `partial_success`
- `needs_input`
- `action_required`
- `failed`

The UI can render each without throwing a generic chat error.

## Guardrails

- Gmail and Drive list requests are capped at 20 items.
- Numeric limits are normalized into strings for the Google agent.
- Agent install/connect checks happen before execution.
- Model-generated intents remain as fallback only, not the primary route.
- Invalid fallback payloads become user-facing clarification, not a frontend crash.
