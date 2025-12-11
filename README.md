# prettify-ai

Free tool to convert LLM markdown output into professionally styled PDF and DOCX documents.

**Live at:** https://prettify-ai.com

## What It Does

1. Paste markdown from ChatGPT, Claude, or any LLM
2. Pick a professional theme
3. Export as PDF or DOCX

Works for resumes, cover letters, reports, SOPs - anything markdown.

## Why

LLMs give great structured output, but getting it into a shareable format means copy-pasting into Word and fighting with formatting. This skips that.

- **Notion** can't export DOCX
- **Google Docs** doesn't style markdown
- **This** does both

## Stack

- Astro + React
- Tailwind CSS + shadcn/ui
- TipTap editor
- Cloudflare Pages

## Development

```bash
npm install
npm run dev        # localhost:4321
npm run build      # production build
npm run test:run   # run tests
```

## Features

- Multiple professional themes
- PDF export (print to PDF)
- DOCX export (ATS-friendly for resumes)
- Mobile-friendly downloads
- Bookmarklet for quick capture
- No signup, no tracking, free

## Related

This repo also contains code for **resumecoach.co** (AI coaching product) - currently disabled via feature flags. The editor-only mode runs at prettify-ai.com.

## License

MIT
