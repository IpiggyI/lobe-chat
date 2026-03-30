'use client';

import { LobeActivatorManifest } from '@lobechat/builtin-tool-activator';
import { SkillStoreManifest } from '@lobechat/builtin-tool-skill-store';
import { SkillsManifest } from '@lobechat/builtin-tool-skills';
import { type FormGroupItemType } from '@lobehub/ui';
import { Form, Icon, Segmented, Tooltip } from '@lobehub/ui';
import { Flexbox } from '@lobehub/ui';
import { Switch } from 'antd';
import { SlidersHorizontal, Sparkles } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { useToolStore } from '@/store/tool';
import { builtinToolSelectors } from '@/store/tool/selectors';

/**
 * Runtime tool toggle configuration.
 * Each entry maps a user-facing label/desc i18n key to a builtin tool identifier.
 */
const RUNTIME_TOOL_ITEMS = [
  {
    descKey: 'settingSystemTools.runtime.toolDiscovery.desc',
    identifier: LobeActivatorManifest.identifier,
    labelKey: 'settingSystemTools.runtime.toolDiscovery.title',
  },
  {
    descKey: 'settingSystemTools.runtime.skills.desc',
    identifier: SkillsManifest.identifier,
    labelKey: 'settingSystemTools.runtime.skills.title',
  },
  {
    descKey: 'settingSystemTools.runtime.skillStore.desc',
    identifier: SkillStoreManifest.identifier,
    labelKey: 'settingSystemTools.runtime.skillStore.title',
  },
] as const;

/**
 * Global runtime tool toggles section in Settings > System Tools.
 *
 * Allows users to disable lobe-tools / lobe-skills / lobe-skill-store
 * so they are no longer injected into chat requests, reducing token overhead.
 */
const RuntimeToolsSection = memo(() => {
  const { t } = useTranslation('setting');

  const [installBuiltinTool, uninstallBuiltinTool, useFetchUninstalledBuiltinTools] = useToolStore(
    (s) => [s.installBuiltinTool, s.uninstallBuiltinTool, s.useFetchUninstalledBuiltinTools],
  );

  // Ensure uninstalled state is hydrated from server before rendering
  useFetchUninstalledBuiltinTools(true);

  const activateModeItem: FormGroupItemType = {
    children: [
      {
        children: <ActivateModeSegmented />,
        desc: t('settingSystemTools.runtime.activateMode.desc'),
        label: t('settingSystemTools.runtime.activateMode.title'),
        minWidth: undefined,
      },
    ],
    title: t('settingSystemTools.runtime.title'),
  };

  const toggleItems: FormGroupItemType = {
    children: RUNTIME_TOOL_ITEMS.map((item) => ({
      children: (
        <RuntimeToolSwitch
          identifier={item.identifier}
          onInstall={installBuiltinTool}
          onUninstall={uninstallBuiltinTool}
        />
      ),
      desc: t(item.descKey),
      label: t(item.labelKey),
      minWidth: undefined,
    })),
    desc: t('settingSystemTools.runtime.desc'),
    title: t('settingSystemTools.runtime.title'),
  };

  return (
    <Form
      collapsible={false}
      items={[activateModeItem, toggleItems]}
      itemsType={'group'}
      variant={'filled'}
      {...FORM_STYLE}
    />
  );
});

RuntimeToolsSection.displayName = 'RuntimeToolsSection';

/**
 * Individual toggle switch that reads installation state from store.
 * Separated to avoid unnecessary re-renders of the entire section.
 */
const RuntimeToolSwitch = memo<{
  identifier: string;
  onInstall: (id: string) => Promise<void>;
  onUninstall: (id: string) => Promise<void>;
}>(({ identifier, onInstall, onUninstall }) => {
  const isInstalled = useToolStore((s) =>
    builtinToolSelectors.isBuiltinToolInstalled(identifier)(s),
  );

  return (
    <Switch
      checked={isInstalled}
      onChange={(checked) => {
        if (checked) {
          onInstall(identifier);
        } else {
          onUninstall(identifier);
        }
      }}
    />
  );
});

RuntimeToolSwitch.displayName = 'RuntimeToolSwitch';

/**
 * User-level default activate mode selector.
 * Separated to isolate re-renders.
 */
const ActivateModeSegmented = memo(() => {
  const { t } = useTranslation('setting');
  const currentMode = useToolStore((s) => builtinToolSelectors.userSkillActivateMode(s) ?? 'auto');
  const updateMode = useToolStore((s) => s.updateUserSkillActivateMode);

  return (
    <Segmented
      options={[
        {
          label: (
            <Flexbox align="center" gap={4} horizontal>
              <Icon icon={Sparkles} size="small" />
              <Tooltip title={t('tools.skillActivateMode.auto.desc')}>
                {t('tools.skillActivateMode.auto.title')}
              </Tooltip>
            </Flexbox>
          ),
          value: 'auto',
        },
        {
          label: (
            <Flexbox align="center" gap={4} horizontal>
              <Icon icon={SlidersHorizontal} size="small" />
              <Tooltip title={t('tools.skillActivateMode.manual.desc')}>
                {t('tools.skillActivateMode.manual.title')}
              </Tooltip>
            </Flexbox>
          ),
          value: 'manual',
        },
      ]}
      value={currentMode}
      onChange={(value) => updateMode(value as 'auto' | 'manual')}
    />
  );
});

ActivateModeSegmented.displayName = 'ActivateModeSegmented';

export default RuntimeToolsSection;
