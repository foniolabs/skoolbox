import { Users, Maximize2 } from 'lucide-react'
import CustomDropdown from '../shared/CustomDropdown'

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

interface DashboardHeaderProps {
  selectedClass: string
  onClassChange: (cls: string) => void
}

export default function DashboardHeader({ selectedClass, onClassChange }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      {/* Left: Title */}
      <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>

      {/* Center: Class selector */}
      <div className="flex items-center gap-4">
        <CustomDropdown
          options={classOptions}
          value={selectedClass}
          onChange={onClassChange}
          icon={<Users className="w-4 h-4 text-primary" />}
          className="w-40"
        />
      </div>

      {/* Right: expand */}
      <div className="flex items-center gap-3">
        <button className="bg-white rounded-[20px] shadow-card p-2.5 text-text-secondary hover:shadow-md transition-shadow">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
