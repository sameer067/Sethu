export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Item {
  id: string;
  user_id: string;
  name: string;
  billing_name: string | null;
  unit: string;
  is_active: boolean;
  created_at: string;
}

export interface StockEntry {
  id: string;
  user_id: string;
  item_id: string;
  quantity: number;
  cost_price_per_unit: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  created_at: string;
}

export type SaleStatus = "tentative" | "completed";

export interface Sale {
  id: string;
  user_id: string;
  customer_id: string;
  date: string;
  total_amount: number;
  payment_cash: number;
  payment_upi: number;
  is_confirmed: boolean;
  status: SaleStatus;
  bill_number: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  item_id: string;
  quantity: number;
  selling_price_per_unit: number;
  cost_price_per_unit: number;
}

export interface AppConfig {
  id: string;
  user_id: string;
  key: string;
  value: string;
  created_at: string;
}

export interface StockEntryWithItem extends StockEntry {
  items: { name: string; unit: string } | null;
}
