# Content Control Center — Next.js V1

## Local setup
1. Copy `.env.local.example` to `.env.local`.
2. Run `npm install`.
3. Run `npm run dev`.

## Vercel deployment
Import this folder/repository into Vercel and add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The app uses existing Supabase Edge Functions:
- `content-data`
- `content-control`

## Current scope
UI and controls are functional against the Supabase backend. `Run` currently changes workflow state; agent execution will be connected in the n8n/Agent 00 step.
