import { Anchor, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <Stack align="center" py="xl">
      <Title order={2}>Page not found</Title>
      <Text c="dimmed">There is no tab at this address.</Text>
      <Anchor component={Link} to="/">
        Back to Home
      </Anchor>
    </Stack>
  );
}
