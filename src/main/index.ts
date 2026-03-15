import { app, BrowserWindow } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { IPC_CHANNELS } from '../shared/ipc';
import { createMainServices, registerIpcHandlers } from './ipc-handlers';
import { installAppMenu } from './shell/app-menu';

let mainWindow: BrowserWindow | null = null;

const userDataOverride = process.env.SCRIBEJAM_USER_DATA_DIR;
if (userDataOverride) {
  mkdirSync(userDataOverride, { recursive: true });
  app.setPath('userData', userDataOverride);
}

function applyDevelopmentAppIdentity(): void {
  if (app.isPackaged) {
    return;
  }

  app.setName('Scribejam');

  if (process.platform !== 'darwin') {
    return;
  }

  const dock = app.dock;
  if (!dock) {
    return;
  }

  dock.setIcon(join(app.getAppPath(), 'assets/icons/scribejam-1024.png'));
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#f6f8fb',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 8 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  const services = createMainServices({ window: mainWindow });
  registerIpcHandlers({ window: mainWindow }, services);
  installAppMenu({
    showApp: () => {
      mainWindow?.show();
      mainWindow?.focus();
    },
    stopRecordingIfActive: async () => {
      const snapshot = services.stateMachine.getSnapshot();
      if (snapshot.state !== 'recording' || !snapshot.meetingId) {
        mainWindow?.show();
        mainWindow?.focus();
        return;
      }

      try {
        const stopped = services.stateMachine.stop(snapshot.meetingId);
        services.meetingRecordsService.recordMeetingStopped(stopped);
        mainWindow?.webContents.send(IPC_CHANNELS.meetingStateChanged, {
          state: stopped.state,
          meetingId: stopped.meetingId
        });

        const stopErrors: string[] = [];

        try {
          await services.audioManager.stopRecording();
        } catch (error) {
          stopErrors.push(formatStopError('audio capture', error));
        }

        try {
          await services.transcriptionService.stop();
        } catch (error) {
          stopErrors.push(formatStopError('transcription', error));
        }

        if (stopErrors.length > 0) {
          mainWindow?.webContents.send(IPC_CHANNELS.errorDisplay, {
            message: `Meeting stopped, but cleanup hit an issue: ${stopErrors.join(' ')}`
          });
        }
      } catch (error) {
        mainWindow?.webContents.send(IPC_CHANNELS.errorDisplay, {
          message: error instanceof Error ? error.message : 'Unable to stop the active recording.'
        });
      } finally {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    getMeetingState: () => services.stateMachine.getSnapshot().state,
    quitApp: () => {
      app.quit();
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  if (process.env.SCRIBEJAM_SMOKE === '1') {
    setTimeout(() => app.exit(0), 300);
    return;
  }

  applyDevelopmentAppIdentity();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.env.SCRIBEJAM_TEST_MODE === '1' || process.platform !== 'darwin') {
    app.quit();
  }
});

function formatStopError(component: string, error: unknown): string {
  const detail =
    error instanceof Error && error.message.trim().length > 0
      ? error.message.trim()
      : 'Unknown error.';
  return `${component}: ${detail}`;
}
