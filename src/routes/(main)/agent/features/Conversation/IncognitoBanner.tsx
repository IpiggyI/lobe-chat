'use client';

import { Button, Flexbox, Icon, Text } from '@lobehub/ui';
import { App } from 'antd';
import { createStaticStyles } from 'antd-style';
import { GlassesIcon, SaveIcon, Trash2Icon } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import urlJoin from 'url-join';

import { useChatStore } from '@/store/chat';

const INCOGNITO_ACCENT = '#7c3aed'; // violet-600 — keeps the banner distinct in both themes
const INCOGNITO_ACCENT_SOFT = 'rgba(139, 92, 246, 0.06)';
const INCOGNITO_ACCENT_BORDER = 'rgba(139, 92, 246, 0.18)';

const styles = createStaticStyles(({ css }) => ({
  banner: css`
    z-index: 10;
    width: 100%;
    padding: 8px 16px;

    background: ${INCOGNITO_ACCENT_SOFT};
    border-block-end: 1px solid ${INCOGNITO_ACCENT_BORDER};
  `,
  info: css`
    flex: 1;
    min-width: 0;
  `,
  title: css`
    color: ${INCOGNITO_ACCENT};
  `,
}));

export const IncognitoBanner = memo(() => {
  const { t } = useTranslation('chat');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { modal, message } = App.useApp();

  const [activeAgentId, activeGroupId, activeTopicId, saveEphemeralTopic, discardEphemeralTopic] =
    useChatStore((s) => [
      s.activeAgentId,
      s.activeGroupId,
      s.activeTopicId,
      s.saveEphemeralTopic,
      s.discardEphemeralTopic,
    ]);

  const handleSave = useCallback(async () => {
    if (!activeTopicId) return;
    await saveEphemeralTopic(activeTopicId);
    message.success(t('incognito.toast.saved'));

    const next = new URLSearchParams(searchParams);
    next.delete('mode');
    setSearchParams(next, { replace: true });
  }, [activeTopicId, saveEphemeralTopic, searchParams, setSearchParams, t, message]);

  const handleDiscard = useCallback(() => {
    if (!activeTopicId) return;
    modal.confirm({
      cancelText: t('incognito.action.keep'),
      content: t('incognito.dialog.discard.description'),
      okButtonProps: { danger: true },
      okText: t('incognito.action.discard'),
      onOk: async () => {
        await discardEphemeralTopic(activeTopicId);
        message.success(t('incognito.toast.discarded'));
        const fallback = activeAgentId ? urlJoin('/agent', activeAgentId) : '/';
        navigate(fallback, { replace: true });
      },
      title: t('incognito.dialog.discard.title'),
    });
  }, [activeAgentId, activeTopicId, discardEphemeralTopic, modal, message, navigate, t]);

  if (!activeTopicId || (!activeAgentId && !activeGroupId)) return null;

  return (
    <Flexbox
      align="center"
      className={styles.banner}
      gap={16}
      horizontal
      justify="space-between"
    >
      <Flexbox align="center" className={styles.info} gap={12} horizontal>
        <Icon icon={GlassesIcon} size={{ fontSize: 20 }} style={{ color: INCOGNITO_ACCENT }} />
        <Flexbox gap={2}>
          <Text className={styles.title} fontSize={13} weight={600}>
            {t('incognito.banner.title')}
          </Text>
          <Text ellipsis fontSize={11} type="secondary">
            {t('incognito.banner.description')}
          </Text>
        </Flexbox>
      </Flexbox>
      <Flexbox gap={8} horizontal style={{ flexShrink: 0 }}>
        <Button
          icon={<SaveIcon size={14} />}
          onClick={handleSave}
          size="small"
          style={{ background: INCOGNITO_ACCENT, borderColor: INCOGNITO_ACCENT }}
          type="primary"
        >
          {t('incognito.action.save')}
        </Button>
        <Button danger icon={<Trash2Icon size={14} />} onClick={handleDiscard} size="small">
          {t('incognito.action.discard')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
});

IncognitoBanner.displayName = 'IncognitoBanner';

export default IncognitoBanner;
