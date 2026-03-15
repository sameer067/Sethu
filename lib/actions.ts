"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDb, ObjectId } from "@/lib/mongodb";
import type { Item, Customer, StockEntry, Sale } from "@/lib/types";

function toItem(doc: Record<string, unknown>): Item {
  return {
    id: (doc._id as ObjectId).toString(),
    user_id: (doc.userId as ObjectId).toString(),
    name: doc.name as string,
    billing_name: (doc.billingName as string)?.trim() || null,
    unit: doc.unit as string,
    is_active: (doc.isActive as boolean) ?? true,
    created_at: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
  };
}

function toCustomer(doc: Record<string, unknown>): Customer {
  return {
    id: (doc._id as ObjectId).toString(),
    user_id: (doc.userId as ObjectId).toString(),
    name: doc.name as string,
    phone: (doc.phone as string) ?? null,
    created_at: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
  };
}

function toStockEntry(doc: Record<string, unknown> & { item?: { name: string; unit: string } | null }): StockEntry & { items: { name: string; unit: string } | null } {
  return {
    id: (doc._id as ObjectId).toString(),
    user_id: (doc.userId as ObjectId).toString(),
    item_id: (doc.itemId as ObjectId).toString(),
    quantity: Number(doc.quantity),
    cost_price_per_unit: Number(doc.costPricePerUnit),
    date: doc.date as string,
    note: (doc.note as string) ?? null,
    created_at: (doc.createdAt as Date)?.toISOString?.() ?? String(doc.createdAt),
    items: doc.item ?? null,
  };
}

async function getUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user.id;
}

// ---- Items ----
export async function getItems(): Promise<Item[]> {
  const userId = await getUserId();
  const db = await getDb();
  const docs = await db.collection("items").find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => toItem(d as Record<string, unknown>));
}

export async function getActiveItems(): Promise<Item[]> {
  const userId = await getUserId();
  const db = await getDb();
  const docs = await db.collection("items").find({ userId: new ObjectId(userId), isActive: true }).sort({ name: 1 }).toArray();
  return docs.map((d) => toItem(d as Record<string, unknown>));
}

export async function createItem(data: { name: string; billing_name?: string | null; unit: string }): Promise<Item> {
  const userId = await getUserId();
  const db = await getDb();
  const billingName = data.billing_name?.trim() || null;
  const doc = {
    userId: new ObjectId(userId),
    name: data.name,
    billingName,
    unit: data.unit,
    isActive: true,
    createdAt: new Date(),
  };
  const res = await db.collection("items").insertOne(doc);
  return toItem({ _id: res.insertedId, ...doc } as Record<string, unknown>);
}

export async function updateItem(id: string, data: { name: string; billing_name?: string | null; unit: string }): Promise<Item | null> {
  const userId = await getUserId();
  const db = await getDb();
  const billingName = data.billing_name?.trim() || null;
  const res = await db.collection("items").findOneAndUpdate(
    { _id: new ObjectId(id), userId: new ObjectId(userId) },
    { $set: { name: data.name, billingName, unit: data.unit } },
    { returnDocument: "after" }
  );
  if (!res) return null;
  return toItem(res as Record<string, unknown>);
}

export async function setItemActive(id: string, isActive: boolean): Promise<void> {
  const userId = await getUserId();
  const db = await getDb();
  await db.collection("items").updateOne(
    { _id: new ObjectId(id), userId: new ObjectId(userId) },
    { $set: { isActive } }
  );
}

// ---- App config ----
export async function getAppConfigValue(key: string): Promise<string> {
  const userId = await getUserId();
  const db = await getDb();
  const doc = await db.collection("app_config").findOne({ userId: new ObjectId(userId), key });
  return (doc?.value as string) ?? "";
}

export async function setAppConfigValue(key: string, value: string): Promise<void> {
  const userId = await getUserId();
  const db = await getDb();
  await db.collection("app_config").updateOne(
    { userId: new ObjectId(userId), key },
    { $set: { value, updatedAt: new Date() } },
    { upsert: true }
  );
}

