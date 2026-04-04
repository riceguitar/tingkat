export type ArticleStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Project, "id" | "created_at">>;
        Relationships: [];
      };
      cms_connections: {
        Row: CmsConnection;
        Insert: Omit<CmsConnection, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<CmsConnection, "id" | "created_at">>;
        Relationships: [];
      };
      keyword_clusters: {
        Row: KeywordCluster;
        Insert: Omit<KeywordCluster, "id" | "created_at">;
        Update: Partial<Omit<KeywordCluster, "id" | "created_at">>;
        Relationships: [];
      };
      keywords: {
        Row: Keyword;
        Insert: Omit<Keyword, "id" | "created_at">;
        Update: Partial<Omit<Keyword, "id" | "created_at">>;
        Relationships: [];
      };
      articles: {
        Row: Article;
        Insert: Omit<Article, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Article, "id" | "created_at">>;
        Relationships: [];
      };
      rank_snapshots: {
        Row: RankSnapshot;
        Insert: Omit<RankSnapshot, "id" | "created_at">;
        Update: Partial<Omit<RankSnapshot, "id" | "created_at">>;
        Relationships: [];
      };
      gsc_snapshots: {
        Row: GscSnapshot;
        Insert: Omit<GscSnapshot, "id" | "created_at">;
        Update: Partial<Omit<GscSnapshot, "id" | "created_at">>;
        Relationships: [];
      };
      gsc_tokens: {
        Row: GscToken;
        Insert: Omit<GscToken, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<GscToken, "id" | "created_at">>;
        Relationships: [];
      };
      app_settings: {
        Row: AppSetting;
        Insert: AppSetting;
        Update: Partial<AppSetting>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      article_status: ArticleStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

export interface Project {
  id: string;
  name: string;
  domain: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CmsConnection {
  id: string;
  project_id: string;
  type: string;
  site_url: string;
  username: string;
  encrypted_password: string;
  iv: string;
  auth_tag: string;
  default_author_id: number | null;
  default_status: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface KeywordCluster {
  id: string;
  project_id: string;
  name: string;
  color: string;
  intent: string | null;
  description: string | null;
  created_at: string;
}

export interface Keyword {
  id: string;
  project_id: string;
  cluster_id: string | null;
  keyword: string;
  search_volume: number | null;
  difficulty: number | null;
  cpc: number | null;
  intent: string | null;
  competition: number | null;
  trend: number[] | null;
  last_fetched_at: string | null;
  created_at: string;
}

export interface Article {
  id: string;
  project_id: string;
  keyword_id: string | null;
  cluster_id: string | null;
  title: string | null;
  slug: string | null;
  meta_description: string | null;
  content: string | null;
  outline: Array<{ level: number; text: string }> | null;
  tone: string | null;
  target_word_count: number | null;
  actual_word_count: number | null;
  status: ArticleStatus;
  scheduled_at: string | null;
  published_at: string | null;
  wordpress_post_id: number | null;
  wordpress_post_url: string | null;
  publish_attempts: number;
  last_publish_error: string | null;
  featured_image_url: string | null;
  wp_categories: number[] | null;
  wp_tags: string[] | null;
  generation_model: string | null;
  generation_prompt: string | null;
  created_at: string;
  updated_at: string;
}

export interface RankSnapshot {
  id: string;
  keyword_id: string;
  project_id: string;
  position: number | null;
  url: string | null;
  device: string;
  location: string;
  snapshot_date: string;
  created_at: string;
}

export interface GscSnapshot {
  id: string;
  project_id: string;
  keyword_id: string | null;
  query: string;
  page: string | null;
  snapshot_date: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
  position: number | null;
  created_at: string;
}

export interface GscToken {
  id: string;
  project_id: string;
  access_token: string;
  refresh_token: string;
  token_iv: string;
  token_auth_tag: string;
  expires_at: string;
  gsc_property_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  key: string;
  value: string | null;
  updated_at: string;
}
