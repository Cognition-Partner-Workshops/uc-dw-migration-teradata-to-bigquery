import { MigrationPlaceholder } from '@/components/MigrationPlaceholder/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader/PageHeader';

export function PropertiesPage() {
  return (
    <>
      <PageHeader title="Properties" subtitle="Property__c list view." />
      <MigrationPlaceholder
        ticket="UNT3-22"
        sources={[
          { name: 'Property__c', kind: 'custom object (list view)' },
          { name: 'Property__c-Property Layout', kind: 'page layout' },
        ]}
      />
    </>
  );
}
