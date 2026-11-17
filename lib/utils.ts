import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * PDF filename for an invoice, e.g. "INV-0012_Ramesh_Kumar.pdf".
 * Strips characters that are invalid in filenames and falls back to just
 * the bill number when there is no customer name.
 */
export function invoiceFileName(billNumber: string, customerName?: string | null): string {
  const name = (customerName ?? "")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
  return name ? `${billNumber}_${name}.pdf` : `${billNumber}.pdf`;
}
