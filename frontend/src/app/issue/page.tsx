"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { Topbar } from "@/components/features/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRequireAuth } from "@/lib/auth";

type ClaimRow = { id: number; name: string; value: string };

const DEFAULT_ROWS: ClaimRow[] = [
  { id: 1, name: "name", value: "" },
  { id: 2, name: "degree", value: "" },
  { id: 3, name: "graduationYear", value: "" },
  { id: 4, name: "cgpa", value: "" },
];

const PRESETS: Record<string, ClaimRow[]> = {
  Academic: [
    { id: 1, name: "name", value: "" },
    { id: 2, name: "degree", value: "" },
    { id: 3, name: "graduationYear", value: "" },
    { id: 4, name: "cgpa", value: "" },
    { id: 5, name: "marks", value: "" },
  ],
  Identity: [
    { id: 1, name: "fullName", value: "" },
    { id: 2, name: "dateOfBirth", value: "" },
    { id: 3, name: "nationality", value: "" },
  ],
  Employment: [
    { id: 1, name: "fullName", value: "" },
    { id: 2, name: "company", value: "" },
    { id: 3, name: "role", value: "" },
    { id: 4, name: "startDate", value: "" },
  ],
};

let _id = 100;
const nextId = () => ++_id;

export default function IssuePage() {
  useRequireAuth();
  const router = useRouter();
  const [credentialType, setCredentialType] = useState("AcademicCredential");
  const [rows, setRows] = useState<ClaimRow[]>(DEFAULT_ROWS);
  const [submitting, setSubmitting] = useState(false);

  const updateRow = (id: number, patch: Partial<ClaimRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: number) => setRows((rs) => rs.filter((r) => r.id !== id));

  const addRow = () => setRows((rs) => [...rs, { id: nextId(), name: "", value: "" }]);

  const applyPreset = (name: keyof typeof PRESETS) => {
    setRows(PRESETS[name].map((r) => ({ ...r, id: nextId() })));
    if (name === "Academic") setCredentialType("AcademicCredential");
    if (name === "Identity") setCredentialType("IdentityCredential");
    if (name === "Employment") setCredentialType("EmploymentCredential");
  };

  const onSubmit = async () => {
    const claims: Record<string, unknown> = {};
    for (const row of rows) {
      const name = row.name.trim();
      const value = row.value.trim();
      if (!name) continue;
      if (value === "true" || value === "false") claims[name] = value === "true";
      else if (value !== "" && !isNaN(Number(value))) claims[name] = Number(value);
      else claims[name] = value;
    }
    if (Object.keys(claims).length === 0) {
      toast.error("add at least one claim");
      return;
    }
    setSubmitting(true);
    try {
      const credential = await api.issue({ credential_type: credentialType, claims });
      toast.success("credential issued and signed");
      router.push(`/credentials/${credential.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "issuance failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="container py-10 max-w-3xl animate-fade-in">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-6 hover:text-foreground transition-colors focus-ring rounded"
        >
          <ArrowLeft className="h-4 w-4" /> Back to credentials
        </Link>

        <div className="mb-10">
          <div className="mono-tag mb-3">Issue credential</div>
          <h1 className="text-3xl md:text-4xl tracking-tighter font-semibold">
            Build a verifiable credential
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg">
            Add claims as key/value pairs. They&apos;ll be salted, hashed into a
            Merkle tree, and the root signed with Ed25519.
          </p>
        </div>

        <div className="surface rounded-xl p-7 space-y-8">
          {/* Presets */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Start from a preset
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(PRESETS).map((name) => (
                <Button
                  key={name}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(name as keyof typeof PRESETS)}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label
              htmlFor="type"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Credential type
            </Label>
            <Input
              id="type"
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value)}
              placeholder="e.g. AcademicCredential"
              className="font-mono"
            />
          </div>

          {/* Claims */}
          <div className="space-y-3">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Claims
            </Label>
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex gap-2 items-center group"
                >
                  <Input
                    placeholder="claim name"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    className="font-mono text-sm"
                  />
                  <Input
                    placeholder="value"
                    value={row.value}
                    onChange={(e) => updateRow(row.id, { value: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    title="Remove"
                    className="opacity-50 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addRow}>
              <span className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Add claim
              </span>
            </Button>
          </div>

          {/* Submit */}
          <div className="pt-4 border-t border-border/60 flex justify-end">
            <Button onClick={onSubmit} loading={submitting} size="lg">
              Issue &amp; sign credential
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
