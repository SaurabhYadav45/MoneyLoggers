import React from 'react';
import { BrainCircuit } from 'lucide-react';
import ComingSoonBox from '../components/ui/ComingSoonBox';

const Prediction: React.FC = () => {
  return (
    <ComingSoonBox
      icon={BrainCircuit}
      badgeText="COMING SOON"
      title="AI Prediction Model"
      subtitle="Institutional Market Forecasts"
      description="Our predictive analytics, intraday volatility bounds, and machine learning models are currently in research and calibration. Stay tuned for the upcoming release."
      gradient="from-purple-500 to-indigo-600"
      iconColor="text-purple-500 dark:text-purple-400"
    />
  );
};

export default Prediction;
