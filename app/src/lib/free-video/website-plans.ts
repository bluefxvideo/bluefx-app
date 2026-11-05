/**
 * The three website plans sold on a lead's website video page /v/<token>/website (owner 2026-11-04, copy in
 * docs/website-demo-sales-page-copy.md; names and prices match aispartan.com/pricing). Same order on phone and desktop,
 * because each plan builds on the one before.
 *
 * Every "Yes, start my new website" button opens FastSpring's popup cart with the plan's product and the lead's view
 * token as the tag freeVideoLead (the same way as the $49 unlock), so the webhook knows whose page sold it.
 * Every product path must contain WEBSITE_PLAN_MARKER: the FastSpring webhook then treats it as a done-for-you website
 * (logged only, never an app user, plan, credit or suspension change) and emails the owner the sale (website-demo.ts).
 */

export interface WebsitePlan {
  /** Short key for the page's click events. */
  key: 'seo' | 'growth' | 'allin';
  name: string;
  /** Monthly price in dollars. */
  price: number;
  /** The struck-out setup fee when setup is free; null when the plan has a setup fee. */
  setupWas: number | null;
  /** The one-time setup fee in dollars (All-In), charged by FastSpring with the first month. */
  setupFee: number | null;
  /** FastSpring product paths added to the cart (the subscription first). */
  products: string[];
  popular?: boolean;
}

/** Every website plan product path contains this (the webhook's done-for-you branch). */
export const WEBSITE_PLAN_MARKER = 'new-website';

export const WEBSITE_PLANS: readonly WebsitePlan[] = [
  { key: 'seo', name: 'Website + AI SEO', price: 299, setupWas: 997, setupFee: null, products: ['new-website-ai-seo'] },
  { key: 'growth', name: 'Growth Engine', price: 899, setupWas: 1997, setupFee: null, products: ['new-website-growth-engine'], popular: true },
  { key: 'allin', name: 'All-In', price: 1499, setupWas: null, setupFee: 2997, products: ['new-website-all-in'] },
];

export const WEBSITE_CHECKOUT = {
  /** FastSpring's popup cart (the same storefront as the Weekly Video Plan page); a server that is not live opens the test copy. */
  popupStorefront: 'bluefx.onfastspring.com/popup-bluefx',
  popupTestStorefront: 'bluefx.test.onfastspring.com/popup-bluefx',
  /** The hosted checkout, opened in a new tab while the popup script is not ready. */
  storefront: 'https://bluefx.onfastspring.com',
  tagKey: 'freeVideoLead',
} as const;

export const websitePlanByKey = (key: string) => WEBSITE_PLANS.find((plan) => plan.key === key) ?? null;

/** The plan an order's product paths belong to, or null. */
export const websitePlanOfProducts = (paths: string[]) =>
  WEBSITE_PLANS.find((plan) => paths.some((path) => path.toLowerCase() === plan.products[0].toLowerCase())) ?? null;

/** "$1,499/mo + $2,997 setup" / "$899/mo". */
export const planPriceLine = (plan: WebsitePlan) =>
  `$${plan.price.toLocaleString('en-US')}/mo${plan.setupFee ? ` + $${plan.setupFee.toLocaleString('en-US')} setup` : ''}`;
