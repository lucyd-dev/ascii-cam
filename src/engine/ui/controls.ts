// Builds the controls UI for a settings store, straight from its schema.
// Each control reads its initial value from the store (default or persisted)
// and writes changes back through `settings.set`, which persists them.
// Every row has its own reset icon; a global reset lives in the overlay header.

import type { SettingsStore } from '../settings/store';
import { createIconButton, iconHtml } from './icons';

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
				el.textContent = option.label ?? option.value;
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

		row.append(
			createIconButton('rotate-ccw', `Reset ${p.label}`, () => {
				settings.resetKey(p.key);
				buildControls(container, settings);
			}),
		);

		container.appendChild(row);
	}

	const resetAll = document.createElement('button');
	resetAll.type = 'button';
	resetAll.className = 'afx-reset-all';
	resetAll.title = 'Reset all settings';
	resetAll.innerHTML = iconHtml('refresh-ccw');
	const label = document.createElement('span');
	label.textContent = 'Reset All';
	resetAll.append(label);
	resetAll.addEventListener('click', () => {
		settings.reset();
		buildControls(container, settings);
	});
	container.appendChild(resetAll);
}
