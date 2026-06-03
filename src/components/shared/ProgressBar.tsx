interface ProgressBarProps {
  value: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeClasses: Record<string, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export default function ProgressBar({
  value,
  color = 'bg-primary',
  size = 'md',
  showLabel = false,
}: ProgressBarProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-end mb-1">
          <span className="text-sm font-medium text-text-secondary">
            {Math.round(clampedValue)}%
          </span>
        </div>
      )}
      <div className={`w-full rounded-full bg-gray-200 ${sizeClasses[size]}`}>
        <div
          className={`${color} ${sizeClasses[size]} rounded-full transition-all duration-500`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
