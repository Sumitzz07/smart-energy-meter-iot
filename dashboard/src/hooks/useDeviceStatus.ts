'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { DEVICE_ID, STALE_THRESHOLD_SECONDS } from '@/lib/constants';
import { DeviceStatus } from '@/lib/types';
import { parseTimestampMs, isDeviceStale } from '@/lib/device-status';

export function useDeviceStatus(targetDeviceId: string = DEVICE_ID) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchStatus() {
      try {
        const { data, error } = await supabase
          .from('device_status')
          .select('*')
          .eq('device_id', targetDeviceId)
          .single();

        if (!mounted) return;

        if (data && !error) {
          setStatus(data as DeviceStatus);
        }
      } catch (err) {
        console.error('Error fetching device status:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchStatus();

    const channelTopic = `devicestatus_${targetDeviceId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'device_status',
          filter: `device_id=eq.${targetDeviceId}`,
        },
        (payload) => {
          if (!mounted) return;
          const incoming = payload.new as DeviceStatus;
          setStatus((prev) => {
            if (!prev) return incoming;
            if (parseTimestampMs(incoming.last_seen) >= parseTimestampMs(prev.last_seen)) {
              return incoming;
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [targetDeviceId]);

  useEffect(() => {
    if (!status) return;

    const checkStale = () => {
      setIsStale(isDeviceStale(status.last_seen));
    };

    checkStale();
    const interval = setInterval(checkStale, 1000);
    return () => clearInterval(interval);
  }, [status]);

  return { status, isStale, isLoading };
}
