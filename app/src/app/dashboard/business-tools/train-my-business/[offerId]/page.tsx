import { OfferContentEditor } from '@/components/script-generator/offer-content-editor';

interface EditBusinessOfferPageProps {
  params: Promise<{
    offerId: string;
  }>;
}

export default async function EditBusinessOfferPage({ params }: EditBusinessOfferPageProps) {
  const { offerId } = await params;
  return <OfferContentEditor offerId={offerId} mode="business" />;
}
