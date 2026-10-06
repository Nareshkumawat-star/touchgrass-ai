"use client";

/**
 * Offline provider.
 *
 * Owns the device's network state, the queue of offline completions, and the
 * sync loop. It also registers the service worker. Any component can await
 * `syncNow()` after finishing a mission offline.
 */

import * as React from "react";
import {
  QUEUE_CHANGED_EVENT,
  flushQueue,
  getLastSync,
  listQueue,
  queueLength,
} from "@/lib/offline";

interface SyncResult {
  applied: number;
  failed: number;
  at: string;
}

interface OfflineContextValue {
  online: boolean;
  pending: number;
  /** True while a sync request is in flight. */
  syncing: boolean;
  lastSync: string | null;
  lastResult: SyncResult | null;
  syncNow: () => Promise<void>;
}

const OfflineContext = React.createContext<OfflineContextValue | null>(null);

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = React.useState(true);
  const [pending, setPending] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);
  const [lastSync, setLastSyncState] = React.useState<string | null>(null);
  const [lastResult, setLastResult] = React.useState<SyncResult | null>(null);

  const syncNow = React.useCallback(async () => {
    setSyncing(true);
    try {
      const result = await flushQueue();
      if (result.attempted > 0) {
        setLastResult({
          applied: result.applied,
          failed: result.failed,
          at: new Date().toISOString(),
        });
      }
    } catch {
      // Still offline or the server is down: the queue stays put.
    } finally {
      setSyncing(false);
      setPending(queueLength());
      setLastSyncState(getLastSync());
    }
  }, []);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    setPending(queueLength());
    setLastSyncState(getLastSync());

    const handleOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const handleOffline = () => setOnline(false);
    const handleQueue = () => setPending(queueLength());

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(QUEUE_CHANGED_EVENT, handleQueue);

    if (navigator.onLine) void syncNow();

    // Service worker: makes the app shell and the current mission available
    // without a connection.
    if ("serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, handleQueue);
    };
  }, [syncNow]);

  const value = React.useMemo<OfflineContextValue>(
    () => ({ online, pending, syncing, lastSync, lastResult, syncNow }),
    [online, pending, syncing, lastSync, lastResult, syncNow],
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline(): OfflineContextValue {
  const context = React.useContext(OfflineContext);
  if (!context) {
    return {
      online: true,
      pending: 0,
      syncing: false,
      lastSync: null,
      lastResult: null,
      syncNow: async () => undefined,
    };
  }
  return context;
}

/** Missions completed offline and not yet synced (for the mission screen). */
export function usePendingMissions() {
  const [entries, setEntries] = React.useState(listQueue());
  React.useEffect(() => {
    const update = () => setEntries(listQueue());
    window.addEventListener(QUEUE_CHANGED_EVENT, update);
    update();
    return () => window.removeEventListener(QUEUE_CHANGED_EVENT, update);
  }, []);
  return entries;
}
