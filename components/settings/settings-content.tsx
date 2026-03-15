"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { Item } from "@/lib/types";
import { itemSchema, type ItemFormValues } from "@/lib/validations/item";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LogOut, Plus, Pencil, Trash2 } from "lucide-react";
import {
  getItems,
  getAppConfigValue,
  setAppConfigValue,
  createItem,
  updateItem,
  setItemActive,
} from "@/lib/actions";

const BUSINESS_NAME_KEY = "business_name";

export function SettingsContent() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [businessNameLoading, setBusinessNameLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [itemsData, configVal] = await Promise.all([
          getItems(),
          getAppConfigValue(BUSINESS_NAME_KEY),
        ]);
        setItems(itemsData);
        setBusinessName(configVal);
      } catch {
        // unauthenticated
      } finally {
        setLoading(false);
        setBusinessNameLoading(false);
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  async function saveBusinessName(value: string) {
    await setAppConfigValue(BUSINESS_NAME_KEY, value.trim());
    setBusinessName(value.trim());
  }

  const displayedItems = showInactive
    ? items
    : items.filter((i) => i.is_active);

  return (
    <div className="space-y-6 max-w-2xl">
      <Tabs defaultValue="items">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="items">Item catalogue</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
        </TabsList>
        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Items</CardTitle>
                <CardDescription>Manage your product list.</CardDescription>
              </div>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Add item
              </Button>
            </CardHeader>
            <CardContent>
              <label className="flex items-center gap-2 text-sm mb-2">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show inactive items
              </label>
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : displayedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No items yet.</p>
                  <Button
                    variant="outline"
                    className="mt-2"
                    onClick={() => setAddOpen(true)}
                  >
                    Add your first item
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Internal name</TableHead>
                      <TableHead>Billing name</TableHead>
                      <TableHead>Unit</TableHead>
                      {showInactive && <TableHead>Status</TableHead>}
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.billing_name || "—"}
                        </TableCell>
                        <TableCell>{item.unit}</TableCell>
                        {showInactive && (
                          <TableCell>
                            {item.is_active ? "Active" : "Inactive"}
                          </TableCell>
                        )}
                        <TableCell>
                          {item.is_active ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditItem(item)}
                                aria-label="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={async () => {
                                  await setItemActive(item.id, false);
                                  setItems((prev) =>
                                    prev.map((p) =>
                                      p.id === item.id
                                        ? { ...p, is_active: false }
                                        : p
                                    )
                                  );
                                }}
                                aria-label="Deactivate"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                await setItemActive(item.id, true);
                                setItems((prev) =>
                                  prev.map((p) =>
                                    p.id === item.id
                                      ? { ...p, is_active: true }
                                      : p
                                  )
                                );
                              }}
                            >
                              Restore
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="business" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Business name</CardTitle>
              <CardDescription>
                Shown at the top of printed bills.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {businessNameLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="flex gap-2">
                  <Input
                    defaultValue={businessName}
                    placeholder="Your business name"
                    onBlur={(e) => saveBusinessName(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Sign out of this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ItemFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={(newItem) => {
          setItems((prev) => [newItem, ...prev]);
          setAddOpen(false);
        }}
        initial={undefined}
      />
      {editItem && (
        <ItemFormDialog
          open={!!editItem}
          onOpenChange={(open) => !open && setEditItem(null)}
          onSuccess={(updated) => {
            setItems((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );
            setEditItem(null);
          }}
          initial={editItem}
        />
      )}
    </div>
  );
}

function ItemFormDialog({
  open,
  onOpenChange,
  onSuccess,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (item: Item) => void;
  initial?: Item;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: initial
      ? { name: initial.name, billing_name: initial.billing_name ?? "", unit: initial.unit }
      : { name: "", billing_name: "", unit: "" },
  });

  useEffect(() => {
    if (open && initial) reset({ name: initial.name, billing_name: initial.billing_name ?? "", unit: initial.unit });
    if (open && !initial) reset({ name: "", billing_name: "", unit: "" });
  }, [open, initial, reset]);

  async function onSubmit(data: ItemFormValues) {
    if (initial) {
      const updated = await updateItem(initial.id, {
        name: data.name,
        billing_name: data.billing_name?.trim() || null,
        unit: data.unit,
      });
      if (updated) onSuccess(updated);
    } else {
      const newItem = await createItem({
        name: data.name,
        billing_name: data.billing_name?.trim() || null,
        unit: data.unit,
      });
      onSuccess(newItem);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit item" : "Add item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Internal name</Label>
            <Input id="name" {...register("name")} placeholder="e.g. SKU-RICE-1KG" />
            <p className="text-xs text-muted-foreground">For your reference in lists and reports.</p>
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="billing_name">Billing name (optional)</Label>
            <Input id="billing_name" {...register("billing_name")} placeholder="e.g. Premium Basmati Rice 1 kg" />
            <p className="text-xs text-muted-foreground">Shown on the invoice. Leave blank to use internal name.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" {...register("unit")} placeholder="e.g. kg, pcs" />
            {errors.unit && (
              <p className="text-sm text-destructive">{errors.unit.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {initial ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
