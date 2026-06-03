import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export interface DropdownOption {
  label: string
  value: string
  icon?: ReactNode
  disabled?: boolean
}

interface CustomDropdownProps {
  options: DropdownOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  icon?: ReactNode
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export default function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  icon,
  disabled = false,
  className = '',
  size = 'md',
}: CustomDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = options.find((o) => o.value === value)
  const displayLabel = selected?.label || placeholder

  const sizeClasses = size === 'sm'
    ? 'px-3 py-2 text-xs'
    : 'px-4 py-2.5 text-sm'

  const itemSizeClasses = size === 'sm'
    ? 'px-3 py-1.5 text-xs'
    : 'px-4 py-2.5 text-sm'

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-white ${sizeClasses} font-medium text-text-primary outline-none transition-all hover:shadow-md focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'border-primary ring-2 ring-primary/20' : ''
        }`}
      >
        <span className="flex items-center gap-2 truncate">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          {selected?.icon && <span className="flex-shrink-0">{selected.icon}</span>}
          <span className={!selected ? 'text-text-muted' : ''}>{displayLabel}</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-text-muted transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 w-full min-w-[160px] rounded-xl border border-border bg-white py-1 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-60 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 ${itemSizeClasses} transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  option.value === value
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-text-primary hover:bg-bg-secondary'
                }`}
              >
                {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