// ---- Stock entries ----
export async function getStockEntries(): Promise<(StockEntry & { items: { name: string; unit: string } | null })[]> {
  const userId = await getUserId();
  const db = await getDb();
  const docs = await db.collection("stock_entries").aggregate([
    { $match: { userId: new ObjectId(userId) } },
    { $sort: { date: -1, createdAt: -1 } },
    {
      $lookup: {
        from: "items",
        localField: "itemId",
        foreignField: "_id",
        as: "itemArr",
      },
    },
    { $unwind: { path: "$itemArr", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        item: { $cond: [{ $eq: ["$itemArr", null] }, null, { name: "$itemArr.name", unit: "$itemArr.unit" }] },
      },
    },
  ]).toArray();
  return docs.map((d) => toStockEntry(d as Record<string, unknown> & { item?: { name: string; unit: string } }));
}

export async function getCurrentStock(): Promise<{ item_id: string; item_name: string; unit: string; stock: number }[]> {
  const userId = await getUserId();
  const db = await getDb();
  const entries = (await db.collection("stock_entries").find({ userId: new ObjectId(userId) }).toArray()) as unknown as { itemId: ObjectId; quantity: number }[];
  const inMap = new Map<string, number>();
  entries.forEach((e) => {
    const id = e.itemId.toString();
    inMap.set(id, (inMap.get(id) ?? 0) + Number(e.quantity));
  });
  const sales = (await db.collection("sales").find({
    userId: new ObjectId(userId),
    $or: [{ status: "completed" }, { status: { $exists: false }, isConfirmed: true }],
  }).project({ _id: 1 }).toArray()) as unknown as { _id: ObjectId }[];
  const saleIds = sales.map((s) => s._id);
  const saleItems = (await db.collection("sale_items").find({ saleId: { $in: saleIds } }).toArray()) as unknown as { itemId: ObjectId; quantity: number }[];
  const outMap = new Map<string, number>();
  saleItems.forEach((si) => {
    const id = si.itemId.toString();
    outMap.set(id, (outMap.get(id) ?? 0) + Number(si.quantity));
  });
  const itemIds = Array.from(new Set(Array.from(inMap.keys()).concat(Array.from(outMap.keys()))));
  if (itemIds.length === 0) return [];
  const items = (await db.collection("items").find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } }).toArray()) as unknown as { _id: ObjectId; name: string; unit: string }[];
  const nameMap = new Map<string, { name: string; unit: string }>();
  items.forEach((i) => {
    nameMap.set(i._id.toString(), { name: i.name, unit: i.unit });
  });
  return itemIds.map((item_id) => ({
    item_id,
    item_name: nameMap.get(item_id)?.name ?? "",
    unit: nameMap.get(item_id)?.unit ?? "",
    stock: (inMap.get(item_id) ?? 0) - (outMap.get(item_id) ?? 0),
  }));
}

export async function createStockEntry(data: {
  item_id: string;
  quantity: number;
  cost_price_per_unit: number;
  date: string;
  note?: string | null;
}): Promise<void> {
  const userId = await getUserId();
  const db = await getDb();
  await db.collection("stock_entries").insertOne({
    userId: new ObjectId(userId),
    itemId: new ObjectId(data.item_id),
    quantity: data.quantity,
    costPricePerUnit: data.cost_price_per_unit,
    date: data.date,
    note: data.note ?? null,
    createdAt: new Date(),
  });
}

// ---- Customers ----
export async function getCustomers(): Promise<Customer[]> {
  const userId = await getUserId();
  const db = await getDb();
  const docs = await db.collection("customers").find({ userId: new ObjectId(userId) }).sort({ createdAt: -1 }).toArray();
  return docs.map((d) => toCustomer(d as Record<string, unknown>));
}

export async function createCustomer(data: { name: string; phone?: string | null }): Promise<Customer> {
  const userId = await getUserId();
  const db = await getDb();
  const doc = {
    userId: new ObjectId(userId),
    name: data.name.trim(),
    phone: data.phone?.trim() || null,
    createdAt: new Date(),
  };
  const res = await db.collection("customers").insertOne(doc);
  return toCustomer({ _id: res.insertedId, ...doc } as Record<string, unknown>);
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  const userId = await getUserId();
  const db = await getDb();
  const doc = await db.collection("customers").findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
  if (!doc) return null;
  return toCustomer(doc as Record<string, unknown>);
}

