import { Grid, Paper, Text } from '@mantine/core';
import { MapView } from '@/components/MapView';
import { MigrationPlaceholder } from '@/components/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader';

/** flexipages/Property_Explorer: filter + Create_property flow | tile list | summary + map. */
export function PropertyExplorerPage() {
  return (
    <>
      <PageHeader
        title="Property Explorer"
        subtitle="Browse listings as tiles, filter them and see the selected one on a map."
      />
      <MigrationPlaceholder
        ticket="UNT3-21"
        sources={[
          { name: 'propertyFilter', kind: 'LWC' },
          { name: 'propertyTileList', kind: 'LWC' },
          { name: 'propertyTile', kind: 'LWC' },
          { name: 'paginator', kind: 'LWC' },
          { name: 'propertySummary', kind: 'LWC' },
          { name: 'propertyMap', kind: 'LWC' },
          { name: 'Create_property', kind: 'screen flow' },
          { name: 'FiltersChange / PropertySelected', kind: 'Lightning Message Channels' },
        ]}
      >
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper withBorder p="md" h="100%">
              <Text c="dimmed" size="sm">
                Property tiles will render here (GET /properties).
              </Text>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <MapView height={280} />
          </Grid.Col>
        </Grid>
      </MigrationPlaceholder>
    </>
  );
}
