import { z } from "zod";

export const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  domain: z.string().min(1, "Domain is required").regex(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, "Enter a valid domain (e.g. example.com)"),
  description: z.string().max(500).optional(),
  // Local SEO profile (all optional on create)
  business_type: z.enum(["service_area", "brick_mortar", "hybrid"]).optional(),
  business_name: z.string().max(150).optional(),
  city: z.string().max(100).optional(),
  state_province: z.string().max(100).optional(),
  country_code: z.string().length(2).optional(),
  location_code: z.number().int().optional(),
  service_areas: z.array(z.string().max(100)).max(20).optional(),
  nap_address: z.string().max(300).optional(),
  nap_phone: z.string().max(30).optional(),
  primary_category: z.string().max(100).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
