import { ReelEstatePage } from '@/components/reelestate/reelestate-page';

/**
 * ReelEstate Layout
 *
 * Renders ReelEstatePage once at the layout level so it stays mounted
 * across all sub-route navigations. Preserves React state (photos,
 * analyses, clips, etc.) without needing localStorage serialization.
 */
export default function ReelEstateLayout({
  children: _children,
}: {
  children: React.ReactNode;
}) {
  return <ReelEstatePage />;
}
