import { z } from "zod";

export const saleLineItemSchema = z.object({
  item_id: z.string().min(1, "Select an item"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  selling_price_per_unit: z.coerce.number().min(0, "Price must be ≥ 0"),
});

export const salePaymentSchema = z.object({
  payment_cash: z.coerce.number().min(0),
  payment_upi: z.coerce.number().min(0),
});

export type SaleLineItemValues = z.infer<typeof saleLineItemSchema>;
export type SalePaymentValues = z.infer<typeof salePaymentSchema>;
