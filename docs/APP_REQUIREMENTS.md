# ChatBridge App Integration Requirements

## Purpose

This document defines how any app must be built to integrate with ChatBridge.

It is intended as a self-contained handoff document for a developer agent or engineer building an app that will run inside ChatBridge. The developer should not need to read other project documents to understand the integration contract, though `docs/PRESEARCH2.md` and `docs/ARCHITECTURE_PRESENTATION.md` provide additional architectural context.

## Scope And Responsibility Boundaries

There are two sides of the integration:

**Platform side (built by the ChatBridge team, not the app developer):**

- the iframe host component that loads and manages app iframes
- the app registry that registers manifests and exposes tools to the LLM
- the postMessage handler that validates, routes, and persists messages
- the tool injection layer that merges app tools into the Vercel AI SDK `ToolSet` at the `stream-text.ts` merge point
- the auth broker (Supabase Edge Functions) that handles OAuth token exchange for authenticated apps
- the CSP policy that restricts `frame-src` to registered app origins

**App side (built by the app developer):**

- a standalone deployable web application that runs inside an iframe
- compliance with the manifest schema
- compliance with the postMessage protocol
- compliance with the state, security, and lifecycle requirements defined in this document

The app developer builds a self-contained web app. The platform loads it, talks to it, and persists its state. The app developer does not modify ChatBridge internals.

## App Types

ChatBridge supports three categories of app, distinguished by their authentication requirements:

