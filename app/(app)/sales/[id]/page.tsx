import { notFound } from "next/navigation";
import { getSaleByIdForEdit } from "@/lib/actions";
import { SalesDetail } from "@/components/sales/sales-detail";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getSaleByIdForEdit(id);
  if (!data) notFound();
  return (
    <SalesDetail
      initialData={{
        ...data,
        currentStock: data.currentStock ?? [],
      }}
      saleId={id}
    />
  );
}
