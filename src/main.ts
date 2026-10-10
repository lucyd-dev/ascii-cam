import './style.css';
import { AsciiRenderer } from './effect/renderer';
import { startCamera } from './effect/camera';
import { settings } from './effect/settings';
import { createGLContext, downloadCanvasPng, loadTexture, mountEngineOverlay } from './engine';

const canvas = document.querySelector<HTMLCanvasElement>('#glCanvas')!;
const gl = createGLContext(canvas);

const fillAtlas = await loadTexture(gl, '/fillASCII.png');
const edgeAtlas = await loadTexture(gl, '/edgesASCII.png');

const video = document.querySelector<HTMLVideoElement>('#webcam')!;
await startCamera(video, {
	width: 1920,
	height: 1080,
	preferLabel: 'droidcam source 2',
});

const aspect =
	video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;

// The effect renders at the webcam resolution; the canvas only displays it,
// scaled to the window. Mipmapped minification means no downscale aliasing,
// so the full-detail image stays visible in any window size.
function layoutCanvas(): void {
	const dpr = window.devicePixelRatio || 1;
	let cssWidth = window.innerWidth;
	let cssHeight = cssWidth / aspect;
	if (cssHeight > window.innerHeight) {
		cssHeight = window.innerHeight;
		cssWidth = cssHeight * aspect;
	}
	cssWidth = Math.max(1, Math.floor(cssWidth));
	cssHeight = Math.max(1, Math.floor(cssHeight));
	canvas.style.width = `${cssWidth}px`;
	canvas.style.height = `${cssHeight}px`;
	canvas.width = Math.max(1, Math.round(cssWidth * dpr));
	canvas.height = Math.max(1, Math.round(cssHeight * dpr));
}

layoutCanvas();
const renderer = new AsciiRenderer(gl, {
	fillAtlas,
	edgeAtlas,
	width: video.videoWidth || 1920,
	height: video.videoHeight || 1080,
});

let resizeTimer = 0;
window.addEventListener('resize', () => {
	window.clearTimeout(resizeTimer);
	resizeTimer = window.setTimeout(layoutCanvas, 100);
});

function screenshotName(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${String(now.getFullYear()).slice(-2)}`;
	const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
	return `asciiCam-${renderer.pipeline.getDebugView()}-${date}-${time}.png`;
}

let screenshotRequested = false;
const monitor = mountEngineOverlay(settings, {
	title: 'ASCII Live Cam',
	showControls: true,
	showTimings: true,
	showDebugOutput: true,
	showPasses: true,
	showScreenshot: true,
	pipeline: renderer.pipeline,
	onScreenshot: () => {
		screenshotRequested = true;
	},
});

function loop() {
	monitor.beginFrame();
	renderer.render(video);
	if (screenshotRequested) {
		downloadCanvasPng(canvas, screenshotName());
		screenshotRequested = false;
	}
	monitor.endFrame();
	video.requestVideoFrameCallback(loop);
}

video.requestVideoFrameCallback(loop);