export async function getSalesByCustomerId(customerId: string): Promise<(Sale & { items: { name: string; unit: string; quantity: number; selling_price_per_unit: number }[] })[]> {
  const userId = await getUserId();
  const db = await getDb();
  const sales = (await db.collection("sales").find({ userId: new ObjectId(userId), customerId: new ObjectId(customerId) }).sort({ date: -1 }).toArray()) as unknown as { _id: ObjectId; userId: ObjectId; customerId: ObjectId; date: string; totalAmount: number; paymentCash: number; paymentUpi: number; isConfirmed?: boolean; billNumber?: string; status?: import("@/lib/types").SaleStatus; createdAt?: Date }[];
  if (sales.length === 0) return [];
  const saleIds = sales.map((s) => s._id);
  const saleItems = (await db.collection("sale_items").find({ saleId: { $in: saleIds } }).toArray()) as unknown as { saleId: ObjectId; itemId: ObjectId; quantity: number; sellingPricePerUnit: number }[];
  const itemIds = Array.from(new Set(saleItems.map((si) => si.itemId.toString())));
  const items = (await db.collection("items").find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } }).toArray()) as unknown as { _id: ObjectId; name: string; unit: string }[];
  const itemMap = new Map<string, { name: string; unit: string }>();
  items.forEach((i) => {
    itemMap.set(i._id.toString(), { name: i.name, unit: i.unit });
  });
  return sales.map((sale) => {
    const saleIdStr = sale._id.toString();
    const itemsForSale = saleItems
      .filter((si) => si.saleId.toString() === saleIdStr)
      .map((si) => ({
        name: itemMap.get(si.itemId.toString())?.name ?? "",
        unit: itemMap.get(si.itemId.toString())?.unit ?? "",
        quantity: si.quantity,
        selling_price_per_unit: si.sellingPricePerUnit,
      }));
    return {
      id: saleIdStr,
      user_id: sale.userId.toString(),
      customer_id: sale.customerId.toString(),
      date: sale.date as string,
      total_amount: Number(sale.totalAmount),
      payment_cash: Number(sale.paymentCash),
      payment_upi: Number(sale.paymentUpi),
      is_confirmed: Boolean(sale.isConfirmed),
      status: (sale.status as import("@/lib/types").SaleStatus) ?? (sale.isConfirmed ? "completed" : "tentative"),
      bill_number: (sale.billNumber as string) ?? null,
      created_at: sale.createdAt?.toISOString?.() ?? "",
      items: itemsForSale,
    };
  });
}

// ---- Sales ----
async function getAverageCostForItem(db: Awaited<ReturnType<typeof getDb>>, userId: ObjectId, itemId: ObjectId): Promise<number> {
  const entries = (await db.collection("stock_entries").find({ userId, itemId }).toArray()) as unknown as { quantity: number; costPricePerUnit: number }[];
  let totalQty = 0;
  let totalCost = 0;
  entries.forEach((e) => {
    totalQty += Number(e.quantity);
    totalCost += Number(e.quantity) * Number(e.costPricePerUnit);
  });
  return totalQty > 0 ? totalCost / totalQty : 0;
}

export async function getNextBillNumber(): Promise<number> {
  const userId = await getUserId();
  const db = await getDb();
  const config = await db.collection("app_config").findOne({ userId: new ObjectId(userId), key: "last_bill_number" });
  const next = (Number(config?.value ?? 0) + 1);
  await db.collection("app_config").updateOne(
    { userId: new ObjectId(userId), key: "last_bill_number" },
    { $set: { value: String(next), updatedAt: new Date() } },
    { upsert: true }
  );
  return next;
}

