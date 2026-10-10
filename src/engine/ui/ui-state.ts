// Persisted, engine-generic UI preferences: dropdown open/close flags, the
// selected debug output, and similar view state. Kept separate from the
// parameter schema so UI preferences never leak into uniform application.

export type UiStateValue = boolean | string;

export class UiState {
	private values: Record<string, UiStateValue>;
	private storageKey: string;

	constructor(storageKey: string) {
		this.storageKey = storageKey;
		this.values = JSON.parse(localStorage.getItem(storageKey) ?? '{}');
	}

	getBool(key: string, fallback: boolean): boolean {
		const value = this.values[key];
		return typeof value === 'boolean' ? value : fallback;
	}

	getString(key: string, fallback: string): string {
		const value = this.values[key];
		return typeof value === 'string' ? value : fallback;
	}

	set(key: string, value: UiStateValue): void {
		this.values[key] = value;
		localStorage.setItem(this.storageKey, JSON.stringify(this.values));
	}
}
