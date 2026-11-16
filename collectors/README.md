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

## Advertisement-level filtering (version 2)

The collector now rejects generic careers/navigation pages and requires a specific recruitment, funding, tender, award, or fellowship cue in the link label (or an advertisement-number pattern or a suitably labeled official document). Unit tests run before each scheduled collection. This is **candidate detection**, not a guarantee that a linked page is a current, open, eligible vacancy.

**Structured extraction of publication dates, deadlines, qualifications, and pay is not yet implemented.** These fields remain empty rather than being inferred. No automatic promotion to `verified` occurs. Previously inserted generic pending records are not automatically deleted or modified, and must be reviewed separately.

A green workflow may include source timeouts, which are logged in `collection_runs` as failures for the affected source. Generic navigation is filtered more aggressively, so a source may produce zero candidates.

Run unit tests: `python -m unittest discover -s collectors -p 'test_*.py'`.
