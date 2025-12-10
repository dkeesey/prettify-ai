import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Send,
  Loader2,
  Sparkles,
  User,
  Bot,
  FileDown,
  ArrowRight,
  RotateCcw,
} from 'lucide-react'
import { extractResumeFromResponse } from '@/lib/markdown'
import { getStoredValue, setStoredValue, STORAGE_KEYS } from '@/lib/storage'
import { features } from '@/lib/features'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Coach personality and discovery flow
const SYSTEM_PROMPT = `You are a friendly, experienced resume coach helping someone build their resume. Your job is to:

1. DISCOVER their background through natural conversation (2-3 questions max)
2. IDENTIFY any potential resume concerns (gaps, career changes, short tenures, old experience)
3. Suggest REFRAMING strategies for any weaknesses
4. GENERATE a polished resume when you have enough info

REFRAMING STRATEGIES you know:
- Job gaps: Frame as intentional (family care, sabbatical, consulting, skill development)
- Short tenures: Frame as contract roles, startup pivots, acqui-hires, project-based
- Career pivots: Emphasize transferable skills and unique perspective
- Old experience: Add era context ("Built web presence for Goldman Sachs when that was pioneering work")
- No degree: Focus on practical experience, certifications, results
- Layoffs: Frame as company restructuring, not performance

CONVERSATION STYLE:
- Be warm and encouraging, not interrogating
- Ask ONE question at a time
- Acknowledge their experience positively
- When you spot a potential weakness, gently ask for context before assuming

WHEN READY TO GENERATE:
After gathering enough info (usually 2-3 exchanges), say something like:
"I have a great picture of your background! Ready for me to draft your resume?"

When they confirm, generate a complete resume in markdown format with:
# Name
**Target Title** | Location | email | phone

## Summary
[2-3 sentences]

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

Apply appropriate reframing strategies to any weaknesses identified.
Output the resume inside a code block with \`\`\`markdown at the start.`

const WELCOME_MESSAGE = `Hey! I'm your resume coach. I help people tell their career story in the best possible way.

What kind of role are you targeting, and what's your current situation? (Job searching, career change, getting back into work, etc.)`

export default function ChatCoach() {
  // Initialize from localStorage or defaults
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = getStoredValue<Message[] | null>(STORAGE_KEYS.CHAT_MESSAGES, null)
    return saved && saved.length > 0 ? saved : [{ role: 'assistant', content: WELCOME_MESSAGE }]
  })
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [generatedResume, setGeneratedResume] = useState<string | null>(() =>
    getStoredValue<string | null>(STORAGE_KEYS.GENERATED_RESUME, null)
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 1 || messages[0]?.content !== WELCOME_MESSAGE) {
      setStoredValue(STORAGE_KEYS.CHAT_MESSAGES, messages)
    }
  }, [messages])

  // Save generated resume to localStorage
  useEffect(() => {
    if (generatedResume) {
      setStoredValue(STORAGE_KEYS.GENERATED_RESUME, generatedResume)
    }
  }, [generatedResume])

  // Start new conversation - clears history
  const startNewConversation = useCallback(() => {
    setMessages([{ role: 'assistant', content: WELCOME_MESSAGE }])
    setGeneratedResume(null)
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
      // Build conversation for API
      const apiMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...newMessages.map(m => ({ role: m.role, content: m.content }))
      ]

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          max_tokens: 3000,
          temperature: 0.7,
          stream: true,
        }),
      })

      if (!response.ok) throw new Error('API request failed')

      // Handle streaming response
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

            // Update the last message with streamed content
            setMessages(prev => {
              const updated = [...prev]
              updated[updated.length - 1] = { role: 'assistant', content: assistantContent }
              return updated
            })
          } catch (e) {
            // Skip malformed JSON chunks
          }
        }
      }

      // Check if response contains a resume
      const resume = extractResumeFromResponse(assistantContent)
      if (resume) {
        setGeneratedResume(resume)
      }

    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had a hiccup. Could you try that again?'
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

  const openInEditor = () => {
    if (!generatedResume) return
    const encoded = btoa(generatedResume)
    window.location.href = `/editor?content=${encoded}`
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Resume Coach</h1>
              <p className="text-sm text-gray-500">Let's tell your story</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={startNewConversation}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Start New
              </Button>
            )}
            {features.editor && (
              <Button variant="outline" size="sm" asChild>
                <a href="/editor">Paste MD</a>
              </Button>
            )}
            {features.editor && generatedResume && (
              <Button onClick={openInEditor} className="gap-2">
                Open in Editor
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
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
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
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
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Resume Preview Banner */}
      {generatedResume && (
        <div className="bg-green-50 border-t border-green-200 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-700">
              <FileDown className="h-5 w-5" />
              <span className="font-medium">Resume generated!</span>
            </div>
            {features.editor && (
              <Button onClick={openInEditor} variant="outline" size="sm" className="gap-2">
                Edit & Export
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell me about yourself..."
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
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}
