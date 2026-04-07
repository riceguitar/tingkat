-- ============================================================
-- Multi-Tenancy: Accounts, Members, Credentials + RLS Rewrite
-- ============================================================

begin;

-- ============================================================
-- 1. New tables: accounts, account_members, account_credentials
-- ============================================================

create table accounts (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table account_members (
  id          uuid primary key default uuid_generate_v4(),
  account_id  uuid not null references accounts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  unique(account_id, user_id)
);

create index account_members_user_id_idx on account_members(user_id);
create index account_members_account_id_idx on account_members(account_id);

create table account_credentials (
  id               uuid primary key default uuid_generate_v4(),
  account_id       uuid not null references accounts(id) on delete cascade,
  key              text not null,
  encrypted_value  text not null,
  iv               text not null,
  auth_tag         text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique(account_id, key)
);

-- updated_at triggers
create or replace function update_updated_at_column()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger accounts_updated_at before update on accounts
  for each row execute function update_updated_at_column();

create trigger account_credentials_updated_at before update on account_credentials
  for each row execute function update_updated_at_column();

-- ============================================================
-- 2. Add account_id to projects (nullable first for data migration)
-- ============================================================

alter table projects add column if not exists account_id uuid references accounts(id) on delete cascade;

-- ============================================================
-- 3. Data migration: create legacy account, assign all projects and users
-- ============================================================

do $$ declare
  v_account_id uuid;
begin
  -- Create the legacy account
  insert into public.accounts(name)
  values ('Legacy Account')
  returning id into v_account_id;

  -- Assign all existing projects to this account
  update public.projects set account_id = v_account_id;

  -- Add every existing user as an owner of the legacy account
  insert into public.account_members(account_id, user_id, role)
  select v_account_id, id, 'owner'
  from auth.users
  on conflict (account_id, user_id) do nothing;
end $$;

-- ============================================================
-- 4. Now make account_id NOT NULL
-- ============================================================

alter table projects alter column account_id set not null;

-- ============================================================
-- 5. Helper function: returns all account IDs for the current user
-- ============================================================

create or replace function user_account_ids()
returns setof uuid language sql stable security definer as $$
  select account_id from account_members where user_id = auth.uid();
$$;

-- ============================================================
-- 6. Drop old RLS policies and apply new account-scoped ones
-- ============================================================

-- projects
drop policy if exists "Users manage their own projects" on projects;
drop policy if exists "authenticated_full_access" on projects;
create policy "Account members access projects" on projects
  using (account_id in (select user_account_ids()));

-- keywords
drop policy if exists "Users manage keywords" on keywords;
drop policy if exists "authenticated_full_access" on keywords;
create policy "Account members access keywords" on keywords
  using (project_id in (select id from projects where account_id in (select user_account_ids())));

-- keyword_clusters
drop policy if exists "Users manage clusters" on keyword_clusters;
drop policy if exists "authenticated_full_access" on keyword_clusters;
create policy "Account members access keyword_clusters" on keyword_clusters
  using (project_id in (select id from projects where account_id in (select user_account_ids())));

-- articles
drop policy if exists "Users manage articles" on articles;
drop policy if exists "authenticated_full_access" on articles;
create policy "Account members access articles" on articles
  using (project_id in (select id from projects where account_id in (select user_account_ids())));

-- rank_snapshots
drop policy if exists "Users manage rank snapshots" on rank_snapshots;
drop policy if exists "authenticated_full_access" on rank_snapshots;
create policy "Account members access rank_snapshots" on rank_snapshots
  using (project_id in (select id from projects where account_id in (select user_account_ids())));

-- gsc_snapshots
drop policy if exists "Users manage GSC snapshots" on gsc_snapshots;
drop policy if exists "authenticated_full_access" on gsc_snapshots;
create policy "Account members access gsc_snapshots" on gsc_snapshots
  using (project_id in (select id from projects where account_id in (select user_account_ids())));

-- gsc_tokens
drop policy if exists "Users manage GSC tokens" on gsc_tokens;
drop policy if exists "authenticated_full_access" on gsc_tokens;
create policy "Account members access gsc_tokens" on gsc_tokens
  using (project_id in (select id from projects where account_id in (select user_account_ids())));

-- cms_connections
drop policy if exists "Users manage CMS connections" on cms_connections;
drop policy if exists "authenticated_full_access" on cms_connections;
create policy "Account members access cms_connections" on cms_connections
  using (project_id in (select id from projects where account_id in (select user_account_ids())));

-- article_research
drop policy if exists "Users manage article research" on article_research;
drop policy if exists "authenticated_full_access" on article_research;
create policy "Account members access article_research" on article_research
  using (article_id in (
    select a.id from articles a
    join projects p on a.project_id = p.id
    where p.account_id in (select user_account_ids())
  ));

-- pillar_pages (may or may not exist in older deployments)
do $$ begin
  drop policy if exists "Users manage pillar pages" on pillar_pages;
  drop policy if exists "authenticated_full_access" on pillar_pages;
  create policy "Account members access pillar_pages" on pillar_pages
    using (project_id in (select id from projects where account_id in (select user_account_ids())));
exception when undefined_table then null;
end $$;

-- project_sitemaps
do $$ begin
  drop policy if exists "Users manage project sitemaps" on project_sitemaps;
  drop policy if exists "authenticated_full_access" on project_sitemaps;
  create policy "Account members access project_sitemaps" on project_sitemaps
    using (project_id in (select id from projects where account_id in (select user_account_ids())));
exception when undefined_table then null;
end $$;

-- sitemap_pages
do $$ begin
  drop policy if exists "Users manage sitemap pages" on sitemap_pages;
  drop policy if exists "authenticated_full_access" on sitemap_pages;
  create policy "Account members access sitemap_pages" on sitemap_pages
    using (sitemap_id in (
      select s.id from project_sitemaps s
      join projects p on s.project_id = p.id
      where p.account_id in (select user_account_ids())
    ));
exception when undefined_table then null;
end $$;

-- local_pack_snapshots
do $$ begin
  drop policy if exists "Users manage their local pack snapshots" on local_pack_snapshots;
  drop policy if exists "authenticated_full_access" on local_pack_snapshots;
  create policy "Account members access local_pack_snapshots" on local_pack_snapshots
    using (project_id in (select id from projects where account_id in (select user_account_ids())));
exception when undefined_table then null;
end $$;

-- app_settings: read-only for all authenticated users; no authenticated writes
drop policy if exists "Authenticated users read settings" on app_settings;
drop policy if exists "authenticated_full_access" on app_settings;
create policy "Authenticated users read app_settings" on app_settings
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- 7. RLS for new tables
-- ============================================================

alter table accounts enable row level security;
alter table account_members enable row level security;
alter table account_credentials enable row level security;

-- accounts: members can read their own accounts
create policy "Members read own accounts" on accounts
  for select using (id in (select user_account_ids()));

-- account_members: members see members of their own accounts
create policy "Members read account_members" on account_members
  for select using (account_id in (select user_account_ids()));

-- account_members: only owners can insert new members
create policy "Owners insert account_members" on account_members
  for insert with check (
    account_id in (
      select account_id from account_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- account_members: only owners can remove other members (not themselves)
create policy "Owners delete account_members" on account_members
  for delete using (
    account_id in (
      select account_id from account_members
      where user_id = auth.uid() and role = 'owner'
    )
    and user_id <> auth.uid()
  );

-- account_credentials: members can read
create policy "Members read account_credentials" on account_credentials
  for select using (
    account_id in (select user_account_ids())
  );

-- account_credentials: only owners can insert
create policy "Owners insert account_credentials" on account_credentials
  for insert with check (
    account_id in (
      select account_id from account_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- account_credentials: only owners can update
create policy "Owners update account_credentials" on account_credentials
  for update using (
    account_id in (
      select account_id from account_members
      where user_id = auth.uid() and role = 'owner'
    )
  ) with check (
    account_id in (
      select account_id from account_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- account_credentials: only owners can delete
create policy "Owners delete account_credentials" on account_credentials
  for delete using (
    account_id in (
      select account_id from account_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ============================================================
-- 8. Auto-account trigger: new user → new account + owner membership
-- ============================================================

create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  v_account_id uuid;
begin
  insert into public.accounts(name)
  values (split_part(new.email, '@', 1))
  returning id into v_account_id;

  insert into public.account_members(account_id, user_id, role)
  values (v_account_id, new.id, 'owner');

  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 9. Helper RPC: look up a user ID by email (for team invites)
-- ============================================================

create or replace function find_user_id_by_email(p_email text)
returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = lower(p_email) limit 1;
  return v_id;
end; $$;

commit;
