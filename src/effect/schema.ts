// The effect's parameter schema. This file is the project-side config:
// every entry becomes a UI control whose value drives a uniform (same name).
// Adding a control = add one entry here + declare the uniform in the shader.

import type { SchemaParam } from '../engine';

export const PARAMS: SchemaParam[] = [
	{
		key: 'u_monochromic',
		label: 'Monochrome',
		kind: 'toggle',
		default: true,
	},
	{
		key: 'u_glowStrength',
		label: 'Glow',
		kind: 'range',
		default: 0.5,
		min: 0,
		max: 2,
		step: 0.05,
	},
	{
		// NOTE: lower = stronger temporal smoothing (less noise/flicker, more
		// ghosting). The label reads inverted relative to its value.
		key: 'u_emaAlpha',
		label: 'Anti-Flicker',
		kind: 'range',
		default: 0.45,
		min: 0.05,
		max: 1,
		step: 0.05,
	},
	{
		key: 'u_ditherStrength',
		label: 'Dither',
		kind: 'range',
		default: 0.6,
		min: 0,
		max: 1,
		step: 0.05,
	},
	{
		key: 'u_edgeThreshold',
		label: 'Edge Sensitivity',
		kind: 'range',
		default: 0.12,
		min: 0.0,
		max: 0.5,
		step: 0.01,
	},
	{
		key: 'u_minEdgeVotes',
		label: 'Edge Votes',
		kind: 'range',
		default: 0.85,
		min: 0,
		max: 3,
		step: 0.05,
	},
	{
		key: 'u_dogGain',
		label: 'Edge Gain',
		kind: 'range',
		default: 8,
		min: 0,
		max: 12,
		step: 0.25,
	},
];
