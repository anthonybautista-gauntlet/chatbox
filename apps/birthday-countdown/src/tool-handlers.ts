import type { AppState, Birthday } from './types'
import { DEFAULT_STATE } from './types'
import { generateId, getDaysUntil, formatBirthdayDisplay, getAge, sortByDaysUntil } from './birthday-utils'
import { sendToolResult, sendError } from './bridge'

type StateGetter = () => AppState
type StateSetter = (state: AppState) => void

export function handleToolInvocation(
  toolName: string,
  args: Record<string, unknown>,
  invocationId: string,
  getState: StateGetter,
  setState: StateSetter,
) {
  switch (toolName) {
    case 'view_birthdays':
      return handleViewBirthdays(invocationId, getState)
    case 'add_birthday':
      return handleAddBirthday(args, invocationId, getState, setState)
    case 'remove_birthday':
      return handleRemoveBirthday(args, invocationId, getState, setState)
    case 'get_birthdays':
      return handleGetBirthdays(invocationId, getState)
    default:
      sendError(invocationId, `Unknown tool: ${toolName}`, 'unknown_tool')
  }
}

function handleViewBirthdays(invocationId: string, getState: StateGetter) {
  const state = getState()
  const sorted = sortByDaysUntil(state.birthdays)

  const result = {
    status: 'ok',
    count: sorted.length,
    birthdays: sorted.map((b) => ({
      id: b.id,
      name: b.name,
      date: formatBirthdayDisplay(b.date),
      daysUntil: getDaysUntil(b.date),
      turningAge: getAge(b),
      isUser: b.isUser ?? false,
    })),
  }

  sendToolResult(invocationId, result, state)
}

function handleAddBirthday(
  args: Record<string, unknown>,
  invocationId: string,
  getState: StateGetter,
  setState: StateSetter,
) {
  const name = args.name as string | undefined
  const date = args.date as string | undefined
  const year = args.year as number | undefined
  const isUser = args.isUser as boolean | undefined

  if (!name || !date) {
    sendError(invocationId, 'name and date (MM-DD) are required', 'invalid_args')
    return
  }

  if (!/^\d{2}-\d{2}$/.test(date)) {
    sendError(invocationId, 'date must be in MM-DD format', 'invalid_args')
    return
  }

  const state = getState()
  const existing = state.birthdays.find(
    (b) => b.name.toLowerCase() === name.toLowerCase() && b.date === date,
  )
  if (existing) {
    sendToolResult(invocationId, {
      status: 'already_exists',
      birthday: { id: existing.id, name: existing.name, date: formatBirthdayDisplay(existing.date), daysUntil: getDaysUntil(existing.date) },
    }, state)
    return
  }

  const newBirthday: Birthday = {
    id: generateId(),
    name,
    date,
    year: year ?? undefined,
    isUser: isUser ?? false,
  }

  const newState: AppState = {
    ...state,
    birthdays: [...state.birthdays, newBirthday],
  }
  setState(newState)

  sendToolResult(invocationId, {
    status: 'birthday_added',
    birthday: {
      id: newBirthday.id,
      name: newBirthday.name,
      date: formatBirthdayDisplay(newBirthday.date),
      daysUntil: getDaysUntil(newBirthday.date),
      turningAge: getAge(newBirthday),
    },
  }, newState)
}

function handleRemoveBirthday(
  args: Record<string, unknown>,
  invocationId: string,
  getState: StateGetter,
  setState: StateSetter,
) {
  const nameOrId = (args.name as string) || (args.id as string)
  if (!nameOrId) {
    sendError(invocationId, 'name or id is required', 'invalid_args')
    return
  }

  const state = getState()
  const idx = state.birthdays.findIndex(
    (b) => b.id === nameOrId || b.name.toLowerCase() === nameOrId.toLowerCase(),
  )

  if (idx === -1) {
    sendToolResult(invocationId, { status: 'not_found', message: `No birthday found for "${nameOrId}"` }, state)
    return
  }

  const removed = state.birthdays[idx]
  const newState: AppState = {
    ...state,
    birthdays: state.birthdays.filter((_, i) => i !== idx),
  }
  setState(newState)

  sendToolResult(invocationId, {
    status: 'birthday_removed',
    removed: { name: removed.name, date: formatBirthdayDisplay(removed.date) },
  }, newState)
}

function handleGetBirthdays(invocationId: string, getState: StateGetter) {
  const state = getState()
  const sorted = sortByDaysUntil(state.birthdays)

  sendToolResult(invocationId, {
    status: 'ok',
    count: sorted.length,
    birthdays: sorted.map((b) => ({
      id: b.id,
      name: b.name,
      date: formatBirthdayDisplay(b.date),
      rawDate: b.date,
      daysUntil: getDaysUntil(b.date),
      turningAge: getAge(b),
      isUser: b.isUser ?? false,
      year: b.year ?? null,
    })),
  }, state)
}
