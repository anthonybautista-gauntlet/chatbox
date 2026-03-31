# Planning Checklist

Complete this before writing code. The goal is to make an informed decision about all relevant aspects of the project with defensible trade-offs.

## Case Study Analysis

The scenario asks for an AI chat platform where third-party apps run inside conversations and the AI stays aware of what those apps are doing. After reviewing the Chatbox codebase we are building on, the gap between what exists and what needs to be built is larger than expected.

Chatbox has a plugin system (MCP), an iframe renderer (Artifact.tsx), and multi-provider LLM integration with tool calling. That sounds like most of the work is already done. It is not. MCP is gated behind a desktop-only feature flag and does not run in the web build we need to deploy. Artifact.tsx posts messages with `targetOrigin='*'`, has no structured protocol, and was designed to preview HTML snippets, not to host untrusted third-party apps. The LLM providers store API keys client-side, which works for a local desktop app where each user enters their own key, but becomes a real vulnerability once you deploy a shared platform to a public URL. Plugin availability, iframe security, and key management all need to be replaced, not extended.

Security breaks into two separate layers. Technical isolation means preventing an embedded app from reading the parent page, stealing tokens, or redirecting the user. Strict iframe sandboxing handles that. Content verification is different, and harder. Cross-origin iframes are opaque by design. The browser's same-origin policy means the parent cannot inspect what an app renders. An app that passed review could later serve different content, and the platform would never detect it. Solving marketplace trust fully requires review gates, version pinning, and reporting on top of the sandbox. That is a process and tooling problem that does not fit in a one-week sprint. What does fit is the technical foundation: strict isolation, scoped data access, and a registration model where a review gate can be inserted later.

The third problem is state coherence between the chat and the app. The AI needs to know what an app is doing to answer follow-up questions, but the app controls its own state. Without typed messages, completion signals, and compact state summaries flowing through a structured protocol, the conversation either loses context or the token window fills up with verbose state dumps. Chatbox already has the right tool-call message schema (call, result, and error states defined in its Zod types) and a merge point in `stream-text.ts` where tools are injected before each LLM call. That part is reusable. The missing piece is the contract layer on top: app manifests, lifecycle events, timeout handling, and translation of postMessage events into conversation context.

There is also an ethical question about scope control. In a K-12 environment, someone has to decide what apps a student can access. For this sprint, we avoid the open marketplace problem entirely by building all three apps ourselves and shipping a static allow-list. The architecture has room for a review gate later, but content moderation is out of scope for seven days.

Our plan is a local-first web app deployed to a public URL. The LLM key is secured behind a server-side proxy. Authentication goes through a managed service. A custom tool registry replaces the desktop-only MCP runtime. Chatbox gives us streaming chat, tool-call schemas, IndexedDB persistence, and a provider abstraction. Platform auth, secure key storage, app sandboxing, and a lifecycle protocol are what we have to build.

---

## Phase 1: Define Your Constraints

### 1. Scale & Load Profile

**Users at launch? In 6 months?**

At launch: 5–20 users (graders and classmates). This is a class project evaluated during grading windows. In 6 months: design for up to 1,000 users but do not over-engineer. The architecture should support growth (Supabase scales, Vercel handles static traffic natively) without building infrastructure we don't need yet — no Kubernetes, no sharding, no multi-region. Show awareness of future scale in the write-up without spending sprint time on it.

**Traffic pattern: steady, spiky, or unpredictable?**

Spiky. Traffic concentrates around grading windows when multiple reviewers test simultaneously. The static SPA on Vercel handles spiky frontend traffic natively (CDN-served). The Supabase Edge Functions (LLM proxy, OAuth broker) auto-scale on Deno Deploy. The real bottleneck under spike is OpenRouter API rate limits, not our infrastructure. Graceful degradation: if the LLM proxy is overloaded, show "Chat service is busy, retrying..." with a retry button rather than crashing silently.

**How many concurrent app sessions per user?**

One active app at a time per chat session. Multiple apps can exist in the conversation history, but only one iframe renders at a time. The PDF's testing scenario 5 says "switches between" apps, not "uses simultaneously." This simplifies state management enormously — we track one active iframe, one pending tool invocation, and one app context block. When the user invokes a new app, the previous app's iframe is unmounted (its last state is preserved in chat messages as a completion or state_update).

**Cold start tolerance for app loading?**

2–3 seconds is acceptable for iframe load. Apps are separate Vercel deployments — first load includes DNS + TLS + bundle download. Mitigation: show a loading skeleton inside the chat message immediately when a tool with `uiTrigger: true` is invoked. The skeleton transitions to the live app once the iframe fires its `ready` postMessage. Users tolerate this delay for rich interactive content (similar to embedded maps or videos). Subsequent loads of the same app in the same session are near-instant due to browser caching.

