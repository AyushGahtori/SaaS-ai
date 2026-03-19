/**
 * frontend/lib/api.ts
 */
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

async function post(path: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`POST ${path} failed (${res.status}): ${err}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

async function get(path: string) {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`)
  return res.json()
}

export async function startAuth()     { return post("/auth/start") }
export async function pollAuth()      { return post("/auth/poll") }
export async function getAuthStatus() { return get("/auth/status") }
export async function logout()        { return post("/auth/logout") }
export async function searchPeople(q: string) { return get(`/people/search?q=${encodeURIComponent(q)}`) }
export async function getTeamsCallUrl(email: string) { return get(`/teams/call-url?email=${encodeURIComponent(email)}`) }
export async function getTeamsChatUrl(email: string, message = "") {
  return get(`/teams/chat-url?email=${encodeURIComponent(email)}&message=${encodeURIComponent(message)}`)
}

export interface AgentMessage {
  role:    "user" | "assistant"
  content: string
}

export interface AgentChatResponse {
  response:       string
  agent:          string
  success:        boolean
  action_url?:    string
  agent_context?: string   // JSON blob — mid-task scratchpad + active_agent, null when task complete
}

export async function sendCopilotMessage(
  message: string,
  history: AgentMessage[],
  userId  = "",
): Promise<AgentChatResponse> {
  return post("/chat/message", { message, history, user_id: userId })
}