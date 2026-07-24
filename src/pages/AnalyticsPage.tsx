import React from 'react';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';

const AnalyticsPage: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto" data-tour="analytics">
      <AnalyticsDashboard />
    </div>
  );
};

export default AnalyticsPage;
