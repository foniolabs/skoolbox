import { motion, AnimatePresence } from 'framer-motion';
import TypingAnimation from './TypingAnimation';
import EquationWriter from './EquationWriter';
import type { LessonStep } from '../../../lib/ai/teachingAssistant';

interface WhiteboardCanvasProps {
  steps: LessonStep[];
  currentStepIndex: number;
  isPlaying: boolean;
  /** Large fonts + spacing for classroom projector readability (~6 m). */
  projectorMode?: boolean;
}

export default function WhiteboardCanvas({
  steps,
  currentStepIndex,
  isPlaying,
  projectorMode = false,
}: WhiteboardCanvasProps) {
  const visibleSteps = steps.slice(0, currentStepIndex + 1);

  const shell = projectorMode
    ? 'w-full flex-1 flex items-start justify-center pt-10 pb-20 px-10 md:px-16 min-h-[55vh]'
    : 'w-full min-h-[280px] flex items-start justify-center pt-10 pb-16 px-8';

  const inner = projectorMode ? 'w-full max-w-[1200px] space-y-10' : 'w-full max-w-[900px] space-y-6';

  const type = projectorMode
    ? { heading: 'text-5xl md:text-6xl', write: 'text-3xl md:text-4xl', highlight: 'text-3xl md:text-4xl', diagram: 'text-2xl md:text-3xl' }
    : { heading: 'text-4xl', write: 'text-xl', highlight: 'text-xl', diagram: 'text-lg' };

  const eqClass = projectorMode ? 'text-5xl md:text-6xl' : '';

  return (
    <div
      className={shell}
      style={{
        backgroundImage:
          'radial-gradient(circle, #e2e8f0 1px, transparent 1px)',
        backgroundSize: projectorMode ? '32px 32px' : '24px 24px',
      }}
    >
      <div className={inner}>
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
                  <h1 className={`${type.heading} font-bold text-text-primary mb-2`}>
                    <TypingAnimation
                      text={step.content}
                      speed={30}
                      isActive={isCurrent && isPlaying}
                    />
                  </h1>
                )}

                {step.action === 'write' && (
                  <p className={`${type.write} text-text-primary leading-relaxed`}>
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
                    className={eqClass}
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
                    className={`${type.highlight} font-semibold text-text-primary px-3 py-2 rounded-lg`}
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
                    <p className={`${type.diagram} italic`}>{step.content}</p>
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
