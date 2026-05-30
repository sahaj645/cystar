"use client";

import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, timeUntil } from "@/lib/utils";

export function ShareDialog({
  open,
  onOpenChange,
  shareUrl,
  expiresAt,
  revealedFields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  expiresAt: string;
  revealedFields: string[];
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("share link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your selective-disclosure share</DialogTitle>
          <DialogDescription>
            Anyone with this link can verify the disclosed fields. The verifier never sees the hidden claims.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-center bg-white rounded-xl p-6">
          <QRCodeSVG value={shareUrl} size={200} level="M" />
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Share link</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border bg-muted/50 px-3 py-2 text-xs font-mono">
                {shareUrl}
              </code>
              <Button size="icon" variant="outline" onClick={copy}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" asChild>
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-muted-foreground">Expires</div>
              <div className="font-medium">
                {formatDateTime(expiresAt)} · in {timeUntil(expiresAt)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Revealing</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {revealedFields.map((f) => (
                  <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
                ))}
              </div>
            </div>
          </div>

          {copied && (
            <p className="text-xs text-success text-center">copied to clipboard</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
