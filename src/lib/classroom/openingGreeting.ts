/** Martha's spoken + displayed opening greeting at session start (no LLM call). */

function timeSalutation(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function buildOpeningGreeting(
  subject: string,
  classLevel: string,
  topic: string,
): string {
  const trimmedTopic = topic.trim()
  const salutation = timeSalutation()
  return (
    `${salutation}, class! I'm Martha, your teacher for today. ` +
    `We're in ${classLevel} ${subject}, and our topic today is ${trimmedTopic}. ` +
    `Watch the board closely — I'll explain step by step. ` +
    `If anything is unclear, just ask. Let's begin!`
  )
}
