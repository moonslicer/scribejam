import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertNoFatalRendererErrors,
  completeFirstRunSetup,
  getLastMeetingId,
  getMeeting,
  installMeetingEventCapture,
  launchApp,
  openSettingsPage,
  sendMicFrames
} from './helpers';

test('default template persists and applied template provenance is shown after enhancement', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'scribejam-pw-templates-'));
  const first = await launchApp({ userDataDir });

  try {
    await completeFirstRunSetup(first.page);
    await openSettingsPage(first.page);
    await first.page.getByTestId('settings-input-default-template').selectOption('standup');
    await first.page.getByTestId('settings-save-button').click();
  } finally {
    await first.close();
  }

  const second = await launchApp({ userDataDir });

  try {
    await expect(second.page.getByTestId('setup-wizard')).toHaveCount(0);
    await openSettingsPage(second.page);
    await expect(second.page.getByTestId('settings-input-default-template')).toHaveValue('standup');
    await second.page.getByRole('button', { name: /back/i }).click();

    await installMeetingEventCapture(second.page);
    await second.page.getByTestId('meeting-activity-toggle').click();
    await expect(second.page.getByTestId('meeting-state-value')).toHaveText('recording');

    const editor = second.page.getByTestId('notepad-editor-input');
    await editor.click();
    await editor.type('Standup notes');
    await sendMicFrames(second.page, { count: 12, amplitude: 9000 });

    const meetingId = await getLastMeetingId(second.page);
    expect(meetingId).not.toBeNull();

    await second.page.evaluate(async (id) => {
      await window.scribejam.stopMeeting({ meetingId: id });
    }, meetingId ?? '');
    await expect(second.page.getByTestId('meeting-state-value')).toHaveText('stopped');
    await expect(second.page.getByTestId('meeting-template-select')).toHaveValue('standup');

    await second.page.getByTestId('generate-notes-button').click();
    await expect(second.page.getByTestId('meeting-state-value')).toHaveText('done');
    await expect(second.page.getByTestId('notepad-template-badge')).toContainText('Team Standup');

    const meeting = (await getMeeting(second.page, meetingId ?? '')) as {
      lastTemplateId?: string;
      lastTemplateName?: string;
    } | null;

    expect(meeting?.lastTemplateId).toBe('standup');
    expect(meeting?.lastTemplateName).toBe('Team Standup');
    assertNoFatalRendererErrors(second.pageErrors, second.consoleErrors);
  } finally {
    await second.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('re-enhancing edited enhanced notes requires confirmation', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await installMeetingEventCapture(context.page);

    await context.page.getByTestId('meeting-activity-toggle').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    const editor = context.page.getByTestId('notepad-editor-input');
    await editor.click();
    await editor.type('Needs a second pass');
    await sendMicFrames(context.page, { count: 12, amplitude: 9000 });

    const meetingId = await getLastMeetingId(context.page);
    expect(meetingId).not.toBeNull();

    await context.page.evaluate(async (id) => {
      await window.scribejam.stopMeeting({ meetingId: id });
    }, meetingId ?? '');
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('stopped');

    await context.page.getByTestId('generate-notes-button').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('done');

    await expect(context.page.getByTestId('meeting-secondary-action')).toContainText('New Meeting');

    await context.page.evaluate(() => {
      const editorElement = document.querySelector<HTMLElement>('[data-testid="notepad-editor-input"]');
      const target = document.querySelector<HTMLElement>('[data-authorship="ai"]');

      if (!editorElement || !target) {
        throw new Error('Target AI-authored content not found.');
      }

      editorElement.focus();
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    await context.page.keyboard.type('Edited ');
    await expect(context.page.getByTestId('meeting-secondary-action')).toHaveCount(0);

    let dialogMessage: string | null = null;
    context.page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss().catch(() => {});
    });
    await context.page.getByTestId('generate-notes-button').click({ noWaitAfter: true });
    await expect.poll(() => dialogMessage).toBe('Re-enhancing will replace your edited notes. Continue?');

    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('done');
    await expect(context.page.getByTestId('generate-notes-button')).toContainText('Re-enhance');
    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('custom templates persist through settings and enhancement uses the saved custom instructions', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'scribejam-pw-custom-template-'));
  const first = await launchApp({ userDataDir });

  try {
    await completeFirstRunSetup(first.page);
    await openSettingsPage(first.page);
    await first.page.getByTestId('settings-input-custom-template-name').fill('Customer interview');
    await first.page
      .getByTestId('settings-input-custom-template-instructions')
      .fill('Focus on pain points and requests.');
    await first.page.getByTestId('settings-input-default-template').selectOption('custom');
    await first.page.getByTestId('settings-save-button').click();
  } finally {
    await first.close();
  }

  const second = await launchApp({ userDataDir });

  try {
    await expect(second.page.getByTestId('setup-wizard')).toHaveCount(0);
    await openSettingsPage(second.page);
    await expect(second.page.getByTestId('settings-input-default-template')).toHaveValue('custom');
    await expect(second.page.getByTestId('settings-input-custom-template-name')).toHaveValue(
      'Customer interview'
    );
    await second.page.getByRole('button', { name: /back/i }).click();

    await installMeetingEventCapture(second.page);
    await second.page.getByTestId('meeting-activity-toggle').click();
    await expect(second.page.getByTestId('meeting-state-value')).toHaveText('recording');

    const editor = second.page.getByTestId('notepad-editor-input');
    await editor.click();
    await editor.type('Customer call notes');
    await sendMicFrames(second.page, { count: 12, amplitude: 9000 });

    const meetingId = await getLastMeetingId(second.page);
    expect(meetingId).not.toBeNull();

    await second.page.evaluate(async (id) => {
      await window.scribejam.stopMeeting({ meetingId: id });
    }, meetingId ?? '');
    await expect(second.page.getByTestId('meeting-state-value')).toHaveText('stopped');
    await expect(second.page.getByTestId('meeting-template-select')).toHaveValue('custom');
    await expect(
      second.page.locator('[data-testid="meeting-template-select"] option[value="custom"]')
    ).toHaveText('Custom: Customer interview');

    await second.page.getByTestId('generate-notes-button').click();
    await expect(second.page.getByTestId('meeting-state-value')).toHaveText('done');
    await expect(second.page.getByTestId('notepad-template-badge')).toContainText('Customer interview');

    const meeting = (await getMeeting(second.page, meetingId ?? '')) as {
      lastTemplateId?: string;
      lastTemplateName?: string;
    } | null;

    expect(meeting?.lastTemplateId).toBe('custom');
    expect(meeting?.lastTemplateName).toBe('Customer interview');
    assertNoFatalRendererErrors(second.pageErrors, second.consoleErrors);
  } finally {
    await second.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});
