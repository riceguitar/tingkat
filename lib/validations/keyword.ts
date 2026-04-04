import { z } from "zod";

export const keywordResearchSchema = z.object({
  seedKeyword: z.string().min(1, "Seed keyword is required").max(200),
  projectId: z.string().uuid(),
  locationCode: z.number().optional().default(2840),
  languageCode: z.string().optional().default("en"),
  limit: z.number().min(1).max(1000).optional().default(100),
});

export const saveKeywordsSchema = z.object({
  projectId: z.string().uuid(),
  keywords: z.array(z.object({
    keyword: z.string().min(1),
    clusterId: z.string().uuid().optional().nullable(),
    searchVolume: z.number().optional(),
    difficulty: z.number().optional(),
    cpc: z.number().optional(),
    intent: z.string().optional(),
    competition: z.number().optional(),
    trend: z.array(z.number()).optional(),
  })).min(1),
});

export type KeywordResearchInput = z.infer<typeof keywordResearchSchema>;
export type SaveKeywordsInput = z.infer<typeof saveKeywordsSchema>;
