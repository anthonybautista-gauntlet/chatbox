import { Loader, NavLink, Stack, Text, ThemeIcon } from '@mantine/core'
import { createMessage } from '@shared/types'
import { IconApps } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { getRegisteredApps } from '@/packages/app-registry'
import * as chatStore from '@/stores/chatStore'
import { submitNewUserMessage } from '@/stores/session/messages'
import { initEmptyChatSession } from '@/stores/sessionHelpers'
import { switchCurrentSession } from '@/stores/sessionActions'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'

interface AppLauncherProps {
  onAppLaunched?: () => void
}

export default function AppLauncher({ onAppLaunched }: AppLauncherProps) {
  const apps = useMemo(() => getRegisteredApps(), [])
  const [launchingAppId, setLaunchingAppId] = useState<string | null>(null)

  if (CHATBOX_BUILD_PLATFORM !== 'web' || apps.length === 0) {
    return null
  }

  const handleLaunch = async (appId: string) => {
    const app = apps.find((item) => item.id === appId)
    if (!app || launchingAppId) {
      return
    }

    setLaunchingAppId(app.id)
    try {
      const session = await chatStore.createSession({
        ...initEmptyChatSession(),
        name: app.name,
      })

      switchCurrentSession(session.id)
      onAppLaunched?.()

      await submitNewUserMessage(session.id, {
        newUserMsg: createMessage('user', `Open ${app.name}`),
        needGenerating: true,
      })
    } catch (error) {
      console.error('[AppLauncher] Failed to launch app session', error)
    } finally {
      setLaunchingAppId(null)
    }
  }

  return (
    <Stack gap={4} px="xs" py="xs">
      <Text c="chatbox-tertiary" size="sm" px="sm">
        Apps
      </Text>
      {apps.map((app) => {
        const isLaunching = launchingAppId === app.id
        return (
          <NavLink
            key={app.id}
            c="chatbox-secondary"
            className="rounded"
            label={app.name}
            description={app.description}
            leftSection={
              <ThemeIcon variant="light" radius="xl" size="md">
                <IconApps size={16} />
              </ThemeIcon>
            }
            rightSection={isLaunching ? <Loader size="xs" /> : null}
            disabled={launchingAppId !== null}
            onClick={() => void handleLaunch(app.id)}
            variant="light"
            p="xs"
          />
        )
      })}
    </Stack>
  )
}
