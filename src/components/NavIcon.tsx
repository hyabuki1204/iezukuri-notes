import type { Tab } from '../app/DataProvider.tsx'

export function NavIcon({
  id,
  className = 'h-5 w-5',
}: {
  id: Tab
  className?: string
}) {
  if (id === 'decisions') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 11.5 11 13.5 15.5 9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="4.5"
          y="3.5"
          width="15"
          height="17"
          rx="2.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
      </svg>
    )
  }
  if (id === 'questions') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M6 18.5 5 21l3.2-1.2A8.5 8.5 0 1 0 6 18.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9.8 10.2c.3-1.2 1.3-1.9 2.5-1.9 1.3 0 2.3.8 2.3 2.1 0 1.5-1.4 1.8-2.1 2.5-.4.4-.5.8-.5 1.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="12.2" cy="16.2" r=".8" fill="currentColor" />
      </svg>
    )
  }
  if (id === 'ideas') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9.5 17h5M10 19.5h4M12 4.5a5.5 5.5 0 0 1 3.2 10c-.7.5-1.2 1.2-1.2 2v.5h-4v-.5c0-.8-.5-1.5-1.2-2A5.5 5.5 0 0 1 12 4.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  if (id === 'minutes') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v13l-3-1.5-3 1.5-3-1.5-3 1.5V6A1.5 1.5 0 0 1 7 4.5Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M9 9h6M9 12.5h6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    )
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 6.5h14v13H5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 4.5v4M16 4.5v4M8 12h8M8 15.5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}
