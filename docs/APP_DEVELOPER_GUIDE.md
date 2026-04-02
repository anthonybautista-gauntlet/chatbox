# ChatBridge App Developer Guide

## Overview

A ChatBridge app is a standalone web application that runs inside a sandboxed iframe in the chat interface. Users interact with it through natural language -- the LLM reads your app's tool descriptions and invokes them when a user's message matches. Your app communicates with the platform via a `postMessage` protocol.

This guide covers everything you need to build, register, and run an app on ChatBridge.

## Quick Start

1. Build a web app (any framework: React, Vue, Svelte, plain HTML/JS)
2. Implement the ChatBridge postMessage protocol (see [Protocol](#postmessage-protocol))
3. Deploy it to any HTTPS host (Vercel, Netlify, etc.)
4. Submit your manifest through **Settings > App Registry** in the ChatBridge UI
5. Wait for admin approval -- your app enters `IN_REVIEW` and must be approved before it appears

## App Types

| Type | When to Use | Auth | Sandbox |
|------|------------|------|---------|
| `internal` | Bundled with the platform | None | `allow-scripts allow-forms` |
| `external_public` | Calls public APIs, no user credentials | None | `allow-scripts allow-forms` |
| `external_authenticated` | Needs user-specific OAuth tokens (e.g., Google Calendar) | Platform-mediated OAuth | `allow-scripts allow-forms allow-popups` |

## Manifest Schema

Every app is defined by a manifest. This is what you submit when registering.

```json
{
  "id": "my-app",
  "name": "My App",
  "version": "0.1.0",
  "description": "A clear description of what the app does and when the LLM should use it.",
  "type": "internal | external_public | external_authenticated",
  "url": "https://my-app.vercel.app",
  "icon": "(optional) URL to an icon",
  "auth": {
    "provider": "google",
    "scopes": ["https://www.googleapis.com/auth/calendar"]
  },
  "permissions": ["google-calendar"],
  "completionSignals": ["task_completed", "workflow_done"],
  "tools": []
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Unique identifier. Used to namespace tools (e.g., `my-app.do_something`). |
| `name` | Yes | Human-readable display name shown in the UI. |
| `version` | Yes | Semver string. |
| `description` | Yes | Shown to the LLM. Write it so the LLM knows when to invoke this app's tools. |
| `type` | Yes | One of `internal`, `external_public`, `external_authenticated`. |
| `url` | Yes | HTTPS URL where the app is deployed. `http://localhost:<port>` for local dev. |
| `icon` | No | URL to an icon image. |
| `auth` | Only for `external_authenticated` | OAuth config (see below). |
| `auth.provider` | Yes (if auth) | References a platform-managed OAuth provider (e.g., `google`, `github`). |
| `auth.scopes` | Yes (if auth) | OAuth scopes your app needs beyond the provider's defaults. |
| `permissions` | No | Descriptive permission labels (for display only). |
| `completionSignals` | No | Event names your app emits when a workflow reaches a milestone. |
| `tools` | Yes | Array of tool definitions (see below). |

### Important Notes on `auth`

- You do **not** provide OAuth client IDs, secrets, or URLs in the manifest.
- The platform owns the OAuth relationship with each provider.
- You only declare which `provider` you need and what `scopes` your app requires.
- The platform handles token exchange, storage, and refresh.

## Tool Definitions

Tools are how the LLM interacts with your app. Each tool has a name, description, input schema, output schema, and behavior flags.

```json
{
  "name": "add_item",
  "description": "Add an item to the list. Use when the user asks to add something.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Name of the item." },
      "priority": { "type": "number", "description": "Priority level (1-5)." }
    },
    "required": ["name"]
  },
  "returns": {
    "type": "object",
    "properties": {
      "status": { "type": "string" },
      "id": { "type": "string" }
    },
    "required": ["status"]
  },
  "uiTrigger": true,
  "timeoutMs": 30000
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unqualified tool name. The platform namespaces it as `{appId}.{name}`. |
| `description` | Yes | The LLM reads this to decide when to call the tool. Be specific and concise. |
| `parameters` | Yes | JSON Schema object describing the input. Must have `type: "object"` at the top level. |
| `returns` | Yes | JSON Schema object describing the output. |
| `uiTrigger` | Yes | `true` = invoking this tool opens the app iframe in the chat. `false` = headless (data only). |
| `timeoutMs` | No | Timeout in milliseconds. Default: 30000 (30 seconds). |

### Writing Good Tool Descriptions

The `description` field is critical -- it's how the LLM decides whether to invoke your tool. Good descriptions:

- State clearly what the tool does
- Indicate what kind of user request should trigger it
- Mention key parameters
- Are 1-2 sentences

**Good:** `"Add a birthday to track. Provide the person's name and their birth date in MM-DD format."`

**Bad:** `"Adds stuff."` (too vague -- the LLM won't know when to use it)

## Registering Your App

### Step 1: Deploy

Deploy your app to any hosting provider with HTTPS. Note the URL.

### Step 2: Submit via Settings

1. Open ChatBridge and go to **Settings > App Registry**.
2. Paste your manifest JSON into the text area.
3. Click **Submit for Review**.

Your submission enters an `IN_REVIEW` state. You can see its status in the submissions table on the same page.

### Step 3: Admin Approval

An admin reviews your submission in the Supabase dashboard and changes the status to `APPROVED` (or `REJECTED` with notes). Once approved, your app appears in the platform and its tools become available to the LLM.

### What NOT to Include

- Do **not** include OAuth client secrets or client IDs
- Do **not** include API keys or tokens
- The manifest is the app's public contract, not a place for secrets

## postMessage Protocol

Your app communicates with ChatBridge through `window.postMessage`. The platform sends messages to your iframe, and your app sends messages back to `window.parent`.

### Lifecycle

```
1. Platform creates iframe, loads your URL
2. Your app loads and sends → { type: 'ready' }
3. Platform sends → { type: 'init', appId, sessionId, state, capabilities }
4. Platform sends → { type: 'tool_invocation', toolName, args, invocationId, state }
5. Your app processes the tool and sends → { type: 'tool_result', invocationId, result, state }
6. Your app sends → { type: 'state_update', state } whenever state changes
7. Platform sends → { type: 'ping' } every ~10 seconds
8. Your app replies → { type: 'pong' }
```

### Messages You Receive (Platform → App)

| Type | When | Key Fields |
|------|------|------------|
| `init` | After you send `ready` | `appId`, `sessionId`, `state` (previously saved), `parentOrigin`, `capabilities` |
| `tool_invocation` | LLM invokes a tool | `toolName`, `args`, `invocationId`, `state` |
| `ping` | Every ~10 seconds | — |
| `auth_result` | After OAuth flow completes | `success`, `provider`, `accessToken?`, `error?` |

### Messages You Send (App → Platform)

| Type | When | Key Fields |
|------|------|------------|
| `ready` | App has loaded | — |
| `pong` | In response to `ping` | — |
| `tool_result` | Tool finished successfully | `invocationId`, `result`, `state?` |
| `state_update` | State changed meaningfully | `state` |
| `completion` | Workflow reached a milestone | `summary?`, `data?`, `state?` |
| `error` | Something went wrong | `invocationId?`, `code`, `message` |
| `auth_required` | App needs OAuth authorization | `provider`, `scopes?` |

### Target Origin

When posting to the parent, use the `parentOrigin` provided in the `init` message. If you haven't received it yet, use `'*'` (the platform validates `event.source` on its end).

When receiving messages, verify that `event.source` is the expected parent window.

## OAuth for Authenticated Apps

If your app needs user-specific credentials (e.g., Google Calendar access):

### What You Do

1. Set `type: "external_authenticated"` and include `auth: { provider: "google", scopes: [...] }` in your manifest.
2. When your app is invoked and needs authorization, send `{ type: 'auth_required', provider: 'google' }` to the parent.
3. The platform shows an "Authorize" button to the user.
4. After the user authorizes, you receive `{ type: 'auth_result', success: true, provider: 'google' }`.
5. The platform retries the tool invocation automatically.

### What the Platform Handles

- Opening the OAuth popup
- Redirecting to the provider's consent screen
- Exchanging the authorization code for tokens (server-side, via Edge Function)
- Storing tokens securely (encrypted in the database)
- Refreshing expired tokens
- Sending `auth_result` back to your app

You never see or handle OAuth client secrets, authorization URLs, or token URLs.

## State Management

### Why State Matters

The LLM cannot see your iframe. It can only see state you explicitly send via `state_update` or `tool_result`. If you don't externalize state, the LLM can't answer follow-up questions about your app.

### Requirements

- State must be JSON-serializable
- State must be compact (it enters the LLM's context window)
- State must be sufficient to restore the app after an iframe reload
- Send `state_update` whenever meaningful state changes
- Include `state` in your `tool_result` responses

### Example

```typescript
// After adding a birthday
const newState = { birthdays: [...current.birthdays, newEntry] }
parent.postMessage({ type: 'tool_result', invocationId, result: { status: 'added' }, state: newState }, parentOrigin)
```

On the next load, your app receives this state in the `init` message and should restore from it.

## Error Handling

Always send structured errors, not just console logs:

```typescript
parent.postMessage({
  type: 'error',
  invocationId: '...',
  code: 'invalid_input',
  message: 'Date must be in MM-DD format'
}, parentOrigin)
```

### Standard Error Codes

| Code | Meaning |
|------|---------|
| `invalid_input` | Tool parameters are malformed |
| `auth_required` | App needs user authorization |
| `auth_expired` | Previously valid credentials expired |
| `upstream_failure` | External API is unavailable |
| `timeout` | Internal operation timed out |
| `internal_error` | Unexpected app failure |

## Heartbeat

The platform sends `ping` every ~10 seconds. You must reply with `pong`:

```typescript
window.addEventListener('message', (event) => {
  if (event.data?.type === 'ping') {
    parent.postMessage({ type: 'pong' }, '*')
  }
})
```

If you miss 3 consecutive pings, the platform marks your app as crashed.

## Security Rules

1. Your app runs in a sandboxed iframe **without** `allow-same-origin`
2. You cannot access the parent DOM, cookies, or localStorage
3. Never embed secrets in your app bundle
4. OAuth tokens are managed by the platform, not your app
5. OAuth redirects must not happen inside the iframe (the platform opens a popup)
6. Validate `event.source` on incoming messages

## Local Development

1. Run your app locally (e.g., `npm run dev` on port 3001)
2. In the manifest, set `url` to `http://localhost:3001`
3. Submit the manifest through Settings > App Registry
4. Have the admin approve it
5. The platform loads your local app in the iframe -- hot reload works

For faster iteration, you can also test your app standalone (outside the iframe) and add the ChatBridge bridge layer afterward.

## Complete Example: Minimal App

Here's the simplest possible ChatBridge app:

```html
<!DOCTYPE html>
<html>
<body>
  <div id="status">Loading...</div>
  <script>
    let parentOrigin = '*'

    window.addEventListener('message', (event) => {
      const msg = event.data
      if (!msg || !msg.type) return

      switch (msg.type) {
        case 'init':
          parentOrigin = msg.parentOrigin || '*'
          document.getElementById('status').textContent = 'Ready!'
          break

        case 'tool_invocation':
          // Echo the args back as the result
          window.parent.postMessage({
            type: 'tool_result',
            invocationId: msg.invocationId,
            result: { echo: msg.args },
          }, parentOrigin)
          break

        case 'ping':
          window.parent.postMessage({ type: 'pong' }, parentOrigin)
          break
      }
    })

    // Tell the platform we're ready
    window.parent.postMessage({ type: 'ready' }, '*')
  </script>
</body>
</html>
```

Manifest for this app:

```json
{
  "id": "echo",
  "name": "Echo App",
  "version": "0.1.0",
  "description": "A minimal test app that echoes tool arguments back.",
  "type": "internal",
  "url": "https://my-echo-app.vercel.app",
  "permissions": [],
  "completionSignals": [],
  "tools": [
    {
      "name": "echo",
      "description": "Echo back any input. Use for testing.",
      "parameters": {
        "type": "object",
        "properties": {
          "message": { "type": "string", "description": "Message to echo." }
        },
        "required": ["message"]
      },
      "returns": {
        "type": "object",
        "properties": {
          "echo": { "type": "object" }
        },
        "required": ["echo"]
      },
      "uiTrigger": true,
      "timeoutMs": 10000
    }
  ]
}
```

## Reference Apps

| App | Type | Source |
|-----|------|--------|
| Chat Chess | `internal` | Deployed at `https://chat-chess-ecru.vercel.app` |
| Drawing Canvas | `internal` | Bundled at `public/apps/canvas/index.html` |
| Birthday Countdown | `external_authenticated` | Source at `apps/birthday-countdown/` |

The Chess app manifest in `src/renderer/packages/app-registry/manifests/index.ts` is a comprehensive example of tool definitions with detailed descriptions, parameters, and return schemas.

## Developer Checklist

Before submitting your app:

- [ ] Manifest is valid JSON with all required fields
- [ ] `description` clearly tells the LLM when to invoke your tools
- [ ] App is deployed to a stable HTTPS URL
- [ ] App sends `ready` on load
- [ ] App handles `init` (with and without prior state)
- [ ] App responds to `tool_invocation` with `tool_result`
- [ ] App sends `state_update` on meaningful state changes
- [ ] App responds to `ping` with `pong`
- [ ] App handles iframe reload (restores from state in `init`)
- [ ] App works at widths between 320px and 900px
- [ ] No secrets in the app bundle
- [ ] No OAuth redirects inside the iframe
- [ ] Errors are structured with `code` and `message`

## Common Pitfalls

1. **Don't use `allow-same-origin`** -- your app runs without it. Don't depend on parent DOM access or shared storage.
2. **Handle timeouts** -- if your tool takes longer than `timeoutMs`, the platform cancels it. For long operations, send intermediate `state_update` messages.
3. **Send `completion` when done** -- the platform uses this to mark the workflow as finished. Without it, the session doesn't know the task is complete.
4. **Keep state compact** -- your state enters the LLM context window. Don't send megabytes of data.
5. **Don't assume localStorage persists** -- the iframe runs in an opaque origin. Use `state_update` for durable persistence.
6. **Write clear tool descriptions** -- vague descriptions mean the LLM won't know when to call your tool.
