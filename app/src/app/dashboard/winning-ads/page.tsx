import { WinningAdsPage } from '@/components/winning-ads/winning-ads-page';

export default function WinningAdsRoute() {
  // TikTok library was removed because TikTok Creative Center is now
  // client-rendered and the Clone-Ad flow can't reliably fetch fresh
  // video URLs. Default to Facebook, which still works end-to-end.
  return <WinningAdsPage platform="facebook" />;
}
