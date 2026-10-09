// Builds the controls UI for a settings store, straight from its schema.
// Each control reads its initial value from the store (default or persisted)
// and writes changes back through `settings.set`, which persists them.
// A reset button restores defaults and rebuilds the controls.

import type { SettingsStore } from '../settings/store';

export function buildControls(container: HTMLElement, settings: SettingsStore): void {
	container.innerHTML = ''; // makes re-building (e.g. after reset) safe

	for (const p of settings.getParameters()) {
		const row = document.createElement('div');
		row.className = 'afx-control';

		const label = document.createElement('span');
		label.className = 'afx-control-label';
		label.textContent = p.label;

		if (p.kind === 'toggle') {
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.checked = Boolean(settings.get(p.key));
			input.addEventListener('input', () => {
				settings.set(p.key, input.checked);
			});
			row.append(label, input);
		} else if (p.kind === 'select') {
			const select = document.createElement('select');
			for (const option of p.options ?? []) {
				const el = document.createElement('option');
				el.value = option.value;
				el.textContent = option.label;
				select.appendChild(el);
			}
			select.value = String(settings.get(p.key));
			select.addEventListener('change', () => {
				settings.set(p.key, select.value);
			});
			row.append(label, select);
		} else {
			const input = document.createElement('input');
			input.type = 'range';
			input.min = String(p.min ?? 0);
			input.max = String(p.max ?? 1);
			input.step = String(p.step ?? 0.01);
			input.value = String(settings.get(p.key));

			const readout = document.createElement('span');
			readout.className = 'afx-control-value';
			const show = () => (readout.textContent = Number(input.value).toFixed(2));
			show();

			input.addEventListener('input', () => {
				settings.set(p.key, parseFloat(input.value));
				show();
			});
			row.append(label, input, readout);
		}

		container.appendChild(row);
	}

	const reset = document.createElement('button');
	reset.type = 'button';
	reset.className = 'afx-reset';
	reset.textContent = 'Reset';
	reset.addEventListener('click', () => {
		settings.reset();
		buildControls(container, settings);
	});
	container.appendChild(reset);
}
