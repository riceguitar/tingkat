-- ============================================================
-- Tingkat SEO Suite — Initial Schema
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- PROJECTS
-- ============================================================
create table projects (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  domain        text not null,
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- CMS CONNECTIONS (WordPress)
-- ============================================================
create table cms_connections (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references projects(id) on delete cascade,
  type                text not null default 'wordpress',
  site_url            text not null,
  username            text not null,
  encrypted_password  text not null,
  iv                  text not null,
  auth_tag            text not null,
  default_author_id   integer,
  default_status      text not null default 'draft',
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(project_id)
);

-- ============================================================
-- KEYWORD CLUSTERS
-- ============================================================
create table keyword_clusters (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  color       text not null default '#6366f1',
  intent      text,
  description text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- KEYWORDS
-- ============================================================
create table keywords (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  cluster_id      uuid references keyword_clusters(id) on delete set null,
  keyword         text not null,
  search_volume   integer,
  difficulty      numeric(5,2),
  cpc             numeric(10,2),
  intent          text,
  competition     numeric(5,4),
  trend           jsonb,
  last_fetched_at timestamptz,
  created_at      timestamptz not null default now(),
  unique(project_id, keyword)
);

create index keywords_project_id_idx on keywords(project_id);
create index keywords_cluster_id_idx on keywords(cluster_id);

-- ============================================================
-- ARTICLES
-- ============================================================
create type article_status as enum ('draft', 'scheduled', 'publishing', 'published', 'failed');

create table articles (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references projects(id) on delete cascade,
  keyword_id          uuid references keywords(id) on delete set null,
  cluster_id          uuid references keyword_clusters(id) on delete set null,
  title               text,
  slug                text,
  meta_description    text,
  content             text,
  outline             jsonb,
  tone                text default 'professional',
  target_word_count   integer default 1500,
  actual_word_count   integer,
  status              article_status not null default 'draft',
  scheduled_at        timestamptz,
  published_at        timestamptz,
  wordpress_post_id   integer,
  wordpress_post_url  text,
  publish_attempts    integer not null default 0,
  last_publish_error  text,
  featured_image_url  text,
  wp_categories       integer[],
  wp_tags             text[],
  generation_model    text default 'claude-sonnet-4-6',
  generation_prompt   text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index articles_project_id_idx on articles(project_id);
create index articles_status_idx on articles(status);
create index articles_scheduled_at_idx on articles(scheduled_at) where status = 'scheduled';

-- ============================================================
-- RANK SNAPSHOTS
-- ============================================================
create table rank_snapshots (
  id            uuid primary key default uuid_generate_v4(),
  keyword_id    uuid not null references keywords(id) on delete cascade,
  project_id    uuid not null references projects(id) on delete cascade,
  position      numeric(6,1),
  url           text,
  device        text not null default 'desktop',
  location      text not null default 'US',
  snapshot_date date not null default current_date,
  created_at    timestamptz not null default now(),
  unique(keyword_id, device, location, snapshot_date)
);

create index rank_snapshots_keyword_id_idx on rank_snapshots(keyword_id);
create index rank_snapshots_date_idx on rank_snapshots(snapshot_date);

-- ============================================================
-- GSC SNAPSHOTS
-- ============================================================
create table gsc_snapshots (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references projects(id) on delete cascade,
  keyword_id    uuid references keywords(id) on delete set null,
  query         text not null,
  page          text,
  snapshot_date date not null,
  impressions   integer not null default 0,
  clicks        integer not null default 0,
  ctr           numeric(6,4),
  position      numeric(6,2),
  created_at    timestamptz not null default now(),
  unique(project_id, query, page, snapshot_date)
);

create index gsc_snapshots_project_id_idx on gsc_snapshots(project_id);
create index gsc_snapshots_date_idx on gsc_snapshots(snapshot_date);

-- ============================================================
-- GSC OAUTH TOKENS
-- ============================================================
create table gsc_tokens (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references projects(id) on delete cascade,
  access_token      text not null,
  refresh_token     text not null,
  token_iv          text not null,
  token_auth_tag    text not null,
  expires_at        timestamptz not null,
  gsc_property_url  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(project_id)
);

-- ============================================================
-- APP SETTINGS
-- ============================================================
create table app_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('default_tone', 'professional'),
  ('default_word_count', '1500'),
  ('rank_check_frequency', 'daily'),
  ('gsc_sync_frequency', 'daily');

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

create trigger articles_updated_at
  before update on articles
  for each row execute function set_updated_at();

create trigger cms_connections_updated_at
  before update on cms_connections
  for each row execute function set_updated_at();

create trigger gsc_tokens_updated_at
  before update on gsc_tokens
  for each row execute function set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table projects           enable row level security;
alter table cms_connections    enable row level security;
alter table keyword_clusters   enable row level security;
alter table keywords           enable row level security;
alter table articles           enable row level security;
alter table rank_snapshots     enable row level security;
alter table gsc_snapshots      enable row level security;
alter table gsc_tokens         enable row level security;
alter table app_settings       enable row level security;

create policy "authenticated_full_access" on projects
  for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on cms_connections
  for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on keyword_clusters
  for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on keywords
  for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on articles
  for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on rank_snapshots
  for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on gsc_snapshots
  for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on gsc_tokens
  for all using (auth.role() = 'authenticated');
create policy "authenticated_full_access" on app_settings
  for all using (auth.role() = 'authenticated');
