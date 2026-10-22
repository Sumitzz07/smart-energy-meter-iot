'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, Bell, RefreshCw, Cpu, Wifi, Radio } from 'lucide-react';
import { useDevices } from '@/context/DeviceContext';
import ConnectionBadge from '../status/ConnectionBadge';
import { STALE_THRESHOLD_SECONDS } from '@/lib/constants';
import { getDeviceSecondsAgo, isDeviceStale } from '@/lib/device-status';

interface HeaderProps {
  onMenuToggle: () => void;
  unacknowledgedCount?: number;
}

export default function Header({ onMenuToggle, unacknowledgedCount = 0 }: HeaderProps) {
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    currentDeviceStatus,
    isStale,
    lastRefreshedAt,
    refreshDevices,
  } = useDevices();

  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const lastSeen = currentDeviceStatus?.last_seen;

  useEffect(() => {
    if (!lastSeen) return;

    const updateAgo = () => {
      setSecondsAgo(getDeviceSecondsAgo(lastSeen));
    };

    updateAgo();
    const interval = setInterval(updateAgo, 1000);
    return () => clearInterval(interval);
  }, [lastSeen]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshDevices();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const onlineCount = devices.filter((d) => !isDeviceStale(d.last_seen)).length;

  const isAllSelected = selectedDeviceId === 'all';
  const connectionType = currentDeviceStatus?.connection_type || (isStale ? 'offline' : 'simulation');

  return (
    <header
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* Left side: Hamburger (mobile) + Device Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onMenuToggle}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="mobile-menu-btn"
          aria-label="Toggle Navigation Menu"
        >
          <Menu size={22} />
        </button>

        {/* Device Selector Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: '5px 12px',
            }}
          >
            <Cpu size={16} color="var(--color-accent)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
              Device:
            </span>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-primary)',
                fontSize: '0.8125rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="all" style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}>
                All Devices (Fleet Overview)
              </option>
              {devices.map((d) => (
                <option
                  key={d.device_id}
                  value={d.device_id}
                  style={{ backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-primary)' }}
                >
                  {d.device_id} {d.relay1_status === false ? '⚠️ (Tripped)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Connection Status Badge */}
          {isAllSelected ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: onlineCount > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                }}
              />
              <span style={{ color: 'var(--color-text-primary)' }}>
                {onlineCount}/{devices.length} Online
              </span>
            </div>
          ) : (
            <ConnectionBadge type={connectionType} isStale={isStale} />
          )}
        </div>
      </div>

      {/* Right side: Live counter, Alerts shortcut, Refresh button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div
          className="header-last-seen"
          style={{
            fontSize: '0.8125rem',
            color: isStale && !isAllSelected ? 'var(--color-danger)' : 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: isStale && !isAllSelected ? 'var(--color-danger)' : 'var(--color-success)',
            }}
            className={!isStale || isAllSelected ? 'animate-pulse-glow' : undefined}
          />
          <span>
            {isAllSelected
              ? `Fleet active: ${devices.length} nodes`
              : lastSeen
              ? isStale
                ? `Offline (${secondsAgo}s ago)`
                : `Updated ${secondsAgo}s ago`
              : 'Waiting for heartbeat...'}
          </span>
        </div>

        {/* Quick Alerts Bell */}
        <Link
          href="/alerts"
          title="View Alerts"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: unacknowledgedCount > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Bell size={18} />
          {unacknowledgedCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                backgroundColor: 'var(--color-danger)',
                color: '#fff',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '1px 5px',
                borderRadius: 'var(--radius-full)',
                lineHeight: 1.2,
                boxShadow: '0 0 6px var(--color-danger-bg)',
              }}
            >
              {unacknowledgedCount}
            </span>
          )}
        </Link>

        {/* Manual Refresh Button */}
        <button
          onClick={handleRefresh}
          title="Refresh Data"
          disabled={isRefreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
            cursor: isRefreshing ? 'wait' : 'pointer',
            transition: 'all var(--transition-fast)',
          }}
        >
          <RefreshCw
            size={16}
            style={{
              animation: isRefreshing ? 'pulse 1s linear infinite' : 'none',
              transform: isRefreshing ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.5s ease',
            }}
          />
        </button>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .mobile-menu-btn {
            display: flex !important;
          }
          .header-last-seen {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
