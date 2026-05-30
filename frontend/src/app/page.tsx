import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  Eye,
  Github,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* ambient background grid */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid" />

      {/* ─── Nav ─── */}
      <nav className="relative z-10 border-b border-border/60 backdrop-blur-md bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="font-semibold tracking-tight">CyStar</span>
            <span className="mono-tag ml-1 hidden sm:inline-flex">v1.0</span>
          </Link>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <a
                href="https://github.com/sahaj645/cystar"
                target="_blank"
                rel="noreferrer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Github className="h-4 w-4" />
                  GitHub
                </span>
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">
                <span className="inline-flex items-center gap-1.5">
                  Get started
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative">
        <div className="container pt-20 pb-24 md:pt-32 md:pb-40">
          <div className="max-w-3xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground mb-8">
              <Sparkles className="h-3 w-3 text-primary" />
              <span>Ed25519 + salted Merkle trees</span>
              <span className="mx-1 h-1 w-1 rounded-full bg-border" />
              <span>Built for CyStar IITM</span>
            </div>

            <h1 className="text-5xl md:text-7xl tracking-tighter font-semibold leading-[0.95]">
              <span className="text-gradient">Share what matters.</span>
              <br />
              <span className="font-serif italic text-gradient-primary">
                Prove&nbsp;the&nbsp;rest.
              </span>
            </h1>

            <p className="mt-8 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              A verifiable credentials platform where the holder reveals only the
              fields they choose &mdash; and the verifier cryptographically confirms
              authenticity without ever seeing the rest.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/register">
                  <span className="inline-flex items-center gap-2">
                    Issue your first credential
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a
                  href="https://github.com/sahaj645/cystar"
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="inline-flex items-center gap-2">
                    Read the source
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </a>
              </Button>
            </div>
          </div>

          {/* code snippet panel */}
          <div className="mt-20 md:mt-24 max-w-3xl mx-auto animate-fade-in">
            <CryptoPreview />
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="border-t border-border/60">
        <div className="container py-20 md:py-28">
          <div className="max-w-2xl mb-14">
            <div className="mono-tag mb-4">01 — Mechanism</div>
            <h2 className="text-3xl md:text-4xl tracking-tighter font-semibold">
              Cryptographic, not cosmetic.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Most "selective disclosure" tools filter JSON. We don't. Every claim
              is salted, hashed, and committed to a Merkle tree. The issuer signs
              the root with Ed25519. The verifier reconstructs it from disclosed
              proofs &mdash; tampering breaks the math.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/60">
            <Step
              num="01"
              icon={<KeyRound className="h-5 w-5" />}
              title="Issuer signs the root"
              text="Each claim becomes a salted SHA-256 leaf. The Merkle root is signed with Ed25519."
            />
            <Step
              num="02"
              icon={<Eye className="h-5 w-5" />}
              title="Holder picks fields"
              text="The holder reveals chosen claims, their salts, and Merkle inclusion proofs."
            />
            <Step
              num="03"
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Verifier proves it"
              text="Proofs reconstruct the root. Signature confirms it came from the issuer, untouched."
            />
          </div>
        </div>
      </section>

      {/* ─── Stats / details strip ─── */}
      <section className="border-t border-border/60">
        <div className="container py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/60 rounded-xl overflow-hidden border border-border/60">
            <Stat label="Crypto core" value="Ed25519" sub="EdDSA / PyNaCl" />
            <Stat label="Commitment" value="SHA-256" sub="salted Merkle" />
            <Stat label="Test coverage" value="67 tests" sub="49 tamper cases" />
            <Stat label="Stack" value="FastAPI · Next.js 14" sub="TypeScript · Tailwind" />
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border/60">
        <div className="container py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo small />
            <span>CyStar &copy; 2026</span>
            <span className="hidden sm:inline">&middot;</span>
            <span className="hidden sm:inline">
              Built for CyStar (IIT Madras) Summer Internship
            </span>
          </div>
          <a
            href="https://github.com/sahaj645/cystar"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" />
            github.com/sahaj645/cystar
            <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
      </footer>
    </main>
  );
}

/* ─── pieces ─── */

function Logo({ small = false }: { small?: boolean }) {
  const size = small ? "h-5 w-5" : "h-6 w-6";
  return (
    <div className={`${size} rounded-md bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-[0_0_24px_-6px_hsl(var(--primary)/0.6)]`}>
      <ShieldCheck className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />
    </div>
  );
}

function Step({
  num,
  icon,
  title,
  text,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-card/80 p-7 md:p-8 hover:bg-card transition-colors group">
      <div className="flex items-center justify-between mb-6">
        <div className="h-9 w-9 rounded-md border border-border/80 bg-secondary/60 flex items-center justify-center text-primary group-hover:border-primary/40 transition-colors">
          {icon}
        </div>
        <span className="font-mono text-xs text-muted-foreground/70">{num}</span>
      </div>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-card/60 p-6">
      <div className="mono-tag mb-3">{label}</div>
      <div className="text-lg md:text-xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function CryptoPreview() {
  return (
    <div className="surface rounded-xl overflow-hidden shadow-2xl shadow-black/40">
      {/* fake terminal chrome */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        </div>
        <div className="mono-tag">presentation.json</div>
        <span className="text-[10px] text-muted-foreground/70 font-mono">
          ed25519 / sha-256
        </span>
      </div>

      <pre className="px-5 py-5 text-[13px] leading-relaxed font-mono text-foreground/90 overflow-x-auto">
{`{
  `}<span className="text-primary">&quot;revealed_claims&quot;</span>{`: {
    `}<span className="text-muted-foreground">&quot;name&quot;</span>{`: `}<span className="text-success">&quot;Sahaj Gaur&quot;</span>{`,
    `}<span className="text-muted-foreground">&quot;degree&quot;</span>{`: `}<span className="text-success">&quot;B.Tech CSE&quot;</span>{`,
    `}<span className="text-muted-foreground">&quot;graduationYear&quot;</span>{`: `}<span className="text-success">2026</span>{`
  },
  `}<span className="text-primary">&quot;merkle_root&quot;</span>{`: `}<span className="text-success">&quot;cf461a39d45f…d6c40efb&quot;</span>{`,
  `}<span className="text-primary">&quot;signature&quot;</span>{`:   `}<span className="text-success">&quot;9d6fb8e2…64aa1c&quot;</span>{`,
  `}<span className="text-primary">&quot;issuer_pk&quot;</span>{`:   `}<span className="text-success">&quot;d5ba0bc9…fb5b&quot;</span>{`
  `}<span className="text-muted-foreground/60">// cgpa, marks — hidden, but still bound to signature</span>{`
}`}
      </pre>
    </div>
  );
}
