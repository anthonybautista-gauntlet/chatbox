import { ActionIcon, Box, Code, Collapse, Group, Paper, Stack, Text } from '@mantine/core'
import type { MessageToolCallPart } from '@shared/types'
import {
  IconChevronRight,
  IconCircleCheckFilled,
  IconCircleXFilled,
  IconCode,
  IconLoader,
  IconTool,
  IconX,
} from '@tabler/icons-react'
import clsx from 'clsx'
import { type FC, useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { AppIframeHost } from '@/components/app/AppIframeHost'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import { getAppForTool, isLiveInvocation } from '@/packages/app-registry'
import { currentSessionIdAtom } from '@/stores/atoms'

const AppToolCallHeader: FC<{
  label: string
  state: MessageToolCallPart['state']
  expanded: boolean
  onToggle: () => void
}> = ({ label, state, expanded, onToggle }) => {
  return (
    <Paper withBorder radius="md" px="xs" onClick={onToggle} className="cursor-pointer group">
      <Group justify="space-between" className="w-full">
        <Group gap="xs">
          <Text fw={600}>{label}</Text>
          <ScalableIcon icon={IconTool} color="var(--chatbox-tint-success)" />
          {state === 'call' ? (
            <ScalableIcon icon={IconLoader} className="animate-spin" color="var(--chatbox-tint-brand)" />
          ) : state === 'error' ? (
            <ScalableIcon icon={IconCircleXFilled} color="var(--chatbox-tint-error)" />
          ) : (
            <ScalableIcon icon={IconCircleCheckFilled} color="var(--chatbox-tint-success)" />
          )}
        </Group>
        <ScalableIcon icon={IconChevronRight} className={clsx('transition-transform', expanded ? 'rotate-90' : '')} />
      </Group>
    </Paper>
  )
}

export const AppToolCallUI: FC<{ part: MessageToolCallPart }> = ({ part }) => {
  const { t } = useTranslation()
  const currentSessionId = useAtomValue(currentSessionIdAtom)
  const [expanded, setExpanded] = useState(part.state !== 'result')
  const [closed, setClosed] = useState(false)
  const registration = getAppForTool(part.toolName)

  const label = useMemo(() => {
    if (!registration) {
      return part.toolName
    }
    return `${registration.manifest.name} · ${registration.definition.name}`
  }, [part.toolName, registration])

  if (!registration) {
    return null
  }

  const shouldRenderIframe =
    !closed && (part.state === 'call' || (registration.definition.uiTrigger && isLiveInvocation(part.toolCallId)))

  return (
    <Stack gap="xs" mb="xs">
      <AppToolCallHeader label={label} state={part.state} expanded={expanded} onToggle={() => setExpanded((prev) => !prev)} />

      {shouldRenderIframe && (
        <Stack gap="xs">
          <Group justify="flex-end">
            <ActionIcon variant="subtle" color="gray" onClick={() => setClosed(true)} aria-label={t('Close')}>
              <IconX size={16} />
            </ActionIcon>
          </Group>
          <AppIframeHost
            appId={registration.appId}
            toolName={registration.toolName}
            args={part.args}
            invocationId={part.toolCallId}
            sessionId={currentSessionId}
            onClose={() => setClosed(true)}
          />
        </Stack>
      )}

      <Collapse in={expanded}>
        <Paper withBorder radius="md" p="sm">
          <Stack gap="xs">
            <Group gap="xs" c="chatbox-tertiary">
              <ScalableIcon icon={IconCode} />
              <Text fw={600} size="xs" c="chatbox-tertiary" m="0">
                {t('Arguments')}
              </Text>
            </Group>
            <Box>
              <Code block>{JSON.stringify(part.args, null, 2)}</Code>
            </Box>
            {part.result !== undefined && (
              <>
                <Group gap="xs" c="chatbox-tertiary">
                  <ScalableIcon icon={IconTool} />
                  <Text fw={600} size="xs" c="chatbox-tertiary" m="0">
                    {t('Result')}
                  </Text>
                </Group>
                <Box>
                  <Code block>{JSON.stringify(part.result, null, 2)}</Code>
                </Box>
              </>
            )}
            {part.state === 'error' && (
              <Text size="sm" c="red">
                {t('The app tool reported an error.')}
              </Text>
            )}
          </Stack>
        </Paper>
      </Collapse>
    </Stack>
  )
}
