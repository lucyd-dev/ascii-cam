import './style.css';
import { AsciiRenderer } from './effect/renderer';
import { startCamera } from './effect/camera';
import { settings } from './effect/settings';
import { createGLContext, loadTexture, mountEngineOverlay } from './engine';

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

// Populate the debug dropdown from the pipeline's actual buffers.
settings.setSelectOptions('debugView', [
	...renderer.getBufferNames().map((name) => ({ value: name, label: name })),
	{ value: 'final', label: 'Final' },
]);

// Engine overlay (FPS + controls + GPU timings) via [data-engine-overlay].
const monitor = mountEngineOverlay(settings, {
	title: 'ASCII Live Cam',
	showControls: true,
	showTimings: true,
});

function loop() {
	monitor.beginFrame();
	renderer.render(video);
	monitor.setTimings(renderer.getTimingStats());
	monitor.endFrame();
	video.requestVideoFrameCallback(loop);
}

video.requestVideoFrameCallback(loop);
