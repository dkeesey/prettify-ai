# Security Model

## Input Handling

### Chat Input
- User text rendered via React's `{content}` - auto-escapes HTML
- No `dangerouslySetInnerHTML` in chat components
- Text is text, not parsed as HTML/JS
- XSS safe by default

### Editor Input
- Markdown converted to HTML via `markdownToHtml()`
- HTML sanitized with DOMPurify before rendering
- Allowed tags whitelist: h1-h3, p, strong, em, a, ul, ol, li, hr, br
- Only `href` attribute allowed

### File Upload
- **Not implemented by design**
- Users copy/paste as markdown (client-side conversion)
- Avoids: PDF exploits, DOCX macros, XXE, polyglots, parsing vulnerabilities
- Markdown is plain text - no executable content

## API Security

### /api/chat
- Rate limited: 20 requests/hour per IP
- CORS restricted to known origins
- API key server-side only (never exposed to client)
- Input: JSON with messages array
- Output: streamed text (no code execution)

### Environment Variables
- Secrets in `.dev.vars` (local) or Cloudflare dashboard (prod)
- Never committed to git
- Accessed via `locals.runtime.env` (Cloudflare adapter)

## LLM Considerations

### Prompt Injection
- Users can attempt to override system prompt
- This is an LLM limitation, not a security vulnerability
- Worst case: coach gives unhelpful advice
- No system access, no data exfiltration possible

### Data Privacy
- Conversations sent to Groq API
- Groq's privacy policy applies
- No conversation persistence (localStorage only, user's device)
- No analytics on conversation content

## What We Don't Do
- No file uploads or parsing
- No user authentication (yet)
- No server-side data storage
- No cookies or tracking
- No third-party scripts except Cloudflare analytics

## Future Considerations
If adding auth/persistence:
- Use Cloudflare D1 (SQLite) - no external DB exposure
- Clerk or similar for auth - don't roll our own
- Encrypt stored resumes at rest
- Add conversation deletion capability
