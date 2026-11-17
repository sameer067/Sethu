"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { Item, StockEntry } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  getActiveItems,
  getStockEntries,
  getCurrentStock,
  createStockEntries,
  updateStockEntry,
  deleteStockEntry,
} from "@/lib/actions";

interface StockEntryRow extends StockEntry {
  items: { name: string; unit: string } | null;
}

interface CurrentStock {
  item_id: string;
  item_name: string;
  unit: string;
  stock: number;
}

export function InventoryContent() {
  const [items, setItems] = useState<Item[]>([]);
  const [entries, setEntries] = useState<StockEntryRow[]>([]);
  const [currentStock, setCurrentStock] = useState<CurrentStock[]>([]);
  const [itemFilter, setItemFilter] = useState<string>("all");
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [loadingStock, setLoadingStock] = useState(true);
  const [editing, setEditing] = useState<StockEntryRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  useEffect(() => {
    getActiveItems()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoadingItems(false));
  }, []);

  useEffect(() => {
    getStockEntries()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoadingEntries(false));
  }, []);

  useEffect(() => {
    getCurrentStock()
      .then(setCurrentStock)
      .catch(() => {})
      .finally(() => setLoadingStock(false));
  }, [entries]);

  const filteredEntries =
    itemFilter === "all"
      ? entries
      : entries.filter((e) => e.item_id === itemFilter);

  async function refreshAfterStockIn() {
    const [newEntries, newStock] = await Promise.all([
      getStockEntries(),
      getCurrentStock(),
    ]);
    setEntries(newEntries);
    setCurrentStock(newStock);
  }

  async function handleDelete(entry: StockEntryRow) {
    const label = `${entry.quantity} ${entry.items?.unit ?? ""} of ${entry.items?.name ?? "this item"} on ${formatDate(entry.date)}`;
    if (!confirm(`Delete stock entry: ${label}?\nThis cannot be undone.`)) return;
    setLedgerError(null);
    setDeletingId(entry.id);
    try {
      const result = await deleteStockEntry(entry.id);
      if (!result.ok) {
        setLedgerError(result.error);
        return;
      }
      await refreshAfterStockIn();
    } catch {
      setLedgerError("Could not delete the entry. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="in">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="in">Stock In</TabsTrigger>
          <TabsTrigger value="ledger">Stock Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="in" className="space-y-4">
          <StockInForm
            items={items}
            onSuccess={refreshAfterStockIn}
          />
        </TabsContent>
        <TabsContent value="ledger" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current stock by item</CardTitle>
              <CardDescription>Inward minus confirmed sales.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingStock ? (
                <Skeleton className="h-24 w-full" />
              ) : currentStock.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No stock data yet. Add stock entries to see levels.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Current stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentStock.map((row) => (
                      <TableRow key={row.item_id}>
                        <TableCell>{row.item_name}</TableCell>
                        <TableCell>{row.unit}</TableCell>
                        <TableCell className="text-right">
                          {row.stock} {row.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>All stock entries</CardTitle>
                <CardDescription>Most recent first.</CardDescription>
              </div>
              {items.length > 0 && (
                <Select value={itemFilter} onValueChange={setItemFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All items</SelectItem>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardHeader>
            <CardContent>
              {ledgerError && (
                <p className="mb-3 text-sm text-destructive">{ledgerError}</p>
              )}
              {loadingEntries ? (
                <Skeleton className="h-40 w-full" />
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No stock entries yet.</p>
                  <p className="text-sm mt-1">Use Stock In to add entries.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Cost/unit</TableHead>
                        <TableHead className="text-right">Total cost</TableHead>
                        <TableHead>Note</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{formatDate(e.date)}</TableCell>
                          <TableCell>
                            {e.items?.name ?? ""} ({e.items?.unit ?? ""})
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(e.quantity)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(e.cost_price_per_unit))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(
                              Number(e.quantity) * Number(e.cost_price_per_unit)
                            )}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate">
                            {e.note ?? "—"}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setLedgerError(null);
                                setEditing(e);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={deletingId === e.id}
                              onClick={() => handleDelete(e)}
                            >
                              {deletingId === e.id ? "Deleting…" : "Delete"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          <EditStockEntryDialog
            entry={editing}
            items={items}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await refreshAfterStockIn();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EditStockEntryDialog({
  entry,
  items,
  onClose,
  onSaved,
}: {
  entry: StockEntryRow | null;
  items: Item[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit stock entry</DialogTitle>
          <DialogDescription>
            Current stock is recalculated from entries, so changes apply immediately.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so the form resets each time a different entry is opened. */}
        {entry && (
          <EditStockEntryForm key={entry.id} entry={entry} items={items} onCancel={onClose} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditStockEntryForm({
  entry,
  items,
  onCancel,
  onSaved,
}: {
  entry: StockEntryRow;
  items: Item[];
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [itemId, setItemId] = useState(entry.item_id);
  const [quantity, setQuantity] = useState(Number(entry.quantity));
  const [cost, setCost] = useState(Number(entry.cost_price_per_unit));
  const [date, setDate] = useState(entry.date);
  const [note, setNote] = useState(entry.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The entry's item may since have been deactivated; keep it selectable.
  const options =
    items.some((i) => i.id === entry.item_id) || !entry.items
      ? items
      : [
          { id: entry.item_id, name: entry.items.name, unit: entry.items.unit } as Item,
          ...items,
        ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!itemId) return setError("Select an item.");
    if (!(quantity > 0)) return setError("Quantity must be greater than 0.");
    if (!date) return setError("Date is required.");
    setSaving(true);
    try {
      const result = await updateStockEntry(entry.id, {
        item_id: itemId,
        quantity,
        cost_price_per_unit: cost,
        date,
        note: note.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await onSaved();
    } catch {
      setError("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Item</Label>
        <Select value={itemId} onValueChange={setItemId}>
          <SelectTrigger>
            <SelectValue placeholder="Select item" />
          </SelectTrigger>
          <SelectContent>
            {options.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-qty">Quantity</Label>
          <NumericInput id="edit-qty" min="0.001" step="any" value={quantity} onValueChange={setQuantity} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-cost">Cost/unit (₹)</Label>
          <NumericInput id="edit-cost" min="0" step="0.01" value={cost} onValueChange={setCost} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-date">Date</Label>
          <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-note">Note (optional)</Label>
          <Input id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Total cost: {formatCurrency(quantity * cost)}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface StockLine {
  item_id: string;
  quantity: number;
  cost_price_per_unit: number;
}

const emptyLine = (): StockLine => ({ item_id: "", quantity: 1, cost_price_per_unit: 0 });

function StockInForm({
  items,
  onSuccess,
}: {
  items: Item[];
  onSuccess: () => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [lines, setLines] = useState<StockLine[]>([emptyLine()]);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function updateLine(index: number, updates: Partial<StockLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...updates } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const validLines = lines.filter(
    (l) => l.item_id && Number(l.quantity) > 0 && Number(l.cost_price_per_unit) >= 0
  );
  const incompleteLines = lines.filter(
    (l) => !l.item_id || !(Number(l.quantity) > 0)
  ).length;
  const grandTotal = validLines.reduce(
    (sum, l) => sum + Number(l.quantity) * Number(l.cost_price_per_unit),
    0
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!date) {
      setError("Date is required");
      return;
    }
    if (incompleteLines > 0) {
      setError("Every line needs an item and a quantity greater than 0 (or remove the empty line).");
      return;
    }
    setSubmitting(true);
    try {
      const count = await createStockEntries({
        date,
        note: note.trim() || null,
        lines: validLines,
      });
      setLines([emptyLine()]);
      setNote("");
      setDate(today);
      setSuccess(`Added ${count} stock ${count === 1 ? "entry" : "entries"}.`);
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add stock. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add stock</CardTitle>
        <CardDescription>
          Record inward stock with cost. Add as many items as you need, then save them all at once.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Add items in Settings first, then you can record stock here.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Batch # / supplier"
                />
              </div>
            </div>

            <div className="space-y-3">
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="grid grid-cols-2 md:grid-cols-12 gap-2 items-end border-b pb-3 last:border-b-0"
                >
                  <div className="col-span-2 md:col-span-5">
                    <Label className="text-xs">Item</Label>
                    <Select
                      value={line.item_id || ""}
                      onValueChange={(v) => updateLine(index, { item_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.name} ({i.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Qty</Label>
                    <NumericInput
                      min="0.001"
                      step="any"
                      value={line.quantity}
                      onValueChange={(v) => updateLine(index, { quantity: v })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Cost/unit (₹)</Label>
                    <NumericInput
                      min="0"
                      step="0.01"
                      value={line.cost_price_per_unit}
                      onValueChange={(v) => updateLine(index, { cost_price_per_unit: v })}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-3 flex items-center justify-between gap-1">
                    <span className="text-sm text-muted-foreground">
                      Line: {formatCurrency(Number(line.quantity) * Number(line.cost_price_per_unit))}
                    </span>
                    {lines.length > 1 && (
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
            </div>

            <Button type="button" variant="outline" onClick={addLine}>
              Add line
            </Button>

            <p className="font-semibold">
              Total cost: {formatCurrency(grandTotal)}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({validLines.length} {validLines.length === 1 ? "item" : "items"})
              </span>
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <Button type="submit" disabled={submitting || validLines.length === 0}>
              {submitting
                ? "Adding…"
                : validLines.length > 1
                ? `Add ${validLines.length} items to stock`
                : "Add stock"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
