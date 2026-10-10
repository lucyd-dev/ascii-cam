// Color-ramp presets for the monochrome glyph path. Each palette provides the
// four stops the ascii shader mixes between (bg -> shadow -> mid -> highlight).
// Values stay desaturated and mid-luminance so they don't strain the eye.

export type Rgb = readonly [number, number, number];

export interface Palette {
	name: string;
	label: string;
	bg: Rgb;
	shadow: Rgb;
	mid: Rgb;
	highlight: Rgb;
}

export const PALETTES: readonly Palette[] = [
	{
		name: 'mono',
		label: 'Mono',
		bg: [0.05, 0.05, 0.06],
		shadow: [0.18, 0.18, 0.2],
		mid: [0.5, 0.5, 0.52],
		highlight: [0.92, 0.92, 0.9],
	},
	{
		name: 'amber',
		label: 'Amber',
		bg: [0.07, 0.05, 0.03],
		shadow: [0.22, 0.13, 0.05],
		mid: [0.62, 0.4, 0.14],
		highlight: [0.98, 0.85, 0.6],
	},
	{
		name: 'matrix',
		label: 'Matrix',
		bg: [0.02, 0.06, 0.03],
		shadow: [0.05, 0.2, 0.09],
		mid: [0.2, 0.6, 0.28],
		highlight: [0.7, 0.95, 0.72],
	},
	{
		name: 'ice',
		label: 'Ice',
		bg: [0.03, 0.06, 0.1],
		shadow: [0.06, 0.16, 0.28],
		mid: [0.25, 0.55, 0.72],
		highlight: [0.8, 0.94, 1.0],
	},
	{
		name: 'magma',
		label: 'Magma',
		bg: [0.08, 0.03, 0.03],
		shadow: [0.25, 0.07, 0.04],
		mid: [0.68, 0.25, 0.1],
		highlight: [1.0, 0.8, 0.55],
	},
	{
		name: 'purple',
		label: 'Purple',
		bg: [0.06, 0.05, 0.09],
		shadow: [0.1, 0.06, 0.22],
		mid: [0.47, 0.33, 0.62],
		highlight: [1.0, 0.84, 0.84],
	},
	{
		name: 'cyberpunk',
		label: 'Cyberpunk',
		bg: [0.04, 0.03, 0.07],
		shadow: [0.28, 0.02, 0.24],
		mid: [0.0, 0.7, 0.92],
		highlight: [0.99, 0.87, 0.22],
	},
];
