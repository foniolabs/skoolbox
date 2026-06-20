import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import CustomDropdown from '../shared/CustomDropdown'
import Button from '../shared/Button'
import { updateStudent } from '../../lib/tauri/commands'

const classLevelOptions = [
  { label: 'Pry 5', value: 'Pry 5' },
  { label: 'Pry 6', value: 'Pry 6' },
  { label: 'JSS1', value: 'JSS1' },
  { label: 'JSS2', value: 'JSS2' },
  { label: 'JSS3', value: 'JSS3' },
  { label: 'SS1', value: 'SS1' },
  { label: 'SS2', value: 'SS2' },
  { label: 'SS3', value: 'SS3' },
]

interface StudentEditModalProps {
  student: { id: string; name: string; classLevel: string }
  onClose: () => void
  onSaved: () => void
}

export default function StudentEditModal({ student, onClose, onSaved }: StudentEditModalProps) {
  const [fullName, setFullName] = useState(student.name)
  const [classLevel, setClassLevel] = useState(student.classLevel)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Name cannot be empty.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await updateStudent(student.id, { fullName: fullName.trim(), classLevel })
      onSaved()
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Could not update the student.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-[20px] shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="text-lg font-bold text-text-primary">Edit Student</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-[12px] border border-border bg-bg-secondary/50 text-sm text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">Class (change to upgrade)</label>
            <CustomDropdown options={classLevelOptions} value={classLevel} onChange={setClassLevel} />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="flex items-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
