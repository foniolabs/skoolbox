import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Sparkles, Plus, Trash2, GripVertical, Loader2 } from 'lucide-react'
import Button from '../components/shared/Button'
import Card from '../components/shared/Card'
import CustomDropdown from '../components/shared/CustomDropdown'
import { askAiTutor, getSubjects, saveAiLesson, type Subject } from '../lib/tauri/commands'

const classOptions = [
  { label: 'Pry 5', value: 'Pry 5' },
  { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' },
  { label: 'JSS2', value: 'JSS2' },
  { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' },
  { label: 'SS2', value: 'SS2' },
  { label: 'SS3', value: 'SS3' },
]

const durationOptions = [
  { label: '30 minutes', value: '30' },
  { label: '40 minutes', value: '40' },
  { label: '45 minutes', value: '45' },
  { label: '60 minutes', value: '60' },
  { label: '90 minutes', value: '90' },
]

interface LessonActivity {
  id: string
  title: string
  duration: string
  description: string
}

export default function LessonPlannerPage() {
  const navigate = useNavigate()
  const [subjectOptions, setSubjectOptions] = useState<{ label: string; value: string }[]>([])
  const [subject, setSubject] = useState('')
  const [classLevel, setClassLevel] = useState('Pry 5')
  const [topic, setTopic] = useState('')
  const [duration, setDuration] = useState('45')
  const [objectives, setObjectives] = useState('')
  const [activities, setActivities] = useState<LessonActivity[]>([
    { id: '1', title: 'Introduction', duration: '5', description: '' },
    { id: '2', title: 'Main Teaching', duration: '25', description: '' },
    { id: '3', title: 'Practice', duration: '10', description: '' },
    { id: '4', title: 'Summary & Assessment', duration: '5', description: '' },
  ])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  // Load subjects from backend
  useEffect(() => {
    getSubjects().then((subs) => {
      const uniqueNames = [...new Set(subs.map((s: Subject) => s.name))].sort()
      setSubjectOptions(uniqueNames.map((n) => ({ label: n, value: n })))
      if (uniqueNames.length > 0 && !subject) setSubject(uniqueNames[0])
    }).catch(() => {
      setSubjectOptions([
        { label: 'Mathematics', value: 'Mathematics' },
        { label: 'English', value: 'English' },
        { label: 'Basic Science', value: 'Basic Science' },
      ])
      if (!subject) setSubject('Mathematics')
    })
  }, [])

  const addActivity = () => {
    setActivities([
      ...activities,
      { id: Date.now().toString(), title: '', duration: '5', description: '' },
    ])
  }

  const removeActivity = (id: string) => {
    if (activities.length <= 1) return
    setActivities(activities.filter((a) => a.id !== id))
  }

  const updateActivity = (id: string, field: keyof LessonActivity, value: string) => {
    setActivities(activities.map((a) => (a.id === id ? { ...a, [field]: value } : a)))
  }

  const handleAIGenerate = async () => {
    if (!topic.trim()) return
    setIsGenerating(true)
    setError('')

    try {
      const prompt = `Create a detailed lesson plan for teaching "${topic}" in ${subject} to ${classLevel} students. Duration: ${duration} minutes.

Return the lesson plan in this exact format (plain text, not JSON):

OBJECTIVES:
1. [first objective]
2. [second objective]
3. [third objective]

ACTIVITIES:
ACTIVITY: [title] | [duration in minutes] minutes
[detailed description of what happens]

ACTIVITY: [title] | [duration in minutes] minutes
[detailed description of what happens]

(Include 4-6 activities that add up to ${duration} minutes total. Make activities specific to the Nigerian NERDC curriculum.)`

      const response = await askAiTutor({
        prompt,
        subject,
        classLevel,
        mode: 'whiteboard',
      })

      // Parse objectives
      const objMatch = response.match(/OBJECTIVES:\s*([\s\S]*?)(?=ACTIVITIES:|$)/i)
      if (objMatch) {
        setObjectives(objMatch[1].trim())
      }

      // Parse activities
      const activityRegex = /ACTIVITY:\s*(.+?)\s*\|\s*(\d+)\s*minutes?\s*\n([\s\S]*?)(?=ACTIVITY:|$)/gi
      const parsedActivities: LessonActivity[] = []
      let match
      while ((match = activityRegex.exec(response)) !== null) {
        parsedActivities.push({
          id: Date.now().toString() + parsedActivities.length,
          title: match[1].trim(),
          duration: match[2].trim(),
          description: match[3].trim(),
        })
      }

      if (parsedActivities.length > 0) {
        setActivities(parsedActivities)
      }
    } catch (err) {
      setError(`AI generation failed: ${err}. You can still fill in the plan manually.`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!topic.trim()) return
    setIsSaving(true)
    try {
      const lessonData = JSON.stringify({
        subject,
        classLevel,
        topic,
        duration,
        objectives,
        activities,
      })
      await saveAiLesson({
        teacherCommand: `Lesson Plan: ${topic}`,
        subject,
        classLevel,
        mode: 'lesson_plan',
        lessonData,
      })
      navigate('/prepare')
    } catch (err) {
      console.error('Failed to save:', err)
      navigate('/prepare')
    } finally {
      setIsSaving(false)
    }
  }

  const inputClasses =
    'w-full rounded-xl border border-border bg-bg-secondary p-3 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate('/prepare')}>
        <span className="flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back to Prepare
        </span>
      </Button>

      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-text-primary">Create Lesson Plan</h1>
      </div>

      {/* Lesson Details */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Lesson Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Subject</label>
            <CustomDropdown options={subjectOptions} value={subject} onChange={setSubject} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Class</label>
            <CustomDropdown options={classOptions} value={classLevel} onChange={setClassLevel} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Linear Equations"
              className={inputClasses}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Duration</label>
            <CustomDropdown options={durationOptions} value={duration} onChange={setDuration} />
          </div>
        </div>
      </Card>

      {/* AI Generate Button */}
      <div className="mb-6">
        <Button
          variant="outline"
          onClick={handleAIGenerate}
          disabled={!topic.trim() || isGenerating}
          className="flex items-center gap-2"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isGenerating ? 'Martha is generating...' : 'Auto-generate with AI'}
        </Button>
        {error && (
          <p className="mt-2 text-sm text-red-500">{error}</p>
        )}
      </div>

      {/* Learning Objectives */}
      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Learning Objectives</h2>
        <textarea
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          placeholder="What should students learn from this lesson?"
          rows={4}
          className={`${inputClasses} resize-none`}
        />
      </Card>

      {/* Lesson Activities */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Lesson Activities</h2>
          <button
            onClick={addActivity}
            className="flex items-center gap-1 text-sm text-primary font-medium hover:text-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Activity
          </button>
        </div>

        <div className="space-y-3">
          {activities.map((activity, index) => (
            <div key={activity.id} className="flex gap-3 rounded-xl border border-border bg-bg-secondary p-4">
              <div className="flex flex-col items-center gap-1 pt-1">
                <GripVertical className="w-4 h-4 text-text-muted" />
                <span className="text-xs font-bold text-text-muted">{index + 1}</span>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={activity.title}
                    onChange={(e) => updateActivity(activity.id, 'title', e.target.value)}
                    placeholder="Activity title"
                    className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={activity.duration}
                      onChange={(e) => updateActivity(activity.id, 'duration', e.target.value)}
                      className="w-16 rounded-lg border border-border bg-white px-2 py-2 text-sm text-text-primary text-center outline-none focus:border-primary"
                      min={1}
                      max={60}
                    />
                    <span className="text-xs text-text-muted">min</span>
                  </div>
                </div>
                <textarea
                  value={activity.description}
                  onChange={(e) => updateActivity(activity.id, 'description', e.target.value)}
                  placeholder="Describe what happens in this activity..."
                  rows={2}
                  className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-primary resize-none"
                />
              </div>
              <button
                onClick={() => removeActivity(activity.id)}
                className="flex-shrink-0 p-1 text-text-muted hover:text-red-500 transition-colors"
                title="Remove activity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 text-right text-sm text-text-secondary">
          Total: {activities.reduce((sum, a) => sum + (parseInt(a.duration) || 0), 0)} minutes
        </div>
      </Card>

      {/* Save buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/prepare')}>Cancel</Button>
        <Button onClick={handleSave} disabled={!topic.trim() || isSaving}>
          {isSaving ? 'Saving...' : 'Save Lesson Plan'}
        </Button>
      </div>
    </div>
  )
}
