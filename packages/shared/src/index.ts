import { z } from "zod";

export const SheetRowSchema = z.object({
  domain: z.string().optional().default(""),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  image: z.string().url().optional().or(z.literal("")).default(""),
  content: z.string().optional().default(""),
});

export type SheetRow = z.infer<typeof SheetRowSchema>;

export const JobStatusSchema = z.enum([
  "queued",
  "parsing",
  "generating",
  "deploying",
  "completed",
  "failed",
]);

export type JobStatus = z.infer<typeof JobStatusSchema>;

