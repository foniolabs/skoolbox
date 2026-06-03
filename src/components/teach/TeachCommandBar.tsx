import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Play, BookMarked } from 'lucide-react'
import ModeSelector from './ModeSelector'
import VoiceSettings from './narration/VoiceSettings'
import CustomDropdown from '../shared/CustomDropdown'
import useTeachStore from '../../stores/useTeachStore'
import { getSubjects, getTermPlans, getPlanTopics, type Subject, type TermPlan, type TermPlanTopic } from '../../lib/tauri/commands'

const classOptions = [
  { label: 'Class', value: '' },
  { label: 'Pry 5', value: 'Pry 5' }, { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' }, { label: 'JSS2', value: 'JSS2' }, { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' }, { label: 'SS2', value: 'SS2' }, { label: 'SS3', value: 'SS3' },
]

const termOptions = [
  { label: 'Term 1', value: '1' },
  { label: 'Term 2', value: '2' },
  { label: 'Term 3', value: '3' },
]

export default function TeachCommandBar() {
  const navigate = useNavigate()
  const {
    teacherCommand, selectedSubject, selectedClass, selectedMode,
    setCommand, setSubject, setClass, setMode, startPresentation,
  } = useTeachStore()

  const [subjectOptions, setSubjectOptions] = useState([{ label: 'Subject', value: '' }])
  const [subjectMap, setSubjectMap] = useState<Record<string, Subject>>({}) // name → subject

  // Term plan state
  const [selectedTerm, setSelectedTerm] = useState('1')
  const [planTopics, setPlanTopics] = useState<TermPlanTopic[]>([])
  const [activePlan, setActivePlan] = useState<TermPlan | null>(null)
  const [selectedTopicId, setSelectedTopicId] = useState('')
  const [loadingTopics, setLoadingTopics] = useState(false)

  // Load subjects from backend on mount
  useEffect(() => {
    getSubjects()
      .then((subs) => {
        const seen = new Set<string>()
        const opts = [{ label: 'Subject', value: '' }]
        const map: Record<string, Subject> = {}
        for (const s of subs) {
          if (!seen.has(s.name)) {
            seen.add(s.name)
            opts.push({ label: s.name, value: s.name })
            map[s.name] = s
          }
        }
        setSubjectOptions(opts)
        setSubjectMap(map)
      })
      .catch(() => {
        setSubjectOptions([
          { label: 'Subject', value: '' },
          { label: 'Mathematics', value: 'Mathematics' },
          { label: 'English', value: 'English' },
          { label: 'Basic Science', value: 'Basic Science' },
          { label: 'Biology', value: 'Biology' },
          { label: 'Chemistry', value: 'Chemistry' },
          { label: 'Physics', value: 'Physics' },
          { label: 'Government', value: 'Government' },
          { label: 'Economics', value: 'Economics' },
        ])
      })
  }, [])

  // Load term plan topics whenever subject / class / term changes
  useEffect(() => {
    if (!selectedSubject || !selectedClass) {
      setPlanTopics([])
      setActivePlan(null)
      setSelectedTopicId('')
      return
    }

    const subject = subjectMap[selectedSubject]
    if (!subject) return

    setLoadingTopics(true)
    getTermPlans(subject.id, selectedClass)
      .then(async (plans) => {
        const termNum = parseInt(selectedTerm)
        const plan = plans.find((p) => p.term === termNum && p.is_active) || null
        setActivePlan(plan)
        if (plan) {
          const topics = await getPlanTopics(plan.id)
          setPlanTopics(topics)
        } else {
          setPlanTopics([])
        }
        setSelectedTopicId('')
      })
      .catch(() => { setPlanTopics([]); setActivePlan(null) })
      .finally(() => setLoadingTopics(false))
  }, [selectedSubject, selectedClass, selectedTerm, subjectMap])

  // When a topic is selected from the plan, fill in the command textarea
  const handleTopicSelect = (topicId: string) => {
    setSelectedTopicId(topicId)
    if (!topicId) return
    const topic = planTopics.find((t) => t.id === topicId)
    if (topic) {
      setCommand(`Teach "${topic.topic_name}" to ${selectedClass} ${selectedSubject} students`)
    }
  }

  const handleStartTeaching = () => {
    if (!teacherCommand.trim()) return
    startPresentation()
    navigate('/presentation')
  }

  // Topic dropdown options from the active term plan
  const topicOptions = [
    { label: activePlan ? 'Select a topic from your plan…' : 'No term plan — type command above', value: '' },
    ...planTopics.map((t) => ({
      label: `Week ${t.week_number} — ${t.topic_name}${t.lesson_notes ? ' ✓' : ''}${t.is_taught ? ' ☑' : ''}`,
      value: t.id,
    })),
  ]

  return (
    <div className="bg-white rounded-[20px] shadow-card p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">What should I teach?</h2>
        </div>
        <button
          onClick={() => navigate('/curriculum')}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-primary transition-colors border border-gray-200 rounded-lg px-3 py-1.5 hover:border-primary"
        >
          <BookMarked size={13} />
          Manage Curriculum
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 mb-4">
        <CustomDropdown
          options={subjectOptions}
          value={selectedSubject}
          onChange={setSubject}
          placeholder="Subject"
          className="w-48"
        />
        <CustomDropdown
          options={classOptions}
          value={selectedClass}
          onChange={setClass}
          placeholder="Class"
          className="w-36"
        />
        <CustomDropdown
          options={termOptions}
          value={selectedTerm}
          onChange={setSelectedTerm}
          placeholder="Term"
          className="w-28"
        />
      </div>

      {/* Term plan topic dropdown */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            {activePlan
              ? `Term ${selectedTerm} Plan — ${planTopics.length} topics`
              : 'Term Plan Topics'}
          </label>
          {!activePlan && selectedSubject && selectedClass && (
            <button
              onClick={() => navigate('/curriculum')}
              className="text-xs text-primary hover:underline"
            >
              + Create term plan
            </button>
          )}
        </div>
        <CustomDropdown
          options={topicOptions}
          value={selectedTopicId}
          onChange={handleTopicSelect}
          disabled={loadingTopics || planTopics.length === 0}
          className="w-full"
        />
        {activePlan && planTopics.length > 0 && (
          <p className="text-xs text-text-muted mt-1">
            {planTopics.filter((t) => t.lesson_notes).length}/{planTopics.length} topics have lesson notes
            {' · '}
            {planTopics.filter((t) => t.is_taught).length} taught
          </p>
        )}
      </div>

      {/* Divider with "or type a custom command" */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-text-muted">or type any command</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      {/* Command textarea */}
      <textarea
        value={teacherCommand}
        onChange={(e) => setCommand(e.target.value)}
        placeholder='e.g., "Explain photosynthesis step by step for JSS2 students"'
        rows={3}
        className="w-full rounded-xl border border-border bg-bg-secondary p-4 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none mb-5"
      />

      {/* Mode selector */}
      <div className="mb-6">
        <p className="text-xs font-medium text-text-secondary mb-2 uppercase tracking-wider">Presentation Mode</p>
        <ModeSelector selectedMode={selectedMode} onSelectMode={setMode} />
      </div>

      {/* Bottom row: Start button + voice settings */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleStartTeaching}
          disabled={!teacherCommand.trim()}
          className="flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-white font-semibold hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
        >
          <Play className="w-5 h-5" />
          Start Teaching
        </button>
        <VoiceSettings />
      </div>
    </div>
  )
}
