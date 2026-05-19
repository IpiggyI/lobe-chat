/**
 * @vitest-environment happy-dom
 */
import { App as AntdApp } from 'antd';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initialState as initialChatState } from '@/store/chat/initialState';
import { useChatStore } from '@/store/chat/store';

import IncognitoBanner from './IncognitoBanner';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  // Required by some downstream imports
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const renderBanner = (initialPath = '/agent/agt_1/tpc_temp?mode=incognito') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AntdApp>
        <IncognitoBanner />
      </AntdApp>
    </MemoryRouter>,
  );

describe('IncognitoBanner', () => {
  beforeEach(() => {
    useChatStore.setState(
      {
        ...initialChatState,
        activeAgentId: 'agt_1',
        activeTopicId: 'tpc_temp',
        saveEphemeralTopic: vi.fn().mockResolvedValue(undefined),
        discardEphemeralTopic: vi.fn().mockResolvedValue(undefined),
      },
      false,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the banner title, description and action buttons', () => {
    renderBanner();

    expect(screen.getByText('incognito.banner.title')).toBeTruthy();
    expect(screen.getByText('incognito.banner.description')).toBeTruthy();
    expect(screen.getByRole('button', { name: /incognito\.action\.save/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /incognito\.action\.discard/ })).toBeTruthy();
  });

  it('calls saveEphemeralTopic when the save button is clicked', async () => {
    const saveMock = vi.fn().mockResolvedValue(undefined);
    useChatStore.setState({ saveEphemeralTopic: saveMock }, false);

    renderBanner();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /incognito\.action\.save/ }));

    expect(saveMock).toHaveBeenCalledWith('tpc_temp');
  });

  it('returns null when no active topic is selected', () => {
    useChatStore.setState({ activeTopicId: undefined }, false);
    const { container } = renderBanner();
    expect(container.firstChild).toBeNull();
  });
});
