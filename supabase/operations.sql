-- Read-only operational audit. Run in Supabase SQL Editor.
-- No public or anonymous permissions are changed.
select collector_name,category,run_status,records_found,records_inserted,
       finished_at,error_message
from public.collection_runs
order by finished_at desc
limit 100;

select category,status,count(*) as records
from public.opportunities
group by category,status
order by category,status;

-- Pending review queue, newest first.
select id,title,category,official_url,published_at,deadline_at,
       eligibility,qualifications,experience_required,pay_details,source_identifier
from public.opportunities
where status='pending'
order by created_at desc
limit 200;

-- Review records manually in Supabase Table Editor.
-- Do NOT mark a record verified without opening and validating its
-- official advertisement, identity, current status and closing date.
-- Existing generic World Bank career navigation records should be
-- rejected after review, not promoted to verified.
