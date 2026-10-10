// Saves the current canvas contents as a PNG download.
// Call this in the same frame the scene was drawn (before the drawing buffer
// is cleared/composited), otherwise the canvas may already be empty.

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename = 'capture.png'): void {
	const link = document.createElement('a');
	link.download = filename;
	link.href = canvas.toDataURL('image/png');
	link.click();
}
