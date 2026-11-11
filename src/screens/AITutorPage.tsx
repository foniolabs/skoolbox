import { useState, useCallback } from 'react';
import { Bot, ChevronRight } from 'lucide-react';
import ChatContainer from '../components/ai-tutor/ChatContainer';
import ChatInput from '../components/ai-tutor/ChatInput';
import ContextPanel from '../components/ai-tutor/ContextPanel';
import { useChatStore } from '../stores/useChatStore';

const mockResponses = [
  `Great question! Let me break this down step by step...

**Step 1:** First, identify what we're working with.
**Step 2:** Apply the core concept.
**Step 3:** Verify your answer.

Does that make sense? Feel free to ask me to explain any step further!`,

  `That's a really important concept in Mathematics. Here's how I'd explain it:

Think of it like building blocks. Each new idea builds on the previous one.

- Start with the basics
- Practice with simple examples
- Then try harder problems

Would you like me to give you a practice problem?`,

  `Great effort! Let me help you with that.

**The key idea** is to understand *why* the rule works, not just memorize it.

For example, when solving **2x + 4 = 10**:
- Subtract 4 from both sides: **2x = 6**
- Divide both sides by 2: **x = 3**

Want to try a similar problem on your own?`,

  `That's a fantastic question about English!

When writing an essay, remember the **PEEL** structure:
- **P**oint - State your main idea
- **E**vidence - Provide supporting details
- **E**xplanation - Explain how the evidence supports your point
- **L**ink - Connect back to the main topic

Shall I help you practice with a topic?`,

  `Let me explain that concept clearly.

**Photosynthesis** is the process plants use to convert sunlight into food.

Here's the simple formula:
- Sunlight + Water + Carbon Dioxide = Glucose + Oxygen

Think of it like a recipe - the plant takes ingredients (water and CO2) and uses sunlight as energy to cook up food (glucose)!

Would you like to explore this topic further?`,

  `Excellent thinking! Here's a helpful study tip:

**The Pomodoro Technique** works great for studying:
- Study for 25 minutes
- Take a 5-minute break
- After 4 rounds, take a longer 15-minute break

This helps your brain absorb information more effectively. Your brain needs rest to process what you've learned!

What subject are you studying for?`,

  `Let me walk you through fractions step by step.

To add **1/3 + 1/4**, you need a common denominator:
- **Step 1:** Find the LCD (Least Common Denominator) = 12
- **Step 2:** Convert: 1/3 = 4/12 and 1/4 = 3/12
- **Step 3:** Add the numerators: 4/12 + 3/12 = **7/12**

The answer is **7/12**. Would you like to try another fraction problem?`,

  `That's a great topic to explore!

In **Grammar**, understanding sentence structure is key:
- **Subject** - Who or what the sentence is about
- **Verb** - The action or state
- **Object** - What receives the action

For example: "The cat (subject) chased (verb) the mouse (object)."

Want me to give you some practice sentences to identify?`,
];

export default function AITutorPage() {
  const { messages, isTyping, addMessage, setTyping, currentSubject, setContext } =
    useChatStore();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSend = useCallback(
    (content: string) => {
      addMessage('user', content);
      setTyping(true);

      setTimeout(() => {
        const responseIndex = messages.length % mockResponses.length;
        addMessage('assistant', mockResponses[responseIndex]);
        setTyping(false);
      }, 1500);
    },
    [addMessage, setTyping, messages.length]
  );

  const handleTopicSelect = useCallback(
    (topic: string) => {
      handleSend(`Can you help me understand ${topic}?`);
      setDrawerOpen(false);
    },
    [handleSend]
  );

  const handleSubjectChange = useCallback(
    (subject: string) => {
      setContext(subject || null, null);
    },
    [setContext]
  );

  const handleLevelChange = useCallback(() => {
    // Level is stored for context but not used for mock responses
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-gray-200 rounded-t-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">AI Tutor</h1>
            <p className="text-xs text-text-muted">Always ready to help you learn</p>
          </div>
        </div>

        {/* Mobile drawer toggle */}
        <button
          onClick={() => setDrawerOpen(!drawerOpen)}
          className="md:hidden flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-lg"
        >
          Options
          <ChevronRight
            className={`w-4 h-4 transition-transform duration-200 ${
              drawerOpen ? 'rotate-90' : ''
            }`}
          />
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Chat area */}
        <div className="flex flex-col flex-1 md:w-[70%]">
          <ChatContainer messages={messages} isTyping={isTyping} />
          <ChatInput onSend={handleSend} disabled={isTyping} />
        </div>

        {/* Context panel - desktop */}
        <div className="hidden md:block w-[30%] border-l border-gray-200">
          <ContextPanel
            onTopicSelect={handleTopicSelect}
            currentSubject={currentSubject}
            onSubjectChange={handleSubjectChange}
            onLevelChange={handleLevelChange}
          />
        </div>

        {/* Context panel - mobile drawer */}
        {drawerOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 bg-black/30 z-40"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="md:hidden fixed right-0 top-0 bottom-0 w-[80%] max-w-sm z-50 shadow-xl">
              <ContextPanel
                onTopicSelect={handleTopicSelect}
                currentSubject={currentSubject}
                onSubjectChange={handleSubjectChange}
                onLevelChange={handleLevelChange}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
