import { differenceInDays, format, parse, setYear, isValid } from 'date-fns'
import type { Birthday } from './types'

export function parseDateString(dateStr: string): Date | null {
  // Accept MM-DD or YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const d = parse(dateStr, 'yyyy-MM-dd', new Date())
    return isValid(d) ? d : null
  }
  if (/^\d{2}-\d{2}$/.test(dateStr)) {
    const d = parse(dateStr, 'MM-dd', new Date())
    return isValid(d) ? d : null
  }
  return null
}

export function getNextOccurrence(mmdd: string): Date {
  const now = new Date()
  const currentYear = now.getFullYear()

  const thisYear = parse(`${currentYear}-${mmdd}`, 'yyyy-MM-dd', new Date())
  if (isValid(thisYear) && thisYear >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
    return thisYear
  }

  return setYear(thisYear, currentYear + 1)
}

export function getDaysUntil(mmdd: string): number {
  const next = getNextOccurrence(mmdd)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return differenceInDays(next, today)
}

export function formatBirthdayDisplay(mmdd: string): string {
  const d = parse(mmdd, 'MM-dd', new Date())
  return isValid(d) ? format(d, 'MMMM d') : mmdd
}

export function getAge(birthday: Birthday): number | null {
  if (!birthday.year) return null
  const now = new Date()
  const nextOcc = getNextOccurrence(birthday.date)
  const upcomingYear = nextOcc.getFullYear()
  const age = upcomingYear - birthday.year
  return age > 0 ? age : null
}

export function sortByDaysUntil(birthdays: Birthday[]): Birthday[] {
  return [...birthdays].sort((a, b) => getDaysUntil(a.date) - getDaysUntil(b.date))
}

export function generateId(): string {
  return crypto.randomUUID()
}
