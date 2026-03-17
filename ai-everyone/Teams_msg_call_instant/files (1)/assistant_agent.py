"""
AI Personal Assistant Agent
Uses Ollama for intent parsing and Microsoft Graph for Teams people lookup.
"""

import json
import os
import re
import subprocess
import urllib.parse
import webbrowser
from dataclasses import dataclass, field

import msal
import requests

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "qwen3.5:397b-cloud"
GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
GRAPH_TENANT_ID = os.getenv("GRAPH_TENANT_ID", "41503967-0840-4715-9d4d-1741979db5d9")
GRAPH_CLIENT_ID = os.getenv("GRAPH_CLIENT_ID", "a33c08ae-ae48-460c-a79c-d58098af1a03")
GRAPH_SCOPES = ["User.Read", "People.Read", "User.ReadBasic.All"]
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

SYSTEM_PROMPT = """You are an AI parser for a Microsoft Teams assistant.

Return valid JSON only in this exact shape:
{
  "intent": "make_call" | "send_message" | "none",
  "contact_query": "person name or email from the conversation, or null",
  "message": "message text to send, or null",
  "confirmed": true | false,
  "cancelled": true | false
}

Rules:
1. Extract the intended action from the whole conversation.
2. Treat "yes", "proceed", "go ahead", and similar replies as confirmation only when the assistant previously asked for confirmation.
3. Treat "cancel", "stop", "never mind", and similar replies as cancellation.
4. If the assistant asked which person to choose, keep the original contact_query and do not invent an email.
5. If the assistant asked for a message, extract the user's reply as the message.
6. If there is no actionable request yet, return intent "none".
7. Never include markdown fences.
"""


@dataclass
class ParsedTurn:
    intent: str
    contact_query: str | None
    message: str | None
    confirmed: bool
    cancelled: bool


@dataclass
class AssistantState:
    intent: str | None = None
    contact_query: str | None = None
    message: str | None = None
    resolved_contact: dict | None = None
    candidate_contacts: list[dict] = field(default_factory=list)

    def reset(self) -> None:
        self.intent = None
        self.contact_query = None
        self.message = None
        self.resolved_contact = None
        self.candidate_contacts = []


class GraphDirectoryClient:
    def __init__(self) -> None:
        if not GRAPH_CLIENT_ID:
            raise RuntimeError(
                "Set GRAPH_CLIENT_ID before using Graph search. "
                "Use a Microsoft Entra app registration configured for device-code sign-in."
            )

        authority = f"https://login.microsoftonline.com/{GRAPH_TENANT_ID}"
        self.app = msal.PublicClientApplication(
            GRAPH_CLIENT_ID,
            authority=authority,
        )
        self.token: str | None = None

    def acquire_token(self) -> str:
        if self.token:
            return self.token

        accounts = self.app.get_accounts()
        if accounts:
            result = self.app.acquire_token_silent(GRAPH_SCOPES, account=accounts[0])
            if result and "access_token" in result:
                self.token = result["access_token"]
                return self.token

        flow = self.app.initiate_device_flow(scopes=GRAPH_SCOPES)
        if "user_code" not in flow:
            raise RuntimeError("Could not start Microsoft sign-in device flow.")

        print("\nMicrosoft sign-in is required.")
        print(flow["message"])
        result = self.app.acquire_token_by_device_flow(flow)
        if "access_token" not in result:
            raise RuntimeError(result.get("error_description", "Microsoft sign-in failed."))

        self.token = result["access_token"]
        return self.token

    def get(self, path: str, params: dict | None = None, headers: dict | None = None) -> dict:
        response = requests.get(
            f"{GRAPH_BASE_URL}{path}",
            params=params,
            headers={
                "Authorization": f"Bearer {self.acquire_token()}",
                **(headers or {}),
            },
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def search_people(self, query: str) -> list[dict]:
        query = query.strip()
        if not query:
            return []

        if is_valid_email(query):
            return [{"displayName": query, "email": query}]

        results: list[dict] = []
        results.extend(self._search_me_people(query))
        results.extend(self._search_users(query))
        return rank_and_deduplicate_contacts(query, results)

    def _search_me_people(self, query: str) -> list[dict]:
        try:
            payload = self.get(
                "/me/people",
                params={
                    "$search": f'"{query}"',
                    "$top": "10",
                },
            )
        except requests.HTTPError:
            return []

        contacts = []
        for person in payload.get("value", []):
            email = None
            scored = person.get("scoredEmailAddresses") or []
            if scored:
                email = scored[0].get("address")
            email = email or person.get("userPrincipalName") or person.get("mail")
            if email:
                contacts.append(
                    {
                        "displayName": person.get("displayName") or email,
                        "email": email,
                    }
                )
        return contacts

    def _search_users(self, query: str) -> list[dict]:
        escaped = query.replace("'", "''")
        filter_query = (
            f"startswith(displayName,'{escaped}') "
            f"or startswith(mail,'{escaped}') "
            f"or startswith(userPrincipalName,'{escaped}')"
        )

        try:
            payload = self.get(
                "/users",
                params={
                    "$filter": filter_query,
                    "$select": "displayName,mail,userPrincipalName",
                    "$top": "10",
                },
            )
        except requests.HTTPError:
            return []

        contacts = []
        for user in payload.get("value", []):
            email = user.get("mail") or user.get("userPrincipalName")
            if email:
                contacts.append(
                    {
                        "displayName": user.get("displayName") or email,
                        "email": email,
                    }
                )
        return contacts


def parse_turn(history: list[dict[str, str]]) -> ParsedTurn:
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": OLLAMA_MODEL,
            "stream": False,
            "format": "json",
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *history],
        },
        timeout=60,
    )
    response.raise_for_status()
    raw = response.json()["message"]["content"].strip()
    raw = re.sub(r"^```json\s*|```$", "", raw, flags=re.MULTILINE).strip()
    data = json.loads(raw)
    return ParsedTurn(
        intent=data.get("intent", "none"),
        contact_query=data.get("contact_query"),
        message=data.get("message"),
        confirmed=bool(data.get("confirmed", False)),
        cancelled=bool(data.get("cancelled", False)),
    )


