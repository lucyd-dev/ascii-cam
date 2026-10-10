# ASCII Cam

Turns your webcam feed into live ASCII art in the browser. It runs entirely on
the GPU with a small, declarative WebGL2 effect engine, written in TypeScript and
built with Vite.

## Features

### ASCII Effect

- **Live conversion:** every webcam frame becomes a grid of glyphs in real time.
- **Edge-aware glyphs:** a Difference-of-Gaussians pass marks edge cells and swaps
  in directional line glyphs, while flat cells use a brightness ramp of fill glyphs.
- **Temporal smoothing:** a motion-adaptive EMA removes flicker on still areas
  without ghosting moving edges.
- **Color palettes:** choose from several ramp presets (mono, amber,
  matrix, ice, magma, purple, cyberpunk).
- **Bloom glow:** a soft bright-pass adds a CRT-style phosphor bleed on highlights.

### WebGL Engine

- **Declarative frame graph:** buffers, textures and passes are plain data; the
  engine allocates the render targets, assigns texture units automatically and
  walks the pass order (see `src/engine/README.md`).
- **Automatic buffers:** sized by scale or absolute pixels, optional `r8`
  grayscale targets, NEAREST filtering for pixel data and mipmap chains rebuilt
  after every write.
- **Ping-pong history:** temporal feedback for effects like the EMA, with swaps
  handled after the frame and selectable `src` / `dst` sides.
- **Flexible uniforms:** static uniforms accept numbers, 1 to 4 component vectors
  and `{ size }` / `{ texel }` buffer references, and multiple uniform appliers can
  be chained per pass.
- **Fail-fast validation:** inputs, outputs and swaps are checked on construction,
  and shader compile errors are labelled with the pass name.
- **Settings and panel:** a schema generates grouped, collapsible controls with
  per-option reset and hover descriptions, auto-applies same-named uniforms, and
  persists both values and panel state to `localStorage`.
- **Debug tooling:** debug buffer selection, per-pass bypass, GPU timings
  (`EXT_disjoint_timer_query_webgl2`) and PNG capture.

## Getting Started

```bash
npm install
npm run dev
```

Open the printed `localhost` URL and allow camera access when prompted.

> [!NOTE]
> Camera access needs a secure context. Use the `localhost` URL from the dev
> server rather than a network IP.

## Build

```bash
npm run build
```

Outputs a production bundle to `dist/`. The same command runs the TypeScript type
check (`tsc`).

## Project Structure

The code is split into two layers:

- `src/engine/` - a reusable declarative WebGL2 frame-graph. Buffers and passes
  are plain data; the engine allocates render targets, assigns texture units and
  walks the pass order. See `src/engine/README.md`.
- `src/effect/` - the ASCII effect built on top: shaders, the pass pipeline,
  palette presets and the settings schema.

## License
This project is licensed under the MIT License - see the [LICENSE](https://github.com/lucyd-dev/LucydDeck/blob/main/LICENSE.md) file for details.

`Made with 💜 by Lucyd | 2026`
