import { type QuizQuestion } from '../../stores/useQuizStore';

interface QuestionViewProps {
  question: QuizQuestion;
  selectedAnswer: number | null;
  onSelectAnswer: (index: number) => void;
}

const optionLabels = ['A', 'B', 'C', 'D'];

export default function QuestionView({
  question,
  selectedAnswer,
  onSelectAnswer,
}: QuestionViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold text-text-primary leading-relaxed">
        {question.question}
      </h2>

      <div className="flex flex-col gap-3">
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === index;

          return (
            <button
              key={index}
              onClick={() => onSelectAnswer(index)}
              className={`w-full text-left rounded-xl border-2 p-4 transition-all duration-200 ${
                isSelected
                  ? 'border-primary bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    isSelected
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-text-secondary'
                  }`}
                >
                  {optionLabels[index]}
                </span>
                <span
                  className={`text-base ${
                    isSelected ? 'text-primary font-medium' : 'text-text-primary'
                  }`}
                >
                  {option}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
