import type { Tab } from './DataProvider.tsx'

export const TABS: { id: Tab; label: string; tone: string }[] = [
  { id: 'decisions', label: '決定', tone: 'blue' },
  { id: 'questions', label: '質問', tone: 'orange' },
  { id: 'ideas', label: 'アイデア', tone: 'purple' },
  { id: 'minutes', label: '議事録', tone: 'green' },
]
