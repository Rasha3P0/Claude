# Capital in Motion — Community Waitlist Landing Page

Community interest registration page for the women's health capital venture.
Built nameless-first: the brand name drops in via a single config edit when
Task 01 (naming & trademark clearance) is complete.

## Brand Swap-In

When a cleared brand name is confirmed, open **`/config/brand.ts`** and make
two edits:

```ts
export const BRAND = {
  name: "Kineta",                    // ← set the cleared name here
  wordmark: "/images/wordmark.svg",   // ← path to logo asset in /public
  ...
};
```

Then add the wordmark file to `landing/public/images/` and redeploy.

Every appearance of the brand — nav, hero, `<title>`, OG/Twitter meta tags,
footer, and confirmation email — is drawn from this one file. Nothing else
needs editing.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values.

### Google Sheets (waitlist storage)

| Variable | Description |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account email from GCP |
| `GOOGLE_PRIVATE_KEY` | Private key (paste with `\n` line breaks) |
| `GOOGLE_SHEETS_ID` | ID from the Sheet URL: `/spreadsheets/d/<ID>/edit` |

Share the spreadsheet with the service account email (Editor) and ensure
it has a `Sheet1` tab with at least columns A and B.

### Gmail (confirmation email)

| Variable | Description |
|---|---|
| `GMAIL_CLIENT_ID` | OAuth2 client ID from GCP |
| `GMAIL_CLIENT_SECRET` | OAuth2 client secret from GCP |
| `GMAIL_REFRESH_TOKEN` | Obtained via [OAuth2 Playground](https://developers.google.com/oauthplayground) with scope `https://www.googleapis.com/auth/gmail.send` |
| `GMAIL_FROM_EMAIL` | The Gmail address that sends confirmations |

## Deploy to Vercel

1. Connect the `rasha3p0/claude` repo to Vercel.
2. Set **Root Directory** to `landing/`.
3. Add all environment variables from `.env.example`.
4. Deploy. The default Vercel subdomain is your holding URL.

Do **not** purchase a premium domain while the brand name is unresolved.
The Vercel subdomain is the correct holding URL.

## Local Development

```bash
cd landing
npm install
cp .env.example .env.local
# fill in .env.local
npm run dev
```

## Financial Promotions Note

All copy is scoped to community interest registration. Nothing on the page
constitutes an offer, invitation, or solicitation to invest. The `POST
/api/waitlist` response also echoes this. If any copy change risks crossing
into financial promotion territory, refer to `phase1-regulatory-scoping.md`
and take legal advice before publishing.
