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

export const canvasAppManifest: AppManifest = {
  id: 'canvas',
  name: 'Drawing Canvas',
  version: '0.1.0',
  description:
    'A bundled drawing canvas that supports freehand user drawing and structured drawing commands from the assistant.',
  type: 'internal',
  url: '/apps/canvas/index.html',
  permissions: [],
  completionSignals: [],
  tools: [
    {
      name: 'open_canvas',
      description:
        'Open the drawing canvas. If a previous drawing exists it will be resumed automatically. Do NOT call this before draw_on_canvas because the canvas opens automatically for any tool.',
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
