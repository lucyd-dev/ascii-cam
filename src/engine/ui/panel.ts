// Engine overlay: the ReShade-style on-screen panel. It combines an FPS
// readout, the generated settings controls, and optional pipeline tools
// (debug output, pass bypass, GPU timings). Mount it with mountEngineOverlay
// (looks up [data-engine-overlay]) or createEngineOverlay(container, ...).

import './panel.css';
import { FpsMeter } from './fps';
import { buildControls } from './controls';
import { createIconButton } from './icons';
import { createDetails } from './details';
import { createTimingsTable, type TimingsTable } from './timings';
import { UiState } from './ui-state';
import { el } from './dom';
import type { SettingsStore } from '../settings/store';
import type { PassTiming } from '../gl/gpu-timer';

// Engine-owned pipeline capabilities the overlay renders. Pipeline implements it.
export interface PipelineControls {
	getBufferNames(): string[];
	getDebugView(): string;
	setDebugView(name: string): void;
	getPassNames(): string[];
	isPassEnabled(name: string): boolean;
	setPassEnabled(name: string, enabled: boolean): void;
	getTimingStats(): ReadonlyMap<string, PassTiming>;
}

export interface EngineOverlayOptions {
	title?: string;
	showFps?: boolean;
	showControls?: boolean;
	showTimings?: boolean;
	showDebugOutput?: boolean;
	showPasses?: boolean;
	showScreenshot?: boolean;
	pipeline?: PipelineControls;
	onScreenshot?: () => void;
	selector?: string;
}

// Wraps one frame; the FPS meter and (with a pipeline) GPU timings update here.
export interface EngineMonitor {
	beginFrame(): number;
	endFrame(): void;
}

export function createEngineOverlay(
	container: HTMLElement,
	settings: SettingsStore,
	options: EngineOverlayOptions = {},
): EngineMonitor {
	const {
		title = 'Engine',
		showFps = true,
		showControls = false,
		showTimings = false,
		showDebugOutput = false,
		showPasses = false,
		showScreenshot = false,
		pipeline,
		onScreenshot,
	} = options;

	container.classList.add('afx-overlay');
	container.innerHTML = '';

	const uiState = new UiState(`${settings.getStorageKey()}.ui`);
	const { header, fpsElement } = createHeader(title, showFps, showScreenshot, onScreenshot);
	container.append(header, el('div', 'afx-separator'));

	if (showDebugOutput && pipeline) container.append(createDebugOutput(pipeline, uiState));
	if (showControls) container.append(createSettings(settings, uiState));
	if (showPasses && pipeline) container.append(createPasses(pipeline, uiState));

	let timings: TimingsTable | null = null;
	if (showTimings) {
		timings = createTimingsTable();
		const details = createDetails('afx-timings', 'GPU passes', uiState, 'timings');
		details.append(timings.element);
		container.append(details);
	}

	const fps = new FpsMeter(showFps ? fpsElement : null);
	return {
		beginFrame: () => fps.beginFrame(),
		endFrame: () => {
			fps.endFrame();
			if (timings && pipeline) timings.update(pipeline.getTimingStats());
		},
	};
}

function createHeader(
	title: string,
	showFps: boolean,
	showScreenshot: boolean,
	onScreenshot?: () => void,
): { header: HTMLElement; fpsElement: HTMLElement } {
	const header = el('div', 'afx-header');
	const main = el('div', 'afx-header-main');
	if (title) main.append(el('div', 'afx-overlay-title', title));

	const fpsElement = el('span', 'afx-fps');
	if (showFps) {
		const row = el('div', 'afx-overlay-row');
		row.append(fpsElement, document.createTextNode(' fps'));
		main.append(row);
	}
	header.append(main);

	if (showScreenshot) {
		const actions = el('div', 'afx-header-actions');
		actions.append(createIconButton('download', 'Save PNG', () => onScreenshot?.()));
		header.append(actions);
	}
	return { header, fpsElement };
}

function createDebugOutput(pipeline: PipelineControls, uiState: UiState): HTMLElement {
	const row = el('div', 'afx-control');
	row.append(el('span', 'afx-control-label', 'Debug Output'));

	const select = el('select');
	const views = [...pipeline.getBufferNames(), 'final'];
	for (const name of views) {
		const option = el('option');
		option.value = name;
		option.textContent = name;
		select.append(option);
	}
	const stored = uiState.getString('debugView', pipeline.getDebugView());
	if (views.includes(stored)) pipeline.setDebugView(stored);
	select.value = pipeline.getDebugView();

	const reset = createIconButton('rotate-ccw', 'Reset Debug Output', () => {
		pipeline.setDebugView('final');
		select.value = 'final';
		uiState.set('debugView', 'final');
		sync();
	});
	function sync(): void {
		reset.disabled = pipeline.getDebugView() === 'final';
	}

	select.addEventListener('change', () => {
		pipeline.setDebugView(select.value);
		uiState.set('debugView', select.value);
		sync();
	});

	row.append(select, reset);
	sync();
	return row;
}

function createSettings(settings: SettingsStore, uiState: UiState): HTMLElement {
	const details = createDetails('afx-settings', 'Settings', uiState, 'settings');
	const controls = el('div', 'afx-controls');
	buildControls(controls, settings, uiState);
	details.append(controls);
	return details;
}

function createPasses(pipeline: PipelineControls, uiState: UiState): HTMLElement {
	const details = createDetails('afx-passes', 'Passes', uiState, 'passes');
	const list = el('div', 'afx-passes-list');
	for (const name of pipeline.getPassNames()) {
		const row = el('label', 'afx-pass');
		const input = el('input');
		input.type = 'checkbox';
		input.checked = pipeline.isPassEnabled(name);
		input.addEventListener('change', () => pipeline.setPassEnabled(name, input.checked));
		row.append(input, el('span', undefined, name));
		list.append(row);
	}
	details.append(list);
	return details;
}

// Mounts the overlay onto an element found via a marker attribute,
// so the HTML only has to contain <div data-engine-overlay></div>.
export function mountEngineOverlay(
	settings: SettingsStore,
	options: EngineOverlayOptions = {},
): EngineMonitor {
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
