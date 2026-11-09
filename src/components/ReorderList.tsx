import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ReorderListProps<T> {
  items: readonly T[];
  getKey: (item: T) => string;
  /** 行の中身 */
  renderItem: (item: T, index: number) => ReactNode;
  /** 行の補足（行の下に出す。入力欄など） */
  renderDetail?: (item: T, index: number) => ReactNode;
  onChange: (items: T[]) => void;
  /** つかみ手と読み上げ用に、行の名前を返す */
  getLabel: (item: T) => string;
  className?: string;
}

/**
 * ドラッグ・アンド・ドロップで並べ替えるリスト（SPEC 3.3, 3.6、DECISIONS D-34）。
 * 行の右端の「≡」（つかみ手）を押さえて動かす。指・マウス・キーボード（Space で持ち上げ、上下キーで移動）に対応する。
 * 入力欄やチェックをタップしたときに動かないよう、つかめるのはつかみ手だけにする。
 */
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
  const ids = items.map(getKey);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const labelOf = (id: UniqueIdentifier) => {
    const item = items.find((it) => getKey(it) === String(id));
    return item === undefined ? '' : getLabel(item);
  };
  const positionOf = (id: UniqueIdentifier | undefined) =>
    id === undefined ? 0 : ids.indexOf(String(id)) + 1;

  // 読み上げ（スクリーンリーダー）の文言
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('reorder.picked', { name: labelOf(active.id), position: positionOf(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t('reorder.moved', { name: labelOf(active.id), position: positionOf(over.id) }) : '',
    onDragEnd: ({ active, over }) =>
      over ? t('reorder.dropped', { name: labelOf(active.id), position: positionOf(over.id) }) : '',
    onDragCancel: ({ active }) => t('reorder.cancelled', { name: labelOf(active.id) }),
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onChange(arrayMove([...items], from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('reorder.instructions') },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ol className={`reorder ${className}`}>
          {items.map((item, index) => (
            <SortableRow key={getKey(item)} id={getKey(item)} label={getLabel(item)}>
              <div className="reorder__content">{renderItem(item, index)}</div>
              {renderDetail ? renderDetail(item, index) : null}
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const [content, detail] = Array.isArray(children) ? children : [children, null];

  return (
    <li
      ref={setNodeRef}
      className={`reorder__row ${isDragging ? 'reorder__row--dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <div className="reorder__main">
        {content}
        <button
          ref={setActivatorNodeRef}
          type="button"
          className="drag-handle"
          aria-label={t('reorder.handle', { name: label })}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">≡</span>
        </button>
      </div>
      {detail}
    </li>
  );
}
