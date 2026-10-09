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

		textures: [
			{ name: 'video', texture: inputs.videoTexture },
			{ name: 'fillAtlas', texture: inputs.fillAtlas },
			{ name: 'edgeAtlas', texture: inputs.edgeAtlas },
		],

		buffers: [
			{ name: 'dog', pingPong: true }, // full-res DoG history (EMA)
			{ name: 'tile', width: size.width / 8, height: size.height / 8, filter: gl.NEAREST },
			{ name: 'scene' }, // sharp ASCII composite
			{ name: 'blurH', scale: 4 }, // wide horizontal glow (1/4 res)
			{ name: 'blurV', scale: 4 }, // wide vertical glow (1/4 res)
		],

		passes: [
			{
				frag: dogFrag,
				inputs: { u_video: 'video', u_history: { buffer: 'dog', side: 'src' } },
				output: 'dog',
				swap: ['dog'],
				uniforms: { u_resolution: { size: 'dog' } },
			},
			{
				frag: tileFrag,
				inputs: { u_video: 'video', u_dogTexture: { buffer: 'dog' } },
				output: 'tile',
				uniforms: {
					u_resolution: { size: 'main' },
					u_tileResolution: { size: 'tile' },
				},
			},
			{
				frag: asciiFrag,
				inputs: {
					u_video: 'video',
					u_fillAtlas: 'fillAtlas',
					u_edgeAtlas: 'edgeAtlas',
					u_tileTexture: 'tile',
				},
				output: 'scene',
				uniforms: { u_resolution: { size: 'main' } },
			},
			{
				frag: blurFrag,
				inputs: { u_source: 'scene' },
				output: 'blurH',
				uniforms: { u_texelSize: { texel: 'blurH' }, u_direction: [1, 0] },
			},
			{
				frag: blurFrag,
				inputs: { u_source: 'blurH' },
				output: 'blurV',
				uniforms: { u_texelSize: { texel: 'blurV' }, u_direction: [0, 1] },
			},
			{
				frag: compositeFrag,
				inputs: { u_scene: 'scene', u_blur: 'blurV' },
				// no output -> draws to the screen
			},
		],
	});
}
