import { useEffect } from 'react';

// Keeps the screen from dimming while a session is open (where the browser supports it).
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;

    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const request = async () => {
      try {
        const next = await navigator.wakeLock.request('screen');
        if (stopped) next.release();
        else lock = next;
      } catch {
        // Denied or unsupported: the session still works.
      }
    };

    // The browser drops the lock when the tab is hidden, so re-request on return.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') request();
    };

    request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      lock?.release();
    };
  }, [active]);
}
