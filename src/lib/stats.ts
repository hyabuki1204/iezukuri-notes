import type { AppData } from '../storage/types.ts'

export function headerStats(data: AppData) {
  return {
    undecided: data.decisions.filter((item) => item.status <= 1).length,
    undrawn: data.decisions.filter((item) => item.status >= 2 && !item.drawn)
      .length,
    openQuestions: data.questions.filter((item) => !item.done).length,
  }
}
