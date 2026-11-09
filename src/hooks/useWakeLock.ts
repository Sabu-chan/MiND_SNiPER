import { useEffect } from 'react';

/**
 * 画面スリープを防ぐ（SPEC 3.1）。Wake Lock API に対応していない端末では何もしない。
 * タブが裏に回ると解除されるので、表に戻ったら取り直す。
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return undefined;
    }
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;

    const request = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed) void lock.release();
        else sentinel = lock;
      } catch {
        // 省電力モードなどで拒否された場合は無視する
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
