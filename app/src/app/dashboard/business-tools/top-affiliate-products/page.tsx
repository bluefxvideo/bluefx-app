import { TopAffiliateProductsPage } from '@/components/script-generator/top-affiliate-products-page';

// TODO: Replace with actual admin check from auth
const isAdmin = true; // For now, show admin view

export default function TopAffiliateProductsRoute() {
  return <TopAffiliateProductsPage isAdmin={isAdmin} />;
}