---

### 2. Budget & Cost Ceiling

**Monthly spend limit?**

$50–100 during development. Student budget. Infrastructure cost during dev and demo: effectively $0. Supabase free tier covers auth, two Postgres tables, and Edge Functions (500K invocations/month). Vercel free tier covers static hosting. The primary expense is LLM API calls through OpenRouter. Free DeepSeek models keep development costs at $0. GPT-4o via OpenRouter for demo/grading is the only real cost — estimated at $5–15 for the entire grading period based on typical usage patterns.

**Pay-per-use acceptable or need fixed costs?**

Pay-per-use for LLM calls (OpenRouter charges per token). Fixed $0 for infrastructure during development (Supabase free tier + Vercel free tier). This is ideal — we pay only for what we use during testing, and infrastructure costs nothing until we exceed free tier limits (which won't happen at demo scale). At production scale, Supabase Pro ($25/mo) and Vercel Pro ($20/mo) are fixed costs; LLM remains pay-per-use.

**LLM cost per tool invocation acceptable range?**

$0 during development (free DeepSeek models via OpenRouter). $0.01–0.05 per tool invocation in production using GPT-4o via OpenRouter (~$2.50/1M input tokens, ~$10/1M output tokens). A typical tool invocation round-trip (system prompt + conversation context + tool call + result injection) consumes ~1,000–2,000 tokens, costing roughly $0.01–0.03. This is well within budget for demo scale. At 100K users, aggressive caching, conversation compaction, and smaller routing models bring per-invocation cost down.

**Where will you trade money for time?**

Pre-built auth over custom auth. Supabase Auth handles password hashing, token rotation, social providers, and session management — things that would take days to build correctly and securely from scratch. Auth is not the differentiator; the plugin system is. Similarly, Supabase Edge Functions over a standalone Express server — one deployment target, no infra management, no Docker. The time saved goes directly into the app integration lifecycle, which is the core engineering challenge.

---

### 3. Time to Ship

**MVP timeline?**

24 hours (hard gate). The MVP deliverables are: this planning checklist, the pre-search document (PRESEARCH2.md with case study analysis), and a 3–5 minute architecture video. No code is required for the MVP gate, but verifying that `pnpm dev:web` works is Day 1 priority to de-risk the rest of the sprint.

**Speed-to-market vs. long-term maintainability priority?**

Speed first, refactor Friday through Sunday. The sprint plan:

| Day | Focus | Deliverable |
|---|---|---|
| Mon (Day 1) | Pre-search + architecture design | Planning docs + architecture video |
| Tue (Day 2) | Verify `pnpm dev:web` + Supabase Auth + LLM proxy Edge Function + app contract | Chat works in browser with login gate, LLM calls proxied securely |
| Wed (Day 3) | Chess app: registration → invocation → UI → state → completion | Chess fully integrated E2E |
| Thu (Day 4) | Apps 2 + 3 (weather + one OAuth app) | Three apps working |
| Fri (Day 5) | Early submission: polish, error handling, multi-app routing | Early submission |
| Sat (Day 6) | OAuth flow polish, deployment, developer docs | Deployed + documented |
| Sun (Day 7) | Final polish, demo video, cost analysis, social post | Final submission |

Vertical slice by Wednesday (chess end-to-end), breadth by Friday (3 apps), polish by Sunday.

**Iteration cadence after launch?**

Daily milestones during the sprint. Post-submission: no further iteration planned — this is a class project with a fixed deadline. However, the architecture (static manifests, adapter-pattern storage, Edge Function proxy) is designed so each piece can be swapped or extended independently if future work is needed.

---

### 4. Security & Sandboxing

**How will you isolate third-party app code?**

iframe with strict sandbox attributes: `sandbox="allow-scripts allow-forms"`. Critically, `allow-same-origin` is **omitted** — this prevents the iframe from accessing `parent.document`, reading cookies, or reaching other iframes. `allow-top-navigation` is omitted to prevent the app from redirecting the entire page. `allow-popups` is granted only for authenticated app types that need OAuth popup flows. All communication between the parent and iframe uses typed postMessage with origin verification on every message (`event.origin === registeredApps[appId].origin`).

**What happens if a malicious app is registered?**

For this project: it can't happen. We build all 3 apps ourselves, and the app registry is a static TypeScript config shipped with the build — there is no open registration endpoint. The allow-list is hardcoded.

For production: the hard problem is that cross-origin iframes are fundamentally opaque to the parent (same-origin policy). The platform cannot inspect what the app renders, so content verification is impossible at runtime. The production answer is layered defense: (1) gated human/automated review before listing, (2) version pinning so updates require re-review, (3) scoped permissions limiting what data each app receives, (4) report-and-takedown for issues that slip through. The architecture has a clear insertion point for a review gate in the manifest registration flow.

**Content Security Policy requirements?**

`frame-src` restricted to registered app origins only (e.g., `frame-src chess.chatbridge.vercel.app weather.chatbridge.vercel.app spotify.chatbridge.vercel.app`). `default-src 'self'`. `script-src 'self'` (no inline scripts in the parent). `connect-src` includes the Supabase project URL and the Edge Function endpoints. This prevents clickjacking, XSS via injected scripts, and unauthorized iframe sources.

**Data privacy between apps and chat context?**

Apps receive ONLY the data explicitly passed via tool invocation parameters as defined in their tool schema. An app never receives: chat history, other apps' state, other apps' OAuth tokens, or the user's Supabase session token. The postMessage protocol enforces this — the parent only sends `tool_invocation` messages with the parameters the LLM generated for that specific tool. OAuth tokens for authenticated apps are passed as part of the tool invocation args by the platform (retrieved from the server-side `user_oauth_tokens` table), never stored or visible client-side.

---

### 5. Team & Skill Constraints

**Solo or team?**

Solo. This is a project constraint.

**Languages/frameworks you know well?**

TypeScript, React, Node.js. The existing Chatbox codebase uses TypeScript + React + Vite + Tailwind + Mantine + MUI + TanStack Router/Query, which aligns well. Supabase Edge Functions use Deno/TypeScript, so no language switch is needed. Decision: TypeScript-only stack throughout. No Python, no separate backend language.

**Experience with iframe/postMessage communication?**

Limited, but learnable. The Chatbox codebase includes `Artifact.tsx`, which renders HTML in a sandboxed iframe and uses postMessage — this is a useful conceptual reference, though the actual implementation has security issues (`targetOrigin='*'`, no message protocol, no lifecycle management) and must be rebuilt. The postMessage API itself is straightforward (MDN docs, well-documented). The complexity is in designing the typed message protocol and handling edge cases (timeouts, crashes, out-of-order messages).

**Familiarity with OAuth2 flows?**

Moderate. Conceptual understanding of authorization code + PKCE flow, token refresh, and scoped permissions. Supabase Auth abstracts platform OAuth (login with Google/GitHub). For third-party app OAuth (e.g., Spotify), the Supabase Edge Function handles the code exchange server-side — the browser only sees a popup redirect, never touches the tokens directly. The Chatbox codebase has reusable patterns: `useLogin.ts` (browser-based login + polling), `remote.ts` (authenticated fetch with auto-refresh on 401), and `authInfoStore.ts` (persistent token storage with Zustand).

---

## Phase 2: Architecture Discovery

### 6. Plugin Architecture

**Iframe-based vs web component vs server-side rendering?**

Iframe-based. This is the only option that provides true security isolation for untrusted third-party code. Web Components run in the same origin as the parent, so a malicious component can access `document`, `localStorage`, and the parent's DOM — disqualified for third-party apps. Server-side rendering adds latency and infrastructure complexity (a rendering server) that is not justified for this project. Iframes with strict sandbox attributes (`allow-scripts allow-forms`, no `allow-same-origin`) are the industry standard for embedding third-party content (used by Google Ads, Shopify apps, embedded YouTube). Each app is a standalone React app deployed to its own Vercel project, loaded in an iframe when invoked.

**How will apps register their tool schemas?**

Static TypeScript manifest files shipped with the platform build. Each app has an `AppManifest` object defining its `id`, `name`, `version`, `type` (internal / external_public / external_authenticated), `url` (iframe source), `tools` array (with name, description, parameters JSON schema, return JSON schema, and `uiTrigger` boolean), optional `auth` config (OAuth URLs and scopes), `permissions`, and `completionSignals`. The 3 required apps are known at build time — no dynamic registration API or database table is needed. The manifests are imported at startup and registered with the app tool registry.

**Message passing protocol (postMessage, custom events, WebSocket)?**

postMessage — the only option for cross-origin iframe communication. Custom events don't cross iframe boundaries. WebSockets would require apps to connect to our server, adding unnecessary infrastructure. The protocol is typed:

- Parent → App: `tool_invocation` (with toolName, args, invocationId), `context_request`
- App → Parent: `tool_result` (with invocationId, result), `completion` (summary + optional data), `state_update` (serialized app state for LLM context), `error` (code + message)

Every message is validated against the registered schema using Zod before processing. Origin is checked on every `message` event handler: `if (event.origin !== registeredApps[appId].origin) return`.

**How does the chatbot discover available tools at runtime?**

On session start, the app tool registry loads all enabled app manifests and converts their `ToolDefinition` arrays into Vercel AI SDK-compatible tool format. These tools are merged into the `ToolSet` in `stream-text.ts` at the same merge point where MCP tools would go on desktop (note: MCP is desktop-only per `feature-flags.ts` and is not available in our web build — we replace it with our custom registry). The LLM sees tool names, descriptions, and parameter schemas in its function-calling context and decides which to invoke. Tools are namespaced by app ID (e.g., `chess.start_game`, `weather.get_current`) to avoid collisions and enable routing.

---

### 7. LLM & Function Calling

**Which LLM provider for function calling?**

OpenRouter — a single API key that provides access to all major models (GPT-4o, Claude, Gemini, DeepSeek, Grok, and more). It is already fully integrated in the codebase: `@openrouter/ai-sdk-provider` in `package.json`, provider definition in `src/shared/providers/definitions/openrouter.ts`, model implementation in `src/shared/providers/definitions/models/openrouter.ts` using `createOpenRouter()`, and model selector in the settings UI. One key, all models, runtime-switchable.

Primary model: GPT 4o via OpenRouter — strongest function calling reliability. Development fallback: Deepseek — free, has tool_use support, $0 cost during development.

**Critical: API key security.** The OpenRouter API key is NOT stored client-side. It lives exclusively in a Supabase Edge Function environment variable. All LLM requests from the browser are proxied through the Edge Function (`llm-proxy`), which validates the user's Supabase Auth JWT, attaches the API key server-side, forwards to OpenRouter, and streams the response back. The browser never sees the key.

**How will dynamic tool schemas be injected into the system prompt?**

Active app tools are converted from `ToolDefinition` (our manifest format) to Vercel AI SDK tool format and merged into the `ToolSet` object passed to `streamText()`. Only tools for apps enabled in the current session are included — this avoids context window bloat. The system prompt is augmented with a brief description of available apps and their purposes, so the LLM understands when to use each tool. Tool schemas (parameters/returns) are passed via the AI SDK's native tool mechanism, not manually injected into the prompt text.

**Context window management with multiple app schemas?**

Compact app state aggressively. Chess state is serialized as a FEN string (~80 characters) rather than a full move history. Weather data as a JSON summary (~200 characters). The system prompt includes only the tool schemas for currently-enabled apps (typically 5–15 tools across 3 apps — well within any model's context window). Conversation compaction is already implemented in Chatbox for long conversations and can be extended. If a conversation spans many app interactions, older app state summaries are summarized further or truncated, keeping the context window focused on the most recent and relevant information.

**Streaming responses while waiting for tool results?**

The Vercel AI SDK natively supports streaming with interleaved tool calls. When the LLM decides to invoke a tool, the AI SDK fires `onStepFinish`. The platform detects the tool call, shows "Invoking [app name]..." with a spinner in the chat UI, sends the `tool_invocation` postMessage to the app's iframe, waits for the `tool_result` response, and injects the result back into the conversation. The LLM then continues generating text that references the tool result. Partial text before and after tool calls is streamed to the user in real-time. If the tool takes more than a few seconds, a progress indicator keeps the user informed.

---

### 8. Real-Time Communication

**WebSocket vs SSE vs polling for chat?**

AI SDK streaming (HTTP streaming / SSE) for chat — this is what Chatbox already uses and it works. The Vercel AI SDK's `streamText` function returns a streaming response that the client consumes as an async iterable. Adding the LLM proxy Edge Function doesn't change the streaming protocol — the Edge Function streams the OpenRouter response body directly to the browser. No WebSocket server needed. No polling.

**Separate channel for app-to-platform communication?**

No. All app ↔ platform communication goes through postMessage on the same window. Events are typed and dispatched by the parent's message handler. A separate channel (WebSocket, SSE) would require apps to connect to our server, adding infrastructure and authentication complexity. postMessage is synchronous within origin, doesn't drop messages, and is the natural communication mechanism for iframes. Using one channel avoids split-brain issues where app state diverges between two communication paths.

**How do you handle bidirectional state updates?**

The app owns its runtime state (e.g., the chess board position). The platform stores compact summaries for LLM context. When the app's state changes, it sends a `state_update` postMessage with serialized state (e.g., `{ fen: "rnbqkbnr/...", turn: "white", lastMove: "e2e4" }`). The parent stores this in the session context and includes it in the next LLM call so the AI can reason about app state. The parent never modifies app state directly — it only sends `tool_invocation` messages that the app handles. This clear ownership model prevents conflicts: the app is the source of truth for its UI, the platform is the source of truth for what the LLM sees.

**Reconnection and message ordering guarantees?**

postMessage is synchronous within origin and doesn't drop messages while the iframe is alive. If the iframe crashes (detected via heartbeat — send `{ type: 'ping' }` every 10 seconds, expect `{ type: 'pong' }`; after 3 missed pongs, mark as crashed), the platform shows an error message in the chat and offers to reload the app. On reload, the app re-initializes from the last tool invocation args (e.g., the chess app restores from the last known FEN string). For the chat streaming connection, the AI SDK handles reconnection natively. If the Edge Function proxy times out, the client retries with exponential backoff.

---

### 9. State Management

**Where does chat state live? App state? Session state?**

Chat state: **IndexedDB** (primary, instant reads) + **Supabase** (background sync for cross-device persistence) + **Zustand** (client-side runtime cache). IndexedDB is the local-first store — reads happen instantly without network. Supabase syncs in the background so users see their history when logging in on a new device. Zustand holds the in-memory working state for React components.

App state: **Inside the iframe** at runtime (app owns its state) + **serialized snapshots in chat messages** (for LLM context and recovery). The platform stores compact state summaries sent via `state_update` postMessages. These persist in IndexedDB as part of the message history.

Session state: **IndexedDB** via the existing Chatbox `Storage` interface + Zustand stores, with background Supabase sync. The new `SupabaseBackedStorage` adapter extends `IndexedDBStorage` to add transparent cloud sync without changing any existing store code.

**How do you merge app context back into conversation history?**

On `state_update` or `completion` postMessage from an app, the platform inserts a system-role message into the conversation with a structured summary of the app state. For example, after a chess move: `[System: Chess app state — FEN: rnbqkbnr/..., Turn: black, Last move: e2e4]`. The LLM sees this naturally in the conversation history on the next turn, so it can answer questions like "what should I do here?" with full awareness of the board position. On `completion`, the summary includes the final outcome (e.g., "White wins by checkmate") and the app is marked as inactive.

**State persistence across page refreshes?**

Chat history: fully preserved in IndexedDB (survives refresh, tab close, browser restart) and synced to Supabase (survives device change). Active iframe state: lost on refresh (iframe reloads from scratch). The app can re-initialize from the last tool invocation args or state_update stored in the chat messages. For chess, this means the board position is restored from the last FEN string — the game continues seamlessly. For stateless apps like weather, there's nothing to restore; the result is already in the chat history.

**What happens to the app state if the user closes the chat?**

Completion-signaled results are permanent — they're stored as messages in IndexedDB and synced to Supabase. The chat history including all app results, state updates, and completion summaries persists indefinitely. Live iframe state (the app's in-memory runtime state) is lost when the iframe is destroyed. On return, the user sees the full conversation including all app interactions. If they want to use the app again, they invoke it fresh, and the app can optionally re-initialize from the last known state stored in the conversation.

---

### 10. Authentication Architecture

**Platform auth vs per-app auth?**

Both, as the PDF requires. Platform auth is mandatory ("User authentication for the chat platform itself") — handled by Supabase Auth (email/password, social OAuth). Per-app auth is required for at least one third-party app — handled by a Supabase Edge Function acting as an OAuth broker. These are separate concerns: platform auth gates access to the chat; per-app auth authorizes the user with external services (Spotify, GitHub) when an authenticated app's tools are invoked.

**Token storage and refresh strategy?**

Platform tokens (Supabase Auth): managed by `@supabase/supabase-js` client library, which handles JWT storage, automatic refresh, and session persistence. Wraps the existing `authInfoStore` pattern.

Third-party OAuth tokens (Spotify, GitHub): stored server-side ONLY in the `user_oauth_tokens` Supabase Postgres table (encrypted at rest). Never sent to the browser or stored in localStorage/IndexedDB. When a tool invocation requires OAuth credentials, the platform's Edge Function retrieves the token from the database, passes it to the app via the tool invocation args, and refreshes it automatically if expired (using the stored refresh_token).

OpenRouter API key: stored ONLY in the Supabase Edge Function environment variable (`Deno.env.get('OPENROUTER_API_KEY')`). Never in the browser bundle, never in client-accessible storage. The LLM proxy Edge Function attaches it server-side on every request.

**OAuth redirect handling within iframe context?**

Avoid OAuth inside iframes — cookies and redirects in iframes are broken by most browsers' tracking prevention (ITP in Safari, third-party cookie blocking in Chrome). Instead, use `window.open()` to open a popup for the OAuth consent screen. The flow: user clicks "Connect Spotify" button in chat → popup opens to the Supabase Edge Function's OAuth initiation endpoint → user consents on Spotify → redirect back to the Edge Function callback → Edge Function exchanges code for tokens, stores in `user_oauth_tokens` → popup closes → parent window detects closure (or receives a postMessage from the popup) → platform retries the original tool invocation with the new credentials.

**How do you surface auth requirements to the user naturally?**

Auth is part of the conversation flow, not a settings page detour. When the LLM calls a tool for an authenticated app and the user hasn't connected that service yet, the platform returns an `auth_required` result to the LLM. The LLM responds naturally: "To create a Spotify playlist, you'll need to connect your Spotify account first. Would you like to do that?" The platform renders an OAuth button inline in the chat message. The user clicks, completes the flow in a popup, and the platform automatically retries the original tool call. The user never leaves the conversation.

---

### 11. Database & Persistence

**Schema design for conversations, app registrations, sessions?**

Conversations and sessions: stored in IndexedDB using Chatbox's existing key-value storage pattern (session list as `chat-sessions-list` → JSON array, individual sessions as `session:{id}` → JSON blob). The `SupabaseBackedStorage` adapter transparently syncs these to a Supabase `user_store` table (key-value: `user_id`, `key`, `value` as JSONB, `updated_at`). No relational schema for chat data — the existing flat key-value model works and requires no migration.

App registrations: static TypeScript config files, not in a database. The 3 apps are known at build time. No registration table.

OAuth tokens: one Supabase table — `user_oauth_tokens` with columns `user_id` (UUID, FK to `auth.users`), `app_id` (TEXT), `access_token` (TEXT), `refresh_token` (TEXT, nullable), `expires_at` (TIMESTAMPTZ), `scopes` (TEXT[]), and timestamps. Primary key: `(user_id, app_id)`.

Two tables total: `user_store` (IndexedDB sync) and `user_oauth_tokens` (third-party credentials).

**How do you store tool invocation history?**

Tool invocations are stored as part of the conversation messages in IndexedDB (and synced to Supabase via the `user_store` table). Each tool call becomes a `tool-call` content part in the message (using the existing Zod schema in `src/shared/types/session.ts` which already supports `call`, `result`, and `error` states). This means tool invocation history is automatically persistent, searchable within the conversation, and visible in the chat UI. No separate invocation log table is needed. For the AI cost analysis, development-time invocation counts are tracked via OpenRouter's dashboard (which logs every API call with model, tokens, and cost).

**Read/write patterns and indexing strategy?**

Reads: local-first from IndexedDB (~1ms). On a new device with empty IndexedDB, the first read falls through to Supabase to hydrate the local store, then all subsequent reads are local. This is a one-time cost per new device.

Writes: IndexedDB immediately (preserving existing Chatbox write behavior), then fire-and-forget upsert to Supabase in the background. If the network fails, data persists locally and Supabase catches up on the next successful write.

Indexing: the `user_store` table is indexed on `(user_id, key)` (its primary key), which covers all lookup patterns. The `user_oauth_tokens` table is indexed on `(user_id, app_id)` (its primary key). No additional indexes needed at demo scale.

**Backup and disaster recovery?**

Data lives in two places by design: IndexedDB (browser-local) and Supabase Postgres (cloud). If Supabase goes down, the app continues working from IndexedDB — users won't notice unless they try to log in on a new device. If IndexedDB is cleared (browser data reset), the app re-hydrates from Supabase on next login. Supabase provides automatic daily backups on the Pro plan; on the free tier, the `user_store` data is a mirror of IndexedDB, so the browser itself is the backup. OAuth tokens in `user_oauth_tokens` are the only data that exists solely in Supabase — if lost, users simply re-authorize the third-party service.

---

## Phase 3: Post-Stack Refinement

### 12. Security & Sandboxing Deep Dive

**Iframe sandbox attributes (allow-scripts, allow-same-origin)?**

`sandbox="allow-scripts allow-forms"`. Critically, `allow-same-origin` is **NOT** included — this is the primary isolation mechanism. Without `allow-same-origin`, the iframe cannot access `parent.document`, cannot read cookies or localStorage from the parent origin, and cannot reach other iframes. `allow-scripts` is required for apps to function (React apps need JavaScript). `allow-forms` is included for apps that use form submissions (e.g., playlist creation). `allow-top-navigation` is excluded to prevent apps from redirecting the parent page. `allow-popups` is granted only for authenticated app types that need OAuth popup flows (e.g., Spotify).

**CSP headers for embedded content?**

Platform CSP: `frame-src` limited to the specific registered app origins. `default-src 'self'`. `script-src 'self'`. `connect-src 'self' https://*.supabase.co` (for auth and Edge Functions). `style-src 'self' 'unsafe-inline'` (Mantine and MUI use inline styles). This prevents unknown origins from being embedded, prevents XSS via script injection, and limits network connections to known endpoints. Each app sets its own CSP independently (they're separate deployments), but the parent's `frame-src` is the gatekeeper.

**Preventing apps from accessing parent DOM?**

Omitting `allow-same-origin` from the sandbox attribute is the primary defense — the iframe runs in a unique opaque origin and has zero access to `parent.document`, `parent.localStorage`, `parent.cookies`, or any other same-origin resource. Additionally, the postMessage handler on the parent side validates `event.origin` against the registered app's expected origin before processing any message, preventing spoofed messages from other sources. The parent never exposes its DOM, session tokens, or internal state via postMessage — it only sends structured `tool_invocation` data with the minimal required parameters.

**Rate limiting per app and per user?**

Client-side enforcement for demo: per-app max 60 tool invocations per minute, per-user max 200 tool invocations per hour, tracked in an in-memory counter. If exceeded, the platform returns a "rate limit exceeded" error to the LLM and shows the user a brief message. The LLM proxy Edge Function provides a second layer: it validates the Supabase Auth JWT and can enforce per-user request limits (e.g., 100 LLM calls per hour) before forwarding to OpenRouter. Production would add server-side per-app rate limiting via a Redis counter or Supabase table, but client-side enforcement is sufficient for the demo.

---

### 13. Error Handling & Resilience

**What happens when an app's iframe fails to load?**

The iframe's `onError` handler fires. The platform shows an "App failed to load" message in the chat, informs the LLM via a structured error result (`{ type: 'error', code: 'LOAD_FAILED', message: 'Chess app failed to load' }`), and the LLM responds naturally: "It looks like the chess app isn't loading right now. Would you like to try again?" The user can retry (platform re-renders the iframe) or continue chatting without the app. Common causes: app's Vercel deployment is down, network issue, or CSP blocking. The error message includes a "Retry" button for user convenience.

**Timeout strategy for async tool calls?**

30-second default timeout per tool invocation, configurable per app in the manifest. When a `tool_invocation` postMessage is sent to the app, a timer starts. If no `tool_result` or `state_update` is received within the timeout, the platform cancels the invocation, sends a timeout error to the LLM (`{ type: 'error', code: 'TIMEOUT', message: 'App did not respond in time' }`), and shows the user "The app didn't respond in time." The LLM can suggest a retry or offer an alternative. For the LLM proxy Edge Function, the Supabase Edge Function's 150-second wall-clock limit is the outer bound — streaming responses start within seconds, so this is rarely hit.

**How does the chatbot recover from a failed app interaction?**

The platform sends a structured error result to the LLM, which handles it conversationally: "I ran into an issue with the chess app. Would you like me to try again, or is there something else I can help with?" The conversation continues normally — the error is just another message in the history. If the user retries, the platform re-invokes the tool. If the app is consistently failing, the circuit breaker pattern kicks in (see below). The key principle: app failures never crash the chat. The platform always recovers to a conversational state.

**Circuit breaker patterns for unreliable apps?**

Track tool invocation success/failure per app in client-side memory over a rolling 5-minute window. If the error rate exceeds 50% over 10+ invocations, the circuit breaker opens: the app is disabled for that session, the LLM is informed ("The chess app is currently unavailable"), and the user sees a message explaining the issue. The user can manually re-enable the app via a "Try again" button, which resets the circuit breaker. This prevents an infinite loop of failed invocations consuming LLM tokens and frustrating the user.

---

### 14. Testing Strategy

**How do you test the plugin interface in isolation?**

Build a mock iframe "echo app" that immediately returns whatever it receives as the tool result. This lets us test the full platform lifecycle (registration → tool discovery → invocation → postMessage → result injection → LLM context update) without depending on any real app's logic. Use Vitest (already configured in the repo) for unit tests of: tool schema validation (Zod), postMessage serialization/deserialization, origin verification logic, timeout handling, and circuit breaker state transitions. The mock app runs on localhost during testing.

**Mock apps for integration testing?**

Yes. Three levels: (1) The echo app for platform-level testing (returns structured responses immediately). (2) A "slow app" that responds after configurable delays (tests timeout handling and loading states). (3) A "broken app" that sends malformed messages or doesn't respond at all (tests error handling and circuit breaker). These mock apps are simple HTML files served locally — no build step needed. Integration tests verify that the platform handles all three gracefully.

**End-to-end testing of full invocation lifecycle?**

Playwright E2E tests covering the 7 grading scenarios: (1) User asks chatbot to use an app → tool discovery and invocation. (2) App UI renders in chat. (3) User interacts with app, returns to chatbot → completion signaling. (4) User asks about app results → context retention. (5) User switches between apps. (6) Ambiguous question → correct routing. (7) Chatbot refuses unrelated queries. Each test logs in via Supabase Auth, sends messages, waits for streaming responses, interacts with the app iframe, and verifies the chat state.

**Load testing with multiple concurrent app sessions?**

Not critical for demo scale (5–20 users). If needed: k6 scripts targeting the LLM proxy Edge Function to measure request throughput, latency under concurrency, and token consumption rates. The bottleneck is OpenRouter's API rate limits, not our infrastructure. Supabase Edge Functions auto-scale on Deno Deploy. Vercel's CDN handles static asset concurrency natively. For the cost analysis deliverable, we extrapolate from per-request measurements rather than running full load tests.

---

### 15. Developer Experience

**How easy is it for a third-party developer to build an app?**

Straightforward. An app is a standalone web app (any framework — React, Vue, Svelte, plain HTML/JS) that implements the ChatBridge postMessage protocol. The developer: (1) creates a web app with a UI, (2) includes the ChatBridge SDK (a lightweight TypeScript package wrapping the postMessage protocol), (3) defines tools and handlers using the SDK's `createApp(manifest)`, `onToolInvocation(handler)`, `sendCompletion(result)`, and `sendStateUpdate(state)` functions, (4) deploys their app to any hosting provider, and (5) registers it by adding a manifest entry to the platform config. The SDK abstracts away postMessage serialization, origin handling, and protocol compliance.

**What documentation do they need?**

An App Developer Guide covering: (1) the manifest schema (all fields, types, and what each does), (2) the tool definition format (name, description, parameters JSON schema, returns schema, uiTrigger), (3) a lifecycle diagram showing the full flow from registration to completion, (4) the postMessage protocol spec (all message types, fields, and validation rules), (5) example apps (chess as the full reference implementation, echo app as a minimal starter), (6) authentication guide for apps that need OAuth, and (7) common pitfalls (e.g., don't use `allow-same-origin`, handle timeouts, send `completion` when done).

**Local development and testing workflow for app developers?**

The app developer runs their app on `localhost:3001` (or any port). They add a manifest entry pointing to `http://localhost:3001` in the platform's dev config. The platform's iframe loads it directly. Hot reload works naturally — the app developer makes changes, the iframe content updates on save. The platform's dev panel (accessible in dev mode) shows the last 50 postMessage events, tool invocation log with args/results/timing, and app registration status, making it easy to debug communication issues without opening browser DevTools.

**Debugging tools for tool invocation failures?**

A dev panel accessible via the existing `/dev` route in Chatbox, showing: (1) a real-time log of all postMessage events (sent and received) with timestamps, app IDs, and payload contents, (2) a tool invocation timeline showing each invocation's lifecycle (sent → pending → result/error/timeout) with timing, (3) app registration status (which apps are loaded, their health status, circuit breaker state), and (4) the current LLM context (what tool schemas are injected, what app state summaries are in the conversation). In production, this panel is hidden. During development, it's the primary debugging interface.

---

### 16. Deployment & Operations

**Where do third-party apps get hosted?**

For the 3 required demo apps: each deployed as a separate Vercel project (each is a small React app) with its own URL (e.g., `chess.chatbridge.vercel.app`, `weather.chatbridge.vercel.app`, `spotify.chatbridge.vercel.app`). The platform loads them in iframes via their manifest URL. Vercel's free tier supports multiple projects. In production, third-party developers would host their own apps anywhere — the platform only needs the app's URL and manifest to integrate it. The CSP's `frame-src` directive controls which origins are allowed.

**CI/CD for the platform itself?**

GitLab CI pipeline: lint (ESLint, already configured) → type check (`tsc --noEmit`) → test (Vitest unit + integration) → build (`pnpm build:web`) → deploy to Vercel (via Vercel CLI or GitLab-Vercel integration) on push to main. Supabase Edge Functions are deployed via `supabase functions deploy` in the same pipeline or manually during development. The pipeline runs on every push to main and on merge requests for early feedback.

**Monitoring for app health and invocation success rates?**

Sentry (already integrated in the Chatbox codebase) for frontend error tracking — captures unhandled exceptions, failed network requests, and iframe load errors. Supabase dashboard for auth metrics (sign-ups, active sessions) and Edge Function logs (invocation count, errors, latency). OpenRouter's dashboard for LLM metrics (token usage, cost per model, request latency). The platform's dev panel provides real-time postMessage and invocation logging during development. Browser DevTools for postMessage debugging in production. No custom monitoring infrastructure needed at demo scale.

**How do you handle app updates without breaking existing sessions?**

App manifests include a `version` field. The platform loads the iframe from the app's URL (which always serves the latest deployment). If an app's tool schema changes between versions, existing tool invocations in the chat history still render correctly because the stored `tool_result` data is self-contained (it includes the result payload, not a reference to the app's current schema). In-progress app sessions may break if the app's postMessage protocol changes mid-session — this is acceptable for the demo (we control all 3 apps and coordinate updates). In production, version pinning (loading a specific version URL rather than latest) would prevent this, with updates requiring re-review before the platform switches to the new version.
