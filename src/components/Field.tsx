import type { TextareaHTMLAttributes, SelectHTMLAttributes, InputHTMLAttributes } from 'react'

const box =
  'w-full rounded-sm border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-green'

export function TextField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input className={box} {...props} />
    </label>
  )
}

export function TextArea({
  label,
  ...props
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <textarea className={`${box} min-h-24`} {...props} />
    </label>
  )
}

export function SelectField({
  label,
  children,
  ...props
}: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <select className={box} {...props}>
        {children}
      </select>
    </label>
  )
}
