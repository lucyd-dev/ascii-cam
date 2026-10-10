import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
	// Relative base + single-file output so the built dist/index.html runs
	// straight from file:// (e.g. as an OBS browser source), with no external
	// JS/CSS/asset requests that file:// would block via CORS.
	base: './',
	plugins: [viteSingleFile()],
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
