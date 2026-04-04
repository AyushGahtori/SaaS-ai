# Persona / Memory — Extraction Pipeline

> This document describes the 3-layer memory extraction pipeline used to detect and store user facts from chat messages.

---

## Pipeline Overview

```
User message arrives at /api/chat
         │
         ├── [Normal flow] ──► LLM call ──► Return reply to user (not blocked)
         │
         └── [Fire-and-forget background]
                  │
                  ▼
         ┌─────────────────────┐
         │   LAYER 1           │
         │  Trigger Detector   │  ← regex patterns, zero cost
         │  (trigger-detector.ts) │
         └──────────┬──────────┘
                    │ no match → STOP
                    │ match ↓
         ┌─────────────────────┐
         │   LAYER 2           │
         │  Rule-based Extractor│  ← deterministic slot extractors
         │  (extractor.ts)     │
         └──────────┬──────────┘
                    │ confident result → save
                    │ ambiguous → proceed ↓
         ┌─────────────────────┐
         │   LAYER 3           │
         │  LLM Extractor      │  ← Ollama strict JSON, only when needed
         │  (extractor.ts)     │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   Deduper           │  ← normalize, compare, skip/supersede
         │   (deduper.ts)      │
         └──────────┬──────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │  Memory Repository  │  ← write to Firestore
         │  Persona Builder    │  ← rebuild summary
         └─────────────────────┘
```

---

## Layer 1 — Trigger Detector

**File**: `src/lib/memory/trigger-detector.ts`  
**Cost**: Zero (pure regex, synchronous, no network)  
**Goal**: High precision. Reject non-memory messages immediately.

### Trigger Patterns

```typescript
const TRIGGER_PATTERNS = [
  /^i am (a |an )?[a-z]/i,          // "I am a developer"
  /^i'm (a |an )?[a-z]/i,           // "I'm a developer"
  /^my name is [a-z]/i,             // "My name is Ayush"
  /^i work as [a-z]/i,              // "I work as a designer"
  /^i am working on .+/i,           // "I am working on React"
  /^i'm working on .+/i,
  /^i'm currently (building|working|studying|learning)/i,
  /^i prefer .+/i,                  // "I prefer concise answers"
  /^i like .+/i,
  /^my goal is .+/i,                // "My goal is to get into MIT"
  /^i want to (become|be|learn|build|get|go)/i,
  /^i study .+/i,                   // "I study computer science"
  /^i am preparing for .+/i,
  /^i use .+/i,                     // "I use React and Next.js"
  /^my (current )?focus is .+/i,
  /^i'm (a |an )?[a-z]+ (working|building|studying)/i,
];
```

**Returns**: `boolean` — `true` if message should proceed to Layer 2.

**False positive prevention**: Patterns require the memory signal to be at the **start** of the message. This avoids triggering on questions like `"am I wrong?"` or `"what if I use React?"`.

---

## Layer 2 — Rule-based Slot Extractor

**File**: `src/lib/memory/extractor.ts`  
**Cost**: Cheap (regex + string operations, synchronous)  
**Goal**: Extract clean structured memory items for common, simple patterns.

### Slot Extractors

| Extractor | Pattern | Output key | Example |
|-----------|---------|-----------|---------|
| `nameExtractor` | `/(?:my name is\|i am\|i'm) ([A-Z][a-z]+)/i` | `name` | "I am Ayush" → `{key: "name", value: "Ayush"}` |
| `roleExtractor` | `/i am (?:a\|an)? (developer\|designer\|student\|...)/i` | `role` | "I am a developer" → `{key: "role", value: "developer"}` |
| `goalExtractor` | `/(?:my goal is\|i want to) (.+)/i` | `current_goal` | "My goal is X" → `{key: "current_goal", value: "X"}` |
| `preferenceExtractor` | `/i prefer (.+)/i` | `answer_style` | "I prefer concise" → `{key: "answer_style", value: "concise"}` |
| `projectExtractor` | `/i(?:'m\| am) (?:working on\|building) (.+)/i` | `current_project` | "I am working on X" → `{key: "current_project", value: "X"}` |
| `techStackExtractor` | `/i use (.+)/i` | `tech_stack` | "I use React" → `{key: "tech_stack", value: "React"}` |
| `focusExtractor` | `/i(?:'m\| am) preparing for (.+)/i` | `current_focus` | "preparing for interviews" |

**Multiple extractions from one message**: All extractors run in parallel on the same message. A message like `"I am a developer and working on React and want to go to MIT"` produces:
```json
[
  { "key": "role", "value": "developer" },
  { "key": "current_project", "value": "React" },
  { "key": "current_goal", "value": "go to MIT" }
]
```

