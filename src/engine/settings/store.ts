// Generic, framework-agnostic settings store.
// The engine only knows HOW to store/persist/apply values; WHICH parameters
// exist is defined by the effect's schema. Values come from the schema's
// defaults, are overlaid with localStorage, and are pushed into any program
// that declares the matching uniform.

import type { SchemaParam, SettingsValue } from './schema';
import type { UniformApplier } from '../pass/pass';

export class SettingsStore implements UniformApplier {
	private values: Record<string, SettingsValue> = {};
	private locations = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
	private params: SchemaParam[];
	private storageKey: string;

	constructor(params: SchemaParam[], storageKey: string) {
		this.params = params;
		this.storageKey = storageKey;
		const stored = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
		for (const p of params) {
			this.values[p.key] = p.key in stored ? stored[p.key] : p.default;
		}
	}

	getParameters(): readonly SchemaParam[] {
		return this.params;
	}

	get(key: string): SettingsValue | undefined {
		return this.values[key];
	}

	set(key: string, value: SettingsValue): void {
		this.values[key] = value;
		localStorage.setItem(this.storageKey, JSON.stringify(this.values));
	}

	reset(): void {
		localStorage.removeItem(this.storageKey);
		for (const p of this.params) {
			this.values[p.key] = p.default;
		}
	}

	applyTo(gl: WebGL2RenderingContext, program: WebGLProgram): void {
		gl.useProgram(program);
		let locs = this.locations.get(program);
		if (!locs) {
			locs = new Map();
			this.locations.set(program, locs);
		}
		for (const p of this.params) {
			let loc = locs.get(p.key);
			if (loc === undefined) {
				loc = gl.getUniformLocation(program, p.key);
				locs.set(p.key, loc);
			}
			if (loc === null) continue;

			const value = this.values[p.key];
			if (typeof value === 'string') continue; // not a uniform (e.g. debugView)

			if (typeof value === 'boolean') gl.uniform1i(loc, value ? 1 : 0);
			else gl.uniform1f(loc, value);
		}
	}
}
