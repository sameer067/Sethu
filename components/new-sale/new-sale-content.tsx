"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Item, Customer } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import { pdf } from "@react-pdf/renderer";
import { BillDocument, getLogoDataUrl, type BillData } from "@/components/pdf/bill-document";
import {
  getActiveItems,
  getCustomers,
  getAppConfigValue,
  getCurrentStock,
  createCustomer,
  createSaleAndItems,
} from "@/lib/actions";

type Step = 1 | 2 | 3 | 4;

interface LineItem {
  item_id: string;
  quantity: number;
  selling_price_per_unit: number;
  itemName?: string;
  itemUnit?: string;
}

const STEPS: Step[] = [1, 2, 3, 4];

export function NewSaleContent() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { item_id: "", quantity: 1, selling_price_per_unit: 0 },
  ]);
  const [paymentCash, setPaymentCash] = useState("");
  const [paymentUpi, setPaymentUpi] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [savingTentative, setSavingTentative] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [currentStock, setCurrentStock] = useState<{ item_id: string; stock: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [itemsData, customersData, config, stockData] = await Promise.all([
          getActiveItems(),
          getCustomers(),
          getAppConfigValue("business_name"),
          getCurrentStock(),
        ]);
        setItems(itemsData);
        setCustomers(customersData);
        setBusinessName(config ?? "");
        setCurrentStock(stockData.map((s) => ({ item_id: s.item_id, stock: s.stock })));
      } catch {
        // unauthenticated
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stockByItem = new Map(currentStock.map((s) => [s.item_id, s.stock]));
  const itemsWithStock = items.filter((i) => (stockByItem.get(i.id) ?? 0) >= 1);
  function getMaxQtyNewSale(itemId: string, excludeIndex: number): number {
    const stock = stockByItem.get(itemId) ?? 0;
    const inOtherLines = lineItems
      .filter((l, idx) => l.item_id === itemId && idx !== excludeIndex)
      .reduce((sum, l) => sum + Number(l.quantity), 0);
    return Math.max(0, stock - inOtherLines);
  }
  function clampQtyNewSale(index: number, value: number): number {
    const line = lineItems[index];
    if (!line?.item_id) return value;
    const max = getMaxQtyNewSale(line.item_id, index);
    return Math.min(Math.max(0, value), max);
  }

  const hasSearch = customerSearch.trim().length > 0;
  const filteredCustomers = hasSearch
    ? customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
            (c.phone ?? "").includes(customerSearch)
        )
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    : [];


  const grandTotal = lineItems.reduce(
    (sum, line) =>
      sum + Number(line.quantity) * Number(line.selling_price_per_unit),
    0
  );
  const paymentCashNum = parseFloat(paymentCash) || 0;
  const paymentUpiNum = parseFloat(paymentUpi) || 0;
  const paymentValid = Math.abs(paymentCashNum + paymentUpiNum - grandTotal) < 0.01;

  function addLine() {
    setLineItems((prev) => [
      ...prev,
      { item_id: "", quantity: 1, selling_price_per_unit: 0 },
    ]);
  }

  function updateLine(index: number, updates: Partial<LineItem>) {
    setLineItems((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...updates } : l))
    );
  }

  function removeLine(index: number) {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function createNewCustomer() {
    if (!newCustomerName.trim()) return;
    setCreatingCustomer(true);
    try {
      const newCustomer = await createCustomer({
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
      });
      setCustomers((prev) => [newCustomer, ...prev]);
      setSelectedCustomer(newCustomer);
      setNewCustomerName("");
      setNewCustomerPhone("");
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function saveAsTentative() {
    if (!selectedCustomer || savingTentative) return;
    const validLines = lineItems.filter(
      (l) => l.item_id && l.quantity > 0 && l.selling_price_per_unit >= 0
    );
    if (validLines.length === 0) return;
    setSavingTentative(true);
    const totalAmount = validLines.reduce(
      (s, l) => s + Number(l.quantity) * Number(l.selling_price_per_unit),
      0
    );
    try {
      await createSaleAndItems({
        customer_id: selectedCustomer.id,
        total_amount: totalAmount,
        payment_cash: paymentCashNum,
        payment_upi: paymentUpiNum,
        status: "tentative",
        items: validLines.map((l) => ({
          item_id: l.item_id,
          quantity: l.quantity,
          selling_price_per_unit: l.selling_price_per_unit,
        })),
      });
      router.push("/sales");
      router.refresh();
    } finally {
      setSavingTentative(false);
    }
  }

  async function confirmPayment() {
    if (!selectedCustomer || !paymentValid || confirming) return;
    setConfirming(true);
    const validLines = lineItems.filter(
      (l) => l.item_id && l.quantity > 0 && l.selling_price_per_unit >= 0
    );
    if (validLines.length === 0) {
      setConfirming(false);
      return;
    }
    const totalAmount = validLines.reduce(
      (s, l) => s + Number(l.quantity) * Number(l.selling_price_per_unit),
      0
    );
    try {
      const { billNumber } = await createSaleAndItems({
        customer_id: selectedCustomer.id,
        total_amount: totalAmount,
        payment_cash: paymentCashNum,
        payment_upi: paymentUpiNum,
        status: "completed",
        items: validLines.map((l) => ({
          item_id: l.item_id,
          quantity: l.quantity,
          selling_price_per_unit: l.selling_price_per_unit,
        })),
      });
      const itemMap = new Map(
        items.map((i) => [
          i.id,
          {
            displayName: (i.billing_name && i.billing_name.trim()) ? i.billing_name : i.name,
            unit: i.unit,
          },
        ])
      );
      const billData: BillData = {
        businessName,
        billNumber: billNumber!,
        date: formatDate(new Date().toISOString().slice(0, 10)),
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        items: validLines.map((l) => {
          const item = itemMap.get(l.item_id);
          const qty = Number(l.quantity);
          const up = Number(l.selling_price_per_unit);
          return {
            name: item?.displayName ?? "",
            unit: item?.unit ?? "",
            quantity: qty,
            unitPrice: up,
            lineTotal: qty * up,
          };
        }),
        grandTotal: totalAmount,
        paymentCash: paymentCashNum,
        paymentUpi: paymentUpiNum,
      };
      try {
        const logoUrl = await getLogoDataUrl();
        const dataWithLogo: BillData = { ...billData, logoUrl };
        const blob = await pdf(<BillDocument data={dataWithLogo} />).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${billNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (_) {}
      router.push("/dashboard");
      router.refresh();
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <div className="flex justify-between items-center">
        {STEPS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s)}
            className={`text-sm font-medium px-3 py-1 rounded ${
              step === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
            <CardDescription>Search or add a customer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Search by name or phone</Label>
              <Input
                placeholder="Type a letter or name to see customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
            {!hasSearch && (
              <p className="text-sm text-muted-foreground">
                Type a letter or name to see matching customers.
              </p>
            )}
            {hasSearch && filteredCustomers.length > 0 && (
              <ul className="border rounded-md divide-y max-h-48 overflow-auto">
                {filteredCustomers.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-muted"
                      onClick={() => {
                        setSelectedCustomer(c);
                        setCustomerSearch("");
                      }}
                    >
                      {c.name} {c.phone ? `— ${c.phone}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {hasSearch && filteredCustomers.length === 0 && (
              <p className="text-sm text-muted-foreground">No customers match. Add one below.</p>
            )}
            {selectedCustomer && (
              <p className="text-sm text-muted-foreground">
                Selected: <strong>{selectedCustomer.name}</strong>
              </p>
            )}
            <div className="pt-4 border-t space-y-2">
              <Label>Or add new customer</Label>
              <Input
                placeholder="Name (required)"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
              />
              <Input
                placeholder="Phone (optional)"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={createNewCustomer}
                disabled={!newCustomerName.trim() || creatingCustomer}
              >
                {creatingCustomer ? "Adding…" : "Add customer"}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedCustomer}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
            <CardDescription>
              Add line items. Only items with stock ≥ 1 are shown; quantity cannot exceed available stock.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {itemsWithStock.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No items in stock. Add stock in Inventory first.
              </p>
            )}
            {lineItems.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end"
              >
                <div className="col-span-2 md:col-span-5">
                  <Label className="text-xs">Item</Label>
                  <Select
                    value={line.item_id || ""}
                    onValueChange={(v) => {
                      const maxQ = getMaxQtyNewSale(v, index);
                      const q = Math.min(Number(line.quantity) || 0, maxQ);
                      updateLine(index, { item_id: v, quantity: q });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
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
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min="0.001"
                    step="any"
                    max={line.item_id ? getMaxQtyNewSale(line.item_id, index) : undefined}
                    value={line.quantity || ""}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      updateLine(index, { quantity: clampQtyNewSale(index, val) });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">Price/unit (₹)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
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
                    Line: {formatCurrency(Number(line.quantity) * Number(line.selling_price_per_unit))}
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
            <Button type="button" variant="outline" onClick={addLine}>
              Add line
            </Button>
            <p className="font-semibold">
              Grand total: {formatCurrency(grandTotal)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={
                  grandTotal <= 0 ||
                  !lineItems.some(
                    (l) => l.item_id && l.quantity > 0 && l.selling_price_per_unit >= 0
                  )
                }
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
            <CardDescription>Enter Cash and UPI amounts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg font-semibold">
              Total: {formatCurrency(grandTotal)}
            </p>
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
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPaymentCash(String(grandTotal));
                  setPaymentUpi("0");
                }}
              >
                All Cash
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPaymentCash("0");
                  setPaymentUpi(String(grandTotal));
                }}
              >
                All UPI
              </Button>
            </div>
            {!paymentValid && (paymentCash || paymentUpi) && (
              <p className="text-sm text-destructive">
                Cash + UPI must equal the grand total.
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!paymentValid}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm</CardTitle>
            <CardDescription>Review and confirm payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedCustomer && (
              <p>
                <strong>Customer:</strong> {selectedCustomer.name}{" "}
                {selectedCustomer.phone ? `— ${selectedCustomer.phone}` : ""}
              </p>
            )}
            <ul className="list-disc list-inside text-sm">
              {lineItems
                .filter(
                  (l) =>
                    l.item_id && l.quantity > 0 && l.selling_price_per_unit >= 0
                )
                .map((l, i) => {
                  const item = items.find((it) => it.id === l.item_id);
                  return (
                    <li key={i}>
                      {item?.name} — {l.quantity} × ₹
                      {Number(l.selling_price_per_unit).toFixed(2)} ={" "}
                      {formatCurrency(
                        Number(l.quantity) * Number(l.selling_price_per_unit)
                      )}
                    </li>
                  );
                })}
            </ul>
            <p className="font-semibold">Total: {formatCurrency(grandTotal)}</p>
            <p className="text-sm text-muted-foreground">
              Cash: {formatCurrency(paymentCashNum)} + UPI:{" "}
              {formatCurrency(paymentUpiNum)}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                variant="outline"
                onClick={saveAsTentative}
                disabled={savingTentative || !lineItems.some(
                  (l) => l.item_id && l.quantity > 0 && l.selling_price_per_unit >= 0
                )}
              >
                {savingTentative ? "Saving…" : "Save as tentative"}
              </Button>
              <Button
                onClick={confirmPayment}
                disabled={confirming || !paymentValid}
              >
                {confirming ? "Processing…" : "Confirm payment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
