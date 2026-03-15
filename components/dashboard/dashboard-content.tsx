"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  format,
  parseISO,
  isWithinInterval,
} from "date-fns";
import { getDashboardData } from "@/lib/actions";

type DatePreset = "today" | "week" | "month" | "all" | "custom";

const PRESET_LABELS: Record<DatePreset, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All Time",
  custom: "Custom",
};

const COLORS = ["#0ea5e9", "#22c55e"];

export function DashboardContent() {
  const [preset, setPreset] = useState<DatePreset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sales, setSales] = useState<
    Array<{
      id: string;
      date: string;
      total_amount: number;
      payment_cash: number;
      payment_upi: number;
      is_confirmed: boolean;
    }>
  >([]);
  const [saleItems, setSaleItems] = useState<
    Array<{
      sale_id: string;
      item_id: string;
      quantity: number;
      selling_price_per_unit: number;
      cost_price_per_unit: number;
    }>
  >([]);
  const [stockEntries, setStockEntries] = useState<
    Array<{
      item_id: string;
      date: string;
      quantity: number;
      cost_price_per_unit: number;
    }>
  >([]);
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([]);
  const [itemFilter, setItemFilter] = useState("");
  const [sortKey, setSortKey] = useState<
    "item_name" | "units_sold" | "revenue" | "inward_cost" | "profit" | "profit_on_sold" | "current_stock"
  >("item_name");
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardData()
      .then((data) => {
        setSales(data.sales);
        setSaleItems(data.saleItems);
        setStockEntries(data.stockEntries);
        setItems(data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { start, end } = useMemo(() => {
    const now = new Date();
    if (preset === "today") {
      return { start: startOfDay(now), end: endOfDay(now) };
    }
    if (preset === "week") {
      return { start: startOfWeek(now), end: endOfWeek(now) };
    }
    if (preset === "month") {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    if (preset === "custom" && customStart && customEnd) {
      return {
        start: startOfDay(parseISO(customStart)),
        end: endOfDay(parseISO(customEnd)),
      };
    }
    return { start: new Date(0), end: new Date(9999, 11, 31) };
  }, [preset, customStart, customEnd]);

  const inRange = (dateStr: string) => {
    const d = parseISO(dateStr);
    return isWithinInterval(d, { start, end });
  };

  const confirmedSalesInRange = sales.filter(
    (s) => s.is_confirmed && inRange(s.date)
  );
  const stockInRange = stockEntries.filter((e) => inRange(e.date));

  const totalRevenue = confirmedSalesInRange.reduce(
    (s, x) => s + Number(x.total_amount),
    0
  );
  const cashCollected = confirmedSalesInRange.reduce(
    (s, x) => s + Number(x.payment_cash),
    0
  );
  const upiCollected = confirmedSalesInRange.reduce(
    (s, x) => s + Number(x.payment_upi),
    0
  );
  const totalInwardCost = stockInRange.reduce(
    (s, e) => s + Number(e.quantity) * Number(e.cost_price_per_unit),
    0
  );
  const netProfit = totalRevenue - totalInwardCost;
  const saleIdsInRange = new Set(confirmedSalesInRange.map((s) => s.id));
  const totalUnitsSold = saleItems
    .filter((si) => saleIdsInRange.has(si.sale_id))
    .reduce((s, si) => s + Number(si.quantity), 0);
  const profitOnSold = saleItems
    .filter((si) => saleIdsInRange.has(si.sale_id))
    .reduce(
      (s, si) =>
        s +
        Number(si.quantity) *
          (Number(si.selling_price_per_unit) - Number(si.cost_price_per_unit ?? 0)),
      0
    );

  const dailyRevenue = useMemo(() => {
    const map = new Map<string, number>();
    confirmedSalesInRange.forEach((s) => {
      const key = format(parseISO(s.date), "dd/MM");
      map.set(key, (map.get(key) ?? 0) + Number(s.total_amount));
    });
    return Array.from(map.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [confirmedSalesInRange]);

  const cashUpiData = useMemo(
    () => [
      { name: "Cash", value: cashCollected, color: COLORS[0] },
      { name: "UPI", value: upiCollected, color: COLORS[1] },
    ],
    [cashCollected, upiCollected]
  );

  const itemBreakdown = useMemo(() => {
    const soldByItem = new Map<
      string,
      { units: number; revenue: number; profitOnSold: number }
    >();
    confirmedSalesInRange.forEach((sale) => {
      saleItems
        .filter((si) => si.sale_id === sale.id)
        .forEach((si) => {
          const cur = soldByItem.get(si.item_id) ?? {
            units: 0,
            revenue: 0,
            profitOnSold: 0,
          };
          const qty = Number(si.quantity);
          const sp = Number(si.selling_price_per_unit);
          const cp = Number(si.cost_price_per_unit ?? 0);
          soldByItem.set(si.item_id, {
            units: cur.units + qty,
            revenue: cur.revenue + qty * sp,
            profitOnSold: cur.profitOnSold + qty * (sp - cp),
          });
        });
    });
    const costByItem = new Map<string, number>();
    stockInRange.forEach((e) => {
      costByItem.set(
        e.item_id,
        (costByItem.get(e.item_id) ?? 0) +
          Number(e.quantity) * Number(e.cost_price_per_unit)
      );
    });
    const stockByItem = new Map<string, number>();
    stockEntries.forEach((e) => {
      stockByItem.set(
        e.item_id,
        (stockByItem.get(e.item_id) ?? 0) + Number(e.quantity)
      );
    });
    const soldQtyAllTimeByItem = new Map<string, number>();
    saleItems.forEach((si) => {
      soldQtyAllTimeByItem.set(
        si.item_id,
        (soldQtyAllTimeByItem.get(si.item_id) ?? 0) + Number(si.quantity)
      );
    });
    const allItemIds = new Set([
      ...Array.from(soldByItem.keys()),
      ...Array.from(costByItem.keys()),
      ...items.map((i) => i.id),
    ]);
    const nameMap = new Map(items.map((i) => [i.id, i.name]));
    return Array.from(allItemIds).map((item_id) => {
      const sold = soldByItem.get(item_id) ?? { units: 0, revenue: 0, profitOnSold: 0 };
      const cost = costByItem.get(item_id) ?? 0;
      const stockIn = stockByItem.get(item_id) ?? 0;
      const soldAllTime = soldQtyAllTimeByItem.get(item_id) ?? 0;
      const currentStock = stockIn - soldAllTime;
      return {
        item_id,
        item_name: nameMap.get(item_id) ?? "",
        units_sold: sold.units,
        revenue: sold.revenue,
        inward_cost: cost,
        profit: sold.revenue - cost,
        profit_on_sold: sold.profitOnSold,
        current_stock: currentStock,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- itemBreakdown derived from confirmedSalesInRange, saleItems, stockInRange, stockEntries, items only
  }, [
    confirmedSalesInRange,
    saleItems,
    stockInRange,
    stockEntries,
    items,
  ]);

  const sortedBreakdown = useMemo(() => {
    let list = [...itemBreakdown];
    if (itemFilter.trim()) {
      const q = itemFilter.toLowerCase();
      list = list.filter((r) => r.item_name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp =
        typeof aVal === "string"
          ? aVal.localeCompare(bVal as string)
          : (aVal as number) - (bVal as number);
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [itemBreakdown, itemFilter, sortKey, sortAsc]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Date range:</span>
        {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
          <Button
            key={p}
            variant={preset === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPreset(p)}
          >
            {PRESET_LABELS[p]}
          </Button>
        ))}
        {preset === "custom" && (
          <>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-36"
            />
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-36"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cash collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(cashCollected)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">UPI collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(upiCollected)}</p>
          </CardContent>
        </Card>
        {preset === "all" && (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total inward cost</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(totalInwardCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Net profit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{formatCurrency(netProfit)}</p>
              </CardContent>
            </Card>
          </>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Profit on sold</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(profitOnSold)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              (Selling − cost) × qty on completed sales
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Daily sales revenue</CardTitle>
            <CardDescription>Bar chart for selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyRevenue.length === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                No sales in this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="#0ea5e9" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cash vs UPI</CardTitle>
            <CardDescription>Payment split for selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            {cashCollected + upiCollected === 0 ? (
              <p className="text-muted-foreground text-sm py-8 text-center">
                No payments in this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={cashUpiData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    label={({ name, value }) =>
                      `${name}: ${formatCurrency(value)}`
                    }
                  >
                    {cashUpiData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Per-item breakdown</CardTitle>
            <CardDescription>
              Units sold, revenue, cost, profit, current stock.
            </CardDescription>
          </div>
          <Input
            placeholder="Filter by item name..."
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            className="max-w-xs"
          />
        </CardHeader>
        <CardContent>
          {sortedBreakdown.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">
              No item data for this period.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button
                        type="button"
                        className="font-medium hover:underline"
                        onClick={() => {
                          setSortKey("item_name");
                          setSortAsc((prev) => (sortKey === "item_name" ? !prev : true));
                        }}
                      >
                        Item {sortKey === "item_name" ? (sortAsc ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => {
                          setSortKey("units_sold");
                          setSortAsc((prev) => (sortKey === "units_sold" ? !prev : true));
                        }}
                      >
                        Units sold {sortKey === "units_sold" ? (sortAsc ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => {
                          setSortKey("revenue");
                          setSortAsc((prev) => (sortKey === "revenue" ? !prev : true));
                        }}
                      >
                        Revenue {sortKey === "revenue" ? (sortAsc ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => {
                          setSortKey("inward_cost");
                          setSortAsc((prev) => (sortKey === "inward_cost" ? !prev : true));
                        }}
                      >
                        Inward cost {sortKey === "inward_cost" ? (sortAsc ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => {
                          setSortKey("profit");
                          setSortAsc((prev) => (sortKey === "profit" ? !prev : true));
                        }}
                      >
                        Profit {sortKey === "profit" ? (sortAsc ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => {
                          setSortKey("profit_on_sold");
                          setSortAsc((prev) => (sortKey === "profit_on_sold" ? !prev : true));
                        }}
                      >
                        Profit on sold {sortKey === "profit_on_sold" ? (sortAsc ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="hover:underline"
                        onClick={() => {
                          setSortKey("current_stock");
                          setSortAsc((prev) => (sortKey === "current_stock" ? !prev : true));
                        }}
                      >
                        Current stock {sortKey === "current_stock" ? (sortAsc ? "↑" : "↓") : ""}
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBreakdown.map((row) => (
                    <TableRow key={row.item_id}>
                      <TableCell className="font-medium">{row.item_name}</TableCell>
                      <TableCell className="text-right">
                        {row.units_sold}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.revenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.inward_cost)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(row.profit_on_sold)}
                      </TableCell>
                      <TableCell className="text-right">
                        {row.current_stock}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
