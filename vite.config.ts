import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		watch: {
			// The project lives on the Windows filesystem (/mnt/c) and is edited
			// from Windows tools, so inotify events are not delivered inside WSL.
			// Polling keeps dev-server HMR reliable there.
			usePolling: true,
			interval: 300,
		},
	},
});
