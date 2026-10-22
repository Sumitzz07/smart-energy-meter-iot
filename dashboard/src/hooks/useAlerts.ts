'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { DEVICE_ID } from '@/lib/constants';
import { Alert } from '@/lib/types';

export function useAlerts(targetDeviceId: string = DEVICE_ID) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isAllDevices = targetDeviceId === 'all';

  useEffect(() => {
    let mounted = true;

    // 1. Initial fetch of alerts
    async function fetchAlerts() {
      try {
        let query = supabase
          .from('alerts')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(50);

        if (!isAllDevices) {
          query = query.eq('device_id', targetDeviceId);
        }

        const { data, error } = await query;

        if (!mounted) return;

        if (error) {
          console.error('Error fetching alerts:', error);
        } else if (data) {
          setAlerts(data as Alert[]);
        }
      } catch (err) {
        console.error('Unexpected error fetching alerts:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchAlerts();

    // 2. Create a uniquely named channel instance
    const channelTopic = `alerts_${targetDeviceId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const changeOptions: any = {
      event: '*',
      schema: 'public',
      table: 'alerts',
    };

    if (!isAllDevices) {
      changeOptions.filter = `device_id=eq.${targetDeviceId}`;
    }

    const channel = supabase
      .channel(channelTopic)
      .on('postgres_changes', changeOptions, (payload: any) => {
        if (!mounted) return;

        if (payload.eventType === 'INSERT') {
          const newAlert = payload.new as Alert;
          setAlerts((prev) => {
            if (prev.some((a) => a.id === newAlert.id)) {
              return prev.map((a) => (a.id === newAlert.id ? newAlert : a));
            }
            const next = [newAlert, ...prev];
            return next.length > 50 ? next.slice(0, 50) : next;
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedAlert = payload.new as Alert;
          setAlerts((prev) =>
            prev.map((a) => (a.id === updatedAlert.id ? updatedAlert : a))
          );
        } else if (payload.eventType === 'DELETE') {
          const deleted = payload.old as { id: string };
          setAlerts((prev) => prev.filter((a) => a.id !== deleted.id));
        }
      })
      .subscribe();

    // 3. Proper cleanup
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [targetDeviceId, isAllDevices]);

  const acknowledgeAlert = async (id: string) => {
    // Optimistic update
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
    try {
      await supabase.from('alerts').update({ acknowledged: true }).eq('id', id);
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const acknowledgeAll = async () => {
    // Optimistic update
    setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
    try {
      let query = supabase.from('alerts').update({ acknowledged: true });
      if (!isAllDevices) {
        query = query.eq('device_id', targetDeviceId);
      }
      await query.eq('acknowledged', false);
    } catch (err) {
      console.error('Failed to acknowledge all alerts:', err);
    }
  };

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return { alerts, unacknowledgedCount, acknowledgeAlert, acknowledgeAll, isLoading };
}
