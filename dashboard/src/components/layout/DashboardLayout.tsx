'use client';

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAlerts } from '@/hooks/useAlerts';
import { useDevices } from '@/context/DeviceContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { selectedDeviceId } = useDevices();
  const { unacknowledgedCount } = useAlerts(selectedDeviceId);

  const mainMarginLeft = isCollapsed ? '72px' : '260px';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-bg-primary)' }}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        unacknowledgedCount={unacknowledgedCount}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      <div
        style={{
          flex: 1,
          marginLeft: mainMarginLeft,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        className="main-layout-container"
      >
        <Header
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          unacknowledgedCount={unacknowledgedCount}
        />

        <main
          style={{
            flex: 1,
            padding: '24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
          className="page-main-content"
        >
          {children}
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .main-layout-container {
            margin-left: 0 !important;
          }
          .page-main-content {
            padding: 16px !important;
            gap: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}
