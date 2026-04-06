-- Project local SEO profile fields
alter table projects add column if not exists business_type text;
alter table projects add column if not exists business_name text;
alter table projects add column if not exists city text;
alter table projects add column if not exists state_province text;
alter table projects add column if not exists country_code text not null default 'US';
alter table projects add column if not exists location_code integer not null default 2840;
alter table projects add column if not exists service_areas text[] not null default '{}';
alter table projects add column if not exists nap_address text;
alter table projects add column if not exists nap_phone text;
alter table projects add column if not exists primary_category text;

-- Local pack snapshot tracking
create table if not exists local_pack_snapshots (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects(id) on delete cascade,
  keyword_id     uuid references keywords(id) on delete set null,
  keyword        text not null,
  position       integer,          -- 1, 2, or 3; null if domain not in pack
  pack_present   boolean not null default false,
  snapshot_date  date not null,
  location       text not null default 'US',
  created_at     timestamptz not null default now(),
  unique(project_id, keyword, snapshot_date, location)
);

alter table local_pack_snapshots enable row level security;
create policy "Users manage their local pack snapshots" on local_pack_snapshots
  using (project_id in (select id from projects));

create index local_pack_snapshots_project_date_idx on local_pack_snapshots(project_id, snapshot_date desc);
