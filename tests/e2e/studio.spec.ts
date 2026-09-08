import { expect, test, type FrameLocator, type Locator, type Page } from '@playwright/test';

const baselineId = 'traquenard-authoring-ui-2026-09-08';

test('root is the current shared authoring baseline and runtime proof remains executable', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('main', { name: 'Current authoring editor' })).toHaveAttribute(
    'data-authoring-baseline',
    baselineId,
  );
  await expect(page.getByRole('main', { name: 'Current authoring editor' })).toHaveAttribute(
    'data-experimental-axes',
    '',
  );
  await expect(page.getByRole('heading', { name: 'Friday Night Challenge' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Runtime proof' })).toHaveAttribute(
    'href',
    '/runtime-proof',
  );

  await page.goto('/runtime-proof');
  await expect(page.getByText('RUNTIME / FOUNDATION PROOF · IR v1')).toBeVisible();
  await expect(page.getByText('Ready to publish')).toBeVisible();
  await page.getByRole('button', { name: /Display prompt/ }).click();
  await expect(page.getByText('5 blocks')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish immutable v1' })).toBeEnabled();
  await expect(page.getByText('Canonical IR preview')).toBeVisible();
});

test('lab index is registry-driven and every registered preview mounts the same baseline', async ({
  page,
}) => {
  await page.goto('/lab');
  const experiments = page.getByRole('region', { name: 'Registered authoring experiments' });
  await expect(experiments.getByRole('link')).toHaveCount(3);
  await expect(experiments.getByRole('link', { name: /Core authoring grammar/ })).toHaveAttribute(
    'href',
    '/lab/authoring',
  );
  await expect(
    experiments.getByRole('link', { name: /Parallel execution grammar/ }),
  ).toHaveAttribute('href', '/lab/parallel');
  await expect(experiments.getByRole('link', { name: /Typed references/ })).toHaveAttribute(
    'href',
    '/lab/references',
  );
  await expect(page.locator('a[href="/lab/framework-spike"]')).toHaveCount(0);

  for (const route of ['/lab/authoring', '/lab/parallel', '/lab/references']) {
    await page.goto(route);
    await expect(preview(page).locator('.authoring-baseline')).toHaveAttribute(
      'data-authoring-baseline',
      baselineId,
    );
  }
});

test('standard harness keeps research controls outside a reproducible, URL-backed preview', async ({
  page,
}) => {
  await page.goto('/lab/parallel?device=desktop&fixture=group-vote&projection=grouped');
  const controls = page.getByRole('region', { name: 'Experiment controls' });
  await expect(controls.getByRole('button', { name: 'Desktop' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(controls.getByLabel('Fixture')).toHaveValue('group-vote');
  await expect(controls.getByRole('button', { name: 'Projection Grouped' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(controls.locator('.authoring-baseline')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveAttribute('width', '1280');
  await expect(page.locator('iframe')).toHaveAttribute('height', '800');
  expect(
    await preview(page)
      .locator('body')
      .evaluate(() => window.innerWidth),
  ).toBe(1280);

  await controls.getByRole('button', { name: 'Phone' }).click();
  await expect(page).toHaveURL(/device=phone/);
  await expect(page.locator('iframe')).toHaveAttribute('width', '390');
  await expect(page.locator('iframe')).toHaveAttribute('height', '844');
  expect(
    await preview(page)
      .locator('body')
      .evaluate(() => window.innerWidth),
  ).toBe(390);
  await page.reload();
  await expect(controls.getByRole('button', { name: 'Phone' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(controls.getByLabel('Fixture')).toHaveValue('group-vote');
  await expect(controls.getByRole('button', { name: 'Projection Grouped' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/lab/references');
  await expect(page).toHaveURL(
    /\/lab\/references\?device=desktop&fixture=two-decks&navigation=on&traces=off$/,
  );
});

test('desktop baseline keeps Library and Inspector visible while Flow scrolls and edits deep semantics', async ({
  page,
}) => {
  await page.goto('/');
  const workspace = page.getByRole('region', { name: 'Shared authoring workspace' });
  const library = workspace.getByRole('complementary', { name: 'Library' });
  const flow = workspace.getByRole('region', { name: 'Flow', exact: true });
  const inspector = workspace.getByRole('complementary', { name: 'Inspector' });
  const before = await Promise.all([library.boundingBox(), inspector.boundingBox()]);

  const deepWait = flow.locator('#authoring-node-wait-again');
  await deepWait.scrollIntoViewIfNeeded();
  await deepWait.getByRole('button', { name: 'Wait step', exact: true }).click();
  await inspector.getByLabel('Duration').fill('3');
  await expect(inspector.getByLabel('Duration')).toHaveValue('3');
  expect(await flow.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const after = await Promise.all([library.boundingBox(), inspector.boundingBox()]);
  expect(after[0]?.y).toBe(before[0]?.y);
  expect(after[1]?.y).toBe(before[1]?.y);

  const foreach = flow.locator('#authoring-node-each-player');
  await expect(foreach).toHaveClass(/is-c-shape/);
  await foreach.getByRole('button', { name: 'For Each Player step', exact: true }).click();
  await inspector.getByLabel('Current item').fill('Participant');
  await expect(inspector.getByLabel('Current item')).toHaveValue('Participant');

  const condition = flow.locator('#authoring-node-answer-check');
  await condition.getByRole('button', { name: 'If step', exact: true }).click();
  await inspector.getByLabel('Condition right').fill('Ready');
  await expect(inspector.getByLabel('Condition right')).toHaveValue('Ready');

  await library.getByRole('button', { name: /Questions Deck.*Collection/ }).click();
  await expect(inspector.getByRole('region', { name: 'Questions Deck details' })).toBeVisible();
  await inspector.getByLabel('Collection item 1').fill('Updated question');
  await expect(inspector.getByLabel('Collection item 1')).toHaveValue('Updated question');
  await inspector.getByRole('button', { name: 'Add collection item' }).click();
  await expect(inspector.getByLabel('Collection item 4')).toHaveValue('New card');
  await flow
    .locator('#authoring-node-ask-question')
    .getByRole('button', { name: 'Ask / Wait for Input step' })
    .click();
  await inspector.getByLabel('Input prompt').fill('Choose now');
  await inspector.getByLabel('Input options').fill('Ready, Later');
  await expect(inspector.getByLabel('Input options')).toHaveValue('Ready, Later');
  await library.getByRole('button', { name: /Prepare Turn.*Named reusable Workflow/ }).click();
  await inspector.getByRole('button', { name: 'Open Workflow' }).click();
  await expect(flow.getByRole('heading', { name: 'Prepare Turn' })).toBeVisible();
});

test('quiet insertion supports explicit insertion and dnd-kit library insertion/reorder', async ({
  page,
}) => {
  await page.goto('/');
  const flow = page.getByRole('region', { name: 'Flow', exact: true });
  const slotButton = flow.getByRole('button', {
    name: 'Insert before Draw Card in Authoring Root',
  });
  await expect(slotButton).toHaveCSS('opacity', '0');
  await slotButton.focus();
  await expect(slotButton).toHaveCSS('opacity', '1');
  await slotButton.click();
  await page
    .getByRole('dialog', { name: 'Add step palette' })
    .getByRole('button', { name: /Present Show a public message/ })
    .click();
  await expect(page.locator('#authoring-node-baseline-present-1')).toBeVisible();

  const libraryWait = page
    .getByRole('complementary', { name: 'Library' })
    .locator('[data-palette-kind="wait"]');
  const endSlot = flow.locator('[data-slot="slot:authoring-root:8"]');
  await dragWithPointer(page, libraryWait, endSlot);
  await expect(page.locator('#authoring-node-baseline-wait-2')).toBeVisible();
  const insertedHandle = page
    .locator('#authoring-node-baseline-wait-2')
    .getByRole('button', { name: 'Drag Wait' });
  const earlierSlot = flow.locator('[data-slot="slot:authoring-root:7"]');
  await dragWithPointer(page, insertedHandle, earlierSlot);
  await expect(page.locator('.authoring-ui-status')).toContainText(
    'Baseline Wait 2 moved to Authoring Root boundary 8.',
  );
  await expect
    .poll(async () =>
      flow
        .getByRole('list', { name: 'Authoring Root flow' })
        .locator(':scope > li > article')
        .evaluateAll((nodes) => nodes.map((node) => node.id)),
    )
    .toEqual([
      'authoring-node-choose-player',
      'authoring-node-baseline-present-1',
      'authoring-node-draw-question',
      'authoring-node-ask-question',
      'authoring-node-answer-check',
      'authoring-node-each-player',
      'authoring-node-ready-together',
      'authoring-node-baseline-wait-2',
      'authoring-node-prepare-turn',
      'authoring-node-finish-game',
    ]);
});

test('phone preview uses focused Flow, Data, Workflows, Inspector, and non-drag navigation', async ({
  page,
}) => {
  await page.goto('/lab/authoring?device=phone&fixture=challenge&containment=c-shape');
  const frame = preview(page);
  await expect(frame.getByRole('navigation', { name: 'Mobile authoring sections' })).toBeVisible();
  await frame.getByRole('button', { name: 'Data', exact: true }).click();
  await frame.getByRole('button', { name: /Questions Deck.*Collection/ }).click();
  await expect(frame.getByRole('region', { name: 'Questions Deck details' })).toBeVisible();
  await frame.getByRole('button', { name: '← Back to Flow' }).click();

  const wait = frame.locator('#authoring-node-wait-again');
  await wait.scrollIntoViewIfNeeded();
  await wait.getByRole('button', { name: 'Wait step', exact: true }).click();
  await frame.getByLabel('Duration').fill('4');
  await frame.getByRole('button', { name: '← Back to Flow' }).click();
  await frame.getByRole('button', { name: 'Insert before Draw Card in Authoring Root' }).click();
  await frame
    .getByRole('dialog', { name: 'Add step palette' })
    .getByRole('button', { name: /Wait Wait on logical time/ })
    .click();
  await expect(frame.locator('#authoring-node-baseline-wait-1')).toBeAttached();
  await frame.getByRole('button', { name: '← Back to Flow' }).click();

  await frame
    .locator('#authoring-node-draw-question')
    .getByRole('button', { name: 'Draw Card step', exact: true })
    .click();
  await frame.getByRole('button', { name: 'Go to source' }).click();
  await expect(frame.getByRole('region', { name: 'Questions Deck details' })).toBeVisible();
  await frame.getByRole('button', { name: '← Back to Flow' }).click();
  await frame.getByRole('button', { name: 'Workflows', exact: true }).click();
  await frame.getByRole('button', { name: /Prepare Turn.*Named reusable Workflow/ }).click();
  await frame.getByRole('button', { name: 'Open Workflow' }).click();
  await expect(frame.getByRole('heading', { name: 'Prepare Turn' })).toBeVisible();
  await frame.getByRole('button', { name: '← Main' }).click();
  expect(
    await frame.locator('html').evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});

test('parallel lab changes only the registered parallel projection over baseline ordinary blocks', async ({
  page,
}) => {
  await page.goto('/lab/parallel?device=desktop&fixture=stress&projection=grouped');
  await page.getByRole('button', { name: 'Projection Fork / Join' }).click();
  await expect(page).toHaveURL(/fixture=stress/);
  await expect(page).toHaveURL(/projection=fork-join/);
  const frame = preview(page);
  await expect(frame.locator('.authoring-baseline')).toHaveAttribute(
    'data-experimental-axes',
    'parallel projection',
  );
  await expect(frame.getByRole('region', { name: 'Fork Join parallel projection' })).toBeVisible();
  await expect(frame.getByText('BRANCH 6')).toBeVisible();
  await expect(frame.locator('#authoring-node-stress-intro')).toHaveClass(/authoring-ui-block/);
});

test('reference lab independently configures semantic navigation and trace overlay on baseline blocks', async ({
  page,
}) => {
  await page.goto('/lab/references?device=desktop&fixture=two-decks&navigation=off&traces=on');
  const frame = preview(page);
  await expect(frame.locator('.authoring-baseline')).toHaveAttribute(
    'data-experimental-axes',
    'semantic navigation,trace overlay',
  );
  await expect(frame.getByRole('complementary', { name: 'Reference trace overlay' })).toBeVisible();
  await frame
    .locator('#authoring-node-draw-question')
    .getByRole('button', { name: 'Draw Card step', exact: true })
    .click();
  await expect(
    frame.getByText('Semantic navigation is disabled in this experiment configuration.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Semantic navigation On' }).click();
  await expect(page).toHaveURL(/navigation=on/);
  await preview(page)
    .locator('#authoring-node-draw-question')
    .getByRole('button', { name: 'Draw Card step', exact: true })
    .click();
  await expect(preview(page).getByRole('button', { name: 'Go to source' })).toBeVisible();
});

test('reference navigation reaches flow producers and Composite-bound sources with exact back context', async ({
  page,
}) => {
  await page.goto('/lab/references?device=desktop&fixture=current-player&navigation=on&traces=off');
  let frame = preview(page);
  await frame
    .locator('#authoring-node-ask-current-player')
    .getByRole('button', { name: 'Ask / Wait for Input step' })
    .click();
  await frame.getByRole('button', { name: 'Go to source' }).click();
  await expect(frame.getByRole('region', { name: 'Choose Player properties' })).toBeVisible();
  await frame.getByRole('button', { name: '← Back to reference' }).click();
  await expect(
    frame.getByRole('region', { name: 'Ask / Wait for Input properties' }),
  ).toBeVisible();

  await page.goto('/lab/references?device=desktop&fixture=composite&navigation=on&traces=off');
  frame = preview(page);
  await frame
    .locator('#authoring-node-prepare-turn')
    .getByRole('button', { name: 'Prepare Turn step' })
    .click();
  await frame.getByRole('button', { name: 'Open Workflow' }).click();
  await frame
    .locator('#authoring-node-prepare-draw')
    .getByRole('button', { name: 'Draw Card step' })
    .click();
  await frame.getByRole('button', { name: 'Go to source' }).click();
  await expect(frame.getByRole('region', { name: 'Questions Deck details' })).toBeVisible();
  await frame.getByRole('button', { name: '← Back to reference' }).click();
  await expect(frame.getByRole('region', { name: 'Draw Card properties' })).toBeVisible();
});

function preview(page: Page): FrameLocator {
  return page.frameLocator('iframe');
}

async function dragWithPointer(page: Page, source: Locator, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Drag source or target is not visible.');
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 16,
  });
  await expect(target).toHaveClass(/is-target/);
  const expandedTargetBox = await target.boundingBox();
  if (!expandedTargetBox) throw new Error('Drag target disappeared while active.');
  await page.mouse.move(
    expandedTargetBox.x + expandedTargetBox.width / 2,
    expandedTargetBox.y + expandedTargetBox.height / 2,
  );
  await page.mouse.up();
}
