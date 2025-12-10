import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import DOMPurify from 'dompurify'
import { useRef, useState, useEffect, useCallback } from 'react'
import { markdownToHtml } from '@/lib/markdown'
import { getStoredValue, setStoredValue, STORAGE_KEYS } from '@/lib/storage'
import { features } from '@/lib/features'
import { useReactToPrint } from 'react-to-print'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, convertInchesToTwip } from 'docx'
import { saveAs } from 'file-saver'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  FileDown,
  FileText,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Sparkles,
  Loader2,
  Linkedin,
  Wand2,
  MessageCircle,
  Trash2,
  Save,
  Bookmark,
  ClipboardPaste,
} from 'lucide-react'

// API calls now go through server-side /api/chat endpoint

// Resume writing styles
const resumeStyles = {
  metrics: {
    name: 'Metrics-Driven',
    description: 'Quantify achievements with numbers and percentages',
    prompt: `Focus on quantifiable achievements. Use specific numbers, percentages, and metrics wherever possible.
Example: "Increased revenue by 40%" or "Managed team of 12 engineers"`
  },
  narrative: {
    name: 'Brand & Narrative',
    description: 'Emphasize prestigious brands and pioneering context',
    prompt: `Emphasize brand recognition and pioneering work. For older roles, acknowledge that the technological context was different.
Example: "Built web presence for Goldman Sachs" or "Pioneered online graphics for ESPN before modern CMS tools existed"
Don't force metrics - let prestigious company names and groundbreaking work speak for themselves.`
  },
  hybrid: {
    name: 'Hybrid',
    description: 'Metrics for recent roles, narrative for older ones',
    prompt: `Use a hybrid approach:
- For roles in the last 10 years: Include specific metrics and quantifiable achievements
- For older roles: Emphasize brand recognition, pioneering context, and the significance of the work for its era
Recognize that "getting something online" in 1998 was fundamentally different than today.`
  },
}

type ResumeStyleKey = keyof typeof resumeStyles

// Fun loading messages
const loadingMessages = [
  "Analyzing your experience...",
  "Crafting compelling bullet points...",
  "Making you sound impressive...",
  "Quantifying your achievements...",
  "Polishing the details...",
  "Adding professional flair...",
  "Almost there...",
]

