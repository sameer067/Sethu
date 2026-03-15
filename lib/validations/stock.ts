import { z } from "zod";

export const stockEntrySchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  cost_price_per_unit: z.coerce.number().min(0, "Cost must be ≥ 0"),
  date: z.string().min(1, "Date is required"),
  note: z.string().optional(),
});

export type StockEntryFormValues = z.infer<typeof stockEntrySchema>;
