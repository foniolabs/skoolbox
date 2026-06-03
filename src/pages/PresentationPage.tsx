import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import WhiteboardCanvas from '../components/teach/whiteboard/WhiteboardCanvas'
import SlideshowMode from '../components/teach/presentation/SlideshowMode'
import NarratedVisualMode from '../components/teach/presentation/NarratedVisualMode'
import TeacherControls from '../components/teach/presentation/TeacherControls'
import useTeachStore from '../stores/useTeachStore'
import useTTSStore from '../stores/useTTSStore'
import { generateLesson, parseLessonFromAi, type Lesson } from '../lib/ai/teachingAssistant'
import { speakWithAzure, stopAzureSpeech } from '../lib/tts/azureTTS'
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
  const { azureKey, azureRegion, voice, rate, pitch } = useTTSStore()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [aiSource, setAiSource] = useState<'claude' | 'offline'>('offline')
  const [modeNote, setModeNote] = useState<string | null>(null)

  // Generate lesson on mount
  useEffect(() => {
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

      // Always try Claude AI first (API key is resolved server-side)
      try {
        const aiResponse = await askAiTutor({
          prompt: teacherCommand,
          subject,
          classLevel,
          mode,
        })
        generatedLesson = parseLessonFromAi(aiResponse, mode, teacherCommand, subject)
        if (!cancelled) setAiSource('claude')
      } catch (err) {
        console.warn('Claude API failed, falling back to offline:', err)
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

  // Auto-advance steps
  useEffect(() => {
    if (!lesson || !isPlaying || currentStep >= totalSteps - 1) return

    const duration =
      lesson.mode === 'whiteboard' ? (lesson.steps?.[currentStep]?.duration || 4000)
      : lesson.mode === 'slideshow' ? (lesson.slides?.[currentStep]?.duration || 5000)
      : lesson.mode === 'narrated' ? (lesson.segments?.[currentStep]?.duration || 6000)
      : 4000

    const timer = setTimeout(() => {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
    }, duration)

    return () => clearTimeout(timer)
  }, [lesson, isPlaying, currentStep, totalSteps])

  // TTS narration
  useEffect(() => {
    if (!lesson || isMuted || !isPlaying) return

    let narrationText = ''
    if (lesson.mode === 'whiteboard' && lesson.steps?.[currentStep]) {
      narrationText = lesson.steps[currentStep].narration
    } else if (lesson.mode === 'slideshow' && lesson.slides?.[currentStep]) {
      narrationText = lesson.slides[currentStep].narration
    } else if (lesson.mode === 'narrated' && lesson.segments?.[currentStep]) {
      narrationText = lesson.segments[currentStep].narration
    }

    if (narrationText) {
      speakWithAzure(narrationText, {
        subscriptionKey: azureKey,
        region: azureRegion,
        voice,
        rate,
        pitch,
      })
    }

    return () => {
      stopAzureSpeech()
    }
  }, [lesson, currentStep, isMuted, isPlaying, azureKey, azureRegion, voice, rate, pitch])

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
    stopAzureSpeech()
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
            AI is generating your lesson...
          </p>
          <p className="text-sm text-text-secondary mt-1">
            Using Claude to create a custom lesson
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
        aiSource === 'claude' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}>
        {aiSource === 'claude' ? 'AI Generated' : 'Offline Template'}
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
          stopAzureSpeech()
        }}
        onExit={handleExit}
      />
    </div>
  )
}
