# ChatBridge — Pre-Search Document (v2)

**Project:** G4 Week 7 — ChatBridge (TutorMeAI Case Study)
**Base Codebase:** Fork of Chatbox Community Edition (Electron + React + Vite, with built-in web build target)
**Deployment Target:** Static web app via `pnpm build:web`, deployed to Vercel (not an Electron desktop app)
**Purpose:** Defensible decisions, architecture, and trade-off analysis before implementation.

---

## Case Study Analysis

The scenario asks for an AI chat platform where third-party apps run inside conversations and the AI stays aware of what those apps are doing. After reviewing the Chatbox codebase we are building on, the gap between what exists and what needs to be built is larger than expected.

Chatbox has a plugin system (MCP), an iframe renderer (Artifact.tsx), and multi-provider LLM integration with tool calling. That sounds like most of the work is already done. It is not. MCP is gated behind a desktop-only feature flag and does not run in the web build we need to deploy. Artifact.tsx posts messages with `targetOrigin='*'`, has no structured protocol, and was designed to preview HTML snippets, not to host untrusted third-party apps. The LLM providers store API keys client-side, which works for a local desktop app where each user enters their own key, but becomes a real vulnerability once you deploy a shared platform to a public URL. Plugin availability, iframe security, and key management all need to be replaced, not extended.

Security breaks into two separate layers. Technical isolation means preventing an embedded app from reading the parent page, stealing tokens, or redirecting the user. Strict iframe sandboxing handles that. Content verification is different, and harder. Cross-origin iframes are opaque by design. The browser's same-origin policy means the parent cannot inspect what an app renders. An app that passed review could later serve different content, and the platform would never detect it. Solving marketplace trust fully requires review gates, version pinning, and reporting on top of the sandbox. That is a process and tooling problem that does not fit in a one-week sprint. What does fit is the technical foundation: strict isolation, scoped data access, and a registration model where a review gate can be inserted later.

The third problem is state coherence between the chat and the app. The AI needs to know what an app is doing to answer follow-up questions, but the app controls its own state. Without typed messages, completion signals, and compact state summaries flowing through a structured protocol, the conversation either loses context or the token window fills up with verbose state dumps. Chatbox already has the right tool-call message schema (call, result, and error states defined in its Zod types) and a merge point in `stream-text.ts` where tools are injected before each LLM call. That part is reusable. The missing piece is the contract layer on top: app manifests, lifecycle events, timeout handling, and translation of postMessage events into conversation context.

There is also an ethical question about scope control. In a K-12 environment, someone has to decide what apps a student can access. For this sprint, we avoid the open marketplace problem entirely by building all three apps ourselves and shipping a static allow-list. The architecture has room for a review gate later, but content moderation is out of scope for seven days.

Our plan is a local-first web app deployed to a public URL. The LLM key is secured behind a server-side proxy. Authentication goes through a managed service. A custom tool registry replaces the desktop-only MCP runtime. Chatbox gives us streaming chat, tool-call schemas, IndexedDB persistence, and a provider abstraction. Platform auth, secure key storage, app sandboxing, and a lifecycle protocol are what we have to build.

---

## Complete Requirements Extracted from the PDF

Requirements are scattered across multiple sections of the document. This is a consolidated, categorized extraction.

### Deadlines

| Checkpoint | Deadline | Focus |
|---|---|---|
| MVP + Pre-search | Tuesday (24 hours) | Planning |
| Early Submission | Friday (4 days) | Full plugin system + multiple apps |
| Final | Sunday (7 days) | Polish, auth flows, documentation, deployment |

### MVP + Pre-search (hard gate — all required to pass)

- [ ] Pre-search document
- [ ] Case Study Analysis: 500-word non-technical explanation at the beginning, header must be "Case Study Analysis," covering key problems, trade-offs, ethical decisions, and final stance
- [ ] 3-5 minute video presenting technical architecture
- [ ] Work on a fork of Chatbox, pushed to GitLab

### Core Chat Features

| Feature | Requirement |
|---|---|
| Messaging | Real-time AI chat with **streaming** responses |
| History | **Persistent** conversation history across sessions |
| Context | Chat maintains context about **active third-party apps and their state** |
| Multi-turn | Support complex multi-turn conversations that **span app interactions** |
| Error Recovery | Graceful handling when apps **fail, timeout, or return errors** |
| User Auth | User authentication **for the chat platform itself** |

### Third-Party App Integration Architecture (the core engineering challenge)

Third-party apps must be able to:

1. **Register** themselves and their capabilities with the platform
2. **Define tool schemas** that the chatbot can discover and invoke
3. **Render their own UI** within the chat experience
4. **Receive tool invocations** from the chatbot with structured parameters
5. **Signal completion** back to the chatbot when their task is done
6. **Maintain their own state** independently from the chat

### Required Third-Party Apps

- At least **3 apps** demonstrating **different integration patterns**
- **Chess is required**: high complexity, bidirectional communication, interactive board with legal move validation, tools for start/move/help/error. Full lifecycle: "let's play chess" → board appears → "what should I do?" mid-game → AI analyzes board → game ends → chatbot discusses game
- At least **2 more apps**: must vary in complexity, auth patterns, and interaction styles
- **Auth is required for at least one** third-party app
- Chess itself does NOT require auth

### Testing Scenarios (graders will verify all of these)

1. User asks chatbot to use a third-party app → tool discovery and invocation
2. Third-party app UI renders correctly within the chat
3. User interacts with app UI, then returns to chatbot → completion signaling
4. User asks chatbot about app results after completion → context retention
5. User switches between multiple apps in the same conversation
6. Ambiguous question that could map to multiple apps → routing accuracy
7. Chatbot correctly refuses to invoke apps for unrelated queries

### Performance

- Use your own judgment on targets, but the app must be performant
- **UX cues are mandatory**: spinners, progress text, streaming indicators. Lack of expected indicators will be penalized

### Authentication & App Types (platform must handle all three)

| App Type | Auth Pattern | Example |
|---|---|---|
| Internal | No auth — bundled with platform | Calculator, unit converter |
| External (Public) | API key or none — no user-specific auth | Weather, dictionary |
| External (Authenticated) | OAuth2 or similar — user must authorize | Spotify, GitHub, Google Calendar |

For authenticated apps, the platform must:
- Handle the **OAuth flow**
- **Store tokens securely**
- **Refresh tokens automatically**
- **Pass credentials** to the app when invoking tools

### AI Cost Analysis

**Development & Testing (track actual spend):**
- LLM API costs (provider, total)
- Total tokens consumed (input/output breakdown)
- Number of API calls
- Other AI-related costs

**Production Projections (table with assumptions):**

| 100 Users | 1,000 Users | 10,000 Users | 100,000 Users |
|---|---|---|---|
| $/month | $/month | $/month | $/month |

Include: average tool invocations per user per session, sessions per user per month, token counts per invocation, cost of maintaining app connections.

### Build Strategy (priority order from PDF)

1. Basic chat with conversation history end-to-end
2. App registration — define tool spec contract, build registration API
3. Tool invocation — chatbot discovers and calls a single app's tools
4. UI embedding — app renders its UI within the chat interface
5. Completion signaling — app tells chatbot when done, chatbot resumes
6. Context retention — chatbot remembers app results in subsequent turns
7. Multiple apps — register and route between 3+ apps
8. Auth flows — handle apps that require user authentication
9. Error handling — timeouts, crashes, invalid tool calls
10. Developer docs — API documentation for third-party developers

### Submission Requirements (Early + Final unless noted)

- [ ] GitLab repository with: setup guide, architecture overview, API documentation, deployed link
- [ ] Demo video (3-5 min): chat + app integration demo, plugin lifecycle, architecture explanation
- [ ] AI cost analysis
- [ ] Deployed application with at least 3 working third-party apps
- [ ] Social post (final only): X or LinkedIn, description + features + demo/screenshots, tag @GauntletAI

---

