from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

from schemas import TravelHalperActionRequest, TravelHalperActionResponse
from travel_graph_agent import TravelGraphAgent

_TRAVEL_AGENT: TravelGraphAgent | None = None


def get_travel_agent() -> TravelGraphAgent:
    global _TRAVEL_AGENT
    if _TRAVEL_AGENT is None:
        _TRAVEL_AGENT = TravelGraphAgent()
    return _TRAVEL_AGENT


def _clean(value: str | None) -> str:
    return (value or "").strip()


async def run_travel_halper_action(req: TravelHalperActionRequest) -> TravelHalperActionResponse:
    action = _clean(req.action).lower()
    plan_actions = {"plan_trip", "run_travel_halper", "run", "query", "travel_plan", "plan"}
    email_actions = {"send_email", "send_plan_email", "email", "email_plan"}
    result_type = "travel_email_result" if action in email_actions else "travel_plan_result"

    try:
        agent = get_travel_agent()

        if action in plan_actions:
            prompt = _clean(req.prompt)
            trip_details = req.trip_details or {}
            if not prompt and not trip_details:
                return TravelHalperActionResponse(
                    status="needs_input",
                    type="travel_plan_result",
                    message="I need your travel request to plan flights and hotels.",
                    summary="Share destination, dates, and preferences so I can build the travel plan.",
                    result={"suggestedInputs": ["prompt", "trip_details"]},
                )

            thread_id = _clean(req.threadId) or str(uuid.uuid4())
            plan_prompt = prompt or "Plan a trip using the confirmed details provided."
            plan = await asyncio.to_thread(
                agent.plan_trip,
                plan_prompt,
                thread_id,
                trip_details=trip_details,
            )
            return TravelHalperActionResponse(
                status="success",
                type="travel_plan_result",
                message="Travel options are ready.",
                summary="I found flight and hotel options for your trip.",
                result={
                    "threadId": thread_id,
                    "planMarkdown": plan,
                },
            )

        if action in email_actions:
            thread_id = _clean(req.threadId) or str(uuid.uuid4())
            prompt = _clean(req.prompt)
            plan_markdown = _clean(req.planMarkdown)
            trip_details = req.trip_details or {}
            from_email = _clean(req.senderEmail) or _clean(os.getenv("FROM_EMAIL")) or _clean(os.getenv("SMTP_USER"))
            to_email = _clean(req.receiverEmail) or _clean(os.getenv("TO_EMAIL"))
            subject = _clean(req.subject) or _clean(os.getenv("EMAIL_SUBJECT")) or "Travel Plan"

            if not to_email:
                return TravelHalperActionResponse(
                    status="needs_input",
                    type="travel_email_result",
                    message="I need the recipient email address to send the travel plan.",
                    summary="Provide receiverEmail so I can send the itinerary.",
                    result={"suggestedInputs": ["receiverEmail"]},
                )

            if not from_email:
                return TravelHalperActionResponse(
                    status="needs_input",
                    type="travel_email_result",
                    message="I need the sender email address before sending the travel plan.",
                    summary="Provide senderEmail or set FROM_EMAIL in environment.",
                    result={"suggestedInputs": ["senderEmail"]},
                )

            if not plan_markdown and not prompt:
                return TravelHalperActionResponse(
                    status="needs_input",
                    type="travel_email_result",
                    message="Send action needs either travel plan content or a fresh planning prompt.",
                    summary="Provide planMarkdown or prompt so I can send the travel itinerary email.",
                    result={"suggestedInputs": ["planMarkdown", "prompt"]},
                )

            source_text = plan_markdown
            if not source_text and prompt:
                source_text = await asyncio.to_thread(
                    agent.plan_trip,
                    prompt,
                    thread_id,
                    trip_details=trip_details,
                )

            await asyncio.to_thread(
                agent.send_plan_email,
                thread_id,
                from_email=from_email,
                to_email=to_email,
                subject=subject,
                plan_text=source_text,
            )
            return TravelHalperActionResponse(
                status="success",
                type="travel_email_result",
                message="Travel plan email sent successfully.",
                summary=f"Sent travel plan to {to_email}.",
                result={
                    "threadId": thread_id,
                    "toEmail": to_email,
                    "subject": subject,
                    "sentAt": datetime.now(timezone.utc).isoformat(),
                },
            )

        return TravelHalperActionResponse(
            status="failed",
            type=result_type,
            message=f"Unsupported action: {req.action}",
            summary="Travel Halper supports plan_trip and send_plan_email actions.",
            error=f"Unknown action: {req.action}",
        )
    except ValueError as exc:
        return TravelHalperActionResponse(
            status="needs_input",
            type=result_type,
            message=str(exc),
            summary="I need one more detail to continue.",
            error=str(exc),
        )
    except Exception as exc:
        failed_message = (
            "Travel Halper failed to send this itinerary email."
            if result_type == "travel_email_result"
            else "Travel Halper failed to process this request."
        )
        failed_summary = (
            "Please retry with a valid itinerary and email details."
            if result_type == "travel_email_result"
            else "Please retry with a specific travel prompt."
        )
        return TravelHalperActionResponse(
            status="failed",
            type=result_type,
            message=failed_message,
            summary=failed_summary,
            error=f"travel_halper_failed: {exc}",
        )
