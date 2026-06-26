/**
 * BRAND SWAP-IN — single source of truth for the brand name.
 *
 * When Task 01 (naming & trademark clearance) lands a cleared name:
 *   1. Set `name` to the cleared word (e.g. "Kineta").
 *   2. Set `wordmark` to the public path of the logo asset (e.g. "/images/wordmark.svg").
 *   3. Drop the asset into /public/images/.
 *   4. Redeploy.
 *
 * Every appearance of the brand — nav, hero, <title>, OG tags, footer,
 * confirmation email — is drawn from this file. No other file needs editing.
 * While `name` is null the UI falls back gracefully to the tagline + mission.
 */
export const BRAND = {
  name: null as string | null,
  wordmark: null as string | null,
  tagline: "Capital in Motion",
  mission: "A new way for women to fund the future of their own health.",
  description:
    "A UK community-funded vehicle backing women's health ventures. " +
    "Everyday women co-own the future of their own healthcare — coming soon.",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
};
