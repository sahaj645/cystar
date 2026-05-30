"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { api, type Credential, ApiError } from "@/lib/api";
import { Topbar } from "@/components/features/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "failed to load credentials"))
      .finally(() => setLoading(false));
  }, [authLoading]);

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-8 md:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">My credentials</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cryptographically signed verifiable credentials, ready to share.
            </p>
          </div>
          <Button asChild>
            <Link href="/issue">
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" /> Issue new
              </span>
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl border border-border/50 bg-card/50 animate-pulse" />
            ))}
          </div>
        ) : credentials.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {credentials.map((c) => (
              <CredentialCard key={c.id} c={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CredentialCard({ c }: { c: Credential }) {
  const claimCount = Object.keys(c.claims).length;
  return (
    <Link href={`/credentials/${c.id}`}>
      <Card className="hover:border-primary/50 transition-colors h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">{c.credential_type}</CardTitle>
                <CardDescription className="text-xs">{c.issuer_name}</CardDescription>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <Badge variant="outline">{claimCount} claims</Badge>
            <span>·</span>
            <span>Issued {formatDateTime(c.issued_at)}</span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            root {shortHash(c.merkle_root)}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState() {
  return (
    <Card className="text-center py-16">
      <CardContent>
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
          <FileText className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold">No credentials yet</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Issue your first verifiable credential. The issuer signs the Merkle root so you can selectively disclose later.
        </p>
        <Button asChild className="mt-6">
          <Link href="/issue">
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Issue your first credential
            </span>
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
