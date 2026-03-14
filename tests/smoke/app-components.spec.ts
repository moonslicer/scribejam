import { expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertNoFatalRendererErrors,
  completeFirstRunSetup,
  configureEnhancementMock,
  getLastMeetingId,
  getMeeting,
  installMeetingEventCapture,
  launchApp,
  openSettingsPage,
  sendMicFrames
} from './helpers';

test('setup wizard validates invalid and valid keys before completion', async () => {
  const context = await launchApp();

  try {
    await expect(context.page.getByTestId('setup-wizard')).toBeVisible();
    await context.page.getByTestId('setup-input-deepgram').fill('');
    await expect(context.page.getByTestId('setup-validate-deepgram-button')).toBeDisabled();

    await context.page.getByTestId('setup-input-deepgram').fill('dg-valid-key');
    await context.page.getByTestId('setup-validate-deepgram-button').click();
    await expect(context.page.getByTestId('setup-validation-deepgram')).toContainText('Key is valid');
    await context.page.getByTestId('setup-input-openai').fill('sk-openai-test');
    await context.page.getByTestId('setup-validate-openai-button').click();
    await expect(context.page.getByTestId('setup-validation-openai')).toContainText('Key is valid');
    await context.page.getByTestId('setup-disclosure-ack').check();
    await context.page.getByTestId('setup-continue-button').click();

    await expect(context.page.getByTestId('setup-wizard')).toHaveCount(0);
    await openSettingsPage(context.page);
    await expect(context.page.getByTestId('settings-first-run-ack')).toContainText('yes');
    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('meeting bar and notepad persist typed notes for the active meeting', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await installMeetingEventCapture(context.page);

    await context.page.getByTestId('meeting-title-input').fill('Design review');
    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');
    await expect(context.page.getByTestId('meeting-title-input')).toBeDisabled();

    const editor = context.page.getByTestId('notepad-editor-input');
    await editor.click();
    await editor.type('Follow up with design');

    await context.page.waitForTimeout(500);
    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('stopped');
    await expect(context.page.getByTestId('meeting-primary-action')).toContainText('Enhance Notes');

    const meetingId = await getLastMeetingId(context.page);
    expect(meetingId).not.toBeNull();

    const meeting = (await getMeeting(context.page, meetingId ?? '')) as {
      noteContent?: { content?: Array<{ content?: Array<{ text?: string }> }> };
      title?: string;
    } | null;

    expect(meeting?.title).toBe('Design review');
    expect(meeting?.noteContent?.content?.[0]?.content?.[0]?.text).toContain('Follow up with design');
    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('transcript panel shows live transcript and copy feedback', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    await sendMicFrames(context.page, { count: 24, amplitude: 8000 });
    await expect(context.page.getByText('mock transcript token')).toBeVisible();
    await expect(context.page.getByTestId('transcript-copy-button')).toBeEnabled();

    await context.page.getByTestId('transcript-copy-button').click();
    await expect(context.page.getByTestId('transcript-copy-status')).toContainText('Copied transcript text.');
    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('settings panel saves provider keys and capture source across relaunch', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'scribejam-pw-settings-'));
  const first = await launchApp({ userDataDir });

  try {
    await completeFirstRunSetup(first.page);
    await openSettingsPage(first.page);

    await first.page.getByTestId('settings-input-capture-source').selectOption('mic');
    await first.page.getByTestId('settings-input-openai').fill('sk-openai-test');
    await first.page.getByTestId('settings-input-anthropic').fill('sk-anthropic-test');
    await first.page.getByTestId('settings-save-button').click();

    await expect(first.page.getByTestId('settings-capture-source')).toContainText('mic');
    await expect(first.page.getByTestId('settings-openai-configured')).toContainText('yes');
    await expect(first.page.getByTestId('settings-anthropic-configured')).toContainText('yes');
  } finally {
    await first.close();
  }

  const second = await launchApp({ userDataDir: first.userDataDir });
  try {
    await expect(second.page.getByTestId('setup-wizard')).toHaveCount(0);
    await openSettingsPage(second.page);
    await expect(second.page.getByTestId('settings-capture-source')).toContainText('mic');
    await expect(second.page.getByTestId('settings-openai-configured')).toContainText('yes');
    await expect(second.page.getByTestId('settings-anthropic-configured')).toContainText('yes');
    assertNoFatalRendererErrors(second.pageErrors, second.consoleErrors);
  } finally {
    await second.close();
    rmSync(first.userDataDir, { recursive: true, force: true });
  }
});

test('enhancement flow renders AI content and persists the enhanced output', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await installMeetingEventCapture(context.page);

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    const editor = context.page.getByTestId('notepad-editor-input');
    await editor.click();
    await editor.type('Need follow-up summary');
    await sendMicFrames(context.page, { count: 12, amplitude: 9000 });

    const primaryAction = context.page.getByTestId('meeting-primary-action');
    const meetingId = await getLastMeetingId(context.page);
    expect(meetingId).not.toBeNull();

    await context.page.evaluate(async (id) => {
      await window.scribejam.stopMeeting({ meetingId: id });
    }, meetingId ?? '');
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('stopped');
    await expect(context.page.getByText('mock transcript token')).toBeVisible();
    await expect(primaryAction).toContainText('Enhance Notes');
    await primaryAction.click({ force: true });
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('done');
    await expect(context.page.locator('[data-authorship="ai"]').first()).toBeVisible();
    await expect(context.page.getByRole('heading', { name: 'Summary' })).toBeVisible();

    const meeting = (await getMeeting(context.page, meetingId ?? '')) as {
      enhancedOutput?: { summary?: string; blocks?: Array<{ source: string; content: string }> };
    } | null;

    expect(meeting?.enhancedOutput?.summary).toContain('User notes captured');
    expect(meeting?.enhancedOutput?.blocks?.some((block) => block.source === 'ai')).toBe(true);
    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('latest enhanced meeting is restored after relaunch', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'scribejam-pw-enhanced-'));
  const first = await launchApp({ userDataDir });

  try {
    await completeFirstRunSetup(first.page);
    await installMeetingEventCapture(first.page);

    await first.page.getByTestId('meeting-primary-action').click();
    await expect(first.page.getByTestId('meeting-state-value')).toHaveText('recording');

    const editor = first.page.getByTestId('notepad-editor-input');
    await editor.click();
    await editor.type('Need follow-up summary');
    await sendMicFrames(first.page, { count: 12, amplitude: 9000 });

    const meetingId = await getLastMeetingId(first.page);
    expect(meetingId).not.toBeNull();

    await first.page.evaluate(async (id) => {
      await window.scribejam.stopMeeting({ meetingId: id });
    }, meetingId ?? '');
    await expect(first.page.getByTestId('meeting-state-value')).toHaveText('stopped');

    await first.page.getByTestId('meeting-primary-action').click();
    await expect(first.page.getByTestId('meeting-state-value')).toHaveText('done');
    await expect(first.page.locator('[data-authorship="ai"]').first()).toBeVisible();
  } finally {
    await first.close();
  }

  const second = await launchApp({ userDataDir });
  try {
    await expect(second.page.getByTestId('setup-wizard')).toHaveCount(0);
    await expect(second.page.getByTestId('meeting-state-value')).toHaveText('done');
    await expect(second.page.locator('[data-authorship="ai"]').first()).toBeVisible();
    await expect(second.page.getByRole('heading', { name: 'Summary' })).toBeVisible();
    assertNoFatalRendererErrors(second.pageErrors, second.consoleErrors);
  } finally {
    await second.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('enhancement failure keeps note-taking available and supports manual retry', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await installMeetingEventCapture(context.page);

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    const editor = context.page.getByTestId('notepad-editor-input');
    await editor.click();
    await editor.type('Retry flow notes');
    await sendMicFrames(context.page, { count: 12, amplitude: 9000 });

    const meetingId = await getLastMeetingId(context.page);
    expect(meetingId).not.toBeNull();

    await context.page.evaluate(async (id) => {
      await window.scribejam.stopMeeting({ meetingId: id });
    }, meetingId ?? '');
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('stopped');

    await configureEnhancementMock(context.page, ['network', 'network', 'success']);
    await context.page.getByTestId('meeting-primary-action').click();

    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('enhance_failed');
    await expect(context.page.getByTestId('status-banner')).toContainText(
      'Network interruption while contacting OpenAI.'
    );
    await expect(context.page.getByTestId('status-banner-action')).toContainText('Retry');
    await expect(context.page.getByTestId('meeting-secondary-action')).toContainText('Keep Editing');
    await expect(context.page.getByText('Typing enabled')).toBeVisible();

    await editor.click();
    await editor.type(' Still typing after failure');
    await expect(context.page.getByText(/Still typing after failure/)).toBeVisible();

    await context.page.getByTestId('status-banner-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('done');
    await expect(context.page.locator('[data-authorship="ai"]').first()).toBeVisible();

    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('editing AI-authored enhanced content removes its AI authorship marker', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await installMeetingEventCapture(context.page);

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    const editor = context.page.getByTestId('notepad-editor-input');
    await editor.click();
    await editor.type('Authorship conversion notes');
    await sendMicFrames(context.page, { count: 12, amplitude: 9000 });

    const meetingId = await getLastMeetingId(context.page);
    expect(meetingId).not.toBeNull();

    await context.page.evaluate(async (id) => {
      await window.scribejam.stopMeeting({ meetingId: id });
    }, meetingId ?? '');
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('stopped');
    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('done');

    const targetedAiText = context.page
      .locator('[data-authorship="ai"]')
      .filter({ hasText: 'Transcript context:' })
      .first();

    await expect(targetedAiText).toBeVisible();

    await context.page.evaluate(() => {
      const editorElement = document.querySelector<HTMLElement>('[data-testid="notepad-editor-input"]');
      const target = Array.from(document.querySelectorAll<HTMLElement>('[data-authorship="ai"]')).find((element) =>
        element.textContent?.includes('Transcript context:')
      );

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

    await expect(
      context.page.locator('[data-authorship="ai"]').filter({ hasText: 'Transcript context:' })
    ).toHaveCount(0);
    await expect(context.page.getByText(/Edited Transcript context:/)).toBeVisible();

    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('stopped meetings ignore transcript updates after stop', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await installMeetingEventCapture(context.page);

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    await sendMicFrames(context.page, { count: 12, amplitude: 9000 });
    await expect(context.page.getByText('mock transcript token')).toBeVisible();

    const meetingId = await getLastMeetingId(context.page);
    expect(meetingId).not.toBeNull();

    await context.page.evaluate(async (id) => {
      await window.scribejam.stopMeeting({ meetingId: id });
    }, meetingId ?? '');
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('stopped');

    const stoppedMeeting = (await getMeeting(context.page, meetingId ?? '')) as {
      transcriptSegments?: Array<{ text?: string }>;
    } | null;

    expect(stoppedMeeting?.transcriptSegments).toHaveLength(1);
    expect(stoppedMeeting?.transcriptSegments?.[0]?.text).toBe('mock transcript token');

    await sendMicFrames(context.page, { count: 12, amplitude: 9000 });
    await context.page.waitForTimeout(250);

    const afterStopMeeting = (await getMeeting(context.page, meetingId ?? '')) as {
      transcriptSegments?: Array<{ text?: string }>;
      enhancedOutput?: { summary?: string };
    } | null;

    expect(afterStopMeeting?.transcriptSegments).toHaveLength(1);
    expect(afterStopMeeting?.transcriptSegments?.[0]?.text).toBe('mock transcript token');

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('done');

    const enhancedMeeting = (await getMeeting(context.page, meetingId ?? '')) as {
      enhancedOutput?: { summary?: string };
    } | null;

    expect(enhancedMeeting?.enhancedOutput?.summary).toContain('Transcript captured 1 segment(s)');
    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});
