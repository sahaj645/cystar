"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  KeyRound,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { api, type Credential, ApiError } from "@/lib/api";
import { Topbar } from "@/components/features/topbar";
import { Button } from "@/components/ui/button";
import { formatDateTime, shortHash } from "@/lib/utils";
import { useRequireAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { loading: authLoading } = useRequireAuth();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    api
      .listCredentials()
      .then(setCredentials)
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : "failed to load credentials")
      )
      .finally(() => setLoading(false));
  }, [authLoading]);

  const claimCount = credentials.reduce(
    (acc, c) => acc + Object.keys(c.claims).length,
    0
  );

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-10 md:py-14 animate-fade-in">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <div className="mono-tag mb-3">Credentials</div>
            <h1 className="text-3xl md:text-4xl tracking-tighter font-semibold">
              Your verifiable vault
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Every credential is signed at issuance. Disclose only the fields
              you choose &mdash; the rest stay bound to the same proof.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {credentials.length > 0 && (
              <div className="hidden md:flex items-center gap-4 mr-4 text-xs text-muted-foreground">
                <Counter label="credentials" value={credentials.length} />
                <Counter label="claims" value={claimCount} />
              </div>
            )}
            <Button asChild>
              <Link href="/issue">
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Issue
                </span>
              </Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-44 rounded-xl border border-border/60 surface skeleton"
              />
            ))}
          </div>
        ) : credentials.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {credentials.map((c, idx) => (
              <CredentialCard key={c.id} c={c} index={idx} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-mono font-semibold text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function CredentialCard({ c, index }: { c: Credential; index: number }) {
  const claimCount = Object.keys(c.claims).length;
  return (
    <Link
      href={`/credentials/${c.id}`}
      className="group block animate-fade-in"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <article className="relative surface rounded-xl p-6 h-full transition-all duration-200 hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_-12px_hsl(var(--primary)/0.25)]">
        {/* corner indicator */}
        <ArrowUpRight className="absolute top-5 right-5 h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />

        <div className="flex items-start gap-3 mb-5">
          <div className="h-10 w-10 rounded-lg border border-border bg-gradient-to-br from-primary/15 to-primary/5 text-primary flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold tracking-tight truncate">
              {c.credential_type}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {c.issuer_name}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <Row label="Claims" value={`${claimCount}`} />
          <Row label="Issued" value={formatDateTime(c.issued_at)} />
          <Row
            label="Root"
            value={shortHash(c.merkle_root, 8, 6)}
            mono
          />
        </div>

        <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between text-[10px]">
          <span className="mono-tag">
            <KeyRound className="h-2.5 w-2.5" />
            Ed25519
          </span>
          <span className="text-success font-mono uppercase tracking-wider">
            &bull; signed
          </span>
        </div>
      </article>
    </Link>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-foreground/80" : "text-foreground/80 truncate"}>
        {value}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="surface rounded-xl py-20 px-6 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-gradient-to-br from-primary/15 to-primary/5 text-primary mb-5">
        <FileText className="h-7 w-7" />
      </div>
      <h2 className="text-xl tracking-tight font-semibold">
        Your vault is empty
      </h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
        Issue your first verifiable credential. The issuer signs the Merkle
        root so you can selectively disclose any subset of claims later.
      </p>
      <Button asChild className="mt-7">
        <Link href="/issue">
          <span className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Issue your first credential
          </span>
        </Link>
      </Button>
    </div>
  );
}
