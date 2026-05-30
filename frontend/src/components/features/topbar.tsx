"use client";

import Link from "next/link";
import { ShieldCheck, LogOut, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/auth";

export function Topbar() {
  const { user, logout } = useUser();
  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur sticky top-0 z-30">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <span>CyStar</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">My credentials</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/issue">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Issue</span>
            </Link>
          </Button>
          {user && (
            <Button variant="ghost" size="sm" onClick={logout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
