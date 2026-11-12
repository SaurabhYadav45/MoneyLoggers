import React from 'react';
import { Layers } from 'lucide-react';
import ComingSoonBox from '../components/ui/ComingSoonBox';

const ETFs: React.FC = () => {
  return (
    <ComingSoonBox
      icon={Layers}
      badgeText="COMING SOON"
      title="ETF Zone"
      subtitle="Exchange Traded Funds Directory"
      description="We are currently integrating live exchange feeds to provide real-time ETF tracking, NAV analytics, and underlying index comparisons without synthetic data."
      gradient="from-amber-500 to-orange-500"
      iconColor="text-amber-500 dark:text-amber-400"
    />
  );
};

export default ETFs;
