import { motion, AnimatePresence } from 'framer-motion';
import TypingAnimation from './TypingAnimation';
import EquationWriter from './EquationWriter';
import type { LessonStep } from '../../../lib/ai/teachingAssistant';

interface WhiteboardCanvasProps {
  steps: LessonStep[];
  currentStepIndex: number;
  isPlaying: boolean;
}

export default function WhiteboardCanvas({
  steps,
  currentStepIndex,
  isPlaying,
}: WhiteboardCanvasProps) {
  const visibleSteps = steps.slice(0, currentStepIndex + 1);

  return (
    <div
      className="w-full min-h-screen flex items-start justify-center pt-16 pb-32 px-8"
      style={{
        backgroundImage:
          'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="w-full max-w-[900px] space-y-6">
        <AnimatePresence mode="sync">
          {visibleSteps.map((step, index) => {
            const isCurrent = index === currentStepIndex;

            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="w-full"
              >
                {step.action === 'heading' && (
                  <h1 className="text-4xl font-bold text-text-primary mb-2">
                    <TypingAnimation
                      text={step.content}
                      speed={30}
                      isActive={isCurrent && isPlaying}
                    />
                  </h1>
                )}

                {step.action === 'write' && (
                  <p className="text-xl text-text-primary leading-relaxed">
                    <TypingAnimation
                      text={step.content}
                      speed={35}
                      isActive={isCurrent && isPlaying}
                    />
                  </p>
                )}

                {step.action === 'equation' && (
                  <EquationWriter
                    equation={step.content}
                    animate={isCurrent}
                  />
                )}

                {step.action === 'highlight' && (
                  <motion.div
                    initial={
                      isCurrent
                        ? { backgroundSize: '0% 100%' }
                        : { backgroundSize: '100% 100%' }
                    }
                    animate={{ backgroundSize: '100% 100%' }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                    className="text-xl font-semibold text-text-primary px-3 py-2 rounded-lg"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, #FEF08A, #FDE047)',
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'left center',
                    }}
                  >
                    <TypingAnimation
                      text={step.content}
                      speed={30}
                      isActive={isCurrent && isPlaying}
                    />
                  </motion.div>
                )}

                {step.action === 'diagram' && (
                  <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center text-text-secondary">
                    <p className="text-lg italic">{step.content}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
