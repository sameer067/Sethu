"use client";

import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { Item, StockEntry } from "@/lib/types";
import { stockEntrySchema, type StockEntryFormValues } from "@/lib/validations/stock";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  getActiveItems,
  getStockEntries,
  getCurrentStock,
  createStockEntry,
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StockInForm({
  items,
  onSuccess,
}: {
  items: Item[];
  onSuccess: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<StockEntryFormValues>({
    resolver: zodResolver(stockEntrySchema),
    defaultValues: { item_id: "", quantity: 1, cost_price_per_unit: 0, date: today, note: "" },
  });

  const itemId = watch("item_id");

  async function onSubmit(data: StockEntryFormValues) {
    await createStockEntry({
      item_id: data.item_id,
      quantity: data.quantity,
      cost_price_per_unit: data.cost_price_per_unit,
      date: data.date,
      note: data.note || null,
    });
    reset({
      item_id: "",
      quantity: 1,
      cost_price_per_unit: 0,
      date: today,
      note: "",
    });
    onSuccess();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add stock</CardTitle>
        <CardDescription>Record inward stock with cost.</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Add items in Settings first, then you can record stock here.
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Item</Label>
              <Select
                required
                value={itemId || ""}
                onValueChange={(v) => setValue("item_id", v)}
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
              {errors.item_id && (
                <p className="text-sm text-destructive">{errors.item_id.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="any"
                  min="0.001"
                  {...register("quantity")}
                />
                {errors.quantity && (
                  <p className="text-sm text-destructive">{errors.quantity.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Cost per unit (₹)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  min="0"
                  {...register("cost_price_per_unit")}
                />
                {errors.cost_price_per_unit && (
                  <p className="text-sm text-destructive">
                    {errors.cost_price_per_unit.message}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" {...register("date")} />
                {errors.date && (
                  <p className="text-sm text-destructive">{errors.date.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Input id="note" {...register("note")} placeholder="e.g. Batch #" />
              </div>
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding…" : "Add stock"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
