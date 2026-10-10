import './style.css';
import { AsciiRenderer } from './effect/renderer';
import { startCamera } from './effect/camera';
import { settings } from './effect/settings';
import { createGLContext, loadTexture, mountEngineOverlay } from './engine';

// Engine overlay (FPS + controls + GPU timings) via [data-engine-overlay].
const monitor = mountEngineOverlay(settings, {
	title: 'ASCII Live Cam',
	showControls: true,
	showTimings: true,
});

const canvas = document.querySelector<HTMLCanvasElement>('#glCanvas')!;
const gl = createGLContext(canvas);

const fillAtlas = await loadTexture(gl, '/fillASCII.png');
const edgeAtlas = await loadTexture(gl, '/edgesASCII.png');
const renderer = new AsciiRenderer(gl, { fillAtlas, edgeAtlas });

const video = document.querySelector<HTMLVideoElement>('#webcam')!;
await startCamera(video, {
	width: 1920,
	height: 1080,
	preferLabel: 'droidcam source 2',
});

function loop() {
	monitor.beginFrame();
	renderer.render(video);
	monitor.setTimings(renderer.getTimingStats());
	monitor.endFrame();
	video.requestVideoFrameCallback(loop);
}

video.requestVideoFrameCallback(loop);
