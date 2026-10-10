// Webcam / media-device capture, kept out of the app entry point.

export interface CameraOptions {
	deviceId?: string;
	/** A ready stream to adopt instead of requesting a new one. */
	stream?: MediaStream;
	width?: number;
	height?: number;
}

export interface CameraSource {
	video: HTMLVideoElement;
	stop(): void;
}

export function cameraLabel(device: MediaDeviceInfo, index: number): string {
	return device.label || `Camera ${index + 1}`;
}

// Lists video inputs without asking for permission. Labels/ids may be empty
// until permission has been granted; call after a stream is already running.
export async function enumerateVideoInputs(): Promise<MediaDeviceInfo[]> {
	if (!navigator.mediaDevices) return [];
	const devices = await navigator.mediaDevices.enumerateDevices();
	return devices.filter((device) => device.kind === 'videoinput');
}

// Requests a stream for a device. `exact` actually switches device; it falls
// back to the default camera if the requested one is gone (otherwise this would
// be an OverconstrainedError).
export async function requestCameraStream(options: CameraOptions = {}): Promise<MediaStream> {
	try {
		return await requestStream(options, true);
	} catch {
		return await requestStream(options, false);
	}
}

export async function startCamera(
	video: HTMLVideoElement,
	options: CameraOptions = {},
): Promise<CameraSource> {
	const stream = options.stream ?? (await requestCameraStream(options));
	video.srcObject = stream;
	await video.play();

	return {
		video,
		stop: () => stream.getTracks().forEach((track) => track.stop()),
	};
}

export function activeDeviceId(video: HTMLVideoElement): string | undefined {
	const stream = video.srcObject;
	if (!(stream instanceof MediaStream)) return undefined;
	return stream.getVideoTracks()[0]?.getSettings().deviceId ?? undefined;
}

function requestStream(options: CameraOptions, useDevice: boolean): Promise<MediaStream> {
	const constraints: MediaTrackConstraints = {};
	if (options.width) constraints.width = { ideal: options.width };
	if (options.height) constraints.height = { ideal: options.height };
	if (useDevice && options.deviceId) constraints.deviceId = { exact: options.deviceId };
	return navigator.mediaDevices.getUserMedia({ video: constraints });
}
