import { Grid, Stack } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Port of the Aura page template `pageTemplate_2_7_3` ("Three columns layout (Just one on
 * mobile)"): 2/7/3 columns from the `md` breakpoint up, a single stacked column below it.
 */
export function ThreeColumnLayout({
  left,
  center,
  right,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <Grid gutter="md" data-testid="three-column-layout">
      <Grid.Col span={{ base: 12, md: 2 }}>
        <Stack gap="md" data-testid="layout-left">
          {left}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 7 }}>
        <Stack gap="md" data-testid="layout-center">
          {center}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 3 }}>
        <Stack gap="md" data-testid="layout-right">
          {right}
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
