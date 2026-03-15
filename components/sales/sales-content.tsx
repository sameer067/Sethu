"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSalesList, deleteSale } from "@/lib/actions";
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
  isWithinInterval,
} from "date-fns";

type DatePreset = "today" | "week" | "month" | "all" | "custom";

const PRESET_LABELS: Record<DatePreset, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All Time",
  custom: "Custom",
};

export function SalesContent() {
  const router = useRouter();
  const [sales, setSales] = useState<Array<{
    id: string;
    date: string;
    customer_name: string;
    total_amount: number;
    status: string;
    bill_number: string | null;
    profit_on_sold: number;
  }>>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(e: React.MouseEvent, saleId: string, status: string) {
    e.stopPropagation();
    const message = status === "tentative"
      ? "Delete this tentative sale? This cannot be undone."
      : "Delete this sale? The invoice will be removed and stock will be returned. This cannot be undone.";
    if (!confirm(message)) return;
    setDeletingId(saleId);
    try {
      await deleteSale(saleId);
      setSales((prev) => prev.filter((s) => s.id !== saleId));
    } catch (_) {
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    getSalesList()
      .then(({ sales: list }) => setSales(list))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { start, end } = useMemo(() => {
    const now = new Date();
    if (datePreset === "today") return { start: startOfDay(now), end: endOfDay(now) };
    if (datePreset === "week") return { start: startOfWeek(now), end: endOfWeek(now) };
    if (datePreset === "month") return { start: startOfMonth(now), end: endOfMonth(now) };
    if (datePreset === "custom" && customStart && customEnd) {
      return { start: startOfDay(parseISO(customStart)), end: endOfDay(parseISO(customEnd)) };
    }
    return { start: new Date(0), end: new Date(9999, 11, 31) };
  }, [datePreset, customStart, customEnd]);

  const inRange = (dateStr: string) => {
    const d = parseISO(dateStr);
    return isWithinInterval(d, { start, end });
  };

  const byStatus = statusFilter === "all"
    ? sales
    : sales.filter((s) => s.status === statusFilter);
  const filtered = byStatus.filter((s) => inRange(s.date));

  const summary = useMemo(() => {
    const revenue = filtered.reduce((sum, s) => sum + s.total_amount, 0);
    const profitOnSold = filtered.reduce((sum, s) => sum + s.profit_on_sold, 0);
    const completedCount = filtered.filter((s) => s.status === "completed").length;
    const tentativeCount = filtered.filter((s) => s.status === "tentative").length;
    const billCount = completedCount; // each completed sale has one bill
    return { revenue, profitOnSold, billCount, tentativeCount, completedCount };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-wrap gap-2">
          <div>
            <CardTitle>Sales</CardTitle>
            <CardDescription>
              All sales. Tentative bills can be edited and completed to generate the final bill.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild size="sm">
              <Link href="/new-sale">
                <ShoppingCart className="h-4 w-4 mr-1" />
                New Sale
              </Link>
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="tentative">Tentative</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRESET_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {datePreset === "custom" && (
              <>
                <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-36" />
                <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-36" />
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No sales yet.</p>
              <p className="text-sm mt-1">Create a sale from New Sale (as tentative or completed).</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Profit on sold</TableHead>
                    <TableHead>Bill #</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/sales/${s.id}`)}
                    >
                      <TableCell>{formatDate(s.date)}</TableCell>
                      <TableCell className="font-medium">{s.customer_name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.total_amount)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            s.status === "completed"
                              ? "bg-blue-600 text-white hover:bg-blue-600"
                              : "bg-red-600 text-white hover:bg-red-600"
                          }
                        >
                          {s.status === "tentative" ? "Tentative" : "Completed"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.status === "completed"
                          ? formatCurrency(s.profit_on_sold)
                          : "—"}
                      </TableCell>
                      <TableCell>{s.bill_number ?? "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          aria-label="Delete sale"
                          disabled={deletingId === s.id}
                          onClick={(e) => handleDelete(e, s.id, s.status)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-medium hover:bg-muted/50">
                    <TableCell colSpan={2} className="font-semibold">
                      Summary
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.revenue)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {summary.tentativeCount} tentative, {summary.completedCount} completed
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(summary.profitOnSold)}</TableCell>
                    <TableCell>{summary.billCount}</TableCell>
                    <TableCell className="w-[50px]"></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
