import { Metadata } from 'next';
import { ManageOffersPage } from '@/components/script-generator/manage-offers-page';

export const metadata: Metadata = {
  title: 'Manage Offers | BlueFX AI',
  description: 'Add, edit, and delete affiliate offers for script generation.',
};

export default function ManageOffersRoute() {
  return <ManageOffersPage />;
}