def is_valid_email(value: str | None) -> bool:
    return bool(value and EMAIL_PATTERN.match(value.strip()))


def rank_and_deduplicate_contacts(query: str, contacts: list[dict]) -> list[dict]:
    query_lower = query.lower()
    words = [word for word in query_lower.split() if word]
    ranked = []
    seen = set()

    for contact in contacts:
        email = (contact.get("email") or "").strip().lower()
        name = (contact.get("displayName") or "").strip()
        if not email or email in seen:
            continue

        name_lower = name.lower()
        score = 0
        if name_lower == query_lower:
            score += 100
        if email == query_lower:
            score += 100
        if name_lower.startswith(query_lower):
            score += 70
        if query_lower in name_lower:
            score += 40
        if query_lower in email:
            score += 30
        score += sum(10 for word in words if word in name_lower)

        seen.add(email)
        ranked.append((score, {"displayName": name or email, "email": email}))

    ranked.sort(key=lambda item: (-item[0], item[1]["displayName"]))
    return [contact for _, contact in ranked]


def open_teams_chat(email: str, message: str) -> bool:
    encoded_message = urllib.parse.quote(message)
    teams_url = f"msteams://teams.microsoft.com/l/chat/0/0?users={email}&message={encoded_message}"
    fallback_url = f"https://teams.microsoft.com/l/chat/0/0?users={email}&message={encoded_message}"

    print(f"\n  Opening Microsoft Teams chat with {email}...")
    try:
        if subprocess.run(["cmd", "/c", "start", teams_url], capture_output=True).returncode == 0:
            return True
    except Exception:
        pass

    webbrowser.open(fallback_url)
    return True


def open_teams_call(email: str) -> bool:
    teams_url = f"msteams://teams.microsoft.com/l/call/0/0?users={email}"
    fallback_url = f"https://teams.microsoft.com/l/call/0/0?users={email}"

    print(f"\n  Opening Microsoft Teams call with {email}...")
    try:
        if subprocess.run(["cmd", "/c", "start", teams_url], capture_output=True).returncode == 0:
            return True
    except Exception:
        pass

    webbrowser.open(fallback_url)
    return True


def execute_action(state: AssistantState) -> str:
    contact = state.resolved_contact or {}
    email = contact.get("email", "")

    if not is_valid_email(email):
        return "I could not resolve a valid Teams user for that action."

    if state.intent == "make_call":
        open_teams_call(email)
        return f"Microsoft Teams is launching a call with {contact['displayName']} ({email})."

    if state.intent == "send_message":
        message = (state.message or "").strip()
        if not message:
            return "I still need the message text before I can open Teams."
        open_teams_chat(email, message)
        return f'Microsoft Teams opened a chat with {contact["displayName"]} ({email}). The message is pre-filled as "{message}".'

    return "I do not have an action to execute."


