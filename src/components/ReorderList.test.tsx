import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { dragByKeyboard } from '../test/renderRoute';
import { ReorderList } from './ReorderList';

function Harness({ initial }: { initial: string[] }) {
  const [items, setItems] = useState(initial);
  return (
    <ReorderList
      items={items}
      getKey={(s) => s}
      getLabel={(s) => s}
      onChange={setItems}
      renderItem={(s) => <span>{s}</span>}
      renderDetail={(s) => <input aria-label={`${s}のメモ`} />}
    />
  );
}

const order = () =>
  screen.getAllByRole('listitem').map((li) => li.querySelector('span')?.textContent);

describe('ReorderList（DECISIONS D-34：ドラッグ・アンド・ドロップ）', () => {
  it('各行に「≡」のつかみ手があり、上下ボタンはない', () => {
    render(<Harness initial={['A', 'B', 'C']} />);
    expect(screen.getAllByRole('button', { name: /を並べ替える$/ })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /を上へ|を下へ/ })).toBeNull();
  });

  it('つかみ手をキーボードで操作して上下に動かせる', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['A', 'B', 'C', 'D']} />);
    await dragByKeyboard(user, 'A', 2);
    expect(order()).toEqual(['B', 'C', 'A', 'D']);
    await dragByKeyboard(user, 'D', -3);
    expect(order()).toEqual(['D', 'B', 'C', 'A']);
  });

  it('Esc で持ち上げをやめると、並びは変わらない', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['A', 'B', 'C']} />);
    screen.getByRole('button', { name: 'Aを並べ替える' }).focus();
    await user.keyboard(' ');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Escape}');
    expect(order()).toEqual(['A', 'B', 'C']);
  });

  it('行の中の入力欄は、つかみ手とは別に操作できる', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['A', 'B']} />);
    await user.type(screen.getByRole('textbox', { name: 'Bのメモ' }), 'メモ');
    expect(screen.getByRole('textbox', { name: 'Bのメモ' })).toHaveValue('メモ');
    expect(order()).toEqual(['A', 'B']);
  });
});
