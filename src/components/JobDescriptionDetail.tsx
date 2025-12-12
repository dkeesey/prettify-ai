import { type JobDescription } from '@/lib/coach-storage'
import { FileText, Building2, Tag, CheckCircle, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

interface JobDescriptionDetailProps {
  jd: JobDescription
}

export default function JobDescriptionDetail({ jd }: JobDescriptionDetailProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const copyKeywords = () => {
    copyToClipboard(jd.extractedKeywords.join(', '), 'keywords')
  }

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{jd.title}</h2>
            <div className="flex items-center gap-1 text-gray-500 text-sm">
              <Building2 className="h-4 w-4" />
              {jd.company}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Added {new Date(jd.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Keywords Section */}
      {jd.extractedKeywords.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-500" />
              Keywords
            </h3>
            <Button
              size="sm"
              variant="ghost"
              onClick={copyKeywords}
              className="h-7 text-xs"
            >
              {copiedField === 'keywords' ? (
                <>
                  <Check className="h-3 w-3 mr-1 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {jd.extractedKeywords.map((kw, i) => (
              <span
                key={i}
                className="px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-sm"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Requirements Section */}
      {jd.extractedRequirements.length > 0 && (
        <div className="mb-6">
          <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Key Requirements
          </h3>
          <ul className="space-y-2">
            {jd.extractedRequirements.map((req, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-gray-700"
              >
                <span className="text-green-500 mt-1">•</span>
                {req}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw Text Section */}
      <div>
        <h3 className="font-medium text-gray-900 mb-2">Original Text</h3>
        <div className="bg-gray-50 rounded-lg p-4 max-h-[300px] overflow-y-auto">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans">
            {jd.rawText}
          </pre>
        </div>
      </div>
    </div>
  )
}
