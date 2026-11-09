import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { initI18n } from '../i18n';

initI18n('ja');

afterEach(() => {
  cleanup();
});

/**
 * jsdom は配置を計算しないので、並べ替えリストの行（.reorder__row）に縦に並んだ位置を与える。
 * これで @dnd-kit のキーボード操作による並べ替えをテストできる。
 */
const ROW_HEIGHT = 60;
const originalRect = Element.prototype.getBoundingClientRect;
Element.prototype.getBoundingClientRect = function getBoundingClientRect(this: Element) {
  const row = this.closest('.reorder__row');
  if (row?.parentElement) {
    const index = [...row.parentElement.children].indexOf(row);
    const top = index * ROW_HEIGHT;
    const rect = {
      x: 0,
      y: top,
      top,
      left: 0,
      width: 300,
      height: 50,
      right: 300,
      bottom: top + 50,
    };
    return { ...rect, toJSON: () => rect } as DOMRect;
  }
  return originalRect.call(this);
};
