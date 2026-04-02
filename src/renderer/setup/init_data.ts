import { chatSessionSettings } from '@shared/defaults'
import type { Session } from '@shared/types'
import { defaultExampleSessionIds, defaultSessionsForCN, defaultSessionsForEN } from '@/packages/initial_data'
import platform from '@/platform'
import storage from '@/storage'
import { StorageKey, StorageKeyGenerator } from '@/storage/StoreStorage'
import * as chatStore from '@/stores/chatStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import { getSessionMeta } from '@/stores/sessionHelpers'

const WEB_DEFAULT_SESSION_CLEANUP_KEY = 'chatbridge:web-default-session-cleanup:v1'

export async function initData() {
  await cleanupDefaultSessions()
  await initSessionsIfNeeded()
}

async function cleanupDefaultSessions() {
  if ((process.env.CHATBOX_BUILD_PLATFORM || 'unknown') !== 'web') {
    return
  }

  const alreadyCleaned = await storage.getItem<boolean>(WEB_DEFAULT_SESSION_CLEANUP_KEY, false)
  if (alreadyCleaned) {
    return
  }

  const sessionList = await chatStore.listSessionsMeta()
  const sessionsToDelete = sessionList.filter((session) => defaultExampleSessionIds.has(session.id))

  for (const session of sessionsToDelete) {
    await chatStore.deleteSession(session.id)
  }

  await storage.setItemNow(WEB_DEFAULT_SESSION_CLEANUP_KEY, true)
}

async function initSessionsIfNeeded() {
  // 已经做过 migration，只需要检查是否存在 sessionList
  const sessionList = await chatStore.listSessionsMeta()
  if (sessionList.length > 0) {
    return
  }

  const newSessionList = await initPresetSessions()

  await chatStore.updateSessionList(() => {
    return newSessionList
  })
}

async function initPresetSessions() {
  if ((process.env.CHATBOX_BUILD_PLATFORM || 'unknown') === 'web') {
    return await initWebPresetSessions()
  }

  const lang = await platform.getLocale().catch((e) => 'en')

  const defaultSessions = lang.startsWith('zh') ? defaultSessionsForCN : defaultSessionsForEN

  for (const session of defaultSessions) {
    await storage.setItemNow(StorageKeyGenerator.session(session.id), session)
  }

  const sessionList = defaultSessions.map(getSessionMeta)

  await storage.setItemNow(StorageKey.ChatSessionsList, sessionList)

  return sessionList
}

async function initWebPresetSessions() {
  const settings = chatSessionSettings()
  const defaultSession: Session = {
    id: 'chatbridge-default-session',
    name: 'New Chat',
    type: 'chat',
    messages: [],
    settings,
  }

  await storage.setItemNow(StorageKeyGenerator.session(defaultSession.id), defaultSession)
  lastUsedModelStore.getState().setChatModel(settings.provider || 'openrouter', settings.modelId || '')

  const sessionList = [getSessionMeta(defaultSession)]
  await storage.setItemNow(StorageKey.ChatSessionsList, sessionList)
  return sessionList
}
