# ChatBridge — Pre-Search Document

**Course:** G4 Week 7 — ChatBridge (TutorMeAI case study)  
**Base codebase:** Fork of [Chatbox Community Edition](https://github.com/chatboxai/chatbox) (this repo)  
**Purpose:** Planning, trade-offs, and defensible decisions before implementation.

---

## Case Study Analysis

*(Target: ~500 words. Non-technical audience. Header required by assignment.)*

TutorMeAI’s strength is not the chatbot alone but **configurable teaching behavior**—tone, focus, and guardrails teachers control. Competitors are copying that. The next leap is **orchestration**: letting third-party experiences run *inside* the same chat students already trust, without fragmenting attention across many sites. That sounds simple until you realize every app has its own UI, rules, and failure modes.

The hardest problems sit at the **boundary** between “the assistant” and “something else running here.” A third party might offer a chess board, a simulation, or a playlist tool. The platform must discover what those tools are, call them with structured inputs, show their interface, know when a task finished, and keep enough **context** so a follow-up question (“what should I do here?”) still makes sense. None of that can be hand-coded per vendor; it has to be a **contract**—discoverable capabilities, clear lifecycle, and predictable messaging.

That boundary also creates **trust and safety** obligations, especially in K–12. Not every integration belongs in a classroom. The system needs ways to reason about **appropriateness** (who vetted the app, what data it can see) and to limit harm when something is buggy or malicious. “Move fast” conflicts with “protect children.” The ethical tension is real: openness fuels innovation; tight gates protect users. A practical stance is **layered trust**—clear registration, scoped permissions, observable behavior, and fast containment when things go wrong—rather than pretending either total lockdown or total freedom is sufficient.

**Communication and state** are the second pillar. If the chat and the embedded app disagree on what “done” means, the conversation becomes incoherent. If messages cross a boundary without authentication or integrity, you risk data leaks or spoofed completions. So the design has to treat app–platform messaging as a first-class problem: explicit completion signals, timeouts, and recovery paths when an app hangs or errors.

What this team should **land on** is a platform mindset: a small number of well-defined integration patterns (internal tools, public APIs, OAuth-backed services), **security and observability baked into the contract**, and a build order that proves one vertical slice (one app end-to-end) before scaling to many. A modest, reliable integration beats a flashy demo that breaks mid-conversation—exactly the note the assignment emphasizes.

*(You can tighten or expand this section to hit the 500-word target; count words in your editor before submission.)*

---

## Requirements Extracted from the Assignment (PDF)

Requirements appear in **MVP + Pre-search**, **Early Submission**, **Final**, **Authentication & App Types**, **Technical Stack**, **Build Strategy**, **Submission**, and **Appendix: Planning Checklist**. Consolidated below.

### Deadlines (summary)

| Checkpoint | Focus |
|------------|--------|
| **MVP + Pre-search (24 h / Tuesday)** | Pre-search doc + 3–5 min architecture video |
| **Early (Friday)** | Full plugin system + multiple apps |
| **Final (Sunday)** | Polish, auth flows, documentation, deployment |

### MVP + Pre-search — hard gate

- [ ] **Pre-search document** including:
  - **Case Study Analysis** (500-word non-technical section at the beginning; header name required).
  - **3–5 minute video** presenting technical architecture.
- [ ] Work on a **fork of Chatbox**; push fork to **GitLab**.

### Core app features (ChatBridge platform)

| Area | Requirement |
|------|-------------|
| **Messaging** | Real-time AI chat with **streaming** responses |
| **History** | **Persistent** conversation history across sessions |
| **Context** | Chat maintains context about **active third-party apps and their state** |
| **Multi-turn** | Support **complex multi-turn** conversations spanning app interactions |
| **Error recovery** | **Graceful** handling when apps fail, timeout, or return errors |
| **User auth** | **User authentication for the chat platform itself** |

### Third-party app integration architecture (programmatic interface)

Third-party apps must be able to:

1. **Register** themselves and capabilities with the platform  
2. **Define tool schemas** the chatbot can discover and invoke  
3. **Render their own UI** within the chat experience  
4. **Receive tool invocations** from the chatbot with structured parameters  
5. **Signal completion** back to the chatbot when work is done  
6. **Maintain their own state** independently from the chat  

### Required third-party apps

- **At least 3** apps demonstrating **different integration patterns**.  
- **Chess is required** (high complexity, bidirectional comms, legal moves, tools for game + help; no auth required for chess per spec).  
- **At least 2 more** apps: vary complexity, **auth patterns**, interaction styles.  
- **Auth required for at least one** third-party application.

### Testing scenarios (graders will test)

1. User asks chatbot to use a third-party app (discovery + invocation)  
2. Third-party UI renders correctly in chat  
3. User interacts with UI, then returns to chatbot (**completion signaling**)  
4. User asks about app results **after** completion (**context retention**)  
5. User switches **between multiple apps** in one conversation  
6. **Ambiguous** question routing across apps  
7. Chatbot **refuses** unrelated app invocations  

### Performance

- Reasonable performance; **your** judgment on targets.  
- **UX cues** expected (spinners, progress text, etc.) — lack of indicators is penalized.

### Authentication & app types (platform must support)

| App type | Auth pattern | Examples |
|----------|--------------|----------|
| **Internal** | None — bundled | Calculator, unit converter |
| **External (public)** | API key or none | Weather, dictionary |
| **External (authenticated)** | OAuth2 or similar | Spotify, GitHub, Calendar |

For authenticated apps: platform handles **OAuth**, **secure token storage**, **automatic refresh**, and **passing credentials** into tool invocations.

### AI cost analysis (submission)

- **Dev/testing:** LLM costs, token breakdown, API call counts, other AI costs.  
- **Production projections:** monthly cost at **100 / 1K / 10K / 100K** users (table with assumptions).

### Technical stack (PDF suggests options — not prescriptive)

Frontend (React, Next, Vue, Svelte), backend (Node, Python, serverless), real-time (WS, SSE, polling), AI (GPT-4, Claude + function calling), sandboxing (iframe, web components), auth (NextAuth, Auth0, Clerk, Firebase, JWT), DB (Postgres, Mongo, Firebase, Supabase), deployment (Vercel, Railway, Render, etc.).

### Build strategy (priority order from PDF)

1. Basic chat + history end-to-end  
2. App registration + tool spec contract  
3. Tool invocation (single app)  
4. UI embedding  
5. Completion signaling  
6. Context retention  
7. Multiple apps (3+)  
8. Auth flows  
9. Error handling  
10. Developer docs  

### Submission (Early + Final, unless noted)

- GitLab repo: setup guide, architecture, API docs, **deployed link**  
- Demo video (3–5 min): chat + plugins + lifecycle + architecture  
- AI cost analysis  
- Deployed app with **≥ 3 working** third-party apps  
- **Social post (final only):** X or LinkedIn, tag @GauntletAI  

### Appendix: Planning Checklist → pre-search questions

The PDF ends with **16 numbered question clusters** (Phases 1–3) covering constraints, architecture, LLM/tools, real-time, state, auth, DB, security, errors, testing, DX, deployment. These are the **pre-search prompts** you must work through; see **Section 7** below for options per cluster.

---

## What the Base Chatbox Repo Already Provides

This is a **desktop-first** (Electron) client with **web** and **mobile** (Capacitor) targets. It is **not** a multi-tenant SaaS with user accounts out of the box; it is a **local client** for multiple LLM providers.

### Chat & models

- **Streaming** AI responses via Vercel AI SDK patterns (`streamText` in `src/renderer/packages/model-calls/`).  
- Pluggable **model providers** (OpenAI-compatible, Anthropic, Azure, etc.) in `src/shared/models/`.  
- **Tool / function calling** for models that support it.

### Conversation persistence

- **Sessions and messages** stored per platform: desktop uses **IndexedDB** (localforage) for sessions; configs in files; mobile can use SQLite; see `docs/storage.md` and `src/renderer/platform/storages.ts`.

### Tools & extensibility (closest to “plugins” today)

- **MCP (Model Context Protocol)** integration: connect MCP servers (stdio or HTTP/SSE), expose tools to the model via `mcpController.getAvailableTools()` merged into the tool set in `stream-text.ts`. See `src/renderer/packages/mcp/`.  
- Built-in toolsets: **knowledge base** (semantic search tools), **web search**, **file** tools, etc.

### Knowledge base & local DB

- **LibSQL / Mastra** vector store for **local knowledge bases** (`src/main/knowledge-base/`). This is **document RAG**, not user identity or ChatBridge app registry.

### UI embedding (limited precedent)

- **Artifacts:** HTML preview in an **iframe** with **`postMessage`** to a hosted preview origin (`src/renderer/components/Artifact.tsx`). This is **preview of model-generated HTML**, not a full third-party app registration system.

### Authentication & licensing (embedded today)

| Mechanism | Role |
|-----------|------|
| **Chatbox AI login** | OAuth-like **browser login** to Chatbox cloud: ticket request → user opens authorize URL → **polling** for tokens. Tokens stored in **`authInfoStore`** (persisted as `chatbox-ai-auth-info`): `accessToken`, `refreshToken`. Used for **Chatbox premium / remote APIs**, not generic app identity. See `useLogin.ts`, `useAuthTokens.ts`, `src/renderer/packages/remote.ts`. |
| **License key** | Manual activation path; interacts with premium actions. |
| **No** general-purpose **NextAuth / Auth0 / Clerk / Supabase Auth** in the repo for *your* platform’s end users. |

### Other

- **Sentry**, i18n, **TanStack Router**, **Jotai/Zustand** stores, **Electron** IPC.  
- **No** built-in ChatBridge concepts: **third-party app registry**, **sandboxed app marketplace**, **platform-level user auth** for TutorMeAI, or **OAuth broker** for arbitrary third-party APIs — those are **your** additions.

---

## Authentication: Options for the ChatBridge Platform

### What you can reuse from Chatbox

- **Token storage pattern:** persisted store + clear on logout (`authInfoStore` pattern).  
- **Desktop “open browser → callback” flow:** similar to how **Chatbox AI** does ticket-based login (adapt for your OAuth redirect or deep link).  
- **Deep links** in Electron (`src/main/deeplinks.ts`) for bringing auth results back into the app.

### Options for **platform user auth** (assignment: “User authentication for the chat platform itself”)

| Option | Pros | Cons |
|--------|------|------|
| **Supabase Auth** | Email/OAuth, JWT, refresh handled; pairs with Postgres for history | New dependency; sync with Electron/web |
| **Clerk** | Fast UI components, sessions | Vendor lock-in, cost at scale |
| **Auth0 / Cognito** | Enterprise patterns | Heavier setup |
| **NextAuth** (if you add Next.js API routes) | Familiar for web | Chatbox is not Next.js today — extra surface |
| **Custom JWT backend** (FastAPI/Express) | Full control | You own refresh, breaches, MFA |
| **Firebase Auth** | Quick start | Data model and pricing trade-offs |

### Options for **third-party app OAuth** (assignment: external authenticated apps)

| Option | Notes |
|--------|--------|
| **Central OAuth broker in your backend** | Your platform completes Spotify/GitHub OAuth; stores tokens **server-side**; tools receive short-lived delegated access or server-side proxy calls. **Matches PDF** (“store tokens securely, refresh, pass credentials”). |
| **PKCE + redirect to your web origin** | Standard for SPAs; Electron may use custom protocol or localhost redirect. |
| **Per-app iframe OAuth** | Risky (cookies, redirect in iframe); usually **avoid**; prefer **popup or system browser** then return tokens to host. |

**Embedded in Chatbox today:** **no** generic OAuth library for arbitrary providers—only the **Chatbox-specific** login flow. Plan to **add** a backend or BaaS for production-grade multi-app OAuth.

---

## Pre-Search Questions (PDF Appendix) — Options & Angles

For each cluster, pick **one defensible path** for your write-up; options below help you compare.

### 1. Scale & load profile

- **Options:** Low tens of users (class demo) vs. “production-shaped” with connection pools; spike handling via queue vs. horizontal scale.  
- **Decide:** Concurrent app sessions per user (1 vs. many); cold-start tolerance (lazy-load iframe vs. preload).

### 2. Budget & cost ceiling

- **Options:** Hard monthly cap vs. pay-per-token; cheaper models for routing vs. same model everywhere.  
- **Decide:** Where to spend (better sandbox vs. more LLM calls).

### 3. Time to ship

- **Options:** Vertical slice first (PDF) vs. parallel tracks; MVP only internal + chess vs. early OAuth.  
- **Decide:** Cut scope on polish vs. on security.

### 4. Security & sandboxing

- **Options:** iframe `sandbox` + strict CSP vs. web worker + canvas only; allow-list origins for postMessage; no `allow-same-origin` unless required.  
- **Decide:** What a malicious registered app can still do; rate limits per user/app.

### 5. Team & skill constraints

- **Options:** Solo (reuse MCP + minimal backend) vs. team split (frontend/embed + backend/auth).  
- **Decide:** TypeScript-only stack vs. Python for AI workers.

### 6. Plugin architecture

- **Options:** iframe + postMessage (PDF) vs. web components in shadow DOM; **MCP-heavy** (tools as MCP servers) vs. custom JSON-RPC.  
- **Leverage base repo:** MCP already wires tools into `streamText`; you might **extend** registration semantics or add an **app host** layer.

### 7. LLM & function calling

- **Options:** Single provider vs. fallback; **dynamic tool list** injection (already similar in Chatbox) vs. trimmed tools per session for context limits.  
- **Decide:** Streaming while tool runs (show “waiting for app…”).

### 8. Real-time communication

- **Options:** WebSocket vs. SSE vs. polling (Chatbox today is mostly **request/response** streaming for chat; app bridge may need **WS or postMessage**).  
- **Decide:** Separate channel for app events vs. overloading chat API.

### 9. State management

- **Options:** App state in iframe only vs. mirrored in parent for LLM context; **serialize board state** to messages on each turn (chess).  
- **Leverage:** Session store in IndexedDB for persistence.

### 10. Authentication architecture

- **Options:** Platform auth **before** chat vs. guest mode; per-app tokens in **server DB** vs. encrypted local vault; iframe OAuth **avoid** — use **popup/system browser**.  
- **See:** Auth section above.

### 11. Database & persistence

- **Options:** Supabase/Postgres for cloud sync vs. local-only MVP; store tool invocation logs for debugging and **context retention**.  
- **Leverage:** Chatbox session format — you may extend message schema with `appContext` parts.

### 12. Security & sandboxing (deep dive)

- **Options:** CSP nonces for inline scripts (often blocked in strict sandbox); **origin allow-list** for `postMessage`; subresource integrity for app bundles.

### 13. Error handling & resilience

- **Options:** Tool timeout (seconds) + user-visible retry; circuit breaker per app; LLM instructed to **not** call tools when query is unrelated (test scenario 7).

### 14. Testing strategy

- **Options:** Mock iframe with fake postMessage; contract tests for tool schemas; Playwright E2E for full lifecycle.

### 15. Developer experience

- **Options:** OpenAPI/JSON Schema for registration; local **dev server** template for third-party apps; debug panel showing last tool calls.

### 16. Deployment & operations

- **Options:** Static front on Vercel + API on Railway; **where apps are hosted** (your CDN vs. third-party URL in iframe); version pins for app manifests.

---

## Deliverables Checklist (for you)

- [ ] Finalize **Case Study Analysis** (~500 words)  
- [ ] Record **3–5 min architecture video**  
- [ ] Track **AI costs** during dev; fill projection table  
- [ ] Keep **GitLab** fork updated  
- [ ] After implementation: setup guide, **API docs**, deployed URL  

---

## Suggested Next Steps

1. **Fork naming & GitLab remote** — align with class requirements.  
2. **Choose platform auth** + **OAuth strategy** for one external app (e.g. Spotify-style) early—**Final** deadline explicitly calls out auth polish.  
3. **Define the app contract** (registration message shape, tool schema format, completion event) in writing before coding features 3–6.  
4. **Prove chess vertically** (invoke → render → move → help → endgame → follow-up) before building weather/Spotify.  

---

*This document is a planning aid. Update decisions as you implement.*