export async function createSaleAndItems(params: {
  customer_id: string;
  total_amount: number;
  payment_cash: number;
  payment_upi: number;
  status: "tentative" | "completed";
  items: { item_id: string; quantity: number; selling_price_per_unit: number }[];
}): Promise<{ saleId: string; billNumber: string | null }> {
  const userId = await getUserId();
  const db = await getDb();
  const oid = new ObjectId(userId);
  const isCompleted = params.status === "completed";
  const billNumber = isCompleted ? `INV-${String(await getNextBillNumber()).padStart(4, "0")}` : null;
  const saleDoc = {
    userId: oid,
    customerId: new ObjectId(params.customer_id),
    date: new Date().toISOString().slice(0, 10),
    totalAmount: params.total_amount,
    paymentCash: params.payment_cash,
    paymentUpi: params.payment_upi,
    isConfirmed: isCompleted,
    status: params.status,
    billNumber,
    createdAt: new Date(),
  };
  const res = await db.collection("sales").insertOne(saleDoc);
  const saleId = res.insertedId as ObjectId;
  const itemsWithCost = await Promise.all(
    params.items.map(async (line) => ({
      saleId,
      itemId: new ObjectId(line.item_id),
      quantity: line.quantity,
      sellingPricePerUnit: line.selling_price_per_unit,
      costPricePerUnit: await getAverageCostForItem(db, oid, new ObjectId(line.item_id)),
    }))
  );
  await db.collection("sale_items").insertMany(itemsWithCost);
  return { saleId: saleId.toString(), billNumber };
}

export async function getSalesList(): Promise<{
  sales: Array<{
    id: string;
    date: string;
    customer_id: string;
    customer_name: string;
    total_amount: number;
    payment_cash: number;
    payment_upi: number;
    status: string;
    bill_number: string | null;
    profit_on_sold: number;
  }>;
}> {
  const userId = await getUserId();
  const db = await getDb();
  const oid = new ObjectId(userId);
  const sales = await db.collection("sales").find({ userId: oid }).sort({ createdAt: -1 }).toArray();
  const saleIds = sales.map((s: { _id: ObjectId }) => s._id);
  const saleItems = saleIds.length > 0
    ? await db.collection("sale_items").find({ saleId: { $in: saleIds } }).toArray()
    : [];
  const customerIds = Array.from(new Set((sales as unknown as { customerId: ObjectId }[]).map((s) => (s.customerId as ObjectId).toString())));
  const customers = await db.collection("customers").find({ _id: { $in: customerIds.map((id) => new ObjectId(id)) } }).toArray();
  const customerMap = new Map<string, string>();
  (customers as unknown as { _id: ObjectId; name: string }[]).forEach((c) => {
    customerMap.set((c._id as ObjectId).toString(), c.name);
  });
  const list = (sales as Record<string, unknown>[]).map((sale) => {
    const saleIdStr = (sale._id as ObjectId).toString();
    const status = (sale.status as string) ?? "completed";
    const itemsForSale = (saleItems as unknown as { saleId: ObjectId; quantity: number; sellingPricePerUnit: number; costPricePerUnit?: number }[])
      .filter((si) => (si.saleId as ObjectId).toString() === saleIdStr);
    const profitOnSold = status === "completed"
      ? itemsForSale.reduce(
          (sum, si) => sum + Number(si.quantity) * (Number(si.sellingPricePerUnit) - Number(si.costPricePerUnit ?? 0)),
          0
        )
      : 0;
    return {
      id: saleIdStr,
      date: sale.date as string,
      customer_id: (sale.customerId as ObjectId).toString(),
      customer_name: customerMap.get((sale.customerId as ObjectId).toString()) ?? "",
      total_amount: Number(sale.totalAmount),
      payment_cash: Number(sale.paymentCash),
      payment_upi: Number(sale.paymentUpi),
      status,
      bill_number: (sale.billNumber as string) ?? null,
      profit_on_sold: profitOnSold,
    };
  });
  return { sales: list };
}

