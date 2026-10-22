'use client';

import React from 'react';
import MetricCard from '@/components/common/MetricCard';

interface LiveReadingCardProps {
  label: string;
  value: number | null;
  unit: string;
  decimals: number;
  icon: string;
  protectionStatus: string;
}

export default function LiveReadingCard({
  label,
  value,
  unit,
  decimals,
  icon,
  protectionStatus,
}: LiveReadingCardProps) {
  const isWarning =
    protectionStatus !== 'normal' &&
    (label === 'Voltage' || label === 'Power' || label === 'Current');

  let statusText = 'Normal';
  if (isWarning) {
    statusText = protectionStatus.replace('_', ' ').toUpperCase();
  }

  return (
    <MetricCard
      label={label}
      value={value}
      unit={unit}
      decimals={decimals}
      icon={icon}
      isWarning={isWarning}
      statusText={statusText}
    />
  );
}
