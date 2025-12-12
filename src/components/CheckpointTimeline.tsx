import { useState } from 'react'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type Checkpoint } from '@/lib/coach-storage'

interface CheckpointTimelineProps {
  checkpoints: Checkpoint[]
  onRestore: (checkpoint: Checkpoint) => void
}

export default function CheckpointTimeline({
  checkpoints,
  onRestore,
}: CheckpointTimelineProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (checkpoints.length === 0) return null

  // Show most recent checkpoint in collapsed view
  const latestCheckpoint = checkpoints[0]
  const olderCheckpoints = checkpoints.slice(1)

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200">
      {/* Collapsed view - shows latest checkpoint */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-800">
            {checkpoints.length} AI {checkpoints.length === 1 ? 'version' : 'versions'}
          </span>
          <span className="text-xs text-blue-600">
            Latest: {formatTime(latestCheckpoint.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRestore(latestCheckpoint)}
            className="h-7 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-100"
          >
            Restore v{latestCheckpoint.iteration}
          </Button>
          {olderCheckpoints.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-100"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Expanded view - shows all checkpoints as horizontal timeline */}
      {isExpanded && olderCheckpoints.length > 0 && (
        <div className="px-4 pb-3 pt-1">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {checkpoints.map((cp) => (
              <button
                key={cp.id}
                onClick={() => onRestore(cp)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium
                  bg-white border border-blue-200 text-blue-700
                  hover:bg-blue-100 hover:border-blue-300
                  transition-colors duration-150
                  focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
              >
                v{cp.iteration}
                <span className="ml-1.5 text-blue-500">
                  {formatTime(cp.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
