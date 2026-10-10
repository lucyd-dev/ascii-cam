// =============================================================
//  AFX Web Engine - public API
//  A minimal ReShade-style WebGL2 effect engine.
//
//  Layers:
//    gl/        low-level WebGL resources (context, programs, textures, ...)
//    pass/      fullscreen pass primitives
//    pipeline/  declarative frame-graph (buffers + passes + auto units)
//    settings/  parameter schema + persisted settings store
//    ui/        optional overlay (FPS + controls), mountable via HTML or TS
// =============================================================

// ---- gl ----
export { createGLContext } from './gl/context';
export type { GLContextOptions } from './gl/context';
export { createShader, createProgram } from './gl/program';
export { loadTexture } from './gl/texture';
export { createRenderTarget } from './gl/framebuffer';
export type { RenderTarget, TextureFormat } from './gl/framebuffer';
export { FullScreenQuad } from './gl/quad';
export { bindTexture, unbindTextureEverywhere } from './gl/binding';
export { downloadCanvasPng } from './gl/capture';
export { GpuTimer } from './gl/gpu-timer';
export type { PassTiming } from './gl/gpu-timer';

// ---- pass ----
export { Pass } from './pass/pass';
export type { UniformApplier } from './pass/pass';
export { PingPong } from './pass/ping-pong';
export { PresentPass } from './pass/present-pass';

// ---- pipeline ----
export { Pipeline } from './pipeline/pipeline';
export type {
	PipelineOptions,
	PassSpec,
	BufferSpec,
	BufferRef,
	TextureSpec,
	UniformValue,
	UniformSizeRef,
	MainSize,
	BufferSide,
} from './pipeline/pipeline';

// ---- settings ----
export { SettingsStore } from './settings/store';
export type { SchemaParam, ParamKind, ParamOption, SettingsValue } from './settings/schema';

// ---- ui ----
export { FpsMeter } from './ui/fps';
export { createEngineOverlay, mountEngineOverlay } from './ui/panel';
export type { EngineOverlayOptions, EngineMonitor, PipelineControls } from './ui/panel';
