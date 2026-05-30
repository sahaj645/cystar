"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LogOut, Plus, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function Topbar() {
  const { user, logout } = useUser();
  const pathname = usePathname();
  return (
    <header className="border-b border-border/60 bg-background/70 backdrop-blur-md sticky top-0 z-30">
      <div className="container flex h-16 items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 focus-ring rounded"
        >
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
          <span className="font-semibold tracking-tight">CyStar</span>
        </Link>

        <nav className="flex items-center gap-1">
          <NavLink href="/dashboard" active={pathname?.startsWith("/dashboard") ?? false}>
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Credentials</span>
          </NavLink>
          <Button asChild size="sm" className="ml-1">
            <Link href="/issue">
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Issue</span>
              </span>
            </Link>
          </Button>
          {user && (
            <div className="ml-2 flex items-center gap-2 pl-2 border-l border-border/60">
              <div className="hidden md:flex flex-col items-end leading-tight">
                <span className="text-xs font-medium">{user.full_name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {user.email}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                title="Sign out"
                className="h-9 w-9"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 h-9 rounded-md text-sm font-medium transition-colors focus-ring",
        active
          ? "text-foreground bg-secondary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
      )}
    >
      {children}
    </Link>
  );
}
