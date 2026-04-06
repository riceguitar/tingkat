-- ============================================================
-- Article Research Pipeline
-- ============================================================

-- Add primary_keyword to articles (explicit primary KW, separate from cluster name)
alter table articles add column if not exists primary_keyword text;

-- ============================================================
-- ARTICLE RESEARCH
-- Stores all per-step research data produced by the
-- 6-step research pipeline before article generation.
-- One row per article (upserted after each step completes).
-- ============================================================
create table article_research (
  id                    uuid primary key default uuid_generate_v4(),
  article_id            uuid not null references articles(id) on delete cascade,
  primary_keyword       text not null,

  -- Step 1: SERP landscape
  serp_data             jsonb,
  -- {
  --   organic: [{rank, title, url, description}],
  --   paa: string[],
  --   featured_snippet: {text, url} | null,
  --   related_searches: string[],
  --   avg_competitor_word_count: number,
  --   keyword_metrics: {volume, difficulty, cpc}
  -- }

  -- Step 2: Internal link candidates (scored, ranked)
  internal_links        jsonb,
  -- [{url, title, slug, relevance_score, suggested_anchor_text}]

  -- Step 3: External authoritative sources
  external_links        jsonb,
  -- [{url, title, domain, citation_context}]

  -- Step 4: Competition analysis from Claude
  competition_analysis  jsonb,
  -- {unique_angle, content_gaps[], recommended_word_count, competitor_summary, featured_snippet_opportunity}

  -- Step 5: Article writing plan (streamed markdown outline)
  writing_plan          text,

  -- Step 6 outputs: schema markup and EEAT checklist
  schema_markup         text,   -- JSON-LD Article + FAQ schema to inject alongside article
  eeat_checklist        jsonb,  -- [{item: string, status: 'pass'|'warn'|'fail'}]

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(article_id)
);

create index article_research_article_id_idx on article_research(article_id);

create trigger article_research_updated_at
  before update on article_research
  for each row execute function set_updated_at();

alter table article_research enable row level security;
create policy "authenticated_full_access" on article_research
  for all using (auth.role() = 'authenticated');
