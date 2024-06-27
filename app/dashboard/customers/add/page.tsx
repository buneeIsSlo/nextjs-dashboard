import Form from '@/app/ui/customers/add-form';
import Breadcrumbs from '@/app/ui/invoices/breadcrumbs';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Add Customer',
};

export default async function Page() {
  return (
    <main>
      <Breadcrumbs
        breadcrumbs={[
          { label: 'Customers', href: '/dashboard/customers' },
          {
            label: 'Add Customer',
            href: '/dashboard/customers/add',
            active: true,
          },
        ]}
      />
      <Form />
    </main>
  );
}