**Confidence threshold**: If an extractor returns a match, confidence = `0.95`. If the message is ambiguous (extractor returns `null`), the message is passed to Layer 3.

---

## Layer 3 — LLM Extractor

**File**: `src/lib/memory/extractor.ts` (same file, different function)  
**Cost**: One Ollama API call (only triggered when Layer 2 returns `null`)  
**Goal**: Handle complex, nuanced, multi-part memory statements.

### When Layer 3 is Triggered

Layer 2 fails to extract when:
- The message has an unusual phrasing: `"Lately I've been diving deep into frontend frameworks like React and Next.js"`
- The meaning is ambiguous: `"I kinda prefer short answers but sometimes detailed ones"`
- Multiple things are implied, not stated directly

### LLM Prompt

```
You are a memory extraction system. Extract persona facts from the user message.

User message: "<message>"

Return ONLY a valid JSON array. No explanation. No prose. No markdown.

Schema keys you may extract from:
- role (developer, student, designer, product_manager, etc.)
- current_goal (what the user wants to achieve)
- answer_style (concise, detailed, step-by-step)
- tech_stack (technologies the user uses)
- current_project (project being worked on)
- current_focus (current learning/work context)
- name (user's name)
- education_level

Example output:
[
  { "key": "role", "value": "developer", "confidence": 0.92 },
  { "key": "tech_stack", "value": "React, Next.js", "confidence": 0.88 }
]

If no facts are found, return: []
```

### Output Format

```typescript
type ExtractedMemory = {
  key: string;
  value: string;
  confidence: number;
}
```

Memories with `confidence < 0.6` are discarded. Memories with `0.6 ≤ confidence < 0.8` are saved with `status: "active"` but flagged for future review.

---

## Deduplication Logic

**File**: `src/lib/memory/deduper.ts`

1. **Normalize**: lowercase, trim, remove punctuation from `value`
2. **Exact match**: if `key + normalizedValue` already exists in active memories → **skip**
3. **Key conflict**: if same `key` exists with different value:
   - If new `confidence > old.confidence` OR `new.updatedAt > old.updatedAt` → mark old as `superseded`, save new
   - Otherwise → skip
4. **Cap enforcement**: after saving, run `enforceCapPolicy(uid)` — removes lowest priority if over 20
5. **Expiry on temporary**: set `expiresAt = now + 30 days`

---

## Persona Builder

**File**: `src/lib/memory/persona-builder.ts`

Called after every batch of memory saves. Uses top active memories to generate a short summary via Ollama.

### Assembly Prompt

```
You are a persona summarizer. Given these facts about a user, write a 2–3 sentence summary.
Be concise and natural. Do not use bullet points. Write in third person.

User facts:
<memory items as key: value list>

Output ONLY the summary sentence(s). No explanation.
```

**Output example**:
> "User is a developer focused on building an AI agent marketplace. They prefer concise answers and are currently preparing for technical interviews. Their primary stack includes React and Next.js."

---

## Semantic Retrieval (TF-IDF Cosine Similarity)

**File**: `src/lib/memory/retrieval.ts`

Used for **ranking** memories relevant to the current query — not for extraction or deduplication.

**Algorithm**:
1. Build a TF-IDF vector for the query text
2. Build TF-IDF vectors for each memory's `key + " " + value`
3. Compute cosine similarity between query and each memory
4. Return top K (default: 7)

**When retrieval is used**:
- Only when the persona is needed for context injection
- The system checks whether the current query is a "personal context" query before fetching memories
- Example trigger: the query contains `"I"`, `"my"`, `"me"`, `"what should I"`, `"recommend"`, etc.

---

## Manual Test Flows

### Test 1 — Layer 1 stops non-memory messages
```
Input: "What is React?"
Expected: Trigger not fired. No memory processing. Logs: [MemoryTrigger] not triggered
```

### Test 2 — Layer 2 clean extraction
```
Input: "I am a developer"
Expected: [{key: "role", value: "developer", confidence: 0.95}]
Logs: [MemoryTrigger] triggered, [MemoryLayer2] extracted role=developer
```

### Test 3 — Layer 2 to Layer 3 escalation
```
Input: "Lately I've been really into building agentic workflows with LangChain"
Expected: Layer 2 returns null (no regex match), Layer 3 extracts tech_stack and context
Logs: [MemoryLayer2] no match, [MemoryLayer3] LLM extracted...
```

### Test 4 — Dedup skip
```
Input: "I am a developer" (role already in Firestore)
Expected: No new memory created
Logs: [MemoryDedup] skipped identical key=role
```

### Test 5 — Python CLI
```bash
docker exec -it Pian bash
cd memory-extraction
python main.py --message "I am a developer working on React"
# Expected: [{"key":"role","value":"developer",...},{"key":"current_project","value":"React",...}]
```
