import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Loader2,
  Sparkles,
  Plus,
  Trash2,
  ChevronRight,
  FileText,
  X,
} from 'lucide-react'
import {
  type JobDescription,
  getJobDescriptions,
  saveJobDescription,
  deleteJobDescription,
  updateJobDescription,
} from '@/lib/coach-storage'

// Prompt for AI extraction
const EXTRACTION_PROMPT = `Extract key information from this job description. Return a JSON object with:
- "title": the job title (string)
- "company": the company name (string)
- "keywords": array of 5-10 key skills, technologies, or qualifications mentioned
- "requirements": array of 3-5 most important requirements or responsibilities

Return ONLY valid JSON, no other text. Example format:
{
  "title": "Senior Frontend Engineer",
  "company": "Acme Corp",
  "keywords": ["React", "TypeScript", "REST APIs", "Agile"],
  "requirements": ["5+ years frontend experience", "Lead technical projects", "Mentor junior developers"]
}`

interface ExtractionResult {
  title: string
  company: string
  keywords: string[]
  requirements: string[]
}

interface JobDescriptionInputProps {
  onSelectJD?: (jd: JobDescription) => void
  selectedJDId?: string | null
}

export default function JobDescriptionInput({
  onSelectJD,
  selectedJDId,
}: JobDescriptionInputProps) {
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>(() =>
    getJobDescriptions()
  )
  const [showForm, setShowForm] = useState(false)
  const [rawText, setRawText] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshJDs = () => {
    setJobDescriptions(getJobDescriptions())
  }

  const extractFromJD = async (text: string): Promise<ExtractionResult | null> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: EXTRACTION_PROMPT },
            { role: 'user', content: text },
          ],
          max_tokens: 1000,
          temperature: 0.3,
          stream: false,
        }),
      })

      if (!response.ok) {
        throw new Error('Extraction failed')
      }

      const data = await response.json()
      const content = data.choices?.[0]?.message?.content

      if (!content) {
        throw new Error('No content in response')
      }

      // Parse the JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('Could not find JSON in response')
      }

      return JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('Extraction error:', e)
      return null
    }
  }

  const handleSubmit = async () => {
    if (!rawText.trim()) return

    setIsExtracting(true)
    setError(null)

    const extracted = await extractFromJD(rawText)

    if (!extracted) {
      setError('Could not extract information. Please add title/company manually.')
      // Save with empty extraction
      const jd = saveJobDescription({
        title: 'Untitled Position',
        company: 'Unknown Company',
        rawText: rawText.trim(),
        extractedKeywords: [],
        extractedRequirements: [],
      })
      refreshJDs()
      setIsExtracting(false)
      setShowForm(false)
      setRawText('')
      onSelectJD?.(jd)
      return
    }

    const jd = saveJobDescription({
      title: extracted.title || 'Untitled Position',
      company: extracted.company || 'Unknown Company',
      rawText: rawText.trim(),
      extractedKeywords: extracted.keywords || [],
      extractedRequirements: extracted.requirements || [],
    })

    refreshJDs()
    setIsExtracting(false)
    setShowForm(false)
    setRawText('')
    onSelectJD?.(jd)
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this job description?')) {
      deleteJobDescription(id)
      refreshJDs()
      if (selectedJDId === id) {
        onSelectJD?.(null as unknown as JobDescription)
      }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">Job Descriptions</h2>
          <Button
            size="sm"
            variant={showForm ? 'secondary' : 'default'}
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? (
              <X className="h-4 w-4" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Paste job descriptions to extract keywords
        </p>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="p-4 border-b bg-gray-50">
          <div className="space-y-3">
            <div>
              <Label htmlFor="jd-text" className="text-sm">
                Job Description
              </Label>
              <Textarea
                id="jd-text"
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                placeholder="Paste the full job description here..."
                className="mt-1 min-h-[150px] text-sm"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!rawText.trim() || isExtracting}
              className="w-full"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Extracting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extract Keywords
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* JD List */}
      <div className="flex-1 overflow-y-auto">
        {jobDescriptions.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No job descriptions yet</p>
            <p className="text-xs mt-1">Add one to get started</p>
          </div>
        ) : (
          <div className="divide-y">
            {jobDescriptions.map(jd => (
              <div
                key={jd.id}
                onClick={() => onSelectJD?.(jd)}
                className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedJDId === jd.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-gray-900 truncate">
                      {jd.title}
                    </h3>
                    <p className="text-xs text-gray-500 truncate">{jd.company}</p>
                    {jd.extractedKeywords.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {jd.extractedKeywords.slice(0, 3).map((kw, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]"
                          >
                            {kw}
                          </span>
                        ))}
                        {jd.extractedKeywords.length > 3 && (
                          <span className="text-[10px] text-gray-400">
                            +{jd.extractedKeywords.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                      onClick={e => handleDelete(jd.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