## What the Base Chatbox Repo Already Provides

Chatbox CE is a **desktop-first Electron client** with web and mobile (Capacitor) targets. It is a **local-first** application for interacting with multiple LLM providers — it is NOT a multi-tenant SaaS with user accounts. Understanding exactly what exists is critical to knowing what must be built.

**Critical: Chatbox already has a web build.** The repo includes `pnpm dev:web` (browser dev mode) and `pnpm build:web` (production static build to `release/app/dist/renderer/`). The web build is a client-side SPA using IndexedDB for persistence — no server required for basic chat functionality. **This is what we deploy.** We develop with `pnpm dev:web`, not `pnpm dev` (Electron). The deployed app runs entirely in the browser.

### Already Implemented (reusable)

| Area | What Exists | Where | Reuse Potential |
|---|---|---|---|
| **Streaming AI chat** | Vercel AI SDK `streamText` with tool support | `src/renderer/packages/model-calls/stream-text.ts` | **High** — core chat already works |
| **Multi-provider LLM** | OpenAI, Anthropic, Azure, Gemini, Ollama, DeepSeek, Groq, Mistral, OpenRouter | `src/shared/providers/` | **High** — function calling ready |
| **MCP tool integration** | Full MCP client: stdio + HTTP/SSE transport, tool discovery, namespaced tool execution | `src/renderer/packages/mcp/controller.ts` | **Desktop only — NOT available in web build.** `feature-flags.ts` sets `mcp: platform.type === 'desktop'`. The tool schema format and merge pattern are valuable as design inspiration, but the MCP runtime cannot be used in our deployed web target. We build a custom app tool registry instead |
| **Tool injection into LLM** | MCP tools merged into `ToolSet` before `model.chat()` call | `stream-text.ts` lines building `tools` object | **High** — the merge point itself is reusable. We inject ChatBridge app tools at the same location where MCP tools would go, but MCP tools will be absent in the web build |
| **Session/message persistence** | Sessions + messages in IndexedDB (web + desktop), SQLite (mobile), with Zustand + TanStack Query. Already works in the web build. Will add Supabase as background sync layer for cross-device persistence via the existing `Storage` adapter pattern | `src/renderer/stores/`, `src/renderer/platform/storages.ts` | **Very high** — existing interface makes adding a Supabase sync adapter a clean ~50-line swap |
| **Message data model** | Zod schemas for messages, tool-call parts (call/result/error states), sessions, threads | `src/shared/types/session.ts` | **High** — extend with app context |
| **iframe + postMessage** | Artifact preview: HTML in sandboxed iframe, postMessage to hosted origin | `src/renderer/components/Artifact.tsx` | **Low-Medium** — useful as a conceptual starting point only. Current implementation uses `targetOrigin='*'` (insecure), points to a hardcoded Chatbox-hosted preview URL, has no message protocol, no lifecycle management, and no origin verification. We must build a new secure app host component from scratch, informed by this pattern but not extending it directly |
| **Token auth pattern** | Zustand persist store for access/refresh tokens, authenticated fetch with auto-refresh | `authInfoStore.ts`, `remote.ts` | **Medium** — pattern reusable for different auth |
| **Browser login flow** | Ticket-based: request ticket → open browser → poll for tokens | `useLogin.ts` | **Medium** — pattern for OAuth redirects |
| **Deep links** | `chatbox://` protocol routing (MCP install, provider import) | `src/main/deeplinks.ts` | **Low** — Electron-only, not applicable to web build |
| **Knowledge base / RAG** | LibSQL + Mastra vector store for local document search | `src/main/knowledge-base/` | **Not available in web build.** `feature-flags.ts` sets `knowledgeBase: platform.type === 'desktop'`, and `WebPlatform.getKnowledgeBaseController()` throws. Do not plan around this feature |
| **UI framework** | React 18, Mantine 7, MUI 5, Tailwind 3, TanStack Router | Throughout renderer | **High** — build on existing UI |

### NOT Implemented (must be built)

| Area | What's Missing |
|---|---|
| **Platform user auth** | No general-purpose auth (NextAuth, Auth0, Clerk, Supabase Auth). Only Chatbox AI cloud login exists |
| **Third-party app registry** | No app catalog, registration API, or manifest system |
| **App sandboxing** | Artifact iframe is preview-only, uses `sandbox="allow-scripts allow-forms"` with `targetOrigin='*'` — not secure for untrusted apps. Must build a new iframe host with strict sandbox, origin-scoped messaging, and lifecycle management |
| **Plugin lifecycle** | No completion signaling, no app-to-chat state sync, no lifecycle events |
| **OAuth broker** | No generic OAuth2 flow for arbitrary third-party APIs (Spotify, GitHub, etc.) |
| **App UI embedding** | No generic system for rendering third-party UIs within chat messages |
| **Backend for OAuth brokering** | No server-side component for exchanging/storing third-party OAuth tokens (Spotify, GitHub). The PDF requires "store tokens securely" — this needs a small backend (Supabase Edge Function) |
| **LLM API proxy** | No server-side gateway for LLM calls. The base repo assumes client-side API keys (BYOK model for a local desktop app). For a deployed shared platform, the OpenRouter API key **must not** be in the browser bundle — it must be stored server-side and proxied through a Supabase Edge Function |

---

## Authentication: Complete Options Analysis

### What's Already in Chatbox (and what you can reuse)

1. **`authInfoStore.ts`** — Zustand persist store keyed `chatbox-ai-auth-info` with `accessToken`, `refreshToken`, `setTokens`, `clearTokens`, `getTokens`. Reuse: the **persist + token management pattern** for your own auth system.

2. **`useLogin.ts`** — Ticket-based login: `requestLoginTicketId()` → open browser URL `{origin}/authorize?ticket_id={id}` → poll `checkLoginStatus(ticketId)` via React Query at interval until success. Reuse: the **browser-based login + polling** pattern for OAuth redirects from Electron.

3. **`remote.ts`** — `createAuthenticatedAfetch` with `getTokens`, `refreshTokens`, `clearTokens`. Automatically refreshes on 401, injects `x-chatbox-access-token` header. Reuse: the **authenticated fetch wrapper with auto-refresh** pattern.

4. **`deeplinks.ts`** — `chatbox://` protocol handler. The `auth/callback` handler is **commented out** (polling used instead). **Note:** deep links are Electron-only and do not work in the web build.

5. **No generic OAuth library** — Chatbox only authenticates against its own cloud service. No Passport, no `next-auth`, no generic OIDC client.

### Critical: Client-Side API Key Security

Chatbox's architecture assumes **client-side API keys** (`src/shared/types/settings.ts` includes `apiKey`, and provider implementations like `src/shared/providers/definitions/models/openrouter.ts` consume it directly in the browser). This is acceptable for a local BYOK desktop app where each user enters their own key.

**For our deployed shared platform, this is a critical security risk.** We are NOT requiring users to BYOK — the platform provides the OpenRouter API key. If that key is embedded in the browser bundle or stored in client-accessible settings, any user can extract it from DevTools and use it for unlimited API calls at our expense. The key must be:

1. **Stored server-side only** — in a Supabase Edge Function's environment variables
2. **Proxied** — the browser sends chat requests to the Edge Function, which attaches the OpenRouter key and forwards to OpenRouter
3. **Rate-limited** — the Edge Function enforces per-user rate limits using the Supabase Auth JWT

This is the single most important architectural correction from the base repo's assumptions to our deployment model.

### Option A: Supabase Auth (Recommended)

