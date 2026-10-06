import { Anchor, Button, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/use-auth';

/**
 * What Salesforce shows a user whose profile/permission sets do not include the app or tab
 * ("You don't have access to this app"): signed in, but no `dreamhouse` (or `dreamhouse-admin`)
 * group — see app/api/src/auth/policy.ts for what each group opens.
 */
export function AccessDeniedPage({ scope = 'app' }: { scope?: 'app' | 'tab' }) {
  const { user, signOut } = useAuth();
  return (
    <Stack align="center" py="xl" data-testid="access-denied">
      <Title order={2}>Insufficient privileges</Title>
      <Text c="dimmed" ta="center" maw={480}>
        {scope === 'app'
          ? 'Your account is not in the Dreamhouse user group, so this app is not available to you. Ask an administrator to add you to the "dreamhouse" group.'
          : 'This tab needs the "dreamhouse-admin" group. Ask an administrator if you need it.'}
      </Text>
      {user ? (
        <Text size="sm" c="dimmed">
          Signed in as {user.username}
        </Text>
      ) : null}
      {scope === 'tab' ? (
        <Anchor component={Link} to="/">
          Back to Home
        </Anchor>
      ) : (
        <Button variant="light" onClick={() => void signOut()}>
          Sign out
        </Button>
      )}
    </Stack>
  );
}
