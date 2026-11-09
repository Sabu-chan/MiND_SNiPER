import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../app/storage';
import { createDefaultConfig } from '../game/config';
import { createGame } from '../game/reducer';
import { validateDictionary } from '../game/dictionary';
import { memoryStorage } from '../test/memoryStorage';
import { renderRoute } from '../test/renderRoute';

const field = (name: string) => screen.getByRole('spinbutton', { name });

describe('CONFIG（SPEC 3.12, 4章）', () => {
  it('第4章の項目を初期値で表示する', () => {
    renderRoute('/config');
    expect(field('開始HP')).toHaveValue(100);
    expect(field('上限HP')).toHaveValue(120);
    expect(field('1射目')).toHaveValue(50);
    expect(field('5射目')).toHaveValue(10);
    expect(field('1番目')).toHaveValue(10);
    expect(field('誤射ダメージ')).toHaveValue(5);
    expect(field('逃げ切り回復量')).toHaveValue(20);
    expect(field('ラウンド上限')).toHaveValue(3);
    expect(field('延長戦のダメージ倍率')).toHaveValue(2);
    expect(field('サドンデスのダメージ倍率')).toHaveValue(1);
    expect(field('ランダム出題の引き直し回数')).toHaveValue(1);
    expect(field('秘密情報ボタンの長押し時間（秒）')).toHaveValue(1.5);
    expect(screen.getByRole('radio', { name: 'サドンデス' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('combobox', { name: '表示言語' })).toHaveValue('ja');
  });

  it('変更を保存すると localStorage に残り、次に開いたときも反映される', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const first = renderRoute('/config', { storage });
    await user.clear(field('ラウンド上限'));
    await user.type(field('ラウンド上限'), '5');
    await user.click(screen.getByRole('radio', { name: '引き分け' }));
    await user.clear(field('秘密情報ボタンの長押し時間（秒）'));
    await user.type(field('秘密情報ボタンの長押し時間（秒）'), '2.5');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText('保存しました')).toBeVisible();
    expect(loadConfig(storage, ['ja'])).toMatchObject({
      status: 'ok',
      value: { maxCycles: 5, tiebreak: 'draw', holdDurationMs: 2500 },
    });
    first.unmount();

    renderRoute('/config', { storage });
    expect(field('ラウンド上限')).toHaveValue(5);
  });

  it('範囲外の値は保存しない', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    renderRoute('/config', { storage });
    await user.clear(field('ラウンド上限'));
    await user.type(field('ラウンド上限'), '11');
    expect(screen.getByText('1〜10の範囲で入力してください')).toBeVisible();
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();

    await user.clear(field('ラウンド上限'));
    expect(screen.getByText('整数で入力してください')).toBeVisible();

    await user.clear(field('ラウンド上限'));
    await user.type(field('ラウンド上限'), '3');
    await user.clear(field('上限HP'));
    await user.type(field('上限HP'), '99');
    expect(screen.getByText('100〜999の範囲で入力してください')).toBeVisible();

    await user.clear(field('上限HP'));
    await user.type(field('上限HP'), '120');
    await user.clear(field('3射目'));
    await user.type(field('3射目'), '45');
    expect(screen.getByText('前の値より小さくしてください（大きい順）')).toBeVisible();
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    expect(storage.length).toBe(0);
  });

  it('戦法防止の制約を満たさなければ警告するが、保存はできる', async () => {
    const user = userEvent.setup();
    renderRoute('/config');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.clear(field('2射目'));
    await user.type(field('2射目'), '45');
    expect(screen.getByRole('alert')).toHaveTextContent('最小5');
    expect(screen.getByRole('alert')).toHaveTextContent('最大差（8）');
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(screen.getByText('保存しました')).toBeVisible();
  });

  it('デフォルトに戻す（確認あり）', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    renderRoute('/config', {
      storage,
      initialConfig: { ...createDefaultConfig(), maxCycles: 7 },
    });
    expect(field('ラウンド上限')).toHaveValue(7);
    await user.click(screen.getByRole('button', { name: 'デフォルトに戻す' }));
    const dialog = screen.getByRole('dialog', { name: 'デフォルトに戻しますか？' });
    await user.click(within(dialog).getByRole('button', { name: '戻す' }));
    expect(field('ラウンド上限')).toHaveValue(3);
    expect(loadConfig(storage, ['ja'])).toMatchObject({ status: 'ok', value: { maxCycles: 3 } });
  });

  it('辞書のカテゴリごとに有効・無効を切り替えられる', async () => {
    const user = userEvent.setup();
    const storage = memoryStorage();
    const dictionary = validateDictionary(
      {
        version: 1,
        lang: 'ja',
        name: 'テスト',
        categories: [
          { id: 'm', label: '山' },
          { id: 'f', label: '食べ物' },
        ],
        entries: [{ id: 'fuji', word: '富士山', category: 'm' }],
      },
      't.json',
    ).value;
    renderRoute('/config', {
      storage,
      loadDictionaries: () =>
        Promise.resolve({ value: dictionary ? [dictionary] : [], warnings: [] }),
    });
    const food = await screen.findByRole('checkbox', { name: '食べ物' });
    expect(food).toBeChecked();
    await user.click(food);
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(loadConfig(storage, ['ja'])).toMatchObject({
      status: 'ok',
      value: { disabledCategoryIds: ['f'] },
    });
  });

  it('ゲーム中に開くと「変更は次の試合から反映」と表示する', () => {
    renderRoute('/config', {
      initialGame: createGame(
        [
          { id: 'a', name: 'A' },
          { id: 'b', name: 'B' },
          { id: 'c', name: 'C' },
        ],
        createDefaultConfig(),
      ),
    });
    expect(screen.getByText('変更は次の試合から反映されます。')).toBeVisible();
  });
});

describe('ルール説明（SPEC 3.11）', () => {
  it('現在の CONFIG 値を差し込んで表示する', () => {
    renderRoute('/rules', {
      initialConfig: {
        ...createDefaultConfig(),
        startHp: 150,
        missDamage: 7,
        maxCycles: 4,
        overtimeMultiplier: 3,
      },
    });
    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('全員HP150で始まります');
    expect(main).toHaveTextContent('回数点は1射目から順に 50・40・30・20・10');
    expect(main).toHaveTextContent('通常時の最大は60');
    expect(main).toHaveTextContent('答えた狙撃手に7のダメージ');
    expect(main).toHaveTextContent('全員が4回ずつ標的を務めたら（4ラウンド）');
    expect(main).toHaveTextContent('延長戦（ダメージ3倍）');
    expect(main).toHaveTextContent('狙撃手は、回答するときに調べてはいけません');
    expect(main).toHaveTextContent('同じ端末・同じブラウザだけです');
  });

  it('引き分け方式ならその説明を出す', () => {
    renderRoute('/rules', { initialConfig: { ...createDefaultConfig(), tiebreak: 'draw' } });
    expect(screen.getByRole('main')).toHaveTextContent('その全員の引き分けです');
    expect(screen.getByRole('main')).not.toHaveTextContent('サドンデス（');
  });
});
