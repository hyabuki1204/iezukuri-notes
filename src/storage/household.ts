export const HOUSEHOLD_KEY = 'iezukuri-notes:household'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function readHouseholdId(): string | null {
  const value = localStorage.getItem(HOUSEHOLD_KEY)
  return value && isHouseholdId(value) ? value : null
}

export function writeHouseholdId(id: string): void {
  localStorage.setItem(HOUSEHOLD_KEY, id)
}

export function clearHouseholdId(): void {
  localStorage.removeItem(HOUSEHOLD_KEY)
}

export function isHouseholdId(value: string): boolean {
  return UUID.test(value.trim())
}
