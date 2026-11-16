# Opportunity Intelligence Portal

Public website: https://jk-verma.github.io/opportunity-intelligence-portal/

## Implemented
- Responsive public directory for six opportunity categories
- Verified-only Supabase data access, text search, category, deadline and decision filters, publication/deadline sorting
- No-login Applied, Skipped and Shortlisted tracking, notes and reference numbers stored locally in the browser
- Computed Missed status for expired opportunities without a decision
- Daily GitHub Actions collection with source-level error logging, conservative candidate filtering and regression tests
- Explicit-label extraction from accessible HTML pages, without fabricated deadlines or pay
- Institutional target registry, including all 21 IIMs

## Setup and security
- Browser config: `config.js` contains the **publishable** key only.
- GitHub Actions: repository variable `SUPABASE_URL`, repository secret `SUPABASE_SERVICE_ROLE_KEY`. Never commit or share the privileged key.
- Email authentication has been removed from the website. No SMTP or Supabase Auth redirect configuration is needed for public browsing or local tracking.
- Existing Supabase `user_applications` records and Auth users are not deleted. Existing RLS protections should remain enabled. The website no longer reads or writes this table.
- Supabase SQL Editor is the current manual verification console. Only an authorized administrator should change `status` from `pending` to `verified`.
- The public directory intentionally does not display `pending` records.
- Audit queries: `supabase/operations.sql`.

## Operational limitations
- A green workflow does not guarantee any vacancies were discovered; check source-specific logs.
- Pilot source URLs may block GitHub runners or return no advertisement links.
- The institution registry is a **coverage roadmap**, not an assertion that all adapters work.
- PDFs, JavaScript-rendered portals, cross-domain application systems, and deadline timezone interpretation require dedicated source adapters.
- No unverified opportunity is auto-published; date-only deadlines remain blank rather than assuming a cutoff time or timezone.
- Existing pending generic World Bank navigation records are not automatically deleted.
- Decisions, notes and references are saved in browser localStorage only, not synchronized between devices. Clearing site data deletes local tracking; shared-device users should avoid entering sensitive notes.
- The current list request is capped at 1,000 verified records; server-side pagination is a future scalability improvement.

## Quality checks
`python -m unittest discover -s collectors -p 'test_*.py'`

## Roadmap
1. Confirm real official recruitment endpoints and build source-specific adapters for each IIM/IIFT and other targets.
2. Add PDF extraction with citation to advertisement sections and timezone-aware deadlines.
3. Implement a secure administrator verification queue, history tracking and structured changes without exposing privileged credentials in the public site.
4. Add paginated search, email notifications and full coverage metrics.
