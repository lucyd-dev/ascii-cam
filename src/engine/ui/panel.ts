// Engine overlay: the ReShade-style on-screen panel. It combines an FPS
// readout, the generated shader settings, project-specific "General" content
// and optional pipeline debug tools. Mount it with mountEngineOverlay (looks up
// [data-engine-overlay]) or createEngineOverlay(container, ...).

import './panel.css';
import { FpsMeter } from './fps';
import { buildControls } from './controls';
import { createIconButton } from './icons';
import { createDetails } from './details';
import { createTimingsTable, type TimingsTable } from './timings';
import { UiState } from './ui-state';
import { el } from './dom';
import { downloadCanvasPng } from '../gl/capture';
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
	/** Shader settings dropdown plus the "Save PNG" header button. */
	showControls?: boolean;
	/** Debug tools: debug output, pass bypass and GPU timings. */
	showDebug?: boolean;
	/** Content for the engine's "General" dropdown. */
	general?: HTMLElement | HTMLElement[];
	pipeline?: PipelineControls;
	/** Canvas captured by the header's "Save PNG" button. */
	canvas?: HTMLCanvasElement;
	/** Overrides the built-in canvas capture. */
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
		showDebug = false,
		pipeline,
		general,
		canvas,
		onScreenshot,
	} = options;

	container.classList.add('afx-overlay');
	container.innerHTML = '';

	const uiState = new UiState(`${settings.getStorageKey()}.ui`);
	const capture =
		onScreenshot ??
		(canvas
			? () =>
					downloadCanvasPng(
						canvas,
						screenshotName(title, pipeline?.getDebugView() ?? 'final'),
					)
			: undefined);
	const { header, fpsElement } = createHeader(title, showFps, showControls, capture);
	container.append(header, el('div', 'afx-separator'));

	if (general) container.append(createSection('General', 'general', general, uiState));
	if (showControls) container.append(createSettings(settings, uiState));

	let timings: TimingsTable | null = null;
	if (showDebug && pipeline) {
		const body = el('div', 'afx-section-content');
		body.append(createDebugOutput(pipeline, uiState));
		body.append(createSection('Passes', 'passes', createPassesList(pipeline), uiState));
		timings = createTimingsTable();
		body.append(createSection('GPU passes', 'timings', timings.element, uiState));

		const debug = createDetails('afx-section', 'Debug', uiState, 'debug');
		debug.append(body);
		container.append(debug);
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

	if (showScreenshot && onScreenshot) {
		const actions = el('div', 'afx-header-actions');
		actions.append(createIconButton('download', 'Save PNG', onScreenshot));
		header.append(actions);
	}
	return { header, fpsElement };
}

function createSection(
	label: string,
	key: string,
	content: HTMLElement | HTMLElement[],
	uiState: UiState,
): HTMLElement {
	const details = createDetails('afx-section', label, uiState, key);
	const body = el('div', 'afx-section-content');
	body.append(...(Array.isArray(content) ? content : [content]));
	details.append(body);
	return details;
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
	const details = createDetails('afx-settings', 'Shader Settings', uiState, 'settings');
	const controls = el('div', 'afx-controls');
	buildControls(controls, settings, uiState);
	details.append(controls);
	return details;
}

function createPassesList(pipeline: PipelineControls): HTMLElement {
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
	return list;
}

function screenshotName(title: string, view: string): string {
	const slug =
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '') || 'screenshot';
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${String(now.getFullYear()).slice(-2)}`;
	const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	return `${slug}-${view}-${date}-${time}.png`;
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
