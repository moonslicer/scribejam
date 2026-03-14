import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestEnhancementOutcome } from '../../src/shared/ipc';

export interface LaunchOptions {
  forceSystemUnavailable?: boolean;
  userDataDir?: string;
}

export interface LaunchContext {
  app: ElectronApplication;
  page: Page;
  pageErrors: string[];
  consoleErrors: string[];
  userDataDir: string;
  close: () => Promise<void>;
}

export async function launchApp(options: LaunchOptions = {}): Promise<LaunchContext> {
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
    userDataDir: createdUserDataDir,
    close: async () => {
      await shutdownElectronApp(app);
      if (shouldCleanupUserData) {
        rmSync(createdUserDataDir, { recursive: true, force: true });
      }
    }
  };
}

async function shutdownElectronApp(app: ElectronApplication): Promise<void> {
  const child = app.process();

  try {
    await app.evaluate(({ app: electronApp }) => {
      electronApp.quit();
    });
  } catch {
    // app may already be exiting
  }

  try {
    await app.close();
  } catch {
    // app may already be disposed
  }

  await waitForChildExit(child);
}

export async function completeFirstRunSetup(page: Page): Promise<void> {
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

export async function openSettingsPage(page: Page): Promise<void> {
  await page.getByTestId('sidebar-settings-button').click();
  await expect(page.getByTestId('settings-page')).toBeVisible();
}

export async function sendMicFrames(
  page: Page,
  options?: { count?: number; amplitude?: number }
): Promise<void> {
  const count = options?.count ?? 12;
  const amplitude = options?.amplitude ?? 12000;

  await page.evaluate(
    ({ frameCount, sampleAmplitude }) => {
      const typedWindow = window as Window & {
        scribejam: {
          sendMicFrames: (payload: { seq: number; ts: number; frames: number[] }) => void;
        };
      };
      const samples = Array.from({ length: 320 }, () => sampleAmplitude);
      for (let i = 0; i < frameCount; i += 1) {
        typedWindow.scribejam.sendMicFrames({
          seq: i + 1,
          ts: Date.now() + i,
          frames: samples
        });
      }
    },
    {
      frameCount: count,
      sampleAmplitude: amplitude
    }
  );
}

export async function configureEnhancementMock(
  page: Page,
  outcomes: TestEnhancementOutcome[]
): Promise<void> {
  await page.evaluate(async (queuedOutcomes) => {
    await window.scribejam.configureEnhancementMock({
      outcomes: queuedOutcomes
    });
  }, outcomes);
}

export async function installMeetingEventCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
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
}

export async function getLastMeetingId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const typedWindow = window as Window & {
      __scribejamMeetingEvents?: Array<{ state: string; meetingId?: string }>;
    };
    const events = typedWindow.__scribejamMeetingEvents ?? [];
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const meetingId = events[index]?.meetingId;
      if (typeof meetingId === 'string' && meetingId.length > 0) {
        return meetingId;
      }
    }
    return null;
  });
}

export async function getMeeting(page: Page, meetingId: string): Promise<unknown> {
  return page.evaluate(async (id) => {
    return window.scribejam.getMeeting({ meetingId: id });
  }, meetingId);
}

export function assertNoFatalRendererErrors(pageErrors: string[], consoleErrors: string[]): void {
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
