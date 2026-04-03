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
        'Open or show the chess board UI. ALWAYS use this tool when the user says "open chess", "show the board", "play chess", "let me see the game", or any request to display the chess interface. Do NOT pass playerColor or difficulty unless the user explicitly states a preference. If a game is already in progress it will be resumed automatically. This is the ONLY tool that opens the visual chess board. If the status is "existing_game_resumed", do NOT ask about color or difficulty — the game is already configured.',
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
          fen: { type: 'string', description: 'FEN string of current position.' },
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
        'Read-only query that returns the current chess game state WITHOUT opening the board UI. Use this ONLY for answering questions about the game position, giving move advice, or analysis. This does NOT open or show the chess board — use start_game for that. Never rely on previously fetched state — the user may have made moves since then. The response includes a _moveDescription field with accurate last-move attribution — always use it instead of trying to parse the PGN yourself. Do NOT render an ASCII chess board — the user already has the visual board.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          fen: { type: 'string', description: 'FEN string of the current board position.' },
          pgn: {
            type: 'string',
            description:
              'PGN move history. Use this to determine each player\'s moves. Odd-numbered moves (1., 2., 3...) are White\'s, the response after each is Black\'s.',
          },
          gameStatus: { type: 'string', description: '"in_progress", "checkmate", "stalemate", or "draw".' },
          turn: {
            type: 'string',
            description: '"white" or "black" — whose turn it is NOW (i.e. who moves next).',
          },
          playerColor: {
            type: 'string',
            description: 'The color the human user is playing as ("white" or "black").',
          },
          difficulty: { type: 'string' },
          moveCount: {
            type: 'number',
            description: 'Total number of full moves played so far.',
          },
          isCheck: { type: 'boolean' },
          lastMoveUci: {
            type: 'string',
            description:
              'The last move made in the game in UCI format (e.g. "e2e4"). This is the most recent move by EITHER player — not necessarily the human\'s move. To find the human\'s last move, check the PGN: if playerColor is "white", look at White\'s last numbered move; if "black", look at Black\'s last reply.',
          },
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
        'Resign the current game on behalf of the player. This is a DESTRUCTIVE and IRREVERSIBLE action — only use when the user explicitly says "resign", "forfeit", or "I give up". NEVER call this for ambiguous phrases like "draw" (which may mean sketching on the Drawing Canvas) or "quit" (which may mean closing the board). When in doubt, ask the user to confirm before resigning.',
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

export const canvasAppManifest: AppManifest = {
  id: 'canvas',
  name: 'Drawing Canvas',
  version: '0.1.0',
  description:
    'A bundled drawing canvas for sketching and illustration. When the user says "draw", "sketch", "paint", "doodle", or "I want to draw", this app is almost always what they mean — not a chess draw.',
  type: 'internal',
  url: '/apps/canvas/index.html',
  permissions: [],
  completionSignals: [],
  tools: [
    {
      name: 'open_canvas',
      description:
        'Open the drawing canvas for sketching, painting, or illustration. Use this when the user says "draw", "sketch", "paint", "doodle", "open canvas", or "I want to draw". If a previous drawing exists it will be resumed automatically.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['canvas_opened', 'canvas_resumed'],
          },
          commandCount: { type: 'number' },
          canvasWidth: { type: 'number' },
          canvasHeight: { type: 'number' },
        },
        required: ['status'],
      },
      uiTrigger: true,
      timeoutMs: 30_000,
    },
    {
      name: 'draw_on_canvas',
      description:
        'Draw shapes and paths on the canvas. The canvas uses a 600x400 coordinate system. Each command is rendered in order. The canvas opens automatically if not already open.',
      parameters: {
        type: 'object',
        properties: {
          commands: {
            type: 'array',
            description: 'Drawing commands executed in order.',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['line', 'rect', 'circle', 'ellipse', 'path', 'text'],
                },
                x: {
                  type: 'number',
                  description: 'X position for rect and text commands.',
                },
                y: {
                  type: 'number',
                  description: 'Y position for rect and text commands.',
                },
                x1: {
                  type: 'number',
                  description: 'Start X for line commands.',
                },
                y1: {
                  type: 'number',
                  description: 'Start Y for line commands.',
                },
                x2: {
                  type: 'number',
                  description: 'End X for line commands.',
                },
                y2: {
                  type: 'number',
                  description: 'End Y for line commands.',
                },
                cx: {
                  type: 'number',
                  description: 'Center X for circle and ellipse commands.',
                },
                cy: {
                  type: 'number',
                  description: 'Center Y for circle and ellipse commands.',
                },
                radius: {
                  type: 'number',
                  description: 'Radius for circle commands.',
                },
                rx: {
                  type: 'number',
                  description: 'Horizontal radius for ellipse commands.',
                },
                ry: {
                  type: 'number',
                  description: 'Vertical radius for ellipse commands.',
                },
                width: {
                  type: 'number',
                  description: 'Width for rect commands.',
                },
                height: {
                  type: 'number',
                  description: 'Height for rect commands.',
                },
                points: {
                  type: 'array',
                  description: 'Array of [x, y] points for path commands.',
                  items: {
                    type: 'array',
                    items: {
                      type: 'number',
                    },
                  },
                },
                text: {
                  type: 'string',
                  description: 'Text content for text commands.',
                },
                fontSize: {
                  type: 'number',
                  description: 'Font size in pixels for text commands. Defaults to 16.',
                },
                color: {
                  type: 'string',
                  description: 'Hex color string. Defaults to #000000.',
                },
                fill: {
                  type: 'boolean',
                  description: 'Whether the shape should be filled. Defaults to false.',
                },
                lineWidth: {
                  type: 'number',
                  description: 'Stroke width in pixels. Defaults to 2.',
                },
              },
              required: ['type'],
            },
          },
        },
        required: ['commands'],
      },
      returns: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          commandsExecuted: { type: 'number' },
        },
        required: ['status', 'commandsExecuted'],
      },
      uiTrigger: false,
      timeoutMs: 30_000,
    },
    {
      name: 'get_canvas_state',
      description:
        'Return metadata about the current canvas. ALWAYS call this before commenting on or analyzing the drawing. The canvas opens automatically if not already open.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          commandCount: { type: 'number' },
          colorsUsed: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          canvasWidth: { type: 'number' },
          canvasHeight: { type: 'number' },
          recentCommands: {
            type: 'array',
            items: {
              type: 'object',
            },
          },
        },
        required: ['commandCount', 'canvasWidth', 'canvasHeight'],
      },
      uiTrigger: false,
      timeoutMs: 30_000,
    },
    {
      name: 'reset_canvas',
      description: 'Clear the canvas completely. Use when the user wants to start over.',
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
      name: 'save_image',
      description:
        'Save the current canvas as a PNG image. Trigger a browser download and return a confirmation, not the image data itself.',
      parameters: {
        type: 'object',
        properties: {
          filename: {
            type: 'string',
            description: 'Download filename. Defaults to canvas.png.',
          },
        },
        required: [],
      },
      returns: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          filename: { type: 'string' },
        },
        required: ['status'],
      },
      uiTrigger: false,
      timeoutMs: 30_000,
    },
  ],
}

export const defaultApps: AppManifest[] = [chessAppManifest, canvasAppManifest]
