import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface LaunchOptions {
  forceSystemUnavailable?: boolean;
  userDataDir?: string;
}

interface LaunchContext {
  app: ElectronApplication;
  page: Page;
  pageErrors: string[];
  consoleErrors: string[];
  close: () => Promise<void>;
}

async function shutdownElectronApp(app: ElectronApplication): Promise<void> {
  const child = app.process();

  try {
    await app.evaluate(({ app: electronApp }) => {
      electronApp.quit();
    });
  } catch {
    // no-op: app may already be exiting
  }

  try {
    await app.close();
  } catch {
    // no-op: app may already be disposed
  }

  await waitForChildExit(child);
}

async function launchApp(options: LaunchOptions = {}): Promise<LaunchContext> {
  const createdUserDataDir = options.userDataDir ?? mkdtempSync(join(tmpdir(), 'scribejam-pw-'));
  const shouldCleanupUserData = options.userDataDir === undefined;

  const app = await electron.launch({
    args: [join(process.cwd(), '.')],
    env: {
      ...process.env,
      SCRIBEJAM_TEST_MODE: '1',
      SCRIBEJAM_USER_DATA_DIR: createdUserDataDir,
      SCRIBEJAM_FORCE_SYSTEM_UNAVAILABLE: options.forceSystemUnavailable ? '1' : '0'
    }
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-shell"]');

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  return {
    app,
    page,
    pageErrors,
    consoleErrors,
    close: async () => {
      await shutdownElectronApp(app);
      if (shouldCleanupUserData) {
        rmSync(createdUserDataDir, { recursive: true, force: true });
      }
    }
  };
}

async function openSettingsPage(page: Page): Promise<void> {
  await page.getByTestId('sidebar-settings-button').click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
}

async function readPercent(page: Page, testId: string): Promise<number> {
  const text = (await page.getByTestId(testId).textContent()) ?? '0%';
  const parsed = Number.parseInt(text.replace('%', ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function completeFirstRunSetup(page: Page): Promise<void> {
  await expect(page.getByTestId('setup-wizard')).toBeVisible();
  await page.getByTestId('setup-input-deepgram').fill('dg-test-key');
  await page.getByTestId('setup-validate-deepgram-button').click();
  await expect(page.getByTestId('setup-validation-deepgram')).toContainText('Key is valid');
  await page.getByTestId('setup-input-openai').fill('sk-openai-test');
  await page.getByTestId('setup-validate-openai-button').click();
  await expect(page.getByTestId('setup-validation-openai')).toContainText('Key is valid');
  await page.getByTestId('setup-disclosure-ack').check();
  await expect(page.getByTestId('setup-continue-button')).toBeEnabled();
  await page.getByTestId('setup-continue-button').click();
  await expect(page.getByTestId('setup-wizard')).toHaveCount(0);
}

function assertNoFatalRendererErrors(pageErrors: string[], consoleErrors: string[]): void {
  const allowedNoise: string[] = [];
  const filteredConsoleErrors = consoleErrors.filter(
    (message) => !allowedNoise.some((allowed) => message.includes(allowed))
  );
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(filteredConsoleErrors, `Unexpected console errors:\n${filteredConsoleErrors.join('\n')}`).toEqual([]);
}

async function waitForChildExit(child: ReturnType<ElectronApplication['process']>): Promise<void> {
  if (child.exitCode !== null || child.killed) {
    return;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = (): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(sigtermTimer);
      clearTimeout(sigkillTimer);
      child.off('exit', finish);
      resolve();
    };

    const sigtermTimer = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGTERM');
      }
    }, 250);

    const sigkillTimer = setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill('SIGKILL');
      }
      finish();
    }, 2_000);

    child.once('exit', finish);
  });
}

