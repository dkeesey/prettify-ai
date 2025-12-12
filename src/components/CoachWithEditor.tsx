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
  LinkIcon,
} from 'lucide-react'
import { extractResumeFromResponse, markdownToHtml } from '@/lib/markdown'
import { getStoredValue, setStoredValue, STORAGE_KEYS } from '@/lib/storage'
import {
  getCheckpoints,
  saveCheckpoint,
  type Checkpoint,
} from '@/lib/coach-storage'
import Editor from './Editor'
import CheckpointTimeline from './CheckpointTimeline'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Job URL patterns we can auto-fetch
const JOB_URL_PATTERNS = [
  /indeed\.com\/viewjob/i,
  /indeed\.com\/job\//i,
  /indeed\.com\/rc\/clk/i,
  /linkedin\.com\/jobs\/view/i,
  /greenhouse\.io\/.*\/jobs/i,
  /lever\.co\//i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /workday\.com.*job/i,
  /careers\.[^\/]+\/.*job/i,
  /jobs\.[^\/]+\//i,
]

/**
 * Extract URL from text if present
 */
function extractUrl(text: string): string | null {
  const urlMatch = text.match(/https?:\/\/[^\s]+/i)
  return urlMatch ? urlMatch[0] : null
}

/**
 * Check if URL looks like a job posting
 */
function isJobUrl(url: string): boolean {
  return JOB_URL_PATTERNS.some(pattern => pattern.test(url))
}

// System prompt focused on JD analysis and resume tailoring
const SYSTEM_PROMPT = `You are a resume coach who helps people tailor their resume to specific job descriptions.

Your job is to help people tell the RIGHT STORY for THIS SPECIFIC JOB.

WHEN YOU RECEIVE A JOB DESCRIPTION:
1. Quickly identify the TOP 3 things this employer values most
2. Note any specific keywords, skills, or experiences they emphasize
3. Summarize what kind of candidate they're looking for in 2-3 sentences
4. Ask the user for their resume/experience so you can help tailor it

WHEN YOU HAVE BOTH JD AND RESUME:
1. Identify which of their experiences best match what the JD wants
2. Suggest 2-3 ANGLES they could emphasize (technical depth, leadership, impact, scrappiness)
3. Point out any gaps or areas that need reframing
4. Once they pick an angle, generate a tailored resume

REFRAMING STRATEGIES:
- Job gaps: Frame as intentional (family care, sabbatical, consulting, skill development)
- Short tenures: Frame as contract roles, startup pivots, acqui-hires, project-based
- Career pivots: Emphasize transferable skills and unique perspective
- Old experience: Add era context ("Built web presence for Goldman Sachs when that was pioneering work")
- No degree: Focus on practical experience, certifications, results
- Missing skills: Highlight adjacent skills and quick learning ability

CONVERSATION STYLE:
- Be direct and helpful, not salesy
- Ask ONE question at a time
- Be specific about what you see in the JD
- Be honest about fit - if it's a stretch, say so

WHEN GENERATING RESUME:
Use markdown format inside a code block with \`\`\`markdown:
# Name
**Target Title** | Location | email | phone

## Summary
[2-3 sentences emphasizing fit for THIS JOB]

## Experience
### Job Title
**Company** | Date - Date
- Achievement using KEYWORDS from the JD
- Achievement showing relevant IMPACT

## Skills
[Skills mentioned in JD first, then related skills]

## Education
Degree, School, Year`

const WELCOME_MESSAGE = `I help you tailor your resume to specific jobs.

**Paste a job posting URL** (Indeed, LinkedIn, Greenhouse, Lever) and I'll analyze what they're looking for.

Or paste the job description text directly, then share your resume and we'll make it fit.`

