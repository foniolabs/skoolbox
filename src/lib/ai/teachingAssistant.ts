export interface LessonStep {
  action: 'write' | 'equation' | 'highlight' | 'heading' | 'diagram';
  content: string;
  style?: Record<string, string>;
  narration: string;
  duration: number;
}

export interface Slide {
  title: string;
  body: string;
  equation?: string;
  narration: string;
  bullets?: string[];
  duration: number;
}

export interface NarrationSegment {
  visual: string;
  narration: string;
  keyPoints: string[];
  highlightTerms?: string[];
  duration: number;
}

export interface Lesson {
  title: string;
  subject: string;
  classLevel: string;
  mode: 'whiteboard' | 'slideshow' | 'narrated';
  steps?: LessonStep[];
  slides?: Slide[];
  segments?: NarrationSegment[];
}

const prebuiltLessons: Record<string, Lesson> = {
  'solving linear equations': {
    title: 'Solving Linear Equations',
    subject: 'Mathematics',
    classLevel: 'JSS 2',
    mode: 'whiteboard',
    steps: [
      {
        action: 'heading',
        content: 'Solving Linear Equations',
        narration: 'Today we are going to learn how to solve linear equations. Let us begin with a simple example.',
        duration: 4000,
      },
      {
        action: 'write',
        content: 'A linear equation has one unknown variable. Our goal is to find the value of that variable.',
        narration: 'A linear equation has one unknown variable. Our goal is to find the value of that variable.',
        duration: 5000,
      },
      {
        action: 'equation',
        content: '2x + 5 = 15',
        narration: 'Let us solve two x plus five equals fifteen. We need to find the value of x.',
        duration: 4000,
      },
      {
        action: 'write',
        content: 'Step 1: Subtract 5 from both sides to isolate the term with x.',
        narration: 'Step one. We subtract five from both sides to isolate the term with x.',
        duration: 4000,
      },
      {
        action: 'equation',
        content: '2x + 5 - 5 = 15 - 5 \\implies 2x = 10',
        narration: 'Two x plus five minus five equals fifteen minus five. This simplifies to two x equals ten.',
        duration: 5000,
      },
      {
        action: 'highlight',
        content: 'Step 2: Divide both sides by 2 to solve for x.',
        narration: 'Step two. Now we divide both sides by two to solve for x.',
        duration: 4000,
      },
      {
        action: 'equation',
        content: '\\frac{2x}{2} = \\frac{10}{2} \\implies x = 5',
        narration: 'Two x divided by two equals ten divided by two. Therefore, x equals five.',
        duration: 5000,
      },
      {
        action: 'highlight',
        content: 'Answer: x = 5',
        narration: 'The answer is x equals five. Well done! Always remember to check your answer by substituting back into the original equation.',
        duration: 4000,
      },
    ],
  },

  'parts of speech': {
    title: 'Parts of Speech',
    subject: 'English',
    classLevel: 'JSS 1',
    mode: 'slideshow',
    slides: [
      {
        title: 'Parts of Speech',
        body: 'Words in English are grouped into categories called parts of speech. Today we will learn about three important ones: Nouns, Verbs, and Adjectives.',
        narration: 'Welcome class! Today we are going to learn about the parts of speech. We will focus on three important categories: nouns, verbs, and adjectives.',
        duration: 6000,
      },
      {
        title: 'Nouns',
        body: 'A noun is a word that names a person, place, thing, or idea.',
        bullets: [
          'Person: teacher, Amina, boy',
          'Place: Lagos, school, market',
          'Thing: book, table, phone',
          'Idea: love, freedom, happiness',
        ],
        narration: 'A noun is a word that names a person, place, thing, or idea. For example, teacher is a person, Lagos is a place, book is a thing, and love is an idea.',
        duration: 8000,
      },
      {
        title: 'Verbs',
        body: 'A verb is a word that shows action or a state of being.',
        bullets: [
          'Action verbs: run, eat, write, dance',
          'State of being: am, is, are, was, were',
          'Example: "She writes a letter."',
          '"Writes" is the verb showing action.',
        ],
        narration: 'A verb is a word that shows action or a state of being. Action verbs include words like run, eat, write, and dance. State of being verbs include am, is, are, was, and were.',
        duration: 8000,
      },
      {
        title: 'Adjectives',
        body: 'An adjective describes or modifies a noun. It tells us more about the noun.',
        bullets: [
          'Size: big, small, tall',
          'Color: red, blue, green',
          'Quality: beautiful, clever, kind',
          'Example: "The tall boy runs fast."',
        ],
        narration: 'An adjective describes or modifies a noun. It tells us more about the noun. Adjectives can describe size, color, or quality. For example, in the sentence The tall boy runs fast, tall is the adjective describing the noun boy.',
        duration: 8000,
      },
      {
        title: 'Summary',
        body: 'Let us review what we have learned today.',
        bullets: [
          'Nouns name people, places, things, and ideas',
          'Verbs show action or state of being',
          'Adjectives describe nouns',
          'Practice: Identify the parts of speech in your reading!',
        ],
        narration: 'Let us review. Nouns name people, places, things, and ideas. Verbs show action or state of being. Adjectives describe nouns. Now practice identifying parts of speech in your everyday reading!',
        duration: 7000,
      },
    ],
  },

  'photosynthesis': {
    title: 'Photosynthesis',
    subject: 'Basic Science',
    classLevel: 'JSS 2',
    mode: 'narrated',
    segments: [
      {
        visual: 'Photosynthesis: How Plants Make Food',
        narration: 'Today we will learn about photosynthesis. This is the process by which green plants make their own food using sunlight, water, and carbon dioxide.',
        keyPoints: [
          'Photosynthesis is how plants make food',
          'It requires sunlight, water, and carbon dioxide',
          'It takes place in the leaves',
        ],
        highlightTerms: ['photosynthesis', 'sunlight', 'carbon dioxide'],
        duration: 8000,
      },
      {
        visual: 'The Equation of Photosynthesis: Carbon dioxide + Water (+ Sunlight) produces Glucose + Oxygen',
        narration: 'The equation for photosynthesis is: carbon dioxide plus water, in the presence of sunlight and chlorophyll, produces glucose and oxygen. Plants absorb carbon dioxide from the air and water from the soil.',
        keyPoints: [
          'CO2 + H2O + Sunlight yields Glucose + O2',
          'Chlorophyll is the green pigment in leaves',
          'Chlorophyll captures sunlight energy',
        ],
        highlightTerms: ['chlorophyll', 'glucose', 'oxygen'],
        duration: 9000,
      },
      {
        visual: 'Inside a Leaf: Cross-section showing chloroplasts absorbing light',
        narration: 'Inside each leaf are tiny structures called chloroplasts. These contain chlorophyll, the green pigment that captures sunlight. This is why leaves are green!',
        keyPoints: [
          'Chloroplasts are found in leaf cells',
          'They contain chlorophyll',
          'Chlorophyll makes leaves green',
          'Stomata allow gas exchange',
        ],
        highlightTerms: ['chloroplasts', 'stomata'],
        duration: 8000,
      },
      {
        visual: 'Why Photosynthesis Matters: The foundation of all food chains',
        narration: 'Photosynthesis is essential for life on Earth. It produces the oxygen we breathe and the food that all living things depend on. Without photosynthesis, there would be no life as we know it.',
        keyPoints: [
          'Produces oxygen for all living things',
          'Creates food that enters the food chain',
          'Removes carbon dioxide from the atmosphere',
          'Foundation of all ecosystems',
        ],
        highlightTerms: ['oxygen', 'food chain', 'ecosystems'],
        duration: 8000,
      },
    ],
  },

  'geography of nigeria': {
    title: 'Geography of Nigeria',
    subject: 'Social Studies',
    classLevel: 'JSS 1',
    mode: 'narrated',
    segments: [
      {
        visual: 'Nigeria: Our Great Nation - Map of Nigeria showing 36 states and FCT',
        narration: 'Nigeria is located in West Africa. It is the most populous country in Africa with over 200 million people. Nigeria has 36 states and a Federal Capital Territory in Abuja.',
        keyPoints: [
          'Located in West Africa',
          'Most populous country in Africa',
          '36 states and the FCT Abuja',
          'Borders: Benin, Niger, Chad, Cameroon',
        ],
        highlightTerms: ['West Africa', 'Abuja', '36 states'],
        duration: 9000,
      },
      {
        visual: 'Physical Features: Rivers Niger and Benue, Jos Plateau, Niger Delta',
        narration: 'Nigeria has diverse physical features. The two major rivers are the River Niger and the River Benue. They meet at Lokoja and form the Niger Delta in the south. The Jos Plateau is the highest region in central Nigeria.',
        keyPoints: [
          'River Niger: longest river in West Africa',
          'River Benue: major tributary',
          'They meet at Lokoja',
          'Jos Plateau: highland in the center',
          'Niger Delta: oil-rich coastal region',
        ],
        highlightTerms: ['River Niger', 'River Benue', 'Jos Plateau', 'Niger Delta'],
        duration: 10000,
      },
      {
        visual: 'Vegetation Zones: From mangrove swamps in the south to Sahel savanna in the north',
        narration: 'Nigeria has different vegetation zones. In the south, we have mangrove and rainforest. The middle belt has guinea savanna. The north has sudan and sahel savanna. Each zone supports different types of farming and wildlife.',
        keyPoints: [
          'Mangrove swamps along the coast',
          'Tropical rainforest in the south',
          'Guinea savanna in the middle belt',
          'Sudan and Sahel savanna in the north',
        ],
        highlightTerms: ['mangrove', 'rainforest', 'savanna', 'sahel'],
        duration: 9000,
      },
      {
        visual: 'Economic Activities: Agriculture, Oil and Gas, Mining, and Trade',
        narration: 'Nigeria has a diverse economy. Agriculture employs the most people, growing crops like cassava, yam, rice, and cocoa. Nigeria is also a major oil-producing country. The oil industry is centered in the Niger Delta region.',
        keyPoints: [
          'Agriculture is the largest employer',
          'Major crops: cassava, yam, rice, cocoa',
          'Oil and gas: major export revenue',
          'Other minerals: tin, coal, limestone',
        ],
        highlightTerms: ['agriculture', 'oil', 'cassava', 'cocoa'],
        duration: 9000,
      },
    ],
  },
};

