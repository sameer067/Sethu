"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Receipt,
  Users,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/sales", label: "Sales", icon: Receipt },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 border-r bg-card">
        <div className="flex flex-col gap-1 p-2">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </div>
      </aside>

      {/* Mobile floating bottom bar */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 z-50">
        <div className="rounded-2xl border bg-card/95 backdrop-blur shadow-lg px-1 py-1.5 grid grid-cols-5 gap-0 min-h-0">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-medium transition-colors min-w-0",
                pathname === href || pathname.startsWith(href + "/")
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground active:bg-muted/50"
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="truncate max-w-[52px]">{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Spacer for mobile so content scrolls above the floating bar */}
      <div className="md:hidden h-16 flex-shrink-0" aria-hidden />
    </>
  );
}
