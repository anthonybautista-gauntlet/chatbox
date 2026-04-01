import { createMessage } from '@shared/types'
import * as chatStore from '@/stores/chatStore'

const APP_STATE_TAG = 'CHATBRIDGE_APP_STATE'
const APP_STATE_MESSAGE_PREFIX = 'chatbridge-app-state:'

interface PersistedAppStateEnvelope {
  appId: string
  savedAt: number
  state: unknown
}

function getAppStateMessageName(appId: string) {
  return `${APP_STATE_MESSAGE_PREFIX}${appId}`
}

function buildEnvelope(appId: string, state: unknown, savedAt = Date.now()): PersistedAppStateEnvelope {
  return {
    appId,
    savedAt,
    state,
  }
}

function serializeEnvelope(envelope: PersistedAppStateEnvelope) {
  return `<${APP_STATE_TAG}>${JSON.stringify(envelope)}</${APP_STATE_TAG}>`
}

function parseEnvelope(text: string) {
  const match = text.match(new RegExp(`<${APP_STATE_TAG}>([\\s\\S]+)</${APP_STATE_TAG}>`))
  if (!match) {
    return null
  }

  try {
    return JSON.parse(match[1]) as PersistedAppStateEnvelope
  } catch (_error) {
    return null
  }
}

export function formatAppStateForContext(appId: string, state: unknown, savedAt = Date.now()) {
  return serializeEnvelope(buildEnvelope(appId, state, savedAt))
}

export async function getLastAppState(sessionId: string, appId: string) {
  const session = await chatStore.getSession(sessionId)
  if (!session) {
    return null
  }

  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    const message = session.messages[index]
    if (message.role !== 'system' || message.name !== getAppStateMessageName(appId)) {
      continue
    }

    const text = message.contentParts.find((part) => part.type === 'text')?.text
    if (!text) {
      continue
    }

    const envelope = parseEnvelope(text)
    if (envelope?.appId === appId) {
      return envelope.state
    }
  }

  return null
}

export async function persistAppState(sessionId: string, appId: string, state: unknown) {
  const savedAt = Date.now()
  const messageName = getAppStateMessageName(appId)
  const nextMessage = createMessage('system', formatAppStateForContext(appId, state, savedAt))
  nextMessage.name = messageName
  nextMessage.timestamp = savedAt
  nextMessage.updatedAt = savedAt

  await chatStore.updateSessionWithMessages(sessionId, (session) => {
    const messageIndex = session.messages.findIndex(
      (message) => message.role === 'system' && message.name === messageName
    )

    if (messageIndex === -1) {
      return {
        ...session,
        messages: [...session.messages, nextMessage],
      }
    }

    return {
      ...session,
      messages: session.messages.map((message, index) => (index === messageIndex ? { ...message, ...nextMessage } : message)),
    }
  })

  return state
}
