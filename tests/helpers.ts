import { emptyAppData, type AppData, type Decision, type Minute, type Question } from '../src/storage/types.ts'

export function decision(partial: Partial<Decision> = {}): Decision {
  return {
    id: 'd1',
    cat: 'キッチン',
    title: '食洗機',
    body: '深型',
    status: 0,
    drawn: false,
    updatedAt: '2026-10-01T00:00:00.000Z',
    attachments: [],
    who: '自分',
    ...partial,
  }
}

export function question(partial: Partial<Question> = {}): Question {
  return { id: 'q1', to: '営業', text: '締切はいつ？', answer: '', done: false, attachments: [], who: '自分', ...partial }
}

export function minute(partial: Partial<Minute> = {}): Minute {
  return {
    id: 'm1',
    date: '2026-10-25',
    theme: '外構',
    raw: '',
    decided: '',
    myTodo: '',
    theirTodo: '',
    pending: '',
    newq: '',
    attachments: [],
    sentDecided: [],
    sentNewq: [],
    doneTodos: [],
    who: '自分',
    ...partial,
  }
}

export function appData(partial: Partial<AppData> = {}): AppData {
  return { ...emptyAppData(), ...partial }
}

export const file = (id: string) => ({
  id,
  name: `${id}.jpg`,
  mime: 'image/jpeg',
  size: 1,
  path: `p/${id}.jpg`,
  createdAt: '2026-10-01T00:00:00.000Z',
})
