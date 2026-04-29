from __future__ import annotations

import datetime
import html
import json
import os
import smtplib
import ssl
from email.message import EmailMessage
from urllib import parse, request

from dotenv import load_dotenv

_ = load_dotenv()

CURRENT_YEAR = datetime.datetime.now().year


TOOLS_SYSTEM_PROMPT = f"""You are a smart travel agency assistant.
The current year is {CURRENT_YEAR}.

Rules for responses:
- Include flight and hotel options with clear booking links.
- For each flight, include Google Flights, MakeMyTrip, Skyscanner, and Kayak links when available.
- Show all prices in INR with the Rs. prefix.
- Keep output concise but practical for booking decisions.
"""

EMAILS_SYSTEM_PROMPT = """Convert the travel plan text into valid HTML email body.
Output HTML only, no markdown fences.
"""


def _clean_detail(value) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(str(item).strip() for item in value if str(item).strip())
    return str(value).strip()


def _booking_url(base: str, query: str) -> str:
    return f"{base}{parse.quote_plus(query)}"


def _extract_gemini_text(data: dict) -> str:
    candidates = data.get("candidates") or []
    if not candidates:
        return ""
    parts = (((candidates[0] or {}).get("content") or {}).get("parts")) or []
    return "\n".join(str(part.get("text") or "") for part in parts if isinstance(part, dict)).strip()


