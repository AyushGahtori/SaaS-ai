# AI-Everyone Project Documentation

## 1. Project Overview & Tech Stack
AI-Everyone is a full-stack, AI-powered web application built with **Next.js 16 (App Router)**. It connects a modern **Tailwind CSS / shadcn/ui** frontend to a seamless local **Ollama AI backend** for text generation, while utilizing **Firebase Authentication and Firestore** for real-time user management and chat persistence.

## 2. Core File Pipeline & Interconnections
Every file in this project serves a distinct purpose in the flow of data. Below is the complete pipeline, detailing how these files are connected, from the moment a user creates an account to the moment an AI response is streamed back.

### 2.1 Configuration & Setup Files
| File | Role & Interconnection |
|------|------------------------|
| `.env` | Stores environment variables (`OLLAMA_BASE_URL`, `OLLAMA_MODEL_CLOUD`, `OLLAMA_MODEL_LOCAL`, Firebase keys). **Connected to:** `src/lib/firebase.ts` and `src/app/api/chat/route.ts` which read these values to connect to external services. |
| `package.json` | Defines scripts and dependencies (Next.js, Tailwind, Firebase, Radix UI). |
| `tsconfig.json` / `next.config.js` | TypeScript and Next.js compiler settings. |
| `tailwind.config.js` | Defines the theme, colors, and animations used universally across all `className` attributes in the React components. |

### 2.2 Global App Layout & Libraries
| File | Role & Interconnection |
|------|------------------------|
| `src/app/layout.tsx` | The root HTML wrapper. Imports `globals.css` and sets up the foundational UI for every page. |
| `src/app/globals.css` | Injects Tailwind utilities. |
| `src/lib/firebase.ts` | Initializes the Firebase application. **Imported by:** Every authentication and database utility to ensure a single Firebase instance is used. |
| `src/lib/firebaseAuth.ts` | Wraps Firebase Auth. Provides `signUp`, `signIn`, and `signInWithGoogle`. **Crucial Interconnection:** When a new user signs up here, it automatically triggers `createUserProfile` in `firestore.ts` to build the DB profile. |
| `src/lib/firestore.ts` | Contains `createUserProfile` and `getUserProfile`. Manages the root `/users/{uid}/` Firestore documents. |

### 2.3 The Authentication / Dashboard Flow
| File | Role & Interconnection |
|------|------------------------|
| `src/app/(auth)/sign-in/page.tsx` <br> `src/app/(auth)/sign-up/page.tsx` | The login/register views. **Connected to:** `src/lib/firebaseAuth.ts` to authenticate users. On success, redirects the user to the dashboard. |
| `src/app/(auth)/(dashboard)/layout.tsx` | The dashboard wrapper for logged-in users. Renders the sidebar and wraps the main content area in context providers (like ChatContext). |
| `src/modules/dashboard/ui/components/dashboard-sidebar.tsx` | The left navigation sidebar. **Connected to:** `ChatSidebarList` to render past conversations, and provides buttons to trigger "New Chat" and "Settings". |

### 2.4 The Chat Engine Pipeline (How Data Flows)
This is the heart of the application. It connects the UI, the Database, and the LLM.

| File | Role & Interconnection |
|------|------------------------|
| **1. UI Inputs:** `src/modules/chat/ui/components/chat-input.tsx` | The text box at the bottom of the screen. When the user submits, it passes the text string up to the `sendMessage` function. |
| **2. Context Manager:** `src/modules/chat/context/chat-context.tsx` | **The Orchestrator**. Receives the user's text from `chat-input.tsx`. It immediately adds the text to the React State (so the UI updates) and triggers two simultaneous actions: DB save & API fetch. |
| **3. Database Persistence:** `src/modules/chat/db/messages.ts` | Called by Context Manager. Takes the user's message and saves it to Firestore at `users/{uid}/chats/{chatId}/messages`. |
| **4. AI Network Request:** `src/app/api/chat/route.ts` | Called by Context Manager. The Next.js API Route. It receives the message history + user-selected model, formats it, and makes a POST request to Ollama via `host.docker.internal:11434` (model: **qwen3.5:397b-cloud** or **qwen2.5:7b**). Uses **tag-based** `<AGENT_INTENT>` extraction for agent intent detection. |
| **5. AI Persistence:** *(Back to `messages.ts`)* | After the API returns the AI's response, the Context Manager calls `createMessage` in `messages.ts` again to save the Assistant's reply to Firestore. |
| **6. UI Rendering:** `src/modules/chat/ui/components/chat-message-list.tsx` | Reads the updated array from Context Manager and renders the new user + assistant bubbles to the screen. Pushes markdown strings to `chat-message-item.tsx`. |
| **7. Markdown Support:** `chat-message-item.tsx` | Parses the text using `react-markdown` to format the AI's codeblocks and bullet lists. |

