"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
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
import { formatCurrency, formatDate } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface SaleWithItems {
  id: string;
  date: string;
  total_amount: number;
  payment_cash: number;
  payment_upi: number;
  is_confirmed: boolean;
  bill_number: string | null;
  items: Array<{
    name: string;
    unit: string;
    quantity: number;
    selling_price_per_unit: number;
  }>;
}

interface CustomerDetailProps {
  customer: { id: string; name: string; phone: string | null };
  sales: SaleWithItems[];
}

export function CustomerDetail({ customer, sales }: CustomerDetailProps) {
  const confirmedSales = sales.filter((s) => s.is_confirmed);
  const totalSpend = confirmedSales.reduce((s, sale) => s + Number(sale.total_amount), 0);

  return (
    <div className="space-y-6">
      <Link href="/customers">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to customers
        </Button>
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>{customer.name}</CardTitle>
          <CardDescription>
            {customer.phone ? `Phone: ${customer.phone}` : "No phone"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {confirmedSales.length} purchase(s) · Total spend: {formatCurrency(totalSpend)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
          <CardDescription>Past sales (read-only).</CardDescription>
        </CardHeader>
        <CardContent>
          {sales.length === 0 ? (
            <p className="text-muted-foreground text-sm">No purchases yet.</p>
          ) : (
            <div className="space-y-4">
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex justify-between text-sm">
                    <span>{formatDate(sale.date)}</span>
                    <span className="font-medium">
                      {formatCurrency(Number(sale.total_amount))}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Payment: Cash {formatCurrency(Number(sale.payment_cash))} + UPI{" "}
                    {formatCurrency(Number(sale.payment_upi))}
                    {sale.bill_number ? ` · Bill ${sale.bill_number}` : ""}
                  </p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sale.items.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell>
                            {item.name} ({item.unit})
                          </TableCell>
                          <TableCell className="text-right">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.selling_price_per_unit)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(
                              item.quantity * item.selling_price_per_unit
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
