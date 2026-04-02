import type { AppManifest } from '@shared/types'

export const chessAppManifest: AppManifest = {
  id: 'chess',
  name: 'Chat Chess',
  version: '0.1.0',
  description:
    'Interactive chess against a local computer opponent. Use it when the user wants to play chess or discuss an active chess game.',
  type: 'internal',
  url: 'https://chat-chess-ecru.vercel.app',
  permissions: [],
  completionSignals: ['checkmate', 'stalemate', 'draw', 'resignation'],
  tools: [
    {
      name: 'start_game',
      description:
        'Open the chess board. Do NOT pass playerColor or difficulty unless the user explicitly states a preference. The app has its own selection UI. If a game is already in progress it will be resumed automatically.',
      parameters: {
        type: 'object',
        properties: {
          playerColor: {
            type: 'string',
            enum: ['white', 'black', 'random'],
            description: 'Which color the human player wants to play.',
          },
          difficulty: {
            type: 'string',
            enum: ['easy', 'medium', 'hard'],
            description: 'Computer difficulty level.',
          },
        },
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['new_game_started', 'existing_game_resumed'] },
          playerColor: { type: 'string' },
          difficulty: { type: 'string' },
          fen: { type: 'string' },
          moveCount: { type: 'number' },
          gameStatus: { type: 'string' },
        },
        required: ['status', 'playerColor', 'difficulty', 'fen'],
      },
      uiTrigger: true,
      timeoutMs: 30_000,
    },
    {
      name: 'get_game_state',
      description:
        'Return the current chess game state. ALWAYS call this before giving move advice, analysis, or answering questions about the position. Never rely on previously fetched state — the user may have made moves since then.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          fen: { type: 'string' },
          pgn: { type: 'string' },
          gameStatus: { type: 'string' },
          turn: { type: 'string' },
          playerColor: { type: 'string' },
          difficulty: { type: 'string' },
          moveCount: { type: 'number' },
          isCheck: { type: 'boolean' },
          lastMove: { type: 'string' },
        },
        required: ['fen', 'pgn', 'gameStatus', 'turn', 'playerColor', 'difficulty', 'moveCount'],
      },
      uiTrigger: false,
      timeoutMs: 30_000,
    },
    {
      name: 'reset_game',
      description:
        'Reset the current game and return to the setup screen. Use when the user wants to start over or play a new game.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          status: { type: 'string' },
        },
        required: ['status'],
      },
      uiTrigger: false,
      timeoutMs: 30_000,
    },
    {
      name: 'resign_game',
      description:
        'Resign the current game on behalf of the player. Only use when the user explicitly asks to resign or give up.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          winner: { type: 'string' },
        },
        required: ['status'],
      },
      uiTrigger: false,
      timeoutMs: 30_000,
    },
  ],
}

export const defaultApps: AppManifest[] = [chessAppManifest]
