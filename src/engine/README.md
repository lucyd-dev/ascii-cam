# AFX Web Engine

A minimal ReShade-style WebGL2 effect engine: declarative fullscreen passes,
automatic render-target allocation and a settings-driven UI overlay.

## Layout

```
engine/
├── gl/          low-level WebGL (context, programs, textures, framebuffers,
│                quad, bindings, GPU timer, PNG capture)
├── pass/        fullscreen pass primitive + ping-pong + present
├── pipeline/    declarative frame-graph (buffers, textures, passes, auto units,
│                debug output, pass bypass, GPU timing)
├── settings/    parameter schema + persisted settings store
└── ui/          optional overlay (FPS, settings, passes, timings), HTML or TS
```

## Quick start

```ts
const gl = createGLContext(canvas);
const quad = new FullScreenQuad(gl);
const settings = new SettingsStore(PARAMS, 'app.settings');

const pipeline = new Pipeline(gl, quad, {
	mainSize: { width: 1920, height: 1080 },
	uniforms: settings, // pushes UI values into the shaders
	timing: true, // per-pass GPU timings
	textures: [{ name: 'src', texture }],
	buffers: [
		{ name: 'out' },
		{ name: 'mask', format: 'r8' }, // single-channel: 4x less bandwidth
		{ name: 'history', pingPong: true }, // temporal feedback
	],
	passes: [
		{ name: 'blur', frag: blurSrc, inputs: { u_source: 'src' }, output: 'out' },
	],
});

// per frame
pipeline.draw();
```

## What the pipeline does for you

- **Allocates** every declared buffer (size from `width`/`height` or `scale`;
  `format: 'r8'` for grayscale, `filter: gl.NEAREST` for pixel data).
- **Assigns texture units** automatically for every input.
- **Binds outputs** with feedback-loop protection (detaches the target texture
  from all units before drawing into it).
- **Applies static uniforms**: `number`, `[x]`, `[x, y]`, `[x, y, z]`,
  `[x, y, z, w]`, `{ size: 'buffer' }` → `(w, h)`, `{ texel: 'buffer' }` →
  `(1/w, 1/h)`.
- **Swaps ping-pong buffers** after a pass (`swap: ['name']`); read the previous
  frame with `{ buffer: 'name', side: 'src' }`.
- **Validates** inputs/outputs/swaps at construction and labels shader compile
  errors with the pass name (or `pass[i]`).
- **Debug output**: `getBufferNames()` + `getDebugView()`/`setDebugView(name)`;
  the selected buffer is presented on screen after `draw()` (`'final'` = result).
- **Pass bypass**: `getPassNames()`, `isPassEnabled()`, `setPassEnabled(name, on)`.
- **GPU timing**: with `timing: true`, `getTimingStats()` returns rolling
  avg/min/max (ms) per pass via `EXT_disjoint_timer_query_webgl2`.

## Adding a new shader

1. Write `myshader.frag`.
2. Add a `buffer` (if it needs an offscreen target) and a `pass` entry in the
   effect's pipeline definition.
3. Add any tunable uniform to the settings schema — a control appears in the
   overlay automatically (each row has its own reset) and the value persists.

## Overlay

```html
<div data-engine-overlay></div>
```

```ts
const monitor = mountEngineOverlay(settings, {
	title: 'My Effect',
	showControls: true, // schema params, collapsed under "Settings"
	showDebugOutput: true, // engine buffer selector (needs `pipeline`)
	showPasses: true, // per-pass enable toggles
	showTimings: true, // GPU pass timings
	showScreenshot: true, // "Save PNG" header button
	pipeline, // Pipeline (or anything matching PipelineControls)
	onScreenshot: () => downloadCanvasPng(canvas),
});
// per frame: monitor.beginFrame(); ...; monitor.endFrame();
```

Or mount programmatically with `createEngineOverlay(container, settings, opts)`.
Theme it by overriding the `--afx-*` CSS custom properties.
