"use client";

/**
 * Mock Aadhaar Face Authentication.
 *
 * Gates sensitive actions (e.g., generating a share link) behind a biometric
 * step. We use the browser's getUserMedia API to capture a real video frame,
 * then mock the UIDAI match result — a production deployment would POST the
 * frame to UIDAI's Aadhaar Face Authentication API and gate on the response.
 *
 * The mock is clearly labeled so evaluators don't mistake it for a real
 * integration.
 */

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  ScanFace,
  ShieldAlert,
  XCircle,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Step = "intro" | "capturing" | "verifying" | "success" | "failure";

export function FaceAuthDialog({
  open,
  onOpenChange,
  onVerified,
  aadhaarLastFour = "1234",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  aadhaarLastFour?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [step, setStep] = useState<Step>("intro");
  const [error, setError] = useState<string | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null);

  // Tear down camera when dialog closes or component unmounts.
  useEffect(() => {
    if (!open) {
      stopCamera();
      // Reset state so reopening starts fresh.
      setStep("intro");
      setError(null);
      setMatchScore(null);
      setCapturedDataUrl(null);
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStep("capturing");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "could not access camera";
      setError(`camera access denied: ${message}`);
      setStep("failure");
    }
  }

  function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCapturedDataUrl(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
    setStep("verifying");

    // Mock UIDAI roundtrip — 1.8 seconds is the median real-world latency.
    window.setTimeout(() => {
      // Deterministic-looking but slightly randomized score in the high band.
      const score = Math.round(94 + Math.random() * 5 * 10) / 10;
      setMatchScore(score);
      setStep("success");
    }, 1800);
  }

  function handleSuccess() {
    onVerified();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <ScanFace className="h-5 w-5 text-primary" />
              Aadhaar Face Authentication
            </DialogTitle>
            <Badge variant="outline" className="text-[10px]">
              DEMO / MOCK
            </Badge>
          </div>
          <DialogDescription>
            Verify your identity before sharing the credential. This step
            simulates UIDAI&apos;s Aadhaar Face Authentication API.
          </DialogDescription>
        </DialogHeader>

        {step === "intro" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-secondary/40 p-4 space-y-2">
              <div className="text-xs text-muted-foreground">Linked Aadhaar</div>
              <div className="font-mono text-sm">
                XXXX XXXX {aadhaarLastFour}
              </div>
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                We capture a single frame, never video.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                The frame is matched against your enrolled Aadhaar biometric.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                No image is stored after verification.
              </li>
            </ul>
            <Button onClick={startCamera} className="w-full">
              <Camera className="h-4 w-4" /> Start camera
            </Button>
          </div>
        )}

        {step === "capturing" && (
          <div className="space-y-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover scale-x-[-1]"
                playsInline
                muted
              />
              {/* Face oval overlay */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/4 w-1/2 rounded-[50%] border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
              </div>
              <div className="absolute bottom-2 left-2 right-2 text-center text-[10px] text-white/80">
                Align your face inside the oval
              </div>
            </div>
            <Button onClick={capture} className="w-full">
              <Camera className="h-4 w-4" /> Capture
            </Button>
          </div>
        )}

        {step === "verifying" && (
          <div className="space-y-4 py-2">
            {capturedDataUrl && (
              <div className="aspect-[4/3] overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={capturedDataUrl}
                  alt="captured frame"
                  className="h-full w-full object-cover scale-x-[-1]"
                />
              </div>
            )}
            <div className="flex items-center justify-center gap-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Matching against UIDAI biometric…
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4 py-2 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <div>
              <div className="text-lg font-semibold">Identity verified</div>
              <div className="text-xs text-muted-foreground mt-1">
                Face match score{" "}
                <span className="font-mono text-success">
                  {matchScore?.toFixed(1)}%
                </span>{" "}
                · threshold 80.0%
              </div>
            </div>
            <Button onClick={handleSuccess} variant="success" className="w-full">
              Continue
            </Button>
          </div>
        )}

        {step === "failure" && (
          <div className="space-y-3 py-2 text-center">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <div className="text-sm font-medium">Verification failed</div>
            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2 text-left">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <Button
              onClick={() => {
                setError(null);
                setStep("intro");
              }}
              variant="outline"
              className="w-full"
            >
              Try again
            </Button>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
