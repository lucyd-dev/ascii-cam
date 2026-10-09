// Engine overlay: the ReShade-style on-screen panel.
// It combines an FPS readout and the generated settings controls, and can be
// mounted either via TypeScript (createEngineOverlay) or with a marker
// element in the HTML (mountEngineOverlay looks up [data-engine-overlay]).

import './panel.css';
import { FpsMeter } from './fps';
import { buildControls } from './controls';
import type { SettingsStore } from '../settings/store';

export interface EngineOverlayOptions {
	title?: string;
	showFps?: boolean;
	showControls?: boolean;
	selector?: string; // container selector used by mountEngineOverlay
}

export function createEngineOverlay(
	container: HTMLElement,
	settings: SettingsStore,
	options: EngineOverlayOptions = {},
): FpsMeter {
	const { title = 'Engine', showFps = true, showControls = false } = options;

	container.classList.add('afx-overlay');
	container.innerHTML = '';

	if (title) {
		const el = document.createElement('div');
		el.className = 'afx-overlay-title';
		el.textContent = title;
		container.append(el);
	}

	const fpsElement = document.createElement('span');
	fpsElement.className = 'afx-fps';
	if (showFps) {
		const row = document.createElement('div');
		row.className = 'afx-overlay-row';
		row.append(fpsElement, document.createTextNode(' fps'));
		container.append(row);
	}

	if (showControls) {
		const controls = document.createElement('div');
		controls.className = 'afx-controls';
		buildControls(controls, settings);
		container.append(controls);
	}

	return new FpsMeter(showFps ? fpsElement : null);
}

// Mounts the overlay onto an element found via a marker attribute,
// so the HTML only has to contain <div data-engine-overlay></div>.
export function mountEngineOverlay(
	settings: SettingsStore,
	options: EngineOverlayOptions = {},
): FpsMeter {
	const selector = options.selector ?? '[data-engine-overlay]';
	const container = document.querySelector<HTMLElement>(selector);
	if (!container) {
		throw new Error(
			`Engine overlay: no container found for selector "${selector}". ` +
				'Add <div data-engine-overlay></div> to your HTML or use createEngineOverlay().',
		);
	}
	return createEngineOverlay(container, settings, options);
}
