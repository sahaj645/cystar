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
  full_name: z.string().min(1, "your name is required").max(255),
  email: z.string().email("enter a valid email"),
  password: z.string().min(8, "minimum 8 characters").max(128),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { access_token } = await api.register(values);
      setToken(access_token);
      toast.success("account created");
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "registration failed");
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
              <div className="mono-tag mb-3">Create account</div>
              <h1 className="text-2xl font-semibold tracking-tighter">
                Get started in a minute
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Start issuing cryptographically signed credentials.
              </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Full name
                </Label>
                <Input id="full_name" placeholder="Alice Doe" {...form.register("full_name")} />
                {form.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
                )}
              </div>
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
                  autoComplete="new-password"
                  placeholder="at least 8 characters"
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" loading={submitting} size="lg">
                Create account
              </Button>
            </form>
          </div>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline focus-ring rounded">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