class TravelGraphAgent:
    def __init__(self):
        self._plans_by_thread: dict[str, str] = {}

    def _gemini_generate(self, instruction: str, *, temperature: float = 0.2) -> str | None:
        api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
        if not api_key:
            return None

        model = (
            os.getenv("TRAVEL_HALPER_GEMINI_MODEL")
            or os.getenv("GEMINI_MODEL_FLASH")
            or os.getenv("GEMINI_MODEL")
            or "gemini-2.5-flash"
        ).strip()
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        payload = {
            "contents": [{"role": "user", "parts": [{"text": instruction}]}],
            "generationConfig": {"temperature": temperature},
        }
        try:
            encoded = json.dumps(payload).encode("utf-8")
            req = request.Request(
                f"{endpoint}?key={parse.quote(api_key)}",
                data=encoded,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with request.urlopen(req, timeout=float(os.getenv("TRAVEL_HALPER_GEMINI_TIMEOUT", "25"))) as response:
                data = json.loads(response.read().decode("utf-8"))
            content = _extract_gemini_text(data)
            return content or None
        except Exception:
            return None

    def _markdown_to_basic_html(self, source_text: str) -> str:
        escaped = html.escape(source_text)
        lines = escaped.splitlines()
        body_lines = []
        in_list = False
        for line in lines:
            stripped = line.strip()
            if not stripped:
                if in_list:
                    body_lines.append("</ul>")
                    in_list = False
                continue
            if stripped.startswith("## "):
                if in_list:
                    body_lines.append("</ul>")
                    in_list = False
                body_lines.append(f"<h2>{stripped[3:]}</h2>")
            elif stripped.startswith("### "):
                if in_list:
                    body_lines.append("</ul>")
                    in_list = False
                body_lines.append(f"<h3>{stripped[4:]}</h3>")
            elif stripped.startswith("- "):
                if not in_list:
                    body_lines.append("<ul>")
                    in_list = True
                body_lines.append(f"<li>{stripped[2:]}</li>")
            else:
                if in_list:
                    body_lines.append("</ul>")
                    in_list = False
                body_lines.append(f"<p>{stripped}</p>")
        if in_list:
            body_lines.append("</ul>")
        return "<html><body>" + "\n".join(body_lines) + "</body></html>"

    def _gemini_email_html(self, source_text: str) -> str:
        html_body = self._gemini_generate(
            "\n".join([EMAILS_SYSTEM_PROMPT, "Travel plan:", source_text]),
            temperature=0.1,
        )
        return html_body or self._markdown_to_basic_html(source_text)

    def _send_email(self, html_body: str):

        smtp_host = (os.environ.get("SMTP_HOST") or "").strip()
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = (os.environ.get("SMTP_USER") or "").strip()
        smtp_password = (os.environ.get("SMTP_PASSWORD") or "").strip()
        from_email = (os.environ.get("FROM_EMAIL") or "").strip()
        to_email = (os.environ.get("TO_EMAIL") or "").strip()
        subject = (os.environ.get("EMAIL_SUBJECT") or "Travel Plan").strip()

        missing = [
            name
            for name, value in {
                "SMTP_HOST": smtp_host,
                "SMTP_USER": smtp_user,
                "SMTP_PASSWORD": smtp_password,
                "FROM_EMAIL": from_email,
                "TO_EMAIL": to_email,
            }.items()
            if not value
        ]
        if missing:
            raise ValueError(f"Missing email configuration: {', '.join(missing)}")

        msg = EmailMessage()
        msg["From"] = from_email
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content("Your travel plan is attached as HTML. View in an HTML-capable mail client.")
        msg.add_alternative(html_body, subtype="html")

        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=ssl.create_default_context()) as server:
                server.login(smtp_user, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(smtp_user, smtp_password)
                server.send_message(msg)

    def _gemini_travel_plan(self, prompt: str, trip_details: dict) -> str | None:
        instruction = "\n".join(
            [
                TOOLS_SYSTEM_PROMPT,
                "Use the structured trip details as source of truth.",
                "If exact live prices are unavailable, provide practical booking search links and clearly label prices as estimates.",
                "Do not ask follow-up questions; the intake layer already confirmed required fields.",
                f"Structured trip details: {json.dumps(trip_details, ensure_ascii=False)}",
                f"Prompt: {prompt}",
            ]
        )
        return self._gemini_generate(instruction, temperature=0.2)

    def _deterministic_travel_plan(self, prompt: str, trip_details: dict) -> str:
        origin = _clean_detail(trip_details.get("origin")) or "your origin"
        destination = _clean_detail(trip_details.get("destination")) or "your destination"
        dates = _clean_detail(trip_details.get("duration_or_dates")) or "your selected dates"
        budget = _clean_detail(trip_details.get("budget")) or "your budget"
        travelers = _clean_detail(trip_details.get("travelers")) or "the travelers"
        hotel_query = f"{destination} budget hotels {dates} {travelers} travelers"
        flight_query = f"flights from {origin} to {destination} {dates} {travelers} travelers"
        maps_query = f"{destination} things to do"

        return "\n".join(
            [
                f"## Travel Plan: {origin} to {destination}",
                "",
                f"- Dates/duration: {dates}",
                f"- Budget: Rs. {budget}" if budget.replace(",", "").isdigit() else f"- Budget: {budget}",
                f"- Travelers: {travelers}",
                "",
                "### Booking links",
                f"- Google Flights: {_booking_url('https://www.google.com/travel/flights?q=', flight_query)}",
                f"- Skyscanner: {_booking_url('https://www.skyscanner.co.in/transport/flights/?search=', flight_query)}",
                f"- MakeMyTrip: {_booking_url('https://www.makemytrip.com/flights/?search=', flight_query)}",
                f"- Budget hotels: {_booking_url('https://www.google.com/travel/hotels?q=', hotel_query)}",
                f"- Things to do: {_booking_url('https://www.google.com/search?q=', maps_query)}",
                "",
                "### Suggested structure",
                "- Book flights first, then shortlist hotels near the area where you will spend most time.",
                "- Keep 15-20% of the budget aside for local transport, food variance, and last-minute changes.",
                "- Prefer refundable stays if the dates are still described relatively, such as next weekend.",
                "",
                "### Note",
                "Live travel search is temporarily unavailable from the agent runtime, so I prepared a deterministic plan with booking links instead of failing the request.",
                "",
                f"Original request: {prompt}",
            ]
        )

    def plan_trip(self, prompt: str, thread_id: str, trip_details: dict | None = None) -> str:
        details = trip_details or {}
        gemini_plan = self._gemini_travel_plan(prompt, details)
        plan = gemini_plan or self._deterministic_travel_plan(prompt, details)
        self._plans_by_thread[thread_id] = plan
        return plan

    def send_plan_email(
        self,
        thread_id: str,
        *,
        from_email: str,
        to_email: str,
        subject: str,
        prompt: str | None = None,
    ) -> None:
        os.environ["FROM_EMAIL"] = from_email
        os.environ["TO_EMAIL"] = to_email
        os.environ["EMAIL_SUBJECT"] = subject

        source_text = (prompt or "").strip() or self._plans_by_thread.get(thread_id, "")
        if not source_text:
            raise ValueError("Cannot send email because no travel plan is available.")

        html_body = self._gemini_email_html(source_text)
        self._send_email(html_body)
