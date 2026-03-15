import { z } from "zod";

export const itemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  billing_name: z.string().optional(),
  unit: z.string().min(1, "Unit is required"),
});

export type ItemFormValues = z.infer<typeof itemSchema>;