| Aspect | Details |
|---|---|
| **What it provides** | Email/password, magic link, social OAuth (Google, GitHub, etc.), JWT sessions, refresh tokens |
| **Why it fits** | Free tier generous. Built-in token refresh. Works in browser (PKCE flow). If you also use Supabase Edge Functions to broker third-party OAuth and proxy LLM calls, one vendor covers platform auth, OAuth brokering, LLM proxying, and data storage |
| **Trade-offs** | New dependency. Vendor coupling for auth. Chat data still lives in IndexedDB (not Supabase) — Supabase is only for auth + OAuth token storage + LLM proxy + chat sync |
| **Implementation** | `@supabase/supabase-js` client. Replace `authInfoStore` contents with Supabase session. Use `supabase.auth.onAuthStateChange()` for reactive token updates |
| **For third-party OAuth** | Supabase does NOT broker Spotify/GitHub OAuth for you — you still need a Supabase Edge Function for the code-exchange step and token storage |

### Option B: Clerk

| Aspect | Details |
|---|---|
| **What it provides** | Drop-in UI components, session management, social OAuth, MFA, user management dashboard |
| **Why it fits** | Fastest to implement. Beautiful pre-built login/signup UI. Session tokens work across web and Electron |
| **Trade-offs** | Vendor lock-in. Costs scale with MAU (free up to 10K). Requires their JS SDK in your bundle. Less control over token format. Does not help with third-party app OAuth. Still need a separate backend for LLM proxying |
| **Implementation** | `@clerk/clerk-react` provider wrapping app. `useAuth()` hook for tokens. Backend middleware for API route protection |

### Option C: Custom JWT Backend (Express or FastAPI)

| Aspect | Details |
|---|---|
| **What it provides** | Full control over token format, claims, refresh strategy, and user model |
| **Why it fits** | No vendor dependency. Can serve as both platform auth AND OAuth broker AND LLM proxy for third-party apps. If you need a backend anyway (for token storage, LLM proxying), auth lives there naturally |
| **Trade-offs** | You own everything: password hashing, token rotation, breach response, MFA. More code, more risk, more time |
| **Implementation** | Express/Fastify server with `bcrypt` + `jsonwebtoken`. Refresh token rotation in Postgres. PKCE flow for Electron clients |

### Option D: NextAuth (if adding Next.js)

| Aspect | Details |
|---|---|
| **What it provides** | Provider-agnostic auth (Google, GitHub, credentials, etc.), session management, JWT or database sessions |
| **Why it fits** | Natural if you convert the web build to Next.js. Many built-in providers |
| **Trade-offs** | Chatbox is NOT Next.js — adding Next.js is a significant architectural change. The Electron app and web app diverge. May complicate the build pipeline |
| **Implementation** | Would require a separate Next.js API layer or a standalone server |

### Option E: Firebase Auth

| Aspect | Details |
|---|---|
| **What it provides** | Email, social OAuth, phone auth, anonymous auth. Client-side SDK |
| **Why it fits** | Quick setup. Works well for prototyping. Good mobile support through Capacitor |
| **Trade-offs** | Firestore/RTDB pricing model can surprise at scale. Firebase ecosystem pull. Token format is Firebase-specific. Less natural with Postgres |

### Recommended Decision: Supabase Auth + Edge Functions for OAuth Brokering + LLM Proxy

- **Platform auth**: Supabase Auth for user signup/login/sessions. Satisfies the "User authentication for the chat platform itself" requirement.
- **Chat data**: Stays in IndexedDB. Chatbox's existing persistence already works in the web build. No migration to Postgres needed.
- **Third-party app OAuth** (e.g., Spotify): A Supabase Edge Function acts as OAuth broker. Completes the OAuth code-exchange server-side, stores tokens in a single `user_oauth_tokens` Supabase table (encrypted at rest), and passes credentials to the app when tools are invoked.
- **LLM API proxy**: A Supabase Edge Function that receives chat requests from the browser, attaches the platform's OpenRouter API key (stored as an Edge Function secret, never sent to the client), forwards to OpenRouter, and streams the response back. The browser never sees the API key. The Edge Function validates the Supabase Auth JWT on every request and enforces per-user rate limits.
- **App registry**: Static TypeScript config files shipped with the app. No database table needed — the 3 required apps are known at build time.
- **Web flow**: User clicks login → Supabase Auth UI or redirect → session stored client-side via `@supabase/supabase-js` → wraps existing `authInfoStore` pattern.

### Why This Combination

1. Supabase Auth handles the hard parts (bcrypt, refresh rotation, social providers) — you don't roll your own
2. Edge Functions broker third-party OAuth AND proxy LLM calls without standing up a separate server
3. The OpenRouter API key lives exclusively in Edge Function environment variables — never in the browser bundle, never in client-accessible storage
4. Chat history stays in IndexedDB as the primary fast store — no latency penalty for normal use. Supabase syncs in the background for cross-device persistence (see Database & Persistence section)
5. Two server-side tables: `user_store` (key-value cloud backup of IndexedDB) and `user_oauth_tokens` (third-party OAuth credentials). Minimal backend surface area
6. Free tier covers the entire development and demo phase
7. One vendor (Supabase) for auth, LLM proxy, chat backup, and OAuth token storage — no other backend needed

---

## Pre-Search Questions: Analysis and Decisions

### Phase 1: Define Your Constraints

#### 1. Scale & Load Profile

**Context:** This is a class project with a 7-day sprint. Production-shaped decisions matter for the write-up, but actual load will be demo-scale.

| Question | Decision | Reasoning |
|---|---|---|
| Users at launch? | 5-20 (graders + classmates) | Demo/grading context |
| Users in 6 months? | Design for 1,000; don't over-engineer | Show you thought about it; don't build Kubernetes |
| Traffic pattern? | Spiky — grading windows | No need for auto-scaling; need graceful degradation |
| Concurrent app sessions per user? | **1 active app at a time** per chat session | Simplifies state management enormously. Multiple apps can exist in history, but only one renders at a time. PDF testing scenario 5 says "switches between" not "uses simultaneously" |
| Cold start tolerance? | **2-3 seconds acceptable** for iframe load | Lazy-load iframes on first invocation; show loading skeleton. Users tolerate this for rich content |

