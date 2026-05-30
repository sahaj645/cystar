"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, ShieldCheck, KeyRound, Clock, Building2 } from "lucide-react";

import { api, type VerifyResponse, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        // Fetch the full presentation so we can show cryptographic context.
        const presentation = await api.fetchShare(params.token);
        if (cancelled) return;
        setIssuerKey(presentation.issuer_public_key);
        setMerkleRoot(presentation.merkle_root);
        // Verify via the public endpoint with the share token (server side check).
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
      <main className="min-h-screen bg-grid p-4 flex items-center justify-center">
        <div className="max-w-2xl w-full">
          <div className="h-40 rounded-xl border bg-card/50 animate-pulse" />
          <div className="h-64 rounded-xl border bg-card/50 animate-pulse mt-4" />
        </div>
      </main>
    );
  }

  const ok = result?.verified ?? false;

  return (
    <main className="min-h-screen bg-grid">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span>CyStar verifier</span>
          </Link>
          <Badge variant="outline" className="text-[10px] hidden sm:flex">Public verification</Badge>
        </div>
      </header>

      <div className="container py-6 md:py-10 max-w-2xl">
        {/* Verdict */}
        <Card className={`mb-6 border-2 ${ok ? "border-success/60" : "border-destructive/60"}`}>
          <CardContent className="p-6 md:p-8 text-center">
            {ok ? (
              <CheckCircle2 className="mx-auto h-14 w-14 text-success mb-3" />
            ) : (
              <XCircle className="mx-auto h-14 w-14 text-destructive mb-3" />
            )}
            <h1 className="text-2xl md:text-3xl font-bold">
              {ok ? "Cryptographically verified" : "Verification failed"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              {ok
                ? "Disclosed claims match the issuer's signed Merkle root. Tampering would have broken the proof."
                : result?.failure_reason || "The presentation could not be verified."}
            </p>
            {ok && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-success/10 text-success px-3 py-1 text-xs font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Trust score {result?.trust_score}/100
              </div>
            )}
          </CardContent>
        </Card>

        {/* Issuer */}
        {ok && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Issuer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Name" value={result?.issuer_name || "—"} />
              <Row label="Issued at" value={formatDateTime(result?.issued_at)} />
              {result?.expires_at && (
                <Row label="Share expires" value={`${formatDateTime(result.expires_at)} (in ${timeUntil(result.expires_at)})`} />
              )}
              {issuerKey && <Row label="Public key" value={shortHash(issuerKey, 14, 10)} mono />}
              {merkleRoot && <Row label="Merkle root" value={shortHash(merkleRoot, 14, 10)} mono />}
            </CardContent>
          </Card>
        )}

        {/* Disclosed claims */}
        {ok && result?.revealed_claims && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disclosed claims</CardTitle>
              <CardDescription className="text-xs">
                Only the fields shown were revealed. Other fields remain hidden but are bound to the same signature.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border/50">
                {Object.entries(result.revealed_claims).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-3 gap-3 py-3">
                    <dt className="text-xs text-muted-foreground self-center">{k}</dt>
                    <dd className="col-span-2 text-sm font-medium break-words">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        {/* How */}
        <Card className="mt-6 bg-card/50">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <KeyRound className="h-3.5 w-3.5 text-primary" /> How this works
            </div>
            <p>
              Each claim was salted, hashed, and placed in a Merkle tree. The issuer signed the tree&apos;s root with Ed25519.
              The disclosed claims include inclusion proofs that reconstruct the same root, and the signature is checked
              against the issuer&apos;s public key. Any tampered field breaks the proof.
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Clock className="inline h-3 w-3 mr-1" />
          Verified at {formatDateTime(new Date())}
        </p>
      </div>
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={mono ? "font-mono text-xs" : "text-sm font-medium"}>{value}</span>
    </div>
  );
}
