# Opportunity Intelligence Portal

Public website: https://jk-verma.github.io/opportunity-intelligence-portal/

## Implemented
- Responsive public directory for six opportunity categories
- Verified-only Supabase data access, text search, category, deadline and decision filters, publication/deadline sorting
- Email-link Supabase Auth integration and private Applied, Skipped and Shortlisted tracking, notes and reference numbers
- Computed Missed status for expired opportunities without a decision
- Daily GitHub Actions collection with source-level error logging, conservative candidate filtering and regression tests
- Explicit-label extraction from accessible HTML pages, without fabricated deadlines or pay
- Institutional target registry, including all 21 IIMs

## Setup and security
- Browser config: `config.js` contains the **publishable** key only.
- GitHub Actions: repository variable `SUPABASE_URL`, repository secret `SUPABASE_SERVICE_ROLE_KEY`. Never commit or share the privileged key.
- Supabase Auth: enable email OTP/magic-link authentication. Add `https://jk-verma.github.io/opportunity-intelligence-portal/` to Auth URL Configuration > Redirect URLs. If email delivery is rate-limited, configure a production SMTP provider.
- RLS must restrict `user_applications` to the signed-in user. The portal does not expose service-role credentials.
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
- Login tokens persist for the current browser-tab session; users may need to sign in again when the session expires.
- The current list request is capped at 1,000 verified records; server-side pagination is a future scalability improvement.

## Quality checks
`python -m unittest discover -s collectors -p 'test_*.py'`

## Roadmap
1. Confirm real official recruitment endpoints and build source-specific adapters for each IIM/IIFT and other targets.
2. Add PDF extraction with citation to advertisement sections and timezone-aware deadlines.
3. Implement an authenticated administrator verification queue, history tracking and structured changes.
4. Add paginated search, email notifications and full coverage metrics.