export async function getSaleByIdForEdit(saleId: string): Promise<{
  sale: { id: string; date: string; customer_id: string; total_amount: number; payment_cash: number; payment_upi: number; status: string };
  items: Array<{ item_id: string; item_name: string; unit: string; quantity: number; selling_price_per_unit: number; cost_price_per_unit: number }>;
  customers: Customer[];
  activeItems: Item[];
  currentStock: { item_id: string; stock: number }[];
} | null> {
  const userId = await getUserId();
  const db = await getDb();
  const oid = new ObjectId(userId);
  const sale = await db.collection("sales").findOne({ _id: new ObjectId(saleId), userId: oid });
  if (!sale) return null;
  const status = (sale as Record<string, unknown>).status as string ?? "completed";
  const saleItems = await db.collection("sale_items").find({ saleId: new ObjectId(saleId) }).toArray();
  const itemIds = Array.from(new Set((saleItems as unknown as { itemId: ObjectId }[]).map((si) => (si.itemId as ObjectId).toString())));
  const itemsData = await db.collection("items").find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } }).toArray();
  const itemMap = new Map<string, { name: string; unit: string }>();
  (itemsData as unknown as { _id: ObjectId; name: string; unit: string }[]).forEach((i) => {
    itemMap.set((i._id as ObjectId).toString(), { name: i.name, unit: i.unit });
  });
  const [customers, activeItems, stockList] = await Promise.all([getCustomers(), getActiveItems(), getCurrentStock()]);
  const currentStock = stockList.map((s) => ({ item_id: s.item_id, stock: s.stock }));
  const items = (saleItems as unknown as { itemId: ObjectId; quantity: number; sellingPricePerUnit: number; costPricePerUnit?: number }[]).map((si) => ({
    item_id: (si.itemId as ObjectId).toString(),
    item_name: itemMap.get((si.itemId as ObjectId).toString())?.name ?? "",
    unit: itemMap.get((si.itemId as ObjectId).toString())?.unit ?? "",
    quantity: si.quantity,
    selling_price_per_unit: si.sellingPricePerUnit,
    cost_price_per_unit: Number(si.costPricePerUnit ?? 0),
  }));
  return {
    sale: {
      id: saleId,
      date: (sale as Record<string, unknown>).date as string,
      customer_id: ((sale as Record<string, unknown>).customerId as ObjectId).toString(),
      total_amount: Number((sale as Record<string, unknown>).totalAmount),
      payment_cash: Number((sale as Record<string, unknown>).paymentCash),
      payment_upi: Number((sale as Record<string, unknown>).paymentUpi),
      status,
    },
    items,
    customers,
    activeItems,
    currentStock,
  };
}

export async function updateTentativeSale(
  saleId: string,
  params: {
    customer_id: string;
    total_amount: number;
    payment_cash: number;
    payment_upi: number;
    items: { item_id: string; quantity: number; selling_price_per_unit: number }[];
  }
): Promise<void> {
  const userId = await getUserId();
  const db = await getDb();
  const oid = new ObjectId(userId);
  const sale = await db.collection("sales").findOne({ _id: new ObjectId(saleId), userId: oid });
  if (!sale || ((sale as Record<string, unknown>).status as string) !== "tentative") throw new Error("Sale not found or not tentative");
  await db.collection("sales").updateOne(
    { _id: new ObjectId(saleId), userId: oid },
    {
      $set: {
        customerId: new ObjectId(params.customer_id),
        totalAmount: params.total_amount,
        paymentCash: params.payment_cash,
        paymentUpi: params.payment_upi,
        updatedAt: new Date(),
      },
    }
  );
  await db.collection("sale_items").deleteMany({ saleId: new ObjectId(saleId) });
  const itemsWithCost = await Promise.all(
    params.items.map(async (line) => ({
      saleId: new ObjectId(saleId),
      itemId: new ObjectId(line.item_id),
      quantity: line.quantity,
      sellingPricePerUnit: line.selling_price_per_unit,
      costPricePerUnit: await getAverageCostForItem(db, oid, new ObjectId(line.item_id)),
    }))
  );
  if (itemsWithCost.length > 0) await db.collection("sale_items").insertMany(itemsWithCost);
}

