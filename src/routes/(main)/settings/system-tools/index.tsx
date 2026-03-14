import { useTranslation } from 'react-i18next';

import SettingHeader from '@/routes/(main)/settings/features/SettingHeader';

import RuntimeToolsSection from './features/RuntimeToolsSection';
import ToolDetectorSection from './features/ToolDetectorSection';

const Page = () => {
  const { t } = useTranslation('setting');
  return (
    <>
      <SettingHeader title={t('tab.systemTools')} />
      <ToolDetectorSection />
      <RuntimeToolsSection />
    </>
  );
};

export default Page;
