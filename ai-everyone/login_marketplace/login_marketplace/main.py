"""
FastAPI backend for Microsoft Device Code authentication flow
and Teams AI Personal Assistant + Multi-Agent Copilot Pipeline
"""

import json
import os
import re
import urllib.parse
from datetime import datetime
from typing import Optional

import msal
import requests
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
load_dotenv()
app = FastAPI(title="Teams AI Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ────────────────────────────────────────────────────────────────────
GRAPH_BASE_URL  = "https://graph.microsoft.com/v1.0"
GRAPH_TENANT_ID = os.getenv("GRAPH_TENANT_ID", "common")
GRAPH_CLIENT_ID = os.getenv("GRAPH_CLIENT_ID", "a33c08ae-ae48-460c-a79c-d58098af1a03")
GRAPH_SCOPES    = ["User.Read", "People.Read", "User.ReadBasic.All"]
OLLAMA_URL      = "https://api.ollama.ai"
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "qwen3.5:397b-cloud")

SYSTEM_PROMPT = """You are an AI parser for a Microsoft Teams assistant.
Return valid JSON only in this exact shape:
{
  "intent": "make_call" | "send_message" | "schedule meeting" | "none",
  "contact_query": "person name or email from the conversation, or null",
  "message": "message text to send, or null",
  "confirmed": true | false,
  "cancelled": true | false
}
Rules:
1. Extract the intended action from the whole conversation.
2. Treat "yes", "proceed", "go ahead", and similar replies as confirmation only when the assistant previously asked for confirmation.
3. Treat "cancel", "stop", "never mind", and similar replies as cancellation.
4. If the assistant asked which person to choose, keep the original contact_query and do not invent an email.
5. If the assistant asked for a message, extract the user's reply as the message.
6. If there is no actionable request yet, return intent "none".
7. Never include markdown fences.
"""

# ── In-memory auth store ──────────────────────────────────────────────────────
auth_store: dict = {
    "flow":      None,
    "token":     None,
    "user_info": None,
    "msal_app":  None,
}


# ── Pydantic models ───────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role:    str
    content: str

class ChatRequest(BaseModel):
    history: list[ChatMessage]

class AgentChatRequest(BaseModel):
    message:  str
    history:  list[ChatMessage] = []
    user_id:  str = ""
    ms_token: Optional[str] = None


# ── LangGraph pipeline (lazy-initialised) ─────────────────────────────────────

_graph = None

def _build_graph():
    """Compile the LangGraph multi-agent graph once at first use."""
    from langgraph.graph import StateGraph, END
    from graph_state import AgentState
    from agents.supervisor     import supervisor_node, route_supervisor
    from agents.calendar_agent import calendar_node
    from agents.email_agent    import email_node
    from agents.legal_agent    import legal_node
    from agents.general_agent  import general_node

    g = StateGraph(AgentState)

    g.add_node("supervisor",     supervisor_node)
    g.add_node("calendar_agent", calendar_node)
    g.add_node("email_agent",    email_node)
    g.add_node("legal_agent",    legal_node)
    g.add_node("general_agent",  general_node)

    g.set_entry_point("supervisor")

    g.add_conditional_edges(
        "supervisor",
        route_supervisor,
        {
            "calendar": "calendar_agent",
            "email":    "email_agent",
            "legal":    "legal_agent",
            "general":  "general_agent",
            "FINISH":   END,
        }
    )

    # Each specialist loops back to supervisor (enables multi-step tasks)
    for agent in ("calendar_agent", "email_agent", "legal_agent", "general_agent"):
        g.add_edge(agent, "supervisor")

    return g.compile()


def _get_graph():
    global _graph
    if _graph is None:
        try:
            _graph = _build_graph()
            print("[MAIN] ✅ LangGraph multi-agent pipeline compiled successfully")
        except Exception as e:
            print(f"[MAIN] ⚠️  LangGraph build failed ({e}) — /chat/message will use fallback")
    return _graph


# ── Startup: ensure org RSA keys exist ───────────────────────────────────────

@app.on_event("startup")
def _startup():
    try:
        from security.key_manager import ensure_org_keys_exist
        ensure_org_keys_exist()
    except Exception as e:
        print(f"[MAIN] key_manager not available yet: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# AUTH ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/auth/start")
