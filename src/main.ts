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

const renderer = new AsciiRenderer(gl, { fillAtlas, edgeAtlas });

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
