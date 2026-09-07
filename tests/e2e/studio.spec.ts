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

test('inline references change a same-type source without changing semantic context', async ({
  page,
}) => {
  await page.goto('/lab/references');
  await page.getByRole('button', { name: 'A · Two decks' }).click();

  const prototype = page.getByRole('region', {
    name: 'Typed inline references reference prototype',
  });
  const breadcrumb = prototype.getByRole('navigation', { name: 'Semantic location' });

  await prototype
    .getByRole('button', { name: /Inspect Questions Deck reference for FROM/ })
    .click();
  await expect(
    prototype.getByText('INLINE INSPECTION · semantic context will not change'),
  ).toBeVisible();
  await expect(breadcrumb.getByText('Parent flow')).toBeVisible();
  await expect(prototype.getByRole('button', { name: 'Go to source' })).toHaveCount(0);

  await prototype
    .getByRole('complementary', { name: 'Reference details' })
    .getByRole('button', { name: 'Change source' })
    .click();
  await expect(prototype.getByRole('heading', { name: 'Choose source' })).toBeVisible();
  const questions = prototype.getByRole('button', { name: /Questions Deck.*Compatible/ });
  const challenges = prototype.getByRole('button', { name: /Challenges Deck.*Compatible/ });
  await expect(questions).toBeEnabled();
  await expect(challenges).toBeEnabled();
  await challenges.click();
  await expect(prototype.getByRole('heading', { name: 'Challenges Deck' })).toBeVisible();
  await expect(breadcrumb.getByText('Parent flow')).toBeVisible();
  await expect(breadcrumb.getByRole('button', { name: /Back/ })).toHaveCount(0);
});

test('semantic navigation replaces the active flow with a source context', async ({ page }) => {
  await page.goto('/lab/references');
  await page.getByRole('button', { name: 'B · Distant player' }).click();
  await page.getByRole('button', { name: 'References + semantic navigation' }).click();

  const prototype = page.getByRole('region', {
    name: 'References + semantic navigation reference prototype',
  });
  const askQuestion = prototype.locator('#ref-node-ask-current-player');
  await askQuestion
    .getByRole('button', { name: /Inspect Current Player reference for PARTICIPANT/ })
    .click();
  await expect(
    prototype.getByText('NAVIGATION AVAILABLE · Go to source opens another semantic context'),
  ).toBeVisible();
  await prototype.getByRole('button', { name: 'Go to source' }).click();

  const sourceContext = prototype.getByRole('region', {
    name: 'Source context for Current Player',
  });
  await expect(sourceContext).toBeVisible();
  await expect(
    sourceContext.getByRole('heading', { name: 'Current Player', exact: true, level: 2 }),
  ).toBeVisible();
  await expect(prototype.getByRole('list', { name: 'Control flow, top to bottom' })).toHaveCount(0);
  await expect(prototype.getByRole('button', { name: /Back/ })).toBeVisible();
});

test('reference navigation restores Composite and parent contexts on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab/references');
  await page.getByRole('button', { name: 'D · Composite' }).click();
  await page.getByRole('button', { name: 'References + semantic navigation' }).click();
  await page.getByRole('button', { name: 'Mobile' }).click();

  const prototype = page.getByRole('region', {
    name: 'References + semantic navigation reference prototype',
  });
  const breadcrumb = prototype.getByRole('navigation', { name: 'Semantic location' });
  const prepareTurn = prototype.locator('#ref-node-prepare-turn');
  await prepareTurn.getByRole('button', { name: 'Select block' }).click();
  await prepareTurn.getByRole('button', { name: 'Enter Composite' }).click();

  await expect(prepareTurn).toHaveCount(0);
  await expect(breadcrumb.getByText('Prepare Turn', { exact: true })).toBeVisible();
  await expect(prototype.getByText('NAVIGATED SEMANTIC CONTEXT')).toBeVisible();
  await expect(prototype.locator('#ref-node-prepare-draw')).toBeVisible();

  await prototype
    .getByRole('button', { name: /INPUT · deck.*From parent: Questions Deck/ })
    .click();
  await expect(prototype.getByText('FROM PARENT SCOPE')).toBeVisible();
  await prototype.getByRole('button', { name: 'Go to source' }).click();

  await expect(
    prototype.getByRole('region', { name: 'Source context for Questions Deck' }),
  ).toBeVisible();
  await expect(prototype.locator('#ref-node-prepare-draw')).toHaveCount(0);
  await expect(prototype.getByText('NAVIGATED SEMANTIC CONTEXT · SOURCE')).toBeVisible();

  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(breadcrumb.getByText('Prepare Turn', { exact: true })).toBeVisible();
  await expect(prototype.getByText('NAVIGATED SEMANTIC CONTEXT')).toBeVisible();
  await expect(prototype.locator('#ref-node-prepare-draw')).toBeVisible();

  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(
    'Prepare Turn with typed ports',
  );
  await expect(prototype.getByText('CURRENT FLOW CONTEXT')).toBeVisible();
  await expect(prototype.getByRole('button', { name: /Back/ })).toHaveCount(0);
  await expect(prototype.locator('#ref-node-prepare-turn')).toBeVisible();
});

test('reference variants remain width-safe at a 390 px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab/references');
  await page.getByRole('button', { name: 'Mobile' }).click();

  for (const variant of ['Typed inline references', 'References + semantic navigation']) {
    await page.getByRole('button', { name: variant, exact: true }).click();
    const prototype = page.getByRole('region', { name: `${variant} reference prototype` });
    await expect(prototype).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(
      await prototype
        .locator('.reference-canvas-wrap')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
  }
});

test('deleting a producer reports dangling references and reset restores it', async ({ page }) => {
  await page.goto('/lab/references');
  const prototype = page.getByRole('region', {
    name: 'Typed inline references reference prototype',
  });
  const choosePlayer = prototype.locator('#ref-node-choose-player');
  await choosePlayer.getByRole('button', { name: 'Select block' }).click();
  await choosePlayer.getByRole('button', { name: 'Delete block' }).click();

  await expect(choosePlayer).toHaveCount(0);
  await expect(prototype.getByText('LAB WORKING COPY · TEMPORARILY INVALID')).toBeVisible();
  await expect(
    prototype.getByText(
      'Prepare Turn still references Current Player, produced by deleted block Choose Player.',
    ),
  ).toBeVisible();
  await expect(prototype.getByText(/canonical source unchanged/)).toBeVisible();

  await prototype.getByRole('button', { name: 'Reset to canonical fixture' }).click();
  await expect(prototype.locator('#ref-node-choose-player')).toBeVisible();
  await expect(prototype.getByText('LAB WORKING COPY · MATCHES CANONICAL FIXTURE')).toBeVisible();
  await expect(prototype.getByRole('list', { name: 'Working copy diagnostics' })).toHaveCount(0);
});
