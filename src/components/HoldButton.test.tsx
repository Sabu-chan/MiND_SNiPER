import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoldButton } from './HoldButton';

describe('HoldButton（SPEC 3.1：長押しで発動）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const onComplete = vi.fn<() => void>();
    const onRelease = vi.fn<() => void>();
    render(
      <HoldButton durationMs={1500} onComplete={onComplete} onRelease={onRelease}>
        開く
      </HoldButton>,
    );
    return { button: screen.getByRole('button', { name: '開く' }), onComplete, onRelease };
  }

  it('通常のタップでは発動しない', () => {
    const { button, onComplete } = setup();
    fireEvent.click(button);
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(200));
    fireEvent.pointerUp(button);
    act(() => vi.advanceTimersByTime(3000));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('指定時間押し続けると発動し、離すと onRelease', () => {
    const { button, onComplete, onRelease } = setup();
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(1499));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onRelease).not.toHaveBeenCalled();
    fireEvent.pointerUp(button);
    expect(onRelease).toHaveBeenCalledOnce();
  });

  it('途中で離すとやり直しになる', () => {
    const { button, onComplete } = setup();
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.pointerCancel(button);
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(1000));
    expect(onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(500));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('押している間は進捗ゲージが伸びる', () => {
    const { button } = setup();
    const gauge = button.querySelector('.hold-button__gauge') as HTMLElement;
    expect(gauge.style.transform).toBe('scaleX(0)');
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(750));
    const scale = Number(/scaleX\(([\d.]+)\)/.exec(gauge.style.transform)?.[1]);
    expect(scale).toBeGreaterThan(0.3);
    expect(scale).toBeLessThan(0.7);
    fireEvent.pointerUp(button);
    expect(gauge.style.transform).toBe('scaleX(0)');
  });

  it('キーボード（Enter / Space）の長押しでも発動する', () => {
    const { button, onComplete } = setup();
    fireEvent.keyDown(button, { key: ' ' });
    act(() => vi.advanceTimersByTime(1500));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it('右クリックは無視する', () => {
    const { button, onComplete } = setup();
    fireEvent.pointerDown(button, { button: 2 });
    act(() => vi.advanceTimersByTime(2000));
    expect(onComplete).not.toHaveBeenCalled();
  });
});
