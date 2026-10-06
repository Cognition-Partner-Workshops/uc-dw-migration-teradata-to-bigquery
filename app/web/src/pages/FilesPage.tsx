import { MigrationPlaceholder } from '@/components/MigrationPlaceholder/MigrationPlaceholder';
import { PageHeader } from '@/components/PageHeader/PageHeader';

export function FilesPage() {
  return (
    <>
      <PageHeader title="Files" subtitle="Property pictures uploaded through the app." />
      <MigrationPlaceholder
        ticket="UNT3-22"
        sources={[
          { name: 'ContentVersion / ContentDocumentLink', kind: 'standard objects' },
          { name: 'FileUtilities', kind: 'Apex (POST /files)' },
        ]}
      />
    </>
  );
}
