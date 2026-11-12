import React from 'react';
import { Briefcase } from 'lucide-react';
import ComingSoonBox from '../components/ui/ComingSoonBox';

const Portfolio: React.FC = () => {
  return (
    <ComingSoonBox
      icon={Briefcase}
      badgeText="COMING SOON"
      title="Portfolio Management"
      subtitle="Multi-Asset Wealth Cockpit"
      description="Automated broker synchronization, CAS mutual fund import, and portfolio optimization tools are currently in engineering. Stay tuned for the upcoming release."
      gradient="from-emerald-500 to-teal-600"
      iconColor="text-emerald-500 dark:text-emerald-400"
    />
  );
};

export default Portfolio;