export async function updateCompletedSale(
  saleId: string,
  params: {
    customer_id: string;
    total_amount: number;
    payment_cash: number;
    payment_upi: number;
    items: { item_id: string; quantity: number; selling_price_per_unit: number }[];
  }
): Promise<void> {
  const userId = await getUserId();
  const db = await getDb();
  const oid = new ObjectId(userId);
  const sale = await db.collection("sales").findOne({ _id: new ObjectId(saleId), userId: oid });
  if (!sale || ((sale as Record<string, unknown>).status as string) !== "completed") throw new Error("Sale not found or not completed");
  await db.collection("sales").updateOne(
    { _id: new ObjectId(saleId), userId: oid },
    {
      $set: {
        customerId: new ObjectId(params.customer_id),
        totalAmount: params.total_amount,
        paymentCash: params.payment_cash,
        paymentUpi: params.payment_upi,
        updatedAt: new Date(),
      },
    }
  );
  await db.collection("sale_items").deleteMany({ saleId: new ObjectId(saleId) });
  const itemsWithCost = await Promise.all(
    params.items.map(async (line) => ({
      saleId: new ObjectId(saleId),
      itemId: new ObjectId(line.item_id),
      quantity: line.quantity,
      sellingPricePerUnit: line.selling_price_per_unit,
      costPricePerUnit: await getAverageCostForItem(db, oid, new ObjectId(line.item_id)),
    }))
  );
  if (itemsWithCost.length > 0) await db.collection("sale_items").insertMany(itemsWithCost);
}

export async function deleteSale(saleId: string): Promise<void> {
  const userId = await getUserId();
  const db = await getDb();
  const oid = new ObjectId(userId);
  const sale = await db.collection("sales").findOne({ _id: new ObjectId(saleId), userId: oid });
  if (!sale) throw new Error("Sale not found");
  await db.collection("sale_items").deleteMany({ saleId: new ObjectId(saleId) });
  await db.collection("sales").deleteOne({ _id: new ObjectId(saleId), userId: oid });
}

export async function completeTentativeSale(saleId: string): Promise<{ billNumber: string; sale: { customer_name: string; customer_phone: string | null; date: string; total_amount: number; payment_cash: number; payment_upi: number }; items: Array<{ name: string; unit: string; quantity: number; selling_price_per_unit: number }> }> {
  const userId = await getUserId();
  const db = await getDb();
  const oid = new ObjectId(userId);
  const sale = await db.collection("sales").findOne({ _id: new ObjectId(saleId), userId: oid });
  if (!sale || ((sale as Record<string, unknown>).status as string) !== "tentative") throw new Error("Sale not found or not tentative");
  const billNumber = `INV-${String(await getNextBillNumber()).padStart(4, "0")}`;
  await db.collection("sales").updateOne(
    { _id: new ObjectId(saleId), userId: oid },
    { $set: { status: "completed", isConfirmed: true, billNumber, updatedAt: new Date() } }
  );
  const customerId = (sale as Record<string, unknown>).customerId as ObjectId;
  const customer = await db.collection("customers").findOne({ _id: customerId });
  const saleItems = await db.collection("sale_items").find({ saleId: new ObjectId(saleId) }).toArray();
  const itemIds = Array.from(new Set((saleItems as unknown as { itemId: ObjectId }[]).map((si) => (si.itemId as ObjectId).toString())));
  const itemsData = await db.collection("items").find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } }).toArray();
  const itemMap = new Map<string, { displayName: string; unit: string }>();
  (itemsData as unknown as { _id: ObjectId; name: string; billingName?: string; unit: string }[]).forEach((i) => {
    const displayName = (i.billingName as string)?.trim() || i.name;
    itemMap.set((i._id as ObjectId).toString(), { displayName, unit: i.unit });
  });
  const items = (saleItems as unknown as { itemId: ObjectId; quantity: number; sellingPricePerUnit: number }[]).map((si) => ({
    name: itemMap.get((si.itemId as ObjectId).toString())?.displayName ?? "",
    unit: itemMap.get((si.itemId as ObjectId).toString())?.unit ?? "",
    quantity: si.quantity,
    selling_price_per_unit: si.sellingPricePerUnit,
  }));
  return {
    billNumber,
    sale: {
      customer_name: (customer as unknown as { name: string } | null)?.name ?? "",
      customer_phone: (customer as unknown as { phone?: string } | null)?.phone ?? null,
      date: (sale as Record<string, unknown>).date as string,
      total_amount: Number((sale as Record<string, unknown>).totalAmount),
      payment_cash: Number((sale as Record<string, unknown>).paymentCash),
      payment_upi: Number((sale as Record<string, unknown>).paymentUpi),
    },
    items,
  };
}

