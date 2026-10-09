# AGENTS.md

Vite + TypeScript WebGL2 app that turns a webcam feed into ASCII art. Not a git
repo; no CI, tests, or linter.

## Commands

- `npm run dev` — Vite dev server (needs `http://localhost` for camera access).
- `npm run build` — `tsc && vite build`. This is the only real verification step.
- `npx tsc` — typecheck only (tsconfig is already `noEmit`).
- `npm run format` — Prettier, but only matches `src/**/*.ts`. Shaders, CSS and
  HTML are not formatted by it.

## Architecture

Two layers, deliberately separated:

- `src/engine/` — reusable "AFX Web Engine": a ReShade-style declarative WebGL2
  frame-graph. Public API is the barrel `src/engine/index.ts`; read
  `src/engine/README.md` before touching it. Import from `'../engine'`, never
  from deep paths outside this folder.
- `src/effect/` — this project's ASCII effect: `renderer.ts` (facade + video
  texture), `camera.ts` (device capture), `pipeline.ts` (declarative passes),
  `schema.ts` (parameters), `settings.ts` (singleton store), `shaders/*.frag`.

Adding or changing an effect step touches three places:
1. `src/effect/shaders/<name>.frag`
2. a `buffer` (if it needs a target) + one `passes` entry in `src/effect/pipeline.ts`
3. the tunable uniform in `src/effect/schema.ts`

Every `schema.ts` entry becomes a UI control and is auto-applied as a
same-named GLSL uniform. `settings.ts` persists to localStorage under
`ascii-cam.settings`; there is no other persistence layer.

## WebGL quirks (easy to get wrong)

- Pipeline model: passes are data. `output` omitted draws to screen; ping-pong
  buffers swap *after* all passes, so read the previous frame via
  `{ buffer, side: 'src' }`. See `pipeline.ts` comments.
- Every image upload is flipped via `UNPACK_FLIP_Y_WEBGL`; shaders assume that.
- Shaders are GLSL ES 3.00 (`#version 300 es`) and imported with Vite `?raw`
  (typed through the `vite/client` types in tsconfig).
- Render/canvas size and camera resolution are hardcoded 1920x1080 in
  `renderer.ts`/`main.ts`. The render loop uses `requestVideoFrameCallback`, not
  rAF.
- Atlas textures are static files in `public/` (`fillASCII.png`, `edgesASCII.png`)
  served from web root. `startCamera` prefers a device labeled
  `droidcam source 2` and otherwise uses the first video input.

## Code style / TS constraints

- Prettier config is non-default: tabs, `singleQuote`, `trailingComma: all`,
  `printWidth: 100`, LF. Match it. Note effect shaders currently use spaces.
- tsconfig is strict about a few non-obvious things: `verbatimModuleSyntax`
  (use `import type` / `export type` for types), `erasableSyntaxOnly` (no
  enums, namespaces, or constructor parameter properties), and
  `noUnusedLocals` / `noUnusedParameters`.
