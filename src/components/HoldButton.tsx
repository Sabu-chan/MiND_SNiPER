import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface HoldButtonProps {
  /** 発動までの長押し時間（ミリ秒） */
  durationMs: number;
  /** 長押しが完了したとき */
  onComplete: () => void;
  /** 長押しが完了したあとに指を離したとき（「お題を確認」で表示を消すのに使う） */
  onRelease?: () => void;
  children: ReactNode;
  className?: string;
  /** 押している間に読み上げる説明 */
  ariaLabel?: string;
}

/**
 * 長押しで発動するボタン（SPEC 3.1）。通常のタップでは発動しない。押している間は進捗ゲージを表示する。
 * 指（またはキーボードの Enter / Space）を離すと最初からやり直しになる。
 */
export function HoldButton({
  durationMs,
  onComplete,
  onRelease,
  children,
  className = '',
  ariaLabel,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frame = useRef<number | null>(null);
  const startedAt = useRef(0);
  const completed = useRef(false);
  const active = useRef(false);
  // 最新のコールバックを参照する（押している最中に親が再描画されても止めない）
  const callbacks = useRef({ onComplete, onRelease });
  useEffect(() => {
    callbacks.current = { onComplete, onRelease };
  });

  const clearTimers = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    timer.current = null;
    frame.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const begin = useCallback(() => {
    if (active.current) return;
    active.current = true;
    completed.current = false;
    startedAt.current = performance.now();
    setHolding(true);
    setProgress(0);
    const draw = () => {
      setProgress(Math.min(1, (performance.now() - startedAt.current) / durationMs));
      frame.current = requestAnimationFrame(draw);
    };
    frame.current = requestAnimationFrame(draw);
    timer.current = setTimeout(() => {
      clearTimers();
      completed.current = true;
      setProgress(1);
      callbacks.current.onComplete();
    }, durationMs);
  }, [durationMs, clearTimers]);

  const end = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    clearTimers();
    setHolding(false);
    setProgress(0);
    if (completed.current) callbacks.current.onRelease?.();
  }, [clearTimers]);

  return (
    <button
      type="button"
      className={`btn hold-button ${holding ? 'hold-button--holding' : ''} ${className}`}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        // マウスの右・中ボタンは無視する（タッチ・ペンは button が 0）
        if (e.button > 0) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin();
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
          e.preventDefault();
          begin();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') end();
      }}
      onBlur={end}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span
        className="hold-button__gauge"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden="true"
      />
      <span className="hold-button__label">{children}</span>
    </button>
  );
}
