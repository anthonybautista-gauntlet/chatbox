export interface Birthday {
  id: string
  name: string
  date: string // MM-DD format
  year?: number // birth year if known
  isUser?: boolean
  calendarEventId?: string
}

export interface AppState {
  birthdays: Birthday[]
  lastSynced?: string
}

export const DEFAULT_STATE: AppState = {
  birthdays: [],
}