def auth_start():
    try:
        authority = "https://login.microsoftonline.com/common"
        msal_app  = msal.PublicClientApplication(GRAPH_CLIENT_ID, authority=authority)
        auth_store["msal_app"] = msal_app

        accounts = msal_app.get_accounts()
        if accounts:
            result = msal_app.acquire_token_silent(GRAPH_SCOPES, account=accounts[0])
            if result and "access_token" in result:
                auth_store["token"]     = result["access_token"]
                user                    = _get_user_info(result["access_token"])
                auth_store["user_info"] = user
                _provision_user_keys(user.get("id", ""))
                return {"status": "already_authenticated", "user": user}

        flow = msal_app.initiate_device_flow(scopes=GRAPH_SCOPES)
        if "user_code" not in flow:
            print(f"[AUTH_START] Device flow failed: {flow}")
            raise HTTPException(500, "Could not start device flow")

        auth_store["flow"] = flow
        return {
            "status":           "device_code_required",
            "user_code":        flow["user_code"],
            "verification_uri": flow["verification_uri"],
            "message":          flow["message"],
            "expires_in":       flow.get("expires_in", 900),
        }
    except Exception as e:
        print(f"[AUTH_START ERROR] {e}")
        raise HTTPException(500, str(e))


@app.post("/auth/poll")
def auth_poll():
    msal_app = auth_store.get("msal_app")
    flow     = auth_store.get("flow")

    if not msal_app or not flow:
        raise HTTPException(400, "No active device flow. Call /auth/start first.")

    result = msal_app.acquire_token_by_device_flow(flow, exit_condition=lambda f: True)

    if "access_token" in result:
        auth_store["token"]     = result["access_token"]
        user                    = _get_user_info(result["access_token"])
        auth_store["user_info"] = user
        auth_store["flow"]      = None
        _provision_user_keys(user.get("id", ""))
        return {"status": "authenticated", "user": user}

    error = result.get("error", "")
    if error == "authorization_pending":
        return {"status": "pending"}
    if error == "expired_token":
        return {"status": "expired"}

    return {"status": "pending", "error": result.get("error_description", "")}


@app.get("/auth/status")
def auth_status():
    token = auth_store.get("token")
    user  = auth_store.get("user_info")
    if token and user:
        return {"authenticated": True, "user": user}
    return {"authenticated": False}


@app.post("/auth/logout")
def auth_logout():
    auth_store["token"]     = None
    auth_store["user_info"] = None
    auth_store["flow"]      = None
    auth_store["msal_app"]  = None
    return {"status": "logged_out"}


# ─────────────────────────────────────────────────────────────────────────────
# PEOPLE / GRAPH ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/people/search")
def people_search(q: str):
    token = auth_store.get("token")
    if not token:
        raise HTTPException(401, "Not authenticated")
    results = _search_people(token, q)
    return {"contacts": results}


# ─────────────────────────────────────────────────────────────────────────────
# LEGACY CHAT/PARSE  (Teams call/message quick actions — kept for compatibility)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/chat/parse")
def chat_parse(req: ChatRequest):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m.role, "content": m.content} for m in req.history]

    try:
        response = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "stream": False, "format": "json", "messages": messages},
            timeout=60,
        )
        response.raise_for_status()
        raw = response.json()["message"]["content"].strip()
        raw = re.sub(r"^```json\s*|```$", "", raw, flags=re.MULTILINE).strip()
        return json.loads(raw)
    except Exception as exc:
        return {
            "intent":        "none",
            "contact_query": None,
            "message":       None,
            "confirmed":     False,
            "cancelled":     False,
            "error":         str(exc),
        }


# ─────────────────────────────────────────────────────────────────────────────
# NEW  /chat/message  — Full multi-agent copilot (used by new Dashboard.tsx)
# ─────────────────────────────────────────────────────────────────────────────

