# Resume Coach

Strategic resume coaching for mid-career professionals.

## The Problem

The job market expects resumes in a format that didn't exist when many experienced professionals were doing their best work. "Increased efficiency by 40%" wasn't a metric when "getting it to work" was the achievement.

Resume Coach helps translate real experience into the language employers are listening for.

## Domains

- **resumecoach.co** - Strategic coaching product
- **prettify-ai.com** - Conversion utility (paste markdown → export PDF/DOCX)

## Stack

- Astro + React
- Tailwind CSS + shadcn/ui
- TipTap editor
- Groq API (Llama 3.3, free tier)
- Cloudflare Pages

## Development

```bash
npm install
npm run dev        # localhost:4321
npm run build      # production build
npm run preview    # preview production build
```

## Environment

```bash
cp .env.example .env
# Add GROQ API key
```

## Architecture

See `docs/` for:
- `PRODUCT-CONTEXT.md` - Positioning, user journey, conversion points
- `ROADMAP.md` - Feature phases (TODO)
- `ARCHITECTURE.md` - Data flow, storage, auth (TODO)

## Environments

- **dev**: Local development
- **staging**: Pre-production testing
- **prod**: Live (not promoted yet)

## Current State

MVP with:
- Chat-based coaching interface
- Rich text editor with themes
- PDF/DOCX export
- LinkedIn import
- Groq-powered AI (free)

Next: LocalStorage persistence, chat-to-editor bridge.