async function getSaleBillDataInternal(
  saleId: string,
  options: { forTentative?: boolean }
): Promise<{
  businessName: string;
  billNumber: string;
  date: string;
  customerName: string;
  customerPhone: string | null;
  items: Array<{ name: string; unit: string; quantity: number; unitPrice: number; lineTotal: number }>;
  grandTotal: number;
  paymentCash: number;
  paymentUpi: number;
} | null> {
  const userId = await getUserId();
  const db = await getDb();
  const sale = await db.collection("sales").findOne({ _id: new ObjectId(saleId), userId: new ObjectId(userId) });
  if (!sale) return null;
  const status = (sale as Record<string, unknown>).status as string;
  if (options.forTentative) {
    if (status !== "tentative") return null;
  } else {
    if (status !== "completed") return null;
    if (!(sale as Record<string, unknown>).billNumber) return null;
  }
  const billNumber = options.forTentative
    ? "Draft"
    : ((sale as Record<string, unknown>).billNumber as string);
  const customerIdForBill = (sale as Record<string, unknown>).customerId as ObjectId;
  const customer = await db.collection("customers").findOne({ _id: customerIdForBill });
  const saleItems = await db.collection("sale_items").find({ saleId: new ObjectId(saleId) }).toArray();
  const itemIds = Array.from(new Set((saleItems as unknown as { itemId: ObjectId }[]).map((si) => (si.itemId as ObjectId).toString())));
  const itemsData = await db.collection("items").find({ _id: { $in: itemIds.map((id) => new ObjectId(id)) } }).toArray();
  const itemMap = new Map<string, { displayName: string; unit: string }>();
  (itemsData as unknown as { _id: ObjectId; name: string; billingName?: string; unit: string }[]).forEach((i) => {
    const displayName = (i.billingName as string)?.trim() || i.name;
    itemMap.set((i._id as ObjectId).toString(), { displayName, unit: i.unit });
  });
  const businessName = await getAppConfigValue("business_name");
  const formatDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };
  const items = (saleItems as unknown as { itemId: ObjectId; quantity: number; sellingPricePerUnit: number }[]).map((si) => {
    const id = (si.itemId as ObjectId).toString();
    const qty = Number(si.quantity);
    const up = Number(si.sellingPricePerUnit);
    return {
      name: itemMap.get(id)?.displayName ?? "",
      unit: itemMap.get(id)?.unit ?? "",
      quantity: qty,
      unitPrice: up,
      lineTotal: qty * up,
    };
  });
  return {
    businessName,
    billNumber,
    date: formatDate((sale as Record<string, unknown>).date as string),
    customerName: (customer as unknown as { name: string } | null)?.name ?? "",
    customerPhone: (customer as unknown as { phone?: string } | null)?.phone ?? null,
    items,
    grandTotal: Number((sale as Record<string, unknown>).totalAmount),
    paymentCash: Number((sale as Record<string, unknown>).paymentCash),
    paymentUpi: Number((sale as Record<string, unknown>).paymentUpi),
  };
}

export async function getSaleBillData(saleId: string): Promise<{
  businessName: string;
  billNumber: string;
  date: string;
  customerName: string;
  customerPhone: string | null;
  items: Array<{ name: string; unit: string; quantity: number; unitPrice: number; lineTotal: number }>;
  grandTotal: number;
  paymentCash: number;
  paymentUpi: number;
} | null> {
  return getSaleBillDataInternal(saleId, { forTentative: false });
}

export async function getTentativeSaleBillData(saleId: string): Promise<{
  businessName: string;
  billNumber: string;
  date: string;
  customerName: string;
  customerPhone: string | null;
  items: Array<{ name: string; unit: string; quantity: number; unitPrice: number; lineTotal: number }>;
  grandTotal: number;
  paymentCash: number;
  paymentUpi: number;
} | null> {
  return getSaleBillDataInternal(saleId, { forTentative: true });
}

