# CyStar Frontend

Next.js 14 App Router + TypeScript + Tailwind + shadcn-style components.

## Run locally

```bash
npm install --legacy-peer-deps
cp .env.example .env.local       # point NEXT_PUBLIC_API_URL at your backend
npm run dev
```

## Pages

- `/` — marketing landing
- `/login`, `/register` — auth
- `/dashboard` — list credentials
- `/issue` — issue a new credential with dynamic claim rows
- `/credentials/[id]` — selective disclosure UI (checkboxes, expiry, share)
- `/verify/[token]` — public verification page (no auth)

## Stack

- `next` 14 (standalone output for Docker)
- `react-hook-form` + `zod` for forms
- `qrcode.react` for share QR codes
- `sonner` for toasts
- Radix UI primitives + Tailwind for the design system