function generateGenericWhiteboardLesson(command: string, subject: string, classLevel: string): Lesson {
  return {
    title: command,
    subject,
    classLevel,
    mode: 'whiteboard',
    steps: [
      {
        action: 'heading',
        content: command,
        narration: `Today we will learn about ${command}. Let us begin.`,
        duration: 3000,
      },
      {
        action: 'write',
        content: `${command} is an important topic in ${subject}. Let us explore it step by step.`,
        narration: `${command} is an important topic in ${subject}. Let us explore it step by step.`,
        duration: 5000,
      },
      {
        action: 'write',
        content: 'Key Concept 1: Understanding the fundamentals is essential before we can apply what we learn.',
        narration: 'The first key concept is understanding the fundamentals. This forms the foundation of everything we will learn today.',
        duration: 5000,
      },
      {
        action: 'highlight',
        content: 'Key Concept 2: Practice makes perfect. Apply what you learn in exercises.',
        narration: 'The second key concept is that practice makes perfect. Always apply what you learn through exercises and revision.',
        duration: 5000,
      },
      {
        action: 'write',
        content: 'Summary: Review the key points and practice regularly to master this topic.',
        narration: 'In summary, review the key points we discussed and practice regularly. You will master this topic in no time.',
        duration: 4000,
      },
    ],
  };
}

