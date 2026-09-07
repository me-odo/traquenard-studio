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

test('references lab selects between same-type decks, traces the source, and enters a Composite', async ({
  page,
}) => {
  await page.goto('/lab/references');
  await page.getByRole('button', { name: 'A · Two decks' }).click();
  await page.getByRole('button', { name: 'Chips + navigation' }).click();

  const prototype = page.getByRole('region', {
    name: 'Chips + navigation reference prototype',
  });
  await prototype.getByRole('button', { name: /FROM change/ }).click();
  const questions = prototype.getByRole('button', { name: /Questions Deck.*Compatible/ });
  const challenges = prototype.getByRole('button', { name: /Challenges Deck.*Compatible/ });
  await expect(questions).toBeEnabled();
  await expect(challenges).toBeEnabled();
  await challenges.click();
  await expect(prototype.getByRole('heading', { name: 'Challenges Deck' })).toBeVisible();
  await prototype.getByRole('button', { name: 'Go to source' }).click();
  await expect(prototype.locator('#ref-node-game-values')).toHaveClass(/source-focused/);
  await prototype.getByRole('button', { name: 'Back' }).click();

  await page.getByRole('button', { name: 'D · Composite' }).click();
  await prototype.getByRole('button', { name: 'Open Prepare Turn →' }).click();
  await expect(prototype.getByText('Focused Composite')).toBeVisible();
  await expect(prototype.getByRole('heading', { name: 'Prepare Turn' })).toBeVisible();
  await prototype.getByRole('button', { name: 'Back' }).click();
  await expect(prototype.getByText('Parent flow')).toBeVisible();
  await expect(prototype.getByRole('button', { name: 'Open Prepare Turn →' })).toBeVisible();
});

test('references lab preserves mobile Composite context across source navigation', async ({
  page,
}) => {
  await page.goto('/lab/references');
  await page.getByRole('button', { name: 'D · Composite' }).click();
  await page.getByRole('button', { name: 'Chips + navigation' }).click();
  await page.getByRole('button', { name: 'Mobile' }).click();

  const prototype = page.getByRole('region', {
    name: 'Chips + navigation reference prototype',
  });
  await prototype.getByRole('button', { name: 'Open Prepare Turn →' }).click();
  const breadcrumb = prototype.getByRole('navigation', { name: 'Semantic location' });
  await expect(breadcrumb.getByText('Prepare Turn', { exact: true })).toBeVisible();
  await prototype
    .getByRole('button', { name: /INPUT · deck.*From parent: Questions Deck/ })
    .click();
  await expect(prototype.getByText('FROM PARENT SCOPE')).toBeVisible();
  await prototype.getByRole('button', { name: 'Go to source' }).click();
  await expect(prototype.getByRole('button', { name: 'Open Prepare Turn →' })).toBeVisible();
  await expect(prototype.locator('#ref-node-game-values')).toHaveClass(/source-focused/);

  await prototype.getByRole('button', { name: 'Back' }).click();
  await expect(breadcrumb.getByText('Prepare Turn', { exact: true })).toBeVisible();
  await expect(prototype.getByText('From parent: Questions Deck')).toBeVisible();
  await prototype.getByRole('button', { name: 'Back' }).click();
  await expect(prototype.getByRole('button', { name: 'Open Prepare Turn →' })).toBeVisible();
});
