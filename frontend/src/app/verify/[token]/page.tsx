"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Clock,
  KeyRound,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { api, type VerifyResponse, ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, shortHash, timeUntil } from "@/lib/utils";

export default function VerifyPage() {
  const params = useParams<{ token: string }>();
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuerKey, setIssuerKey] = useState<string | null>(null);
  const [merkleRoot, setMerkleRoot] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.token) return;
    let cancelled = false;
    (async () => {
      try {
        const presentation = await api.fetchShare(params.token);
        if (cancelled) return;
        setIssuerKey(presentation.issuer_public_key);
        setMerkleRoot(presentation.merkle_root);
        const v = await api.verify({ share_token: params.token });
        if (!cancelled) setResult(v);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : "verification failed";
        setResult({
          verified: false,
          fields_verified: [],
          failure_reason: message,
          issuer_name: null,
          issued_at: null,
          expires_at: null,
          revealed_claims: null,
          trust_score: 0,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params?.token]);

  if (loading) {
    return (
      <main className="min-h-screen p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full space-y-4">
          <div className="h-44 rounded-xl border border-border/60 skeleton" />
          <div className="h-72 rounded-xl border border-border/60 skeleton" />
        </div>
      </main>
    );
  }

  const ok = result?.verified ?? false;

  return (
    <main className="min-h-screen">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 -z-10 hero-glow" />

      <header className="border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-ring rounded"
          >
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <span className="font-semibold tracking-tight">CyStar</span>
            <span className="mono-tag hidden sm:inline-flex">verifier</span>
          </Link>
          <Badge variant="outline" className="text-[10px]">
            Public verification
          </Badge>
        </div>
      </header>

      <div className="container py-10 md:py-14 max-w-2xl animate-fade-in">
        {/* Verdict */}
        <section
          className={`surface rounded-xl p-8 md:p-10 text-center mb-6 border-2 ${
            ok ? "border-success/40" : "border-destructive/40"
          }`}
        >
          {ok ? (
            <div className="relative mx-auto mb-4 h-16 w-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-success/15 blur-xl" />
              <CheckCircle2 className="relative h-14 w-14 text-success" strokeWidth={1.5} />
            </div>
          ) : (
            <XCircle className="mx-auto h-14 w-14 text-destructive mb-4" strokeWidth={1.5} />
          )}
          <div className="mono-tag mb-4 mx-auto w-fit">
            {ok ? "Verified" : "Failed"}
          </div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tighter">
            {ok ? (
              <>
                <span className="text-gradient">Cryptographically</span>{" "}
                <span className="font-serif italic text-gradient-primary">
                  verified.
                </span>
              </>
            ) : (
              "Verification failed"
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-md mx-auto leading-relaxed">
            {ok
              ? "Disclosed claims match the issuer's signed Merkle root. Tampering would have broken the proof."
              : result?.failure_reason || "The presentation could not be verified."}
          </p>
          {ok && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 text-success px-3 py-1 text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> Trust score{" "}
              <span className="font-mono">{result?.trust_score}</span> / 100
            </div>
          )}
        </section>

        {/* Issuer */}
        {ok && (
          <section className="surface rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Issuer
              </h2>
            </div>
            <dl className="space-y-3 text-sm">
              <Row label="Name" value={result?.issuer_name || "—"} />
              <Row label="Issued at" value={formatDateTime(result?.issued_at)} />
              {result?.expires_at && (
                <Row
                  label="Share expires"
                  value={`${formatDateTime(result.expires_at)} (in ${timeUntil(result.expires_at)})`}
                />
              )}
              {issuerKey && <Row label="Public key" value={shortHash(issuerKey, 14, 10)} mono />}
              {merkleRoot && <Row label="Merkle root" value={shortHash(merkleRoot, 14, 10)} mono />}
            </dl>
          </section>
        )}

        {/* Disclosed claims */}
        {ok && result?.revealed_claims && (
          <section className="surface rounded-xl p-6">
            <div className="mb-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Disclosed claims
              </h2>
              <p className="text-xs text-muted-foreground/80 mt-1.5">
                Only the fields shown were revealed. Others remain hidden but
                bound to the same signature.
              </p>
            </div>
            <dl className="divide-y divide-border/60">
              {Object.entries(result.revealed_claims).map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-3 py-3.5">
                  <dt className="text-xs text-muted-foreground self-center uppercase tracking-wider font-mono">
                    {k}
                  </dt>
                  <dd className="col-span-2 text-base font-medium tracking-tight break-words">
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* How */}
        <section className="mt-6 rounded-xl border border-border/60 bg-muted/20 p-5 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <KeyRound className="h-3.5 w-3.5 text-primary" /> How this works
          </div>
          <p className="leading-relaxed">
            Each claim was salted, hashed, and placed in a Merkle tree. The
            issuer signed the tree&apos;s root with Ed25519. Disclosed claims
            include inclusion proofs that reconstruct the same root, and the
            signature is checked against the issuer&apos;s public key. Any
            tampered field breaks the proof.
          </p>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground/70">
          <Clock className="inline h-3 w-3 mr-1" />
          Verified at {formatDateTime(new Date())}
        </p>
      </div>
    </main>
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
    <div className="flex items-start justify-between gap-3">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={mono ? "font-mono text-xs" : "text-sm font-medium"}>
        {value}
      </dd>
    </div>
  );
}
