# Resend mailing lists

Subscriber addresses and API keys should not be committed to Git. The live forms store contacts in private Resend Segments; this repository stores the forms, API integration, and one broadcast template per Scope for Imagination journal entry.

If an API key is pasted into chat, an issue, or any committed file, revoke it in Resend and create a replacement key.

## One-time Resend setup

1. Create a Resend account.
2. Use `onboarding@resend.dev` only for testing to the email address attached to the Resend account.
3. Add and verify a domain you own before sending to anyone else. Resend recommends a sending subdomain, such as `updates.example.com`, with its DNS records configured in your DNS provider.
   - If Resend accepts `aaronwriight.github.io`, continue only if it can also verify the DNS records. Accepting the domain string is not enough for public sending.
   - If DNS verification stalls because there is nowhere to add Resend's TXT/MX/DKIM records for the `github.io` subdomain, use a custom domain or subdomain that you control through a DNS provider.
4. Create two Segments:
   - `Scope for Imagination`
   - `Frame It Wright Photography`
5. Create string Contact Properties for:
   - `source`
   - `interest`
   - `photography_interest`
   - `location`
   - `notes`
6. Create an API key.
7. Add these environment variables locally and in Vercel:

```text
RESEND_API_KEY=re_...
RESEND_SFI_SEGMENT_ID=...
RESEND_PHOTOGRAPHY_SEGMENT_ID=...
SFI_NEWSLETTER_FROM=Scope for Imagination <journal@updates.your-verified-domain.com>
NEXT_PUBLIC_SITE_URL=https://aaronwriight.vercel.app
NEXT_PUBLIC_SANITY_PROJECT_ID=...
NEXT_PUBLIC_SANITY_DATASET=production
NEXT_PUBLIC_SANITY_API_VERSION=2024-02-22
# Optional: only needed if published Sanity posts are not publicly readable.
SANITY_API_READ_TOKEN=...
# Optional: only needed for the legacy Sanity mirror tool.
SANITY_API_WRITE_TOKEN=...
```

Until the relevant variables are configured, each signup form safely reports that signup is still being configured.

## Before Launch

- Revoke any API key that has been pasted into chat or a public issue, then create a fresh key for Vercel.
- Confirm the sending domain is `Verified` in Resend. A domain name being accepted in the Resend UI is not enough; the DNS records must verify.
- Confirm both segment IDs in Vercel match the intended Resend Segments.
- Confirm all Contact Properties above exist before testing live submissions, otherwise Resend can reject contacts that include those properties.
- Submit one test signup for each form and confirm the contact appears in the correct segment.
- Use the in-page unsubscribe form with a test address and confirm the contact becomes globally unsubscribed in Resend.

## Forms

- `/scope-for-imagination/mailing-list` adds subscribers to `RESEND_SFI_SEGMENT_ID`.
- `/frame-it-wright-photography/mailing-list` adds contacts to `RESEND_PHOTOGRAPHY_SEGMENT_ID` with lightweight intake properties for photography interest, location, and notes.
- The unsubscribe form calls `/api/newsletter/unsubscribe` and sets the contact's global Resend unsubscribe status.
- The API routes always return JSON and opt out of caching, so browser/proxy errors should stay understandable in the form UI.

## Publishing And Email Workflow

The canonical author and newsletter workflow is documented in [`writing/README.md`](../writing/README.md). In brief, publish and verify the post first, then create a Resend draft with:

```sh
pnpm writing newsletter NNNN
```

Preview newsletter generation without contacting Resend with `--dry-run`. Immediate sending requires the explicit `--send` flag and an interactive confirmation unless `--yes` is deliberately supplied. Publishing a post never emails the list automatically.
