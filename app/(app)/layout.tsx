import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <AppNav />
      <main className="flex-1 p-4 pb-safe md:pb-4 md:pl-0 md:ml-56 overflow-auto">
        {children}
      </main>
    </div>
  );
}
