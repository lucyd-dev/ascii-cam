# AGENTS.md

Vite + TypeScript WebGL2 app that turns a webcam feed into ASCII art. Git repo
(pushed to GitHub); no CI, tests, or linter.

## Commands

- `npm run dev` — Vite dev server (needs `http://localhost` for camera access).
  `vite.config.ts` enables `server.watch.usePolling` because the project lives on
  `/mnt/c` under WSL and edited from Windows tools.
- `npm run build` — `tsc && vite build`. This is the only real verification step.
  The build inlines JS, CSS and assets into a single self-contained
  `dist/index.html` (vite-plugin-singlefile + `base: './'`) so it runs from
  `file://`, e.g. as an OBS browser source.
- `npx tsc` — typecheck only (tsconfig is already `noEmit`).
- `npm run format` — Prettier over `src/**/*.ts`; shaders, CSS and HTML are not
  formatted. The shell glob only reaches one directory level, so pass explicit
  paths for nested files (e.g. `src/engine/ui/*.ts`).

## Architecture

Two layers, deliberately separated:

- `src/engine/` — reusable "AFX Web Engine": a ReShade-style declarative WebGL2
  frame-graph. Public API is the barrel `src/engine/index.ts`; read
  `src/engine/README.md` before touching it. Import from `'../engine'`, never
  from deep paths outside this folder.
- `src/effect/` — this project's ASCII effect: `renderer.ts` (facade + video
  texture), `camera.ts` (device capture), `camera-picker.ts` (selection modal +
  monitor selector), `pipeline.ts` (declarative passes), `schema.ts` (parameter
  categories), `palettes.ts` (ramp presets), `settings.ts` (singleton store),
  `shaders/*.frag`.

Adding or changing an effect step touches three places:
1. `src/effect/shaders/<name>.frag`
2. a `buffer` (if it needs a target) + one `passes` entry in `src/effect/pipeline.ts`
3. the param in a category in `src/effect/schema.ts`

`src/effect/schema.ts` exports `CATEGORIES: SchemaCategory[]` (`{ label, params }`);
every param belongs to a category, becomes a UI control under that category's
dropdown, and is auto-applied as a same-named GLSL uniform. An optional
`description` shows as a label tooltip. Values persist to localStorage under
`ascii-cam.settings`; UI view state (dropdown open/closed, selected debug output)
persists under `ascii-cam.settings.ui` via `engine/ui/ui-state.ts`.

## WebGL quirks (easy to get wrong)

- Pipeline model: passes are data. `output` omitted draws to screen; ping-pong
  buffers swap *after* all passes, so read the previous frame via
  `{ buffer, side: 'src' }`. See `pipeline.ts` comments.
- `PipelineOptions.uniforms` accepts one applier or an array; the effect passes
  `[settings, PaletteUniforms]`, so the palette select resolves to vec3 ramp
  uniforms without any ASCII-specific engine hook.
- Every image upload is flipped via `UNPACK_FLIP_Y_WEBGL`; shaders assume that.
- Shaders are GLSL ES 3.00 (`#version 300 es`) and imported with Vite `?raw`
  (typed through the `vite/client` types in tsconfig).
- Camera capture is requested at 1920x1080 (`main.ts`); the effect renders at the
  webcam resolution and the canvas is only displayed scaled to the window at
  devicePixelRatio (mipmaps prevent minification aliasing). The render loop uses
  `requestVideoFrameCallback`, not rAF.
- Camera choice (`main.ts`): `?camera=<label|index|deviceId>` in the URL wins,
  then the stored choice (`ascii-cam.camera` in localStorage), then the
  `pickCamera` modal; `?camera=pick` forces the modal. A given source starts
  directly, so only one `getUserMedia` (one permission prompt) runs; devices are
  enumerated afterwards (labels need permission) for the "General" dropdown
  selector (`general` option) that switches live. Engine debug tools are gated
  by `showDebug`; Debug Output, Passes and GPU passes are nested dropdowns under
  a single "Debug" dropdown. The overlay handles the "Save PNG" button itself
  from the `canvas` option.
- Atlas textures live in `src/effect/assets/` (`fillASCII.png`, `edgesASCII.png`)
  and are imported in `main.ts` so the build inlines them as `data:` URIs (a
  `file://` image would otherwise taint the WebGL texture).

## Code style / TS constraints

- Prettier config is non-default: tabs, `singleQuote`, `trailingComma: all`,
  `printWidth: 100`, LF. Match it. Note effect shaders currently use spaces.
- tsconfig is strict about a few non-obvious things: `verbatimModuleSyntax`
  (use `import type` / `export type` for types), `erasableSyntaxOnly` (no
  enums, namespaces, or constructor parameter properties), and
  `noUnusedLocals` / `noUnusedParameters`.