export function generateLesson(
  command: string,
  subject: string,
  classLevel: string,
  mode: string
): Lesson {
  const normalizedCommand = command.toLowerCase().trim();

  // Check for pre-built lessons
  for (const [key, lesson] of Object.entries(prebuiltLessons)) {
    if (normalizedCommand.includes(key) || key.includes(normalizedCommand)) {
      return { ...lesson, classLevel };
    }
  }

  // If mode is specified and doesn't match whiteboard, try to adapt
  if (mode === 'slideshow') {
    return {
      title: command,
      subject,
      classLevel,
      mode: 'slideshow',
      slides: [
        {
          title: command,
          body: `Welcome to today's lesson on ${command} in ${subject}.`,
          narration: `Welcome class! Today we will learn about ${command}.`,
          duration: 5000,
        },
        {
          title: 'Introduction',
          body: `${command} is a fundamental topic in ${subject}. Understanding it will help you in many areas.`,
          bullets: [
            'Pay attention to key terms',
            'Take notes as we go',
            'Ask questions if unsure',
          ],
          narration: `Let us start with an introduction. ${command} is a fundamental topic that you will find very useful.`,
          duration: 6000,
        },
        {
          title: 'Key Points',
          body: 'Here are the main concepts to remember:',
          bullets: [
            `${command} is part of the ${subject} curriculum`,
            'Understanding the basics is the first step',
            'Practice with examples to build confidence',
          ],
          narration: 'Here are the key points you need to remember from today\'s lesson.',
          duration: 6000,
        },
        {
          title: 'Summary',
          body: 'Review what we learned and practice at home.',
          bullets: [
            'Review your notes',
            'Complete the practice exercises',
            'Come prepared with questions next class',
          ],
          narration: 'That concludes our lesson. Please review your notes and complete the practice exercises at home.',
          duration: 5000,
        },
      ],
    };
  }

  if (mode === 'narrated') {
    return {
      title: command,
      subject,
      classLevel,
      mode: 'narrated',
      segments: [
        {
          visual: `${command} - An Introduction`,
          narration: `Today we will learn about ${command} in ${subject}. This is an important topic for ${classLevel} students.`,
          keyPoints: [
            `${command} is part of ${subject}`,
            'We will cover the fundamentals',
            'Practice is essential for mastery',
          ],
          duration: 7000,
        },
        {
          visual: 'Core Concepts and Definitions',
          narration: `Let us explore the core concepts of ${command}. Understanding these definitions will help you answer questions correctly.`,
          keyPoints: [
            'Learn the key definitions',
            'Understand how concepts connect',
            'Apply knowledge to solve problems',
          ],
          duration: 7000,
        },
        {
          visual: 'Summary and Review',
          narration: `In summary, ${command} is a foundational topic in ${subject}. Review the key points and practice regularly.`,
          keyPoints: [
            'Review the key definitions',
            'Practice with sample questions',
            'Ask your teacher if you need help',
          ],
          duration: 6000,
        },
      ],
    };
  }

  // Default: whiteboard mode
  return generateGenericWhiteboardLesson(command, subject, classLevel);
}

