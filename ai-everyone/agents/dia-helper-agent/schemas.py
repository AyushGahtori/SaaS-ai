from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class DiaHelperActionRequest(BaseModel):
    """Request contract for dia-helper-agent.

    Mirrors the generic AgentTaskRequest shape used by other agents.
    """

    taskId: Optional[str] = None
    userId: Optional[str] = None
    agentId: Optional[str] = None
    action: str = Field(..., description="Action to perform, e.g. generate_diagram or update_diagram.")

    # High-level description of what the user wants to design.
    prompt: Optional[str] = Field(
        default=None,
        description="Natural language description of the system or flow to diagram.",
    )

    # Optional persistent project brief / context (multi-line).
    projectContext: Optional[str] = Field(
        default=None,
        description="Longer project brief, requirements, or architecture notes.",
    )

    # Optional hint for diagram style.
    diagramType: Optional[str] = Field(
        default=None,
        description="Preferred Mermaid diagram type (flowchart, sequenceDiagram, stateDiagram-v2, gantt).",
    )

    # Optional Figma file key or other external identifier.
    fileKey: Optional[str] = Field(
        default=None,
        description="Optional Figma file key or external reference.",
    )

    # When updating an existing diagram, the previous Mermaid code can be sent back.
    currentMermaid: Optional[str] = Field(
        default=None,
        description="Existing Mermaid diagram that should be modified instead of recreated from scratch.",
    )

    # Additional free-form instructions (e.g. 'add a database layer').
    editInstruction: Optional[str] = Field(
        default=None,
        description="Incremental update instruction for modifying an existing diagram.",
    )


class DiaDiagramArtifact(BaseModel):
    """Structured representation of the generated diagram and Figma handoff prompt."""

    title: str
    summary: str
    diagramType: str
    mermaid: str
    figmaPrompt: str
    sources: List[dict[str, Any]] = Field(default_factory=list)


class DiaHelperActionResponse(BaseModel):
    """Response contract compatible with the agent orchestration layer."""

    status: str
    type: Optional[str] = Field(
        default="dia_diagram",
        description="UI result type used by the frontend renderer.",
    )
    message: Optional[str] = None
    displayName: Optional[str] = Field(
        default="Diagram",
        description="Short label shown on the agent result card.",
    )
    result: Optional[dict[str, Any]] = None
    error: Optional[str] = None

