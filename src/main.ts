import './style.css';
import fillAtlasUrl from './effect/assets/fillASCII.png';
import edgeAtlasUrl from './effect/assets/edgesASCII.png';
import { AsciiRenderer } from './effect/renderer';
import {
	activeDeviceId,
	enumerateVideoInputs,
	startCamera,
	type CameraSource,
} from './effect/camera';
import { createCameraSelector, pickCamera } from './effect/camera-picker';
import { settings } from './effect/settings';
import { createGLContext, loadTexture, mountEngineOverlay } from './engine';

const CAMERA_STORAGE = 'ascii-cam.camera';

interface StoredCamera {
	deviceId: string;
	label: string;
}

function loadStoredCamera(): StoredCamera | null {
	try {
		return JSON.parse(localStorage.getItem(CAMERA_STORAGE) ?? 'null') as StoredCamera | null;
	} catch {
		return null;
	}
}

function storeCamera(deviceId: string, cameras: MediaDeviceInfo[]): void {
	const label = cameras.find((c) => c.deviceId === deviceId)?.label ?? '';
	localStorage.setItem(CAMERA_STORAGE, JSON.stringify({ deviceId, label }));
}

function videoAspect(video: HTMLVideoElement): number {
	return video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
}

function showMessage(text: string): void {
	const overlay = document.createElement('div');
	overlay.className = 'camera-picker';
	const card = document.createElement('div');
	card.className = 'camera-picker-card';
	const message = document.createElement('p');
	message.textContent = text;
	card.append(message);
	overlay.append(card);
	document.body.append(overlay);
}

async function main(): Promise<void> {
	if (location.protocol === 'file:') {
		showMessage(
			'Running from file://. Camera access and the full device list need a stable origin: serve this over http://localhost (npm run preview).',
		);
		return;
	}

	const canvas = document.querySelector<HTMLCanvasElement>('#glCanvas')!;
	const gl = createGLContext(canvas);

	const fillAtlas = await loadTexture(gl, fillAtlasUrl);
	const edgeAtlas = await loadTexture(gl, edgeAtlasUrl);

	const video = document.querySelector<HTMLVideoElement>('#webcam')!;

	// Camera source: `?camera=<label|index|deviceId>` wins, then the stored
	// choice, then the picker. `?camera=pick` forces the picker. A given source
	// is used directly, so only one getUserMedia (one permission prompt) runs.
	const stored = loadStoredCamera();
	const param = new URLSearchParams(location.search).get('camera');

	let deviceId: string | undefined;
	let stream: MediaStream | undefined;
	let explicit = false;

	if (param && param !== 'pick') {
		explicit = true;
		const devices = await enumerateVideoInputs();
		const index = Number(param);
		const match =
			(Number.isInteger(index) ? devices[index] : undefined) ??
			devices.find((d) => d.label.toLowerCase().includes(param.toLowerCase())) ??
			devices.find((d) => d.deviceId === param);
		deviceId = match?.deviceId || undefined;
	} else if (!param && stored) {
		explicit = true;
		deviceId = stored.deviceId;
	}

	if (!explicit) {
		const choice = await pickCamera(stored?.deviceId);
		deviceId = choice.deviceId;
		stream = choice.stream;
	}

	let camera: CameraSource = await startCamera(video, {
		deviceId,
		stream,
		width: 1920,
		height: 1080,
	});

	// Device labels are only available now that a stream is running.
	const cameras = await enumerateVideoInputs();
	deviceId = activeDeviceId(video) ?? deviceId;
	if (deviceId) storeCamera(deviceId, cameras);

	// The effect renders at the webcam resolution; the canvas only displays it,
	// scaled to the window. Mipmapped minification means no downscale aliasing,
	// so the full-detail image stays visible in any window size.
	let aspect = videoAspect(video);
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

	async function switchCamera(nextDeviceId: string): Promise<void> {
		camera.stop();
		camera = await startCamera(video, {
			deviceId: nextDeviceId,
			width: 1920,
			height: 1080,
		});
		deviceId = nextDeviceId;
		storeCamera(nextDeviceId, cameras);
		aspect = videoAspect(video);
		layoutCanvas();
	}

	const monitor = mountEngineOverlay(settings, {
		title: 'ASCII Live Cam',
		showControls: true,
		showDebug: true,
		pipeline: renderer.pipeline,
		canvas,
		general: createCameraSelector(cameras, deviceId, (nextId) => void switchCamera(nextId)),
	});

	function loop() {
		monitor.beginFrame();
		renderer.render(video);
		monitor.endFrame();
		video.requestVideoFrameCallback(loop);
	}

	video.requestVideoFrameCallback(loop);
}

main().catch((error: unknown) => {
	console.error('Startup failed:', error);
	showMessage('Camera unavailable. Check permissions and reload.');
});
