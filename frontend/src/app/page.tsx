import Link from "next/link";
import { ShieldCheck, KeyRound, Eye, ChevronRight, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-border/50 backdrop-blur sticky top-0 z-40 bg-background/80">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <span>CyStar</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-grid">
        <div className="container py-20 md:py-28 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-secondary/50 px-3 py-1 text-xs text-muted-foreground mb-6">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" /> Ed25519 + Merkle proofs
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            Share what matters. <span className="text-primary">Prove the rest.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Reveal only the fields you choose from your verifiable credentials.
            A verifier cryptographically confirms authenticity without ever seeing the hidden data.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                <span className="inline-flex items-center gap-2">
                  Create credential <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container py-16 md:py-24">
        <div className="grid md:grid-cols-3 gap-8">
          <Feature
            icon={<KeyRound className="h-6 w-6" />}
            title="Issuer signs the root"
            text="Each claim is salted, hashed, and assembled into a Merkle tree. The root is signed with Ed25519."
          />
          <Feature
            icon={<Eye className="h-6 w-6" />}
            title="Holder picks fields"
            text="Choose exactly which claims to reveal. The rest stay hidden — even from the verifier."
          />
          <Feature
            icon={<ShieldCheck className="h-6 w-6" />}
            title="Verifier proves authenticity"
            text="Merkle proofs reconstruct the root. The signature confirms it came from the issuer, untouched."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>Built for CyStar (IIT Madras) Internship · 2026</p>
          <Link href="https://github.com/sahaj645/cystar" className="inline-flex items-center gap-2 hover:text-foreground">
            <GitBranch className="h-4 w-4" /> github.com/sahaj645/cystar
          </Link>
        </div>
      </footer>
    </main>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-6">
      <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
