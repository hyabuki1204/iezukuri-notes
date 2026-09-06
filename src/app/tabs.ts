import type { Tab } from './DataProvider.tsx'

export const TABS: { id: Tab; label: string }[] = [
  { id: 'decisions', label: '決定' },
  { id: 'questions', label: '質問' },
  { id: 'ideas', label: 'アイデア' },
  { id: 'minutes', label: '議事録' },
]
