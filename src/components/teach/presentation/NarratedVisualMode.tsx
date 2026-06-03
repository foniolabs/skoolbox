import { motion, AnimatePresence } from 'framer-motion'
import type { NarrationSegment } from '../../../lib/ai/teachingAssistant'

interface NarratedVisualModeProps {
  segments: NarrationSegment[]
  currentSegmentIndex: number
}

export default function NarratedVisualMode({ segments, currentSegmentIndex }: NarratedVisualModeProps) {
  const segment = segments[currentSegmentIndex]
  if (!segment) return null

  return (
    <div className="w-full min-h-screen flex bg-bg-dark text-white">
      {/* Visual area (70%) */}
      <div className="flex-[7] flex items-center justify-center p-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSegmentIndex}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-[700px]"
          >
            {/* Main visual card */}
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-10 border border-white/10">
              <h2 className="text-3xl font-bold mb-6 leading-tight">
                {highlightTerms(segment.visual, segment.highlightTerms || [])}
              </h2>
              <p className="text-lg text-white/70 leading-relaxed italic">
                "{segment.narration}"
              </p>
            </div>

            {/* Segment indicator */}
            <div className="flex justify-center gap-2 mt-8">
              {segments.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentSegmentIndex ? 'w-8 bg-primary-light' : 'w-2 bg-white/20'
                  }`}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Key points sidebar (30%) */}
      <div className="flex-[3] bg-white/5 border-l border-white/10 p-8 flex flex-col">
        <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-6">Key Points</h3>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentSegmentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-3 flex-1"
          >
            {segment.keyPoints.map((point, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.2 }}
                className="flex items-start gap-3"
              >
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary-light">{i + 1}</span>
                </div>
                <p className="text-sm text-white/80 leading-relaxed">{point}</p>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Bottom: segment counter */}
        <div className="mt-auto pt-6 border-t border-white/10">
          <p className="text-xs text-white/40">
            Segment {currentSegmentIndex + 1} of {segments.length}
          </p>
        </div>
      </div>
    </div>
  )
}

function highlightTerms(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return text

  const regex = new RegExp(`(${terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, i) => {
    const isHighlighted = terms.some(t => t.toLowerCase() === part.toLowerCase())
    if (isHighlighted) {
      return (
        <span key={i} className="text-primary-light bg-primary/20 px-1 rounded">
          {part}
        </span>
      )
    }
    return part
  })
}
