import { type PropsWithChildren } from 'react';

import MobileContentLayout from '@/components/server/MobileNavLayout';

import QuickEntries from '../features/QuickEntries';
import { styles } from './MobileLayout/style';
import SessionHeader from './SessionHeader';
import SessionSearchBar from './SessionSearchBar';

const MobileLayout = ({ children }: PropsWithChildren) => {
  return (
    <MobileContentLayout withNav header={<SessionHeader />}>
      <div className={styles.searchBarContainer}>
        <SessionSearchBar mobile />
      </div>
      <QuickEntries />
      {children}
    </MobileContentLayout>
  );
};

export default MobileLayout;
