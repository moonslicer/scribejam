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

async function readPercent(page: Page, testId: string): Promise<number> {
  const text = (await page.getByTestId(testId).textContent()) ?? '0%';
  const parsed = Number.parseInt(text.replace('%', ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function assertNoFatalRendererErrors(pageErrors: string[], consoleErrors: string[]): void {
  const allowedNoise: string[] = [];
  const filteredConsoleErrors = consoleErrors.filter(
    (message) => !allowedNoise.some((allowed) => message.includes(allowed))
  );
  expect(pageErrors, `Unexpected page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(filteredConsoleErrors, `Unexpected console errors:\n${filteredConsoleErrors.join('\n')}`).toEqual([]);
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
        'sendMicFrames',
        'onMeetingStateChanged',
        'onAudioLevel',
        'onErrorDisplay'
      ];
      return expectedMethods.every((method) => typeof api[method] === 'function');
    });

    expect(bridgeReady).toBe(true);
    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('meeting start and stop roundtrip updates state', async () => {
  const context = await launchApp();

  try {
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('idle');

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('recording');

    await context.page.getByTestId('meeting-primary-action').click();
    await expect(context.page.getByTestId('meeting-state-value')).toHaveText('stopped');

    assertNoFatalRendererErrors(context.pageErrors, context.consoleErrors);
  } finally {
    await context.close();
  }
});

test('audio level UI reacts to mic frame events', async () => {
  const context = await launchApp();

  try {
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

test('settings key indicator persists across relaunch', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'scribejam-pw-settings-'));
  const first = await launchApp({ userDataDir });

  try {
    await expect(first.page.getByTestId('settings-deepgram-configured')).toContainText('no');
    await first.page.getByTestId('settings-input-deepgram').fill('phase-a-test-key');
    await first.page.getByTestId('settings-save-button').click();
    await expect(first.page.getByTestId('settings-deepgram-configured')).toContainText('yes');
  } finally {
    await first.close();
  }

  const second = await launchApp({ userDataDir });
  try {
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
