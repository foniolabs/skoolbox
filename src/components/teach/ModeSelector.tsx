import { PenLine, Video, Sparkles, Presentation, Mic, Wand2 } from 'lucide-react';
import type { PresentationMode } from '../../stores/useTeachStore';

interface ModeSelectorProps {
  selectedMode: PresentationMode;
  onSelectMode: (mode: PresentationMode) => void;
}

const modes: { mode: PresentationMode; icon: typeof PenLine; label: string }[] = [
  { mode: 'whiteboard', icon: PenLine, label: 'Board' },
  { mode: 'video', icon: Video, label: 'Video' },
  { mode: 'animation', icon: Sparkles, label: 'Animation' },
  { mode: 'slideshow', icon: Presentation, label: 'Slides' },
  { mode: 'narrated', icon: Mic, label: 'Narrate' },
  { mode: 'auto', icon: Wand2, label: 'Auto' },
];

export default function ModeSelector({ selectedMode, onSelectMode }: ModeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {modes.map(({ mode, icon: Icon, label }) => {
        const isSelected = selectedMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelectMode(mode)}
            className={`flex items-center gap-2 rounded-xl p-3 px-5 text-sm font-medium transition-all duration-200 ${
              isSelected
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white text-text-secondary border border-border hover:border-primary hover:text-primary'
            }`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
