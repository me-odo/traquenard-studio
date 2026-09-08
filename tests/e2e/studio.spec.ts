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

test('project navigation identifies the Studio foundation and current authoring lab', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('FOUNDATION · IR v1')).toBeVisible();
  await expect(
    page.getByText('Executable Studio and runtime proof—not the final editor.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Visual Lab' })).toHaveAttribute('href', '/lab');
  await expect(page.getByRole('link', { name: 'Current authoring lab' })).toHaveAttribute(
    'href',
    '/lab/authoring',
  );
});

test('visual lab prioritizes active work, retains supporting labs, and retires the framework route', async ({
  page,
}) => {
  await page.goto('/lab');
  await expect(page.getByRole('heading', { name: 'Active authoring work' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Core authoring grammar/ })).toHaveAttribute(
    'href',
    '/lab/authoring',
  );
  await expect(page.getByRole('link', { name: /parallel execution grammars/ })).toHaveAttribute(
    'href',
    '/lab/parallel',
  );
  await expect(page.getByRole('link', { name: /Edit typed references/ })).toHaveAttribute(
    'href',
    '/lab/references',
  );
  await expect(page.locator('a[href="/lab/framework-spike"]')).toHaveCount(0);

  await page.goto('/lab/authoring');
  await expect(page.getByText('AUTHORING EXPERIMENT · ISSUE #6')).toBeVisible();
  await page.goto('/lab/parallel');
  await expect(page.getByRole('heading', { name: 'Parallel, three ways' })).toBeVisible();
  await page.goto('/lab/references');
  await expect(page.getByRole('heading', { name: 'Reference editor' })).toBeVisible();

  await page.goto('/lab/framework-spike');
  await expect(page.getByRole('heading', { name: 'Traquenard Studio' })).toBeVisible();
  await expect(page.getByText('Compare structured authoring frameworks')).toHaveCount(0);
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

test('reference editor selects blocks directly and changes a typed source locally', async ({
  page,
}) => {
  await page.goto('/lab/references');
  await page.getByText('Experiment settings').click();
  await page.getByRole('button', { name: 'A · Two decks' }).click();
  const prototype = page.getByRole('region', { name: 'Scoped reference editor prototype' });
  const breadcrumb = prototype.getByRole('navigation', { name: 'Semantic location' });

  const draw = prototype.locator('#ref-node-draw-question');
  await draw.click({ position: { x: 20, y: 20 } });
  await expect(draw).toHaveAttribute('aria-label', 'Draw Card step, selected');
  await expect(prototype.getByRole('button', { name: 'Select block' })).toHaveCount(0);

  await prototype
    .getByRole('button', { name: /Inspect Questions Deck reference for FROM/ })
    .click();
  await expect(
    prototype.getByRole('region', { name: 'Reference inspector for Questions Deck' }),
  ).toBeVisible();
  await expect(breadcrumb.getByRole('button', { name: /Back/ })).toHaveCount(0);

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
  await expect(
    prototype.getByRole('region', { name: 'Reference inspector for Challenges Deck' }),
  ).toBeVisible();
  await expect(breadcrumb.getByRole('button', { name: /Back/ })).toHaveCount(0);
});

test('local inspection and explicit source navigation have different context effects', async ({
  page,
}) => {
  await page.goto('/lab/references');
  await page.getByText('Experiment settings').click();
  await page.getByRole('button', { name: 'B · Distant player' }).click();
  const prototype = page.getByRole('region', { name: 'Scoped reference editor prototype' });
  const askQuestion = prototype.locator('#ref-node-ask-current-player');
  await askQuestion
    .getByRole('button', { name: /Inspect Current Player reference for PARTICIPANT/ })
    .click();
  await expect(prototype.getByRole('list', { name: 'Game flow, top to bottom' })).toBeVisible();
  await expect(prototype.getByRole('button', { name: /Back/ })).toHaveCount(0);
  await prototype.getByRole('button', { name: 'Go to source' }).click();

  const sourceContext = prototype.getByRole('region', {
    name: 'Source context for Current Player',
  });
  await expect(sourceContext).toBeVisible();
  await expect(
    sourceContext.getByRole('heading', { name: 'Current Player', exact: true, level: 2 }),
  ).toBeVisible();
  await expect(prototype.getByRole('list', { name: 'Game flow, top to bottom' })).toHaveCount(0);
  await expect(prototype.getByRole('button', { name: /Back/ })).toBeVisible();
  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(
    prototype.getByRole('region', { name: 'Reference inspector for Current Player' }),
  ).toBeVisible();
});

test('desktop Composite source navigation restores the inspector and parent invocation', async ({
  page,
}) => {
  await page.goto('/lab/references');
  await page.getByText('Experiment settings').click();
  await page.getByRole('button', { name: 'D · Composite' }).click();
  const prototype = page.getByRole('region', { name: 'Scoped reference editor prototype' });
  const breadcrumb = prototype.getByRole('navigation', { name: 'Semantic location' });
  const invocation = prototype.locator('#ref-node-prepare-turn');

  await invocation.click({ position: { x: 20, y: 20 } });
  await invocation.getByRole('button', { name: 'Enter Composite' }).click();
  await expect(prototype.locator('#ref-node-prepare-draw')).toBeVisible();

  await prototype.getByRole('button', { name: /Inspect Deck reference for FROM/ }).click();
  await expect(
    prototype.getByRole('region', { name: 'Reference inspector for Deck' }),
  ).toBeVisible();
  await prototype.getByRole('button', { name: 'Go to source' }).click();
  await expect(
    prototype.getByRole('region', { name: 'Source context for Questions Deck' }),
  ).toBeVisible();

  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(
    prototype.getByRole('region', { name: 'Reference inspector for Deck' }),
  ).toBeVisible();
  await prototype.getByRole('button', { name: 'Close reference inspector' }).click();
  await expect(breadcrumb.getByText('Prepare Turn', { exact: true })).toBeVisible();
  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(prototype.locator('#ref-node-prepare-turn')).toHaveAttribute(
    'aria-label',
    'Prepare Turn step, selected',
  );
});

test('mobile uses an exclusive flow, block, reference, source picker, source, and Composite stack', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab/references');
  await page.getByText('Experiment settings').click();
  await page.getByRole('button', { name: 'D · Composite' }).click();
  await page.getByText('Experiment settings').click();
  await page.getByRole('button', { name: 'Mobile · 390 px' }).click();
  const prototype = page.getByRole('region', { name: 'Scoped reference editor prototype' });
  const breadcrumb = prototype.getByRole('navigation', { name: 'Semantic location' });
  const prepareTurn = prototype.locator('#ref-node-prepare-turn');
  await prepareTurn.click({ position: { x: 20, y: 20 } });

  await expect(prototype.getByRole('region', { name: 'Editing Prepare Turn' })).toBeVisible();
  await expect(prototype.getByRole('list', { name: 'Game flow, top to bottom' })).toHaveCount(0);
  await prototype.getByRole('button', { name: 'Enter Composite' }).click();

  await expect(prepareTurn).toHaveCount(0);
  await expect(breadcrumb.getByText('Prepare Turn', { exact: true })).toBeVisible();
  await expect(prototype.locator('#ref-node-prepare-draw')).toBeVisible();

  await prototype.locator('#ref-node-prepare-draw').click({ position: { x: 20, y: 20 } });
  await expect(prototype.getByRole('region', { name: 'Editing Draw Card' })).toBeVisible();
  await prototype.getByRole('button', { name: /Inspect Deck reference for FROM/ }).click();
  await expect(
    prototype.getByRole('region', { name: 'Reference inspector for Deck' }),
  ).toBeVisible();
  await prototype.getByRole('button', { name: 'Change source' }).click();
  await expect(prototype.getByRole('region', { name: 'Choose source for FROM' })).toBeVisible();
  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(
    prototype.getByRole('region', { name: 'Reference inspector for Deck' }),
  ).toBeVisible();
  await prototype.getByRole('button', { name: 'Go to source' }).click();

  await expect(
    prototype.getByRole('region', { name: 'Source context for Questions Deck' }),
  ).toBeVisible();
  await expect(prototype.locator('#ref-node-prepare-draw')).toHaveCount(0);

  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(
    prototype.getByRole('region', { name: 'Reference inspector for Deck' }),
  ).toBeVisible();
  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(prototype.getByRole('region', { name: 'Editing Draw Card' })).toBeVisible();
  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(prototype.locator('#ref-node-prepare-draw')).toBeVisible();
  await prototype.getByRole('button', { name: /Back/ }).click();
  await expect(prototype.getByRole('region', { name: 'Editing Prepare Turn' })).toBeVisible();
});

test('reference editor stays width-safe at a 390 px mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab/references');
  await page.getByText('Experiment settings').click();
  await page.getByRole('button', { name: 'Mobile · 390 px' }).click();
  const prototype = page.getByRole('region', { name: 'Scoped reference editor prototype' });
  await expect(prototype).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(await prototype.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
  );
  const narrowLabels = await prototype
    .locator('.editor-field > span')
    .evaluateAll((labels) =>
      labels.some(
        (label) => label.getBoundingClientRect().width < 40 && (label.textContent?.length ?? 0) > 3,
      ),
    );
  expect(narrowLabels).toBe(false);
});

