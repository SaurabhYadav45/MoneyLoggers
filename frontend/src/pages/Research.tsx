import React from 'react';
import { FileText } from 'lucide-react';
import ComingSoonBox from '../components/ui/ComingSoonBox';

const Research: React.FC = () => {
  return (
    <ComingSoonBox
      icon={FileText}
      badgeText="COMING SOON"
      title="Equity Research"
      subtitle="Institutional Reports & Valuation Models"
      description="Fundamental research coverage, DCF valuation models, sector quarterly reviews, and broker consensus tracking are currently in active development."
      gradient="from-blue-500 to-indigo-600"
      iconColor="text-blue-500 dark:text-blue-400"
    />
  );
};

export default Research;