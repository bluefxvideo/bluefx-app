#!/usr/bin/env tsx

import { createClient as createNewClient } from '@/app/supabase/server';

interface LegacyOffer {
  id: number;
  product_name: string;
  category: string | null;
  current_gravity_score: string | null;
  initial_conversion: string | null;
  future_rebill: string | null;
  description: string | null;
  average_conversion: string | null;
  affiliate_page_link: string | null;
  product_link: string | null;
  seller_contact: string | null;
  last_updated: string | null;
  current_position: number | null;
}

interface NewOffer {
  clickbank_id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  vendor_name: string;
  gravity_score: number;
  commission_rate: number | null;
  average_dollar_per_sale: number | null;
  initial_dollar_per_sale: number | null;
  refund_rate: number | null;
  has_recurring_products: boolean | null;
  mobile_optimized: boolean | null;
  affiliate_page_url: string | null;
  sales_page_url: string | null;
  is_active: boolean;
  created_at: string;
}

function extractVendorFromProduct(productLink: string | null): string {
  if (!productLink) return 'Unknown Vendor';
  
  const match = productLink.match(/vendor=([A-Z0-9]+)/);
  if (match) {
    // Convert to readable format: MITOLYN -> Mitolyn
    return match[1].charAt(0) + match[1].slice(1).toLowerCase();
  }
  
  return 'Unknown Vendor';
}

