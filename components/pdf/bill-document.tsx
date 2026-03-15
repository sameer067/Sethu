"use client";

import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

/** Public path for the business logo (used in PDF). */
export const BILL_LOGO_PATH = "/Logo.png";

/** Fetches the logo and returns a base64 data URL for use in the PDF (avoids CORS/network issues). */
export async function getLogoDataUrl(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  try {
    const res = await fetch(`${window.location.origin}${BILL_LOGO_PATH}`);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  logo: {
    width: 80,
    height: 80,
    objectFit: "contain",
  },
  title: {
    fontSize: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  meta: {
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    marginBottom: 4,
  },
  table: {
    marginTop: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingVertical: 4,
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    paddingBottom: 4,
    marginBottom: 2,
  },
  colName: { width: "35%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "25%", textAlign: "right" },
  colTotal: { width: "25%", textAlign: "right" },
  totalRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  paymentRow: {
    marginTop: 12,
  },
  thanks: {
    marginTop: 24,
    textAlign: "center",
    fontSize: 10,
    color: "#666",
  },
});

export interface BillData {
  businessName: string;
  billNumber: string;
  date: string;
  customerName: string;
  customerPhone: string | null;
  items: Array<{
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  grandTotal: number;
  paymentCash: number;
  paymentUpi: number;
  /** Optional logo as URL or base64 data URL (e.g. from getLogoDataUrl()). */
  logoUrl?: string;
}

export function BillDocument({ data }: { data: BillData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.logoUrl ? (
          <View style={styles.logoWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image has no alt prop; PDF is not HTML. */}
            <Image src={data.logoUrl} style={styles.logo} />
          </View>
        ) : null}
        <Text style={styles.title}>{data.businessName || "Invoice"}</Text>
        <View style={styles.meta}>
          <Text>Bill No: {data.billNumber}</Text>
          <Text>Date: {data.date}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <Text>{data.customerName}</Text>
          {data.customerPhone ? (
            <Text>Phone: {data.customerPhone}</Text>
          ) : null}
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colName}>Item</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {data.items.map((row, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colName}>
                {row.name} ({row.unit})
              </Text>
              <Text style={styles.colQty}>{row.quantity}</Text>
              <Text style={styles.colPrice}>{"INR " + row.unitPrice.toFixed(2)}</Text>
              <Text style={styles.colTotal}>{"INR " + row.lineTotal.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text>{"Subtotal: INR " + data.grandTotal.toFixed(2)}</Text>
          </View>
        </View>
        <View style={styles.paymentRow}>
          <Text>
            {"Payment: Cash INR " + data.paymentCash.toFixed(2) + " + UPI INR " + data.paymentUpi.toFixed(2)}
          </Text>
        </View>
        <Text style={styles.thanks}>Thank you for your business!</Text>
      </Page>
    </Document>
  );
}
