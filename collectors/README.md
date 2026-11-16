# Official-source discovery (initial framework)

The daily GitHub Actions workflow checks four initial source pages and extracts matching **official-site links**. It never invents deadlines, publication dates, eligibility, or pay. All records are inserted as `pending` and are not publicly visible until reviewed and marked `verified` in Supabase.

## Required GitHub configuration

Repository **Settings → Secrets and variables → Actions**:

- **Variables**: `SUPABASE_URL` = the Supabase project URL.
- **Secrets**: `SUPABASE_SERVICE_ROLE_KEY` = the **legacy service_role key** from Supabase API settings. Do not use the publishable key. Never commit or paste the service-role key into chat.

The workflow can be manually started from **Actions → Discover official opportunities → Run workflow**, or runs daily at 03:17 UTC (subject to GitHub scheduling delays).

## Caveats

This is a conservative discovery prototype, **not** full vacancy extraction. It respects robots.txt, skips pages whose robots policy cannot be checked, follows only same-site HTTPS links, and requires a matching link label. Dynamic pages, PDFs, blocked pages, and off-domain official recruitment portals may need dedicated adapters. A successful run can discover zero records. The `records_inserted` counter is currently recorded as zero because the API's ignore-duplicates response does not return a reliable inserted count.

Review candidate titles and actual advertisement PDFs, eligibility, publication dates and deadlines **before** changing `status` to `verified`. Do not mark an unverified link as verified. The source list is editable in `collectors/sources.json`. Additional categories and institution-specific collectors are future work.

Run locally without database access: `python collectors/collect.py --dry-run`.
