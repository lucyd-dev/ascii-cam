// GPU timing readout: a three-column table (pass / AVG / MIN-MAX) topped by a
// header and closed by a separated "All" total. createTimingsTable() returns
// the element plus an update() fed the latest per-pass stats each frame.

import type { PassTiming } from '../gl/gpu-timer';
import { el } from './dom';

export interface TimingsTable {
	element: HTMLElement;
	update(stats: ReadonlyMap<string, PassTiming>): void;
}

export function createTimingsTable(): TimingsTable {
	const content = el('div', 'afx-timings-content');

	const header = el('div', 'afx-timing-header');
	for (const text of ['pass', 'AVG', 'MIN/MAX']) header.append(el('span', undefined, text));

	const list = el('div', 'afx-timings-list');
	const empty = el('div', 'afx-timings-empty', 'waiting for GPU…');
	list.append(empty);

	const allRow = el('div', 'afx-timing-row afx-timing-all');
	const allAvg = el('span', 'afx-timing-value');
	const allRange = el('span', 'afx-timing-range');
	allRow.append(el('span', undefined, 'All'), allAvg, allRange);
	allRow.style.display = 'none';

	const rows = new Map<string, { avg: HTMLElement; range: HTMLElement }>();
	let latest: ReadonlyMap<string, PassTiming> = new Map();

	const totals = (): PassTiming => {
		const sum: PassTiming = { last: 0, avg: 0, min: 0, max: 0, count: 0 };
		for (const [, s] of latest) {
			sum.last += s.last;
			sum.avg += s.avg;
			sum.min += s.min;
			sum.max += s.max;
			sum.count += s.count;
		}
		return sum;
	};

	const copy = el('button', 'afx-timings-copy', 'Copy averages');
	copy.type = 'button';
	copy.addEventListener('click', () => {
		const line = (name: string, s: PassTiming) =>
			`${name.padEnd(10)} avg ${s.avg.toFixed(2)} ms   min ${s.min.toFixed(2)}   max ${s.max.toFixed(2)}   (n=${s.count})`;
		const lines = [...latest].map(([name, s]) => line(name, s));
		lines.push(line('All', totals()));
		const text = ['pass       stats (ms)', ...lines].join('\n');
		void navigator.clipboard?.writeText(text);
		console.log(`[GPU passes]\n${text}`);
		copy.textContent = 'Copied!';
		window.setTimeout(() => (copy.textContent = 'Copy averages'), 1200);
	});

	content.append(header, list, allRow, copy);

	const update = (stats: ReadonlyMap<string, PassTiming>): void => {
		if (stats.size === 0) return;
		latest = stats;
		empty.remove();

		let avg = 0;
		let min = 0;
		let max = 0;
		for (const [name, s] of stats) {
			let cells = rows.get(name);
			if (!cells) {
				const row = el('div', 'afx-timing-row');
				cells = {
					avg: el('span', 'afx-timing-value'),
					range: el('span', 'afx-timing-range'),
				};
				row.append(el('span', undefined, name), cells.avg, cells.range);
				list.append(row);
				rows.set(name, cells);
			}
			cells.avg.textContent = s.avg.toFixed(2);
			cells.range.textContent = `${s.min.toFixed(1)}/${s.max.toFixed(1)}`;
			avg += s.avg;
			min += s.min;
			max += s.max;
		}
		allAvg.textContent = avg.toFixed(2);
		allRange.textContent = `${min.toFixed(1)}/${max.toFixed(1)}`;
		allRow.style.display = '';
	};

	// If no stats arrive within a few frames, the timer-query extension is
	// most likely unsupported by this browser/driver.
	window.setTimeout(() => {
		if (rows.size === 0 && empty.isConnected) empty.textContent = 'GPU timing not supported';
	}, 3000);

	return { element: content, update };
}
