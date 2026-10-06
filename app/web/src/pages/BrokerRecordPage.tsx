import { useParams } from 'react-router-dom';
import { MigrationPlaceholder } from '@/components/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader';

/** flexipages/Broker_Record_Page: highlights, details, related properties. */
export function BrokerRecordPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <PageHeader title={`Broker ${id ?? ''}`} subtitle="Broker record page." />
      <MigrationPlaceholder
        ticket="UNT3-22"
        sources={[
          { name: 'Broker_Record_Page', kind: 'flexipage' },
          { name: 'Broker__c-Broker Layout', kind: 'page layout' },
        ]}
      />
    </>
  );
}
