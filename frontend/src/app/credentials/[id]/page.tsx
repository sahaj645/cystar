"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, KeyRound, ScanFace, Share2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { api, type Credential, type ShareResponse, ApiError } from "@/lib/api";
import { Topbar } from "@/components/features/topbar";
import { Button } from "@/components/ui/button";
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
import { FaceAuthDialog } from "@/components/features/face-auth-dialog";
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
  const [faceVerified, setFaceVerified] = useState(false);
  const [faceAuthOpen, setFaceAuthOpen] = useState(false);

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

  /**
   * Perform the actual share API call. Should only be invoked after the
   * holder has cleared face authentication.
   */
  const performShare = async () => {
    if (!credential) return;
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

  /**
   * Entry point for the "Generate share link" button. Enforces field
   * selection, then gates the actual share on Aadhaar face authentication.
   * Once the holder has cleared face auth in this session we don't ask again.
   */
  const onShare = async () => {
    if (!credential || selected.size === 0) {
      toast.error("select at least one field to share");
      return;
    }
    if (!faceVerified) {
      setFaceAuthOpen(true);
      return;
    }
    await performShare();
  };

  /**
   * Called by FaceAuthDialog on successful biometric match. Latches
   * verification for the rest of the session and proceeds with the share.
   */
  const onFaceVerified = () => {
    setFaceVerified(true);
    void performShare();
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
      <main className="container py-10 max-w-4xl animate-fade-in">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors focus-ring rounded"
        >
          <ArrowLeft className="h-4 w-4" /> Back to credentials
        </Link>

        {/* Credential header */}
        <div className="surface rounded-xl p-7 mb-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <div className="mono-tag mb-3">{credential.credential_type}</div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter">
                {credential.issuer_name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Issued {formatDateTime(credential.issued_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Badge variant="success">
                <KeyRound className="h-3 w-3 mr-1" /> Ed25519 signed
              </Badge>
              {faceVerified && (
                <Badge variant="outline" className="border-success/40 text-success">
                  <ScanFace className="h-3 w-3 mr-1" /> Face verified
                </Badge>
              )}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 pt-5 border-t border-border/60 text-xs">
            <Field label="Merkle root" value={shortHash(credential.merkle_root, 14, 10)} mono />
            <Field label="Issuer key" value={shortHash(credential.issuer_public_key, 14, 10)} mono />
          </div>
        </div>

        {/* Selective disclosure */}
        <div className="surface rounded-xl p-7">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
            <div>
              <div className="mono-tag mb-3">Selective disclosure</div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                Choose what to reveal
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Hidden claims stay cryptographically bound to the same signature
                &mdash; nothing about them leaks.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              <span className="inline-flex items-center gap-2">
                {allSelected ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {allSelected ? "Hide all" : "Reveal all"}
              </span>
            </Button>
          </div>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-2">
              {credential.leaf_order.map((field) => {
                const checked = selected.has(field);
                return (
                  <label
                    key={field}
                    className={`group flex items-center gap-3 rounded-lg border p-3.5 cursor-pointer transition-all ${
                      checked
                        ? "border-primary/60 bg-primary/[0.04] shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.15)]"
                        : "border-border/70 hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(field)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium tracking-tight">{field}</div>
                      <div
                        className={`text-xs truncate font-mono ${
                          checked
                            ? "text-foreground/80"
                            : "text-muted-foreground/70 italic"
                        }`}
                      >
                        {checked ? String(credential.claims[field]) : "hidden until shared"}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-border/60 grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Link expires after
                </Label>
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
              <Button
                onClick={onShare}
                loading={submitting}
                disabled={selected.size === 0}
                size="lg"
              >
                {faceVerified ? (
                  <>
                    <Share2 className="h-4 w-4" /> Generate share link
                  </>
                ) : (
                  <>
                    <ScanFace className="h-4 w-4" /> Verify &amp; share
                  </>
                )}
              </Button>
            </div>
            {!faceVerified && selected.size > 0 && (
              <p className="text-[11px] text-muted-foreground/80 flex items-center gap-1.5 mt-3">
                <ScanFace className="h-3 w-3" />
                Aadhaar face authentication is required before the share link is issued.
              </p>
            )}
          </div>
        </div>
      </main>

      <FaceAuthDialog
        open={faceAuthOpen}
        onOpenChange={setFaceAuthOpen}
        onVerified={onFaceVerified}
      />

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
