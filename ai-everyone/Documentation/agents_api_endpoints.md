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

---

# Travel Halper Agent API Endpoints

Canonical endpoint contract for `travel-halper-agent`.

## Public Routes (via Nginx)

- `POST /travelhalper/action`
- `GET /travelhalper/health`

## Supported Actions

- `plan_trip`
- `send_plan_email`

## Sample: Plan Trip

```json
{
  "taskId": "travel-1",
  "userId": "<uid>",
  "agentId": "travel-halper-agent",
  "action": "plan_trip",
  "prompt": "Plan a Delhi to Goa trip for 3 days in June with budget-friendly hotels."
}
```

## Sample: Send Plan Email

```json
{
  "taskId": "travel-2",
  "userId": "<uid>",
  "agentId": "travel-halper-agent",
  "action": "send_plan_email",
  "threadId": "reuse-thread-id-from-plan",
  "receiverEmail": "traveler@example.com",
  "subject": "Goa Trip Plan"
}
```

---

# Devika Engineer Agent API Endpoints

Canonical endpoint contract for `devika-engineer-agent`.

## Public Routes (via Nginx)

- `POST /devika/action`
- `GET /devika/health`

## Supported Actions

- `run_devika_agent`
- `plan_project`
- `research_plan`
- `implement_feature`
- `fix_bug`
- `run_project`
- `deploy_project`
- `generate_report`
- `answer_question`
- `repo_intake`
- `browser_strategy`
- `list_snapshots`
- `agent_status`
- `token_estimate`

## Sample: Auto Route Request

```json
{
  "taskId": "devika-1",
  "userId": "<uid>",
  "agentId": "devika-engineer-agent",
  "action": "run_devika_agent",
  "prompt": "Plan and implement a retry-safe webhook processor with dead-letter handling."
}
```

## Sample: Bug-Fix Strategy

```json
{
  "taskId": "devika-2",
  "userId": "<uid>",
  "agentId": "devika-engineer-agent",
  "action": "fix_bug",
  "errorLog": "TypeError: Cannot read properties of undefined (reading 'status')",
  "codeSnippet": "if (job.result.status === 'ok') { ... }"
}
```

---

# Data Analyst Agent API Endpoints

Canonical endpoint contract for `data-analyst-agent`.

## Public Routes (via Nginx)

- `POST /dataanalyst/action`
- `GET /dataanalyst/health`

## Supported Actions

- `monitor`
- `autonomous`
- `list_capabilities`

## Sample: Monitor Dataset

```json
{
  "taskId": "data-1",
  "userId": "<uid>",
  "agentId": "data-analyst-agent",
  "action": "monitor",
  "label": "weekly_revenue",
  "data": [100, 102, 98, 105, 5000, 101, 99]
}
```

## Sample: Autonomous Analysis

```json
{
  "taskId": "data-2",
  "userId": "<uid>",
  "agentId": "data-analyst-agent",
  "action": "autonomous",
  "goal": "Review churn metric quality and suggest next checks",
  "data": [2.1, 2.0, 2.2, 2.1, 5.9, 2.0]
}
```
