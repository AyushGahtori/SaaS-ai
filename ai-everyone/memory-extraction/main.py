"""
Memory Extraction CLI Tool

Standalone Python tool for testing the 3-layer memory extraction pipeline.
Run with:
  python main.py --message "I am a developer working on React"
  python main.py --message "I prefer concise answers" --ollama-url http://localhost:11434

Layers:
  Layer 1: Regex trigger detection
  Layer 2: Rule-based slot extraction
  Layer 3: LLM extraction via Ollama (only when Layer 2 fails)
"""

import re
import json
import sys
import argparse
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Layer 1 — Trigger detection
# ---------------------------------------------------------------------------

TRIGGER_PATTERNS = [
    r"^my name is [a-z]",
    r"^i am (a |an )?[a-z]",
    r"^i'm (a |an )?[a-z]",
    r"^i work as [a-z]",
    r"^i am working on .+",
    r"^i'm working on .+",
    r"^i'm currently (building|working|studying|learning|developing)",
    r"^i am currently (building|working|studying|learning|developing)",
    r"^i('m| am) (building|developing|creating) .+",
    r"^i prefer .+",
    r"^i like (to |that |when )?.+",
    r"^my goal is .+",
    r"^i want to (become|be|learn|build|get into|go to|join|create)",
    r"^i('m| am) trying to .+",
    r"^i study .+",
    r"^i('m| am) studying .+",
    r"^i('m| am) learning .+",
    r"^i('m| am) preparing for .+",
    r"^i use .+",
    r"^my (current )?focus is .+",
    r"^my (current )?tech stack .+",
    r"^i have (worked|experience|been) .+",
    r"^i've been .+",
]

QUESTION_STARTERS = re.compile(
    r"^(what|how|why|when|where|who|which|is |are |do |does |can |could |should |would |will |please |explain |tell me|show me|help me|give me)",
    re.IGNORECASE
)

def is_trigger(message: str) -> bool:
    """Layer 1: check if message might contain a memory-worthy fact."""
    msg = message.strip()
    if len(msg) < 5:
        return False
    if QUESTION_STARTERS.match(msg.lower()):
        return False
    for pattern in TRIGGER_PATTERNS:
        if re.match(pattern, msg, re.IGNORECASE):
            return True
    return False


# ---------------------------------------------------------------------------
# Layer 2 — Rule-based slot extraction
# ---------------------------------------------------------------------------

ROLES = [
    "developer", "software developer", "software engineer", "engineer", "programmer",
    "designer", "product designer", "student", "product manager", "pm",
    "data scientist", "data analyst", "founder", "startup founder",
    "teacher", "educator", "marketer", "freelancer", "consultant", "researcher",
]

def run_layer2(message: str) -> list[dict]:
    """Layer 2: deterministic slot extraction."""
    results = []
    msg = message.strip()

    # Name
    m = re.search(r"(?:my name is|i am|i'm)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)", msg, re.IGNORECASE)
    if m:
        val = m.group(1).strip()
        if val.lower() not in ["a", "an", "the", "developer", "student", "designer"]:
            results.append({"key": "name", "value": val, "confidence": 0.9})

    # Role
    roles_re = "|".join(re.escape(r) for r in ROLES)
    m = re.search(rf"(?:i am|i'm|i work as)\s+(?:a |an )?(?:{roles_re})", msg, re.IGNORECASE)
    if m:
        full = m.group(0)
        extracted = re.sub(r"^(?:i am|i'm|i work as)\s+(?:a |an )?", "", full, flags=re.IGNORECASE).strip().lower()
        normalized = "product manager" if extracted == "pm" else extracted
        results.append({"key": "role", "value": normalized, "confidence": 0.95})

    # Goal
    m = re.search(r"(?:my goal is|my main goal is|i want to|i am trying to|i'm trying to)\s+(.+?)(?:\.|,|$)", msg, re.IGNORECASE)
    if m:
        val = m.group(1).strip()
        if len(val) >= 3:
            results.append({"key": "current_goal", "value": val, "confidence": 0.85})

    # Preference
    m = re.search(r"(?:i prefer|i like)\s+(.+?)(?:\.|,|$)", msg, re.IGNORECASE)
    if m:
        raw = m.group(1).strip().lower()
        style_map = {
            "concise": "concise", "short": "concise", "brief": "concise",
            "detailed": "detailed", "in-depth": "detailed",
            "step by step": "step-by-step", "step-by-step": "step-by-step",
        }
        for k, v in style_map.items():
            if k in raw:
                results.append({"key": "answer_style", "value": v, "confidence": 0.9})
                break

    # Project
    m = re.search(r"(?:i(?:'m| am) (?:working on|building|developing|creating))\s+(.+?)(?:\.|,|$)", msg, re.IGNORECASE)
    if m:
        val = m.group(1).strip()
        if len(val) >= 3:
            results.append({"key": "current_project", "value": val, "confidence": 0.85})

    # Tech stack
    m = re.search(r"(?:i use|my stack is|my tech stack (?:is|includes?)|i(?:'m| am) using)\s+(.+?)(?:\.|,|$)", msg, re.IGNORECASE)
    if m:
        val = m.group(1).strip()
        if len(val) >= 2:
            results.append({"key": "tech_stack", "value": val, "confidence": 0.85})

    # Focus
    m = re.search(r"(?:i(?:'m| am) preparing for|my current focus is)\s+(.+?)(?:\.|,|$)", msg, re.IGNORECASE)
    if m:
        val = m.group(1).strip()
        if len(val) >= 3:
            results.append({"key": "current_focus", "value": val, "confidence": 0.85})

    return results


