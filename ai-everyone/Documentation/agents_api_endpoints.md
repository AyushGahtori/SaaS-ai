# Teams Agent API Endpoints

Canonical endpoint contract for `teams-agent`.

## Public Routes (via Nginx)

- `POST /teams/action`
- `POST /email/action`
- `POST /calendar/action`
- `GET /teams/health`
- `GET /teams/auth/login?handoff=<token>`
- `GET /teams/auth/callback`
- `GET /teams/auth/status?handoff=<token>`
- `POST /teams/auth/logout`

## Action: `make_call`

```json
{
  "action": "make_call",
  "contact": "Aaron"
}
```

## Action: `send_message`

```json
{
  "action": "send_message",
  "contact": "Nandini",
  "message": "I'll be 10 minutes late"
}
```

## Action: `schedule_meeting`

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

## Notes

- Teams action responses return deep links and resolved attendee metadata.
- If attendee resolution fails, unresolved attendees are returned in payload.
- OAuth ownership is detached and handled on EC2 through `/teams/auth/*`.

---

# LMS Agent API Endpoints

Canonical endpoint contract for `lms-agent`.

## Public Routes (via Nginx)

- `POST /lms/action`
- `GET /lms/health`

## Supported Actions

- `run_lms_agent`
- `learner_progress_dashboard`
- `courses_catalog`
- `learners_directory`
- `learner_detail`
- `assignments_integrations`
- `list_snapshots`

## Sample: Dashboard

```json
{
  "taskId": "lms-1",
  "userId": "<uid>",
  "agentId": "lms-agent",
  "action": "learner_progress_dashboard",
  "dateRange": "Last 90 days",
  "department": "All"
}
```

## Sample: Snapshot List

```json
{
  "taskId": "lms-2",
  "userId": "<uid>",
  "agentId": "lms-agent",
  "action": "list_snapshots"
}
```
