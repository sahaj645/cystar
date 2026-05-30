"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="mono-tag">
              <QrCode className="h-3 w-3" />
              Share
            </span>
            <Badge variant="outline" className="text-[10px] border-success/40 text-success">
              Ed25519 signed
            </Badge>
          </div>
          <DialogTitle className="text-xl tracking-tighter">
            Your verifiable share
          </DialogTitle>
          <DialogDescription>
            Anyone with the link can verify the disclosed fields. Hidden claims
            never leave the issuer.
          </DialogDescription>
        </DialogHeader>

        {/* QR */}
        <div className="relative flex items-center justify-center rounded-xl border border-border/80 bg-white p-6 mt-1">
          <QRCodeSVG value={shareUrl} size={200} level="M" />
          {/* corner ticks for camera framing aesthetic */}
          <span className="absolute top-2 left-2 h-3 w-3 border-l border-t border-foreground/20" />
          <span className="absolute top-2 right-2 h-3 w-3 border-r border-t border-foreground/20" />
          <span className="absolute bottom-2 left-2 h-3 w-3 border-l border-b border-foreground/20" />
          <span className="absolute bottom-2 right-2 h-3 w-3 border-r border-b border-foreground/20" />
        </div>

        {/* link */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
            Share link
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs font-mono">
              {shareUrl}
            </code>
            <Button size="icon" variant="outline" onClick={copy} title="Copy link">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="outline" asChild title="Open in new tab">
              <a href={shareUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* meta */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/60 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
              Expires
            </div>
            <div className="font-medium">{formatDateTime(expiresAt)}</div>
            <div className="text-muted-foreground mt-0.5">
              in <span className="font-mono text-foreground/80">{timeUntil(expiresAt)}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-1">
              Revealing
            </div>
            <div className="flex flex-wrap gap-1">
              {revealedFields.map((f) => (
                <Badge key={f} variant="outline" className="text-[10px] font-mono">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
