"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { api, setToken, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  email: z.string().email("enter a valid email"),
  password: z.string().min(1, "password is required"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { access_token } = await api.login(values);
      setToken(access_token);
      toast.success("welcome back");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 -z-10 hero-glow" />

      <div className="container py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring rounded"
        >
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-16 animate-fade-in">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center justify-center gap-2.5 mb-10">
            <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">CyStar</span>
          </Link>

          <div className="surface rounded-xl p-8">
            <div className="mb-7">
              <div className="mono-tag mb-3">Sign in</div>
              <h1 className="text-2xl font-semibold tracking-tighter">
                Welcome back
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Access your verifiable credentials vault.
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" loading={submitting} size="lg">
                Sign in
              </Button>
            </form>
          </div>

          <p className="text-sm text-muted-foreground text-center mt-6">
            No account?{" "}
            <Link href="/register" className="text-primary hover:underline focus-ring rounded">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
