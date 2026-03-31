import { type UserStore } from '@/store/user';

import { currentSettings } from './settings';

const skillActivateMode = (s: UserStore): 'auto' | 'manual' | undefined =>
  currentSettings(s).tool?.skillActivateMode;

export const userToolSettingsSelectors = {
  skillActivateMode,
};
