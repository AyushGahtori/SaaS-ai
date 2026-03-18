# Raw JSON vs Tag-Based Agent Intent Detection

This document compares the two methods used for detecting agent intents from the parent LLM's output. SnitchX migrated from Raw JSON to Tag-Based extraction in March 2026.

---

## How Each Method Works

### Raw JSON (Old Method)
The system prompt tells the LLM: *"Return ONLY a valid JSON object. No text, no markdown."*

**LLM Output:**
```json
{"agent_required": "teams-agent", "action": "make_call", "parameters": {"contact": "Aaron"}}
```

**Parsing:** `JSON.parse(entire_string)` — the entire response must be valid JSON.

### Tag-Based (Current Method)
The system prompt says: *"Wrap your JSON in `<AGENT_INTENT>` tags. You may include a conversational explanation before the tags."*

**LLM Output:**
```
Sure! I'll connect you to Aaron on Microsoft Teams right away.

<AGENT_INTENT>
{"agent_required": "teams-agent", "action": "make_call", "parameters": {"contact": "Aaron"}}
</AGENT_INTENT>
```

**Parsing:** Regex extracts the content between the tags, then `JSON.parse()` on only that snippet.

---

## Comparison

| Feature | Raw JSON | Tag-Based |
| :--- | :--- | :--- |
| **Reliability** | ❌ Low — one extra word breaks it | ✅ High — conversational text is ignored |
| **User Experience** | ❌ Robotic — no explanation shown | ✅ Natural — AI explains its reasoning |
| **JSON Bleed Risk** | ❌ High — raw JSON leaks into UI | ✅ None — tags are always stripped |
| **Fuzzy Model Output** | ❌ Breaks on markdown fences | ✅ Works even if LLM adds filler |
| **Parsing Complexity** | Simple (`JSON.parse`) | Slightly more (Regex + `JSON.parse`) |
| **Best For** | Machine-to-machine APIs | Chat UIs and human-facing apps |

---

## Why We Migrated

1. **LLM Hallucinations**: Models like Qwen frequently add conversational filler ("Sure! Here's the JSON...") even when told not to. This broke `JSON.parse()`.
2. **JSON Bleeding**: When parsing failed, raw JSON code was displayed directly to users in the chat interface.
3. **User Experience**: With tags, the AI can say "I'll call Aaron for you!" before triggering the agent, making the app feel human.

---

## Where Each Excels

### Raw JSON is better for:
- **Backend-to-backend automation** where no human sees the output
- **Extremely constrained models** that reliably follow "ONLY JSON" instructions
- **Simple scripts** with no UI layer

### Tag-Based is better for:
- **Chat applications** where users see the AI's response
- **Large cloud models** (like qwen3.5:397b-cloud) that tend to be "chatty"
- **Multi-agent systems** where the AI should explain why it picked a specific agent
- **Production apps** where reliability is critical

---

## Code References
- System prompt: [route.ts](file:///e:/SaaS-ai/ai-everyone/src/app/api/chat/route.ts) — `buildOrchestrationPrompt()`  
- Tag parser: [route.ts](file:///e:/SaaS-ai/ai-everyone/src/app/api/chat/route.ts) — `tryParseAgentIntent()`
- Inspiration: [assistant.py](file:///e:/SaaS-ai/ai-everyone/Teams_Meeting_schdule_python/assistant.py) — uses `<MEETING_DATA>` tags
