'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { DeviceStatus, EnergyReading } from '@/lib/types';
import { DEVICE_ID, STALE_THRESHOLD_SECONDS, DASHBOARD_POLL_INTERVAL_MS } from '@/lib/constants';
import { parseTimestampMs, isDeviceStale } from '@/lib/device-status';

interface DeviceContextType {
  devices: DeviceStatus[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  currentDeviceStatus: DeviceStatus | null;
  latestReadingsMap: Record<string, EnergyReading>;
  isStale: boolean;
  isLoading: boolean;
  connectionError: string | null;
  lastRefreshedAt: Date | null;
  refreshDevices: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('all');
  const [latestReadingsMap, setLatestReadingsMap] = useState<Record<string, EnergyReading>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  const inFlightRef = useRef<boolean>(false);

  // Keep a local 1-second ticker for seamless clock & stale synchronization
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDevicesAndReadings = useCallback(async (isBackground: boolean = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      if (!isBackground) {
        setIsLoading(true);
      }

      // 1. Query device_status for all registered hardware nodes
      const { data: deviceData, error: deviceError } = await supabase
        .from('device_status')
        .select('*')
        .order('device_id', { ascending: true });

      if (deviceError) {
        console.error('Error fetching device statuses:', deviceError);
        setConnectionError(deviceError.message || 'Error fetching device statuses');
      } else if (deviceData && deviceData.length > 0) {
        setDevices((prev) => {
          if (prev.length === 0) return deviceData as DeviceStatus[];
          // Safe merge: only update device if incoming last_seen is newer or equal
          const next = [...prev];
          for (const incoming of (deviceData as DeviceStatus[])) {
            const idx = next.findIndex((d) => d.device_id === incoming.device_id);
            if (idx >= 0) {
              const current = next[idx];
              const incomingMs = parseTimestampMs(incoming.last_seen);
              const currentMs = parseTimestampMs(current.last_seen);
              if (incomingMs >= currentMs) {
                next[idx] = incoming;
              }
            } else {
              next.push(incoming);
            }
          }
          return next;
        });
        setConnectionError(null);
        setLastRefreshedAt(new Date());
      } else {
        // Fallback: If device_status row is temporarily absent, discover from recent readings
        const { data: fallbackReadings } = await supabase
          .from('energy_readings')
          .select('device_id, timestamp')
          .order('timestamp', { ascending: false })
          .limit(1);

        if (fallbackReadings && fallbackReadings.length > 0) {
          const fallbackDevId = fallbackReadings[0].device_id;
          setDevices([
            {
              device_id: fallbackDevId,
              connection_type: 'hardware',
              wifi_status: true,
              gsm_status: false,
              pzem_status: true,
              relay1_status: true,
              relay2_status: false,
              last_seen: fallbackReadings[0].timestamp,
            },
          ]);
        }
        setConnectionError(null);
        setLastRefreshedAt(new Date());
      }

      // 2. Fetch latest telemetry batch to populate initial latestReadingsMap
      const { data: readingsData, error: readingsError } = await supabase
        .from('energy_readings')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (!readingsError && readingsData) {
        const map: Record<string, EnergyReading> = {};
        for (const item of readingsData) {
          if (!map[item.device_id]) {
            map[item.device_id] = item as EnergyReading;
          }
        }
        setLatestReadingsMap((prev) => ({ ...prev, ...map }));
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
      setConnectionError(err instanceof Error ? err.message : String(err));
    } finally {
      inFlightRef.current = false;
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchDevicesAndReadings(false);

    // Periodic configurable background poll (4s) to reconcile heartbeat state in case Realtime events drop
    const pollInterval = setInterval(() => {
      fetchDevicesAndReadings(true);
    }, DASHBOARD_POLL_INTERVAL_MS);

    // Unique channel topic to prevent StrictMode collision
    const statusTopic = `device_status_sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const statusChannel = supabase
      .channel(statusTopic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_status' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const incoming = payload.new as DeviceStatus;
            setDevices((prev) => {
              const existingIdx = prev.findIndex((d) => d.device_id === incoming.device_id);
              if (existingIdx < 0) {
                return [...prev, incoming];
              }
              const current = prev[existingIdx];
              // Safe timestamp guard: never let older delayed Realtime events overwrite newer heartbeat
              const incomingMs = parseTimestampMs(incoming.last_seen);
              const currentMs = parseTimestampMs(current.last_seen);
              if (incomingMs >= currentMs) {
                const next = [...prev];
                next[existingIdx] = incoming;
                return next;
              }
              return prev;
            });
            setLastRefreshedAt(new Date());
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { device_id: string };
            setDevices((prev) => prev.filter((d) => d.device_id !== deleted.device_id));
          }
        }
      )
      .subscribe();

    // Global realtime listener for incoming energy_readings to update fleet map seamlessly
    const readingsTopic = `global_energy_readings_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const readingsChannel = supabase
      .channel(readingsTopic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'energy_readings' },
        (payload) => {
          const newReading = payload.new as EnergyReading;
          setLatestReadingsMap((prev) => ({
            ...prev,
            [newReading.device_id]: newReading,
          }));
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(statusChannel);
      supabase.removeChannel(readingsChannel);
    };
  }, [fetchDevicesAndReadings]);

  const currentDeviceStatus = useMemo(() => {
    if (selectedDeviceId === 'all') {
      return devices.length > 0 ? devices[0] : null;
    }
    return devices.find((d) => d.device_id === selectedDeviceId) || null;
  }, [devices, selectedDeviceId]);

  const isStale = useMemo(() => {
    return isDeviceStale(currentDeviceStatus?.last_seen, now, STALE_THRESHOLD_SECONDS);
  }, [currentDeviceStatus, now]);

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDeviceId,
        setSelectedDeviceId,
        currentDeviceStatus,
        latestReadingsMap,
        isStale,
        isLoading,
        connectionError,
        lastRefreshedAt,
        refreshDevices: () => fetchDevicesAndReadings(false),
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevices() {
  const context = useContext(DeviceContext);
  if (!context) {
    throw new Error('useDevices must be used within a DeviceProvider');
  }
  return context;
}
