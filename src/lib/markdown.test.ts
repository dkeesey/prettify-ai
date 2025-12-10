import { describe, it, expect } from 'vitest'
import { markdownToHtml, looksLikeMarkdown, extractResumeFromResponse } from './markdown'

describe('markdownToHtml', () => {
  describe('headers', () => {
    it('converts h1 headers', () => {
      expect(markdownToHtml('# John Smith')).toContain('<h1>John Smith</h1>')
    })

    it('converts h2 headers', () => {
      expect(markdownToHtml('## Experience')).toContain('<h2>Experience</h2>')
    })

    it('converts h3 headers', () => {
      expect(markdownToHtml('### Software Engineer')).toContain('<h3>Software Engineer</h3>')
    })

    it('handles multiple header levels in order', () => {
      const md = '# Name\n\n## Section\n\n### Subsection'
      const html = markdownToHtml(md)
      expect(html).toContain('<h1>Name</h1>')
      expect(html).toContain('<h2>Section</h2>')
      expect(html).toContain('<h3>Subsection</h3>')
    })
  })

  describe('text formatting', () => {
    it('converts bold text', () => {
      expect(markdownToHtml('**Acme Corp**')).toContain('<strong>Acme Corp</strong>')
    })

    it('converts italic text', () => {
      expect(markdownToHtml('*emphasis*')).toContain('<em>emphasis</em>')
    })

    it('handles bold and italic together', () => {
      const html = markdownToHtml('**Company** | *Location*')
      expect(html).toContain('<strong>Company</strong>')
      expect(html).toContain('<em>Location</em>')
    })
  })

  describe('links', () => {
    it('converts markdown links', () => {
      const html = markdownToHtml('[LinkedIn](https://linkedin.com/in/john)')
      expect(html).toContain('<a href="https://linkedin.com/in/john">LinkedIn</a>')
    })

    it('handles links with special characters', () => {
      const html = markdownToHtml('[Email](mailto:john@example.com)')
      expect(html).toContain('<a href="mailto:john@example.com">Email</a>')
    })
  })

  describe('lists', () => {
    it('converts unordered list items', () => {
      const md = '- Item 1\n- Item 2\n- Item 3'
      const html = markdownToHtml(md)
      expect(html).toContain('<li>Item 1</li>')
      expect(html).toContain('<li>Item 2</li>')
      expect(html).toContain('<ul>')
    })

    it('handles bullet points with bold text', () => {
      const md = '- **Achievement**: Did something great'
      const html = markdownToHtml(md)
      expect(html).toContain('<li><strong>Achievement</strong>: Did something great</li>')
    })
  })

  describe('horizontal rules', () => {
    it('converts --- to hr', () => {
      expect(markdownToHtml('---')).toContain('<hr>')
    })
  })

  describe('paragraphs', () => {
    it('wraps plain text in paragraphs', () => {
      const html = markdownToHtml('Some plain text here')
      expect(html).toContain('<p>Some plain text here</p>')
    })

    it('preserves line breaks within paragraphs', () => {
      const md = 'Line 1\nLine 2'
      const html = markdownToHtml(md)
      expect(html).toContain('<br>')
    })
  })

  describe('full resume conversion', () => {
    it('converts a complete resume structure', () => {
      const resume = `# Jane Smith

**Senior Software Engineer** | San Francisco, CA | jane@email.com

## Summary

Experienced engineer with 8+ years building scalable applications.

## Experience

### Senior Engineer
**Acme Corp** | 2020 - Present

- Led development of customer dashboard
- Reduced load time by 40%

## Skills

JavaScript, TypeScript, React, Node.js`

      const html = markdownToHtml(resume)

      expect(html).toContain('<h1>Jane Smith</h1>')
      expect(html).toContain('<strong>Senior Software Engineer</strong>')
      expect(html).toContain('<h2>Summary</h2>')
      expect(html).toContain('<h2>Experience</h2>')
      expect(html).toContain('<h3>Senior Engineer</h3>')
      expect(html).toContain('<strong>Acme Corp</strong>')
      expect(html).toContain('<li>Led development of customer dashboard</li>')
      expect(html).toContain('<h2>Skills</h2>')
    })
  })
})

describe('looksLikeMarkdown', () => {
  it('returns true for text with headers and newlines', () => {
    expect(looksLikeMarkdown('# Title\n\nSome content')).toBe(true)
  })

  it('returns false for plain text', () => {
    expect(looksLikeMarkdown('Just some plain text')).toBe(false)
  })

  it('returns false for text with # but no newlines', () => {
    expect(looksLikeMarkdown('Issue #123')).toBe(false)
  })
})

describe('extractResumeFromResponse', () => {
  it('extracts markdown from code block', () => {
    const response = `Here's your resume:

\`\`\`markdown
# John Smith

## Experience
- Did stuff
\`\`\`

Let me know if you'd like changes!`

    const resume = extractResumeFromResponse(response)
    expect(resume).toBe('# John Smith\n\n## Experience\n- Did stuff')
  })

  it('returns null if no markdown block found', () => {
    const response = 'Here is some text without a code block'
    expect(extractResumeFromResponse(response)).toBeNull()
  })

  it('handles markdown block at end of response', () => {
    const response = `\`\`\`markdown
# Resume
\`\`\``
    expect(extractResumeFromResponse(response)).toBe('# Resume')
  })
})
