import DOMPurify from 'dompurify'

/**
 * Escape HTML entities to prevent XSS before markdown processing
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Validate URL is safe (http, https, mailto only)
 */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url, 'https://example.com')
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol)
  } catch {
    // Relative URLs are OK
    return !url.includes(':') || url.startsWith('/')
  }
}

/**
 * Convert markdown to HTML for resume rendering
 * Supports: headers, bold, italic, links, lists, horizontal rules
 * Security: Escapes HTML, validates URLs, sanitizes output with DOMPurify
 */
export function markdownToHtml(md: string): string {
  // First, escape any HTML in the input to prevent XSS
  const escaped = escapeHtml(md)

  const html = escaped
    // Headers (order matters - do ### before ## before #)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Links [text](url) - validate URL is safe
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
      if (isSafeUrl(url)) {
        return `<a href="${url}">${text}</a>`
      }
      return text // Strip unsafe links, keep text
    })
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic (but not inside URLs)
    .replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<em>$1</em>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive list items
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Paragraphs (lines that aren't already wrapped)
    .split('\n\n')
    .map(block => {
      if (block.startsWith('<')) return block
      if (block.trim() === '') return ''
      return `<p>${block.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  // Final sanitization pass with DOMPurify
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'a', 'ul', 'li', 'hr', 'br'],
    ALLOWED_ATTR: ['href'],
    ALLOW_DATA_ATTR: false,
  })
}

/**
 * Check if text looks like markdown (has header markers)
 */
export function looksLikeMarkdown(text: string): boolean {
  return text.includes('#') && text.includes('\n')
}

/**
 * Extract markdown resume from AI response (looks for ```markdown blocks)
 */
export function extractResumeFromResponse(content: string): string | null {
  const match = content.match(/```markdown\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}
