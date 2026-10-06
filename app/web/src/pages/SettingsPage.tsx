import { PageHeader } from '@/components/PageHeader/PageHeader';
import { SampleDataImporter } from '@/components/SampleDataImporter/SampleDataImporter';

/** flexipages/Settings: sampleDataImporter (route guarded for dreamhouse-admin in routes.tsx). */
export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Import the sample brokers, properties and contacts." />
      <SampleDataImporter />
    </>
  );
}
