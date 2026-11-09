import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ReorderListProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  /** 行の中身 */
  renderItem: (item: T, index: number) => ReactNode;
  /** 行の補足（並べ替えボタンの下に出す。入力欄など） */
  renderDetail?: (item: T, index: number) => ReactNode;
  onChange: (items: T[]) => void;
  /** 並べ替えボタンの読み上げ用に、行の名前を返す */
  getLabel: (item: T) => string;
  className?: string;
}

/** 上下ボタンで並べ替えるリスト（SPEC 3.3, 3.6）。片手で押せるよう、ボタンは行の右端に置く。 */
export function ReorderList<T>({
  items,
  getKey,
  renderItem,
  renderDetail,
  onChange,
  getLabel,
  className = '',
}: ReorderListProps<T>) {
  const { t } = useTranslation();
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [item] = next.splice(from, 1);
    if (item === undefined) return;
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <ol className={`reorder ${className}`}>
      {items.map((item, index) => (
        <li key={getKey(item)} className="reorder__row">
          <div className="reorder__main">
            <div className="reorder__content">{renderItem(item, index)}</div>
            <div className="reorder__buttons">
              <button
                type="button"
                className="icon-btn"
                aria-label={t('common.moveUp', { name: getLabel(item) })}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={t('common.moveDown', { name: getLabel(item) })}
                disabled={index === items.length - 1}
                onClick={() => move(index, index + 1)}
              >
                ▼
              </button>
            </div>
          </div>
          {renderDetail ? renderDetail(item, index) : null}
        </li>
      ))}
    </ol>
  );
}
