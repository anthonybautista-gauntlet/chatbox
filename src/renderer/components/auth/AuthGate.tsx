import { useEffect, useState, type ReactNode } from 'react'
import {
  Button,
  Text,
  TextInput,
  Title,
  Stack,
  Paper,
  Center,
  Loader,
  Anchor,
  PasswordInput,
  Divider,
  Collapse,
} from '@mantine/core'
import {
  supabaseAuthStore,
  useSupabaseSession,
  useSupabaseLoading,
  useSupabaseInitialized,
} from '@/stores/supabaseAuthStore'
import { isSupabaseConfigured } from '@/lib/supabase'
import platform from '@/platform'

interface AuthGateProps {
  children: ReactNode
}

export default function AuthGate({ children }: AuthGateProps) {
  if (platform.type !== 'web' || !isSupabaseConfigured) {
    return <>{children}</>
  }

  return <AuthGateInner>{children}</AuthGateInner>
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.04 24.04 0 0 0 0 21.56l7.98-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function AuthGateInner({ children }: AuthGateProps) {
  const session = useSupabaseSession()
  const loading = useSupabaseLoading()
  const initialized = useSupabaseInitialized()

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabaseAuthStore.getState().initialize()
  }, [])

  if (loading || !initialized) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    )
  }

  if (session) {
    return <>{children}</>
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    const result = await supabaseAuthStore.getState().signInWithGoogle()
    if (result.error) {
      setError(result.error)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { signInWithEmail, signUpWithEmail } = supabaseAuthStore.getState()
    const result =
      emailMode === 'signin' ? await signInWithEmail(email, password) : await signUpWithEmail(email, password)

    setSubmitting(false)
    if (result.error) {
      setError(result.error)
    } else if (emailMode === 'signup') {
      setError(null)
      setEmailMode('signin')
    }
  }

  return (
    <Center h="100vh" bg="var(--chatbox-background-primary)">
      <Paper shadow="md" p="xl" radius="md" w={400} withBorder>
        <Stack gap="md">
          <Title order={3} ta="center">
            Sign in to ChatBridge
          </Title>

          <Button
            fullWidth
            variant="default"
            leftSection={<GoogleIcon />}
            onClick={handleGoogleSignIn}
            size="md"
          >
            Continue with Google
          </Button>

          {error && (
            <Text c="red" size="sm">
              {error}
            </Text>
          )}

          <Divider
            label={
              <Anchor component="button" type="button" size="xs" c="dimmed" onClick={() => setShowEmailForm((v) => !v)}>
                {showEmailForm ? 'Hide email sign-in' : 'Or use email'}
              </Anchor>
            }
            labelPosition="center"
          />

          <Collapse in={showEmailForm}>
            <form onSubmit={handleEmailSubmit}>
              <Stack gap="sm">
                <TextInput
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  required
                  type="email"
                />

                <PasswordInput
                  label="Password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  required
                  minLength={6}
                />

                <Button type="submit" fullWidth loading={submitting} variant="light">
                  {emailMode === 'signin' ? 'Sign In' : 'Sign Up'}
                </Button>

                <Text size="xs" ta="center">
                  {emailMode === 'signin' ? (
                    <>
                      No account?{' '}
                      <Anchor component="button" type="button" size="xs" onClick={() => { setEmailMode('signup'); setError(null) }}>
                        Sign up
                      </Anchor>
                    </>
                  ) : (
                    <>
                      Already have an account?{' '}
                      <Anchor component="button" type="button" size="xs" onClick={() => { setEmailMode('signin'); setError(null) }}>
                        Sign in
                      </Anchor>
                    </>
                  )}
                </Text>
              </Stack>
            </form>
          </Collapse>
        </Stack>
      </Paper>
    </Center>
  )
}