def _extract_agent_context(conversation_history: list) -> dict:
    """
    Scan history in reverse for the most recent __agent_ctx__ marker.
    Only restores if no regular assistant message appeared AFTER the marker.
    Handles both ask_user (pending question) and present_for_review (pending review).
    """
    found_regular_assistant = False
    found_ctx               = None

    for msg in reversed(conversation_history):
        if msg.get("role") != "assistant":
            continue

        content = msg.get("content", "")

        if content.startswith("__agent_ctx__:"):
            if not found_regular_assistant:
                try:
                    ctx        = json.loads(content[len("__agent_ctx__:"):])
                    scratchpad = ctx.get("scratchpad", [])

                    has_pending_question = any(
                        e.get("action") == "ask_user" and e.get("awaiting") == "user_reply"
                        for e in scratchpad
                    )
                    has_pending_review = bool(ctx.get("pending_review_document_id"))

                    if has_pending_question or has_pending_review:
                        found_ctx = ctx
                        print(f"[MAIN] Restored context: active_agent={ctx.get('active_agent')}, "
                              f"scratchpad_len={len(scratchpad)}"
                              + (f", pending_review={ctx['pending_review_document_id']}" if has_pending_review else ""))
                except Exception:
                    pass
            break
        else:
            found_regular_assistant = True

    if found_ctx:
        return {
            "active_agent":               found_ctx.get("active_agent"),
            "scratchpad":                 found_ctx.get("scratchpad", []),
            "pending_review_document_id": found_ctx.get("pending_review_document_id"),
        }

    return {"active_agent": None, "scratchpad": [], "pending_review_document_id": None}


