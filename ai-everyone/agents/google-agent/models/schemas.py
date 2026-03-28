"""
Data Models - Pydantic schemas for request/response validation
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"
    system = "system"
    agent = "agent"


class TaskStatus(str, Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    failed = "failed"


class AgentType(str, Enum):
    calendar = "calendar"
    gmail = "gmail"
    meet = "meet"
    contacts = "contacts"
    calling = "calling"
    drive = "drive"
    tasks = "tasks"
    task_planner = "task_planner"
    web_search = "web_search"
    notes = "notes"


class LLMProvider(str, Enum):
    ollama = "ollama"
    openai = "openai"
    gemini = "gemini"


# ─────────────────────────────────────────────
# User Models
# ─────────────────────────────────────────────

class UserBase(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None


class UserCreate(UserBase):
    google_id: str
    access_token: str
    refresh_token: Optional[str] = None
    token_expiry: Optional[datetime] = None


class UserResponse(UserBase):
    id: str
    google_id: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Chat Models
# ─────────────────────────────────────────────

class ChatCreate(BaseModel):
    title: Optional[str] = "New Chat"
    user_id: str


class ChatResponse(BaseModel):
    id: str
    title: str
    user_id: str
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = 0


class MessageCreate(BaseModel):
    chat_id: str
    role: MessageRole
    content: str
    metadata: Optional[Dict[str, Any]] = None


class MessageResponse(BaseModel):
    id: str
    chat_id: str
    role: MessageRole
    content: str
    metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


# ─────────────────────────────────────────────
# Chat Request/Response
# ─────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    chat_id: Optional[str] = None
    llm_provider: Optional[LLMProvider] = LLMProvider.ollama
    stream: Optional[bool] = False
    context_window: Optional[int] = 30  # Number of previous messages to include


class ChatResponse2(BaseModel):
    chat_id: str
    message_id: str
    response: str
    agent_logs: Optional[List[Dict[str, Any]]] = []
    execution_steps: Optional[List[str]] = []
    mode: Literal["direct", "agent"] = "direct"


# ─────────────────────────────────────────────
# Agent Models
# ─────────────────────────────────────────────

class AgentRunRequest(BaseModel):
    agent_type: AgentType
    action: str
    parameters: Optional[Dict[str, Any]] = {}
    user_id: str


class AgentRunResponse(BaseModel):
    agent_type: AgentType
    action: str
    status: str
    result: Any
    execution_time_ms: Optional[float] = None
    error: Optional[str] = None


class AgentLog(BaseModel):
    user_id: str
    chat_id: str
    agent_type: AgentType
    action: str
    parameters: Dict[str, Any]
    result: Any
    status: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ─────────────────────────────────────────────
# Task Models
# ─────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    priority: Optional[Literal["low", "medium", "high"]] = "medium"
    tags: Optional[List[str]] = []


class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    status: TaskStatus
    due_date: Optional[datetime] = None
    priority: str
    tags: List[str]
    created_at: datetime
    updated_at: datetime


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    due_date: Optional[datetime] = None
    priority: Optional[str] = None
    tags: Optional[List[str]] = None


# ─────────────────────────────────────────────
# Auth Models
# ─────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class GoogleAuthCallback(BaseModel):
    code: str
    state: Optional[str] = None


# ─────────────────────────────────────────────
# Intent / Orchestrator Models
# ─────────────────────────────────────────────

class IntentAnalysis(BaseModel):
    mode: Literal["direct", "agent"]
    agents_required: List[AgentType] = []
    primary_intent: str
    sub_tasks: Optional[List[str]] = []
    confidence: float = 0.0


class ExecutionPlan(BaseModel):
    steps: List[Dict[str, Any]]
    estimated_duration: Optional[str] = None

