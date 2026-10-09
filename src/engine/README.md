# AFX Web Engine

A minimal ReShade-style WebGL2 effect engine: declarative fullscreen passes,
automatic render-target allocation and a settings-driven UI overlay.

## Layout

```
engine/
├── gl/          low-level WebGL (context, programs, textures, framebuffers, quad, bindings)
├── pass/        fullscreen pass primitive + ping-pong + present
├── pipeline/    declarative frame-graph (buffers, textures, passes, auto units)
├── settings/    parameter schema + persisted settings store
└── ui/          optional overlay (FPS + controls), mountable via HTML or TS
```

## Quick start

```ts
const gl = createGLContext(canvas);
const quad = new FullScreenQuad(gl);
const settings = new SettingsStore(PARAMS, 'app.settings');

const pipeline = new Pipeline(gl, quad, {
	mainSize: { width: 1920, height: 1080 },
	uniforms: settings, // pushes UI values into the shaders
	textures: [{ name: 'src', texture }],
	buffers: [{ name: 'out' }],
	passes: [
		{
			frag: myShaderSource,
			inputs: { u_source: 'src' },
			output: 'out',
		},
	],
});

// per frame
pipeline.draw();
```

## What the pipeline does for you

- **Allocates** every declared buffer (size from `width`/`height` or `scale`).
- **Assigns texture units** automatically for every input.
- **Binds outputs** with feedback-loop protection (detaches the target texture
  from all units before drawing into it).
- **Applies static uniforms**: `number`, `[x, y]`, `{ size: 'buffer' }` →
  `(w, h)`, `{ texel: 'buffer' }` → `(1/w, 1/h)`.
- **Swaps ping-pong buffers** after a pass (`swap: ['name']`); read the
  previous frame with `{ buffer: 'name', side: 'src' }`.
- **Debug inspect**: `pipeline.present('bufferName')` draws one buffer to the
  screen for inspection.

## Adding a new shader

1. Write `myshader.frag`.
2. Add a `buffer` (if it needs an offscreen target) and a `pass` entry in the
   effect's pipeline definition.
3. Add any tunable uniform to the settings schema — a control appears in the
   overlay automatically and its value is persisted.

## Overlay

```html
<div data-engine-overlay></div>
```

```ts
const fps = mountEngineOverlay(settings, { title: 'My Effect' });
// per frame: fps.beginFrame(); ...; fps.endFrame();
```

Or mount programmatically with `createEngineOverlay(container, settings, opts)`.
Theme it by overriding the `--afx-*` CSS custom properties.
