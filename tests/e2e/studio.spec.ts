import { expect, test } from '@playwright/test';

test('author publishes, hosts, joins a second participant, and completes a game', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Traquenard Studio' })).toBeVisible();
  await expect(page.getByText('Ready to publish')).toBeVisible();

  await page.getByRole('button', { name: /Display prompt/ }).click();
  await expect(page.getByText('5 blocks')).toBeVisible();
  await page.getByRole('button', { name: 'Publish immutable v1' }).click();
  await page.getByRole('button', { name: 'Host session' }).click();
  await expect(page.getByText('PLAY01')).toBeVisible();

  await page.getByRole('button', { name: 'Join Alex on second device' }).click();
  await page.getByRole('button', { name: 'Submit Alex’s choice' }).click();
  await expect(page.getByText('Game completed deterministically.')).toBeVisible();
});

test('parallel lab projects one stress fixture through all three grammars and its outline', async ({
  page,
}) => {
  await page.goto('/lab/parallel');
  await page.getByRole('button', { name: '6-branch stress' }).click();
  await expect(page.getByRole('heading', { name: 'Six-branch scale stress' })).toBeVisible();

  for (const [grammar, joinLanguage] of [
    ['Parallel lanes', 'JOIN · ALL'],
    ['Fork / join graph', 'JOIN · ALL'],
    ['Grouped cards', 'Wait for all, then continue'],
  ] as const) {
    await page.getByRole('button', { name: grammar, exact: true }).click();
    const prototype = page.getByRole('region', { name: `${grammar} prototype` });
    await expect(prototype.getByText('BRANCH 6', { exact: true })).toBeVisible();
    await expect(prototype.getByText(joinLanguage)).toBeVisible();
  }

  await expect(page.getByText('Outline fallback · Six-branch scale stress')).toBeVisible();
  await expect(page.getByText('Branch 6 · Audience · everyone')).toBeVisible();
});

test('parallel lab supports mobile tap insertion and branch removal without changing the source', async ({
  page,
}) => {
  await page.goto('/lab/parallel');
  await page.getByRole('button', { name: 'Mobile' }).click();
  const prototype = page.getByRole('region', { name: 'Parallel lanes prototype' });
  await prototype.getByRole('button', { name: /Add lane/ }).click();

  const focusedEditor = prototype.getByRole('region', { name: 'Focused editor for branch 4' });
  await expect(focusedEditor).toBeVisible();
  await expect(prototype.getByText('Start the round together.')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Empty branch' })).toBeVisible();
  await page.getByRole('button', { name: /Logical timer/ }).click();
  await expect(page.getByRole('heading', { name: 'Logical timer' })).toBeVisible();
  await expect(page.getByText('3 canonical branches')).toBeVisible();
  await expect(page.getByText('4 in working projection')).toBeVisible();

  await page.getByRole('button', { name: 'Parallel overview' }).click();
  await expect(focusedEditor).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Parallel authoring actions' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Logical timer/ })).toHaveCount(0);
  await expect(prototype.getByText('Start the round together.')).toBeVisible();
  await expect(page.getByText('Branch 4 · System · logical time')).toBeVisible();
  await page.getByRole('button', { name: 'Edit branch 4' }).click();
  await expect(focusedEditor).toBeVisible();
  await page.getByRole('button', { name: 'Remove this branch' }).click();
  await expect(focusedEditor).toHaveCount(0);
  await expect(page.getByText('3 in working projection')).toBeVisible();
  await expect(page.getByText('Branch 4 · System · logical time')).not.toBeVisible();
});
