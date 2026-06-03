export interface MathQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const mathQuestions: MathQuestion[] = [
  {
    id: 'mq-001',
    question: 'Solve for x: 2x + 5 = 15',
    options: ['x = 3', 'x = 5', 'x = 7', 'x = 10'],
    correctAnswer: 1,
    explanation:
      'Subtract 5 from both sides: 2x = 10. Divide both sides by 2: x = 5.',
    difficulty: 'easy',
  },
  {
    id: 'mq-002',
    question: 'Simplify: 3(x + 4) - 2x',
    options: ['x + 12', 'x + 4', '5x + 4', '3x + 12'],
    correctAnswer: 0,
    explanation:
      'Expand the bracket: 3x + 12 - 2x. Collect like terms: x + 12.',
    difficulty: 'easy',
  },
  {
    id: 'mq-003',
    question: 'If 5y - 3 = 2y + 9, find the value of y.',
    options: ['y = 2', 'y = 4', 'y = 6', 'y = 3'],
    correctAnswer: 1,
    explanation:
      'Collect like terms: 5y - 2y = 9 + 3, so 3y = 12. Divide by 3: y = 4.',
    difficulty: 'easy',
  },
  {
    id: 'mq-004',
    question: 'What is the value of x if x/3 + 2 = 7?',
    options: ['x = 9', 'x = 15', 'x = 21', 'x = 12'],
    correctAnswer: 1,
    explanation:
      'Subtract 2 from both sides: x/3 = 5. Multiply both sides by 3: x = 15.',
    difficulty: 'easy',
  },
  {
    id: 'mq-005',
    question: 'Solve: 4(2x - 1) = 3(x + 3)',
    options: ['x = 2.6', 'x = 13/5', 'x = 3', 'x = 2'],
    correctAnswer: 1,
    explanation:
      'Expand: 8x - 4 = 3x + 9. Collect like terms: 5x = 13. Therefore x = 13/5.',
    difficulty: 'medium',
  },
  {
    id: 'mq-006',
    question: 'If 2(x + 3) = x + 10, what is x?',
    options: ['x = 4', 'x = 7', 'x = 5', 'x = 3'],
    correctAnswer: 0,
    explanation:
      'Expand: 2x + 6 = x + 10. Subtract x from both sides: x + 6 = 10. Therefore x = 4.',
    difficulty: 'easy',
  },
  {
    id: 'mq-007',
    question: 'Solve the equation: 3x - 7 = 2(x + 1)',
    options: ['x = 9', 'x = 5', 'x = 8', 'x = 6'],
    correctAnswer: 0,
    explanation:
      'Expand: 3x - 7 = 2x + 2. Subtract 2x: x - 7 = 2. Add 7: x = 9.',
    difficulty: 'medium',
  },
  {
    id: 'mq-008',
    question: 'Find x if 7x + 2 = 5x + 14.',
    options: ['x = 4', 'x = 6', 'x = 8', 'x = 12'],
    correctAnswer: 1,
    explanation:
      'Subtract 5x from both sides: 2x + 2 = 14. Subtract 2: 2x = 12. Divide by 2: x = 6.',
    difficulty: 'medium',
  },
  {
    id: 'mq-009',
    question: 'If 3(2a + 1) - 4a = 11, find a.',
    options: ['a = 2', 'a = 4', 'a = 5', 'a = 3'],
    correctAnswer: 1,
    explanation:
      'Expand: 6a + 3 - 4a = 11. Simplify: 2a + 3 = 11. Subtract 3: 2a = 8. Therefore a = 4.',
    difficulty: 'medium',
  },
  {
    id: 'mq-010',
    question: 'Solve: (x + 5)/2 = (x - 1)/3 + 3',
    options: ['x = 1', 'x = 3', 'x = 5', 'x = 7'],
    correctAnswer: 0,
    explanation:
      'Multiply through by 6: 3(x + 5) = 2(x - 1) + 18. Expand: 3x + 15 = 2x - 2 + 18. Simplify: 3x + 15 = 2x + 16. Therefore x = 1.',
    difficulty: 'hard',
  },
  {
    id: 'mq-011',
    question: 'Which expression is equivalent to 5(2x - 3) + 4x?',
    options: ['14x - 15', '14x - 3', '10x - 15', '14x + 15'],
    correctAnswer: 0,
    explanation:
      'Expand: 10x - 15 + 4x. Collect like terms: 14x - 15.',
    difficulty: 'easy',
  },
  {
    id: 'mq-012',
    question: 'If x + y = 10 and x - y = 4, find the value of x.',
    options: ['x = 5', 'x = 6', 'x = 7', 'x = 8'],
    correctAnswer: 2,
    explanation:
      'Add both equations: 2x = 14. Divide by 2: x = 7.',
    difficulty: 'hard',
  },
  {
    id: 'mq-013',
    question: 'Solve for p: 2p/5 = 6',
    options: ['p = 12', 'p = 15', 'p = 10', 'p = 30'],
    correctAnswer: 1,
    explanation:
      'Multiply both sides by 5: 2p = 30. Divide by 2: p = 15.',
    difficulty: 'easy',
  },
  {
    id: 'mq-014',
    question: 'What is the value of m in: 4m - 3(m - 2) = 10?',
    options: ['m = 4', 'm = 6', 'm = 8', 'm = 10'],
    correctAnswer: 0,
    explanation:
      'Expand: 4m - 3m + 6 = 10. Simplify: m + 6 = 10. Therefore m = 4.',
    difficulty: 'medium',
  },
  {
    id: 'mq-015',
    question: 'Solve: 2(3x + 4) - 5(x - 2) = 20',
    options: ['x = 2', 'x = 4', 'x = 1', 'x = 6'],
    correctAnswer: 0,
    explanation:
      'Expand: 6x + 8 - 5x + 10 = 20. Simplify: x + 18 = 20. Therefore x = 2.',
    difficulty: 'hard',
  },
];
