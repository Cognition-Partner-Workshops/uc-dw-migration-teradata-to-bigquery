import { MigrationPlaceholder } from '@/components/MigrationPlaceholder/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader/PageHeader';

export function ContactsPage() {
  return (
    <>
      <PageHeader title="Contacts" subtitle="Standard Contact object — sample data only." />
      <MigrationPlaceholder
        ticket="UNT3-22"
        sources={[
          { name: 'Contact', kind: 'standard object (list view)' },
          { name: 'listContactsFromDevice', kind: 'LWC (mobile only)' },
        ]}
      />
    </>
  );
}
