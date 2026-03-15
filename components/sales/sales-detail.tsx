"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { pdf } from "@react-pdf/renderer";
import { BillDocument, getLogoDataUrl, type BillData } from "@/components/pdf/bill-document";
import {
  updateTentativeSale,
  updateCompletedSale,
  completeTentativeSale,
  getSaleBillData,
  getTentativeSaleBillData,
  deleteSale,
} from "@/lib/actions";
import type { Item, Customer } from "@/lib/types";

type EditLine = {
  item_id: string;
  item_name: string;
  unit: string;
  quantity: number;
  selling_price_per_unit: number;
};

interface SalesDetailProps {
  saleId: string;
  initialData: {
    sale: {
      id: string;
      date: string;
      customer_id: string;
      total_amount: number;
      payment_cash: number;
      payment_upi: number;
      status: string;
    };
    items: Array<{
      item_id: string;
      item_name: string;
      unit: string;
      quantity: number;
      selling_price_per_unit: number;
      cost_price_per_unit: number;
    }>;
    customers: Customer[];
    activeItems: Item[];
    currentStock: { item_id: string; stock: number }[];
  };
}

export function SalesDetail({ saleId, initialData }: SalesDetailProps) {
  const router = useRouter();
  const { sale, items: initialItems, customers, activeItems, currentStock } = initialData;
  const isTentative = sale.status === "tentative";

  const [customerId, setCustomerId] = useState(sale.customer_id);
  const [lineItems, setLineItems] = useState<EditLine[]>(
    initialItems.length > 0
      ? initialItems.map((i) => ({
          item_id: i.item_id,
          item_name: i.item_name,
          unit: i.unit,
          quantity: i.quantity,
          selling_price_per_unit: i.selling_price_per_unit,
        }))
      : [{ item_id: "", item_name: "", unit: "", quantity: 1, selling_price_per_unit: 0 }]
  );
  const [paymentCash, setPaymentCash] = useState(String(sale.payment_cash));
  const [paymentUpi, setPaymentUpi] = useState(String(sale.payment_upi));
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingTentative, setDownloadingTentative] = useState(false);
  const [editingCompleted, setEditingCompleted] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const stockByItem = new Map(currentStock.map((s) => [s.item_id, s.stock]));
  const itemsWithStock = activeItems.filter((i) => {
    const stock = stockByItem.get(i.id) ?? 0;
    if (isTentative) return stock >= 1;
    const inThisSale = lineItems
      .filter((l) => l.item_id === i.id)
      .reduce((sum, l) => sum + Number(l.quantity), 0);
    return stock + inThisSale >= 1;
  });

  function getMaxQty(itemId: string, lineIndex: number): number {
    const stock = stockByItem.get(itemId) ?? 0;
    if (isTentative) {
      const inOtherLines = lineItems
        .filter((l, idx) => l.item_id === itemId && idx !== lineIndex)
        .reduce((sum, l) => sum + Number(l.quantity), 0);
      return Math.max(0, stock - inOtherLines);
    }
    const thisLineQty = lineItems[lineIndex]?.item_id === itemId ? Number(lineItems[lineIndex].quantity) : 0;
    const inOtherLines = lineItems
      .filter((l, idx) => l.item_id === itemId && idx !== lineIndex)
      .reduce((sum, l) => sum + Number(l.quantity), 0);
    return Math.max(0, stock + thisLineQty - inOtherLines);
  }

  function clampQuantity(index: number, value: number): number {
    const line = lineItems[index];
    if (!line?.item_id) return value;
    const max = getMaxQty(line.item_id, index);
    return Math.min(Math.max(0, value), max);
  }

  const grandTotal = lineItems.reduce(
    (sum, line) => sum + Number(line.quantity) * Number(line.selling_price_per_unit),
    0
  );
  const paymentCashNum = parseFloat(paymentCash) || 0;
  const paymentUpiNum = parseFloat(paymentUpi) || 0;
  const paymentValid = Math.abs(paymentCashNum + paymentUpiNum - grandTotal) < 0.01;

  function addLine() {
    setLineItems((prev) => [
      ...prev,
      { item_id: "", item_name: "", unit: "", quantity: 1, selling_price_per_unit: 0 },
    ]);
  }

  function updateLine(index: number, updates: Partial<EditLine>) {
    setLineItems((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const next = { ...l, ...updates };
        if (updates.item_id !== undefined) {
          const item = activeItems.find((a) => a.id === updates.item_id);
          if (item) {
            next.item_name = item.name;
            next.unit = item.unit;
          }
        }
        return next;
      })
    );
  }

  function removeLine(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const validLines = lineItems.filter(
        (l) => l.item_id && l.quantity > 0 && l.selling_price_per_unit >= 0
      );
      if (validLines.length === 0) return;
      const payload = {
        customer_id: customerId,
        total_amount: grandTotal,
        payment_cash: paymentCashNum,
        payment_upi: paymentUpiNum,
        items: validLines.map((l) => ({
          item_id: l.item_id,
          quantity: l.quantity,
          selling_price_per_unit: l.selling_price_per_unit,
        })),
      };
      if (isTentative) {
        await updateTentativeSale(saleId, payload);
      } else {
        await updateCompletedSale(saleId, payload);
        setEditingCompleted(false);
      }
      router.refresh();
    } catch (_) {
      // show error in UI if needed
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!isTentative) return;
    setCompleting(true);
    try {
      await completeTentativeSale(saleId);
      const billData = await getSaleBillData(saleId);
      if (billData) {
        const logoUrl = await getLogoDataUrl();
        const dataWithLogo: BillData = { ...billData, logoUrl };
        const blob = await pdf(<BillDocument data={dataWithLogo} />).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${billData.billNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
      router.push("/sales");
      router.refresh();
    } catch (_) {
    } finally {
      setCompleting(false);
    }
  }

  async function handleDownloadBill() {
    setDownloading(true);
    try {
      const billData = await getSaleBillData(saleId);
      if (!billData) return;
      const logoUrl = await getLogoDataUrl();
      const dataWithLogo: BillData = { ...billData, logoUrl };
      const blob = await pdf(<BillDocument data={dataWithLogo} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${billData.billNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    const message = isTentative
      ? "Delete this tentative sale? This cannot be undone."
      : "Delete this sale? The invoice will be removed and stock will be returned. This cannot be undone.";
    if (!confirm(message)) return;
    setDeleting(true);
    try {
      await deleteSale(saleId);
      router.push("/sales");
      router.refresh();
    } catch (_) {
      setDeleting(false);
    }
  }

  async function handleDownloadTentativeBill() {
    setDownloadingTentative(true);
    try {
      const billData = await getTentativeSaleBillData(saleId);
      if (!billData) return;
      const logoUrl = await getLogoDataUrl();
      const dataWithLogo: BillData = { ...billData, logoUrl };
      const blob = await pdf(<BillDocument data={dataWithLogo} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Draft-${saleId.slice(-6)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
    } finally {
      setDownloadingTentative(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const showCompletedForm = !isTentative && editingCompleted;

  if (!isTentative && !editingCompleted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Link href="/sales" className="text-sm text-muted-foreground hover:underline">
            ← Back to Sales
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditingCompleted(true)}>
              Edit bill
            </Button>
            <Button onClick={handleDownloadBill} disabled={downloading}>
              {downloading ? "Preparing…" : "Download bill"}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete sale"}
            </Button>
          </div>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Sale</CardTitle>
              <CardDescription>{formatDate(sale.date)}</CardDescription>
            </div>
            <Badge>Completed</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              <strong>Customer:</strong> {selectedCustomer?.name ?? "—"}{" "}
              {selectedCustomer?.phone ? `— ${selectedCustomer.phone}` : ""}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialItems.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {row.item_name} ({row.unit})
                    </TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.selling_price_per_unit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.quantity * row.selling_price_per_unit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="font-semibold">Total: {formatCurrency(sale.total_amount)}</p>
            <p className="text-sm text-muted-foreground">
              Cash: {formatCurrency(sale.payment_cash)} + UPI: {formatCurrency(sale.payment_upi)}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/sales" className="text-sm text-muted-foreground hover:underline">
          ← Back to Sales
        </Link>
        <div className="flex items-center gap-2">
          {isTentative && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTentativeBill}
              disabled={downloadingTentative}
            >
              {downloadingTentative ? "Preparing…" : "Download tentative bill"}
            </Button>
          )}
          {showCompletedForm && (
            <Button variant="outline" onClick={() => setEditingCompleted(false)}>
              Cancel
            </Button>
          )}
          <Badge variant={isTentative ? "secondary" : "default"}>
            {isTentative ? "Tentative" : "Completed"}
          </Badge>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{isTentative ? "Edit tentative sale" : "Edit completed sale"}</CardTitle>
          <CardDescription>
            {isTentative
              ? "Update details and save. When ready, complete the sale to generate the final bill and update stock."
              : "Change customer, items, or payment. Invoice number stays the same. Stock will be updated to match."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.phone ? `— ${c.phone}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Items</Label>
            {lineItems.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end"
              >
                <div className="col-span-2 md:col-span-5">
                  <Select
                    value={line.item_id || ""}
                    onValueChange={(v) => {
                      const maxQ = getMaxQty(v, index);
                      updateLine(index, { item_id: v, quantity: Math.min(Number(line.quantity) || 0, maxQ) });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {itemsWithStock.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} ({i.unit}) — stock: {stockByItem.get(i.id) ?? 0}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    max={line.item_id ? getMaxQty(line.item_id, index) : undefined}
                    placeholder="Qty"
                    value={line.quantity || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      updateLine(index, { quantity: clampQuantity(index, val) });
                    }}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price/unit"
                    value={
                      line.selling_price_per_unit
                        ? String(line.selling_price_per_unit)
                        : ""
                    }
                    onChange={(e) =>
                      updateLine(index, {
                        selling_price_per_unit: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">
                    {formatCurrency(
                      Number(line.quantity) * Number(line.selling_price_per_unit)
                    )}
                  </span>
                  {lineItems.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              Add line
            </Button>
          </div>

          <p className="font-semibold">Grand total: {formatCurrency(grandTotal)}</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cash (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentCash}
                onChange={(e) => setPaymentCash(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>UPI (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentUpi}
                onChange={(e) => setPaymentUpi(e.target.value)}
              />
            </div>
          </div>
          {!paymentValid && (paymentCash || paymentUpi) && (
            <p className="text-sm text-destructive">
              Cash + UPI must equal the grand total.
            </p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !paymentValid ||
                !lineItems.some(
                  (l) =>
                    l.item_id && l.quantity > 0 && l.selling_price_per_unit >= 0
                )
              }
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {isTentative && (
              <Button
                variant="default"
                onClick={handleComplete}
                disabled={
                  completing ||
                  !paymentValid ||
                  !lineItems.some(
                    (l) =>
                      l.item_id && l.quantity > 0 && l.selling_price_per_unit >= 0
                  )
                }
              >
                {completing ? "Completing…" : "Complete sale & download bill"}
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete sale"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