| Type | Auth Pattern | Sandbox Attributes | Notes |
|---|---|---|---|
| `internal` | No auth required | `sandbox="allow-scripts allow-forms"` | Bundled with or built for the platform. No user-specific credentials needed |
| `external_public` | API key or none; no user-specific auth | `sandbox="allow-scripts allow-forms"` | Calls public APIs. Any API key the app needs is its own concern (baked into the app's server or build, not provided by ChatBridge) |
| `external_authenticated` | OAuth2 or similar; user must authorize | `sandbox="allow-scripts allow-forms allow-popups"` | User-specific credentials. OAuth flow is parent-mediated. `allow-popups` is granted only for this type |

The app type is declared in the manifest and determines what sandbox permissions the platform grants.

## App Manifest

Every app must be registered via a manifest. The platform reads this manifest to discover tools, configure the iframe, and route invocations.

```typescript
interface AppManifest {
  id: string
  name: string
  version: string
  description: string
  type: 'internal' | 'external_public' | 'external_authenticated'
  url: string // iframe source URL — must be HTTPS in production
  icon?: string
  tools: ToolDefinition[]
  auth?: {
    type: 'oauth2'
    authorizationUrl: string
    tokenUrl: string
    scopes: string[]
  }
  permissions: string[]
  completionSignals: string[] // event names that indicate "done"
}

interface ToolDefinition {
  name: string
  description: string // LLM reads this to decide when to invoke
  parameters: JSONSchema // structured input the LLM provides
  returns: JSONSchema // structured output
  uiTrigger: boolean // should invoking this tool render the app iframe?
}
```

### Manifest Requirements

- `id` must be unique across all registered apps.
- `tools[].name` must be namespaced by app ID when injected into the LLM context (e.g., `myapp.do_something`). The platform handles this namespacing, but tool names in the manifest should be the unqualified name.
- `tools[].description` must be written so that an LLM can determine when to call the tool based on a user's natural language request.
- `tools[].parameters` and `tools[].returns` must be valid JSON Schema. The platform validates invocation arguments against `parameters` before forwarding to the app. The schemas must also be compatible with the Vercel AI SDK tool format.
- `url` must point to a stable, deployed HTTPS origin. During local development, `http://localhost:<port>` is acceptable.
- `auth` is required only for `external_authenticated` apps.
- `completionSignals` lists the event names the app will emit when a workflow reaches a durable milestone.

### What The App Developer Must Provide

The app developer delivers:

1. The manifest (as a TypeScript or JSON file conforming to the schema above).
2. The deployed app at the URL specified in the manifest.
3. Compliance with all requirements in this document.

## Non-Negotiable Architectural Principles

Every integrated app must be built around these rules:

1. The app runs in a sandboxed iframe, not inside the parent DOM.
2. The app and the parent communicate only through a typed `postMessage` protocol.
3. The app receives only explicitly granted data. It must not assume access to chat history, user tokens, or arbitrary parent state.
4. The app must be replayable from serialized state.
5. The app must emit compact, structured state updates that ChatBridge can persist and reuse as LLM context.
6. The app must tolerate iframe reloads, browser refreshes, and session restoration.
7. Secrets must never live in the app bundle or in iframe-accessible storage when they belong to the platform or to a third-party integration.
8. OAuth redirects must not happen inside the iframe.
9. The app must be safe to load cross-origin without requiring `allow-same-origin`.
10. The app must behave correctly when only one app is active at a time in a chat session.

## Source Of Truth Model

The biggest design rule is to avoid split-brain state.

There are two distinct kinds of truth:

- **Runtime UI truth:** the app is the source of truth for its live interactive UI state while it is running.
- **Persisted conversation truth:** ChatBridge is the source of truth for what is stored, what survives across sessions, and what the LLM will later see.

That means the app must continuously externalize meaningful state to ChatBridge instead of keeping critical state only in memory.

The app must be designed so that:

- the live iframe can render from an internal runtime store
- the app can serialize its current meaningful state into a structured snapshot
- the parent can persist that snapshot
- the app can later rehydrate from the persisted snapshot

If the app cannot reconstruct itself from serialized state, it is not suitable for ChatBridge integration.

## App State Requirements

### Required Properties Of App State

An integrated app must represent its meaningful state in a form that is:

- serializable to JSON
- compact enough to store in conversation context (LLM token window)
- stable enough to survive versioned schema changes
- sufficient to restore the user-visible state after reload

Good state representations:

- a compact domain-specific encoding (e.g., a standardized notation string for a board game position)
- a selected entity ID plus human-readable summary
- a finalized workflow result object
- a current step identifier plus minimal context

Bad state representations:

- full rendered HTML
- full DOM snapshot
- large debug dumps
- entire API response payloads when only a few fields matter

### What Must Be Persisted

The app must emit state that is sufficient for:

- LLM follow-up questions ("what just happened?", "what should I do next?")
- session continuity (user returns later and expects the app to resume)
- iframe re-initialization after page refresh
- recovery after crash or timeout when possible

The persisted state does not need to include every transient UI detail (e.g., hover states, animation frames), but it must include every detail needed for correctness.

Examples of state that should usually be persisted:

- current business object state
- current selection if it changes meaning
- current workflow step if the conversation depends on it
- identifiers needed to resume a task
- completion status
- concise result summaries

Examples of state that should not be relied on as the only truth:

- purely in-memory React/Vue/Svelte component state
- unsynchronized local state-management stores
- DOM state
- iframe-local `localStorage` as the only durable store (the iframe runs in an opaque origin and its storage may be ephemeral)
- cookie state that depends on same-origin behavior

### Required Versioning Behavior

Any app with non-trivial state must version its serialized state.

At minimum, the app must expose in its state snapshots:

- `appId`
- `appVersion`
- `stateSchemaVersion`

If the schema changes, the app must either:

- migrate old state forward, or
- reject old state clearly and return a recoverable `error` message to the parent

Silent corruption is not acceptable.

## Persistence And Session Continuity

The ChatBridge platform persists chat history locally first (IndexedDB via localforage on web) and syncs to Supabase for cross-device continuity. App state snapshots received via `state_update` and `completion` messages are stored as part of the session context.

### Required Assumptions For App Developers

The app must assume:

- the iframe itself is disposable and may be destroyed at any time
- any live runtime state may be lost when the iframe is destroyed
- the parent may re-open the app later with only serialized state and invocation parameters
- the user may return on another device after cloud sync
- the app's IndexedDB/localStorage inside the opaque-origin iframe may not persist between loads

### Required Recovery Behavior

The app must support:

- first-time initialization from a `tool_invocation` payload (no prior state)
- rehydration from the last persisted state snapshot via `init` or `hydrate_state`
- safe behavior when no previous state exists (show a clean default UI)
- safe behavior when the previous snapshot exists but is from an older schema version (migrate or reject with error)

## Security Requirements

### iframe Sandbox

The app runs inside a sandboxed iframe. The sandbox attributes are set by the platform based on the app type declared in the manifest:

```html
<!-- internal and external_public -->
<iframe
  sandbox="allow-scripts allow-forms"
  src="https://registered-app.example.com"
  referrerpolicy="no-referrer"
/>

<!-- external_authenticated (adds allow-popups for OAuth) -->
<iframe
  sandbox="allow-scripts allow-forms allow-popups"
  src="https://registered-app.example.com"
  referrerpolicy="no-referrer"
/>
```

`allow-same-origin` is never granted. Therefore the app must not depend on:

- access to the parent DOM
- direct reads of parent cookies, storage, or JS variables
- same-origin iframe behavior
- unrestricted top-level navigation

### Communication Security

The app must:

- send and receive only structured messages
- validate the `origin` of incoming `message` events against a known parent origin
- expect the parent to validate the `origin` of all app messages
- never use raw ad hoc string messaging
- treat the messaging boundary as untrusted input on both sides

The parent uses exact `targetOrigin` (not `*`) when posting messages to the app. The app must do the same when posting to the parent.

### CSP And Hosting

The platform sets `frame-src` restricted to registered app origins and `default-src 'self'`.

From the app developer's side, this means:

- the app's deployment URL must be stable and known at registration time
- the app must be served over HTTPS in production (localhost is acceptable for development)
- the app should set its own appropriate CSP and CORS headers

### Least Privilege

The app must only use the parameters explicitly passed in tool invocations or lifecycle messages.

It must not assume access to:

- full chat history
- tokens for other apps
- parent session internals
- platform secrets
- the LLM provider API key
- server credentials

### Secret Handling

The app must not embed:

- platform API keys
- server secrets or service-role secrets
- third-party refresh tokens

If the app needs third-party credentials (OAuth tokens), the intended architecture is:

- the platform performs the secure token exchange server-side (via an Edge Function)
- tokens are stored server-side in an encrypted database
- the iframe app receives only the minimum session context or scoped access token needed to proceed, passed via tool invocation parameters

### Rate Limiting

The platform enforces rate limits on app communication:

- Per-app: max 60 tool invocations per minute
- Per-user: max 200 tool invocations per hour
- Rapid-fire `state_update` messages may be throttled or debounced by the parent

The app should be designed to work within these limits and should not depend on unbounded message throughput.

## Authentication And OAuth Requirements

### Three Auth Patterns

| App Type | What The App Developer Does | What The Platform Does |
|---|---|---|
| `internal` | Nothing. No auth needed | Loads the iframe directly |
| `external_public` | Manages its own non-user-specific API key (baked into the app's server/build) | Loads the iframe directly |
| `external_authenticated` | Emits `auth_required` when credentials are missing. Handles `auth_result` messages. Resumes workflow after auth | Opens popup for OAuth consent. Exchanges code for tokens server-side. Stores tokens securely. Sends `auth_result` to the app. Passes scoped access token in tool invocation parameters |

### OAuth Flow For Authenticated Apps

The app must not perform OAuth redirects inside the iframe. Browser tracking prevention breaks cookies and redirects in cross-origin iframes.

The expected flow:

1. The LLM or user triggers a tool that requires auth.
2. The platform checks whether credentials exist server-side.
3. If not, the platform sends the LLM an `auth_required` result. The LLM tells the user authentication is needed.
4. The platform renders an "Authorize" button in the chat UI.
5. The user clicks → the parent opens a popup (`window.open()`) to the OAuth initiation endpoint (a Supabase Edge Function).
6. The user consents on the third-party provider's page.
7. The callback hits the Edge Function, which exchanges the code for tokens and stores them server-side.
8. The popup closes. The parent sends `auth_result` to the app iframe (if active).
9. The parent retries the original tool invocation, now with credentials available.

For the app developer, this means the app must handle:

- unauthenticated startup (no tokens yet)
- waiting-for-auth state (display appropriate UI)
- `auth_result` message (success or failure)
- resumed execution after auth completes
- expired authorization requiring re-auth (emit `auth_required` again)
- automatic token refresh handled by the platform (the app may receive updated tokens via tool invocation parameters)

## Runtime Communication Contract

### Message Envelope

Every message between ChatBridge and the app must use a structured object envelope.

Required fields:

- `protocolVersion` — protocol version string for forward compatibility
- `appId` — the app's registered ID
- `type` — the message type (see below)
- `requestId` — unique ID for correlating requests with responses
- `timestamp` — ISO 8601 or Unix epoch

Optional but recommended:

- `sessionId`
- `invocationId`
- `stateSchemaVersion`
- `payload` — the type-specific data

### Inbound Message Types (Parent → App)

The app must handle these messages from the parent:

| Type | When Sent | Payload |
|---|---|---|
| `init` | After app sends `ready` | App identity, session context, previously persisted app state (if any), capability flags |
| `tool_invocation` | When the LLM or platform invokes a tool | Tool name, validated parameters, app state snapshot (if relevant), scoped credentials (for authenticated apps) |
| `hydrate_state` | When the parent needs the app to restore from a snapshot | The last persisted state snapshot |
| `context_request` | When the parent needs the app's current state on demand | A `requestId` for correlation |
| `cancel` | When the platform cancels an in-flight operation | The `invocationId` being canceled |
| `ping` | Heartbeat / liveness detection (every ~10 seconds) | None |
| `auth_result` | After an external OAuth flow completes | Success with scoped token, or failure with error reason |

### Outbound Message Types (App → Parent)

The app must emit these messages to the parent:

| Type | When Emitted | Payload |
|---|---|---|
| `ready` | iframe has loaded and is ready to receive messages | None or basic capability info |
| `state_update` | Whenever meaningful user-visible state changes | Compact authoritative state snapshot (must include `stateSchemaVersion`) |
| `tool_result` | An invoked tool operation produced a structured result | The `invocationId`, structured result data |
| `completion` | A workflow or task reached a durable milestone or final state | Summary string, structured result data, final state snapshot |
| `error` | Execution failed or the request was invalid | Error code, human-readable message, the `invocationId` or `requestId` if applicable |
| `pong` | Response to `ping` | None |
| `auth_required` | The app cannot continue without user authorization | Which auth provider/scope is needed |
| `context_response` | Response to a `context_request` | The `requestId`, current compact state |

### Message Semantics

The app must distinguish these concepts clearly:

- `state_update`: the app's state changed (informational, may be frequent)
- `tool_result`: an invoked operation produced a structured result (response to a specific `tool_invocation`)
- `completion`: the workflow reached a durable milestone or final state (less frequent, triggers platform-side persistence)
- `error`: execution failed or the request was invalid (always includes a machine-readable code)

Do not collapse everything into one generic message type.

### Reference Protocol Sketch

This is the baseline protocol from the planning docs. The platform implementation may refine field names, but the semantics are fixed:

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

All messages are validated against registered schemas. Origin is checked on every received message: `event.origin === registeredAppOrigin`.

## Lifecycle Requirements

### Startup Lifecycle

The app must support this sequence:

1. Platform creates the iframe and sets `src` to the app's registered URL.
2. App loads and sends `ready`.
3. Parent sends `init` with session context and any previously persisted state.
4. If there is persisted state, the app rehydrates from it.
5. Parent sends `tool_invocation` when the LLM triggers a tool.
6. App emits `state_update` as meaningful state changes occur.
7. App emits `tool_result` and possibly `completion`.

The app must not assume that the first substantive message it receives is always a `tool_invocation`. It may receive `init` with state to rehydrate from, or a `context_request`.

### Reload Lifecycle

If the iframe reloads (page refresh, browser navigation, platform-initiated reload):

- the app must send `ready` again
- the parent will re-send `init` with the latest persisted state
- the app must accept rehydration from that state
- the app must not require hidden client memory (localStorage, cookies, in-memory singletons) to recover

### Teardown

When the user navigates away from the chat session or the platform deactivates the app:

- the iframe may be destroyed without warning
- the app should emit a final `state_update` during normal operation so the latest state is already persisted
- the app must not rely on `beforeunload` or similar lifecycle hooks to save critical state (these are unreliable in sandboxed iframes)

### Timeout And Liveness

The platform sends `ping` messages at regular intervals (~10 seconds). The app must reply with `pong`.

- If the platform receives no `pong` for 3 consecutive pings, it marks the app as crashed and informs the LLM.
- Each `tool_invocation` has a 30-second default timeout (configurable per app in the manifest). If the app does not respond with `tool_result` or `error` within the timeout, the platform cancels the invocation.
- When the app receives `cancel`, it must stop or safely ignore the canceled work.
- For long-running operations, the app should emit intermediate `state_update` messages to show progress.

### Circuit Breaker

The platform tracks tool invocation success/failure per app. If the error rate exceeds 50% over 10+ invocations in a rolling 5-minute window, the platform disables the app for that session and informs the user. The app should be designed to avoid triggering this.

## Tool Design Requirements

### Tool Naming

Tools are namespaced by app ID when injected into the LLM context. For example, if the app ID is `myapp` and the tool name is `do_something`, the LLM sees `myapp.do_something`.

The app developer defines tool names in the manifest without the namespace prefix. The platform adds it.

### Tool Descriptions

The `description` field on each tool is critical. The LLM reads it to decide whether and when to invoke the tool. Descriptions should:

- clearly state what the tool does
- indicate what kind of user request should trigger it
- mention what parameters are expected
- be concise (one to two sentences)

### Tool Schemas

`parameters` and `returns` must be valid JSON Schema objects. They must be compatible with the Vercel AI SDK tool format, which means:

- `parameters` must describe an object type with named properties
- each property should have a `type` and `description`
- required fields must be listed in `required`

The platform validates `tool_invocation` arguments against the `parameters` schema before forwarding to the app. If validation fails, the platform returns a structured error to the LLM for self-correction. The app will only ever receive valid arguments.

### UI Trigger

The `uiTrigger` field on each tool definition controls whether invoking the tool causes the platform to render the app's iframe in the chat. Some tools may be "headless" (return data without showing UI). Others require the app to display interactive content.

## UI And UX Requirements

### Viewport And Layout

The app renders inside an iframe embedded in the chat message area. Current baseline dimensions:

- Width: full width of the chat content area (variable, responsive)
- Height: 400px default (the platform may support dynamic resize in the future)

The app must:

- render correctly at widths between ~320px and ~900px
- work within a fixed height or communicate desired height to the parent (if the protocol supports a `resize_request` message)
- not assume fullscreen is available by default
- use responsive design

### Required UX States

The app must expose clear visual states for:

- **Loading:** shown while the app initializes or fetches data
- **Working/Processing:** shown while a tool invocation is in progress
- **Interactive:** the normal state where the user can interact
- **Success/Completion:** shown when a workflow milestone is reached
- **Error:** shown when something goes wrong, with a human-readable message and ideally a retry option

### Accessibility

The app should follow standard web accessibility practices. Screen reader support and keyboard navigation are expected.

### Serializable State Over Visual-Only State

If app state matters to the chat conversation, it must be serializable, not only visual. The LLM cannot see the iframe. It can only see state that the app explicitly sends via `state_update` or `tool_result`.

## Data Boundaries

The app must treat all data passed in from ChatBridge as the full extent of what it is allowed to know.

The app should receive only:

- explicit invocation parameters
- the latest relevant persisted app state
- explicit auth-status information
- explicit capability flags

The app should not receive:

- the entire chat transcript
- unrelated apps' states
- raw third-party refresh tokens (only scoped access tokens)
- platform configuration secrets

## What The App May Persist Locally

The app may use local ephemeral state for UI responsiveness.

However, local app persistence inside the iframe must be treated only as a cache or convenience layer, never the sole durable source of truth.

Because the iframe runs in an opaque origin (no `allow-same-origin`), its IndexedDB and localStorage may be ephemeral and are not guaranteed to persist across loads.

If the app uses any local persistence for UX reasons, it must still:

- emit authoritative state to the parent via `state_update`
- remain correct if that local cache is empty
- remain correct if the iframe is recreated in a fresh browser context

## Error Handling Requirements

The app must emit structured `error` messages, not only console logs.

Every error message must include:

- `code` — a machine-readable error category
- `message` — a human-readable description

Recommended error codes (apps may define additional codes):

| Code | Meaning |
|---|---|
| `invalid_input` | The tool invocation parameters are malformed or semantically invalid |
| `auth_required` | The app cannot proceed without user authorization |
| `auth_expired` | Previously valid credentials have expired |
| `upstream_failure` | An external API or dependency the app relies on is unavailable |
| `timeout` | An internal operation timed out |
| `unsupported_state_version` | The persisted state snapshot is from an incompatible schema version |
| `internal_error` | An unexpected failure inside the app |

The app must fail in a way the parent can surface to both the user and the LLM. The LLM uses error information to respond to the user and potentially retry.

## Completion Requirements

The planning docs depend on explicit completion signals.

The app must define what "done" means for each of its workflows in the manifest's `completionSignals` field.

When a durable milestone is reached, the app must emit `completion` with:

- a concise structured result
- the final or current meaningful state snapshot
- a human-readable summary string
- enough information for ChatBridge to store that outcome in conversation history

After `completion`, the platform marks the app as inactive. The LLM can discuss the results. The user can re-invoke the app's tools later to start a new interaction.

## Deployment Requirements

### Hosting

Each app is a standalone web application deployed to its own origin. For production, apps should be deployed to a hosting provider (e.g., Vercel, Netlify, Cloudflare Pages) with HTTPS.

The app's URL is registered in the manifest. The platform loads it in an iframe from that URL.

During local development, the app can run on `localhost:<port>`. Register the manifest with the local URL. The platform's iframe will load it directly. Hot reload works naturally.

### HTTPS

Production apps must be served over HTTPS. The platform will refuse to load HTTP origins in production (browser mixed-content policies would block it anyway).

### Stability

The app URL must be stable. If the app moves to a new domain, the manifest must be updated. Old sessions that reference the previous URL may fail to reload the app.

## SDK And Helper Library

The planning docs describe a planned ChatBridge SDK (TypeScript npm package) that wraps the postMessage protocol with convenience functions:

- `createApp(manifest)` — initializes the app runtime
- `onToolInvocation(handler)` — registers a handler for tool calls
- `sendStateUpdate(state)` — emits a `state_update` message
- `sendCompletion(result)` — emits a `completion` message
- `sendError(code, message)` — emits an `error` message

If this SDK is available at the time of app development, use it. It handles message envelope construction, origin validation, heartbeat responses, and protocol versioning.

If the SDK is not yet available, the app must implement the protocol directly as described in this document.

## Local Development And Testing

### Local Dev Workflow

1. Run the app locally on a chosen port (e.g., `localhost:3001`).
2. Register a manifest pointing to `http://localhost:3001`.
3. Start ChatBridge with `pnpm dev:web`.
4. The platform loads the app in an iframe from the local URL.
5. Hot reload works naturally.

### Testing Expectations

The app developer should verify:

- the app sends `ready` on load
- the app correctly handles `init` with and without prior state
- the app responds to `tool_invocation` with `tool_result`
- the app emits `state_update` on meaningful changes
- the app emits `completion` on workflow milestones
- the app responds to `ping` with `pong`
- the app handles `cancel` gracefully
- the app handles `auth_result` if applicable
- the app can rehydrate from a serialized state snapshot after iframe reload
- the app works when its local storage is empty

A recommended test strategy is to build an "echo mode" that replays scripted parent messages against the app without needing the full ChatBridge platform running.

### Platform-Side Testing Tools

The platform may provide a dev panel (accessible in dev mode) showing:

- last 50 postMessage events
- tool invocation log with arguments, results, and timing
- app registration status

## Grading And Evaluation Context

The platform will be evaluated against specific testing scenarios. The app developer should be aware that graders will verify:

1. The chatbot can discover and invoke the app's tools via natural language.
2. The app's UI renders correctly within the chat interface.
3. The user can interact with the app UI and then return to the chatbot, with completion signaling working correctly.
4. The chatbot remembers app results in subsequent turns (context retention).
5. The user can switch between multiple apps in the same conversation.
6. Ambiguous questions are routed to the correct app (or the chatbot asks for clarification).
7. The chatbot correctly refuses to invoke apps for unrelated queries.

Apps must be built to satisfy these scenarios. In particular:

- completion signaling must work (scenario 3)
- state must persist in conversation context for follow-up questions (scenario 4)
- the app must handle being activated and deactivated as the user switches between apps (scenario 5)

## Acceptance Criteria For An Integratable App

An app is integration-ready only if all of the following are true:

1. It has a valid manifest conforming to the `AppManifest` schema.
2. It is deployed to a stable HTTPS URL (or localhost for dev).
3. It runs correctly in a sandboxed cross-origin iframe without `allow-same-origin`.
4. It communicates only through typed `postMessage` with origin validation.
5. It can initialize from a clean start with no prior state.
6. It can rehydrate from a serialized state snapshot.
7. It emits compact authoritative `state_update` messages on meaningful changes.
8. It emits structured `tool_result` messages in response to `tool_invocation`.
9. It emits structured `error` messages with machine-readable codes.
10. It emits `completion` for durable workflow milestones.
11. It responds to `ping` with `pong`.
12. It handles `cancel` gracefully.
13. It survives iframe reload without losing correctness.
14. It does not embed platform or third-party secrets in the client bundle.
15. It supports parent-mediated auth if authentication is required.
16. It works with a single active app per chat session.
17. Its persisted state is sufficient for accurate follow-up questions from the LLM.

## Recommended Developer Checklist

Before handing an app to the ChatBridge integration layer, the app developer should be able to answer "yes" to each item below:

- [ ] The manifest is complete and valid.
- [ ] The app boots with only `init` data and no pre-existing browser state.
- [ ] The app restores itself from a JSON state snapshot.
- [ ] The app emits a minimal but sufficient state snapshot after every meaningful change.
- [ ] All important actions are mapped to explicit tool names with JSON Schema parameters and returns.
- [ ] Tool descriptions are clear enough for an LLM to understand when to invoke them.
- [ ] The app avoids iframe-internal OAuth redirects.
- [ ] The app avoids any dependence on parent DOM access.
- [ ] The app verifies the parent origin before acting on messages.
- [ ] The app avoids secrets in the bundle.
- [ ] The app returns machine-readable errors.
- [ ] The app defines clear completion events matching the manifest's `completionSignals`.
- [ ] The app responds to heartbeat pings.
- [ ] The app handles cancellation of in-flight operations.
- [ ] The app works correctly at widths between 320px and 900px.
- [ ] The app has been tested with iframe reload (state survives via rehydration).

## Known Constraints That App Developers Must Accept

These are not optional; they come directly from the chosen architecture:

- The app is isolated by iframe sandboxing. It cannot access the parent page.
- Cross-origin iframe content is opaque to the parent. ChatBridge cannot inspect the app's DOM.
- Only structured messages cross the iframe boundary.
- Only one app is active at a time in a given chat session.
- The live iframe can disappear and later be recreated at any time.
- Persisted app context must be compact enough for LLM context-window use.
- The platform rate-limits message throughput.
- The platform enforces tool invocation timeouts.
- The platform may disable the app if its error rate is too high (circuit breaker).
