import { parseExtractedJson, extractedFieldsHaveContent } from '../src/lib/extractMinute.ts'

const fenced = parseExtractedJson(`
\`\`\`json
{
  "decided": "・ペニンシュラ確定\\n形状は図面反映済",
  "myTodo": "1. グラフテクトと比較",
  "theirTodo": "排水勾配を出す",
  "pending": "",
  "newq": "変更締切はいつか"
}
\`\`\`
`)

if (!fenced) throw new Error('fenced json should parse')
if (fenced.decided !== 'ペニンシュラ確定\n形状は図面反映済') {
  throw new Error(`decided lines: ${JSON.stringify(fenced.decided)}`)
}
if (fenced.myTodo !== 'グラフテクトと比較') throw new Error('bullet strip failed')
if (fenced.pending !== '') throw new Error('empty pending')
if (!extractedFieldsHaveContent(fenced)) throw new Error('should have content')
if (parseExtractedJson('not json')) throw new Error('invalid should be null')
if (extractedFieldsHaveContent({
  decided: '',
  myTodo: '  ',
  theirTodo: '',
  pending: '',
  newq: '',
})) {
  throw new Error('whitespace is not content')
}

console.log('extract parser ok')
