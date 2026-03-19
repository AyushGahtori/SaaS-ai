# To-Do Agent — Architecture & Database Schema

The **To-Do Agent** manages personal tasks and schedules for SnitchX users. It has been migrated from a legacy MongoDB setup to a secure, multi-tenant **Firebase Firestore** architecture.

---

## 🏗 System Architecture

The agent follows the **Direct Execution** model:
1. **Parent LLM (Next.js)**: Receives user input (e.g., "Add buy milk tomorrow").
2. **Intent Parsing**: Extracts the action (`add_task`) and parameters (`title`, `datetime`) using `<AGENT_INTENT>` tags.
3. **Task Creation**: Creates a record in the `agentTasks` collection.
4. **Execution**: Next.js calls the To-Do Agent's Python FastAPI server (`/todo/action`).
5. **Persistence**: The Python server interacts with Firestore using the `firebase-admin` SDK, strictly isolating data by `userId`.

---

## 🗄 Database Schema — `todos` Collection

**Path**: `todos/{docId}` (Top-level collection)

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Auto-generated UUID v4 |
| `userId` | string | **CRITICAL**: The Firebase Auth UID of the owner. Used for isolation. |
| `title` | string | The name/description of the task. |
| `datetime` | string | ISO-formatted string (YYYY-MM-DD HH:MM) for the deadline/reminder. |
| `status` | string | `pending` or `done`. |
| `priority` | string | `low`, `normal`, or `high`. |
| `tags` | array | List of categories (e.g., `["work", "urgent"]`). |
| `createdAt` | timestamp | Server-side timestamp of creation. |

### Indexing Requirements
To ensure performance and security, the following indexes are required:
- `userId` (Ascending)
- `datetime` (Ascending / Descending)

---

## 🔒 Security & Data Isolation

Data isolation is enforced at two levels:

1. **Application Level (Python)**:
   All functions in `db/firestore.py` explicitly require a `user_id`. Every query includes a `.where("userId", "==", user_id)` clause.
   - Example: `update_task` and `delete_task` check ownership before modifying any document.

2. **Database Level (Firestore Rules)**:
   ```javascript
   match /todos/{docId} {
     // Users can only read/write their own to-dos
     allow read, update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
     // New to-dos must be attributed to the authenticated user
     allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
   }
   ```

---

## 🚀 API Endpoints

The To-Do Agent runs a FastAPI server inside the Docker container, listening on **port 8200** by default.

### `POST /todo/action`
This is the primary listener that receives commands from the SnitchX Parent LLM.

**Network Mapping**:
- **Teams Agent**: Port `8100` (`/teams/action`)
- **To-Do Agent**: Port `8200` (`/todo/action`)

**Supported Actions**:
- `add_task`: Requires `title`, optional `datetime`.
- `list_tasks`: Optional `status` filter (`pending` / `done`).
- `list_tasks_by_date`: Requires `datetime` (YYYY-MM-DD).
- `delete_task`: Requires `task_id` OR `title` (fuzzy match).
- `mark_done`: Requires `task_id` OR `title` (fuzzy match).

---

## ☁️ Production Deployment (Vercel)

When deploying the Next.js frontend to a cloud platform like **Vercel**, it can no longer communicate with the Python agents over `localhost` because Vercel runs in a completely separate cloud infrastructure. 

You must deploy your Python API servers (e.g., using Render, Heroku, Google Cloud Run, or Railway) to get public HTTPS endpoints for them. 

Once your Python agents are deployed, you need to add the following **Environment Variables** in your Vercel Project Settings to override the `localhost` defaults:

- `TODO_AGENT_URL`= `https://your-todo-agent-url.onrender.com`
- `TEAMS_AGENT_URL`= `https://your-teams-agent-url.onrender.com`

If these environment variables are detected by Next.js, it will route the LLM agent tasks to your production server instead of looking for them locally.

---

## 🛠 Directory Structure

Inside `agents/todo-agent`:
- `main.py`: Entry point, starts the Uvicorn server on port 8200.
- `api/server.py`: Defines the FastAPI routes and action logic.
- `db/firestore.py`: Data Access Object (DAO) for Firestore.
- `requirements.txt`: Python dependencies (including `firebase-admin`).
- `.env`: (Optional) Can override `PORT=8200`.
