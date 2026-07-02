'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { ListTodo, type LucideIcon, Palette } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

interface QuickEntryItem {
  icon: LucideIcon;
  key: string;
  label: string;
  path: string;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    padding-block: 12px;
    padding-inline: 16px;
  `,
  iconWrapper: css`
    display: flex;
    align-items: center;
    justify-content: center;

    width: 48px;
    height: 48px;
    border-radius: 12px;

    color: ${cssVar.colorText};

    background: ${cssVar.colorFillSecondary};
  `,
  item: css`
    cursor: pointer;
    transition: opacity 100ms ${cssVar.motionEaseOut};

    &:active {
      opacity: 0.6;
    }
  `,
  label: css`
    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
  `,
}));

const QuickEntries = memo(() => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  const entries = useMemo<QuickEntryItem[]>(
    () => [
      { icon: Palette, key: 'image', label: t('tab.image'), path: '/image' },
      { icon: ListTodo, key: 'tasks', label: t('tab.tasks'), path: '/tasks' },
    ],
    [t],
  );

  return (
    <Flexbox horizontal align={'flex-start'} className={styles.container} gap={20}>
      {entries.map((item) => (
        <Flexbox
          align={'center'}
          className={styles.item}
          gap={6}
          key={item.key}
          onClick={() => navigate(item.path)}
        >
          <div className={styles.iconWrapper}>
            <Icon icon={item.icon} size={24} />
          </div>
          <span className={styles.label}>{item.label}</span>
        </Flexbox>
      ))}
    </Flexbox>
  );
});

QuickEntries.displayName = 'QuickEntries';

export default QuickEntries;
