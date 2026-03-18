# Teams Agent — HTTP API Endpoints

The teams-agent runs as a FastAPI server on **port 8100** (Docker-internal).
It is called directly by `firestore-tasks.server.ts` via the `AGENT_ROUTES` map.

---

## POST `/teams/action`

Executes a Teams agent action. Supports three actions:

### Action: `make_call`

**Request:**
```json
{
    "action": "make_call",
    "contact": "Aaron"
}
```
**Response:**
```json
{
    "status": "success",
    "type": "teams_call",
    "url": "msteams://teams.microsoft.com/l/call/0/0?users=aaron@company.com",
    "displayName": "Aaron Smith",
    "email": "aaron@company.com"
}
```

---

### Action: `send_message`

**Request:**
```json
{
    "action": "send_message",
    "contact": "Nandini",
    "message": "I'll be 10 minutes late"
}
```
**Response:**
```json
{
    "status": "success",
    "type": "teams_message",
    "url": "msteams://teams.microsoft.com/l/chat/0/0?users=nandini@company.com&message=...",
    "displayName": "Nandini Sharma",
    "email": "nandini@company.com"
}
```

---

### Action: `schedule_meeting`

Uses Microsoft Graph API to resolve attendee names to emails, then generates Teams and Outlook deep-link URLs.

**Request:**
```json
{
    "action": "schedule_meeting",
    "title": "Sprint Planning",
    "attendees": ["Aaron", "nandini@company.com"],
    "date": "2026-03-20",
    "time": "10:00",
    "duration": 60,
    "description": "Review sprint goals for Q2"
}
```
**Response:**
```json
{
    "status": "success",
    "type": "teams_meeting",
    "teamsUrl": "https://teams.microsoft.com/l/meeting/new?subject=Sprint+Planning&...",
    "outlookUrl": "https://outlook.office.com/calendar/action/compose?subject=Sprint+Planning&...",
    "title": "Sprint Planning",
    "date": "2026-03-20",
    "time": "10:00",
    "duration": 60,
    "resolvedAttendees": [
        {"name": "Aaron Smith", "email": "aaron@company.com"},
        {"name": "nandini@company.com", "email": "nandini@company.com"}
    ],
    "unresolvedAttendees": [],
    "description": "Review sprint goals for Q2"
}
```

> [!NOTE]
> If an attendee name cannot be resolved via Microsoft Graph, it appears in `unresolvedAttendees` and is omitted from the meeting URLs. The UI shows a ⚠ warning for unresolved attendees.

---

## GET `/health`

**Response:** `{ "status": "healthy", "agent": "teams-agent", "version": "1.0.0" }`

---

## Environment Variables

| Variable | Value | Description |
|---|---|---|
| `OLLAMA_URL` | `http://host.docker.internal:11434/api/chat` | Ollama (for internal LLM use) |
| `OLLAMA_MODEL_CLOUD` | `qwen3.5:397b-cloud` | Cloud model |
| `OLLAMA_MODEL_LOCAL` | `qwen2.5:7b` | Local model |
| `GRAPH_TENANT_ID` | (from .env) | Microsoft Entra tenant ID |
| `GRAPH_CLIENT_ID` | (from .env) | Microsoft Entra app client ID |
| `PORT` | `8100` | Server port |
