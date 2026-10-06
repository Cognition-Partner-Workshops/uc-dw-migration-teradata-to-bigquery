import { MigrationPlaceholder } from '@/components/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader';

export function BrokersPage() {
  return (
    <>
      <PageHeader title="Brokers" subtitle="Broker__c list view." />
      <MigrationPlaceholder
        ticket="UNT3-22"
        sources={[
          { name: 'Broker__c', kind: 'custom object (list view)' },
          { name: 'Broker__c-Broker Layout', kind: 'page layout' },
        ]}
      />
    </>
  );
}
