-- ============================================================
-- GSC Improvements: keyword_id linking helper + indexes
-- ============================================================

-- RPC function to link gsc_snapshots rows to keywords rows by exact
-- (case-insensitive) query/keyword match within the same project.
-- Called after every GSC sync — idempotent.
create or replace function link_gsc_keyword_ids(p_project_id uuid)
returns void language plpgsql as $$
begin
  update gsc_snapshots gs
  set keyword_id = k.id
  from keywords k
  where gs.project_id = p_project_id
    and k.project_id = p_project_id
    and lower(gs.query) = lower(k.keyword)
    and gs.keyword_id is null;
end;
$$;

-- Faster quick-wins and performance queries
create index if not exists gsc_snapshots_position_idx
  on gsc_snapshots(project_id, position, snapshot_date);

create index if not exists gsc_snapshots_query_idx
  on gsc_snapshots(project_id, query);