async function parseLinkedInProfile(profileText: string, style: ResumeStyleKey): Promise<string> {
  const styleInstructions = resumeStyles[style].prompt

  const prompt = `Parse this LinkedIn profile text and convert it to a professional resume in markdown format.

LinkedIn Profile Text:
${profileText}

WRITING STYLE:
${styleInstructions}

Extract and format into this EXACT markdown structure:
# [Full Name]
**[Current/Target Job Title]** | [Location] | [Email if found] | [Phone if found]

## Summary
[Write a 2-3 sentence professional summary based on their experience]

## Experience
### [Job Title]
**[Company]** | [Start Date] - [End Date or Present]
- [Achievement/responsibility 1]
- [Achievement/responsibility 2]
- [Achievement/responsibility 3]

[Repeat for each job]

## Skills
[skill1], [skill2], [skill3], ...

## Education
### [Degree]
**[School]** | [Year]

Rules:
- Extract ALL jobs listed
- Apply the WRITING STYLE instructions when crafting bullet points
- Keep it professional and concise
- If information is missing, omit that section
- Output ONLY the markdown, no explanations`

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.5,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to parse LinkedIn profile')
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

async function generateResume(formData: {
  name: string
  email: string
  phone: string
  location: string
  jobTitle: string
  experience: string
  skills: string
  education: string
}, style: ResumeStyleKey): Promise<string> {
  const styleInstructions = resumeStyles[style].prompt

  const prompt = `Generate a professional resume in markdown format for:

Name: ${formData.name}
Email: ${formData.email}
Phone: ${formData.phone}
Location: ${formData.location}
Target Job Title: ${formData.jobTitle}

Experience/Background:
${formData.experience}

Skills: ${formData.skills}

Education: ${formData.education}

WRITING STYLE:
${styleInstructions}

Generate a complete, professional resume in markdown format with:
- Name as H1
- Contact info on one line after name
- Summary section (2-3 sentences)
- Experience section with bullet points - apply the WRITING STYLE above
- Skills section
- Education section

Use this exact markdown format:
# Name
**Job Title** | Location | email | phone

## Summary
...

## Experience
### Job Title
**Company** | Date - Date
- Achievement 1
- Achievement 2

## Skills
skill1, skill2, skill3

## Education
### Degree
**School** | Year

Output ONLY the markdown, no explanations.`

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to generate resume')
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

const themes = {
  // Sans-serif themes (Arial/Helvetica family)
  professional: {
    name: 'Professional',
    fontFamily: 'Arial, Helvetica, sans-serif',
    headingFont: 'Arial, Helvetica, sans-serif',
    exportFont: 'Arial, Helvetica, sans-serif', // Universal font for PDF/DOCX
    docxFont: 'Arial',
    fontSize: '11pt',
    lineHeight: '1.5',
    color: '#1a1a1a',
    headingColor: '#2563eb',
    decorative: true, // Show underlines on H2
  },
  modern: {
    name: 'Modern',
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
  minimal: {
    name: 'ATS Minimal',
    fontFamily: 'Arial, Helvetica, sans-serif',
    headingFont: 'Arial, Helvetica, sans-serif',
    exportFont: 'Arial, Helvetica, sans-serif',
    docxFont: 'Arial',
    fontSize: '11pt',
    lineHeight: '1.5',
    color: '#000000',
    headingColor: '#000000',
    decorative: false, // No decorative elements - pure ATS
  },
  // Serif themes (Times New Roman family)
  classic: {
    name: 'Classic',
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
  traditional: {
    name: 'Traditional',
    fontFamily: '"Times New Roman", Times, serif',
    headingFont: '"Times New Roman", Times, serif',
    exportFont: '"Times New Roman", Times, serif',
    docxFont: 'Times New Roman',
    fontSize: '12pt',
    lineHeight: '1.5',
    color: '#000000',
    headingColor: '#000000',
    decorative: false, // Plain traditional look
  },
  elegant: {
    name: 'Elegant',
    fontFamily: 'Georgia, "Times New Roman", serif',
    headingFont: 'Georgia, "Times New Roman", serif',
    exportFont: '"Times New Roman", Times, serif', // Use Times for export compatibility
    docxFont: 'Times New Roman',
    fontSize: '11pt',
    lineHeight: '1.6',
    color: '#2d2d2d',
    headingColor: '#1e40af',
    decorative: true,
  },
}

type ThemeKey = keyof typeof themes

// Sample resume content for demo
const sampleResume = `# Jane Smith

**Senior Software Engineer** | San Francisco, CA | jane@email.com | (555) 123-4567

## Summary

Experienced software engineer with 8+ years building scalable web applications. Expert in React, TypeScript, and Node.js. Passionate about clean code and mentoring junior developers.

## Experience

### Senior Software Engineer
**Acme Tech** | Jan 2021 - Present

- Led development of customer-facing dashboard serving 50K+ daily users
- Reduced page load time by 40% through code splitting and lazy loading
- Mentored team of 4 junior developers, conducting weekly code reviews

### Software Engineer
**StartupCo** | Mar 2018 - Dec 2020

- Built REST API handling 1M+ requests daily using Node.js and PostgreSQL
- Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes
- Collaborated with design team to create component library used across 5 products

## Education

### B.S. Computer Science
**University of California, Berkeley** | 2014 - 2018

## Skills

JavaScript, TypeScript, React, Node.js, PostgreSQL, AWS, Docker, Git
`

export default function Editor() {
  // Initialize state from localStorage where applicable
  const [theme, setTheme] = useState<ThemeKey>(() =>
    getStoredValue(STORAGE_KEYS.THEME, 'professional') as ThemeKey
  )
  const [resumeStyle, setResumeStyle] = useState<ResumeStyleKey>(() =>
    getStoredValue(STORAGE_KEYS.RESUME_STYLE, 'hybrid') as ResumeStyleKey
  )
  const [wordCount, setWordCount] = useState(0)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [linkedInOpen, setLinkedInOpen] = useState(false)
  const [linkedInData, setLinkedInData] = useState({
    header: '',      // Name, headline, location
    about: '',       // About/Summary section
    experience: '',  // Work experience
    education: '',   // Education
    skills: '',      // Skills
  })
  const [generating, setGenerating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState(loadingMessages[0])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    location: '',
    jobTitle: '',
    experience: '',
    skills: '',
    education: '',
  })
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')
  const [bookmarkletOpen, setBookmarkletOpen] = useState(false)
  const [docxConfirmOpen, setDocxConfirmOpen] = useState(false)
  const [pageCount, setPageCount] = useState(1)
  const printRef = useRef<HTMLDivElement>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const currentTheme = themes[theme]

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

  // Save resume style preference when changed
  useEffect(() => {
    setStoredValue(STORAGE_KEYS.RESUME_STYLE, resumeStyle)
  }, [resumeStyle])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Paste your markdown here, or click Sample to see an example...',
      }),
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
      }
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[600px] p-8',
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

  // Load content from URL parameter or localStorage on mount
  useEffect(() => {
    if (!editor) return
    const params = new URLSearchParams(window.location.search)
    const urlContent = params.get('content')

    if (urlContent) {
      // URL parameter takes priority - sanitize for consistency
      const sanitizeOptions = {
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'hr', 'br'],
        ALLOWED_ATTR: ['href'],
        ALLOW_DATA_ATTR: false,
      }
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
    } else {
      // No URL param - try loading from localStorage
      const savedContent = getStoredValue<string | null>(STORAGE_KEYS.EDITOR_CONTENT, null)
      if (savedContent) {
        // Sanitize localStorage content (could have been tampered with)
        const sanitized = DOMPurify.sanitize(savedContent, {
          ALLOWED_TAGS: ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'hr', 'br'],
          ALLOWED_ATTR: ['href'],
          ALLOW_DATA_ATTR: false,
        })
        editor.commands.setContent(sanitized)
        setSaveStatus('saved')
      }
    }
  }, [editor])

  // Cycle through loading messages when generating
  useEffect(() => {
    if (!generating && !importing) return

    let index = 0
    const interval = setInterval(() => {
      index = (index + 1) % loadingMessages.length
      setLoadingMessage(loadingMessages[index])
    }, 1500)

    return () => clearInterval(interval)
  }, [generating, importing])

  // Calculate page count based on line count (typography-based)
  // US Letter with 1" margins = 6.5" x 9" content area
  // At 11pt font with 1.5 line height: ~40-42 lines per page
  const LINES_PER_PAGE = 42

  useEffect(() => {
    if (!editor) return

    const calculatePages = () => {
      // Get text content and count lines
      const text = editor.getText()
      const html = editor.getHTML()

      // Count actual line breaks in content
      // Each paragraph, heading, and list item counts as at least one line
      const paragraphs = (html.match(/<p>/g) || []).length
      const headings = (html.match(/<h[1-3]/g) || []).length
      const listItems = (html.match(/<li>/g) || []).length

      // H1 takes ~2 lines, H2 takes ~1.5 lines due to margins
      const headingLines = headings * 1.5

      // Estimate wrapped lines based on character count
      // ~65 chars per line at 11pt on 6.5" width (1" margins)
      const CHARS_PER_LINE = 65
      const textLines = Math.ceil(text.length / CHARS_PER_LINE)

      // Total estimated lines (paragraphs add spacing)
      const totalLines = Math.max(
        textLines + headingLines + (paragraphs * 0.5),
        paragraphs + headings + listItems
      )

      const pages = Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE))
      setPageCount(pages)
    }

    // Calculate on content changes
    calculatePages()

    // Listen for editor updates
    editor.on('update', calculatePages)

    return () => {
      editor.off('update', calculatePages)
    }
  }, [editor])

  const loadSample = () => {
    // Load raw markdown so user can see before/after with Convert MD
    editor?.commands.setContent(`<pre>${sampleResume}</pre>`)
  }

  const convertMarkdown = () => {
    if (!editor) return
    const text = editor.getText()
    if (text.includes('#')) {
      const html = markdownToHtml(text)
      editor.commands.setContent(html)
    }
  }

  const clearContent = () => {
    editor?.commands.clearContent()
    // Clear localStorage as well
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.EDITOR_CONTENT)
    }
    setSaveStatus('idle')
  }

  const handleGenerate = async () => {
    if (!editor) return
    setGenerating(true)
    try {
      const markdown = await generateResume(formData, resumeStyle)
      const html = markdownToHtml(markdown)
      editor.commands.setContent(html)
      setGenerateOpen(false)
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        location: '',
        jobTitle: '',
        experience: '',
        skills: '',
        education: '',
      })
    } catch (error) {
      console.error('Failed to generate resume:', error)
      alert('Failed to generate resume. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  const handleLinkedInImport = async () => {
    if (!editor) return
    // Combine all sections into one text block for the AI
    const combinedText = [
      linkedInData.header && `=== HEADER ===\n${linkedInData.header}`,
      linkedInData.about && `=== ABOUT ===\n${linkedInData.about}`,
      linkedInData.experience && `=== EXPERIENCE ===\n${linkedInData.experience}`,
      linkedInData.education && `=== EDUCATION ===\n${linkedInData.education}`,
      linkedInData.skills && `=== SKILLS ===\n${linkedInData.skills}`,
    ].filter(Boolean).join('\n\n')

    if (!combinedText.trim()) return

    setImporting(true)
    try {
      const markdown = await parseLinkedInProfile(combinedText, resumeStyle)
      const html = markdownToHtml(markdown)
      editor.commands.setContent(html)
      setLinkedInOpen(false)
      setLinkedInData({ header: '', about: '', experience: '', education: '', skills: '' })
    } catch (error) {
      console.error('Failed to parse LinkedIn profile:', error)
      alert('Failed to parse LinkedIn profile. Please try again.')
    } finally {
      setImporting(false)
    }
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
    const currentTheme = themes[theme]
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
          }))
        })
        children.push(
          new Paragraph({
            children: runs,
            heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
            spacing: {
              before: level === 1 ? 0 : level === 2 ? SPACE_BEFORE_H2 : SPACE_BEFORE_H3,
              after: level === 1 ? SPACE_AFTER_H1 : level === 2 ? SPACE_AFTER_H2 : SPACE_AFTER_H3,
              line: LINE_SPACING,
            },
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
    saveAs(blob, 'resume.docx')
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
            {features.coach && (
              <Button variant="outline" size="sm" asChild>
                <a href="/coach" className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  AI Coach
                </a>
              </Button>
            )}
            {features.aiGenerate && (
              <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
                    <Sparkles className="h-4 w-4 mr-1" />
                    Generate
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Generate Resume with AI</DialogTitle>
                  <DialogDescription>
                    Fill in your details and we'll generate a professional resume for you. Powered by Llama 3.3 - 100% free.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        placeholder="Jane Smith"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle">Target Job Title *</Label>
                      <Input
                        id="jobTitle"
                        placeholder="Senior Software Engineer"
                        value={formData.jobTitle}
                        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        placeholder="jane@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        placeholder="(555) 123-4567"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="San Francisco, CA"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="experience">Work Experience *</Label>
                    <Textarea
                      id="experience"
                      placeholder="Describe your work history. Include job titles, companies, dates, and key accomplishments. The AI will format it professionally."
                      className="min-h-[120px]"
                      value={formData.experience}
                      onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="skills">Skills</Label>
                    <Input
                      id="skills"
                      placeholder="React, TypeScript, Node.js, AWS, PostgreSQL"
                      value={formData.skills}
                      onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="education">Education</Label>
                    <Input
                      id="education"
                      placeholder="B.S. Computer Science, MIT, 2018"
                      value={formData.education}
                      onChange={(e) => setFormData({ ...formData, education: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setGenerateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || !formData.name || !formData.jobTitle || !formData.experience}
                    className="bg-gradient-to-r from-purple-600 to-blue-600"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {loadingMessage}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-1" />
                        Generate Resume
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            )}
            {features.linkedIn && (
              <Dialog open={linkedInOpen} onOpenChange={setLinkedInOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-[#0A66C2] text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white">
                    <Linkedin className="h-4 w-4 mr-1" />
                    LinkedIn
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle>Import from LinkedIn</DialogTitle>
                  <DialogDescription>
                    Copy each section from your LinkedIn profile. Only paste what you have - empty sections are fine.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto space-y-4 py-4">
                  <div className="bg-muted p-3 rounded-lg text-sm">
                    <p className="text-muted-foreground">
                      Go to your <a href="https://www.linkedin.com/in/me" target="_blank" rel="noopener noreferrer" className="text-[#0A66C2] underline">LinkedIn profile</a> and copy each section below. Click "Show all" to expand hidden items.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Header (Name, Title, Location)</Label>
                    <Textarea
                      placeholder="Dean Keesey&#10;Senior Software Engineer&#10;San Francisco Bay Area"
                      className="min-h-[60px] max-h-[100px] resize-none text-sm"
                      value={linkedInData.header}
                      onChange={(e) => setLinkedInData({ ...linkedInData, header: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">About</Label>
                    <Textarea
                      placeholder="Your summary/about section..."
                      className="min-h-[60px] max-h-[120px] resize-none text-sm"
                      value={linkedInData.about}
                      onChange={(e) => setLinkedInData({ ...linkedInData, about: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Experience *</Label>
                    <Textarea
                      placeholder="Copy all your job titles, companies, dates, and descriptions..."
                      className="min-h-[100px] max-h-[200px] resize-none text-sm"
                      value={linkedInData.experience}
                      onChange={(e) => setLinkedInData({ ...linkedInData, experience: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">💡 Click "Show all experiences" on LinkedIn first</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Education</Label>
                    <Textarea
                      placeholder="Schools, degrees, dates..."
                      className="min-h-[60px] max-h-[100px] resize-none text-sm"
                      value={linkedInData.education}
                      onChange={(e) => setLinkedInData({ ...linkedInData, education: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Skills</Label>
                    <Textarea
                      placeholder="Your skills list..."
                      className="min-h-[60px] max-h-[100px] resize-none text-sm"
                      value={linkedInData.skills}
                      onChange={(e) => setLinkedInData({ ...linkedInData, skills: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex-shrink-0 flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setLinkedInOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLinkedInImport}
                    disabled={importing || !linkedInData.experience.trim()}
                    className="bg-[#0A66C2] hover:bg-[#004182]"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {loadingMessage}
                      </>
                    ) : (
                      <>
                        <Linkedin className="h-4 w-4 mr-1" />
                        Import Profile
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            )}
            <Button variant="ghost" size="sm" onClick={clearContent} title="Clear content">
              <Trash2 className="h-4 w-4" />
            </Button>
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
              <Button variant="outline" size="sm" className="h-7 text-xs justify-start" onClick={loadSample}>
                <FileText className="h-3 w-3 mr-1.5" />
                Paste sample MD
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs justify-start" onClick={() => navigator.clipboard.readText().then(text => {
                if (text) {
                  editor.commands.setContent(text)
                }
              }).catch(() => {
                alert('Could not access clipboard. Please paste directly into the editor (Ctrl+V / Cmd+V).')
              })}>
                <ClipboardPaste className="h-3 w-3 mr-1.5" />
                Paste clipboard
              </Button>
              <Dialog open={bookmarkletOpen} onOpenChange={setBookmarkletOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 text-xs justify-start text-gray-400 hover:text-primary px-1">
                    <Bookmark className="h-3 w-3 mr-1.5" />
                    Bookmarklet...
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
            </div>
          </div>

          {/* Arrow */}
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Step 2: Convert */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-300 text-gray-700 text-[10px] font-bold flex items-center justify-center">2</span>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={convertMarkdown}>
              Convert MD
            </Button>
          </div>

          {/* Arrow */}
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Step 3: Theme - THE HERO */}
          <div className="flex items-center gap-1.5 bg-primary/10 rounded-lg px-2 py-1 border-2 border-primary shadow-sm flex-shrink-0">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shadow">3</span>
            <span className="text-xs font-medium text-primary">Theme:</span>
            <Select value={theme} onValueChange={(v) => setTheme(v as ThemeKey)}>
              <SelectTrigger className="w-[130px] h-7 text-xs border-primary bg-white font-medium text-primary">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(themes).map(([key, t]) => (
                  <SelectItem key={key} value={key}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Arrow */}
          <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Step 4: Export */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-300 text-gray-700 text-[10px] font-bold flex items-center justify-center">4</span>
            {features.export && (
              <div className="flex items-center gap-1">
                <Dialog open={docxConfirmOpen} onOpenChange={setDocxConfirmOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      <FileDown className="h-3 w-3 mr-1" />
                      DOCX
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Download ATS-Friendly DOCX</DialogTitle>
                      <DialogDescription>
                        Optimized for Applicant Tracking Systems
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                      <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-amber-900">
                          <strong>Note:</strong> The DOCX will look simpler than what you see on screen. This is intentional—ATS software can't read fancy formatting.
                        </p>
                      </div>
                      <p className="font-medium">DOCX format includes:</p>
                      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                        <li>Plain Arial font, 11pt</li>
                        <li>Simple heading hierarchy</li>
                        <li>Standard bullet points</li>
                        <li>No colors or decorative lines</li>
                      </ul>
                      <p className="text-muted-foreground text-xs">
                        Want the styled version? Use <strong>PDF</strong> for emailing directly to humans.
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
                <Button variant="default" size="sm" className="h-7 text-xs" onClick={() => handlePrint()}>
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

          {/* Resume style selector - only show when AI features enabled */}
          {features.aiGenerate && (
            <div className="flex items-center gap-2 ml-4">
              <Label className="text-sm text-muted-foreground whitespace-nowrap">Writing Style</Label>
              <Select value={resumeStyle} onValueChange={(v) => setResumeStyle(v as ResumeStyleKey)}>
                <SelectTrigger className="w-[150px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(resumeStyles).map(([key, s]) => (
                    <SelectItem key={key} value={key}>
                      <span>{s.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Word count, page count, and save status */}
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-400">
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
            .page-indicator {
              display: none !important;
            }
          }
        `}</style>

        {/* Page canvas with character-based width */}
        <div className="relative mx-auto" style={{ width: '8.5in' }}>
          {/* Page break indicators */}
          {pageCount > 1 && Array.from({ length: pageCount - 1 }).map((_, i) => (
            <div
              key={i}
              className="page-indicator absolute left-0 right-0 flex items-center justify-center"
              style={{
                top: `calc(${(i + 1) * 11}in + ${i * 24}px)`,
                height: '24px',
                background: '#d1d5db',
                zIndex: 10,
              }}
            >
              <span className="text-xs text-gray-600 font-medium px-2 py-0.5 bg-gray-200 rounded">
                Page {i + 2}
              </span>
            </div>
          ))}

          {/* The actual page canvas - 8.5x11 with 0.75in margins */}
          <div
            className="bg-white shadow-2xl"
            style={{
              width: '8.5in',
              minHeight: `calc(${pageCount} * 11in + ${Math.max(0, pageCount - 1) * 24}px)`,
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1), 0 0 0 1px rgb(0 0 0 / 0.05)',
            }}
          >
            <div
              ref={printRef}
              className="resume-content p-[1in]"
              style={{
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
    </div>
  )
}
