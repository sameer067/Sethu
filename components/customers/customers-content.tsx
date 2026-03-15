"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { getCustomersWithStats, createCustomer } from "@/lib/actions";
import type { Customer } from "@/lib/types";

interface CustomerRow extends Customer {
  total_spend: number;
  purchase_count: number;
}

export function CustomersContent() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [adding, setAdding] = useState(false);

  function loadCustomers() {
    getCustomersWithStats()
      .then(({ customers: list, totalSpendByCustomer, purchaseCountByCustomer }) => {
        const rows: CustomerRow[] = list.map((c) => ({
          ...c,
          total_spend: totalSpendByCustomer.get(c.id) ?? 0,
          purchase_count: purchaseCountByCustomer.get(c.id) ?? 0,
        }));
        rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        setCustomers(rows);
      })
      .catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    getCustomersWithStats()
      .then(({ customers: list, totalSpendByCustomer, purchaseCountByCustomer }) => {
        const rows: CustomerRow[] = list.map((c) => ({
          ...c,
          total_spend: totalSpendByCustomer.get(c.id) ?? 0,
          purchase_count: purchaseCountByCustomer.get(c.id) ?? 0,
        }));
        rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        setCustomers(rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAddCustomer() {
    if (!addName.trim() || adding) return;
    setAdding(true);
    try {
      await createCustomer({ name: addName.trim(), phone: addPhone.trim() || null });
      setAddName("");
      setAddPhone("");
      setAddOpen(false);
      loadCustomers();
    } finally {
      setAdding(false);
    }
  }

  const filtered = search.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.phone ?? "").includes(search)
      )
    : customers;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1.5">
            <CardTitle>Customers</CardTitle>
            <CardDescription>
              Sorted alphabetically by name. Tap a row for full history.
            </CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>Add customer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add customer</DialogTitle>
                <DialogDescription>Create a new customer to use in sales.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="add-name">Name</Label>
                  <Input
                    id="add-name"
                    placeholder="Customer name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="add-phone">Phone (optional)</Label>
                  <Input
                    id="add-phone"
                    placeholder="Phone number"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCustomer} disabled={!addName.trim() || adding}>
                  {adding ? "Adding…" : "Add"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No customers yet.</p>
              <p className="text-sm mt-1">
                Customers are added when you create a sale in New Sale.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="text-right">Total spend</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/customers/${c.id}`)}
                    >
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(c.total_spend)}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.purchase_count}
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