test('adding and deleting steps changes only the editor working copy and shows diagnostics', async ({
  page,
}) => {
  await page.goto('/lab/references');
  await page.getByText('Experiment settings').click();
  await page.getByRole('button', { name: 'F · Long flow' }).click();
  const prototype = page.getByRole('region', { name: 'Scoped reference editor prototype' });
  await prototype.getByRole('button', { name: '+ Add step' }).click();
  await prototype.getByRole('button', { name: /Present.*Show a public message/ }).click();
  await expect(prototype.locator('#ref-node-lab-present-1')).toBeVisible();
  await expect(
    prototype.getByText(
      'A step was added to the working copy. The canonical fixture is unchanged.',
    ),
  ).toBeVisible();

  const choosePlayer = prototype.locator('#ref-node-choose-player');
  await choosePlayer.click({ position: { x: 20, y: 20 } });
  await choosePlayer.getByRole('button', { name: 'Delete step' }).click();

  await expect(choosePlayer).toHaveCount(0);
  await expect(prototype.getByText('This draft needs attention')).toBeVisible();
  await expect(
    prototype.getByText(
      'Prepare Turn still references Current Player, produced by deleted block Choose Player.',
    ),
  ).toBeVisible();
  await prototype.getByRole('button', { name: 'Reset' }).click();
  await expect(prototype.locator('#ref-node-choose-player')).toBeVisible();
  await expect(prototype.locator('#ref-node-lab-present-1')).toHaveCount(0);
  await expect(prototype.getByRole('list', { name: 'Working copy diagnostics' })).toHaveCount(0);
});

