import { OfferContentEditor } from '@/components/script-generator/offer-content-editor';

interface EditOfferPageProps {
  params: Promise<{
    offerId: string;
  }>;
}

export default async function EditOfferPage({ params }: EditOfferPageProps) {
  const { offerId } = await params;
  return <OfferContentEditor offerId={offerId} mode="library" />;
}
