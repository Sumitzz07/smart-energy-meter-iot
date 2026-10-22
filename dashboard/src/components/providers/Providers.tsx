'use client';

import React from 'react';
import { DeviceProvider } from '@/context/DeviceContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return <DeviceProvider>{children}</DeviceProvider>;
}
