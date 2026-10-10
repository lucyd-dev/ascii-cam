// Lucide icons (SVG) bundled as raw strings, plus a small button factory.
// Keeps the overlay dependency-light: only the icons we use are bundled.

import download from 'lucide-static/icons/download.svg?raw';
import rotateCcw from 'lucide-static/icons/rotate-ccw.svg?raw';
import refreshCcw from 'lucide-static/icons/refresh-ccw.svg?raw';

const ICONS: Record<string, string> = {
	download,
	'rotate-ccw': rotateCcw,
	'refresh-ccw': refreshCcw,
};

export function iconHtml(name: string): string {
	return ICONS[name] ?? '';
}

export function createIconButton(
	icon: string,
	title: string,
	onClick: () => void,
	className = 'afx-icon-btn',
): HTMLButtonElement {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = className;
	button.title = title;
	button.setAttribute('aria-label', title);
	button.innerHTML = iconHtml(icon);
	button.addEventListener('click', onClick);
	return button;
}
