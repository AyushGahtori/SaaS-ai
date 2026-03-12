# Chatbot-UI — Complete Chat Pipeline File Reference

Every file in the `mckaywrigley/chatbot-ui` repository that participates in the chat system, from the moment a user types a message to the moment the AI response is rendered.

---

## 1. Core Chat Logic (The Engine)

These files contain the **main orchestration** — they validate input, build the request, call the API, stream the response, and persist everything.

| File | Role |
|------|------|
| [index.ts](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts) | **Central hub of the chat pipeline.** Contains [validateChatSettings](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#26-53), [createTempMessages](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#82-146), [handleHostedChat](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#190-248), [handleLocalChat](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#147-189), [fetchChatResponse](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#249-280), [processResponse](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#281-345), [handleCreateChat](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#346-386), and [handleCreateMessages](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#387-512). Every step from validation → API call → streaming → DB persistence lives here. |
| [use-chat-handler.tsx](file:///e:/chatbot-ui/components/chat/chat-hooks/use-chat-handler.tsx) | **Primary hook that drives the chat flow.** Exposes [handleSendMessage](file:///e:/chatbot-ui/components/chat/chat-hooks/use-chat-handler.tsx#191-391), [handleNewChat](file:///e:/chatbot-ui/components/chat/chat-hooks/use-chat-handler.tsx#80-180), [handleStopMessage](file:///e:/chatbot-ui/components/chat/chat-hooks/use-chat-handler.tsx#185-190), and [handleSendEdit](file:///e:/chatbot-ui/components/chat/chat-hooks/use-chat-handler.tsx#392-412). Calls into [chat-helpers/index.ts](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts) to execute each step. This is the entry point when the user presses "Send". |
| [use-chat-history.tsx](file:///e:/chatbot-ui/components/chat/chat-hooks/use-chat-history.tsx) | Manages undo functionality and chat message history navigation (going back to previous message states). |
| [use-scroll.tsx](file:///e:/chatbot-ui/components/chat/chat-hooks/use-scroll.tsx) | Auto-scrolls the chat window as new tokens stream in, and handles scroll-to-bottom behavior. |
| [use-prompt-and-command.tsx](file:///e:/chatbot-ui/components/chat/chat-hooks/use-prompt-and-command.tsx) | Detects slash commands (`/`) and at-mentions (`@`) in the input, opens pickers for prompts, files, tools, and assistants. |
| [use-select-file-handler.tsx](file:///e:/chatbot-ui/components/chat/chat-hooks/use-select-file-handler.tsx) | Handles file selection and upload when the user attaches files to a chat message. |

---

## 2. API Routes (Backend)

These Next.js API route handlers receive the chat request from the frontend and forward it to the respective AI provider's SDK. Each returns a **streaming response**.

| File | Role |
|------|------|
| [route.ts](file:///e:/chatbot-ui/app/api/chat/openai/route.ts) | API route for **OpenAI** (GPT models). Receives the JSON payload, calls the OpenAI SDK, and streams the response back. |
| [route.ts](file:///e:/chatbot-ui/app/api/chat/anthropic/route.ts) | API route for **Anthropic** (Claude models). Same pattern — receives payload, calls Anthropic SDK, streams response. |
| [route.ts](file:///e:/chatbot-ui/app/api/chat/google/route.ts) | API route for **Google** (Gemini models). Handles Google AI-specific request formatting and streaming. |
| [route.ts](file:///e:/chatbot-ui/app/api/chat/azure/route.ts) | API route for **Azure OpenAI**. Routes to Azure-deployed OpenAI models with Azure-specific auth. |
| [route.ts](file:///e:/chatbot-ui/app/api/chat/mistral/route.ts) | API route for **Mistral** models. |
| [route.ts](file:///e:/chatbot-ui/app/api/chat/groq/route.ts) | API route for **Groq** models (fast inference). |
| [route.ts](file:///e:/chatbot-ui/app/api/chat/perplexity/route.ts) | API route for **Perplexity** models. |
| [route.ts](file:///e:/chatbot-ui/app/api/chat/openrouter/route.ts) | API route for **OpenRouter** (multi-model router). |
| [route.ts](file:///e:/chatbot-ui/app/api/chat/custom/route.ts) | API route for **custom/self-hosted** models. Allows connecting to any OpenAI-compatible endpoint. |
| [route.ts](file:///e:/chatbot-ui/app/api/chat/tools/route.ts) | API route for **tool-use / function-calling** flows. Handles tool invocation and result processing. |

---

## 3. Message Rendering

These components take a `ChatMessage` object and render it as a styled bubble in the conversation.

| File | Role |
|------|------|
| [message.tsx](file:///e:/chatbot-ui/components/messages/message.tsx) | **Main message component.** Renders a single chat message (user or assistant). Handles edit mode, copy, regenerate, role-based styling, and image display. |
| [message-actions.tsx](file:///e:/chatbot-ui/components/messages/message-actions.tsx) | Renders the action buttons on each message (copy, edit, regenerate, delete). |
| [message-codeblock.tsx](file:///e:/chatbot-ui/components/messages/message-codeblock.tsx) | Renders fenced code blocks inside messages with syntax highlighting and a copy button. |
| [message-markdown.tsx](file:///e:/chatbot-ui/components/messages/message-markdown.tsx) | Converts the raw markdown content of a message into rendered HTML using react-markdown. |
| [message-markdown-memoized.tsx](file:///e:/chatbot-ui/components/messages/message-markdown-memoized.tsx) | Memoized wrapper around [message-markdown.tsx](file:///e:/chatbot-ui/components/messages/message-markdown.tsx) to avoid unnecessary re-renders during streaming. |
| [message-replies.tsx](file:///e:/chatbot-ui/components/messages/message-replies.tsx) | Handles branching / reply navigation when a message has multiple response variants. |

---

## 4. Chat UI Components

The components that make up the visible chat interface — input bar, message list, settings, and pickers.

| File | Role |
|------|------|
| [chat-ui.tsx](file:///e:/chatbot-ui/components/chat/chat-ui.tsx) | **Top-level chat page component.** Composes the message list, input bar, scroll buttons, and settings. This is the main "chat view" layout. |
| [chat-input.tsx](file:///e:/chatbot-ui/components/chat/chat-input.tsx) | **The text input bar** where the user types messages. Handles text state, submit on Enter, file attachment triggers, and connection to `useChatHandler.handleSendMessage`. |
| [chat-messages.tsx](file:///e:/chatbot-ui/components/chat/chat-messages.tsx) | Iterates over the `chatMessages` array and renders each one using the [Message](file:///e:/chatbot-ui/components/chat/chat-hooks/use-chat-handler.tsx#191-391) component. This is the scrollable message list. |
| [chat-scroll-buttons.tsx](file:///e:/chatbot-ui/components/chat/chat-scroll-buttons.tsx) | Scroll-to-top and scroll-to-bottom floating buttons in the chat view. |
| [chat-secondary-buttons.tsx](file:///e:/chatbot-ui/components/chat/chat-secondary-buttons.tsx) | Secondary action buttons near the chat input (e.g., undo, side panel toggles). |
| [chat-settings.tsx](file:///e:/chatbot-ui/components/chat/chat-settings.tsx) | Chat-level settings panel (model, temperature, context length, prompt). Allows changing settings per conversation. |
| [chat-command-input.tsx](file:///e:/chatbot-ui/components/chat/chat-command-input.tsx) | Overlay input that appears when the user types a command prefix (e.g., `/`), integrating with pickers. |
| [chat-files-display.tsx](file:///e:/chatbot-ui/components/chat/chat-files-display.tsx) | Displays file attachments within the chat—both files the user uploaded and retrieved file chunks. |
| [chat-retrieval-settings.tsx](file:///e:/chatbot-ui/components/chat/chat-retrieval-settings.tsx) | Settings for retrieval-augmented generation (RAG) — embeddings provider, source count, etc. |
| [chat-help.tsx](file:///e:/chatbot-ui/components/chat/chat-help.tsx) | Help overlay that shows available slash commands, keyboard shortcuts, and usage tips. |
| [prompt-picker.tsx](file:///e:/chatbot-ui/components/chat/prompt-picker.tsx) | Dropdown picker for saved prompts, triggered by typing `/` in the input. |
| [file-picker.tsx](file:///e:/chatbot-ui/components/chat/file-picker.tsx) | Dropdown picker for attaching files from the workspace, triggered by `#`. |
| [tool-picker.tsx](file:///e:/chatbot-ui/components/chat/tool-picker.tsx) | Dropdown picker for selecting tools/plugins to use in the conversation. |
| [assistant-picker.tsx](file:///e:/chatbot-ui/components/chat/assistant-picker.tsx) | Dropdown picker for selecting an assistant, triggered by `@`. |
| [quick-settings.tsx](file:///e:/chatbot-ui/components/chat/quick-settings.tsx) | Quick-access settings bar to rapidly switch model/preset without opening full settings. |
| [quick-setting-option.tsx](file:///e:/chatbot-ui/components/chat/quick-setting-option.tsx) | Individual option item inside the quick settings dropdown. |

---

## 5. Sidebar & Chat Switching

These files power the left sidebar where the user creates new chats, lists existing ones, and switches between them.

| File | Role |
|------|------|
| [sidebar.tsx](file:///e:/chatbot-ui/components/sidebar/sidebar.tsx) | **Main sidebar container.** The outer shell that holds search, content list, and create buttons. |
| [sidebar-content.tsx](file:///e:/chatbot-ui/components/sidebar/sidebar-content.tsx) | Determines which type of content to show in the sidebar (chats, prompts, files, etc.) based on the active tab. |
| [sidebar-data-list.tsx](file:///e:/chatbot-ui/components/sidebar/sidebar-data-list.tsx) | **Generic data list** that renders items (chats, prompts, etc.) with folder grouping, drag-and-drop, and filtering. This is the backbone of the sidebar's item display. |
| [sidebar-create-buttons.tsx](file:///e:/chatbot-ui/components/sidebar/sidebar-create-buttons.tsx) | "New Chat" and other create buttons at the top of the sidebar. Triggers [handleNewChat](file:///e:/chatbot-ui/components/chat/chat-hooks/use-chat-handler.tsx#80-180). |
| [sidebar-search.tsx](file:///e:/chatbot-ui/components/sidebar/sidebar-search.tsx) | Search/filter input within the sidebar to find chats by name. |
| [sidebar-switcher.tsx](file:///e:/chatbot-ui/components/sidebar/sidebar-switcher.tsx) | Tab switcher at the top of the sidebar to toggle between content types (chats, prompts, assistants, files, etc.). |
| [sidebar-switch-item.tsx](file:///e:/chatbot-ui/components/sidebar/sidebar-switch-item.tsx) | Individual tab button inside the sidebar switcher. |
| [chat-item.tsx](file:///e:/chatbot-ui/components/sidebar/items/chat/chat-item.tsx) | **Renders a single chat entry** in the sidebar. Clicking it navigates to that chat. Shows name and allows rename/delete. |
| [update-chat.tsx](file:///e:/chatbot-ui/components/sidebar/items/chat/update-chat.tsx) | Dialog/form for renaming a chat from the sidebar. |
| [delete-chat.tsx](file:///e:/chatbot-ui/components/sidebar/items/chat/delete-chat.tsx) | Confirmation dialog for deleting a chat from the sidebar. |

---

## 6. State Management

Global application state that stores chats, messages, selected models, and all other shared data.

| File | Role |
|------|------|
| [context.tsx](file:///e:/chatbot-ui/context/context.tsx) | **Defines [ChatbotUIContext](file:///e:/chatbot-ui/context/context.tsx#15-140)** — the React context that holds ALL global state: `chats`, `chatMessages`, `selectedChat`, `chatSettings`, `models`, `userInput`, `isGenerating`, `chatFiles`, `folders`, and 50+ other state fields. Every component reads from and writes to this context. |
| [global-state.tsx](file:///e:/chatbot-ui/components/utility/global-state.tsx) | **Initializes global state.** Wraps the app with `ChatbotUIContext.Provider`, creates all `useState` hooks for every state field, and runs [fetchStartingData](file:///e:/chatbot-ui/components/utility/global-state.tsx#155-199) to load the user's profile, workspaces, and settings from the database on mount. |
| [providers.tsx](file:///e:/chatbot-ui/components/utility/providers.tsx) | Wraps the app with theme and tooltip providers. Part of the provider chain. |

---

## 7. Database Layer (Supabase)

Functions that read from and write to the Supabase/PostgreSQL database. These are called from the chat helpers and hooks.

| File | Role |
|------|------|
| [chats.ts](file:///e:/chatbot-ui/db/chats.ts) | CRUD operations for chats: `createChat`, `getChats`, `getChatById`, `updateChat`, `deleteChat`. Called when a new conversation starts or the user renames/deletes a chat. |
| [messages.ts](file:///e:/chatbot-ui/db/messages.ts) | CRUD operations for messages: `createMessage`, `getMessages`, `updateMessage`, `deleteMessage`. Called after the AI response completes to persist both user and assistant messages. |
| [chat-files.ts](file:///e:/chatbot-ui/db/chat-files.ts) | Manages the many-to-many relationship between chats and attached files. |
| [message-file-items.ts](file:///e:/chatbot-ui/db/message-file-items.ts) | Links individual file chunks (from RAG retrieval) to specific messages. |
| [folders.ts](file:///e:/chatbot-ui/db/folders.ts) | CRUD for folders that organize chats in the sidebar. |
| [models.ts](file:///e:/chatbot-ui/db/models.ts) | CRUD for custom model records the user has configured. |
| [profile.ts](file:///e:/chatbot-ui/db/profile.ts) | Reads/updates the user's profile, which stores API keys, display name, and preferences. |
| [workspaces.ts](file:///e:/chatbot-ui/db/workspaces.ts) | CRUD for workspaces. Chats belong to workspaces; switching workspace changes the visible chat list. |
| [presets.ts](file:///e:/chatbot-ui/db/presets.ts) | CRUD for saved chat presets (model + settings combinations). |
| [prompts.ts](file:///e:/chatbot-ui/db/prompts.ts) | CRUD for saved prompt templates that can be inserted via `/`. |
| [files.ts](file:///e:/chatbot-ui/db/files.ts) | CRUD for uploaded files and their metadata. |
| [assistants.ts](file:///e:/chatbot-ui/db/assistants.ts) | CRUD for assistants (custom personas with specific system prompts and attached files). |
| [tools.ts](file:///e:/chatbot-ui/db/tools.ts) | CRUD for tool/plugin configurations. |

---

## 8. Type Definitions

TypeScript types that define the shape of data flowing through the chat pipeline.

| File | Role |
|------|------|
| [chat.ts](file:///e:/chatbot-ui/types/chat.ts) | Defines [ChatSettings](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#26-53), `ChatPayload`, `ChatAPIPayload` — the core types for chat configuration and the request payload sent to the API. |
| [chat-message.ts](file:///e:/chatbot-ui/types/chat-message.ts) | Defines `ChatMessage` — the type representing a single message in the conversation (role, content, file items, etc.). |
| [llms.ts](file:///e:/chatbot-ui/types/llms.ts) | Defines `LLM` and `OpenRouterLLM` — the type for model definitions including provider, model ID, max tokens, and capabilities. |
| [chat-file.tsx](file:///e:/chatbot-ui/types/chat-file.tsx) | Defines `ChatFile` — represents a file attached to a chat. |
| [content-type.ts](file:///e:/chatbot-ui/types/content-type.ts) | Defines `ContentType` enum — the types of content that can be displayed in the sidebar (chats, prompts, files, etc.). |
| [models.ts](file:///e:/chatbot-ui/types/models.ts) | Defines `ModelProvider` — the enum of supported AI providers. |
| [key-type.ts](file:///e:/chatbot-ui/types/key-type.ts) | Defines the types for API key environment variable names. |
| [valid-keys.ts](file:///e:/chatbot-ui/types/valid-keys.ts) | Defines `VALID_ENV_KEYS` — the list of recognized API key environment variable names for all providers. |
| [sidebar-data.ts](file:///e:/chatbot-ui/types/sidebar-data.ts) | Defines the shape of data displayed in the sidebar. |
| [index.ts](file:///e:/chatbot-ui/types/index.ts) | Barrel export file — re-exports all types from a single import path. |

---

## 9. Model Configuration & Provider Lists

Defines which models are available for each provider and how to fetch them.

| File | Role |
|------|------|
| [fetch-models.ts](file:///e:/chatbot-ui/lib/models/fetch-models.ts) | **Fetches available models** from each provider based on which API keys are configured. Combines hosted, local, and OpenRouter models into a single list. |
| [llm-list.ts](file:///e:/chatbot-ui/lib/models/llm/llm-list.ts) | **Master aggregator** — imports all per-provider model lists and exports them as one combined array. |
| [openai-llm-list.ts](file:///e:/chatbot-ui/lib/models/llm/openai-llm-list.ts) | Defines available OpenAI models (GPT-4, GPT-3.5, etc.) with their capabilities and limits. |
| [anthropic-llm-list.ts](file:///e:/chatbot-ui/lib/models/llm/anthropic-llm-list.ts) | Defines available Anthropic models (Claude 3, etc.). |
| [google-llm-list.ts](file:///e:/chatbot-ui/lib/models/llm/google-llm-list.ts) | Defines available Google models (Gemini, etc.). |
| [mistral-llm-list.ts](file:///e:/chatbot-ui/lib/models/llm/mistral-llm-list.ts) | Defines available Mistral models. |
| [groq-llm-list.ts](file:///e:/chatbot-ui/lib/models/llm/groq-llm-list.ts) | Defines available Groq models. |
| [perplexity-llm-list.ts](file:///e:/chatbot-ui/lib/models/llm/perplexity-llm-list.ts) | Defines available Perplexity models. |
| [chat-setting-limits.ts](file:///e:/chatbot-ui/lib/chat-setting-limits.ts) | Defines per-model limits for temperature, context length, and max output tokens. Used by the chat settings UI. |

---

## 10. Server Utilities

Server-side helpers used by the API routes.

| File | Role |
|------|------|
| [server-chat-helpers.ts](file:///e:/chatbot-ui/lib/server/server-chat-helpers.ts) | **Server-side helpers** for API routes. Parses the incoming request body, validates API keys, and builds provider-specific payloads. |
| [server-utils.ts](file:///e:/chatbot-ui/lib/server/server-utils.ts) | General-purpose server utilities (e.g., checking environment variables). |

---

## 11. Prompt Building & Stream Processing

| File | Role |
|------|------|
| [build-prompt.ts](file:///e:/chatbot-ui/lib/build-prompt.ts) | **Builds the final prompt array** sent to the AI. Combines the system prompt, chat history, file context, and the user's latest message into the format expected by the model API. Handles token counting and truncation. |
| [consume-stream.ts](file:///e:/chatbot-ui/lib/consume-stream.ts) | **Consumes a ReadableStream** from the API response. Reads chunks, decodes them, and concatenates the full response text as tokens arrive. Used by [processResponse](file:///e:/chatbot-ui/components/chat/chat-helpers/index.ts#281-345) in `chat-helpers`. |

---

## 12. Model UI Components

| File | Role |
|------|------|
| [model-select.tsx](file:///e:/chatbot-ui/components/models/model-select.tsx) | **Model selector dropdown** — lets the user pick which AI model to use for the current chat. Groups models by provider. |
| [model-option.tsx](file:///e:/chatbot-ui/components/models/model-option.tsx) | Individual model option inside the model selector dropdown. |
| [model-icon.tsx](file:///e:/chatbot-ui/components/models/model-icon.tsx) | Renders the appropriate provider icon (OpenAI logo, Anthropic logo, etc.) next to model names. |

---

## 13. Pages & Layouts

Next.js app-router pages that compose the UI and handle routing.

| File | Role |
|------|------|
| [layout.tsx](file:///e:/chatbot-ui/app/[locale]/[workspaceid]/layout.tsx) | **Workspace layout** — wraps the workspace pages. Fetches workspace data from the DB, initializes chat and sidebar state, and renders the sidebar + main content area side-by-side. |
| [page.tsx](file:///e:/chatbot-ui/app/[locale]/[workspaceid]/chat/page.tsx) | **Chat list page** — the default view when navigating to `/chat`. Shows the chat UI ready for a new conversation. |
| [page.tsx](file:///e:/chatbot-ui/app/[locale]/[workspaceid]/chat/[chatid]/page.tsx) | **Individual chat page** — loads a specific chat by ID, fetches its messages from the DB, and renders the chat UI with those messages. |
| [page.tsx](file:///e:/chatbot-ui/app/[locale]/[workspaceid]/page.tsx) | Workspace landing page — redirects to the chat view. |
| [layout.tsx](file:///e:/chatbot-ui/app/[locale]/layout.tsx) | Root locale layout — wraps everything with i18n, theme, and global state providers. |

---

## 14. Setup & API Keys

| File | Role |
|------|------|
| [api-step.tsx](file:///e:/chatbot-ui/components/setup/api-step.tsx) | **Setup wizard step** for API keys. Lets new users enter their API keys for each provider during onboarding. These keys get stored in the user's profile. |
| [profile-settings.tsx](file:///e:/chatbot-ui/components/utility/profile-settings.tsx) | **Profile settings dialog** — allows the user to update API keys, display name, and other preferences after initial setup. API keys entered here are used server-side for model requests. |
| [route.ts](file:///e:/chatbot-ui/app/api/keys/route.ts) | API route that returns which environment-level API keys are configured on the server (not the values, just which providers are available). |

---

## 15. Auth & Supabase Client

| File | Role |
|------|------|
| [middleware.ts](file:///e:/chatbot-ui/middleware.ts) | Next.js middleware for auth — checks the Supabase session on every request and redirects unauthenticated users. |
| [browser-client.ts](file:///e:/chatbot-ui/lib/supabase/browser-client.ts) | Creates a client-side Supabase instance for browser DB and auth operations. |
| [client.ts](file:///e:/chatbot-ui/lib/supabase/client.ts) | General Supabase client factory. |
| [server.ts](file:///e:/chatbot-ui/lib/supabase/server.ts) | Creates a server-side Supabase instance for API route DB operations. |
| [middleware.ts](file:///e:/chatbot-ui/lib/supabase/middleware.ts) | Supabase auth middleware helper that refreshes tokens and manages the session cookie. |

---

## 16. Environment & Configuration

| File | Role |
|------|------|
| [.env.local.example](file:///e:/chatbot-ui/.env.local.example) | **Example environment file** — documents all required and optional environment variables, including API keys for every supported provider. |

---

## Message Flow Summary

```
User types message in chat-input.tsx
        ↓
useChatHandler.handleSendMessage()  (use-chat-handler.tsx)
        ↓
validateChatSettings()  (chat-helpers/index.ts)
        ↓
createTempMessages()  → updates UI immediately with user msg + empty assistant msg
        ↓
buildPrompt()  (lib/build-prompt.ts)  → assembles the full message array
        ↓
handleHostedChat() or handleLocalChat()  (chat-helpers/index.ts)
        ↓
fetchChatResponse()  → POST to /api/chat/{provider}/route.ts
        ↓
API route receives JSON → calls provider SDK → returns streaming response
        ↓
processResponse()  → reads the stream via consume-stream.ts
        ↓
setChatMessages()  → updates UI token-by-token as they arrive
        ↓
handleCreateChat()  → persists the chat to DB via db/chats.ts
        ↓
handleCreateMessages()  → persists messages to DB via db/messages.ts
        ↓
Message component re-renders with final content (message.tsx)
```