test('trace overlay is optional and does not change the working flow', async ({ page }) => {
  await page.goto('/lab/references');
  const prototype = page.getByRole('region', { name: 'Scoped reference editor prototype' });
  const nodeCount = await prototype.locator('.editor-node').count();
  await page.getByText('Experiment settings').click();
  await page.getByRole('button', { name: 'Show reference traces · Off' }).click();
  await expect(
    prototype.getByRole('complementary', { name: 'Reference trace overlay' }),
  ).toBeVisible();
  expect(await prototype.locator('.editor-node').count()).toBe(nodeCount);
  await page.getByRole('button', { name: 'Show reference traces · On' }).click();
  await expect(
    prototype.getByRole('complementary', { name: 'Reference trace overlay' }),
  ).toHaveCount(0);
  expect(await prototype.locator('.editor-node').count()).toBe(nodeCount);
});

test('core authoring lab connects resources, typed references, and structured flow editing', async ({
  page,
}) => {
  await page.goto('/lab/authoring');
  const workspace = page.getByRole('region', { name: 'Core authoring workspace' });
  const resources = workspace.getByRole('complementary', { name: 'Game resources' });
  const flow = workspace.getByRole('region', { name: 'Game flow' });
  const inspector = workspace.getByRole('complementary', { name: 'Inspector' });

  await resources.getByRole('button', { name: /Players/ }).click();
  await expect(inspector.getByText('Provided by session · Read-only')).toBeVisible();
  await expect(inspector.getByRole('button', { name: 'Delete resource' })).toHaveCount(0);

  await resources.getByRole('button', { name: /Questions Deck/ }).click();
  await expect(inspector.getByRole('region', { name: 'Questions Deck details' })).toBeVisible();
  await expect(inspector.getByText('Draw Card', { exact: true })).toBeVisible();
  await expect(inspector.getByText('Prepare Turn', { exact: true })).toBeVisible();

  await resources.getByRole('button', { name: '＋ Resource' }).click();
  const creator = resources.getByRole('form', { name: 'Create resource' });
  await creator.getByLabel('Deck name').fill('Bonus Deck');
  await creator.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(resources.getByRole('button', { name: /Bonus Deck/ })).toBeVisible();

  await resources.getByRole('button', { name: /Score/ }).click();
  await inspector.getByLabel('Initial value').fill('7');
  await inspector.getByRole('button', { name: 'Save value' }).click();
  await expect(resources.getByRole('button', { name: /Number · 7/ })).toBeVisible();

  await flow.getByRole('button', { name: 'Insert before Draw Card in Main flow' }).click();
  const palette = flow.getByRole('region', { name: 'Add step palette' });
  await palette.getByRole('button', { name: /Draw Card/ }).click();
  await expect(inspector.getByRole('heading', { name: 'Draw Card', exact: true })).toBeVisible();
  await inspector.getByRole('button', { name: /From · Questions Deck/ }).click();
  await inspector.getByRole('button', { name: /Bonus Deck.*Compatible/ }).click();
  await expect(inspector.getByRole('button', { name: /From · Bonus Deck/ })).toBeVisible();

  await flow.getByRole('button', { name: 'Insert before End in Main flow' }).click();
  await palette.getByRole('button', { name: /For Each/ }).click();
  const foreach = flow.locator('[id^="authoring-node-authoring-foreach-"]');
  await expect(foreach.getByText('REPEAT FOR EACH PLAYER')).toBeVisible();
  await foreach.getByRole('button', { name: 'Insert at end of For Each body' }).click();
  await palette.getByRole('button', { name: /Present/ }).click();
  await expect(
    foreach.getByRole('button', { name: 'Present step, selected', exact: true }),
  ).toBeVisible();

  await flow.getByRole('button', { name: 'Choose Player step', exact: true }).click();
  await inspector.getByRole('button', { name: 'Delete step' }).click();
  await expect(flow.getByText('This draft needs attention')).toBeVisible();
  await expect(flow.getByText(/Current Player is used by/).first()).toBeVisible();
  await flow.getByRole('button', { name: 'Undo last edit' }).click();
  await expect(flow.getByRole('button', { name: 'Choose Player step', exact: true })).toBeVisible();

  await flow.getByRole('button', { name: 'Prepare Turn step', exact: true }).click();
  await inspector.getByRole('button', { name: 'Open Composite' }).click();
  await expect(flow.getByRole('heading', { name: 'Prepare Turn', exact: true })).toBeVisible();
  await expect(flow.getByRole('button', { name: 'Present step', exact: true })).toBeVisible();
  await flow.getByRole('button', { name: '← Back to parent' }).click();
  await expect(flow.getByRole('heading', { name: 'Main flow', exact: true })).toBeVisible();
});

