import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { useRef, useState, useEffect } from 'react'
import { useReactToPrint } from 'react-to-print'
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'
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
} from 'lucide-react'

// Groq API for free resume generation
// Note: This key is intentionally client-side for this free tool
const GROQ_API_KEY = import.meta.env.PUBLIC_GROQ_API_KEY || ''

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

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000,
      temperature: 0.5,
    }),
  })

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

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  })

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
}

const themes = {
  professional: {
    name: 'Professional',
    fontFamily: 'Georgia, serif',
    headingFont: 'Arial, sans-serif',
    fontSize: '11pt',
    lineHeight: '1.5',
    color: '#1a1a1a',
    headingColor: '#2563eb',
  },
  modern: {
    name: 'Modern',
    fontFamily: 'Inter, system-ui, sans-serif',
    headingFont: 'Inter, system-ui, sans-serif',
    fontSize: '10pt',
    lineHeight: '1.4',
    color: '#374151',
    headingColor: '#111827',
  },
  minimal: {
    name: 'ATS Minimal',
    fontFamily: 'Arial, sans-serif',
    headingFont: 'Arial, sans-serif',
    fontSize: '11pt',
    lineHeight: '1.5',
    color: '#000000',
    headingColor: '#000000',
  },
}

type ThemeKey = keyof typeof themes

// Simple markdown to HTML converter - defined at module level so it's available everywhere
const markdownToHtml = (md: string): string => {
  return md
    // Headers (order matters - do ### before ## before #)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Links [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
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
}

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
  const [theme, setTheme] = useState<ThemeKey>('professional')
  const [resumeStyle, setResumeStyle] = useState<ResumeStyleKey>('hybrid')
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
  const printRef = useRef<HTMLDivElement>(null)

  const currentTheme = themes[theme]

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
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const text = editor.getText()
      const words = text.trim().split(/\s+/).filter(Boolean).length
      setWordCount(words)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[600px] p-8',
      },
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

  // Load content from URL parameter on mount
  useEffect(() => {
    if (!editor) return
    const params = new URLSearchParams(window.location.search)
    const content = params.get('content')
    if (content) {
      try {
        const decoded = atob(content)
        const html = markdownToHtml(decoded)
        editor.commands.setContent(html)
      } catch (e) {
        // If not base64, try as plain text
        const html = markdownToHtml(content)
        editor.commands.setContent(html)
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

  const loadSample = () => {
    const html = markdownToHtml(sampleResume)
    editor?.commands.setContent(html)
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

    const processNode = (node: any) => {
      if (node.type === 'heading') {
        const level = node.attrs?.level || 1
        const text = node.content?.map((c: any) => c.text || '').join('') || ''
        children.push(
          new Paragraph({
            text,
            heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          })
        )
      } else if (node.type === 'paragraph') {
        const runs: TextRun[] = []
        node.content?.forEach((c: any) => {
          const isBold = c.marks?.some((m: any) => m.type === 'bold')
          const isItalic = c.marks?.some((m: any) => m.type === 'italic')
          runs.push(new TextRun({ text: c.text || '', bold: isBold, italics: isItalic }))
        })
        children.push(new Paragraph({ children: runs }))
      } else if (node.type === 'bulletList' || node.type === 'orderedList') {
        node.content?.forEach((li: any) => {
          const text = li.content?.[0]?.content?.map((c: any) => c.text || '').join('') || ''
          children.push(new Paragraph({ text: `• ${text}` }))
        })
      }
    }

    json.content?.forEach(processNode)

    const doc = new Document({
      sections: [{
        properties: {},
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
          <a href="/" className="text-xl font-bold text-primary">prettify.ai</a>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/coach" className="flex items-center gap-1">
                <MessageCircle className="h-4 w-4" />
                AI Coach
              </a>
            </Button>
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
            <Button variant="outline" size="sm" onClick={loadSample}>
              Sample
            </Button>
            <Button variant="outline" size="sm" onClick={convertMarkdown}>
              Convert MD
            </Button>
            <Button variant="outline" size="sm" onClick={clearContent}>
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePrint()}>
              <FileDown className="h-4 w-4 mr-1" />
              PDF
            </Button>
            <Button variant="default" size="sm" onClick={exportDocx}>
              <FileText className="h-4 w-4 mr-1" />
              DOCX
            </Button>
          </div>
        </div>
      </header>

      {/* Formatting Toolbar - Above Editor */}
      <div className="bg-white border-b px-4 py-2">
        <div className="max-w-[8.5in] mx-auto flex items-center gap-2 flex-wrap">
          {/* Formatting buttons */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive('bold') ? 'bg-muted' : ''}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive('italic') ? 'bg-muted' : ''}
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={editor.isActive('underline') ? 'bg-muted' : ''}
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
          </div>

          {/* Headings */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
            >
              <Heading3 className="h-4 w-4" />
            </Button>
          </div>

          {/* Lists */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? 'bg-muted' : ''}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive('orderedList') ? 'bg-muted' : ''}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </div>

          {/* Theme selector */}
          <div className="flex items-center gap-2 border-r pr-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">Select Theme</Label>
            <Select value={theme} onValueChange={(v) => setTheme(v as ThemeKey)}>
              <SelectTrigger className="w-[140px] h-8">
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

          {/* Resume style selector */}
          <div className="flex items-center gap-2">
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

          {/* Word count */}
          <div className="ml-auto text-xs text-muted-foreground">
            {wordCount} words
          </div>
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-auto bg-gray-200 py-8">
        <div
          className="mx-auto bg-white shadow-2xl"
          style={{
            width: '8.5in',
            minHeight: '11in',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1), 0 0 0 1px rgb(0 0 0 / 0.05)',
          }}
        >
          <div
            ref={printRef}
            className="resume-content p-[0.75in]"
            style={{
              fontFamily: currentTheme.fontFamily,
              fontSize: currentTheme.fontSize,
              lineHeight: currentTheme.lineHeight,
              color: currentTheme.color,
              ['--heading-font' as any]: currentTheme.headingFont,
              ['--heading-color' as any]: currentTheme.headingColor,
            }}
          >
            <style>{`
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
                border-bottom: 1px solid var(--heading-color);
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
              }
              .resume-content li {
                margin: 0.25rem 0;
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
            `}</style>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
    </div>
  )
}
