import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
// Pagination extension removed - was causing cursor position bugs
import DOMPurify from 'dompurify'
import { useRef, useState, useEffect, useCallback } from 'react'
import { markdownToHtml } from '@/lib/markdown'
import { getStoredValue, setStoredValue, STORAGE_KEYS } from '@/lib/storage'
import { features } from '@/lib/features'
import { useReactToPrint } from 'react-to-print'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, convertInchesToTwip, BorderStyle } from 'docx'
// Note: file-saver removed - using custom downloadBlob for mobile compatibility
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  FileDown,
  FileText,
  Heading1,
  Heading2,
  Heading3,
  Loader2,
  Trash2,
  Save,
  Bookmark,
  ClipboardPaste,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

// Mobile device detection for download handling
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

function isIOSSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua)
  const isWebkit = /WebKit/.test(ua)
  const isNotChrome = !/CriOS/.test(ua)
  return isIOS && isWebkit && isNotChrome
}

// Mobile-friendly download - opens in new tab on mobile, direct download on desktop
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)

  if (isMobileDevice()) {
    const newWindow = window.open(url, '_blank')
    if (!newWindow) {
      // Popup blocked - fallback
      if (isIOSSafari()) {
        window.location.href = url
      } else {
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  } else {
    // Desktop - standard download
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}


const themes = {
  // Standard themes - full styling, great for PDF, styled DOCX
  professional: {
    name: 'Professional',
    group: 'standard',
    fontFamily: 'Arial, Helvetica, sans-serif',
    headingFont: 'Arial, Helvetica, sans-serif',
    exportFont: 'Arial, Helvetica, sans-serif',
    docxFont: 'Arial',
    fontSize: '11pt',
    lineHeight: '1.5',
    color: '#1a1a1a',
    headingColor: '#2563eb',
    decorative: true,
  },
  modern: {
    name: 'Modern',
    group: 'standard',
    fontFamily: 'Arial, Helvetica, sans-serif',
    headingFont: 'Arial, Helvetica, sans-serif',
    exportFont: 'Arial, Helvetica, sans-serif',
    docxFont: 'Arial',
    fontSize: '10pt',
    lineHeight: '1.4',
    color: '#374151',
    headingColor: '#111827',
    decorative: true,
  },
  classic: {
    name: 'Classic',
    group: 'standard',
    fontFamily: '"Times New Roman", Times, serif',
    headingFont: '"Times New Roman", Times, serif',
    exportFont: '"Times New Roman", Times, serif',
    docxFont: 'Times New Roman',
    fontSize: '12pt',
    lineHeight: '1.5',
    color: '#1a1a1a',
    headingColor: '#2563eb',
    decorative: true,
  },
  elegant: {
    name: 'Elegant',
    group: 'standard',
    fontFamily: 'Georgia, "Times New Roman", serif',
    headingFont: 'Georgia, "Times New Roman", serif',
    exportFont: '"Times New Roman", Times, serif',
    docxFont: 'Times New Roman',
    fontSize: '11pt',
    lineHeight: '1.6',
    color: '#2d2d2d',
    headingColor: '#1e40af',
    decorative: true,
  },
  // ATS-Friendly themes - plain black, no decorations, optimized for applicant tracking systems
  'ats-sans': {
    name: 'ATS Sans',
    group: 'ats',
    fontFamily: 'Arial, Helvetica, sans-serif',
    headingFont: 'Arial, Helvetica, sans-serif',
    exportFont: 'Arial, Helvetica, sans-serif',
    docxFont: 'Arial',
    fontSize: '11pt',
    lineHeight: '1.5',
    color: '#000000',
    headingColor: '#000000',
    decorative: false,
  },
  'ats-serif': {
    name: 'ATS Serif',
    group: 'ats',
    fontFamily: '"Times New Roman", Times, serif',
    headingFont: '"Times New Roman", Times, serif',
    exportFont: '"Times New Roman", Times, serif',
    docxFont: 'Times New Roman',
    fontSize: '12pt',
    lineHeight: '1.5',
    color: '#000000',
    headingColor: '#000000',
    decorative: false,
  },
}

type ThemeKey = keyof typeof themes

// Sample resume content for demo - follows proven structure from docs/resume-best-practices.md
const sampleResume = `# Jane Smith

**Senior Software Engineer** | San Francisco, CA | jane@email.com | (555) 123-4567 | linkedin.com/in/janesmith

## Professional Summary

Results-driven software engineer with 8+ years of experience building scalable web applications that serve millions of users. Proven track record of reducing costs by 40% and improving system performance through technical leadership. Seeking to leverage full-stack expertise and team mentorship skills to drive engineering excellence at a growth-stage company.

## Skills

**Languages:** JavaScript, TypeScript, Python, SQL

**Frameworks:** React, Node.js, Next.js, Express

**Infrastructure:** AWS, Docker, Kubernetes, PostgreSQL, Redis

**Practices:** CI/CD, Test-Driven Development, Agile, Code Review

## Certifications

- AWS Solutions Architect Associate — Amazon Web Services, 2023
- Professional Scrum Master I — Scrum.org, 2022

## Professional Experience

### Senior Software Engineer
**Acme Tech** — San Francisco, CA
January 2021 – Present

- Led development of customer-facing dashboard serving 50K+ daily active users
- Reduced infrastructure costs by 40% through implementing caching and query optimization
- Decreased page load time from 4s to 1.2s through code splitting and lazy loading
- Mentored team of 4 junior developers through weekly code reviews and pair programming
- Architected migration from monolith to microservices, improving deployment frequency by 300%

### Software Engineer
**StartupCo** — San Francisco, CA
March 2018 – December 2020

- Built REST API handling 1M+ requests daily with 99.9% uptime using Node.js and PostgreSQL
- Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes
- Created shared component library adopted across 5 product teams, reducing UI development time by 25%
- Collaborated with design and product teams to ship 3 major features ahead of schedule

## Projects

### Open Source Contribution — React Performance Toolkit
- Developed profiling tools used by 2,000+ developers monthly
- Reduced bundle analysis time by 60% through parallel processing

## Education

**B.S. Computer Science** — University of California, Berkeley
Graduated May 2018
`

interface EditorProps {
  initialContent?: string
  onContentChange?: (html: string) => void
}

export default function Editor({ initialContent, onContentChange }: EditorProps = {}) {
  // Initialize state from localStorage where applicable
  const [theme, setTheme] = useState<ThemeKey>(() =>
    getStoredValue(STORAGE_KEYS.THEME, 'professional') as ThemeKey
  )
  const [wordCount, setWordCount] = useState(0)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [bookmarkletOpen, setBookmarkletOpen] = useState(false)
  const [docxConfirmOpen, setDocxConfirmOpen] = useState(false)
  const [pageCount, setPageCount] = useState(1)
  const [zoom, setZoom] = useState<50 | 75 | 100>(100)
  const [pendingMarkdown, setPendingMarkdown] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const currentTheme = themes[theme] || themes.professional

  // Debounced save function for editor content
  const saveEditorContent = useCallback((html: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    setSaveStatus('saving')
    saveTimeoutRef.current = setTimeout(() => {
      setStoredValue(STORAGE_KEYS.EDITOR_CONTENT, html)
      setSaveStatus('saved')
      // Reset to idle after showing saved status
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 500) // 500ms debounce
  }, [])

  // Save theme preference when changed
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.THEME, theme)
  }, [theme])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        // Disable Link and Underline from StarterKit - we configure them separately
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Paste your markdown here, or click Sample to see an example...',
      }),
      // Pagination extension disabled - was causing cursor position bugs
      // See: https://github.com/ueberdosis/tiptap/discussions/4960
      // TODO: Re-evaluate pagination approach if page breaks are needed
    ],
    content: '',
    autofocus: 'end',
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      const words = text.trim().split(/\s+/).filter(Boolean).length
      setWordCount(words)
      // Auto-save content (debounced)
      const html = editor.getHTML()
      if (html !== '<p></p>') {
        saveEditorContent(html)
        // Notify parent of content change
        onContentChange?.(html)
      }
    },
    editorProps: {
      attributes: {
        // Note: No padding here - margins handled by container CSS
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[600px]',
      },
    },
  })

  // Track active formatting state reactively for toolbar buttons
  // This is required in React because TipTap doesn't auto-re-render on selection changes
  const editorState = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null
      return {
        isBold: e.isActive('bold'),
        isItalic: e.isActive('italic'),
        isUnderline: e.isActive('underline'),
        isH1: e.isActive('heading', { level: 1 }),
        isH2: e.isActive('heading', { level: 2 }),
        isH3: e.isActive('heading', { level: 3 }),
        isBulletList: e.isActive('bulletList'),
        isOrderedList: e.isActive('orderedList'),
      }
    },
  })

  // Handle paste events to detect and convert markdown
  useEffect(() => {
    if (!editor) return

    const handlePaste = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain')
      if (text && text.includes('#') && text.includes('\n')) {
        // Looks like markdown - convert it
        event.preventDefault()
        const html = markdownToHtml(text)
        editor.commands.setContent(html)
      }
    }

    // Get the editor DOM element
    const editorElement = document.querySelector('.ProseMirror')
    editorElement?.addEventListener('paste', handlePaste as EventListener)

    return () => {
      editorElement?.removeEventListener('paste', handlePaste as EventListener)
    }
  }, [editor])

  // Load content from URL parameter, prop, or localStorage on mount
  useEffect(() => {
    if (!editor) return

    const sanitizeOptions = {
      ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'hr', 'br'],
      ALLOWED_ATTR: ['href'],
      ALLOW_DATA_ATTR: false,
    }

    const params = new URLSearchParams(window.location.search)
    const urlContent = params.get('content')

    if (urlContent) {
      // URL parameter takes priority
      try {
        const decoded = atob(urlContent)
        const html = markdownToHtml(decoded)
        const sanitized = DOMPurify.sanitize(html, sanitizeOptions)
        editor.commands.setContent(sanitized)
      } catch (e) {
        // If not base64, try as plain text
        const html = markdownToHtml(urlContent)
        const sanitized = DOMPurify.sanitize(html, sanitizeOptions)
        editor.commands.setContent(sanitized)
      }
    } else if (initialContent) {
      // Prop takes second priority
      const sanitized = DOMPurify.sanitize(initialContent, sanitizeOptions)
      editor.commands.setContent(sanitized)
    } else {
      // No URL param or prop - try loading from localStorage
      const savedContent = getStoredValue<string | null>(STORAGE_KEYS.EDITOR_CONTENT, null)
      if (savedContent) {
        const sanitized = DOMPurify.sanitize(savedContent, sanitizeOptions)
        editor.commands.setContent(sanitized)
        setSaveStatus('saved')
      }
    }
  }, [editor, initialContent])

  // Estimate page count based on text length
  useEffect(() => {
    if (!editor) return

    const calculatePages = () => {
      const text = editor.getText()
      const CHARS_PER_LINE = 65
      const LINES_PER_PAGE = 42
      const textLines = Math.ceil(text.length / CHARS_PER_LINE)
      const pages = Math.max(1, Math.ceil(textLines / LINES_PER_PAGE))
      setPageCount(pages)
    }

    calculatePages()
    editor.on('update', calculatePages)

    return () => {
      editor.off('update', calculatePages)
    }
  }, [editor])

  const loadSample = () => {
    // Auto-convert - one click to formatted result
    const html = markdownToHtml(sampleResume)
    editor?.commands.setContent(html)
  }

  const clearContent = () => {
    editor?.commands.clearContent()
    setPendingMarkdown(null)
    // Clear localStorage as well
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.EDITOR_CONTENT)
    }
    setSaveStatus('idle')
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: 'Resume',
  })

  const exportDocx = async () => {
    if (!editor) return

    const json = editor.getJSON()
    const children: Paragraph[] = []

    // Typography constants derived from theme
    // DOCX uses half-points for font size, twips for spacing (20 twips = 1pt)
    const currentTheme = themes[theme] || themes.professional
    const FONT_NAME = currentTheme.docxFont
    // Parse theme fontSize (e.g., "11pt" -> 22 half-points)
    const baseFontPt = parseInt(currentTheme.fontSize) || 11
    const FONT_SIZE_BODY = baseFontPt * 2 // half-points
    const FONT_SIZE_H1 = baseFontPt * 2 * 2.18 // ~24pt for 11pt base (matching CSS 24pt)
    const FONT_SIZE_H2 = baseFontPt * 2 * 1.27 // ~14pt for 11pt base (matching CSS 14pt)
    const FONT_SIZE_H3 = baseFontPt * 2 * 1.09 // ~12pt for 11pt base (matching CSS 12pt)
    // Parse lineHeight (e.g., "1.5" -> 360 twips)
    const lineHeightRatio = parseFloat(currentTheme.lineHeight) || 1.5
    const LINE_SPACING = Math.round(240 * lineHeightRatio) // 240 = single spacing
    const CHAR_SPACING = 4 // slight extra letter spacing (in twips)
    // Spacing to match on-screen breathing room
    const SPACE_AFTER_H1 = 200 // 10pt
    const SPACE_BEFORE_H2 = 480 // 24pt - gap before section headings
    const SPACE_AFTER_H2 = 120 // 6pt - tighter after section heading
    const SPACE_BEFORE_H3 = 320 // 16pt - space before job titles
    const SPACE_AFTER_H3 = 60 // 3pt - tight after job title
    const SPACE_AFTER_PARA = 160 // 8pt - space after paragraphs
    const SPACE_AFTER_BULLET = 80 // 4pt - tighter for bullet lists

    // Colors for DOCX (strip # prefix)
    const HEADING_COLOR = currentTheme.headingColor.replace('#', '')
    const BODY_COLOR = currentTheme.color.replace('#', '')

    const processNode = (node: any) => {
      if (node.type === 'heading') {
        const level = node.attrs?.level || 1
        const runs: TextRun[] = []
        node.content?.forEach((c: any) => {
          runs.push(new TextRun({
            text: c.text || '',
            font: FONT_NAME,
            size: level === 1 ? FONT_SIZE_H1 : level === 2 ? FONT_SIZE_H2 : FONT_SIZE_H3,
            bold: false, // Match TipTap - headings use size/color, not bold
            characterSpacing: CHAR_SPACING,
            color: HEADING_COLOR,
          }))
        })
        // Add decorative border under H2 if theme has decorative enabled
        const h2Border = (level === 2 && currentTheme.decorative) ? {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 6, // 0.5pt
            color: HEADING_COLOR,
          },
        } : undefined
        children.push(
          new Paragraph({
            children: runs,
            heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            spacing: {
              before: level === 1 ? 0 : level === 2 ? SPACE_BEFORE_H2 : SPACE_BEFORE_H3,
              after: level === 1 ? SPACE_AFTER_H1 : level === 2 ? SPACE_AFTER_H2 : SPACE_AFTER_H3,
              line: LINE_SPACING,
            },
            border: h2Border,
          })
        )
      } else if (node.type === 'paragraph') {
        const runs: TextRun[] = []
        node.content?.forEach((c: any) => {
          const isBold = c.marks?.some((m: any) => m.type === 'bold')
          const isItalic = c.marks?.some((m: any) => m.type === 'italic')
          runs.push(new TextRun({
            text: c.text || '',
            font: FONT_NAME,
            size: FONT_SIZE_BODY,
            bold: isBold,
            italics: isItalic,
            characterSpacing: CHAR_SPACING,
            color: BODY_COLOR,
          }))
        })
        children.push(new Paragraph({
          children: runs,
          spacing: {
            after: SPACE_AFTER_PARA,
            line: LINE_SPACING,
          },
        }))
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        node.content?.forEach((li: any) => {
          const runs: TextRun[] = []
          li.content?.[0]?.content?.forEach((c: any) => {
            const isBold = c.marks?.some((m: any) => m.type === 'bold')
            const isItalic = c.marks?.some((m: any) => m.type === 'italic')
            runs.push(new TextRun({
              text: c.text || '',
              font: FONT_NAME,
              size: FONT_SIZE_BODY,
              bold: isBold,
              italics: isItalic,
              characterSpacing: CHAR_SPACING,
              color: BODY_COLOR,
            }))
          })
          children.push(new Paragraph({
            children: runs,
            bullet: { level: 0 },
            spacing: {
              after: SPACE_AFTER_BULLET,
              line: LINE_SPACING,
            },
          }))
        })
      }
    }

    json.content?.forEach(processNode)

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children,
      }],
    })

    const blob = await Packer.toBlob(doc)
    downloadBlob(blob, 'resume.docx')
  }

  if (!editor) return null

  return (
    <div className="flex flex-col h-screen">
      {/* Header/Nav */}
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-primary">prettify-ai.com</a>
          <p className="text-sm text-gray-500 hidden md:block">The bridge from LLM output to files you can use</p>
          <div className="flex items-center gap-2">
            {/* Bookmarklet in header */}
            <Dialog open={bookmarkletOpen} onOpenChange={setBookmarkletOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-primary">
                  <Bookmark className="h-4 w-4 mr-1" />
                  Bookmarklet
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Install Browser Bookmarklet</DialogTitle>
                  <DialogDescription>
                    One-click tool to send text from ChatGPT, Claude, or any page directly here.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-900 mb-2">Installation:</p>
                    <ol className="text-sm text-blue-800 list-decimal list-inside space-y-1">
                      <li>Show your browser's bookmark bar (Ctrl+Shift+B)</li>
                      <li>Drag the button below to your bookmark bar</li>
                      <li>Done! Click it anytime with text selected</li>
                    </ol>
                  </div>
                  <div className="flex justify-center">
                    <a
                      href="javascript:(function(){var s=window.getSelection().toString();if(!s){alert('Select some text first!');return;}window.open('https://prettify-ai.com/editor?content='+btoa(unescape(encodeURIComponent(s))),'_blank');})();"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded border-2 border-dashed border-gray-300 hover:border-primary hover:bg-gray-50 cursor-move"
                      onClick={(e) => { e.preventDefault(); alert('Drag this button to your bookmark bar!'); }}
                    >
                      <Bookmark className="h-4 w-4" />
                      Prettify It
                    </a>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">Usage:</p>
                    <p className="text-xs text-gray-600">
                      Select any text (ChatGPT output, docs, markdown), click the bookmarklet, and it opens here formatted and ready to export.
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={clearContent} title="Clear content">
              <Trash2 className="h-4 w-4" />
            </Button>
            <a
              href="https://github.com/dkeesey/prettify-ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 ml-2"
              title="View source on GitHub"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
          </div>
        </div>
      </header>

      {/* WORKFLOW BAR - The 4-Step Process */}
      <div className="bg-gray-50 border-b px-4 py-2">
        <div className="max-w-[8.5in] mx-auto flex items-center gap-4">
          {/* Step 1: Input - Vertical stack */}
          <div className="flex items-start gap-2 flex-shrink-0">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-300 text-gray-700 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
            <div className="flex flex-col gap-0.5">
              <Button variant="outline" size="sm" className="h-7 text-xs justify-start" onClick={() => navigator.clipboard.readText().then(text => {
                if (text) {
                  // If it looks like markdown, auto-convert
                  if (text.includes('#') && text.includes('\n')) {
                    const html = markdownToHtml(text)
                    editor.commands.setContent(html)
                  } else {
                    editor.commands.setContent(text)
                  }
                }
              }).catch(() => {
                alert('Could not access clipboard. Please paste directly into the editor (Ctrl+V / Cmd+V).')
              })}>
                <ClipboardPaste className="h-3 w-3 mr-1.5" />
                Paste clipboard
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs justify-start" onClick={loadSample}>
                <FileText className="h-3 w-3 mr-1.5" />
                Paste sample MD
              </Button>
            </div>
          </div>

          {/* Arrow */}
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Step 2: Theme - THE HERO */}
          <div className="flex items-center gap-1.5 bg-primary/10 rounded-lg px-2 py-1 border-2 border-primary shadow-sm flex-shrink-0">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow">2</span>
            <span className="text-xs font-medium text-primary">Theme:</span>
            <Select value={theme} onValueChange={(v) => setTheme(v as ThemeKey)}>
              <SelectTrigger className="w-[130px] h-7 text-xs border-primary bg-white font-medium text-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Standard</SelectLabel>
                  {Object.entries(themes)
                    .filter(([, t]) => t.group === 'standard')
                    .map(([key, t]) => (
                      <SelectItem key={key} value={key}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>ATS-Friendly</SelectLabel>
                  {Object.entries(themes)
                    .filter(([, t]) => t.group === 'ats')
                    .map(([key, t]) => (
                      <SelectItem key={key} value={key}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Arrow */}
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Step 3: Export - DOCX emphasized for ATS themes, PDF for styled themes */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-300 text-gray-700 text-[10px] font-bold flex items-center justify-center">3</span>
            {features.export && (
              <div className="flex items-center gap-1">
                <Dialog open={docxConfirmOpen} onOpenChange={setDocxConfirmOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant={currentTheme.group === 'ats' ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                    >
                      <FileDown className="h-3 w-3 mr-1" />
                      DOCX
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Download DOCX</DialogTitle>
                      <DialogDescription>
                        {currentTheme.group === 'ats'
                          ? 'Ready for Applicant Tracking Systems'
                          : 'Using styled theme formatting'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                      {currentTheme.group !== 'ats' && (
                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                          <p className="text-amber-900 mb-2">
                            <strong>Submitting to an ATS?</strong> Select an <strong>ATS-Friendly</strong> theme first.
                          </p>
                          <p className="text-amber-800 text-xs">
                            ATS parsers can choke on: colored text, decorative lines, unusual fonts, tables, columns, headers/footers, and text boxes. Our ATS themes use plain black text with standard fonts.
                          </p>
                        </div>
                      )}
                      {currentTheme.group === 'ats' && (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-green-900">
                            <strong>ATS-Ready:</strong> Your {currentTheme.name} theme uses plain black text with {currentTheme.docxFont} font—optimized for applicant tracking systems.
                          </p>
                        </div>
                      )}
                      <p className="text-muted-foreground text-xs">
                        Emailing directly to a human? Use <strong>PDF</strong> to preserve your styled formatting.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setDocxConfirmOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={() => { exportDocx(); setDocxConfirmOpen(false); }}>
                        <FileText className="h-4 w-4 mr-1" />
                        Download DOCX
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  variant={currentTheme.group === 'ats' ? 'outline' : 'default'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handlePrint()}
                >
                  <FileDown className="h-3 w-3 mr-1" />
                  PDF
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Optional Editing Tools - De-emphasized */}
      <div className="bg-white/50 border-b px-4 py-1.5">
        <div className="max-w-[8.5in] mx-auto flex items-center gap-2">
          <span className="text-xs text-gray-400 mr-2">Edit text (optional):</span>
          {/* Formatting buttons - using editorState for reactive active state */}
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`h-7 w-7 p-0 ${editorState?.isBold ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`h-7 w-7 p-0 ${editorState?.isItalic ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={`h-7 w-7 p-0 ${editorState?.isUnderline ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <UnderlineIcon className="h-3.5 w-3.5" />
            </Button>
            <span className="w-px h-4 bg-gray-200 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`h-7 w-7 p-0 ${editorState?.isH1 ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Heading1 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`h-7 w-7 p-0 ${editorState?.isH2 ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Heading2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`h-7 w-7 p-0 ${editorState?.isH3 ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Heading3 className="h-3.5 w-3.5" />
            </Button>
            <span className="w-px h-4 bg-gray-200 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`h-7 w-7 p-0 ${editorState?.isBulletList ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={`h-7 w-7 p-0 ${editorState?.isOrderedList ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
          </div>


          {/* Zoom controls, word count, page count, and save status */}
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
            {/* Zoom controls */}
            <div className="flex items-center gap-1 border-r pr-3 mr-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom(prev => prev === 100 ? 75 : prev === 75 ? 50 : 50)}
                disabled={zoom === 50}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-8 text-center font-medium">{zoom}%</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom(prev => prev === 50 ? 75 : prev === 75 ? 100 : 100)}
                disabled={zoom === 100}
                className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>
            {saveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-yellow-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-600">
                <Save className="h-3 w-3" />
                Saved
              </span>
            )}
            <span>{wordCount} words</span>
            <span className={pageCount > 2 ? 'text-amber-600 font-medium' : ''}>
              {pageCount} {pageCount === 1 ? 'page' : 'pages'}
              {pageCount > 2 && ' ⚠️'}
            </span>
          </div>
        </div>
      </div>

      {/* Editor content - Paginated Canvas View */}
      <div className="flex-1 overflow-auto bg-gray-200 py-8">
        <style>{`
          /* Placeholder styling */
          .tiptap p.is-editor-empty:first-child::before {
            color: #9ca3af;
            content: attr(data-placeholder);
            float: left;
            height: 0;
            pointer-events: none;
          }
          .resume-content {
            transition: all 0.3s ease-in-out;
          }
          .resume-content h1, .resume-content h2, .resume-content h3 {
            font-family: var(--heading-font);
            color: var(--heading-color);
            transition: all 0.3s ease-in-out;
          }
          .resume-content h1 {
            font-size: 24pt;
            margin-bottom: 0.5rem;
          }
          .resume-content h2 {
            font-size: 14pt;
            border-bottom: var(--h2-border);
            padding-bottom: 0.25rem;
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
          }
          .resume-content h3 {
            font-size: 12pt;
            margin-top: 1rem;
            margin-bottom: 0.25rem;
          }
          .resume-content ul {
            padding-left: 1.5rem;
            margin: 0.5rem 0;
            list-style-type: disc;
          }
          .resume-content ol {
            padding-left: 1.5rem;
            margin: 0.5rem 0;
            list-style-type: decimal;
          }
          .resume-content li {
            margin: 0.25rem 0;
            display: list-item;
          }
          .resume-content p {
            margin: 0.5rem 0;
            transition: all 0.3s ease-in-out;
          }
          .resume-content a {
            color: var(--heading-color);
            text-decoration: underline;
            transition: all 0.3s ease-in-out;
          }
          @media print {
            .resume-content, .resume-content * {
              transition: none !important;
            }
          }
          /* Force proper page margins for PDF export */
          @page {
            size: letter;
            margin: 1in;
          }
          @media print {
            .resume-content {
              padding: 0 !important;
            }
          }
        `}</style>

        {/* Single paper-like container */}
        <div
          className="bg-white shadow-2xl relative mx-auto origin-top"
          style={{
            width: '8.5in',
            minHeight: '11in',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1), 0 0 0 1px rgb(0 0 0 / 0.05)',
            transform: `scale(${zoom / 100})`,
            transformOrigin: 'top center',
          }}
        >
          {/* Page count indicator */}
          {pageCount > 1 && (
            <div className="absolute top-2 right-3 text-xs text-gray-400 z-10">
              {pageCount} pages
            </div>
          )}
          {/* Content area with margins */}
          <div
            ref={printRef}
            className="resume-content"
            style={{
              padding: '1in',
              fontFamily: currentTheme.fontFamily,
              fontSize: currentTheme.fontSize,
              lineHeight: currentTheme.lineHeight,
              color: currentTheme.color,
              ['--heading-font' as any]: currentTheme.headingFont,
              ['--heading-color' as any]: currentTheme.headingColor,
              ['--export-font' as any]: currentTheme.exportFont,
              ['--h2-border' as any]: currentTheme.decorative ? `1px solid ${currentTheme.headingColor}` : 'none',
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  )
}
