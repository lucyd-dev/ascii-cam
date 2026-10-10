// Builds the controls UI for a settings store, straight from its schema.
// Every schema category becomes a collapsible dropdown; the rows inside read
// their initial value from the store (default or persisted) and write changes
// back through `settings.set`, which persists them. Per-row and global reset
// buttons are enabled only while a value differs from its default.

import type { SettingsStore } from '../settings/store';
import type { SchemaParam, SettingsValue } from '../settings/schema';
import type { UiState } from './ui-state';
import { createDetails } from './details';
import { createIconButton, iconHtml } from './icons';

export function buildControls(
	container: HTMLElement,
	settings: SettingsStore,
	uiState?: UiState,
): void {
	container.innerHTML = ''; // makes re-building (e.g. after reset) safe

	const rebind = () => buildControls(container, settings, uiState);
	let refreshGlobal: () => void = () => {};

	const buildRow = (p: SchemaParam): HTMLDivElement => {
		const row = document.createElement('div');
		row.className = 'afx-control';

		const label = document.createElement('span');
		label.className = 'afx-control-label';
		label.textContent = p.label;
		if (p.description) label.title = p.description;

		const reset = createIconButton('rotate-ccw', `Reset ${p.label}`, () => {
			settings.resetKey(p.key);
			rebind();
		});
		const syncReset = () => (reset.disabled = settings.isDefault(p.key));

		const onChange = (value: SettingsValue) => {
			settings.set(p.key, value);
			syncReset();
			refreshGlobal();
		};

		if (p.kind === 'toggle') {
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.checked = Boolean(settings.get(p.key));
			input.addEventListener('input', () => onChange(input.checked));
			row.append(label, input);
		} else if (p.kind === 'select') {
			const select = document.createElement('select');
			for (const option of p.options ?? []) {
				const el = document.createElement('option');
				el.value = option.value;
				el.textContent = option.label ?? option.value;
				select.append(el);
			}
			select.value = String(settings.get(p.key));
			select.addEventListener('change', () => onChange(select.value));
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
				onChange(parseFloat(input.value));
				show();
			});
			row.append(label, input, readout);
		}

		syncReset();
		row.append(reset);
		return row;
	};

	for (const category of settings.getCategories()) {
		const details = createDetails(
			'afx-group',
			category.label,
			uiState,
			`group:${category.label}`,
		);

		const body = document.createElement('div');
		body.className = 'afx-group-controls';
		for (const p of category.params) body.append(buildRow(p));
		details.append(body);
		container.append(details);
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
		rebind();
	});
	container.append(resetAll);

	refreshGlobal = () => {
		resetAll.disabled = settings.getParameters().every((p) => settings.isDefault(p.key));
	};
	refreshGlobal();
}
