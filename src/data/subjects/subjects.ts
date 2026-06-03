export interface Topic {
  id: string;
  name: string;
  description: string;
  status: 'completed' | 'in_progress' | 'not_started' | 'locked';
  progress: number; // 0-100
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  classLevels: string[];
  topics: Topic[];
}

export const subjects: Subject[] = [
  {
    id: 'mathematics',
    name: 'Mathematics',
    icon: 'calculator',
    classLevels: ['Pry 5', 'Pry 6', 'JSS1', 'JSS2', 'JSS3'],
    topics: [
      {
        id: 'math-algebra',
        name: 'Algebra',
        description: 'Introduction to variables, expressions, and simple equations',
        status: 'completed',
        progress: 100,
      },
      {
        id: 'math-linear-equations',
        name: 'Linear Equations',
        description: 'Solving linear equations in one and two variables',
        status: 'completed',
        progress: 100,
      },
      {
        id: 'math-geometry',
        name: 'Geometry',
        description: 'Properties of shapes, angles, and basic constructions',
        status: 'completed',
        progress: 100,
      },
      {
        id: 'math-statistics',
        name: 'Statistics',
        description: 'Data collection, mean, median, mode, and simple graphs',
        status: 'in_progress',
        progress: 45,
      },
      {
        id: 'math-number-bases',
        name: 'Number Bases',
        description: 'Conversion between binary, octal, decimal, and other bases',
        status: 'not_started',
        progress: 0,
      },
    ],
  },
  {
    id: 'english',
    name: 'English',
    icon: 'book-open',
    classLevels: ['Pry 5', 'Pry 6', 'JSS1', 'JSS2', 'JSS3'],
    topics: [
      {
        id: 'eng-tenses',
        name: 'Tenses',
        description: 'Past, present, and future tenses with correct usage',
        status: 'completed',
        progress: 100,
      },
      {
        id: 'eng-comprehension',
        name: 'Comprehension',
        description: 'Reading passages and answering questions accurately',
        status: 'completed',
        progress: 100,
      },
      {
        id: 'eng-essay-writing',
        name: 'Essay Writing',
        description: 'Structuring essays with introduction, body, and conclusion',
        status: 'in_progress',
        progress: 60,
      },
      {
        id: 'eng-parts-of-speech',
        name: 'Parts of Speech',
        description: 'Nouns, verbs, adjectives, adverbs, and their functions',
        status: 'in_progress',
        progress: 30,
      },
      {
        id: 'eng-vocabulary',
        name: 'Vocabulary Development',
        description: 'Building word power through synonyms, antonyms, and context clues',
        status: 'not_started',
        progress: 0,
      },
      {
        id: 'eng-oral-english',
        name: 'Oral English',
        description: 'Pronunciation, stress patterns, and spoken English skills',
        status: 'locked',
        progress: 0,
      },
    ],
  },
  {
    id: 'basic-science',
    name: 'Basic Science',
    icon: 'flask-conical',
    classLevels: ['Pry 5', 'Pry 6', 'JSS1', 'JSS2', 'JSS3'],
    topics: [
      {
        id: 'sci-living-cells',
        name: 'Living Cells',
        description: 'Structure and functions of plant and animal cells',
        status: 'in_progress',
        progress: 35,
      },
      {
        id: 'sci-ecology',
        name: 'Ecology',
        description: 'Ecosystems, food chains, and environmental balance',
        status: 'not_started',
        progress: 0,
      },
      {
        id: 'sci-matter',
        name: 'States of Matter',
        description: 'Solids, liquids, gases and changes of state',
        status: 'not_started',
        progress: 0,
      },
      {
        id: 'sci-energy',
        name: 'Energy',
        description: 'Forms of energy, energy conversion, and conservation',
        status: 'locked',
        progress: 0,
      },
      {
        id: 'sci-human-body',
        name: 'Human Body Systems',
        description: 'Digestive, circulatory, and respiratory systems',
        status: 'locked',
        progress: 0,
      },
    ],
  },
  {
    id: 'basic-technology',
    name: 'Basic Technology',
    icon: 'wrench',
    classLevels: ['Pry 5', 'Pry 6', 'JSS1', 'JSS2', 'JSS3'],
    topics: [
      {
        id: 'tech-drawing',
        name: 'Technical Drawing',
        description: 'Basic drawing instruments, lines, and geometric constructions',
        status: 'completed',
        progress: 100,
      },
      {
        id: 'tech-simple-machines',
        name: 'Simple Machines',
        description: 'Levers, pulleys, inclined planes, and mechanical advantage',
        status: 'completed',
        progress: 100,
      },
      {
        id: 'tech-materials',
        name: 'Materials & Processing',
        description: 'Types of materials, their properties and uses',
        status: 'completed',
        progress: 100,
      },
      {
        id: 'tech-woodwork',
        name: 'Woodwork',
        description: 'Wood types, tools, joints, and basic woodwork projects',
        status: 'in_progress',
        progress: 55,
      },
      {
        id: 'tech-electricity',
        name: 'Basic Electricity',
        description: 'Simple circuits, conductors, insulators, and safety',
        status: 'not_started',
        progress: 0,
      },
      {
        id: 'tech-metalwork',
        name: 'Metalwork',
        description: 'Metal types, properties, tools, and simple projects',
        status: 'locked',
        progress: 0,
      },
    ],
  },
];