function extractClickBankId(productLink: string | null): string {
  if (!productLink) return `CB${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  const match = productLink.match(/vendor=([A-Z0-9]+)/);
  return match ? match[1] : `CB${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

function parseCategory(category: string | null): { main: string; sub: string | null } {
  if (!category) return { main: 'Uncategorized', sub: null };
  
  const parts = category.split(' - ');
  return {
    main: parts[0]?.trim() || 'Uncategorized',
    sub: parts[1]?.trim() || null
  };
}

function transformLegacyOffer(legacy: LegacyOffer): NewOffer {
  const categoryParts = parseCategory(legacy.category);
  const vendorName = extractVendorFromProduct(legacy.product_link);
  const clickbankId = extractClickBankId(legacy.product_link);
  
  return {
    clickbank_id: clickbankId,
    title: legacy.product_name,
    description: legacy.description,
    category: categoryParts.main,
    subcategory: categoryParts.sub,
    vendor_name: vendorName,
    gravity_score: parseFloat(legacy.current_gravity_score || '0'),
    commission_rate: legacy.initial_conversion ? parseFloat(legacy.initial_conversion) / 100 : null,
    average_dollar_per_sale: legacy.average_conversion ? parseFloat(legacy.average_conversion) : null,
    initial_dollar_per_sale: legacy.future_rebill ? parseFloat(legacy.future_rebill) : null,
    refund_rate: null, // Not available in legacy data
    has_recurring_products: legacy.future_rebill ? parseFloat(legacy.future_rebill) > 0 : null,
    mobile_optimized: null, // Not available in legacy data  
    affiliate_page_url: legacy.affiliate_page_link,
    sales_page_url: legacy.product_link,
    is_active: true,
    created_at: legacy.last_updated || new Date().toISOString()
  };
}

export async function importSampleData() {
  console.log('🔄 Importing Sample Legacy Data...');
  
  // Sample data from legacy MCP query (top 10 offers)
  const sampleLegacyData: LegacyOffer[] = [
    {
      "id": 45948,
      "product_name": "MITOLYN - $200 CPA! Join Our $340k+ Sales Contest Go To mitolyn.vip",
      "category": "Health & Fitness - Dietary Supplements",
      "current_gravity_score": "766.05",
      "initial_conversion": "151.96",
      "future_rebill": "0.03",
      "description": "CB's #1 Offer By The Team That Delivers. 85% Revshare and $200 CPA Available! Go To mitolyn.vip To Join Our 2025 Sales Contest ($340k+ Pr Read more",
      "average_conversion": "151.97",
      "affiliate_page_link": "https://mitolyn.com/affiliates/",
      "product_link": "https://hop.clickbank.net/?affiliate=zzzzz&vendor=MITOLYN",
      "seller_contact": "Seller Contact",
      "last_updated": "2025-04-17 04:08:06+00",
      "current_position": 1
    },
    {
      "id": 1,
      "product_name": "MITOLYN",
      "category": "Health & Fitness - Dietary Supplements",
      "current_gravity_score": "717.93",
      "initial_conversion": "159.87",
      "future_rebill": "0.01",
      "description": "Get $200 CPA or 85% Revshare! Go to mitolyn.com/affiliates/",
      "average_conversion": "159.87",
      "affiliate_page_link": "https://mitolyn.com/affiliates/",
      "product_link": "https://hop.clickbank.net/?affiliate=zzzzz&vendor=MITOLYN",
      "seller_contact": "Seller Contact",
      "last_updated": "2025-04-26 04:08:02+00",
      "current_position": 1
    },
    {
      "id": 2,
      "product_name": "PrimeBiome - $4 EPC On Our Doctor-Endorsed Skin-Gut Gummies",
      "category": "Health & Fitness - Beauty",
      "current_gravity_score": "279.51",
      "initial_conversion": null,
      "future_rebill": null,
      "description": "Powerful Pitch, Multiple Intros Available, 100% Backed By Science. Top Affs Are Scoring Up To $4 EPC. Limited Slots Only. Contact Us To G Read more",
      "average_conversion": "147.11",
      "affiliate_page_link": "https://getprimebiome.com/help/affiliates.php",
      "product_link": "https://hop.clickbank.net/?affiliate=zzzzz&vendor=PRIMEBIOME",
      "seller_contact": "Seller Contact",
      "last_updated": "2025-04-26 04:08:02+00",
      "current_position": 2
    },
    {
      "id": 5,
      "product_name": "ProDentim - The Biggest Monster In The Dental Niche",
      "category": "Health & Fitness - Dental Health",
      "current_gravity_score": "157.98",
      "initial_conversion": null,
      "future_rebill": null,
      "description": "Doctor Endorsed & Unique Formula With This Probiotic Soft Candy. The newly refreshed version is climbing full speed! More than $4 EPC! Cr Read more",
      "average_conversion": "129.08",
      "affiliate_page_link": "https://myprodentim101.com/help/affiliates.php",
      "product_link": "https://hop.clickbank.net/?affiliate=zzzzz&vendor=PRODENTIM",
      "seller_contact": "Seller Contact",
      "last_updated": "2025-04-26 04:08:02+00",
      "current_position": 5
    },
    {
      "id": 4,
      "product_name": "ProstaVive - Powerhouse Prostate Offer",
      "category": "Health & Fitness - Men's Health",
      "current_gravity_score": "156.46",
      "initial_conversion": null,
      "future_rebill": null,
      "description": "Heavyweight prostate offer! Converts like gangbusters. Optimized fully with massive AOV and EPCs. Top diamond vendor team.",
      "average_conversion": "141.38",
      "affiliate_page_link": "https://prostavive.org/affiliates",
      "product_link": "https://hop.clickbank.net/?affiliate=zzzzz&vendor=PROVIVE",
      "seller_contact": "Seller Contact",
      "last_updated": "2025-04-26 04:08:02+00",
      "current_position": 3
    }
  ];
  
  try {
    const newClient = await createNewClient();
    
    // Transform legacy data
    const transformedOffers = sampleLegacyData.map(transformLegacyOffer);
    
    console.log(`Importing ${transformedOffers.length} sample offers...`);
    
    // Clear existing data
    await newClient.from('clickbank_offers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Insert transformed data
    const { error: insertError } = await newClient
      .from('clickbank_offers')
      .insert(transformedOffers);
    
    if (insertError) {
      throw new Error(`Insert error: ${insertError.message}`);
    }
    
    // Verify
    const { count } = await newClient
      .from('clickbank_offers')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Sample migration complete! ${count} offers imported`);
    
    return { success: true, imported: count };
    
  } catch (error) {
    console.error('Sample migration failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function main() {
  console.log('🔄 BlueFX Sample Data Migration');
  console.log('===============================\n');
  
  const result = await importSampleData();
  
  if (result.success) {
    console.log('\n🎉 Sample migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Test the UI with imported data');
    console.log('2. Run full migration for all 1,193 offers if sample works');
    process.exit(0);
  } else {
    console.log('\n❌ Sample migration failed:', result.error);
    process.exit(1);
  }
}

main();