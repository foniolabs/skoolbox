import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import Card from '../shared/Card';
import { useProgressStore } from '../../stores/useProgressStore';

export default function ScoreTrend() {
  const { quizHistory } = useProgressStore();

  const chartData = [...quizHistory]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((entry) => ({
      date: new Date(entry.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      score: Math.round((entry.score / entry.totalQuestions) * 100),
      subject: entry.subject,
      topic: entry.topic,
    }));

  return (
    <Card>
      <h3 className="text-lg font-semibold text-text-primary mb-4">
        Score Trend (Last 30 Days)
      </h3>
      <div className="w-full h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: '#6B7280' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              formatter={(value) => [`${value}%`, 'Score']}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#1565C0"
              strokeWidth={2.5}
              dot={{ fill: '#1565C0', r: 4 }}
              activeDot={{ r: 6, fill: '#1565C0' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