/**
 * Parse AI-generated lesson JSON from Claude API response.
 * Handles markdown code blocks and validates structure.
 */
export function parseLessonFromAi(
  aiResponse: string,
  mode: string,
  command: string,
  subject: string,
): Lesson {
  // Extract JSON from possible markdown code block
  let jsonStr = aiResponse.trim()
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  try {
    const parsed = JSON.parse(jsonStr)

    if (mode === 'whiteboard' || mode === 'board') {
      // Expect array of steps or { steps: [...] }
      const rawSteps = Array.isArray(parsed) ? parsed : (parsed.steps || parsed)
      return {
        title: parsed.title || command,
        subject: parsed.subject || subject,
        classLevel: parsed.classLevel || parsed.class_level || '',
        mode: 'whiteboard',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        steps: rawSteps.map((s: any) => ({
          action: s.action || 'write',
          content: s.content || '',
          narration: s.narration || s.content || '',
          duration: s.duration || 4000,
          style: s.style,
        })),
      }
    }

    if (mode === 'slideshow' || mode === 'slides') {
      const rawSlides = Array.isArray(parsed) ? parsed : (parsed.slides || parsed)
      return {
        title: parsed.title || command,
        subject: parsed.subject || subject,
        classLevel: parsed.classLevel || parsed.class_level || '',
        mode: 'slideshow',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        slides: rawSlides.map((s: any) => ({
          title: s.title || '',
          body: s.body || '',
          equation: s.equation,
          narration: s.narration || s.body || '',
          bullets: s.bullets,
          duration: s.duration || 5000,
        })),
      }
    }

    if (mode === 'narrated' || mode === 'narrate') {
      const rawSegments = Array.isArray(parsed) ? parsed : (parsed.segments || parsed)
      return {
        title: parsed.title || command,
        subject: parsed.subject || subject,
        classLevel: parsed.classLevel || parsed.class_level || '',
        mode: 'narrated',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        segments: rawSegments.map((s: any) => ({
          visual: s.visual || '',
          narration: s.narration || '',
          keyPoints: s.keyPoints || s.key_points || [],
          highlightTerms: s.highlightTerms || s.highlight_terms,
          duration: s.duration || 6000,
        })),
      }
    }

    // Fallback: try to interpret as whiteboard
    return {
      title: command,
      subject,
      classLevel: '',
      mode: 'whiteboard',
      steps: Array.isArray(parsed) ? parsed : [{ action: 'write' as const, content: jsonStr, narration: jsonStr, duration: 5000 }],
    }
  } catch {
    // If JSON parsing fails, create a single-step lesson with the raw text
    return {
      title: command,
      subject,
      classLevel: '',
      mode: 'whiteboard',
      steps: [
        { action: 'heading', content: command, narration: `Let us learn about ${command}.`, duration: 3000 },
        { action: 'write', content: aiResponse.slice(0, 500), narration: aiResponse.slice(0, 200), duration: 5000 },
      ],
    }
  }
}
