/**
 * Lightweight enrichment for chess tool results.
 *
 * LLMs frequently misinterpret PGN when asked "what was my last move?" —
 * they confuse which side played what. We pre-compute a plain-English move
 * description so the LLM can just relay it.
 */

function describeLastMove(
  pgn: string,
  turn: string | undefined,
  playerColor: string | undefined,
): string {
  const moveText = pgn.replace(/\[.*?\]\s*/g, '').replace(/\*\s*$/, '').trim()
  if (!moveText) return ''

  const moves = moveText.split(/\d+\.\s*/).filter(Boolean)
  if (moves.length === 0) return ''

  const lastGroup = moves[moves.length - 1].trim().split(/\s+/)
  const whiteMove = lastGroup[0] || null
  const blackMove = lastGroup.length > 1 ? lastGroup[1] : null

  const lines: string[] = []

  // "turn" indicates who moves NEXT, so the last move was by the OTHER side
  const lastMoverIsWhite = turn === 'black'

  if (lastMoverIsWhite && whiteMove) {
    const isPlayer = playerColor === 'white'
    lines.push(`Last move in game: White played ${whiteMove}${isPlayer ? ' (your move)' : " (opponent's move)"}`)
  } else if (!lastMoverIsWhite && blackMove) {
    const isPlayer = playerColor === 'black'
    lines.push(`Last move in game: Black played ${blackMove}${isPlayer ? ' (your move)' : " (opponent's move)"}`)
  } else if (blackMove) {
    lines.push(`Last move in game: Black played ${blackMove}`)
  } else if (whiteMove) {
    lines.push(`Last move in game: White played ${whiteMove}`)
  }

  if (playerColor) {
    const userPrev = playerColor === 'white' ? whiteMove : blackMove
    if (userPrev) {
      lines.push(`User's (${playerColor}) most recent move: ${userPrev}`)
    }
  }

  return lines.join('\n')
}

export function enrichChessToolResult(result: unknown): unknown {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result

  const r = result as Record<string, unknown>
  const pgn = typeof r.pgn === 'string' ? r.pgn : undefined
  if (!pgn) return result

  try {
    const moveDesc = describeLastMove(
      pgn,
      typeof r.turn === 'string' ? r.turn : undefined,
      typeof r.playerColor === 'string' ? r.playerColor : undefined,
    )

    if (!moveDesc) return result

    return {
      ...r,
      _moveDescription: moveDesc,
    }
  } catch {
    return result
  }
}