def handle_contact_selection(user_input: str, state: AssistantState) -> dict | None:
    if not state.candidate_contacts:
        return None

    value = user_input.strip().lower()
    if value.isdigit():
        index = int(value) - 1
        if 0 <= index < len(state.candidate_contacts):
            return state.candidate_contacts[index]

    for contact in state.candidate_contacts:
        if value == contact["email"].lower():
            return contact
        if value in contact["displayName"].lower():
            return contact

    return None


def format_candidates(candidates: list[dict]) -> str:
    lines = ["I found multiple matching people in Teams. Choose one:"]
    for index, contact in enumerate(candidates, start=1):
        lines.append(f"  [{index}] {contact['displayName']} ({contact['email']})")
    return "\n".join(lines)


def reply_and_record(history: list[dict[str, str]], message: str) -> None:
    print(f"  Assistant: {message}")
    history.append({"role": "assistant", "content": message})


def run_agent() -> None:
    print("\n" + "=" * 58)
    print("  AI Personal Assistant - Teams Integration")
    print("=" * 58)
    print("  Examples:")
    print('  - "Call Nandini"')
    print('  - "Send a message to Riya saying I will join in 10 minutes"')
    print("  The assistant will search Microsoft Teams contacts via Graph.")
    print("  Type 'quit' to exit.\n")

    state = AssistantState()
    history: list[dict[str, str]] = []

    try:
        graph = GraphDirectoryClient()
    except RuntimeError as exc:
        print(f"  {exc}")
        print("  Required env vars:")
        print("  - GRAPH_CLIENT_ID")
        print("  - Optional: GRAPH_TENANT_ID (defaults to 'organizations')\n")
        return

    while True:
        try:
            user_input = input("  You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n  Goodbye.\n")
            break

        if not user_input:
            continue
        if user_input.lower() in {"quit", "exit", "bye"}:
            print("\n  Goodbye.\n")
            break

        history.append({"role": "user", "content": user_input})

        selected_contact = handle_contact_selection(user_input, state)
        if selected_contact:
            state.resolved_contact = selected_contact
            state.candidate_contacts = []
        else:
            print("  Processing...", end="\r")
            try:
                parsed = parse_turn(history)
            except Exception as exc:
                print(" " * 40, end="\r")
                reply_and_record(history, f"Error talking to Ollama: {exc}")
                continue

            print(" " * 40, end="\r")

            if parsed.cancelled:
                reply_and_record(history, "Okay, cancelled.")
                state.reset()
                history = []
                continue

            if parsed.intent != "none" and parsed.intent != state.intent:
                state.reset()
                state.intent = parsed.intent

            if parsed.intent != "none" and state.intent is None:
                state.intent = parsed.intent

            if parsed.contact_query:
                query = parsed.contact_query.strip()
                if query.lower() != (state.contact_query or "").lower():
                    state.contact_query = query
                    state.resolved_contact = None
                    state.candidate_contacts = []

            if parsed.message:
                state.message = parsed.message.strip()

            if state.contact_query and not state.resolved_contact and not state.candidate_contacts:
                try:
                    matches = graph.search_people(state.contact_query)
                except Exception as exc:
                    reply_and_record(history, f"Microsoft Graph lookup failed: {exc}")
                    continue

                if not matches:
                    reply_and_record(
                        history,
                        f'I could not find anyone in Teams matching "{state.contact_query}". Try a fuller name.',
                    )
                    continue

                if len(matches) == 1:
                    state.resolved_contact = matches[0]
                else:
                    state.candidate_contacts = matches[:5]
                    reply_and_record(history, format_candidates(state.candidate_contacts))
                    continue

            if state.intent is None:
                reply_and_record(history, "Tell me who to call or message.")
                continue

            if not state.contact_query and not state.resolved_contact:
                reply_and_record(history, "Who do you want to contact on Teams?")
                continue

            if state.intent == "send_message" and not state.message:
                reply_and_record(history, "What message do you want to send?")
                continue

            if parsed.confirmed:
                result = execute_action(state)
                reply_and_record(history, result)
                state.reset()
                history = []
                continue

        if not state.resolved_contact:
            reply_and_record(history, "Who do you want to contact on Teams?")
            continue

        contact = state.resolved_contact
        if state.intent == "send_message" and not state.message:
            reply_and_record(history, f"What message do you want to send to {contact['displayName']}?")
            continue

        if state.intent == "make_call":
            reply_and_record(
                history,
                f"I found {contact['displayName']} ({contact['email']}). Should I place the Teams call?",
            )
            continue

        reply_and_record(
            history,
            f'I found {contact["displayName"]} ({contact["email"]}). Should I send this message: "{state.message}"?',
        )


if __name__ == "__main__":
    run_agent()
