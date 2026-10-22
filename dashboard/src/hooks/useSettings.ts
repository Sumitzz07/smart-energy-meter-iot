'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { DEVICE_ID } from '@/lib/constants';
import { MeterSettings } from '@/lib/types';

export function useSettings(targetDeviceId: string = DEVICE_ID) {
  const [settings, setSettings] = useState<MeterSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from('meter_settings')
          .select('*')
          .eq('device_id', targetDeviceId)
          .single();

        if (!mounted) return;

        if (data && !error) {
          setSettings(data as MeterSettings);
        }
      } catch (err) {
        console.error('Error fetching meter settings:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchSettings();

    const channelTopic = `settings_${targetDeviceId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meter_settings',
          filter: `device_id=eq.${targetDeviceId}`,
        },
        (payload) => {
          if (!mounted) return;
          setSettings(payload.new as MeterSettings);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [targetDeviceId]);

  const updateSettings = async (newSettings: Partial<MeterSettings>): Promise<{ error: Error | null }> => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('meter_settings')
        .update(newSettings)
        .eq('device_id', targetDeviceId);

      if (error) {
        console.error('Error updating meter settings:', error);
        return { error: new Error(error.message) };
      }

      // Re-fetch fresh row directly from Supabase to guarantee exact database state
      const { data: updatedData } = await supabase
        .from('meter_settings')
        .select('*')
        .eq('device_id', targetDeviceId)
        .single();

      if (updatedData) {
        setSettings(updatedData as MeterSettings);
      } else {
        setSettings((prev) => (prev ? ({ ...prev, ...newSettings } as MeterSettings) : null));
      }
      return { error: null };
    } catch (err: any) {
      console.error('Unexpected error updating settings:', err);
      return { error: err instanceof Error ? err : new Error(String(err)) };
    } finally {
      setIsSaving(false);
    }
  };

  return { settings, updateSettings, isSaving, isLoading };
}
