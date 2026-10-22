'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { EnergyReading, ChartDataPoint } from '@/lib/types';
import { DEVICE_ID, CHART_BUFFER_SIZE, DASHBOARD_POLL_INTERVAL_MS } from '@/lib/constants';
import { parseTimestampMs } from '@/lib/device-status';

export function useRealtimeReadings(targetDeviceId: string = DEVICE_ID) {
  const [latestReading, setLatestReading] = useState<EnergyReading | null>(null);
  const [chartBuffer, setChartBuffer] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastSuccessfulFetch, setLastSuccessfulFetch] = useState<Date | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const inFlightRef = useRef<boolean>(false);
  const latestTimestampRef = useRef<number>(0);

  // Helper to safely integrate a new reading into latestReading and chartBuffer
  const processNewReading = useCallback((newReading: EnergyReading) => {
    const readingTimeMs = parseTimestampMs(newReading.timestamp);
    if (readingTimeMs < latestTimestampRef.current) {
      // Ignore older out-of-order reading
      return;
    }
    latestTimestampRef.current = readingTimeMs;
    setLatestReading(newReading);

    const newPoint: ChartDataPoint = {
      time: new Date(readingTimeMs).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      timestamp: readingTimeMs,
      voltage: newReading.voltage,
      current_amps: newReading.current_amps,
      power: newReading.power,
    };

    setChartBuffer((prev) => {
      // Prevent duplicate points with identical or older timestamp
      const last = prev[prev.length - 1];
      if (last && last.timestamp >= newPoint.timestamp) {
        return prev;
      }
      const next = [...prev, newPoint];
      if (next.length > CHART_BUFFER_SIZE) {
        return next.slice(next.length - CHART_BUFFER_SIZE);
      }
      return next;
    });
  }, []);

  // Poll function to fetch the latest reading
  const pollLatestReading = useCallback(async (isInitial = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      if (isInitial) {
        setIsLoading(true);
      }

      if (isInitial) {
        // Initial fetch: get recent history for the chart
        const { data, error } = await supabase
          .from('energy_readings')
          .select('*')
          .eq('device_id', targetDeviceId)
          .order('timestamp', { ascending: false })
          .limit(CHART_BUFFER_SIZE);

        if (error) {
          setFetchError(error.message);
          return;
        }

        if (data && data.length > 0) {
          const latest = data[0] as EnergyReading;
          latestTimestampRef.current = parseTimestampMs(latest.timestamp);
          setLatestReading(latest);

          const initialPoints: ChartDataPoint[] = data
            .slice()
            .reverse()
            .map((item: EnergyReading) => {
              const ms = parseTimestampMs(item.timestamp);
              return {
                time: new Date(ms).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
                timestamp: ms,
                voltage: item.voltage,
                current_amps: item.current_amps,
                power: item.power,
              };
            });

          setChartBuffer(initialPoints);
          setLastSuccessfulFetch(new Date());
          setFetchError(null);
        }
      } else {
        // Periodic poll: fetch just the single latest reading
        const { data, error } = await supabase
          .from('energy_readings')
          .select('*')
          .eq('device_id', targetDeviceId)
          .order('timestamp', { ascending: false })
          .limit(1);

        if (error) {
          setFetchError(error.message);
          return;
        }

        if (data && data.length > 0) {
          processNewReading(data[0] as EnergyReading);
          setLastSuccessfulFetch(new Date());
          setFetchError(null);
        }
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      inFlightRef.current = false;
      if (isInitial) {
        setIsLoading(false);
      }
    }
  }, [targetDeviceId, processNewReading]);

  useEffect(() => {
    let mounted = true;
    latestTimestampRef.current = 0;

    // 1. Initial history fetch
    pollLatestReading(true);

    // 2. Continuous 4-second polling interval
    const intervalId = setInterval(() => {
      if (mounted) {
        pollLatestReading(false);
      }
    }, DASHBOARD_POLL_INTERVAL_MS);

    // 3. Supabase Realtime subscription for immediate instantaneous pushes
    const channelTopic = `readings_${targetDeviceId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const channel = supabase
      .channel(channelTopic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'energy_readings',
          filter: `device_id=eq.${targetDeviceId}`,
        },
        (payload) => {
          if (!mounted) return;
          processNewReading(payload.new as EnergyReading);
          setLastSuccessfulFetch(new Date());
          setFetchError(null);
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [targetDeviceId, pollLatestReading, processNewReading]);

  return {
    latestReading,
    chartBuffer,
    isLoading,
    lastSuccessfulFetch,
    fetchError,
  };
}
