'use client';

import { type FormGroupItemType } from '@lobehub/ui';
import { Form } from '@lobehub/ui';
import { Switch } from '@lobehub/ui/base-ui';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { useToolStore } from '@/store/tool';
import { builtinToolSelectors } from '@/store/tool/slices/builtin/selectors';

/**
 * Runtime tool configuration for the toggle list
 */
const RUNTIME_TOOLS = [
  { identifier: 'lobe-tools' },
  { identifier: 'lobe-skills' },
  { identifier: 'lobe-skill-store' },
] as const;

const RuntimeToolsSection = memo(() => {
  const { t } = useTranslation('setting');

  const { useFetchUninstalledBuiltinTools, installBuiltinTool, uninstallBuiltinTool } =
    useToolStore();

  // Hydrate uninstalled tools state
  useFetchUninstalledBuiltinTools(true);

  const handleToggle = useCallback(
    async (identifier: string, checked: boolean) => {
      if (checked) {
        await installBuiltinTool(identifier);
      } else {
        await uninstallBuiltinTool(identifier);
      }
    },
    [installBuiltinTool, uninstallBuiltinTool],
  );

  const formItems: FormGroupItemType[] = [
    {
      children: RUNTIME_TOOLS.map((tool) => ({
        children: (
          <ToolSwitch identifier={tool.identifier} onToggle={handleToggle} />
        ),
        desc: t(`settingSystemToolsRuntime.tools.${tool.identifier}.desc` as any),
        label: t(`settingSystemToolsRuntime.tools.${tool.identifier}.title` as any),
        minWidth: undefined,
      })),
      desc: t('settingSystemToolsRuntime.desc'),
      title: t('settingSystemToolsRuntime.title'),
    },
  ];

  return (
    <Form
      collapsible={false}
      items={formItems}
      itemsType={'group'}
      variant={'filled'}
      {...FORM_STYLE}
    />
  );
});

/**
 * Individual tool switch that reads install state from the store
 */
const ToolSwitch = memo<{
  identifier: string;
  onToggle: (identifier: string, checked: boolean) => void;
}>(({ identifier, onToggle }) => {
  const isInstalled = useToolStore(builtinToolSelectors.isBuiltinToolInstalled(identifier));

  return <Switch checked={isInstalled} onChange={(checked) => onToggle(identifier, checked)} />;
});

export default RuntimeToolsSection;
