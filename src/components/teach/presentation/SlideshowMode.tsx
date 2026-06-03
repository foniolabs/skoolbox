import { motion, AnimatePresence } from 'framer-motion'
import EquationWriter from '../whiteboard/EquationWriter'
import type { Slide } from '../../../lib/ai/teachingAssistant'

interface SlideshowModeProps {
  slides: Slide[]
  currentSlideIndex: number
}

export default function SlideshowMode({ slides, currentSlideIndex }: SlideshowModeProps) {
  const slide = slides[currentSlideIndex]
  if (!slide) return null

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-[#0D47A1] via-[#1565C0] to-[#1976D2]">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlideIndex}
          initial={{ opacity: 0, x: 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -60 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[900px] bg-white rounded-3xl shadow-2xl p-12 min-h-[480px] flex flex-col justify-center"
        >
          {/* Slide number */}
          <div className="text-xs font-medium text-text-muted mb-6 uppercase tracking-widest">
            Slide {currentSlideIndex + 1} of {slides.length}
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold text-text-primary mb-6">{slide.title}</h1>

          {/* Body */}
          <p className="text-xl text-text-secondary leading-relaxed mb-6">{slide.body}</p>

          {/* Equation */}
          {slide.equation && (
            <EquationWriter equation={slide.equation} animate={true} className="my-4" />
          )}

          {/* Bullet points */}
          {slide.bullets && slide.bullets.length > 0 && (
            <ul className="space-y-3 mt-2">
              {slide.bullets.map((bullet, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.15 }}
                  className="flex items-start gap-3 text-lg text-text-primary"
                >
                  <span className="w-2 h-2 rounded-full bg-primary mt-2.5 flex-shrink-0" />
                  <span>{bullet}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
