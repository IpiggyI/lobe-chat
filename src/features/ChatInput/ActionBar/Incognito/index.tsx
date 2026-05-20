import { GlassesIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import urlJoin from 'url-join';

import { useQueryRoute } from '@/hooks/useQueryRoute';
import { useChatStore } from '@/store/chat';

import { useAgentId } from '../../hooks/useAgentId';
import Action from '../components/Action';

const Incognito = memo(() => {
  const { t } = useTranslation('chat');
  const agentId = useAgentId();
  const router = useQueryRoute();
  const activeTopicId = useChatStore((s) => s.activeTopicId);
  const createEphemeralTopic = useChatStore((s) => s.createEphemeralTopic);
  const [creating, setCreating] = useState(false);

  if (activeTopicId || !agentId) return null;

  const handleClick = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const newTopicId = await createEphemeralTopic(agentId);
      if (newTopicId) {
        router.push(urlJoin('/agent', agentId, newTopicId), { query: { mode: 'incognito' } });
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <Action
      disabled={creating}
      icon={GlassesIcon}
      loading={creating}
      title={t('incognito.toggle.title')}
      onClick={handleClick}
    />
  );
});

Incognito.displayName = 'Incognito';

export default Incognito;
