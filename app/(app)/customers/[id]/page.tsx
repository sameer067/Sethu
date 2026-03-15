import { redirect, notFound } from "next/navigation";
import { getCustomerById, getSalesByCustomerId } from "@/lib/actions";
import { CustomerDetail } from "@/components/customers/customer-detail";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let customer;
  try {
    customer = await getCustomerById(id);
  } catch {
    redirect("/login");
  }
  if (!customer) notFound();

  const sales = await getSalesByCustomerId(id);

  return <CustomerDetail customer={customer} sales={sales} />;
}
