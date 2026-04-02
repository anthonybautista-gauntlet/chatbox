import {
  Alert,
  Badge,
  Button,
  Code,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Textarea,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconCheck, IconClock, IconX } from '@tabler/icons-react'
import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadRemoteApps } from '@/packages/app-registry'
import { supabaseAuthStore } from '@/stores/supabaseAuthStore'
import { VITE_SUPABASE_URL } from '@/variables'

export const Route = createFileRoute('/settings/apps' as any)({
  component: RouteComponent,
})

interface AppRegistration {
  id: string
  app_id: string
  status: string
  review_notes: string | null
  created_at: string
  manifest: { name?: string }
}

const STATUS_BADGE: Record<string, { color: string; icon: React.ReactNode }> = {
  IN_REVIEW: { color: 'yellow', icon: <IconClock size={14} /> },
  APPROVED: { color: 'green', icon: <IconCheck size={14} /> },
  REJECTED: { color: 'red', icon: <IconX size={14} /> },
}

export function RouteComponent() {
  const [manifestJson, setManifestJson] = useState('')
  const [submissions, setSubmissions] = useState<AppRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const fetchSubmissions = useCallback(async () => {
    const { data } = await supabase
      .from('app_registrations')
      .select('id, app_id, status, review_notes, created_at, manifest')
      .order('created_at', { ascending: false })

    if (data) {
      setSubmissions(data as AppRegistration[])
      if (data.some((row) => row.status === 'APPROVED')) {
        void loadRemoteApps()
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void fetchSubmissions()
  }, [fetchSubmissions])

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)

    let manifest: Record<string, unknown>
    try {
      manifest = JSON.parse(manifestJson)
    } catch {
      setError('Invalid JSON. Please check your manifest syntax.')
      return
    }

    setSubmitting(true)

    const token = supabaseAuthStore.getState().getAccessToken()
    if (!token) {
      setError('Not authenticated. Please sign in again.')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch(`${VITE_SUPABASE_URL}/functions/v1/register-app`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ manifest }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Registration failed (${res.status})`)
      } else {
        setSuccess(`App "${data.appId}" submitted for review.`)
        setManifestJson('')
        void fetchSubmissions()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack p="md" gap="xl">
      <Title order={5}>App Registry</Title>

      <Stack gap="md">
        <Title order={6}>Submit a New App</Title>
        <Text size="sm" c="dimmed">
          Paste your app manifest JSON below. Submitted apps enter an IN_REVIEW state and must be
          approved by an admin before they appear in the platform.
        </Text>
        <Textarea
          placeholder='{"id": "my-app", "name": "My App", ...}'
          minRows={10}
          maxRows={20}
          autosize
          value={manifestJson}
          onChange={(e) => setManifestJson(e.currentTarget.value)}
          styles={{ input: { fontFamily: 'monospace', fontSize: 13 } }}
        />
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}
        {success && (
          <Alert icon={<IconCheck size={16} />} color="green" variant="light">
            {success}
          </Alert>
        )}
        <Group>
          <Button onClick={handleSubmit} loading={submitting} disabled={!manifestJson.trim()}>
            Submit for Review
          </Button>
        </Group>
      </Stack>

      <Stack gap="md">
        <Title order={6}>Your Submissions</Title>
        {loading ? (
          <Loader size="sm" />
        ) : submissions.length === 0 ? (
          <Text size="sm" c="dimmed">
            No submissions yet.
          </Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>App</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Submitted</Table.Th>
                <Table.Th>Notes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {submissions.map((sub) => {
                const badge = STATUS_BADGE[sub.status] ?? STATUS_BADGE.IN_REVIEW
                return (
                  <Table.Tr key={sub.id}>
                    <Table.Td>
                      <Text fw={500}>{sub.manifest?.name ?? sub.app_id}</Text>
                      <Code>{sub.app_id}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={badge.color} leftSection={badge.icon} variant="light">
                        {sub.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{new Date(sub.created_at).toLocaleDateString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {sub.review_notes || '—'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Stack>
  )
}
