import { CreatePropertyWizard } from '@/components/CreatePropertyWizard/CreatePropertyWizard';
import { PageHeader } from '@/components/PageHeader/PageHeader';

/** flows/Create_property (flowruntime:interview on Property_Explorer) at /properties/new. */
export function CreatePropertyPage() {
  return (
    <>
      <PageHeader
        title="Create Property"
        subtitle="Create a new property in a few clicks; the address is geocoded on save."
      />
      <CreatePropertyWizard />
    </>
  );
}
