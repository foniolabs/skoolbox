import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import WhiteboardCanvas from '../components/teach/whiteboard/WhiteboardCanvas'
import SlideshowMode from '../components/teach/presentation/SlideshowMode'
import NarratedVisualMode from '../components/teach/presentation/NarratedVisualMode'
import TeacherControls from '../components/teach/presentation/TeacherControls'
import useTeachStore from '../stores/useTeachStore'
import { generateLesson, parseLessonFromAi, type Lesson } from '../lib/ai/teachingAssistant'
import { speak, stopSpeaking } from '../lib/tts/marthaVoice'
import { askAiTutor, saveAiLesson } from '../lib/tauri/commands'

// Video and Animation modes are not yet implemented — map them to a working mode
function resolveMode(mode: string): string {
  if (mode === 'video' || mode === 'animation') return 'whiteboard'
  if (mode === 'auto') return 'whiteboard'
  return mode
}

export default function PresentationPage() {
  const navigate = useNavigate()
  const { teacherCommand, selectedSubject, selectedClass, selectedMode, stopPresentation } = useTeachStore()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [aiSource, setAiSource] = useState<'ai' | 'offline'>('offline')
  const [modeNote, setModeNote] = useState<string | null>(null)

  // Generate lesson on mount
  useEffect(() => {
    // If the teacher reopened a saved lesson, replay its stored JSON directly —
    // no regeneration, no re-save. (Read via getState so it isn't an effect dep.)
    const replay = useTeachStore.getState().replayData
    if (replay) {
      try {
        const saved = JSON.parse(replay) as Lesson
        setLesson(saved)
        setAiSource('ai')
        setCurrentStep(0)
        setIsLoading(false)
      } catch (e) {
        console.error('Failed to replay saved lesson:', e)
        navigate('/teach')
      } finally {
        useTeachStore.getState().setReplayData(null)
      }
      return
    }

    if (!teacherCommand.trim()) {
      navigate('/teach')
      return
    }

    let cancelled = false
    setIsLoading(true)

    async function generate() {
      const rawMode = selectedMode
      const mode = resolveMode(rawMode)
      const subject = selectedSubject || 'General'
      const classLevel = selectedClass || 'Pry 5'

      // Show note if mode was remapped
      if (rawMode === 'video') {
        setModeNote('Video mode is coming soon — showing Whiteboard mode instead.')
      } else if (rawMode === 'animation') {
        setModeNote('Animation mode is coming soon — showing Whiteboard mode instead.')
      }

      let generatedLesson: Lesson | null = null

      // Try the on-device AI first (Martha / Qwen via Ollama, resolved server-side)
      try {
        const aiResponse = await askAiTutor({
          prompt: teacherCommand,
          subject,
          classLevel,
          mode,
        })
        generatedLesson = parseLessonFromAi(aiResponse, mode, teacherCommand, subject)
        if (!cancelled) setAiSource('ai')
      } catch (err) {
        console.warn('On-device AI failed, falling back to a prebuilt lesson:', err)
      }

      // Fallback to local prebuilt lessons
      if (!generatedLesson) {
        generatedLesson = generateLesson(teacherCommand, subject, classLevel, mode)
        if (!cancelled) setAiSource('offline')
      }

      if (!cancelled) {
        setLesson(generatedLesson)
        setIsLoading(false)

        // Save lesson to history (fire and forget)
        saveAiLesson({
          teacherCommand,
          subject,
          classLevel,
          mode,
          lessonData: JSON.stringify(generatedLesson),
        }).catch(() => {})
      }
    }

    generate()
    return () => { cancelled = true }
  }, [teacherCommand, selectedSubject, selectedClass, selectedMode, navigate])

  // Get total steps based on mode
  const totalSteps = lesson
    ? lesson.mode === 'whiteboard' ? (lesson.steps?.length || 0)
    : lesson.mode === 'slideshow' ? (lesson.slides?.length || 0)
    : lesson.mode === 'narrated' ? (lesson.segments?.length || 0)
    : 0
    : 0

  // Teach: Martha speaks the current step's narration, then advances when she
  // finishes — real classroom pacing, not fixed timers that cut her off.
  useEffect(() => {
    if (!lesson || !isPlaying) return

    let cancelled = false

    const narration =
      lesson.mode === 'whiteboard' ? lesson.steps?.[currentStep]?.narration
      : lesson.mode === 'slideshow' ? lesson.slides?.[currentStep]?.narration
      : lesson.mode === 'narrated' ? lesson.segments?.[currentStep]?.narration
      : ''

    const advance = () => {
      if (!cancelled) setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
    }

    if (isMuted || !narration?.trim()) {
      // No voice available/needed — fall back to a paced timer.
      const duration =
        lesson.mode === 'whiteboard' ? (lesson.steps?.[currentStep]?.duration || 4000)
        : lesson.mode === 'slideshow' ? (lesson.slides?.[currentStep]?.duration || 5000)
        : (lesson.segments?.[currentStep]?.duration || 6000)
      if (currentStep >= totalSteps - 1) return
      const timer = setTimeout(advance, duration)
      return () => { cancelled = true; clearTimeout(timer) }
    }

    // Speak the line; when Martha finishes, move to the next step.
    speak(narration).then(() => {
      if (!cancelled && currentStep < totalSteps - 1) advance()
    })

    return () => {
      cancelled = true
      stopSpeaking()
    }
  }, [lesson, currentStep, isPlaying, isMuted, totalSteps])

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case ' ':
        e.preventDefault()
        setIsPlaying(prev => !prev)
        break
      case 'ArrowRight':
        setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
        break
      case 'ArrowLeft':
        setCurrentStep(prev => Math.max(prev - 1, 0))
        break
      case 'Escape':
        handleExit()
        break
    }
  }, [totalSteps])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const handleExit = () => {
    stopSpeaking()
    stopPresentation()
    navigate('/teach')
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-app flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center gap-1 mb-4">
            <div className="w-3 h-3 rounded-full bg-primary animate-dot-1" />
            <div className="w-3 h-3 rounded-full bg-primary animate-dot-2" />
            <div className="w-3 h-3 rounded-full bg-primary animate-dot-3" />
          </div>
          <p className="text-lg font-medium text-text-primary">
            Martha is preparing your lesson…
          </p>
          <p className="text-sm text-text-secondary mt-1">
            Generating on-device with Qwen — this can take a little while offline.
          </p>
        </div>
      </div>
    )
  }

  if (!lesson) return null

  return (
    <div className="min-h-screen">
      {/* AI source indicator */}
      <div className={`fixed top-3 left-3 z-50 px-3 py-1 rounded-full text-xs font-medium ${
        aiSource === 'ai' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}>
        {aiSource === 'ai' ? 'AI Generated (Qwen)' : 'Offline Template'}
      </div>

      {/* Mode remapped notice */}
      {modeNote && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 shadow">
          {modeNote}
        </div>
      )}

      {/* Presentation content */}
      {lesson.mode === 'whiteboard' && lesson.steps && (
        <WhiteboardCanvas
          steps={lesson.steps}
          currentStepIndex={currentStep}
          isPlaying={isPlaying}
        />
      )}

      {lesson.mode === 'slideshow' && lesson.slides && (
        <SlideshowMode
          slides={lesson.slides}
          currentSlideIndex={currentStep}
        />
      )}

      {lesson.mode === 'narrated' && lesson.segments && (
        <NarratedVisualMode
          segments={lesson.segments}
          currentSegmentIndex={currentStep}
        />
      )}

      {/* Teacher controls */}
      <TeacherControls
        isPlaying={isPlaying}
        currentStep={currentStep}
        totalSteps={totalSteps}
        modeName={lesson.mode}
        isMuted={isMuted}
        onTogglePlay={() => setIsPlaying(prev => !prev)}
        onPrev={() => setCurrentStep(prev => Math.max(prev - 1, 0))}
        onNext={() => setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))}
        onRepeat={() => {
          setCurrentStep(currentStep)
          setIsPlaying(true)
        }}
        onToggleMute={() => {
          setIsMuted(prev => !prev)
          stopSpeaking()
        }}
        onExit={handleExit}
      />
    </div>
  )
}
