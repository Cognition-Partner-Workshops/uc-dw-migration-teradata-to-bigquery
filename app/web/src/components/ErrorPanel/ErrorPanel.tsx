import { Anchor, Box, Stack, Text, Title } from '@mantine/core';
import { IconHomeSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { reduceErrors } from '@/lib/errors';

export type ErrorPanelType = 'inlineMessage' | 'noDataIllustration';

/**
 * Port of `c/errorPanel`: a friendly message with the reduced error details behind a
 * "Show details" toggle, rendered either as the "no data" illustration (default) or inline.
 */
export function ErrorPanel({
  errors,
  friendlyMessage = 'Error retrieving data',
  type = 'noDataIllustration',
}: {
  /** Single or array of errors (`reduceErrors` shapes). */
  errors?: unknown;
  /** Generic / user-friendly message. */
  friendlyMessage?: string;
  type?: ErrorPanelType;
}) {
  const [viewDetails, setViewDetails] = useState(false);
  const errorMessages = reduceErrors(errors);
  const hasDetails = errorMessages.length > 0;

  const details = hasDetails && viewDetails && (
    <Stack gap={2} data-testid="error-panel-details">
      {errorMessages.map((message) => (
        <Text size="sm" key={message}>
          {message}
        </Text>
      ))}
    </Stack>
  );

  if (type === 'inlineMessage') {
    return (
      <Box my="sm" data-testid="error-panel" data-type="inlineMessage">
        <Text c="red" size="sm" component="span" data-testid="error-panel-message">
          {friendlyMessage}.
          {hasDetails && (
            <>
              {' '}
              <Anchor
                component="button"
                type="button"
                size="sm"
                onClick={() => setViewDetails((v) => !v)}
              >
                Show details.
              </Anchor>
            </>
          )}
        </Text>
        {details}
      </Box>
    );
  }

  return (
    <Stack align="center" gap="xs" py="lg" data-testid="error-panel" data-type="noDataIllustration">
      <IconHomeSearch size={72} stroke={1} color="var(--mantine-color-gray-5)" aria-hidden />
      <Title order={3} size="h4" ta="center" data-testid="error-panel-message">
        {friendlyMessage}
      </Title>
      {hasDetails && (
        <Anchor
          component="button"
          type="button"
          size="sm"
          onClick={() => setViewDetails((v) => !v)}
        >
          Show details
        </Anchor>
      )}
      {details}
    </Stack>
  );
}
