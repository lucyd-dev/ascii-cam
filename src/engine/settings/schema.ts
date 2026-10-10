// Parameter schema: the contract between an effect's uniforms, the settings
// store, and the generated UI controls. An effect declares its parameters
// once; the engine derives values, persistence, uniforms and the panel from it.

export type ParamKind = 'range' | 'toggle' | 'select';

export interface ParamOption {
	value: string;
	/** Display text; falls back to `value` when omitted. */
	label?: string;
}

export interface SchemaParam {
	key: string;
	label: string;
	kind: ParamKind;
	default: number | boolean | string;
	min?: number;
	max?: number;
	step?: number;
	options?: ParamOption[];
}

// A labelled group of parameters. Every parameter belongs to exactly one
// category; the UI renders one collapsible dropdown per category.
export interface SchemaCategory {
	label: string;
	params: SchemaParam[];
}

export type SettingsValue = number | boolean | string;
