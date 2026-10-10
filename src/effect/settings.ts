// The effect's single settings instance (engine store + project schema).

import { SettingsStore } from '../engine';
import { CATEGORIES } from './schema';

export const settings = new SettingsStore(CATEGORIES, 'ascii-cam.settings');
