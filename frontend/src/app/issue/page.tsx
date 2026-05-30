"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import { Topbar } from "@/components/features/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRequireAuth } from "@/lib/auth";

type ClaimRow = { id: number; name: string; value: string };

const DEFAULT_ROWS: ClaimRow[] = [
  { id: 1, name: "name", value: "" },
  { id: 2, name: "degree", value: "" },
  { id: 3, name: "graduationYear", value: "" },
  { id: 4, name: "cgpa", value: "" },
];

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

  const onSubmit = async () => {
    const claims: Record<string, unknown> = {};
    for (const row of rows) {
      const name = row.name.trim();
      const value = row.value.trim();
      if (!name) continue;
      // Try to parse numbers and booleans for convenience.
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
      <main className="container py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Issue a credential</CardTitle>
            <CardDescription>
              Add claims as key/value pairs. They&apos;ll be salted, hashed into a Merkle tree, and the root signed with Ed25519.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="type">Credential type</Label>
              <Input
                id="type"
                value={credentialType}
                onChange={(e) => setCredentialType(e.target.value)}
                placeholder="e.g. AcademicCredential, IdentityCredential"
              />
            </div>

            <div className="space-y-3">
              <Label>Claims</Label>
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.id} className="flex gap-2">
                    <Input
                      placeholder="claim name"
                      value={row.name}
                      onChange={(e) => updateRow(row.id, { name: e.target.value })}
                      className="font-mono"
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
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-4 w-4" /> Add claim
              </Button>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={onSubmit} loading={submitting}>
              Issue credential
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
