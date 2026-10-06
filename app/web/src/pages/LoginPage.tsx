import {
  Alert,
  Anchor,
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/use-auth';
import { AuthError } from '@/auth/types';
import { DreamhouseLogo } from '@/components/DreamhouseLogo/DreamhouseLogo';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { status, mode, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'signedIn') {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn({ username, password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof AuthError ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Center mih="100vh" p="md" bg="var(--mantine-color-gray-0)">
      <Paper withBorder shadow="md" p="xl" radius="md" w="100%" maw={400}>
        <form onSubmit={handleSubmit} aria-label="Sign in">
          <Stack>
            <Group gap="sm">
              <DreamhouseLogo size={40} />
              <div>
                <Title order={3}>Dreamhouse</Title>
                <Text size="xs" c="dimmed">
                  {mode === 'cognito'
                    ? 'Sign in with your Amazon Cognito account'
                    : 'Local sign-in (stubbed)'}
                </Text>
              </div>
            </Group>

            {mode === 'stub' && (
              <Alert variant="light" color="yellow" title="Stub authentication" role="note">
                <Text size="sm">
                  Cognito is not configured (<code>VITE_AUTH_MODE=stub</code>). Any username and
                  password sign you in locally.
                </Text>
              </Alert>
            )}

            <TextInput
              label="Username or email"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
            />
            <PasswordInput
              label="Password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />

            {error && (
              <Alert variant="light" color="red" icon={<IconAlertCircle size={16} />} role="alert">
                {error}
              </Alert>
            )}

            <Button type="submit" loading={submitting} fullWidth>
              Sign in
            </Button>

            <Text size="xs" c="dimmed" ta="center">
              Replaces Salesforce login for the Dreamhouse app.{' '}
              <Anchor href="https://docs.aws.amazon.com/cognito/" target="_blank" rel="noreferrer">
                Amazon Cognito
              </Anchor>
            </Text>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
