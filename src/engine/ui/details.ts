// Builds a <details> dropdown whose open/closed state persists via UiState.

import type { UiState } from './ui-state';

export function createDetails(
	className: string,
	summary: string,
	uiState: UiState | undefined,
	key: string,
): HTMLDetailsElement {
	const details = document.createElement('details');
	details.className = className;
	details.open = uiState?.getBool(`open:${key}`, false) ?? false;
	if (uiState) {
		details.addEventListener('toggle', () => uiState.set(`open:${key}`, details.open));
	}

	const head = document.createElement('summary');
	head.textContent = summary;
	details.append(head);
	return details;
}
