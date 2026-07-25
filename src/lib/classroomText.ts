import type { LessonNote } from './tauri/commands'

/** Trigger a plain-text download (lesson notes, summaries) — works offline in the webview. */
export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function lessonNoteToText(note: LessonNote): string {
  const sec = (title: string, items: string[]) =>
    `${title}\n${items.map((i, n) => `  ${n + 1}. ${i}`).join('\n')}`
  return [
    note.title.toUpperCase(),
    sec('OBJECTIVES — by the end of the lesson, pupils should be able to:', note.objectives),
    sec('KEY POINTS', note.key_points),
    sec('WORKED EXAMPLES', note.examples),
    sec('HOMEWORK', note.homework),
  ].join('\n\n')
}
