'use client';

import React from 'react';
import LiveReadingCard from './LiveReadingCard';
import { READING_CARDS } from '@/lib/constants';
import { EnergyReading } from '@/lib/types';

interface ReadingsGridProps {
  reading: EnergyReading | null;
}

export default function ReadingsGrid({ reading }: ReadingsGridProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        width: '100%',
      }}
      className="animate-fade-in"
    >
      {READING_CARDS.map((cardConf) => {
        const val = reading ? (reading as any)[cardConf.key] : null;
        const protectionStatus = reading?.protection_status || 'normal';

        return (
          <LiveReadingCard
            key={cardConf.key}
            label={cardConf.label}
            value={val}
            unit={cardConf.unit}
            decimals={cardConf.decimals}
            icon={cardConf.icon}
            protectionStatus={protectionStatus}
          />
        );
      })}
    </div>
  );
}
