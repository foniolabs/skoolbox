import { useState, useEffect, useRef } from 'react';

interface TypingAnimationProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  isActive: boolean;
}

export default function TypingAnimation({
  text,
  speed = 40,
  onComplete,
  isActive,
}: TypingAnimationProps) {
  const [displayedCount, setDisplayedCount] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!isActive) {
      setDisplayedCount(text.length);
      setShowCursor(false);
      return;
    }

    setDisplayedCount(0);
    completedRef.current = false;
    setShowCursor(true);

    const interval = setInterval(() => {
      setDisplayedCount((prev) => {
        if (prev >= text.length) {
          clearInterval(interval);
          if (!completedRef.current) {
            completedRef.current = true;
            setTimeout(() => {
              setShowCursor(false);
              onComplete?.();
            }, 500);
          }
          return prev;
        }
        return prev + 1;
      });
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, isActive, onComplete]);

  return (
    <span>
      {text.slice(0, displayedCount)}
      {showCursor && isActive && (
        <span className="animate-pulse text-primary font-bold">|</span>
      )}
    </span>
  );
}
