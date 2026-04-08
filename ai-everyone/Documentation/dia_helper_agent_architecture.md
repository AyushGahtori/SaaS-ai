# Dia Helper Agent Architecture

The **Dia Helper** agent converts natural language project briefs into Mermaid diagrams and a ready-to-paste Figma AI prompt. It is deployed in both the local agents runtime and the detached EC2 runtime.

## Endpoints

- Local / EC2 FastAPI:
  - `GET /health`
  - `POST /diahelper/action`

## Request Contract

The `/diahelper/action` route accepts a JSON body shaped like:

```json
{
  "taskId": "optional-task-id",
  "userId": "firebase-uid",
  "agentId": "dia-helper-agent",
  "action": "generate_diagram",
  "prompt": "Design a signup flow from landing page to dashboard.",
  "projectContext": "Longer project brief goes here...",
  "diagramType": "flowchart",
  "fileKey": "optional-external-reference",
  "currentMermaid": "optional existing mermaid to update",
  "editInstruction": "optional incremental change, e.g. 'add a database layer'"
}
```

Supported actions:

- `generate_diagram` — create a new diagram from prompt + projectContext.
- `update_diagram` — refine an existing diagram using `editInstruction` and `currentMermaid`.

## Response Contract

Responses follow the shared agent execution contract:

```json
{
  "status": "success",
  "type": "dia_diagram",
  "message": "Diagram generated successfully.",
  "displayName": "Dia Helper",
  "result": {
    "artifactType": "diagram",
    "title": "Signup Flow - Flowchart",
    "summary": "Generated a flowchart from your prompt and project context.",
    "diagramType": "flowchart",
    "mermaid": "flowchart TD\n  ...",
    "figmaPrompt": "Create or update a FigJam diagram titled ...",
    "sources": [
      { "type": "project_context" },
      { "type": "figma_file", "fileKey": "..." }
    ]
  }
}
```

- `status` integrates with the existing interpreted-failure layer.
- `type: "dia_diagram"` is used by the frontend renderer to show the Flowchart Designer card.

## LLM / Diagram Logic

The agent uses **Gemini** when `GEMINI_API_KEY` is configured:

- System prompt asks for strict JSON with `title`, `diagramType`, `summary`, and `mermaid`.
- The raw model response is cleaned to extract the JSON object.
- If the JSON or Mermaid is invalid, the agent falls back to a deterministic Mermaid generator.

Fallback behavior (no `GEMINI_API_KEY` or network failure):

- Builds a simple but valid Mermaid diagram from the prompt + projectContext.
- Still returns a Figma-ready `figmaPrompt` so the UI can work without cloud access.

## Frontend Integration

- **Agent registry**: `dia-helper-agent` is registered in `AGENT_CATALOG` with actions `generate_diagram` and `update_diagram`.
- **Orchestration**: `/api/chat` prompt tells the parent LLM when to delegate to Dia Helper.
- **Direct UI API**: `POST /api/agents/dia-helper` forwards requests from the Flowchart Designer card directly to EC2 `/diahelper/action` without creating extra chat messages.
- **Result card**: `DiaHelperDiagramCard` renders:
  - A large project brief area.
  - Text-based file upload (used as additional context).
  - Live Mermaid preview via `mermaid.ink`.
  - A copyable Figma AI prompt.
  - A **Download diagram (PNG)** button.

Follow-up tweaks (e.g. “add a DB layer”) are entered inside the Dia Helper card, which calls `update_diagram` and re-renders the same card, rather than creating a new chat card.

