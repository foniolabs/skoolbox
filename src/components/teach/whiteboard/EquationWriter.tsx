import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface EquationWriterProps {
  equation: string;
  animate?: boolean;
  onComplete?: () => void;
  className?: string;
}

export default function EquationWriter({
  equation,
  animate = true,
  onComplete,
  className = '',
}: EquationWriterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        containerRef.current.innerHTML = katex.renderToString(equation, {
          throwOnError: false,
          displayMode: true,
        });
      } catch {
        containerRef.current.textContent = equation;
      }
    }
  }, [equation]);

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        onAnimationComplete={() => onComplete?.()}
        className={`text-3xl text-center my-4 ${className}`}
      >
        <div ref={containerRef} />
      </motion.div>
    );
  }

  return (
    <div className={`text-3xl text-center my-4 ${className}`}>
      <div ref={containerRef} />
    </div>
  );
}
