// The effect's pipeline definition: all buffers, static textures and passes
// declared as data. The engine allocates the resources and drives the order.
// Adding a shader step = add a buffer (if needed) + one PassSpec entry here.

import { Pipeline } from '../engine';
import type { FullScreenQuad, SettingsStore, UniformApplier } from '../engine';
import { PALETTES, type Rgb } from './palettes';
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

// Turns the selected palette name into the four ramp colors the ascii shader
// expects. The select value itself never becomes a uniform: this applier looks
// it up and uploads the colors. Programs without those uniforms resolve to a
// null location, so the calls are harmless no-ops for every other pass.
class PaletteUniforms implements UniformApplier {
	private settings: SettingsStore;
	private locations = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();

	constructor(settings: SettingsStore) {
		this.settings = settings;
	}

	applyTo(gl: WebGL2RenderingContext, program: WebGLProgram): void {
		const selected = this.settings.get('u_palette');
		const palette = PALETTES.find((p) => p.name === selected) ?? PALETTES[0];
		gl.useProgram(program);
		this.setColor(gl, program, 'u_paletteBg', palette.bg);
		this.setColor(gl, program, 'u_paletteShadow', palette.shadow);
		this.setColor(gl, program, 'u_paletteMid', palette.mid);
		this.setColor(gl, program, 'u_paletteHighlight', palette.highlight);
	}

	private setColor(
		gl: WebGL2RenderingContext,
		program: WebGLProgram,
		name: string,
		value: Rgb,
	): void {
		const loc = this.location(gl, program, name);
		if (loc) gl.uniform3f(loc, value[0], value[1], value[2]);
	}

	private location(
		gl: WebGL2RenderingContext,
		program: WebGLProgram,
		name: string,
	): WebGLUniformLocation | null {
		let locs = this.locations.get(program);
		if (!locs) {
			locs = new Map();
			this.locations.set(program, locs);
		}
		let loc = locs.get(name);
		if (loc === undefined) {
			loc = gl.getUniformLocation(program, name);
			locs.set(name, loc);
		}
		return loc;
	}
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
		uniforms: [settings, new PaletteUniforms(settings)],
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
