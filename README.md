# Tingkat

Tingkat is a comprehensive, AI-powered SEO and Content Management Dashboard built with Next.js. It simplifies the workflow for SEO professionals and content creators by unifying keyword research, rank tracking, content creation, and analytics into a single platform.

## Features

- 🎯 **Project Management**: Easily manage multiple websites and SEO campaigns.
- 🔍 **Keyword Research & Rank Tracking**: Discover high-value keywords and monitor your search rankings over time.
- ✍️ **AI-Powered Content Creation**: Leverage Anthropic's Claude AI alongside a rich markdown editor (Milkdown) to draft, refine, and optimize articles.
- 📅 **Content Calendar**: Plan, schedule, and organize your publication pipeline.
- 📊 **Google Search Console Integration**: Sync your GSC data for deep insights into search performance and impressions.
- 🌐 **WordPress Integration**: Push completed articles directly to your WordPress sites.
- 🗺️ **Technical & Local SEO**: Manage sitemaps and optimize for local search capabilities.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) (App Router)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Radix UI](https://www.radix-ui.com/)
- **AI**: [@anthropic-ai/sdk](https://www.npmjs.com/package/@anthropic-ai/sdk)
- **Editor**: [Milkdown](https://milkdown.dev/) + CodeMirror
- **Charts**: [Recharts](https://recharts.org/)

## Getting Started

First, make sure you have your environment variables set up (clone `.env.example` to `.env.local` and fill in your Supabase and API credentials).

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Database Migrations

This project uses Supabase. Migrations are located in `supabase/migrations/` and include schema setup for:
- Initial schemas
- Storage buckets
- Article research tracking
- GSC (Google Search Console) analytics
- Sitemaps & Local SEO

## License

Private repository. Copyright David Sudarma at Sierra Marketing (https://sierra.host).