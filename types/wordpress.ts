export interface WpPost {
  id: number;
  link: string;
  status: string;
  title: { rendered: string };
  slug: string;
}

export interface WpCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WpTag {
  id: number;
  name: string;
  slug: string;
}

export interface WpMedia {
  id: number;
  source_url: string;
}
