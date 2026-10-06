import { MigrationPlaceholder } from '@/components/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader';

/** flexipages/Settings: sampleDataImporter. */
export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Import the sample brokers, properties and contacts." />
      <MigrationPlaceholder
        ticket="UNT3-22"
        sources={[
          { name: 'sampleDataImporter', kind: 'LWC' },
          { name: 'SampleDataController', kind: 'Apex (POST /sample-data/import)' },
        ]}
      />
    </>
  );
}
