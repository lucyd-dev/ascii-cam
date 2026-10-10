// Per-pass GPU timing via EXT_disjoint_timer_query_webgl2.
//
// GPU queries are asynchronous: a result is only readable a few frames after
// the pass ran, and reading it early would stall the pipeline. So instead of
// waiting, we keep a small pool of in-flight queries per label and harvest
// whatever has become available each frame. Reported values are the last
// resolved sample (in milliseconds) — smoothed enough for a live readout.
//
// If the extension is missing (e.g. some browsers/drivers), `supported` is
// false and every call is a no-op, so callers need no special casing.

// Minimal structural type so we do not depend on lib.dom having the WebGL2
// flavour of this extension typed.
interface DisjointTimerQueryExt {
	TIME_ELAPSED_EXT: number;
	GPU_DISJOINT_EXT: number;
}

const MAX_PENDING = 3;
// Number of recent samples kept per pass for the rolling statistics (~1.5s
// at 60fps). The average over this window is far easier to read than the raw
// per-frame value, which jitters frame to frame.
const WINDOW = 90;

export interface PassTiming {
	/** Most recent resolved sample, in milliseconds. */
	last: number;
	/** Mean over the rolling window, in milliseconds. */
	avg: number;
	/** Minimum / maximum over the rolling window, in milliseconds. */
	min: number;
	max: number;
	/** Number of samples currently in the window. */
	count: number;
}

export class GpuTimer {
	readonly supported: boolean;

	private gl: WebGL2RenderingContext;
	private ext: DisjointTimerQueryExt | null;
	private active = new Map<string, WebGLQuery>();
	private pending = new Map<string, WebGLQuery[]>();
	private latest = new Map<string, number>();
	private samples = new Map<string, number[]>();

	constructor(gl: WebGL2RenderingContext) {
		this.gl = gl;
		this.ext = gl.getExtension(
			'EXT_disjoint_timer_query_webgl2',
		) as DisjointTimerQueryExt | null;
		this.supported = this.ext !== null;
	}

	begin(label: string): void {
		const ext = this.ext;
		if (!ext) return;
		// Drop timing for this frame if too many samples are still in flight,
		// so the query pool cannot grow without bound.
		if ((this.pending.get(label)?.length ?? 0) >= MAX_PENDING) return;

		const query = this.gl.createQuery();
		if (!query) return;
		this.gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
		this.active.set(label, query);
	}

	end(label: string): void {
		if (!this.ext) return;
		const query = this.active.get(label);
		if (!query) return;

		this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
		this.active.delete(label);

		let queue = this.pending.get(label);
		if (!queue) {
			queue = [];
			this.pending.set(label, queue);
		}
		queue.push(query);
	}

	// Called once per frame after all passes have been recorded.
	poll(): void {
		const ext = this.ext;
		if (!ext) return;
		const gl = this.gl;
		// A "disjoint" event means the GPU clock was reset (e.g. tab switch);
		// all in-flight results are unreliable and must be discarded.
		const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean;

		for (const [label, queue] of this.pending) {
			while (queue.length > 0) {
				const query = queue[0];
				const available = gl.getQueryParameter(
					query,
					gl.QUERY_RESULT_AVAILABLE,
				) as boolean;
				if (!available) break;

				if (!disjoint) {
					const nanoseconds = gl.getQueryParameter(query, gl.QUERY_RESULT) as number;
					const ms = nanoseconds / 1e6;
					this.latest.set(label, ms);

					let series = this.samples.get(label);
					if (!series) {
						series = [];
						this.samples.set(label, series);
					}
					series.push(ms);
					if (series.length > WINDOW) series.shift();
				}
				gl.deleteQuery(query);
				queue.shift();
			}
		}
	}

	getTimings(): ReadonlyMap<string, number> {
		return this.latest;
	}

	// Rolling statistics per pass (avg/min/max over the recent window), for a
	// stable readout and for capturing representative numbers.
	getStats(): ReadonlyMap<string, PassTiming> {
		const out = new Map<string, PassTiming>();
		for (const [label, series] of this.samples) {
			if (series.length === 0) continue;
			let min = Infinity;
			let max = -Infinity;
			let sum = 0;
			for (const value of series) {
				sum += value;
				if (value < min) min = value;
				if (value > max) max = value;
			}
			out.set(label, {
				last: this.latest.get(label) ?? series[series.length - 1],
				avg: sum / series.length,
				min,
				max,
				count: series.length,
			});
		}
		return out;
	}
}