### 2.5 Database Schema Overview (Firestore)
The file interconnections strictly follow this nested NoSQL Database schema:
* `users/{uid}` (Managed by `src/lib/firestore.ts`)
  * ↳ `chats/{chatId}` (Managed by `src/modules/chat/db/chats.ts`)
    * ↳ `messages/{messageId}` (Managed by `src/modules/chat/db/messages.ts`)

---

## 3. Data Flow Diagram
Below is the architectural representation of how exactly these folders and files interact when a user types a message.

```text
========================================================================================
[1] THE USER INTERFACE (Frontend Components)
========================================================================================
    [👦 User] 
       │ (1) Types message & hits Send
       ▼
 ┌─────────────────────────────────────────────────────┐
 │ src/modules/chat/ui/components/chat-input.tsx       │
 │ Captures input and calls sendMessage() in state     │
 └─────────────────────────┬───────────────────────────┘
                           │ (2) Passes string
                           ▼
 ┌─────────────────────────────────────────────────────┐
 │ src/modules/chat/context/chat-context.tsx           │
 │ **Global Chat State Orchestrator**                  │
 │ - Updates UI state (isGenerating: true)             │
 │ - Branches execution to Database AND Backend API    │
 └─────────────┬──────────────────────────┬────────────┘
               │                          │
   (3) Save    │                          │ (4) Fetch
   Msg to DB   │                          │ /api/chat
               ▼                          ▼
========================================================================================
[2] THE DATABASE LAYER               [3] THE API ROUTER & LOCAL AI LAYER
========================================================================================
 ┌───────────────────────────┐      ┌─────────────────────────────────────────────────┐
 │ src/modules/chat/db/      │      │ src/app/api/chat/route.ts                       │
 │ messages.ts               │      │ Next.js APIRoute proxy. Reads `OLLAMA_BASE_URL` │
 │                           │      │ and model from frontend or `.env`.              │
 │ Runs: createMessage()     │      └──────────────────────┬──────────────────────────┘
 └─────────────┬─────────────┘                             │
               │                                           │ (5) POST Request
               ▼                                           ▼
 ┌───────────────────────────┐      ┌─────────────────────────────────────────────────┐
 │ FIREBASE CLOUD FIRESTORE  │      │ LOCALHOST OLLAMA SERVER (:11434)                │
 │ Path:                     │      │ Processed via selected model (cloud or local)   │
 │ users/uid/chats/chatId/   │      │ Returns JSON text response.                     │
 │ messages/{msg_doc}        │      └──────────────────────┬──────────────────────────┘
 └───────────────────────────┘                             │
               ▲                                           │ (6) Returns text
               │                                           ▼
               │                    ┌─────────────────────────────────────────────────┐
               │                    │ src/app/api/chat/route.ts                       │
               │                    │ Parses JSON, returns 200 OK to frontend.        │
               │                    └──────────────────────┬──────────────────────────┘
               │ (8) Save AI Msg                           │
               │ to DB                                     │ (7) Response reaches 
               │                                           │ chat-context.tsx
               └───────────────────────────────────────────┘
``` 
========================================================================================
[4] FINAL RENDER (Frontend Components)
========================================================================================
Once the context receives the AI text, it triggers a React Re-render:

 ┌──────────────────────────────────────────────────────────────────┐
 │ src/modules/chat/ui/components/chat-message-list.tsx             │
 │ Loops through new messages array, passing data to:               │
 └────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
 ┌──────────────────────────────────────────────────────────────────┐
 │ src/modules/chat/ui/components/chat-message-item.tsx             │
 │ Uses react-markdown and remark-gfm to render the final stylized  │
 │ AI bubble on the screen for the user.                            │
 └──────────────────────────────────────────────────────────────────┘

---

## 4. Run/Dev Instructions
- Ensure you have **Node.js** and **npm** installed.
- Ensure **Ollama** is running on your machine: run `ollama serve` and `ollama pull qwen3.5:397b-cloud`.
- Install dependencies: `npm install`
- Start the server: `npm run dev`
- Open `http://localhost:3000`
