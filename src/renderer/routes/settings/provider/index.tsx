import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import platform from '@/platform'

export const Route = createFileRoute('/settings/provider/')({
  component: RouteComponent,
})

export function RouteComponent() {
  const isSmallScreen = useIsSmallScreen()
  const navigate = useNavigate()
  useEffect(() => {
    if (!isSmallScreen) {
      navigate({
        to: platform.type === 'web' ? '/settings/default-models' : '/settings/provider/$providerId',
        params: platform.type === 'web' ? undefined : { providerId: 'openai' },
        replace: true,
      })
    }
  }, [isSmallScreen, navigate])

  return null
}
