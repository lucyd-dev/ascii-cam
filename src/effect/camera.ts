// Webcam / media-device capture, kept out of the app entry point.

export interface CameraOptions {
	width?: number;
	height?: number;
	preferLabel?: string;
}

export interface CameraSource {
	video: HTMLVideoElement;
	stop(): void;
}

export async function startCamera(
	video: HTMLVideoElement,
	options: CameraOptions = {},
): Promise<CameraSource> {
	const devices = await navigator.mediaDevices.enumerateDevices();
	const videoDevices = devices.filter((device) => device.kind === 'videoinput');

	const prefer = (options.preferLabel ?? '').toLowerCase();
	const target =
		videoDevices.find((d) => d.label.toLowerCase().includes(prefer)) ?? videoDevices[0];
	if (!target) throw new Error('No camera found!');

	const stream = await navigator.mediaDevices.getUserMedia({
		video: {
			deviceId: { exact: target.deviceId },
			width: { ideal: options.width },
			height: { ideal: options.height },
		},
	});

	video.srcObject = stream;
	await video.play();

	return {
		video,
		stop: () => stream.getTracks().forEach((track) => track.stop()),
	};
}
