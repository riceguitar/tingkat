-- Project sitemaps (user-pasted sitemap URLs)
create table project_sitemaps (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  url             text not null,
  last_crawled_at timestamptz,
  page_count      integer not null default 0,
  created_at      timestamptz not null default now(),
  unique(project_id, url)
);

alter table project_sitemaps enable row level security;
create policy "Users manage their project sitemaps" on project_sitemaps
  using (project_id in (select id from projects));

-- Individual pages discovered from sitemaps
create table sitemap_pages (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  sitemap_id      uuid references project_sitemaps(id) on delete cascade,
  url             text not null,
  title           text,
  description     text,
  h1              text,
  word_count      integer,
  last_fetched_at timestamptz,
  created_at      timestamptz not null default now(),
  unique(project_id, url)
);

alter table sitemap_pages enable row level security;
create policy "Users manage their sitemap pages" on sitemap_pages
  using (project_id in (select id from projects));

create index sitemap_pages_project_idx on sitemap_pages(project_id);
create index sitemap_pages_title_idx on sitemap_pages using gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(h1, '') || ' ' || coalesce(description, '')));
