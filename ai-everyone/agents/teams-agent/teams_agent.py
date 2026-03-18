"""
Teams Agent — refactored for server-side execution.

Adapted from the original assistant_agent.py (Teams_msg_call_instant).
- Removed: CLI loop, subprocess.run, webbrowser.open, interactive input
- Changed: Returns structured JSON instead of opening URLs
- Changed: Accepts task data as input, returns result as output
- Kept: Ollama intent parsing, Microsoft Graph contact search
"""

import json
import os
import re
import urllib.parse
from dataclasses import dataclass, field

import msal
import requests

# ---------------------------------------------------------------------------
# Configuration (from environment variables)
# ---------------------------------------------------------------------------

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434/api/chat")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0"
GRAPH_TENANT_ID = os.getenv("GRAPH_TENANT_ID", "")
GRAPH_CLIENT_ID = os.getenv("GRAPH_CLIENT_ID", "")
GRAPH_SCOPES = ["User.Read", "People.Read", "User.ReadBasic.All"]
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class ParsedTurn:
    intent: str
    contact_query: str | None
    message: str | None
    confirmed: bool
    cancelled: bool


# ---------------------------------------------------------------------------
# Microsoft Graph client
# ---------------------------------------------------------------------------

class GraphDirectoryClient:
    """Searches Microsoft Teams contacts via the Graph API."""

    def __init__(self) -> None:
        if not GRAPH_CLIENT_ID:
            raise RuntimeError(
                "GRAPH_CLIENT_ID is required. "
                "Set it in the agent server's .env file."
            )

        authority = f"https://login.microsoftonline.com/{GRAPH_TENANT_ID}"
        self.app = msal.PublicClientApplication(
            GRAPH_CLIENT_ID,
            authority=authority,
        )
        self.token: str | None = None

    def acquire_token(self) -> str:
        """Acquire a Graph access token via device code flow."""
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

        print(f"\nMicrosoft sign-in required: {flow['message']}")
        result = self.app.acquire_token_by_device_flow(flow)
        if "access_token" not in result:
            raise RuntimeError(result.get("error_description", "Microsoft sign-in failed."))

        self.token = result["access_token"]
        return self.token

    def get(self, path: str, params: dict | None = None) -> dict:
        response = requests.get(
            f"{GRAPH_BASE_URL}{path}",
            params=params,
            headers={"Authorization": f"Bearer {self.acquire_token()}"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

    def search_people(self, query: str) -> list[dict]:
        query = query.strip()
        if not query:
            return []

        if _is_valid_email(query):
            return [{"displayName": query, "email": query}]

        results: list[dict] = []
        results.extend(self._search_me_people(query))
        results.extend(self._search_users(query))
        return _rank_and_deduplicate(query, results)

    def _search_me_people(self, query: str) -> list[dict]:
        try:
            payload = self.get(
                "/me/people",
                params={"$search": f'"{query}"', "$top": "10"},
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
                contacts.append({"displayName": person.get("displayName") or email, "email": email})
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
                params={"$filter": filter_query, "$select": "displayName,mail,userPrincipalName", "$top": "10"},
            )
        except requests.HTTPError:
            return []

        contacts = []
        for user in payload.get("value", []):
            email = user.get("mail") or user.get("userPrincipalName")
            if email:
                contacts.append({"displayName": user.get("displayName") or email, "email": email})
        return contacts


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_valid_email(value: str | None) -> bool:
    return bool(value and EMAIL_PATTERN.match(value.strip()))


def _rank_and_deduplicate(query: str, contacts: list[dict]) -> list[dict]:
    query_lower = query.lower()
    words = [w for w in query_lower.split() if w]
    ranked, seen = [], set()

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
        score += sum(10 for w in words if w in name_lower)

        seen.add(email)
        ranked.append((score, {"displayName": name or email, "email": email}))

    ranked.sort(key=lambda item: (-item[0], item[1]["displayName"]))
    return [c for _, c in ranked]


def _build_teams_call_url(email: str) -> str:
    return f"msteams://teams.microsoft.com/l/call/0/0?users={email}"


def _build_teams_message_url(email: str, message: str) -> str:
    encoded = urllib.parse.quote(message)
    return f"msteams://teams.microsoft.com/l/chat/0/0?users={email}&message={encoded}"


def _build_teams_meeting_url(title: str, attendees: list[str], description: str, start_dt_str: str, end_dt_str: str) -> str:
    """Build a Microsoft Teams deep-link URL to pre-fill a meeting."""
    subject = urllib.parse.quote(title or "Team Meeting")
    attendees_str = urllib.parse.quote(",".join(attendees))
    content = urllib.parse.quote(description or "")
    # Format for Teams: YYYY-MM-DDTHH:mm:ss
    start = urllib.parse.quote(start_dt_str)
    end = urllib.parse.quote(end_dt_str)

    return (
        f"https://teams.microsoft.com/l/meeting/new?"
        f"subject={subject}"
        f"&attendees={attendees_str}"
        f"&content={content}"
        f"&startTime={start}"
        f"&endTime={end}"
    )


def _build_outlook_meeting_url(title: str, attendees: list[str], description: str, start_dt_str: str, end_dt_str: str) -> str:
    """Fallback: Outlook Web new event with Teams meeting enabled."""
    subject = urllib.parse.quote(title or "Team Meeting")
    attendees_str = urllib.parse.quote(";".join(attendees))
    body = urllib.parse.quote(description or "")
    start = urllib.parse.quote(start_dt_str)
    end = urllib.parse.quote(end_dt_str)

    return (
        f"https://outlook.office.com/calendar/action/compose?"
        f"subject={subject}&to={attendees_str}&body={body}"
        f"&startdt={start}&enddt={end}&isonlinemeeting=true"
    )


# ---------------------------------------------------------------------------
# Main agent function — called by the FastAPI server
# ---------------------------------------------------------------------------

def run_teams_action(task_data: dict) -> dict:
    """
    Execute a Teams agent action.

    Input (task_data):
        {
            # For make_call / send_message:
            "action": "make_call" | "send_message" | "schedule_meeting",
            "contact": "person name or email",
            "message": "optional message text",
            # For schedule_meeting:
            "title": "Meeting Title",
            "attendees": ["Name", "email@corp.com"],
            "date": "YYYY-MM-DD",
            "time": "HH:MM",
            "duration": 60,
            "description": "agenda"
        }

    Output:
        {
            "status": "success" | "failed",
            "type": "teams_call" | "teams_message",
            "url": "msteams://...",
            "displayName": "...",
            "email": "...",
            "error": "..." (only on failure)
        }
    """
    action = task_data.get("action", "")

    # Route schedule_meeting before contact validation (it uses different params)
    if action == "schedule_meeting":
        return _handle_schedule_meeting(task_data)

    contact_query = task_data.get("contact", "")
    message_text = task_data.get("message", "")

    if not contact_query:
        return {"status": "failed", "error": "No contact specified."}

    if action not in ("make_call", "send_message"):
        return {"status": "failed", "error": f"Unknown action: {action}"}

    if action == "send_message" and not message_text:
        return {"status": "failed", "error": "No message text provided for send_message action."}

    # ── Resolve contact ──────────────────────────────────────────────────
    try:
        graph = GraphDirectoryClient()
        matches = graph.search_people(contact_query)
    except Exception as exc:
        # If Graph is not configured, fall back to using the query as-is
        # (assumes user provided an email or we just use it verbatim)
        if _is_valid_email(contact_query):
            matches = [{"displayName": contact_query, "email": contact_query}]
        else:
            return {
                "status": "failed",
                "error": f"Microsoft Graph lookup failed: {exc}. "
                         f"Ensure GRAPH_CLIENT_ID and GRAPH_TENANT_ID are set.",
            }

    if not matches:
        return {
            "status": "failed",
            "error": f'No Teams contact found matching "{contact_query}".',
        }

    # Use the best match (first result)
    contact = matches[0]
    email = contact["email"]
    display_name = contact["displayName"]

    # ── Build result ─────────────────────────────────────────────────────
    if action == "make_call":
        return {
            "status": "success",
            "type": "teams_call",
            "url": _build_teams_call_url(email),
            "displayName": display_name,
            "email": email,
        }

    if action == "send_message":
        return {
            "status": "success",
            "type": "teams_message",
            "url": _build_teams_message_url(email, message_text),
            "displayName": display_name,
            "email": email,
        }

    return {"status": "failed", "error": "Unexpected state."}


def _handle_schedule_meeting(data: dict) -> dict:
    """Port of assistant.py logic replacing PowerShell with Graph API."""
    title = data.get("title", "Team Meeting")
    attendees_raw = data.get("attendees", [])
    if isinstance(attendees_raw, str):
        attendees_raw = [attendees_raw]
    
    date_str = data.get("date", "")
    time_str = data.get("time", "")
    duration = int(data.get("duration", 30))
    description = data.get("message") or data.get("description", "")

    if not date_str or not time_str:
        return {"status": "failed", "error": "Missing date or time for meeting."}

    # ── Resolve Attendees ────────────────────────────────────────────────
    graph = GraphDirectoryClient()
    resolved_emails = []
    resolved_details = []
    unresolved = []

    for name in attendees_raw:
        if _is_valid_email(name):
            email = name.strip()
            resolved_emails.append(email)
            resolved_details.append({"name": email, "email": email})
            continue
        
        try:
            matches = graph.search_people(name)
            if matches:
                # Take best match
                match = matches[0]
                resolved_emails.append(match["email"])
                resolved_details.append({
                    "name": match["displayName"],
                    "email": match["email"]
                })
            else:
                unresolved.append(name)
        except Exception:
            unresolved.append(name)

    # ── Calculate Timestamps ─────────────────────────────────────────────
    # Format: YYYY-MM-DDTHH:mm:ss
    try:
        from datetime import datetime, timedelta
        start_dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=duration)
        
        start_ts = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
        end_ts = end_dt.strftime("%Y-%m-%dT%H:%M:%S")
    except Exception as exc:
        return {"status": "failed", "error": f"Invalid date/time format: {exc}"}

    # ── Build URLs ───────────────────────────────────────────────────────
    teams_url = _build_teams_meeting_url(title, resolved_emails, description, start_ts, end_ts)
    outlook_url = _build_outlook_meeting_url(title, resolved_emails, description, start_ts, end_ts)

    return {
        "status": "success",
        "type": "teams_meeting",
        "teamsUrl": teams_url,
        "outlookUrl": outlook_url,
        "title": title,
        "date": date_str,
        "time": time_str,
        "duration": duration,
        "resolvedAttendees": resolved_details,
        "unresolvedAttendees": unresolved,
        "description": description
    }
