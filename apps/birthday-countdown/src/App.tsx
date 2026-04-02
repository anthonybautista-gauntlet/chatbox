import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, Birthday } from './types'
import { DEFAULT_STATE } from './types'
import { initBridge, isEmbedded, sendStateUpdate } from './bridge'
import { handleToolInvocation } from './tool-handlers'
import { sortByDaysUntil, getDaysUntil, formatBirthdayDisplay, getAge } from './birthday-utils'
import './styles.css'

type AuthState = 'pending' | 'authed' | 'failed'

export default function App() {
  const [state, setStateRaw] = useState<AppState>(DEFAULT_STATE)
  const stateRef = useRef(state)
  const [authState, setAuthState] = useState<AuthState>(isEmbedded() ? 'pending' : 'authed')
  const [authError, setAuthError] = useState<string | null>(null)

  const setState = useCallback((next: AppState) => {
    stateRef.current = next
    setStateRaw(next)
    if (isEmbedded()) {
      sendStateUpdate(next)
    }
  }, [])

  const [addName, setAddName] = useState('')
  const [addMonth, setAddMonth] = useState('')
  const [addDay, setAddDay] = useState('')
  const [addYear, setAddYear] = useState('')

  useEffect(() => {
    if (!isEmbedded()) return

    const cleanup = initBridge({
      auth: {
        provider: 'google',
        scopes: ['https://www.googleapis.com/auth/calendar'],
      },
      onInit: ({ state: restored }) => {
        if (restored?.birthdays) {
          const merged: AppState = { ...DEFAULT_STATE, ...restored }
          stateRef.current = merged
          setStateRaw(merged)
        }
      },
      onToolInvocation: ({ toolName, args, invocationId }) => {
        handleToolInvocation(
          toolName,
          args,
          invocationId,
          () => stateRef.current,
          setState,
        )
      },
      onAuthResult: ({ success, error }) => {
        setAuthState(success ? 'authed' : 'failed')
        if (!success) setAuthError(error || 'Authorization failed')
      },
    })

    return cleanup
  }, [setState])

  const sorted = sortByDaysUntil(state.birthdays)
  const userBirthdays = sorted.filter((b) => b.isUser)
  const otherBirthdays = sorted.filter((b) => !b.isUser)

  const handleAdd = () => {
    const month = addMonth.padStart(2, '0')
    const day = addDay.padStart(2, '0')
    const mmdd = `${month}-${day}`

    if (!addName.trim() || !month || !day) return
    if (parseInt(month) < 1 || parseInt(month) > 12 || parseInt(day) < 1 || parseInt(day) > 31) return

    const newBirthday: Birthday = {
      id: crypto.randomUUID(),
      name: addName.trim(),
      date: mmdd,
      year: addYear ? parseInt(addYear) : undefined,
    }

    setState({ ...state, birthdays: [...state.birthdays, newBirthday] })
    setAddName('')
    setAddMonth('')
    setAddDay('')
    setAddYear('')
  }

  const handleRemove = (id: string) => {
    setState({ ...state, birthdays: state.birthdays.filter((b) => b.id !== id) })
  }

  if (authState === 'pending') {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>🎂 Birthday Countdown</h1>
          <p className="subtitle">Connecting to Google Calendar…</p>
        </header>
        <div className="empty-state">
          <div className="empty-icon">🔑</div>
          <p>Please authorize Google Calendar access using the button above to continue.</p>
        </div>
      </div>
    )
  }

  if (authState === 'failed') {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1>🎂 Birthday Countdown</h1>
          <p className="subtitle">Authorization failed</p>
        </header>
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <p>{authError || 'Could not connect to Google Calendar. Please try again.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>🎂 Birthday Countdown</h1>
        <p className="subtitle">Never forget a birthday!</p>
      </header>

      <section className="add-section">
        <h2>Add a Birthday</h2>
        <div className="add-form">
          <input
            className="input name-input"
            type="text"
            placeholder="Name"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
          />
          <div className="date-inputs">
            <input
              className="input date-input"
              type="number"
              placeholder="MM"
              min={1}
              max={12}
              value={addMonth}
              onChange={(e) => setAddMonth(e.target.value)}
            />
            <span className="date-sep">/</span>
            <input
              className="input date-input"
              type="number"
              placeholder="DD"
              min={1}
              max={31}
              value={addDay}
              onChange={(e) => setAddDay(e.target.value)}
            />
            <span className="date-sep">/</span>
            <input
              className="input year-input"
              type="number"
              placeholder="Year (optional)"
              value={addYear}
              onChange={(e) => setAddYear(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={handleAdd} disabled={!addName.trim() || !addMonth || !addDay}>
            Add Birthday
          </button>
        </div>
      </section>

      {state.birthdays.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎈</div>
          <p>No birthdays yet! Add one above or ask the chat assistant.</p>
        </div>
      ) : (
        <>
          {userBirthdays.length > 0 && (
            <section className="birthday-section">
              <h2>⭐ Your Birthdays</h2>
              <div className="birthday-list">
                {userBirthdays.map((b) => (
                  <BirthdayCard key={b.id} birthday={b} onRemove={handleRemove} />
                ))}
              </div>
            </section>
          )}

          {otherBirthdays.length > 0 && (
            <section className="birthday-section">
              <h2>🎉 Upcoming Birthdays</h2>
              <div className="birthday-list">
                {otherBirthdays.map((b) => (
                  <BirthdayCard key={b.id} birthday={b} onRemove={handleRemove} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function BirthdayCard({ birthday, onRemove }: { birthday: Birthday; onRemove: (id: string) => void }) {
  const days = getDaysUntil(birthday.date)
  const age = getAge(birthday)
  const isToday = days === 0

  return (
    <div className={`birthday-card ${isToday ? 'birthday-today' : ''}`}>
      <div className="card-main">
        <div className="card-avatar">
          {isToday ? '🎂' : '🎈'}
        </div>
        <div className="card-info">
          <div className="card-name">{birthday.name}</div>
          <div className="card-date">
            {formatBirthdayDisplay(birthday.date)}
            {age !== null && <span className="card-age"> — turning {age}</span>}
          </div>
        </div>
        <div className="card-countdown">
          {isToday ? (
            <div className="countdown-today">Today! 🎉</div>
          ) : (
            <>
              <div className="countdown-number">{days}</div>
              <div className="countdown-label">{days === 1 ? 'day' : 'days'}</div>
            </>
          )}
        </div>
      </div>
      <button className="btn-remove" onClick={() => onRemove(birthday.id)} title="Remove">
        ✕
      </button>
    </div>
  )
}
