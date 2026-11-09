import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { secretHpHistory } from '../game/selectors';
import type { GameState } from '../game/state';
import { RoundLabelText } from './RoundLabelText';

/**
 * 結果発表のHP推移（SPEC 3.10、DECISIONS D-08）。自前の SVG 折れ線グラフ。
 * - 系列の色は席順で固定の順に割り当てる（並び替えや順位で塗り替えない）
 * - 凡例は常に表示し、色だけに頼らないよう表（数値）でも見られるようにする
 * - なぞる／タップするとそのターンの全員のHPを表示する
 */

const VIEW = { width: 340, height: 210 };
const PAD = { left: 34, right: 12, top: 12, bottom: 26 };
const MAX_X_LABELS = 8;
const Y_TICK_TARGET = 4;

/** 目盛りの間隔を 1・2・5 × 10^n に丸める */
function niceStep(raw: number): number {
  const power = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

export function HpChart({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const titleId = useId();
  const descId = useId();
  const history = useMemo(() => secretHpHistory(game), [game]);
  const [active, setActive] = useState<number | null>(null);

  const players = game.players;
  const count = history.length;
  const observedMax = Math.max(game.config.maxHp, ...history.flatMap((h) => Object.values(h.hp)));
  const yStep = niceStep(observedMax / Y_TICK_TARGET);
  const yMax = Math.ceil(observedMax / yStep) * yStep;
  const yTicks = Array.from({ length: yMax / yStep + 1 }, (_, i) => i * yStep);

  const plotW = VIEW.width - PAD.left - PAD.right;
  const plotH = VIEW.height - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (count <= 1 ? plotW / 2 : (i * plotW) / (count - 1));
  const yAt = (hp: number) => PAD.top + plotH - (hp / yMax) * plotH;
  const labelEvery = Math.ceil(count / MAX_X_LABELS);

  const xLabel = (i: number) =>
    i === 0 ? t('final.chartStart') : t('final.chartRound', { number: i });

  const pickIndex = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect || rect.width === 0 || count <= 1) return;
    const x = ((e.clientX - rect.left) / rect.width) * VIEW.width;
    const index = Math.round(((x - PAD.left) / plotW) * (count - 1));
    setActive(Math.min(count - 1, Math.max(0, index)));
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(count - 1, (a ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? count) - 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const activePoint = active === null ? null : history[active];
  const activeRecord =
    activePoint && activePoint.recordIndex !== null ? game.records[activePoint.recordIndex] : null;

  return (
    <figure className="hp-chart">
      <figcaption id={titleId} className="section-title">
        {t('final.chartTitle')}
      </figcaption>

      <ul className="hp-chart__legend">
        {players.map((p, i) => (
          <li key={p.id}>
            <span className="hp-chart__key" style={{ background: `var(--series-${i + 1})` }} />
            {p.name}
          </li>
        ))}
      </ul>

      <div className="hp-chart__plot">
        <svg
          viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
          role="img"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          <desc id={descId}>{t('final.chartDescription')}</desc>
          {yTicks.map((v) => (
            <g key={v}>
              <line
                className={v === 0 ? 'hp-chart__baseline' : 'hp-chart__grid'}
                x1={PAD.left}
                x2={VIEW.width - PAD.right}
                y1={yAt(v)}
                y2={yAt(v)}
              />
              <text
                className="hp-chart__tick"
                x={PAD.left - 6}
                y={yAt(v)}
                dy="0.32em"
                textAnchor="end"
              >
                {v}
              </text>
            </g>
          ))}
          {history.map((_, i) =>
            i % labelEvery === 0 || i === count - 1 ? (
              <text
                key={i}
                className="hp-chart__tick"
                x={xAt(i)}
                y={VIEW.height - 8}
                textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'}
              >
                {xLabel(i)}
              </text>
            ) : null,
          )}

          {active !== null ? (
            <line
              className="hp-chart__crosshair"
              x1={xAt(active)}
              x2={xAt(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
            />
          ) : null}

          {players.map((p, i) => (
            <path
              key={p.id}
              className="hp-chart__line"
              style={{ stroke: `var(--series-${i + 1})` }}
              d={history
                .map((h, x) => `${x === 0 ? 'M' : 'L'}${xAt(x)},${yAt(h.hp[p.id] ?? 0)}`)
                .join(' ')}
            />
          ))}

          {/* 末尾（最終HP）と、選んでいるターンに印を付ける */}
          {players.map((p, i) => {
            const at = active ?? count - 1;
            return (
              <circle
                key={p.id}
                className="hp-chart__marker"
                style={{ fill: `var(--series-${i + 1})` }}
                cx={xAt(at)}
                cy={yAt(history[at]?.hp[p.id] ?? 0)}
                r={4}
              />
            );
          })}

          {/* 当たり判定は線より広く取る */}
          <rect
            className="hp-chart__hit"
            x={PAD.left - 8}
            y={0}
            width={plotW + 16}
            height={VIEW.height}
            onPointerDown={pickIndex}
            onPointerMove={pickIndex}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') setActive(null);
            }}
          />
        </svg>

        {activePoint ? (
          <div className="hp-chart__tooltip" role="status">
            <p className="hp-chart__tooltip-title">
              {activeRecord ? (
                <RoundLabelText label={activeRecord.label} maxCycles={game.config.maxCycles} />
              ) : (
                t('final.chartStart')
              )}
            </p>
            <ul>
              {players
                .map((p, i) => ({ p, i, hp: activePoint.hp[p.id] ?? 0 }))
                .sort((a, b) => b.hp - a.hp)
                .map(({ p, i, hp }) => (
                  <li key={p.id}>
                    <span
                      className="hp-chart__key"
                      style={{ background: `var(--series-${i + 1})` }}
                    />
                    <span className="hp-chart__tooltip-name">{p.name}</span>
                    <span className="hp-chart__tooltip-value">{hp}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </div>

      <details className="hp-chart__table">
        <summary>{t('final.chartTable')}</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col" />
                {players.map((p) => (
                  <th key={p.id} scope="col">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i}>
                  <th scope="row">{xLabel(i)}</th>
                  {players.map((p) => (
                    <td key={p.id}>{h.hp[p.id]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
