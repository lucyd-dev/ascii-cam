// Engine overlay: the ReShade-style on-screen panel.
// It combines an FPS readout and the generated settings controls, and can be
// mounted either via TypeScript (createEngineOverlay) or with a marker
// element in the HTML (mountEngineOverlay looks up [data-engine-overlay]).

import './panel.css';
import { FpsMeter } from './fps';
import { buildControls } from './controls';
import type { SettingsStore } from '../settings/store';
import type { PassTiming } from '../gl/gpu-timer';

export interface EngineOverlayOptions {
	title?: string;
	showFps?: boolean;
	showControls?: boolean;
	showTimings?: boolean;
	selector?: string; // container selector used by mountEngineOverlay
}

// The handle returned by the overlay factories. beginFrame/endFrame drive the
// FPS meter; setTimings feeds per-pass GPU times (see Pipeline.getTimings).
export interface EngineMonitor {
	beginFrame(): number;
	endFrame(): void;
	setTimings(stats: ReadonlyMap<string, PassTiming>): void;
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
	} = options;

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

	// Per-pass GPU timings, in a collapsible section. Rows are created lazily
	// as results arrive (they are only available a few frames after startup).
	// We show the rolling average, which is far easier to read than the raw
	// per-frame value; a Copy button dumps the stats for sharing.
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
		container.append(details);

		// If nothing arrives within a few frames, the timer-query extension is
		// most likely unsupported by this browser/driver.
		window.setTimeout(() => {
			if (timingRows.size === 0 && empty.isConnected) {
				empty.textContent = 'GPU timing not supported';
			}
		}, 3000);
	}

	const fps = new FpsMeter(showFps ? fpsElement : null);

	return {
		beginFrame: () => fps.beginFrame(),
		endFrame: () => fps.endFrame(),
		setTimings: (stats) => {
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