# ---------------------------------------------------------------------------
# Layer 3 — LLM extraction
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """You are a memory extraction system. Extract persona facts from the user message.

User message: "{message}"

Return ONLY a valid JSON array. No explanation. No markdown. No prose.

Extract from these schema keys only:
- role, current_goal, answer_style, tech_stack, current_project, current_focus, name, education_level, university_goal

Example output:
[
  {{ "key": "role", "value": "developer", "confidence": 0.92 }},
  {{ "key": "tech_stack", "value": "React, Next.js", "confidence": 0.88 }}
]

If no memory-worthy facts exist, return exactly: []"""

KNOWN_KEYS = {
    "role", "current_goal", "answer_style", "tech_stack",
    "current_project", "current_focus", "name", "education_level", "university_goal"
}

def run_layer3(message: str, ollama_url: str, model: str) -> list[dict]:
    """Layer 3: LLM extraction via Ollama."""
    try:
        import requests
        prompt = EXTRACTION_PROMPT.format(message=message)
        res = requests.post(
            f"{ollama_url}/api/chat",
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
            },
            timeout=15,
        )
        res.raise_for_status()
        raw_content = res.json().get("message", {}).get("content", "[]")

        # Strip markdown fences
        cleaned = re.sub(r"^```(?:json)?\s*", "", raw_content.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned.strip())

        parsed = json.loads(cleaned)
        if not isinstance(parsed, list):
            return []

        results = []
        for item in parsed:
            if not isinstance(item, dict):
                continue
            key = item.get("key", "")
            value = item.get("value", "")
            confidence = item.get("confidence", 0)
            if key not in KNOWN_KEYS or not value or confidence < 0.6:
                continue
            results.append({"key": key, "value": str(value).strip(), "confidence": confidence})

        return results
    except Exception as e:
        print(f"[Layer3] LLM extraction failed: {e}", file=sys.stderr)
        return []


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Memory extraction CLI tool")
    parser.add_argument("--message", required=True, help="User message to extract memory from")
    parser.add_argument(
        "--ollama-url",
        default=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        help="Ollama base URL (default: http://localhost:11434)"
    )
    parser.add_argument(
        "--model",
        default=os.getenv("OLLAMA_DEFAULT_MODEL", "qwen2.5:7b"),
        help="Ollama model to use for Layer 3"
    )
    parser.add_argument("--verbose", action="store_true", help="Show layer-by-layer output")
    args = parser.parse_args()

    message = args.message

    # Layer 1
    triggered = is_trigger(message)
    if args.verbose:
        print(f"[Layer1] trigger={'YES' if triggered else 'NO'}", file=sys.stderr)

    if not triggered:
        print(json.dumps([]))
        return

    # Layer 2
    layer2_results = run_layer2(message)
    if args.verbose:
        print(f"[Layer2] extracted {len(layer2_results)} items", file=sys.stderr)

    if layer2_results:
        print(json.dumps(layer2_results, indent=2))
        return

    # Layer 3
    if args.verbose:
        print("[Layer2] no match, escalating to Layer 3 (LLM)...", file=sys.stderr)

    layer3_results = run_layer3(message, args.ollama_url, args.model)
    if args.verbose:
        print(f"[Layer3] LLM extracted {len(layer3_results)} items", file=sys.stderr)

    print(json.dumps(layer3_results, indent=2))


if __name__ == "__main__":
    main()
