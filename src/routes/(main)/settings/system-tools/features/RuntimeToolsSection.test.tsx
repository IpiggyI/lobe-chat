/**
 * @vitest-environment happy-dom
 */
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RuntimeToolsSection from './RuntimeToolsSection';

const { segmentedMock, toolStoreState } = vi.hoisted(() => ({
  segmentedMock: vi.fn(
    ({
      onChange,
      options,
      shape,
      value,
      variant,
    }: {
      onChange: (value: string) => void;
      options: Array<{ label?: unknown; tooltip?: string; value: string }>;
      shape?: string;
      value?: string;
      variant?: string;
    }) => (
      <div
        data-shape={shape}
        data-testid="activate-mode-segmented"
        data-value={value}
        data-variant={variant}
      >
        {options.map((option) => (
          <button key={option.value} type="button" onClick={() => onChange(option.value)}>
            {String(option.label)}
          </button>
        ))}
      </div>
    ),
  ),
  toolStoreState: {
    installBuiltinTool: vi.fn(),
    uninstallBuiltinTool: vi.fn(),
    updateUserSkillActivateMode: vi.fn(),
    useFetchUninstalledBuiltinTools: vi.fn(),
    userSkillActivateMode: 'manual',
  },
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Form: ({ items }: { items: Array<{ children: Array<{ children: React.ReactNode }> }> }) => (
    <div>
      {items
        .flatMap((group) => group.children)
        .map((item, index) => (
          <div key={index}>{item.children}</div>
        ))}
    </div>
  ),
  Icon: ({ icon }: { icon: { displayName?: string; name?: string } }) => (
    <span>{icon.displayName || icon.name || 'icon'}</span>
  ),
  Segmented: segmentedMock,
  Tooltip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  Switch: () => <div data-testid="runtime-tool-switch" />,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/tool', () => ({
  useToolStore: (selector: (state: typeof toolStoreState) => unknown) => selector(toolStoreState),
}));

vi.mock('@/store/tool/selectors', () => ({
  builtinToolSelectors: {
    isBuiltinToolInstalled: () => () => true,
    userSkillActivateMode: (state: typeof toolStoreState) => state.userSkillActivateMode,
  },
}));

describe('RuntimeToolsSection', () => {
  afterEach(() => {
    segmentedMock.mockClear();
    toolStoreState.installBuiltinTool.mockClear();
    toolStoreState.uninstallBuiltinTool.mockClear();
    toolStoreState.updateUserSkillActivateMode.mockClear();
    toolStoreState.useFetchUninstalledBuiltinTools.mockClear();
  });

  it('renders activate mode segmented with round outlined options and tooltips', () => {
    render(<RuntimeToolsSection />);

    expect(toolStoreState.useFetchUninstalledBuiltinTools).toHaveBeenCalledWith(true);

    const props = segmentedMock.mock.calls[0]?.[0];

    expect(props).toMatchObject({
      shape: 'round',
      value: 'manual',
      variant: 'outlined',
    });

    expect(props.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'tools.skillActivateMode.auto.title',
          tooltip: 'tools.skillActivateMode.auto.desc',
          value: 'auto',
        }),
        expect.objectContaining({
          label: 'tools.skillActivateMode.manual.title',
          tooltip: 'tools.skillActivateMode.manual.desc',
          value: 'manual',
        }),
      ]),
    );
  });
});