// ---- Dashboard ----
export async function getDashboardData(): Promise<{
  sales: { id: string; date: string; total_amount: number; payment_cash: number; payment_upi: number; is_confirmed: boolean }[];
  saleItems: { sale_id: string; item_id: string; quantity: number; selling_price_per_unit: number; cost_price_per_unit: number }[];
  stockEntries: { item_id: string; date: string; quantity: number; cost_price_per_unit: number }[];
  items: { id: string; name: string }[];
}> {
  const userId = await getUserId();
  const db = await getDb();
  const oid = new ObjectId(userId);
  const sales = await db.collection("sales").find({ userId: oid }).toArray();
  const completedSaleIds = (sales as Record<string, unknown>[])
    .filter((s) => (s.status as string) === "completed" || (s.status == null && s.isConfirmed))
    .map((s) => s._id as ObjectId);
  const saleItems = completedSaleIds.length > 0
    ? await db.collection("sale_items").find({ saleId: { $in: completedSaleIds } }).toArray()
    : [];
  const stockEntries = await db.collection("stock_entries").find({ userId: oid }).toArray();
  const items = await db.collection("items").find({ userId: oid, isActive: true }).toArray();
  return {
    sales: sales.map((s: Record<string, unknown>) => ({
      id: (s._id as ObjectId).toString(),
      date: s.date as string,
      total_amount: Number(s.totalAmount),
      payment_cash: Number(s.paymentCash),
      payment_upi: Number(s.paymentUpi),
      is_confirmed: (s.status as string) === "completed" || Boolean(s.isConfirmed),
      status: (s.status as string) ?? "completed",
    })),
    saleItems: (saleItems as unknown as { saleId: ObjectId; itemId: ObjectId; quantity: number; sellingPricePerUnit: number; costPricePerUnit?: number }[]).map((si) => ({
      sale_id: (si.saleId as ObjectId).toString(),
      item_id: (si.itemId as ObjectId).toString(),
      quantity: si.quantity,
      selling_price_per_unit: si.sellingPricePerUnit,
      cost_price_per_unit: Number(si.costPricePerUnit ?? 0),
    })),
    stockEntries: (stockEntries as unknown as { itemId: ObjectId; date: string; quantity: number; costPricePerUnit: number }[]).map((e) => ({
      item_id: (e.itemId as ObjectId).toString(),
      date: e.date,
      quantity: e.quantity,
      cost_price_per_unit: e.costPricePerUnit,
    })),
    items: (items as unknown as { _id: ObjectId; name: string }[]).map((i) => ({
      id: (i._id as ObjectId).toString(),
      name: i.name,
    })),
  };
}

// ---- Customers list with stats ----
export async function getCustomersWithStats(): Promise<{
  customers: Customer[];
  lastSaleByCustomer: Map<string, string>;
  totalSpendByCustomer: Map<string, number>;
  purchaseCountByCustomer: Map<string, number>;
}> {
  const userId = await getUserId();
  const db = await getDb();
  const oid = new ObjectId(userId);
  const customers = await db.collection("customers").find({ userId: oid }).sort({ createdAt: -1 }).toArray();
  const sales = (await db.collection("sales").find({
    userId: oid,
    $or: [{ status: "completed" }, { status: { $exists: false } }, { isConfirmed: true }],
  }).toArray()) as unknown as { customerId: ObjectId; date: string; totalAmount: number }[];
  const lastSaleByCustomer = new Map<string, string>();
  const totalSpendByCustomer = new Map<string, number>();
  const purchaseCountByCustomer = new Map<string, number>();
  sales.forEach((s) => {
    const cid = s.customerId.toString();
    if (!lastSaleByCustomer.has(cid) || (s.date > (lastSaleByCustomer.get(cid) ?? ""))) {
      lastSaleByCustomer.set(cid, s.date);
    }
    totalSpendByCustomer.set(cid, (totalSpendByCustomer.get(cid) ?? 0) + Number(s.totalAmount));
    purchaseCountByCustomer.set(cid, (purchaseCountByCustomer.get(cid) ?? 0) + 1);
  });
  return {
    customers: customers.map((d) => toCustomer(d as Record<string, unknown>)),
    lastSaleByCustomer,
    totalSpendByCustomer,
    purchaseCountByCustomer,
  };
}
