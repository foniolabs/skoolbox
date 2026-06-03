import { CheckCircle2, AlertCircle } from 'lucide-react';
import Card from '../shared/Card';
import { useProgressStore } from '../../stores/useProgressStore';

export default function StrengthsWeaknesses() {
  const { strengths, weaknesses } = useProgressStore();

  return (
    <Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strengths */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Strengths
          </h3>
          <ul className="space-y-3">
            {strengths.map((topic) => (
              <li
                key={topic}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-green-50 cursor-pointer transition-colors duration-150"
              >
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span className="text-sm text-text-primary">{topic}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Needs Improvement */}
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-4">
            Needs Improvement
          </h3>
          <ul className="space-y-3">
            {weaknesses.map((topic) => (
              <li
                key={topic}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-orange-50 cursor-pointer transition-colors duration-150"
              >
                <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span className="text-sm text-text-primary">{topic}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
