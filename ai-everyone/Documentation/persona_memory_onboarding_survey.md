# Persona / Memory — Onboarding Survey

> The onboarding survey is a full-screen modal that appears immediately after a new user's **first login** (email or Google). It must be completed or skipped before the user can access the dashboard.

---

## Survey UX Design

- **No text input fields** — all answers are option chips (inspired by Replit's onboarding)
- **Max 4 questions** — short enough that users don't abandon it
- **Back / Next navigation** — user can go back and change answers
- **Skip** — available on every step; skipped answers push `undefined` to Firestore but predefined fields are still created
- **Adaptive** — Step 2 changes based on Step 1 (role selection)

---

## Survey Steps

### Step 1 — Role
**Question**: "What describes you best?"  
**Sub-text**: "If you wear many hats, pick what you do most often."

**Options** (chips):
- Developer
- Product Manager
- Startup Founder
- Business Owner
- Data Scientist / Analyst
- Designer
- Marketing & Sales
- Business Operations
- Student
- Educator / Teacher
- Other

**Memory saved**: `{ type: "role", key: "role", value: <selection>, confidence: 1.0, source: "survey" }`

---

### Step 2 — Role-adaptive Question
**Question** and **options** vary by Step 1 answer:

| Role | Question | Options |
|------|----------|---------|
| Developer | "What's your current focus?" | Building a product, Learning new tech, Interview prep, Open source, Professional growth, Side project |
| Student | "What's your primary study goal?" | Get a job, Get into grad school, Build projects, Learn AI/ML, Academic research, Freelancing |
| Designer | "What kind of work are you doing?" | Product design, UI/UX, Brand identity, Freelance client work, Learning design |
| Product Manager | "What's your current priority?" | Launching a product, Growing an existing product, Learning product strategy, Switching roles |
| Startup Founder | "What stage are you at?" | Idea stage, Building MVP, Early customers, Scaling, Fundraising |
| Other | "What's your main current goal?" | Learn new skills, Build something, Find a job, Grow my career, Explore AI |

**Memory saved**: `{ type: "context", key: "current_focus", value: <selection>, confidence: 1.0, source: "survey", scope: "temporary" }`

---

### Step 3 — Primary Goal
**Question**: "What's your primary goal right now?"

**Options** (chips):
- Build a product / startup
- Learn AI & agentic workflows
- Prepare for job / interviews
- Get better at my current role
- Automate my work
- Explore AI tools
- Academic / research goals
- Other

**Memory saved**: `{ type: "goal", key: "current_goal", value: <selection>, confidence: 1.0, source: "survey" }`

---

### Step 4 — Answer Style Preference
**Question**: "How do you prefer responses?"

**Options** (chips):
- Concise & direct
- Detailed explanations
- Step-by-step breakdowns
- Code-heavy
- No preference

**Memory saved**: `{ type: "preference", key: "answer_style", value: <selection>, confidence: 1.0, source: "survey" }`

---

## Skip Policy

- Each step has a **Skip** button
- Skipped steps:
  - Do NOT create a memory item (no undefined stored in memories collection)
  - The `persona/main` field for that key remains `undefined`
- After all steps (or Skip All), the survey calls `POST /api/survey` with the collected answers (only answered steps are included)
- `onboardingComplete: true` is set on the user doc regardless of how many steps were answered

---

## Technical Flow

```
User logs in for the first time
         │
         ▼
OnboardingGuard checks users/{uid}.onboardingComplete
         │
         │ false (new user)
         ▼
OnboardingSurvey modal shown (full screen)
         │
         │ user answers / skips all steps
         ▼
POST /api/survey  { answers: [...] }
         │
         ▼
Server: convert answers → MemoryItems → save to Firestore
         │
         ▼
Server: rebuild persona summary (users/{uid}/persona/main)
         │
         ▼
Server: set users/{uid}.onboardingComplete = true
         │
         ▼
Modal closes → user sees dashboard
```

---

## Predefined Memory Skeleton (seeded at user creation)

Before the survey runs, `users/{uid}/persona/main` is seeded:

```json
{
  "summary": "",
  "updatedAt": "<timestamp>",
  "topFacts": [],
  "version": 0,
  "generatedFrom": [],
  "role": null,
  "current_focus": null,
  "answer_style": null
}
```

And `users/{uid}/memorySettings/main`:

```json
{
  "maxTotalMemories": 20,
  "tempMemoryTTLDays": 30,
  "requireConfirmation": false
}
```

These are seeded in `firebaseAuth.ts` during `signUpWithEmail` and `signInWithGoogle` (first-time only).
