// Engine overlay: the ReShade-style on-screen panel.
// It combines an FPS readout and the generated settings controls, and can be
// mounted either via TypeScript (createEngineOverlay) or with a marker
// element in the HTML (mountEngineOverlay looks up [data-engine-overlay]).

import './panel.css';
import { FpsMeter } from './fps';
import { buildControls } from './controls';
import { createIconButton } from './icons';
import type { SettingsStore } from '../settings/store';
import type { PassTiming } from '../gl/gpu-timer';

// Engine-owned pipeline controls the overlay can render: debug output
// selection, per-pass bypass and GPU timings. Pipeline implements this struct.
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
	/** Engine-owned debug output (buffer) selector, built from the pipeline. */
	showDebugOutput?: boolean;
	/** Engine-owned per-pass enable/disable toggles. */
	showPasses?: boolean;
	/** "Save PNG" header icon; fires onScreenshot when clicked. */
	showScreenshot?: boolean;
	/** Pipeline to query for debug buffers / passes / timings. */
	pipeline?: PipelineControls;
	onScreenshot?: () => void;
	selector?: string; // container selector used by mountEngineOverlay
}

// The handle returned by the overlay factories. beginFrame/endFrame wrap one
// frame; the FPS meter and (if a pipeline is provided) the GPU timings are
// updated automatically.
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

	const header = document.createElement('div');
	header.className = 'afx-header';

	const main = document.createElement('div');
	main.className = 'afx-header-main';
	if (title) {
		const el = document.createElement('div');
		el.className = 'afx-overlay-title';
		el.textContent = title;
		main.append(el);
	}
	const fpsElement = document.createElement('span');
	fpsElement.className = 'afx-fps';
	if (showFps) {
		const row = document.createElement('div');
		row.className = 'afx-overlay-row';
		row.append(fpsElement, document.createTextNode(' fps'));
		main.append(row);
	}
	header.append(main);

	if (showScreenshot) {
		const actions = document.createElement('div');
		actions.className = 'afx-header-actions';
		actions.append(createIconButton('download', 'Save PNG', () => onScreenshot?.()));
		header.append(actions);
	}
	container.append(header);

	// ---- settings (collapsed by default) ----
	if (showControls) {
		const details = document.createElement('details');
		details.className = 'afx-settings';
		const summary = document.createElement('summary');
		summary.textContent = 'Settings';
		details.append(summary);

		const controls = document.createElement('div');
		controls.className = 'afx-controls';
		buildControls(controls, settings);
		details.append(controls);
		container.append(details);
	}

	// ---- debug output ----
	if (showDebugOutput && pipeline) {
		const row = document.createElement('div');
		row.className = 'afx-control';
		const label = document.createElement('span');
		label.className = 'afx-control-label';
		label.textContent = 'Debug Output';
		const select = document.createElement('select');
		for (const name of [...pipeline.getBufferNames(), 'final']) {
			const option = document.createElement('option');
			option.value = name;
			option.textContent = name;
			select.append(option);
		}
		select.value = pipeline.getDebugView();
		select.addEventListener('change', () => pipeline.setDebugView(select.value));
		row.append(label, select);
		row.append(
			createIconButton('rotate-ccw', 'Reset Debug Output', () => {
				pipeline.setDebugView('final');
				select.value = 'final';
			}),
		);
		container.append(row);
	}

	if ((showPasses && pipeline) || showTimings) {
		const separator = document.createElement('div');
		separator.className = 'afx-separator';
		container.append(separator);
	}

	if (showPasses && pipeline) {
		const details = document.createElement('details');
		details.className = 'afx-passes';
		const summary = document.createElement('summary');
		summary.textContent = 'Passes';
		details.append(summary);

		const list = document.createElement('div');
		list.className = 'afx-passes-list';
		for (const name of pipeline.getPassNames()) {
			const row = document.createElement('label');
			row.className = 'afx-pass';
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.checked = pipeline.isPassEnabled(name);
			input.addEventListener('change', () => pipeline.setPassEnabled(name, input.checked));
			const text = document.createElement('span');
			text.textContent = name;
			row.append(input, text);
			list.append(row);
		}
		details.append(list);
		container.append(details);
	}

	let timingList: HTMLElement | null = null;
	const timingRows = new Map<string, { avg: HTMLElement; range: HTMLElement }>();
	let latestStats: ReadonlyMap<string, PassTiming> = new Map();

	if (showTimings) {
		const details = document.createElement('details');
		details.className = 'afx-timings';
		const summary = document.createElement('summary');
		summary.textContent = 'GPU passes';
		details.append(summary);

		timingList = document.createElement('div');
		timingList.className = 'afx-timings-list';
		const empty = document.createElement('div');
		empty.className = 'afx-timings-empty';
		empty.textContent = 'waiting for GPU…';
		timingList.append(empty);
		details.append(timingList);

		const copy = document.createElement('button');
		copy.type = 'button';
		copy.className = 'afx-timings-copy';
		copy.textContent = 'Copy averages';
		copy.addEventListener('click', () => {
			const lines = [...latestStats].map(
				([name, s]) =>
					`${name.padEnd(10)} avg ${s.avg.toFixed(2)} ms   min ${s.min.toFixed(2)}   max ${s.max.toFixed(2)}   (n=${s.count})`,
			);
			const text = ['pass       stats (ms)', ...lines].join('\n');
			void navigator.clipboard?.writeText(text);
			console.log(`[GPU passes]\n${text}`);
			copy.textContent = 'Copied!';
			window.setTimeout(() => (copy.textContent = 'Copy averages'), 1200);
		});
		details.append(copy);

		// If nothing arrives within a few frames, the timer-query extension is
		// most likely unsupported by this browser/driver.
		window.setTimeout(() => {
			if (timingRows.size === 0 && empty.isConnected) {
				empty.textContent = 'GPU timing not supported';
			}
		}, 3000);

		container.append(details);
	}

	const fps = new FpsMeter(showFps ? fpsElement : null);

	const updateTimings = (stats: ReadonlyMap<string, PassTiming>): void => {
		if (!timingList || stats.size === 0) return;
		latestStats = stats;
		const empty = timingList.querySelector<HTMLElement>('.afx-timings-empty');
		if (empty) empty.remove();

		for (const [name, s] of stats) {
			let cells = timingRows.get(name);
			if (!cells) {
				const row = document.createElement('div');
				row.className = 'afx-timing-row';
				const label = document.createElement('span');
				label.textContent = name;
				const metrics = document.createElement('span');
				metrics.className = 'afx-timing-metrics';
				const avg = document.createElement('span');
				avg.className = 'afx-timing-value';
				const range = document.createElement('span');
				range.className = 'afx-timing-range';
				metrics.append(avg, range);
				row.append(label, metrics);
				timingList.append(row);
				cells = { avg, range };
				timingRows.set(name, cells);
			}
			cells.avg.textContent = `${s.avg.toFixed(2)} ms`;
			cells.range.textContent = `${s.min.toFixed(1)}–${s.max.toFixed(1)}`;
		}
	};

	return {
		beginFrame: () => fps.beginFrame(),
		endFrame: () => {
			fps.endFrame();
			if (pipeline && showTimings) updateTimings(pipeline.getTimingStats());
		},
	};
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
