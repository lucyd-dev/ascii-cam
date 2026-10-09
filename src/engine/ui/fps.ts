// Frames-per-second meter. `beginFrame()`/`endFrame()` wrap one rendered
// frame; the display element is updated at most twice a second for stability.

export class FpsMeter {
	private frames: number = 0;
	private lastUpdate: number = performance.now();
	private element: HTMLElement | null;

	constructor(element: HTMLElement | null = null) {
		this.element = element;
	}

	beginFrame(): number {
		return performance.now();
	}

	endFrame(): void {
		this.frames++;
		const now = performance.now();
		if (now - this.lastUpdate >= 500) {
			const elapsed = (now - this.lastUpdate) / 1000;
			const fps = Math.round(this.frames / elapsed);
			if (this.element) this.element.textContent = String(fps);
			this.frames = 0;
			this.lastUpdate = now;
		}
	}
}
