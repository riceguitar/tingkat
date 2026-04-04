import { z } from "zod";

export const createArticleSchema = z.object({
  project_id: z.string().uuid(),
  keyword_id: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  status: z.enum(["draft", "scheduled", "publishing", "published", "failed"]).default("draft"),
  scheduled_at: z.string().datetime().optional().nullable(),
});

export const updateArticleSchema = z.object({
  title: z.string().max(200).optional(),
  slug: z.string().max(200).optional(),
  meta_description: z.string().max(300).optional(),
  content: z.string().optional(),
  status: z.enum(["draft", "scheduled", "publishing", "published", "failed"]).optional(),
  scheduled_at: z.string().datetime().optional().nullable(),
  featured_image_url: z.string().url().optional().nullable(),
  wp_categories: z.array(z.number()).optional(),
  wp_tags: z.array(z.string()).optional(),
  tone: z.string().optional(),
  target_word_count: z.number().min(100).max(10000).optional(),
});

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