export default function CoachWithEditor() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = getStoredValue<Message[] | null>(STORAGE_KEYS.CHAT_MESSAGES, null)
    return saved && saved.length > 0 ? saved : [{ role: 'assistant', content: WELCOME_MESSAGE }]
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingJD, setIsFetchingJD] = useState(false)

  // Pending resume from AI (not yet applied to editor)
  const [pendingResume, setPendingResume] = useState<string | null>(null)

  // Current job context (from URL fetch)
  const [currentJobContext, setCurrentJobContext] = useState<string | null>(null)

  // Lifted editor content state - source of truth for what's in the editor
  const [editorContent, setEditorContent] = useState<string>(() =>
    getStoredValue<string>(STORAGE_KEYS.EDITOR_CONTENT, '')
  )

  // Checkpoints - snapshots of AI iterations
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(() =>
    getCheckpoints()
  )

  // Track last editor content sent to API (for token optimization)
  const lastSentEditorContent = useRef<string>('')

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

  // Apply pending resume to editor and create checkpoint
  const applyResumeToEditor = useCallback(() => {
    if (!pendingResume) return

    // Convert to HTML and update lifted state
    const html = markdownToHtml(pendingResume)
    setEditorContent(html)

    // Also save to localStorage for persistence
    setStoredValue(STORAGE_KEYS.EDITOR_CONTENT, html)
    setStoredValue(STORAGE_KEYS.GENERATED_RESUME, pendingResume)

    // Create checkpoint for this AI iteration
    const checkpoint = saveCheckpoint({
      label: `AI Version ${checkpoints.length + 1}`,
      editorContent: html,
      resumeMarkdown: pendingResume,
    })
    setCheckpoints(prev => [checkpoint, ...prev])

    // Clear pending
    setPendingResume(null)
  }, [pendingResume, checkpoints.length])

  // Restore editor to a checkpoint state
  const restoreCheckpoint = useCallback((checkpoint: Checkpoint) => {
    setEditorContent(checkpoint.editorContent)
    setStoredValue(STORAGE_KEYS.EDITOR_CONTENT, checkpoint.editorContent)
    setStoredValue(STORAGE_KEYS.GENERATED_RESUME, checkpoint.resumeMarkdown)
  }, [])

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

  /**
   * Fetch job description from URL
   */
  const fetchJobDescription = async (url: string): Promise<string | null> => {
    setIsFetchingJD(true)
    try {
      const response = await fetch('/api/fetch-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (data.success && data.job) {
        // Format the job data nicely
        const job = data.job
        let jdText = `**${job.title}**`
        if (job.company) jdText += ` at ${job.company}`
        if (job.location) jdText += ` (${job.location})`
        jdText += '\n\n'

        if (job.requirements && job.requirements.length > 0) {
          jdText += '**Key Requirements:**\n'
          job.requirements.slice(0, 10).forEach((req: string) => {
            jdText += `• ${req}\n`
          })
          jdText += '\n'
        }

        jdText += '**Full Description:**\n' + job.description.substring(0, 3000)

        setCurrentJobContext(jdText)
        return jdText
      } else if (data.fallback) {
        return null // Let user know to paste directly
      }

      return null
    } catch (error) {
      console.error('Failed to fetch JD:', error)
      return null
    } finally {
      setIsFetchingJD(false)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading || isFetchingJD) return

    const userInput = input.trim()
    const url = extractUrl(userInput)

    // Check if user pasted a job URL
    if (url && isJobUrl(url)) {
      // Show the URL in chat first
      const urlMessage: Message = { role: 'user', content: userInput }
      setMessages(prev => [...prev, urlMessage])
      setInput('')

      // Add a "fetching" message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '🔍 Fetching job description from URL...'
      }])

      // Fetch the JD
      const jdContent = await fetchJobDescription(url)

      if (jdContent) {
        // Replace the fetching message with success + analysis request
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `✅ Got it! Here's what I found:\n\n${jdContent.substring(0, 1500)}...\n\nAnalyzing this job now...`
          }
          return updated
        })

        // Now send to AI for analysis with the JD context
        setIsLoading(true)
        try {
          const systemWithJD = SYSTEM_PROMPT + `\n\n---\nJOB DESCRIPTION (just fetched):\n${jdContent}`

          const apiMessages = [
            { role: 'system', content: systemWithJD },
            { role: 'user', content: 'I just shared a job posting. Please analyze what they\'re looking for and tell me the top 3-5 things I should emphasize in my resume for this role.' }
          ]

          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: apiMessages,
              max_tokens: 2000,
              temperature: 0.7,
              stream: true,
            }),
          })

          if (!response.ok) throw new Error('API request failed')

          const reader = response.body?.getReader()
          const decoder = new TextDecoder()
          let assistantContent = ''

          setMessages(prev => [...prev, { role: 'assistant', content: '' }])

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
        } catch (error) {
          console.error('Chat error:', error)
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: 'I got the job description but had trouble analyzing it. Try again?'
          }])
        } finally {
          setIsLoading(false)
        }
        return
      } else {
        // Couldn't fetch - update message and ask for paste
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            role: 'assistant',
            content: '⚠️ I couldn\'t fetch that job posting (the site may be blocking automated access). Could you copy and paste the job description text directly instead?'
          }
          return updated
        })
        return
      }
    }

    // Regular message flow (no URL detected)
    const userMessage: Message = { role: 'user', content: userInput }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)

    try {
      // Include editor content only if changed (token optimization)
      const strippedContent = editorContent
        ? editorContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        : ''

      let editorContext = ''
      if (strippedContent && strippedContent !== lastSentEditorContent.current) {
        // First turn or editor changed - send full content
        editorContext = `\n\nCURRENT RESUME IN EDITOR:\n${strippedContent}`
        lastSentEditorContent.current = strippedContent
      } else if (strippedContent) {
        // Editor unchanged - just note it
        editorContext = '\n\n[Editor content unchanged from previous turn]'
      }

      // Include job context if we have one
      let jobContext = ''
      if (currentJobContext) {
        jobContext = `\n\n---\nJOB DESCRIPTION (context):\n${currentJobContext.substring(0, 2000)}`
      }

      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT + editorContext + jobContext },
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
              <p className="text-sm text-gray-500">I can help you tell your story</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={startNewConversation}>
            <RotateCcw className="h-4 w-4 mr-1" />
            New
          </Button>
        </div>

        {/* Checkpoint Timeline - shows after first AI iteration */}
        {checkpoints.length > 0 && (
          <CheckpointTimeline
            checkpoints={checkpoints}
            onRestore={restoreCheckpoint}
          />
        )}

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

        {/* Job Context Indicator */}
        {currentJobContext && (
          <div className="bg-blue-50 border-t border-blue-200 px-4 py-2">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <LinkIcon className="h-4 w-4" />
              <span>Job loaded — resume will be tailored to this posting</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentJobContext(null)}
                className="ml-auto h-6 text-xs text-blue-600 hover:text-blue-800"
              >
                Clear
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
              placeholder={currentJobContext
                ? "Now paste your resume or describe your experience..."
                : "Paste a job URL (Indeed, LinkedIn) or job description text..."
              }
              className="min-h-[52px] max-h-[200px] resize-none"
              disabled={isLoading || isFetchingJD}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading || isFetchingJD}
              className="h-[52px] w-[52px] p-0"
            >
              {isLoading || isFetchingJD ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {isFetchingJD ? 'Fetching job description...' : 'Enter to send · Shift+Enter for new line'}
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