test('core authoring mobile uses exclusive resource, flow, reference, and Composite screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/lab/authoring');
  const mobile = page.getByRole('region', { name: 'Core authoring mobile workspace' });

  await mobile.getByRole('button', { name: 'Resources', exact: true }).click();
  await mobile.getByRole('button', { name: /Questions Deck/ }).click();
  await expect(mobile.getByRole('region', { name: 'Questions Deck details' })).toBeVisible();
  await mobile.getByRole('button', { name: '← Back to Resources' }).click();
  await mobile.getByRole('button', { name: 'Flow', exact: true }).click();

  await mobile.getByRole('button', { name: 'Insert before Draw Card in Main flow' }).click();
  await page
    .getByRole('region', { name: 'Add step palette' })
    .getByRole('button', { name: /Draw Card/ })
    .click();
  await expect(mobile.getByRole('heading', { name: 'Draw Card', exact: true })).toBeVisible();
  await mobile.getByRole('button', { name: /From · Questions Deck/ }).click();
  await expect(mobile.getByRole('region', { name: 'Choose Draw Card source' })).toBeVisible();
  await mobile.getByRole('button', { name: /Challenges Deck.*Compatible/ }).click();
  await expect(mobile.getByRole('button', { name: /From · Challenges Deck/ })).toBeVisible();
  await mobile.getByRole('button', { name: '← Back to Flow' }).click();

  await mobile.getByRole('button', { name: /Prepare Turn step/ }).click();
  await mobile.getByRole('button', { name: 'Open Composite' }).click();
  await expect(mobile.getByRole('heading', { name: 'Prepare Turn', exact: true })).toBeVisible();
  await mobile.getByRole('button', { name: '← Back to parent flow' }).click();
  await expect(mobile.getByRole('region', { name: 'Prepare Turn step details' })).toBeVisible();

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(await mobile.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});
