"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, KeyRound, Share2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { api, type Credential, type ShareResponse, ApiError } from "@/lib/api";
import { Topbar } from "@/components/features/topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShareDialog } from "@/components/features/share-dialog";
import { useRequireAuth } from "@/lib/auth";
import { formatDateTime, shortHash } from "@/lib/utils";

const EXPIRY_OPTIONS = [
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 hour" },
  { value: "1440", label: "24 hours" },
  { value: "10080", label: "7 days" },
];

export default function CredentialDetailPage() {
  useRequireAuth();
  const params = useParams<{ id: string }>();
  const [credential, setCredential] = useState<Credential | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expiryMinutes, setExpiryMinutes] = useState("15");
  const [submitting, setSubmitting] = useState(false);
  const [share, setShare] = useState<ShareResponse | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    api
      .getCredential(params.id)
      .then(setCredential)
      .catch((err) => toast.error(err instanceof ApiError ? err.message : "failed to load"))
      .finally(() => setLoading(false));
  }, [params?.id]);

  const toggleAll = () => {
    if (!credential) return;
    if (selected.size === credential.leaf_order.length) setSelected(new Set());
    else setSelected(new Set(credential.leaf_order));
  };

  const toggle = (field: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const onShare = async () => {
    if (!credential || selected.size === 0) {
      toast.error("select at least one field to share");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.share({
        credential_id: credential.id,
        fields: Array.from(selected),
        expires_in_minutes: Number(expiryMinutes),
      });
      setShare(res);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "share failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <main className="container py-8">
          <div className="h-96 rounded-xl border bg-card/50 animate-pulse" />
        </main>
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <main className="container py-8 text-center">
          <p>Credential not found.</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </main>
      </div>
    );
  }

  const allSelected = selected.size === credential.leaf_order.length;

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-8 max-w-4xl">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to credentials
        </Link>

        {/* Credential header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>{credential.credential_type}</CardTitle>
                <CardDescription>
                  Issued by {credential.issuer_name} · {formatDateTime(credential.issued_at)}
                </CardDescription>
              </div>
              <Badge variant="success">
                <KeyRound className="h-3 w-3 mr-1" /> Ed25519 signed
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <Field label="Merkle root" value={shortHash(credential.merkle_root, 12, 8)} mono />
              <Field label="Issuer key" value={shortHash(credential.issuer_public_key, 12, 8)} mono />
            </div>
          </CardContent>
        </Card>

        {/* Selective disclosure */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle>Selective disclosure</CardTitle>
                <CardDescription>
                  Pick which claims to reveal. Hidden ones remain cryptographically committed.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {allSelected ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {allSelected ? "Hide all" : "Reveal all"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-2">
              {credential.leaf_order.map((field) => {
                const checked = selected.has(field);
                return (
                  <label
                    key={field}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      checked ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(field)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{field}</div>
                      <div className="text-xs text-muted-foreground truncate font-mono">
                        {checked ? String(credential.claims[field]) : "hidden until shared"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end pt-2">
              <div className="space-y-2">
                <Label>Link expires after</Label>
                <Select value={expiryMinutes} onValueChange={setExpiryMinutes}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={onShare} loading={submitting} disabled={selected.size === 0}>
                <Share2 className="h-4 w-4" /> Generate share link
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      {share && (
        <ShareDialog
          open={!!share}
          onOpenChange={(o) => !o && setShare(null)}
          shareUrl={share.share_url}
          expiresAt={share.expires_at}
          revealedFields={share.revealed_fields}
        />
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs mt-0.5" : "mt-0.5"}>{value}</div>
    </div>
  );
}
