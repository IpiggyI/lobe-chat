'use client';

import { ActionIcon, Flexbox } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { GlassesIcon, MessageSquarePlus } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { ProductLogo } from '@/components/Branding';
import { MOBILE_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import UserAvatar from '@/features/User/UserAvatar';
import { builtinAgentSelectors } from '@/store/agent/selectors/builtinAgentSelectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { useSessionStore } from '@/store/session';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import { styles } from './SessionHeader/style';

const Header = memo(() => {
  const { t } = useTranslation('chat');
  const [createSession] = useSessionStore((s) => [s.createSession]);
  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const createEphemeralTopic = useChatStore((s) => s.createEphemeralTopic);
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);

  const handleIncognito = useCallback(async () => {
    if (creating || !inboxAgentId) return;
    setCreating(true);
    try {
      const newTopicId = await createEphemeralTopic(inboxAgentId);
      if (newTopicId) {
        navigate(`/agent/${inboxAgentId}/${newTopicId}?mode=incognito`);
      }
    } finally {
      setCreating(false);
    }
  }, [creating, inboxAgentId, createEphemeralTopic, navigate]);

  return (
    <ChatHeader
      style={mobileHeaderSticky}
      left={
        <Flexbox horizontal align={'center'} className={styles.leftContainer} gap={8}>
          <UserAvatar size={32} onClick={() => navigate('/me')} />
          <ProductLogo type={'text'} />
        </Flexbox>
      }
      right={
        <Flexbox horizontal align={'center'} gap={4}>
          <ActionIcon
            disabled={creating || !inboxAgentId}
            icon={GlassesIcon}
            loading={creating}
            size={MOBILE_HEADER_ICON_SIZE}
            title={t('incognito.toggle.title')}
            onClick={handleIncognito}
          />
          <ActionIcon
            icon={MessageSquarePlus}
            size={MOBILE_HEADER_ICON_SIZE}
            onClick={() => createSession()}
          />
        </Flexbox>
      }
    />
  );
});

export default Header;
