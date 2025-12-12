import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Send,
  Loader2,
  Sparkles,
  User,
  Bot,
  RotateCcw,
  ArrowRight,
} from 'lucide-react'
import { extractResumeFromResponse, markdownToHtml } from '@/lib/markdown'
import { getStoredValue, setStoredValue, STORAGE_KEYS } from '@/lib/storage'
import Editor from './Editor'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// System prompt focused on reframing and finding angles
const SYSTEM_PROMPT = `You are a resume coach who helps people see their experience through different lenses.

Your job is NOT to just format resumes. It's to help people figure out WHICH STORY TO TELL for a specific job.

WHEN USER SHARES A JD AND RESUME:
1. Identify what the JD values most (technical depth? leadership? scrappiness? business impact?)
2. Look at their experience and suggest 2-3 different ANGLES they could take
3. Ask which resonates - or if none fit, explore together
4. Only generate the resume AFTER agreeing on the angle

EXAMPLE ANGLES for the same experience:
- "Built internal tool" could be framed as:
  - Technical: "Architected React/Node system handling 10K daily users"
  - Leadership: "Led 3-person team to deliver tool adopted by 200 employees"
  - Impact: "Reduced manual process time by 60%, saving $X/year"
  - Scrappy: "Built MVP in 2 weeks with zero budget, iterated on feedback"

REFRAMING STRATEGIES you know:
- Job gaps: Frame as intentional (family care, sabbatical, consulting, skill development)
- Short tenures: Frame as contract roles, startup pivots, acqui-hires, project-based
- Career pivots: Emphasize transferable skills and unique perspective
- Old experience: Add era context ("Built web presence for Goldman Sachs when that was pioneering work")
- No degree: Focus on practical experience, certifications, results

CONVERSATION STYLE:
- Be direct and helpful, not salesy
- Ask ONE question at a time
- When you spot something that needs reframing, suggest options don't assume
- Be honest if an angle won't work

WHEN GENERATING RESUME:
Use markdown format:
# Name
**Target Title** | Location | email | phone

## Summary
[2-3 sentences through the agreed lens]

## Experience
### Job Title
**Company** | Date - Date
- Achievement framed through the lens
- Achievement framed through the lens

## Skills
skill1, skill2, skill3

## Education
Degree, School, Year

Output the resume inside a code block with \`\`\`markdown at the start.`

const WELCOME_MESSAGE = `Hey! I help you rethink your resume - not just format it, but figure out what story to tell.

Most people start by pasting:
1. A job description they're applying for
2. Their current resume (even if it's outdated or a mess)

We'll work through what the job actually values, how your experience maps to it, and what angle makes you stand out. Then I'll generate a tailored version.

What do you have?`

export default function CoachWithEditor() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = getStoredValue<Message[] | null>(STORAGE_KEYS.CHAT_MESSAGES, null)
    return saved && saved.length > 0 ? saved : [{ role: 'assistant', content: WELCOME_MESSAGE }]
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Pending resume from AI (not yet applied to editor)
  const [pendingResume, setPendingResume] = useState<string | null>(null)

  // Lifted editor content state - source of truth for what's in the editor
  const [editorContent, setEditorContent] = useState<string>(() =>
    getStoredValue<string>(STORAGE_KEYS.EDITOR_CONTENT, '')
  )

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Handle editor content changes
  const handleEditorContentChange = useCallback((html: string) => {
    setEditorContent(html)
  }, [])

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 1 || messages[0]?.content !== WELCOME_MESSAGE) {
      setStoredValue(STORAGE_KEYS.CHAT_MESSAGES, messages)
    }
  }, [messages])

  // Apply pending resume to editor
  const applyResumeToEditor = useCallback(() => {
    if (!pendingResume) return

    // Convert to HTML and update lifted state
    const html = markdownToHtml(pendingResume)
    setEditorContent(html)

    // Also save to localStorage for persistence
    setStoredValue(STORAGE_KEYS.EDITOR_CONTENT, html)
    setStoredValue(STORAGE_KEYS.GENERATED_RESUME, pendingResume)

    // Clear pending
    setPendingResume(null)
  }, [pendingResume])

  const startNewConversation = useCallback(() => {
    setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }])
    setPendingResume(null)
    setInput('')
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.CHAT_MESSAGES)
      localStorage.removeItem(STORAGE_KEYS.GENERATED_RESUME)
    }
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      // Include current editor content as context for the coach
      const editorContext = editorContent
        ? `\n\nCURRENT RESUME IN EDITOR (for reference):\n${editorContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}`
        : ''

      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT + editorContext },
        ...newMessages.map(m => ({ role: m.role, content: m.content }))
      ]

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          max_tokens: 3000,
          temperature: 0.7,
          stream: true,
        }),
      })

      if (!response.ok) throw new Error('API request failed')

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ''

      setMessages([...newMessages, { role: 'assistant', content: '' }])

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''
            assistantContent += content

            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
              return updated
            })
          } catch {
            // Skip malformed chunks
          }
        }
      }

      // Check for resume in response - set as pending, don't auto-apply
      const resume = extractResumeFromResponse(assistantContent)
      if (resume) {
        setPendingResume(resume)
      }

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Try again?'
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen">
      {/* Chat - Left Side */}
      <div className="w-1/2 flex flex-col border-r bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Resume Coach</h1>
              <p className="text-sm text-gray-500">Find your angle</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={startNewConversation}>
            <RotateCcw className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="space-y-4">
            {messages.map((message, i) => (
              <div
                key={i}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-white border shadow-sm rounded-2xl px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Update Resume Banner - shows when AI generated a resume */}
        {pendingResume && (
          <div className="bg-green-50 border-t border-green-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-700 font-medium">
                New resume ready
              </span>
              <Button
                onClick={applyResumeToEditor}
                size="sm"
                className="bg-green-600 hover:bg-green-700"
              >
                Update Editor
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t px-4 py-4">
          <div className="flex gap-3">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Paste job description, resume, or LinkedIn sections..."
              className="min-h-[52px] max-h-[200px] resize-none"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="h-[52px] w-[52px] p-0"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      {/* Editor - Right Side */}
      <div className="w-1/2 h-screen overflow-hidden">
        <Editor
          initialContent={editorContent}
          onContentChange={handleEditorContentChange}
        />
      </div>
    </div>
  )
}