@app.post("/chat/message")
async def chat_message(req: AgentChatRequest):
    """
    Main AI copilot endpoint.
    Routes user message through: supervisor → calendar / email / legal / general agent.

    Multi-turn support:
    When an agent uses ask_user, the response includes a hidden __agent_ctx__ marker
    in the assistant message. On the next request the frontend sends this back in
    history, and we restore active_agent + scratchpad so the agent continues from
    exactly where it left off — no recursion, no lost context.
    """
    token   = req.ms_token or auth_store.get("token") or ""
    user_id = req.user_id  or (auth_store.get("user_info") or {}).get("id", "")

    conversation_history = [
        {"role": m.role, "content": m.content}
        for m in req.history
    ]

    graph = _get_graph()

    # ── Graceful fallback when pipeline not yet wired ─────────────────────────
    if graph is None:
        return {
            "response": (
                "⚙️ The agent pipeline isn't fully connected yet.\n\n"
                "Make sure `agents/`, `security/`, `graph_state.py`, "
                "`ollama_client.py`, and `microsoft_graph.py` are all present "
                "in the backend folder, then restart the server."
            ),
            "agent":   "general",
            "success": False,
        }

    # ── Restore mid-task agent context from history ───────────────────────────
    # If the previous turn ended with ask_user, the scratchpad and active_agent
    # are embedded in history. We extract them so the agent resumes correctly.
    ctx                        = _extract_agent_context(conversation_history)
    active_agent               = ctx["active_agent"]
    scratchpad                 = ctx["scratchpad"]
    pending_review_document_id = ctx["pending_review_document_id"]

    initial_state: dict = {
        "user_message":               req.message,
        "ms_token":                   token,
        "user_id":                    user_id,
        "agent_outputs":              [],
        "final_response":             "",
        "task_complete":              False,
        "next_agent":                 "",
        "iteration":                  0,
        "conversation_history":       conversation_history,
        "active_agent":               active_agent,
        "scratchpad":                 scratchpad,
        "pending_review_document_id": pending_review_document_id,
    }

    try:
        result = await graph.ainvoke(initial_state)

        last_agent = "general"
        if result.get("agent_outputs"):
            last_agent = result["agent_outputs"][-1].get("agent", "general")
            last_agent = last_agent.replace("_agent", "")

        response   = result.get("final_response") or "Task complete."
        action_url = result.get("action_url") or ""

        # ── If the agent is mid-task (asked a question), embed context ────────
        # We append a hidden context marker to the response so that when the
        # frontend sends history back on the next request, we can restore state.
        # The marker is stripped before display by the frontend (or ignored).
        result_active_agent = result.get("active_agent")
        result_scratchpad   = result.get("scratchpad", [])

        ctx_payload = None
        if result_active_agent and result_scratchpad:
            has_pending_question = any(
                e.get("action") == "ask_user" and e.get("awaiting") == "user_reply"
                for e in result_scratchpad
            )
            # Also treat present_for_review as a pending turn
            has_pending_review = bool(result.get("pending_review_document_id"))

            if has_pending_question or has_pending_review:
                ctx_payload = json.dumps({
                    "active_agent":               result_active_agent,
                    "scratchpad":                 result_scratchpad,
                    "pending_review_document_id": result.get("pending_review_document_id"),
                })
                print(f"[MAIN] Embedding context for mid-task agent={result_active_agent}"
                      f"{' (pending review)' if has_pending_review else ''}")

        return {
            "response":    response,
            "agent":       last_agent,
            "success":     True,
            "action_url":  action_url,
            # Hidden context — frontend stores this in history as assistant message
            # with prefix "__agent_ctx__:" so we can recover it next turn.
            # If None, no mid-task state to preserve.
            "agent_context": ctx_payload,
        }

    except Exception as e:
        print(f"[MAIN] /chat/message error: {e}")
        raise HTTPException(500, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# TEAMS DEEP-LINK ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/teams/call-url")
def teams_call_url(email: str):
    encoded = urllib.parse.quote(email)
    return {"url": f"https://teams.microsoft.com/l/call/0/0?users={encoded}"}


@app.get("/teams/chat-url")
def teams_chat_url(email: str, message: str = ""):
    encoded_email = urllib.parse.quote(email)
    encoded_msg   = urllib.parse.quote(message)
    return {"url": f"https://teams.microsoft.com/l/chat/0/0?users={encoded_email}&message={encoded_msg}"}


# ─────────────────────────────────────────────────────────────────────────────
# LEGAL DOCUMENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/legal/documents")
async def legal_list_documents(user_id: str = ""):
    """List all legal documents for a user."""
    uid = user_id or (auth_store.get("user_info") or {}).get("id", "")
    try:
        from firebase_client import list_legal_documents
        docs = list_legal_documents(owner_id=uid)
        return {"documents": docs}
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/legal/document/{document_id}")
async def legal_get_document(document_id: str):
    """Get a single legal document's metadata."""
    try:
        from firebase_client import get_legal_document
        doc = get_legal_document(document_id)
        if not doc:
            raise HTTPException(404, f"Document {document_id} not found")
        return doc
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/legal/document/{document_id}/html")
async def legal_get_html(document_id: str):
    """Get the HTML content of a document (for frontend preview)."""
    try:
        from firebase_client import get_legal_document
        doc = get_legal_document(document_id)
        if not doc:
            raise HTTPException(404, f"Document {document_id} not found")
        return {"html": doc.get("html_content", ""), "title": doc.get("title", "")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/legal/document/{document_id}/download")
async def legal_download_document(document_id: str):
    """Download the signed (or unsigned) PDF for a document."""
    import mimetypes
    from fastapi.responses import FileResponse

    try:
        from firebase_client import get_legal_document
        doc = get_legal_document(document_id)
        if not doc:
            raise HTTPException(404, f"Document {document_id} not found")

        # Prefer signed PDF, fall back to unsigned
        pdf_path = doc.get("signed_pdf_path") or doc.get("pdf_path") or ""

        if not pdf_path or not os.path.exists(pdf_path):
            raise HTTPException(404, "PDF file not found — document may still be processing")

        # If encrypted, decrypt in memory and stream
        if doc.get("is_encrypted"):
            from security.key_manager import get_org_private_key_pem
            from security.encryption import decrypt_pdf_to_bytes
            from fastapi.responses import Response

            pdf_bytes = decrypt_pdf_to_bytes(
                pdf_path          = pdf_path,
                nonce_hex         = doc["encryption_nonce_hex"],
                encrypted_key_hex = doc["encrypted_key_org_hex"],
                private_key_pem   = get_org_private_key_pem(),
            )
            safe_name = doc.get("title", document_id).replace(" ", "_").replace("—", "-") + ".pdf"
            return Response(
                content              = pdf_bytes,
                media_type           = "application/pdf",
                headers              = {"Content-Disposition": f'attachment; filename="{safe_name}"'},
            )

        safe_name = doc.get("title", document_id).replace(" ", "_").replace("—", "-") + ".pdf"
        return FileResponse(
            path         = pdf_path,
            filename     = safe_name,
            media_type   = "application/pdf",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@app.post("/legal/document/{document_id}/upload-signature")
async def legal_upload_signature(document_id: str, file: UploadFile = File(...)):
    """
    Upload a signature image for a document.
    Stores the image and registers it as the default signature in Firebase.
    """
    import shutil
    import uuid as _uuid

    # Resolve storage dir relative to this file (main.py lives in backend/)
    _backend_dir = os.path.dirname(os.path.abspath(__file__))
    sig_dir      = os.path.join(_backend_dir, "storage", "signatures")
    os.makedirs(sig_dir, exist_ok=True)

    try:
        from firebase_client import get_legal_document, _db

        doc = get_legal_document(document_id)
        if not doc:
            raise HTTPException(404, f"Document {document_id} not found")

        # Validate file type — only images accepted
        allowed = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
        ext      = os.path.splitext(file.filename or "signature.png")[1].lower() or ".png"
        if ext not in allowed:
            raise HTTPException(400, f"Unsupported file type '{ext}'. Use PNG or JPG.")

        sig_path = os.path.join(sig_dir, f"{document_id}_signature{ext}")

        with open(sig_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        print(f"[MAIN] Signature saved to {sig_path}")

        # Register as default signature in Firebase,
        # clearing the is_default flag on any previous entries first
        try:
            prev_docs = _db.collection("signature_images").where("is_default", "==", True).stream()
            for p in prev_docs:
                _db.collection("signature_images").document(p.id).update({"is_default": False})

            sig_id = str(_uuid.uuid4())
            _db.collection("signature_images").document(sig_id).set({
                "id":         sig_id,
                "image_path": sig_path,
                "is_default": True,
                "created_at": datetime.utcnow().isoformat(),
            })
            print(f"[MAIN] Signature registered in Firebase: {sig_id}")
        except Exception as fb_err:
            # Non-fatal — file is saved, Firebase registration failed
            print(f"[MAIN] Could not register signature in Firebase: {fb_err}")

        return {
            "success":        True,
            "signature_path": sig_path,
            "document_id":    document_id,
            "message":        "Signature uploaded successfully. You can now sign the document.",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[MAIN] upload-signature error: {e}")
        raise HTTPException(500, str(e))


# ─────────────────────────────────────────────────────────────────────────────
# PRIVATE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _provision_user_keys(user_id: str):
    """Auto-generate RSA-2048 keypair for user on first login. Silently skipped if not configured."""
    if not user_id:
        return
    try:
        from security.key_manager import get_or_create_user_keys
        get_or_create_user_keys(user_id)
    except Exception as e:
        print(f"[MAIN] User key provisioning skipped: {e}")


def _get_user_info(token: str) -> dict:
    try:
        resp = requests.get(
            f"{GRAPH_BASE_URL}/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        return {
            "displayName": data.get("displayName", ""),
            "email":       data.get("mail") or data.get("userPrincipalName", ""),
            "id":          data.get("id", ""),
        }
    except Exception:
        return {"displayName": "Unknown", "email": "", "id": ""}


def _search_people(token: str, query: str) -> list[dict]:
    headers = {"Authorization": f"Bearer {token}"}
    results = []
    seen    = set()

    try:
        r = requests.get(
            f"{GRAPH_BASE_URL}/me/people",
            params={"$search": f'"{query}"', "$top": "10"},
            headers=headers,
            timeout=15,
        )
        r.raise_for_status()
        for person in r.json().get("value", []):
            scored = person.get("scoredEmailAddresses") or []
            email  = (
                (scored[0].get("address") if scored else None)
                or person.get("userPrincipalName")
                or person.get("mail")
            )
            if email and email.lower() not in seen:
                seen.add(email.lower())
                results.append({"displayName": person.get("displayName") or email, "email": email})
    except Exception:
        pass

    try:
        escaped      = query.replace("'", "''")
        filter_query = (
            f"startswith(displayName,'{escaped}') or startswith(mail,'{escaped}') "
            f"or startswith(userPrincipalName,'{escaped}')"
        )
        r = requests.get(
            f"{GRAPH_BASE_URL}/users",
            params={"$filter": filter_query, "$select": "displayName,mail,userPrincipalName", "$top": "10"},
            headers=headers,
            timeout=15,
        )
        r.raise_for_status()
        for user in r.json().get("value", []):
            email = user.get("mail") or user.get("userPrincipalName")
            if email and email.lower() not in seen:
                seen.add(email.lower())
                results.append({"displayName": user.get("displayName") or email, "email": email})
    except Exception:
        pass

    return results[:5]