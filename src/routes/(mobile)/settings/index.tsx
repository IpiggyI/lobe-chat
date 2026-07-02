'use client';

import { useParams } from 'react-router';

import Footer from '@/features/Setting/Footer';
import { parseAsString, useQueryState } from '@/hooks/useQueryParam';
import { SettingsTabs } from '@/store/global/initialState';

import SettingsContent from '../../(main)/settings/features/SettingsContent';

const MobileSettingsPage = () => {
  const params = useParams<{ tab?: string }>();
  const [queryActive] = useQueryState('active', parseAsString.withDefault(''));

  const activeTab = (params.tab as SettingsTabs) || queryActive || SettingsTabs.Profile;

  return (
    <>
      <SettingsContent activeTab={activeTab} mobile={true} />
      <Footer />
    </>
  );
};

export default MobileSettingsPage;
