// The effect's single settings instance (engine store + project schema).

import { SettingsStore } from '../engine';
import { PARAMS } from './schema';

export const settings = new SettingsStore(PARAMS, 'ascii-cam.settings');
