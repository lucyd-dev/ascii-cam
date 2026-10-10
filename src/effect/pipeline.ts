// The effect's pipeline definition: all buffers, static textures and passes
// declared as data. The engine allocates the resources and drives the order.
// Adding a shader step = add a buffer (if needed) + one PassSpec entry here.

import { Pipeline } from '../engine';
import type { FullScreenQuad, SettingsStore } from '../engine';
import dogFrag from './shaders/dog.frag?raw';
import tileFrag from './shaders/tile.frag?raw';
import asciiFrag from './shaders/ascii.frag?raw';
import blurFrag from './shaders/blur.frag?raw';
import compositeFrag from './shaders/composite.frag?raw';

export interface EffectInputs {
	fillAtlas: WebGLTexture;
	edgeAtlas: WebGLTexture;
	videoTexture: WebGLTexture;
}

export interface EffectSize {
	width: number;
	height: number;
}

export function createEffectPipeline(
	gl: WebGL2RenderingContext,
	quad: FullScreenQuad,
	settings: SettingsStore,
	size: EffectSize,
	inputs: EffectInputs,
): Pipeline {
	return new Pipeline(gl, quad, {
		mainSize: size,
		uniforms: settings,
		timing: true, // per-pass GPU timings for the overlay

		textures: [
			{ name: 'video', texture: inputs.videoTexture },
			{ name: 'fillAtlas', texture: inputs.fillAtlas },
			{ name: 'edgeAtlas', texture: inputs.edgeAtlas },
		],

		buffers: [
			// 'r8' = single-channel grayscale (4x less bandwidth); the debug
			// view renders single-channel buffers as gray.
			{ name: 'dog', pingPong: true, format: 'r8' }, // full-res DoG history (EMA)
			{ name: 'tile', scale: 8, filter: gl.NEAREST },
			{ name: 'scene', mipmap: true }, // sharp ASCII composite
			{ name: 'blurH', scale: 4 }, // wide horizontal glow (1/4 res)
			{ name: 'blurV', scale: 4 }, // wide vertical glow (1/4 res)
		],

		passes: [
			{
				name: 'dog',
				frag: dogFrag,
				inputs: { u_video: 'video', u_history: { buffer: 'dog', side: 'src' } },
				output: 'dog',
				swap: ['dog'],
				uniforms: { u_resolution: { size: 'dog' } },
			},
			{
				name: 'tile',
				frag: tileFrag,
				inputs: { u_video: 'video', u_dogTexture: { buffer: 'dog' } },
				output: 'tile',
				uniforms: {
					u_resolution: { size: 'main' },
					u_tileResolution: { size: 'tile' },
				},
			},
			{
				name: 'ascii',
				frag: asciiFrag,
				inputs: {
					u_video: 'video',
					u_fillAtlas: 'fillAtlas',
					u_edgeAtlas: 'edgeAtlas',
					u_tileTexture: 'tile',
				},
				output: 'scene',
				uniforms: {
					u_resolution: { size: 'main' },
					u_tileResolution: { size: 'tile' },
				},
			},
			{
				name: 'blurH',
				frag: blurFrag,
				inputs: { u_source: 'scene' },
				output: 'blurH',
				uniforms: { u_texelSize: { texel: 'blurH' }, u_direction: [1, 0] },
			},
			{
				name: 'blurV',
				frag: blurFrag,
				inputs: { u_source: 'blurH' },
				output: 'blurV',
				uniforms: { u_texelSize: { texel: 'blurV' }, u_direction: [0, 1] },
			},
			{
				name: 'composite',
				frag: compositeFrag,
				inputs: { u_scene: 'scene', u_blur: 'blurV' },
				// no output -> draws to the screen
			},
		],
	});
}