**Options considered:**
- (a) Design for 100K users from day one → Over-engineering for a 7-day sprint. Rejected.
- (b) IndexedDB only (Chatbox's existing persistence) → Satisfies "persistent history across sessions" (survives browser close/reopen). But creates a mismatch with platform auth: user logs in on a new device and sees empty history despite being "the same user." Rejected as sole strategy.
- (c) Supabase Postgres only for all chat data → Consistent with auth, but adds network latency to every read/write. Startup requires network fetch before anything renders. Replaces a working local system with a slower remote one. Rejected as sole strategy.
- (d) **Local-first with cloud backup: IndexedDB as primary, Supabase as background sync** → Fast local reads (existing behavior preserved), background writes to Supabase for cross-device persistence. New device pulls from Supabase to hydrate empty IndexedDB on first visit. Best of both worlds with known trade-offs (see Database & Persistence section). **Chosen.**

#### 2. Budget & Cost Ceiling

| Question | Decision | Reasoning |
|---|---|---|
| Monthly spend limit? | $50-100 during development | Student budget. Supabase free tier (auth + 2 tables + Edge Functions). LLM API costs are the primary expense |
| Pay-per-use vs fixed? | Pay-per-use (LLM APIs) + free tiers (Supabase auth, Vercel static hosting) | No fixed infrastructure costs during dev |
| LLM cost per tool invocation? | $0 during dev (DeepSeek free via OpenRouter), ~$0.01-0.05 in production (GPT-4o via OpenRouter) | Free models for development; paid models for demo/grading |
| Where trade money for time? | **Pre-built auth (Supabase) over custom auth** | Auth is not the differentiator; the plugin system is |

**Cost-saving strategy:**
- Use **free DeepSeek models via OpenRouter** during development and testing — $0 LLM cost
- Switch to **GPT-4o via OpenRouter** for demo and grading — best function calling reliability (~$2.50/1M input, $10/1M output via OpenRouter passthrough)
- Track all spend via **OpenRouter's dashboard** — feeds directly into the cost analysis deliverable
- Cache tool schemas in system prompt rather than re-fetching
- Serialize only essential app state to context (board position as FEN string, not full move history)

**Production projection methodology:**

| Scale | Assumptions | Estimated Monthly |
|---|---|---|
| 100 users | 10 sessions/user/month, 20 messages/session, 3 tool calls/session, avg 1K tokens/call | ~$30-60 |
| 1,000 users | Same per-user pattern | ~$300-600 |
| 10,000 users | Reduced per-user (power law), caching, smaller model for routing | ~$2,000-4,000 |
| 100,000 users | Aggressive caching, fine-tuned routing model, tiered service | ~$15,000-30,000 |

(These are LLM costs only. Infrastructure at demo scale: $0 — Supabase free tier + Vercel free tier. At production scale: Supabase Pro ~$25/mo, Vercel Pro ~$20/mo.)

#### 3. Time to Ship

| Question | Decision | Reasoning |
|---|---|---|
| MVP timeline? | 24 hours (pre-search + architecture video) | Hard gate |
| Speed vs maintainability? | **Speed first, refactor Friday→Sunday** | Vertical slice by Wednesday, breadth by Friday, polish by Sunday |
| Iteration cadence? | Daily milestones | Tuesday: pre-search. Wednesday: chess E2E. Thursday: apps 2+3. Friday: early submission. Saturday: auth + polish. Sunday: deploy + docs + video |

**Sprint plan:**

| Day | Focus | Deliverable |
|---|---|---|
| Mon (Day 1) | Pre-search + architecture design | This document + architecture video |
| Tue (Day 2) | Verify `pnpm dev:web` works + add Supabase Auth + LLM proxy Edge Function + define app contract | Chat works in browser with login gate, LLM calls proxied securely |
| Wed (Day 3) | Chess app: registration → invocation → UI → state → completion | Chess fully integrated E2E |
| Thu (Day 4) | Apps 2 + 3 (weather + one OAuth app) | Three apps working |
| Fri (Day 5) | Early submission: polish, error handling, multi-app routing | Early submission |
| Sat (Day 6) | OAuth flow polish, deployment, developer docs | Deployed + documented |
| Sun (Day 7) | Final polish, demo video, cost analysis, social post | Final submission |

#### 4. Security & Sandboxing

| Question | Decision | Reasoning |
|---|---|---|
| How isolate third-party code? | **iframe with strict sandbox** | `sandbox="allow-scripts"` only. NO `allow-same-origin` (prevents parent DOM access). Origin-scoped `postMessage` |
| Malicious app registered? | **Static allow-list** for demo (we build all 3 apps). Production requires gated review before listing (see Security Deep Dive for why) | The hard problem isn't building a review queue — it's that cross-origin iframe content is fundamentally unverifiable from the parent (same-origin policy). See section 12 |
| CSP requirements? | `frame-src` restricted to registered app origins. `default-src 'self'`. No inline scripts in parent | Prevents clickjacking, XSS via apps |
| Data privacy between apps? | Apps receive ONLY the data explicitly passed via tool invocation parameters. No access to chat history, other apps' state, or user tokens they don't own | Principle of least privilege |

**Options considered:**
- (a) Web Workers + Canvas-only rendering → Too restrictive for rich UIs like chess boards. Rejected.
- (b) **iframe + postMessage with origin verification** → Industry standard for embedding. Sandbox attributes limit capabilities. postMessage origin checked on receive. **Chosen.**
- (c) Web Components in shadow DOM → Same origin as parent, cannot truly isolate untrusted code. Rejected for third-party apps, viable for internal tools.
- (d) Server-side rendering of app UI → Latency and complexity explosion. Rejected.

**Concrete sandbox attributes:**
```html
<iframe
  sandbox="allow-scripts allow-forms"
  src="https://registered-app.example.com"
  referrerpolicy="no-referrer"
/>
```
No `allow-same-origin`, no `allow-top-navigation`, no `allow-popups` (unless app needs OAuth popup → grant `allow-popups` only for authenticated app type).

**postMessage protocol:**
```typescript
// Parent → App
{ type: 'tool_invocation', toolName: string, args: Record<string, unknown>, invocationId: string }
{ type: 'context_request', requestId: string }

// App → Parent
{ type: 'tool_result', invocationId: string, result: unknown }
{ type: 'completion', summary: string, data?: unknown }
{ type: 'state_update', state: unknown }
{ type: 'error', code: string, message: string }
```
All messages validated against registered schema. Origin checked: `event.origin === registeredAppOrigin`.

#### 5. Team & Skill Constraints

| Question | Decision | Reasoning |
|---|---|---|
| Solo or team? | Solo | Project constraint |
| Languages/frameworks known? | TypeScript, React, Node.js | Stick with the existing stack |
| iframe/postMessage experience? | Limited but learnable | Artifact.tsx provides conceptual starting point, but must build new secure host |
| OAuth2 familiarity? | Moderate | Supabase abstracts most of it; third-party OAuth broker needs PKCE understanding |

**Decision:** TypeScript-only stack. React frontend (existing), Supabase for auth + LLM proxy + cloud storage backup + Edge Functions for OAuth brokering. No Python. No separate backend server. Leverage existing Chatbox patterns wherever possible.

### Phase 2: Architecture Discovery

#### 6. Plugin Architecture

This is the most critical decision in the project.

**Options:**

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A. iframe + postMessage** | Apps are standalone web apps loaded in iframes. Communication via structured postMessage. | Industry standard. True isolation. Apps can use any framework. | Cross-origin restrictions. OAuth in iframes is painful. Latency for messaging |
| **B. MCP-heavy (extend existing)** | Apps register as MCP servers. Tools discovered via MCP protocol. UI via custom MCP resource type | Leverages existing `mcpController`. Tool injection already works in `stream-text.ts` | **MCP is desktop-only** (`feature-flags.ts` gates it). MCP doesn't define UI rendering. The MCP runtime (stdio/HTTP transports) is not available in the web build. Cannot be used for our deployed target |
| **C. Web Components in shadow DOM** | Apps packaged as custom elements. Registered and rendered in parent DOM | Same-origin → easier communication. Encapsulated styles | Cannot isolate untrusted code. Same-origin security model insufficient |
| **D. Custom JSON-RPC over postMessage** | Like option A but with a formal JSON-RPC 2.0 envelope | Structured error handling. ID-based request/response matching | More protocol overhead. Still iframe-based underneath |

**Decision: Hybrid — Option A (iframe + postMessage) for UI + MCP-inspired (but custom) tool registry**

- **Tool registration and discovery** follows MCP's design patterns (namespaced tools, JSON schemas for parameters/returns) but is implemented as a **custom app tool registry**, not MCP itself. MCP is desktop-only and cannot run in the web build. Our registry reads static app manifests (TypeScript config files) and produces a `ToolSet` compatible with the Vercel AI SDK's `streamText`.
- **UI rendering** uses iframes with strict sandboxing. The `Artifact.tsx` component is a conceptual reference point but must be rebuilt with proper origin verification, lifecycle management, and a structured message protocol.
- **Communication** uses typed postMessage with origin verification. NOT MCP's stdio/HTTP transport — the iframe boundary requires postMessage.

**App Manifest (registration contract):**
```typescript
interface AppManifest {
  id: string
  name: string
  version: string
  description: string
  type: 'internal' | 'external_public' | 'external_authenticated'
  url: string // iframe source URL
  icon?: string
  tools: ToolDefinition[]
  auth?: {
    type: 'oauth2'
    authorizationUrl: string
    tokenUrl: string
    scopes: string[]
  }
  permissions: string[] // what the app can access
  completionSignals: string[] // events that mean "done"
}

interface ToolDefinition {
  name: string
  description: string // LLM reads this to decide when to invoke
  parameters: JSONSchema // structured input the LLM provides
  returns: JSONSchema // structured output
  uiTrigger: boolean // should invoking this tool show the app UI?
}
```

**How the chatbot discovers and invokes tools at runtime:**
1. On session start, load enabled apps' manifests from the static registry
2. Convert tool definitions into Vercel AI SDK tool format and merge into the `ToolSet` at the same merge point in `stream-text.ts` where MCP tools would go on desktop
3. LLM decides to call a tool → platform routes to the correct app
4. If `uiTrigger: true`, render app iframe in chat
5. Send `tool_invocation` message to iframe via postMessage
6. App processes, updates UI, sends `tool_result` or `completion` back
7. Platform injects result into conversation context

#### 7. LLM & Function Calling

| Question | Decision | Reasoning |
|---|---|---|
| Which LLM provider? | **OpenRouter** — single API key, access to all major models | Already fully integrated in the codebase (`@openrouter/ai-sdk-provider`, provider definition, model selector UI). One key gives access to GPT-4o, Claude, Gemini, DeepSeek, Grok, and more. Can switch models without code changes. Several free-tier models available for development |
| Which models specifically? | **Primary:** `openai/gpt-4o-2024-11-20` via OpenRouter (strong function calling). **Cost-saving fallback:** `deepseek/deepseek-chat-v3-0324:free` for development/testing (free, has `tool_use`). **Flexible:** can swap to any model on OpenRouter at runtime via settings | OpenRouter's model list is already configured in `src/shared/providers/definitions/openrouter.ts` with tool_use capabilities flagged |
| How is the API key secured? | **Server-side only.** The OpenRouter API key is stored as an environment variable in the Supabase Edge Function. The browser never sees it. All LLM requests are proxied through the Edge Function, which validates the user's Supabase Auth JWT before forwarding | This is the single biggest security change from the base repo's BYOK model. See the LLM Proxy section below |
| Dynamic tool schemas? | Inject active app tools into system prompt + tools parameter. Only include tools for apps enabled in current session | Avoids context window bloat. Session-scoped tool discovery |
| Context window management? | Serialize app state as compact structured data (FEN for chess, JSON summary for others). Compaction for long conversations | Existing compaction logic in Chatbox can be extended |
| Streaming while waiting for tools? | Show "Invoking [app name]..." with spinner. Stream partial text before/after tool calls. Use AI SDK's `onStepFinish` for tool call detection | Required by UX guidelines. AI SDK supports this natively |

**Why OpenRouter over direct provider APIs:**
- **Already implemented** — `src/shared/providers/definitions/openrouter.ts` defines the provider, `src/shared/providers/definitions/models/openrouter.ts` implements the model class using `createOpenRouter()`. It plugs into the Vercel AI SDK's `streamText` in `stream-text.ts` with zero additional code.
- **One API key, all models** — no need to manage separate OpenAI, Anthropic, and Google API keys. Switch models from the settings UI at runtime.
- **Free models for development** — DeepSeek V3 free and DeepSeek R1 free are available on OpenRouter with tool_use support. Develop and test without spending on LLM calls.
- **Flexibility for grading** — if a grader prefers a specific model or the default is slow, swap in the settings UI without redeploying.
- **Cost transparency** — OpenRouter's dashboard tracks per-model spend automatically, which feeds directly into the AI cost analysis deliverable.

**Options considered:**
- (a) Direct OpenAI API (`@ai-sdk/openai`) → Locks to one provider. Separate API key. No free models for testing. Already in the codebase but less flexible than OpenRouter.
- (b) Direct multi-provider (separate OpenAI + Anthropic + Google keys) → More keys to manage. Each provider's AI SDK adapter has slightly different tool calling behavior. More configuration surface.
- (c) **OpenRouter via `@openrouter/ai-sdk-provider`** → Already integrated. One key. Model-agnostic. Free tier for dev. Runtime-switchable. **Chosen.**
- (d) Local model (Ollama) → Too slow for demo. Function calling support inconsistent across local models.

**LLM Proxy Architecture (Supabase Edge Function):**

The browser cannot hold the OpenRouter API key. Instead:

```
Browser → Supabase Edge Function (llm-proxy) → OpenRouter API
```

1. Browser calls the Edge Function with the chat messages, tool definitions, and model selection
2. Edge Function validates the Supabase Auth JWT (rejects unauthenticated requests)
3. Edge Function attaches the OpenRouter API key from `Deno.env.get('OPENROUTER_API_KEY')`
4. Edge Function forwards the request to OpenRouter and streams the response back to the browser
5. Edge Function enforces per-user rate limits (e.g., 100 requests/hour stored in-memory or in a simple Supabase table)

```typescript
// Supabase Edge Function: supabase/functions/llm-proxy/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader! } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return new Response('Unauthorized', { status: 401 })

  const body = await req.json()
  const openRouterResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return new Response(openRouterResp.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
})
```

**Client-side change:** Override the OpenRouter provider's base URL to point to the Edge Function instead of `openrouter.ai` directly. The Vercel AI SDK's `createOpenRouter()` accepts a `baseURL` parameter — set it to the Edge Function URL. The browser sends requests to the proxy; the proxy adds the API key and forwards.

**Cost-saving strategy with OpenRouter:**
- Use **free models** (DeepSeek V3/R1 free) during development and testing — $0 LLM cost
- Use **GPT-4o** (`openai/gpt-4o-2024-11-20`) via OpenRouter for the demo and grading — best function calling reliability
- OpenRouter pricing passes through the underlying provider's rates (GPT-4o: ~$2.50/1M input, ~$10/1M output) with a small markup
- Track spend via OpenRouter's dashboard for the cost analysis deliverable

**Tool schema injection approach:**
```typescript
// In stream-text.ts, at the existing tool merge point:
// MCP tools are desktop-only and will be empty/absent in the web build.
// ChatBridge app tools are injected via the custom app registry.
const appTools = appRegistry.getToolsForSession(sessionId)
let tools: ToolSet = {
  ...appTools,  // ChatBridge app tools — the primary tool source in the web build
}
```

#### 8. Real-Time Communication

| Question | Decision | Reasoning |
|---|---|---|
| Chat communication | **AI SDK streaming** (existing) — HTTP streaming for LLM responses, proxied through Edge Function | Already works. Proxy adds auth but doesn't change the streaming protocol |
| App-to-platform communication | **postMessage** (parent ↔ iframe) | Only option for cross-origin iframes. Typed message protocol |
| Bidirectional state updates | App sends `state_update` messages; parent stores latest state for LLM context | Parent is source of truth for what LLM sees; app is source of truth for its own UI |
| Reconnection / message ordering | postMessage is synchronous within origin. iframe reload = app re-initialization from last known state | postMessage doesn't drop messages. If iframe crashes, detect via `onError` and offer reload |

**Options considered:**
- (a) WebSocket between app and platform → Requires apps to connect to your server, adds infrastructure. Overkill for iframe communication. Rejected.
- (b) **postMessage for iframe apps** → Natural for the architecture. No additional server needed. **Chosen.**
- (c) SSE from platform to apps → One-directional. Apps can't easily send back. Rejected for app communication (fine for chat streaming).
- (d) SharedWorker as message bus → Complex, browser support varies, unnecessary. Rejected.

**Separate channel for app events:** No. All app ↔ platform communication goes through postMessage on the same window. Events are typed and dispatched by the parent's message handler. This avoids split-brain issues.

#### 9. State Management

| Question | Decision | Reasoning |
|---|---|---|
| Where does chat state live? | **IndexedDB** (primary, instant reads) + **Supabase** (background sync for cross-device) + **Zustand** (client-side runtime) | Local-first: app feels instant. Supabase sync means logging in on a new device pulls your history. See Database & Persistence for full details |
| Where does app state live? | **Inside the iframe** (runtime) + **serialized snapshot in chat messages** (for LLM context) | App owns its state. Platform stores summaries for AI context and session recovery |
| Where does session state live? | **IndexedDB** via existing Chatbox storage layer + Zustand stores, with background Supabase sync | Matches existing session store pattern — the sync layer sits underneath the existing `Storage` interface |
| How merge app context into conversation? | On `state_update` or `completion`, insert a **system-role message** with structured app state summary | LLM sees it naturally in conversation history |
| Persistence across page refreshes? | Active app state lost (iframe reloads). Chat history preserved in IndexedDB (and synced to Supabase). App can re-initialize from last tool invocation args | Acceptable trade-off. Chess position can be restored from FEN in last state_update |
| App state if user closes chat? | App state in messages persists in IndexedDB + Supabase. Live iframe state is lost. On return, app can be re-invoked with last known state | Completion-signaled results are permanent. In-progress state may be lost |

**State flow for chess example:**
1. User: "let's play chess" → LLM calls `chess.start_game` tool
2. Platform renders chess iframe, sends `tool_invocation: start_game`
3. Chess app initializes board, sends `state_update: { fen: "rnbqkbnr/...", turn: "white" }`
4. Platform stores FEN in session context
5. User makes move via chess UI → app sends `state_update: { fen: "...", lastMove: "e2e4" }`
6. User asks "what should I do?" → LLM sees FEN in context, analyzes position
7. Game ends → app sends `completion: { result: "white wins", finalFen: "..." }`
8. Platform marks app as complete, LLM can discuss the game

#### 10. Authentication Architecture

| Question | Decision | Reasoning |
|---|---|---|
| Platform auth before chat? | **Yes — required login** | PDF explicitly requires "User authentication for the chat platform itself" |
| Guest mode? | No — all users authenticated | Simplifies data model. Every session belongs to a user |
| Per-app tokens storage | **Server-side in Supabase** `user_oauth_tokens` table (encrypted at rest). This is the only data that requires a server-side database | PDF: "store tokens securely." Never in localStorage or client-accessible |
| iframe OAuth | **Avoid** — use popup or system browser | Cookies/redirects in iframes are broken by most browsers' tracking prevention. Use `window.open()` popup for web, system browser for Electron |
| Surface auth requirements naturally | LLM tells user: "To use Spotify, you'll need to connect your account. Would you like to do that?" → platform shows OAuth button in chat | Auth is part of the conversation flow, not a settings page detour |

**OAuth flow for authenticated third-party app (e.g., Spotify):**
1. User asks to use Spotify-related feature
2. LLM calls `spotify.create_playlist` tool
3. Platform checks `user_oauth_tokens` for Spotify — not found
4. Platform returns special "auth_required" result to LLM
5. LLM tells user: "You need to connect Spotify first"
6. Platform renders OAuth button in chat message
7. User clicks → popup opens → Spotify OAuth consent → redirect to platform's callback
8. Platform's Edge Function exchanges code for tokens, stores in `user_oauth_tokens`
9. Platform retries the original tool invocation with the new tokens

#### 11. Database & Persistence

**Decision: Local-first with cloud backup. IndexedDB is the primary store (fast, already works). Supabase syncs in the background for cross-device persistence.**

#### Why this approach

Chatbox already has a clean `Storage` interface (6 methods, flat key-value) with platform-specific adapters. The web build uses `IndexedDBStorage` via localforage. All reads and writes go through this interface — sessions stored as `session:{id}` → JSON blob, session list as `chat-sessions-list` → array, settings as `settings` → JSON blob.

Adding Supabase Auth means users have accounts. If auth exists but data is browser-local, logging in on a new device shows empty history — a broken experience. The solution: keep IndexedDB as the fast local layer, add Supabase as a background sync target.

#### How it works

```
Read path:
  1. Read from IndexedDB (instant, ~1ms)
  2. If IndexedDB is empty for this key AND user is authenticated:
     → Fetch from Supabase → populate IndexedDB → return data
  3. Otherwise return IndexedDB result immediately

Write path:
  1. Write to IndexedDB immediately (existing behavior, unchanged)
  2. Fire-and-forget upsert to Supabase in background
     → If network fails, data persists locally; Supabase catches up on next successful write
```

#### Implementation: SupabaseBackedStorage adapter

The existing `Storage` interface makes this a clean adapter swap. `WebPlatform` currently `extends IndexedDBStorage`. The new adapter wraps IndexedDB and adds Supabase sync:

```typescript
class SupabaseBackedStorage extends IndexedDBStorage {
  async getStoreValue(key: string) {
    const local = await super.getStoreValue(key)
    if (local !== null) return local

    // IndexedDB empty — try Supabase (first visit on new device)
    const userId = getCurrentUserId()
    if (!userId) return null
    const { data } = await supabase.from('user_store')
      .select('value').eq('user_id', userId).eq('key', key).single()
    if (data) {
      const parsed = JSON.parse(data.value)
      await super.setStoreValue(key, parsed) // hydrate local cache
      return parsed
    }
    return null
  }

  async setStoreValue(key: string, value: any) {
    await super.setStoreValue(key, value) // IndexedDB first (fast)

    // Background sync to Supabase (fire-and-forget)
    const userId = getCurrentUserId()
    if (userId) {
      supabase.from('user_store').upsert({
        user_id: userId, key, value: JSON.stringify(value)
      }).then(/* log error if any */)
    }
  }
}
```

Then swap one line in `WebPlatform`:
```typescript
// Before:
export default class WebPlatform extends IndexedDBStorage implements Platform {
// After:
export default class WebPlatform extends SupabaseBackedStorage implements Platform {
```

#### Supabase tables

```sql
-- Users managed by Supabase Auth (auth.users — automatic)

-- Key-value cloud backup for chat data (mirrors IndexedDB)
CREATE TABLE user_store (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

-- OAuth tokens for third-party apps (must be server-side for security)
CREATE TABLE user_oauth_tokens (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);
```

Two tables total. `user_store` is a generic key-value mirror of IndexedDB scoped per user. `user_oauth_tokens` holds third-party OAuth credentials that must never live client-side.

#### What does NOT need a table

- **App registry** — the 3 required apps are known at build time. Ship as static TypeScript config.
- **Tool invocation logs** — log to console during dev. Production projections are estimates, not live metrics.

#### Trade-offs and known limitations

| Trade-off | Details | Acceptable for sprint? |
|---|---|---|
| **No conflict resolution** | If a user somehow edits from two devices before sync completes, last write wins. Data from the slower device is silently overwritten | Yes — graders won't test simultaneous multi-device editing. Chat messages are append-only so conflicts are rare |
| **First visit on new device is slower** | IndexedDB is empty → must fetch from Supabase before app is usable. Requires a loading/hydration state | Yes — one-time cost per new device. Show a spinner. Subsequent visits are instant from IndexedDB |
| **Failed background writes are silent** | If network drops between IndexedDB write and Supabase upsert, that data exists only locally until the next successful write | Yes — local copy is always the source of truth. Supabase is best-effort backup. Worst case: user loses cross-device sync for that session, not the data itself |
| **Deletion sync is imperfect** | Deleting a session locally and syncing the deletion to Supabase works (delete the key). But if Device B hasn't synced yet, it still has the old data in IndexedDB and could re-upload it | Yes — edge case requiring two active devices. Not a grading scenario. Could add tombstones later if needed |
| **Auth dependency on reads (new device only)** | Supabase fetch requires a user ID, so the app can't hydrate from cloud until login completes | Yes — login screen shows first anyway. After auth, hydration begins. IndexedDB reads on returning visits don't need auth |
| **Storage overhead** | Data exists in two places (IndexedDB + Supabase). Roughly doubles storage cost | Negligible — chat data is small (KB per session). Supabase free tier has 500MB. Will never hit the limit for this project |

#### Why this is the right balance

- **For the grader:** Log in → chat → close tab → reopen → history is still there (IndexedDB). Log in on a different browser → history syncs from Supabase. Auth and persistence feel cohesive.
- **For the sprint:** The adapter pattern means existing Chatbox code is untouched. No migration, no new read/write layer in the stores. One new class (~50-80 lines) that extends the existing `IndexedDBStorage`.
- **For the requirements:** "Persistent history across sessions" is satisfied by IndexedDB. Cross-device sync is a bonus that makes the auth story coherent rather than a hard requirement.

### Phase 3: Post-Stack Refinement

#### 12. Security & Sandboxing Deep Dive

**Technical sandboxing (what we enforce):**

| Measure | Implementation |
|---|---|
| iframe sandbox | `sandbox="allow-scripts allow-forms"`. No `allow-same-origin`. No `allow-top-navigation` |
| CSP headers | `frame-src` limited to registered app origins. `default-src 'self'`. `script-src 'self'` |
| postMessage origin check | `if (event.origin !== registeredApps[appId].origin) return` on every message handler |
| Prevent parent DOM access | `allow-same-origin` omitted → iframe cannot access `parent.document`. This is the primary isolation mechanism |
| Rate limiting | Per-app: max 60 tool invocations per minute. Per-user: max 200 tool invocations per hour. Enforced client-side via in-memory counter (sufficient for demo; production would add server-side enforcement) |
| Content validation | All postMessage payloads validated against registered schema before processing. Zod validation on both sides |
| Token isolation | Apps never see other apps' OAuth tokens. Tokens passed via tool invocation args, not iframe URL params |
| LLM key isolation | The OpenRouter API key never reaches the browser. All LLM calls are proxied through the Supabase Edge Function, which attaches the key server-side |

**What technical sandboxing prevents:**
- App accessing parent DOM, reading cookies, navigating the parent page, or reaching other iframes
- App reading other users' data or other apps' OAuth tokens
- App triggering popups or top-level navigation (unless explicitly granted for OAuth apps)
- Unauthorized LLM usage (the proxy validates auth JWT before forwarding)

**What technical sandboxing does NOT prevent — the fundamental limitation:**

Cross-origin iframes are opaque to the parent due to the browser's **same-origin policy**. When `allow-same-origin` is omitted (which it must be — otherwise the app can read your entire page), the parent **cannot**:

- Read the iframe's DOM or see what's rendered on screen
- Intercept the iframe's network requests (the app can `fetch` any server)
- Know what JavaScript is executing inside the iframe
- Determine whether the displayed content is appropriate for children

This means a malicious app could:
- Display a valid chess board 99% of the time and inappropriate content 1% of the time — the parent would never know
- Exfiltrate any data passed to it via tool invocations to an external server (sandbox doesn't restrict `fetch`/`XHR` from within the iframe)
- Render ads, manipulative UI, or misleading information around otherwise-correct content

**This is not a limitation of our architecture — it's a fundamental property of cross-origin iframe isolation in browsers.** Every platform that embeds third-party content in iframes (Google Ads, embedded YouTube, Shopify apps) faces the same constraint. The sandbox protects the host from technical attacks; it cannot verify content appropriateness.

**The production answer (not built in this sprint, but the architecture supports it):**

1. **Gated review before listing** — apps submit for review, a human or automated pipeline inspects the source/bundle before the app is added to the allow-list. This is how Apple's App Store, Chrome Web Store, and Shopify's app ecosystem work. It's a process + tooling problem, not a single feature.
2. **Runtime monitoring** — log all postMessage traffic, track which external origins apps contact (via a proxy or reporting API), flag anomalies. Requires an observability pipeline.
3. **Report and takedown** — teachers and students can flag apps. Reports trigger re-review. Fast removal from the allow-list disables the app for all users immediately.
4. **Version pinning** — app manifests include a version. Updates require re-review. The platform loads a pinned version URL, not the app's latest deployment.

For this project: we build all 3 apps ourselves, so the trust problem doesn't exist at runtime. The allow-list is static. The architecture has a clear insertion point for a review gate (the app manifest registration flow), and the technical sandboxing is real and enforced.

**What a malicious registered app can still do (if one somehow got past review):**
- Consume compute in its own iframe (mitigated by user closing it)
- Send many postMessage events (mitigated by rate limiting in the handler)
- Display misleading content within its frame (mitigated by clear visual boundaries labeling the app, and by the review/report/takedown process in production)
- Exfiltrate data passed via tool invocations (mitigated by principle of least privilege — apps only receive the parameters explicitly defined in their tool schema, never chat history or other app data)

#### 13. Error Handling & Resilience

| Scenario | Strategy |
|---|---|
| iframe fails to load | `onError` handler → show "App failed to load" message in chat → LLM informed → suggests retry or alternative |
| Tool call timeout | 30-second default timeout per tool invocation. Configurable per app in manifest. On timeout: cancel, inform LLM with error, show user "The app didn't respond in time" |
| App crashes mid-interaction | `iframe.contentWindow` becomes null or stops responding to ping messages. Detect via heartbeat (send `{ type: 'ping' }` every 10s, expect `{ type: 'pong' }`). On 3 missed pongs: mark app as crashed, inform LLM |
| Invalid tool call by LLM | Validate args against tool's JSON Schema before sending to app. If invalid, return structured error to LLM for self-correction |
| Chatbot refuses unrelated queries | System prompt includes: "Only invoke app tools when the user's request directly relates to the app's functionality. If the request is a general question, respond conversationally without using tools." Test scenario 7 |
| Network failure during OAuth | Retry with exponential backoff. Show "Connection issue, retrying..." toast. OAuth state parameter prevents CSRF on retry |
| LLM proxy Edge Function down | Client detects 5xx or timeout from proxy. Show "Chat service temporarily unavailable" with retry button. Supabase Edge Functions have built-in cold start (~200ms) but are otherwise reliable |

**Circuit breaker pattern:** Track tool invocation success/failure per app in client-side memory over a rolling 5-minute window. If error rate > 50% over 10+ invocations, disable app for that session and inform user. Re-enable on manual retry.

#### 14. Testing Strategy

| Level | Approach |
|---|---|
| **Unit tests** | Tool schema validation, postMessage serialization/deserialization, auth token management. Vitest (already configured) |
| **Plugin interface isolation** | Mock iframe that responds to postMessage with scripted responses. Test registration, invocation, completion, error flows without real apps |
| **Integration tests** | Real chess app + real LLM (or mocked). Verify full lifecycle: invoke → render → interact → complete → context retained |
| **E2E tests** | Playwright: user logs in → starts chat → plays chess → asks for help → switches to weather → returns. Covers testing scenarios 1-7 |
| **LLM proxy tests** | Verify Edge Function rejects unauthenticated requests, passes valid requests through, streams responses correctly |
| **Mock apps** | Build a "echo app" that immediately returns whatever it receives — useful for testing the platform without app-specific logic |

#### 15. Developer Experience

| Aspect | Approach |
|---|---|
| How easy to build an app? | Provide a **ChatBridge SDK** (TypeScript npm package) with: `createApp(manifest)`, `onToolInvocation(handler)`, `sendCompletion(result)`, `sendStateUpdate(state)`. Wraps postMessage protocol |
| Documentation needed | **App Developer Guide**: manifest schema, tool definition format, lifecycle diagram, example apps (chess as reference), message protocol spec |
| Local dev workflow | App developer runs their app on `localhost:3001`. Register with manifest pointing to `http://localhost:3001`. Platform's iframe loads it. Hot reload works naturally |
| Debugging | **Dev panel** (accessible in dev mode) showing: last 50 postMessage events, tool invocation log with args/results/timing, app registration status. Use existing `/dev` route in Chatbox |

#### 16. Deployment & Operations

**How the Chatbox web build works:**

The repo already supports `pnpm build:web`, which sets `CHATBOX_BUILD_PLATFORM=web` and outputs a static SPA to `release/app/dist/renderer/`. This is plain HTML/JS/CSS — no Node.js server required. During development, use `pnpm dev:web` to run the web build with hot reload in a browser.

The web build automatically uses `IndexedDBStorage` for persistence (no Electron IPC). All Electron-specific code paths (system tray, auto-launch, file system, deep links) are excluded or no-oped by platform detection. Additionally, MCP tools and the knowledge base are disabled in the web build via feature flags.

| Question | Decision |
|---|---|
| Platform hosting | **Vercel** — connect GitLab repo, build command `pnpm build:web`, output directory `release/app/dist/renderer/`. Free tier sufficient for demo |
| Backend services | **Supabase** (hosted) — auth + two Edge Functions (LLM proxy + OAuth broker) + two tables (`user_store`, `user_oauth_tokens`). No other backend |
| Where apps are hosted | For the 3 required demo apps: deploy as separate Vercel projects (each is a small React app) with their own URLs. The platform loads them in iframes via their manifest URL |
| CI/CD | GitLab CI: lint → test → `pnpm build:web` → deploy to Vercel on push to main |
| Monitoring | Sentry (already in codebase) for frontend errors. Supabase dashboard for auth metrics and Edge Function logs. Browser dev tools for postMessage debugging |
| App updates without breaking sessions | Manifest includes `version`. Platform loads iframe from app's URL (always latest). If app's tool schema changes, old invocations in history still render with the result that was stored |

**Deployment architecture:**
```
[User Browser]
    │
    ├── [Vercel — ChatBridge SPA (static React build via pnpm build:web)]
    │       │
    │       ├── IndexedDB (primary fast storage — reads/writes happen here first)
    │       ├── App manifests (static config, shipped with build)
    │       └── Chat requests → [Supabase Edge Function: llm-proxy]
    │                               │
    │                               ├── Validates Supabase Auth JWT
    │                               ├── Attaches OpenRouter API key (server-side secret)
    │                               ├── Enforces per-user rate limits
    │                               └── Forwards to [OpenRouter API] → streams response back
    │
    ├── [Supabase Auth] (platform login — "User Auth" requirement)
    │
    ├── [Supabase Postgres]
    │       ├── user_store (background sync of IndexedDB — cross-device persistence)
    │       └── user_oauth_tokens (third-party OAuth credentials)
    │
    ├── [Supabase Edge Function: oauth-broker] (third-party OAuth code exchange + token storage)
    │
    └── [Third-party App iframes (separate Vercel deploys)]
            ├── Chess app (e.g., chess.chatbridge.vercel.app)
            ├── Weather app (e.g., weather.chatbridge.vercel.app)
            └── Spotify app (e.g., spotify.chatbridge.vercel.app)
```

**What the grader experiences:** Visit the Vercel URL → Supabase login screen → chat interface loads (IndexedDB hydrates from Supabase on first visit, instant on return visits) → all chat features work → LLM calls are proxied securely (grader never needs an API key) → apps load in iframes when invoked. Chat history persists across browser sessions and syncs across devices.

---

## Chosen Third-Party Apps

### App 1: Chess (Required)

| Aspect | Details |
|---|---|
| **Type** | Internal (bundled) |
| **Auth** | None |
| **Complexity** | High — ongoing state, bidirectional communication, legal move validation |
| **Tech** | React + chess.js (logic) + chessboard.jsx or react-chessboard (UI) |
| **Tools** | `chess.start_game`, `chess.make_move(move)`, `chess.get_board_state`, `chess.get_legal_moves`, `chess.resign` |
| **UI** | Interactive board rendered in iframe. Click-to-move or drag-and-drop |
| **State** | FEN string serialized to chat context on every move. LLM can analyze position |
| **Completion** | Checkmate, stalemate, resignation → sends `completion` event with result summary |
| **Why it demonstrates the platform** | Complex lifecycle, rich UI, bidirectional state sync, mid-interaction AI analysis |

### App 2: Weather Dashboard

| Aspect | Details |
|---|---|
| **Type** | External (Public) |
| **Auth** | API key (OpenWeatherMap or WeatherAPI) — bundled in the weather app itself or set via environment variable at build time. Not user-specific |
| **Complexity** | Medium — external API call, data visualization, no ongoing state |
| **Tech** | React + weather API + simple chart/card UI |
| **Tools** | `weather.get_current(city)`, `weather.get_forecast(city, days)` |
| **UI** | Card showing temperature, conditions, 5-day forecast with icons |
| **State** | Stateless per invocation. Result cached in chat context |
| **Completion** | Immediate — data fetched and displayed, completion signal sent |
| **Why it demonstrates the platform** | Different pattern from chess: stateless, external API, simple UI, shows app type variety |

### App 3: Spotify Playlist Creator (or GitHub Issue Viewer)

| Aspect | Details |
|---|---|
| **Type** | External (Authenticated) |
| **Auth** | OAuth2 — user must authorize Spotify (or GitHub) access |
| **Complexity** | Medium-High — OAuth flow, external API, user-specific data |
| **Tech** | React + Spotify Web API (or GitHub API) |
| **Tools** | `spotify.search_tracks(query)`, `spotify.create_playlist(name, tracks)`, `spotify.get_playlists` |
| **UI** | Track list with album art, playlist creation form |
| **State** | Playlist state persisted via Spotify API. Search results cached in context |
| **Completion** | Playlist created → sends completion with playlist URL |
| **Why it demonstrates the platform** | OAuth flow end-to-end, token storage, user-specific data, different auth pattern from chess/weather |

**Alternative for App 3 if Spotify OAuth is too complex in 7 days:** GitHub Issue Viewer — GitHub OAuth is simpler, API is more forgiving, and it still demonstrates the authenticated app pattern fully.

---

## Deliverables Checklist

- [ ] **Case Study Analysis** (~500 words) — see above
- [ ] **3-5 min architecture video** — diagram + walkthrough of plugin contract + demo of chess lifecycle
- [ ] **Pre-search document** — this document
- [ ] **Fork pushed to GitLab**
- [ ] **AI cost tracking** — log every API call during dev
- [ ] **Production cost projections** — table with assumptions
- [ ] **Deployed application** — Vercel URL (static SPA from `pnpm build:web`) + Supabase for auth, LLM proxy, chat data sync, and OAuth token storage
- [ ] **3 working apps** — Chess + Weather + Spotify/GitHub
- [ ] **Setup guide** — in GitLab README
- [ ] **API documentation** — App developer guide for the plugin interface
- [ ] **Demo video** (3-5 min) — chat + all 3 apps + lifecycle + architecture
- [ ] **Social post** (final only) — X or LinkedIn, tag @GauntletAI

---

## Key Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| OAuth flow takes too long to implement | Medium | High — blocks App 3 and auth requirement | Start with Supabase Auth for platform. If third-party OAuth is blocked by Saturday, swap Spotify for a simpler authenticated app (GitHub with personal access token input) |
| iframe sandboxing breaks app functionality | Medium | Medium | Test early with a minimal "hello world" iframe. If `allow-same-origin` is needed, add it with strict origin checking and accept the security trade-off for the demo |
| LLM inconsistently invokes tools | Medium | Medium | Strong system prompt engineering with examples. Include tool descriptions that clearly state when each tool should be used. Test with all 7 grading scenarios |
| Chatbox web build doesn't work cleanly | Low-Medium | High — blocks everything | `pnpm dev:web` exists but may have issues (e.g., `postcss.config.cjs` vs `.js` mismatch noted in config). **Test this on Day 1 before anything else.** If broken, fix immediately — the entire project depends on the web build working |
| Context window overflow with multiple apps | Low | Medium | Compact app state aggressively. Chess: FEN string (~80 chars). Weather: JSON summary (~200 chars). Use conversation compaction for long sessions |
| LLM proxy Edge Function adds latency | Low | Low-Medium | Supabase Edge Functions run on Deno Deploy, cold start ~200ms, warm ~50ms. Streaming responses mean first-token latency is what matters. Acceptable for chat UX |
| OpenRouter API key leaked via Edge Function misconfiguration | Low | High — financial exposure | Store key only in `Deno.env` (Supabase secrets). Never log the key. Never return it in error responses. Set OpenRouter spend limits as a safety net |
| MCP-dependent features assumed to work in web build | Medium | Medium | Explicitly flag MCP and knowledge base as desktop-only. Do not plan any feature that depends on MCP runtime. Build custom app tool registry from scratch |
