// Pre-start camera selection: a centered modal with a live preview and a
// confirm button. Also exports a compact selector row for the monitor so the
// camera can be switched while running.

import { cameraLabel, enumerateVideoInputs, requestCameraStream } from './camera';

export interface CameraChoice {
	deviceId: string;
	label: string;
	stream: MediaStream;
}

export async function pickCamera(initialDeviceId?: string): Promise<CameraChoice> {
	// A single getUserMedia grants permission and provides the initial preview;
	// device labels only become available after that.
	let current = await requestCameraStream({ deviceId: initialDeviceId });
	const cameras = await enumerateVideoInputs();
	if (cameras.length === 0) {
		current.getTracks().forEach((track) => track.stop());
		throw new Error('No camera found');
	}

	return new Promise((resolve) => {
		const overlay = document.createElement('div');
		overlay.className = 'camera-picker';
		const card = document.createElement('div');
		card.className = 'camera-picker-card';

		const title = document.createElement('h2');
		title.textContent = 'Select Camera';
		card.append(title);

		const select = document.createElement('select');
		cameras.forEach((device, index) => {
			const option = document.createElement('option');
			option.value = device.deviceId;
			option.textContent = cameraLabel(device, index);
			select.append(option);
		});
		const activeId = current.getVideoTracks()[0]?.getSettings().deviceId;
		if (activeId && cameras.some((c) => c.deviceId === activeId)) select.value = activeId;
		else if (initialDeviceId && cameras.some((c) => c.deviceId === initialDeviceId)) {
			select.value = initialDeviceId;
		}

		const preview = document.createElement('video');
		preview.className = 'camera-picker-preview';
		preview.autoplay = true;
		preview.muted = true;
		preview.playsInline = true;
		preview.srcObject = current;
		void preview.play();

		const confirm = document.createElement('button');
		confirm.type = 'button';
		confirm.className = 'camera-picker-confirm';
		confirm.textContent = 'Start';

		let requestId = 0;
		const showPreview = async (): Promise<void> => {
			const id = ++requestId;
			try {
				const stream = await requestCameraStream({ deviceId: select.value });
				if (id !== requestId) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}
				current.getTracks().forEach((track) => track.stop());
				current = stream;
				preview.srcObject = stream;
				await preview.play();
			} catch {
				// Keep the previous preview if this device cannot be opened.
			}
		};

		select.addEventListener('change', () => void showPreview());
		confirm.addEventListener('click', () => {
			const stream = current;
			preview.srcObject = null;
			overlay.remove();
			const index = cameras.findIndex((c) => c.deviceId === select.value);
			resolve({
				deviceId: select.value,
				label: index >= 0 ? cameraLabel(cameras[index], index) : '',
				stream,
			});
		});

		card.append(select, preview, confirm);
		overlay.append(card);
		document.body.append(overlay);
	});
}

// A row matching the engine overlay's control style, for switching cameras live.
export function createCameraSelector(
	cameras: MediaDeviceInfo[],
	currentDeviceId: string | undefined,
	onSelect: (deviceId: string) => void,
): HTMLElement {
	const row = document.createElement('div');
	row.className = 'afx-control';

	const label = document.createElement('span');
	label.className = 'afx-control-label';
	label.textContent = 'Camera';

	const select = document.createElement('select');
	cameras.forEach((device, index) => {
		const option = document.createElement('option');
		option.value = device.deviceId;
		option.textContent = cameraLabel(device, index);
		select.append(option);
	});
	if (currentDeviceId) select.value = currentDeviceId;
	select.addEventListener('change', () => onSelect(select.value));

	row.append(label, select);
	return row;
}