test('startup renders shell and preload bridge', async () => {
  const context = await launchApp();

  try {
    await expect(context.page).toHaveTitle(/Scribejam/i);
    await expect(context.page.getByTestId('app-shell-title')).toContainText('Notepad-first meeting capture shell');

    const bridgeReady = await context.page.evaluate(() => {
      const api = (window as unknown as { scribejam?: Record<string, unknown> }).scribejam;
      if (!api) {
        return false;
      }
      const expectedMethods = [
        'startMeeting',
        'stopMeeting',
        'getSettings',
        'saveSettings',
        'validateSttKey',
        'sendMicFrames',
        'onMeetingStateChanged',
        'onAudioLevel',
        'onTranscriptUpdate',
        'onTranscriptionStatus',
        'onErrorDisplay',
        'simulateSttDisconnect'
      ];
      return expectedMethods.every((method) => typeof api[method] === 'function');
    });

    expect(bridgeReady).toBe(true);
    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('first-run disclosure is required before recording starts', async () => {
  const context = await launchApp();

  try {
    await expect(context.page.getByTestId('setup-wizard')).toBeVisible();
    await expect(context.page.getByTestId('setup-continue-button')).toBeDisabled();

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('idle');
    await expect(context.page.getByTestId('status-banner')).toContainText(
      'Complete first-run setup to enable cloud transcription.'
    );
  } finally {
    await context.close();
  }
});

test('meeting start and stop roundtrip updates state', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await context.page.evaluate(() => {
      const typedWindow = window as Window & {
        __scribejamMeetingEvents?: Array<{ state: string; meetingId?: string }>;
        scribejam: {
          onMeetingStateChanged: (
            listener: (event: { state: string; meetingId?: string }) => void
          ) => () => void;
        };
      };

      typedWindow.__scribejamMeetingEvents = [];
      typedWindow.scribejam.onMeetingStateChanged((event) => {
        typedWindow.__scribejamMeetingEvents?.push(event);
      });
    });
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('idle');

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    const meetingId = await context.page.evaluate(() => {
      const typedWindow = window as Window & {
        __scribejamMeetingEvents?: Array<{ state: string; meetingId?: string }>;
      };
      const events = typedWindow.__scribejamMeetingEvents ?? [];
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const candidate = events[index]?.meetingId;
        if (typeof candidate === 'string' && candidate.length > 0) {
          return candidate;
        }
      }
      return null;
    });
    expect(meetingId).not.toBeNull();

    await context.page.evaluate(async (id) => {
      await window.scribejam.stopMeeting({ meetingId: id });
    }, meetingId ?? '');
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('stopped');

    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('audio level UI reacts to mic frame events', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    await context.page.evaluate(() => {
      const typedWindow = window as Window & {
        scribejam: {
          sendMicFrames: (payload: { seq: number; ts: number; frames: number[] }) => void;
        };
      };
      const samples = Array.from({ length: 320 }, () => 12000);
      typedWindow.scribejam.sendMicFrames({ seq: 1, ts: Date.now(), frames: samples });
      typedWindow.scribejam.sendMicFrames({ seq: 2, ts: Date.now(), frames: samples });
      typedWindow.scribejam.sendMicFrames({ seq: 3, ts: Date.now(), frames: samples });
    });

    await expect
      .poll(async () => readPercent(context.page, 'audio-level-mic-value'), {
        message: 'Expected microphone level indicator to rise above 0%'
      })
      .toBeGreaterThan(0);

    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('live transcript renders streaming updates', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    await context.page.evaluate(() => {
      const typedWindow = window as Window & {
        scribejam: {
          sendMicFrames: (payload: { seq: number; ts: number; frames: number[] }) => void;
        };
      };
      const samples = Array.from({ length: 320 }, () => 8000);
      for (let i = 0; i < 24; i += 1) {
        typedWindow.scribejam.sendMicFrames({ seq: i + 1, ts: Date.now() + i, frames: samples });
      }
    });

    await expect(context.page.getByText('mock transcript token')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('transcription status reflects disconnect and recovery', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    await context.page.evaluate(async () => {
      await window.scribejam.simulateSttDisconnect();
    });

    await expect(context.page.getByTestId('transcription-status')).toContainText('reconnecting');
    await expect(context.page.getByTestId('transcription-status')).toContainText('streaming');
  } finally {
    await context.close();
  }
});

test('invalid key blocks only transcription while meeting controls remain usable', async () => {
  const context = await launchApp();

  try {
    await completeFirstRunSetup(context.page);
    await context.page.evaluate(async () => {
      await window.scribejam.saveSettings({ deepgramApiKey: '' });
    });
    await expect
      .poll(async () => {
        const settings = await context.page.evaluate(async () => window.scribejam.getSettings());
        return settings.deepgramApiKeySet;
      })
      .toBe(false);

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');
    await expect(context.page.getByTestId('transcription-status')).toContainText('paused');
    await expect(context.page.getByText('Typing enabled')).toBeVisible();
  } finally {
    await context.close();
  }
});

test('setup state persists across relaunch', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'scribejam-pw-settings-'));
  const first = await launchApp({ userDataDir });

  try {
    await completeFirstRunSetup(first.page);
    await openSettingsPage(first.page);
    await expect(first.page.getByTestId('settings-deepgram-configured')).toContainText('yes');
    await expect(first.page.getByTestId('settings-first-run-ack')).toContainText('yes');
  } finally {
    await first.close();
  }

  const second = await launchApp({ userDataDir });
  try {
    await expect(second.page.getByTestId('setup-wizard')).toHaveCount(0);
    await openSettingsPage(second.page);
    await expect(second.page.getByTestId('settings-deepgram-configured')).toContainText('yes');
    assertNoFatalRendererErrors(second.pageErrors, second.consoleErrors);
  } finally {
    await second.close();
    rmSync(userDataDir, { recursive: true, force: true });
  }
});

test('forced system unavailable shows degradation banner and remains usable', async () => {
  const context = await launchApp({ forceSystemUnavailable: true });

  try {
    await completeFirstRunSetup(context.page);
    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');
    await expect(context.page.getByTestId('status-banner')).toContainText(
      'System audio unavailable — recording microphone only.'
    );

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('stopped');
    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});
