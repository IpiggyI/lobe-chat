import type { EmojiPickerProps } from '@lobehub/ui';
import LobeEmojiPicker from '@lobehub/ui/es/EmojiPicker/index';
import { memo } from 'react';

import { useGlobalStore } from '@/store/global';
import { globalGeneralSelectors } from '@/store/global/selectors';

export const EmojiPicker = memo<EmojiPickerProps>(({ shape = 'square', ...rest }) => {
  const locale = useGlobalStore(globalGeneralSelectors.currentLanguage);

  return <LobeEmojiPicker shape={shape} {...rest} defaultAvatar={null as any} locale={locale} />;
});

export default EmojiPicker;
