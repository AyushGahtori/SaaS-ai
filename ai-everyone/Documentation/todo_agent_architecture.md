# Todo Agent Architecture

The Todo agent manages per-user tasks using Firestore.

## Execution Path

1. User message is parsed by orchestration layer.
2. Agent intent creates/updates an `agentTasks` entry.
3. Backend calls `POST /todo/action`.
4. Todo agent performs CRUD in Firestore scoped by `userId`.
5. Result is written back into task output.

## Data Model

Collection: `todos`

| Field | Type | Notes |
|---|---|---|
| `_id` | string | UUID |
| `userId` | string | owner UID |
| `title` | string | task text |
| `datetime` | string | ISO-like datetime |
| `status` | string | `pending` or `done` |
| `priority` | string | `low`, `normal`, `high` |
| `tags` | array | optional labels |
| `createdAt` | timestamp | server timestamp |

## Security

- Application-level ownership checks include `where("userId", "==", userId)`.
- Firestore rules should enforce user ownership for read/write.

## API

- `POST /todo/action`
- `GET /todo/health`

Supported actions:

- `add_task`
- `list_tasks`
- `list_tasks_by_date`
- `delete_task`
- `mark_done`

## Deployment Model

Todo is deployed in detached EC2 runtime:

- Process: `todo-agent` on port `8200`
- Public route: `${AGENT_PUBLIC_BASE_URL}/todo/action`
- No OAuth required
