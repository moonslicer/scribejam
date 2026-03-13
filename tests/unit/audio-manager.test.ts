import { describe, expect, it, vi } from 'vitest';
import { AudioManager, type SystemCaptureAdapter } from '../../src/main/audio/audio-manager';
import type { SystemCaptureCallbacks } from '../../src/main/audio/system-capture';

function createEvents() {
  return {
    onAudioLevel: vi.fn(),
    onErrorDisplay: vi.fn(),
    onSourceFrame: vi.fn()
  };
}

describe('AudioManager', () => {
  it('shows a permission-specific banner when system audio permission is denied', async () => {
    const events = createEvents();
    const systemCapture: SystemCaptureAdapter = {
      start: async (callbacks: SystemCaptureCallbacks) => {
        callbacks.onUnavailable({
          reason: 'permission_denied',
          error: new Error('System Audio Recording permission denied')
        });
      },
      stop: async () => {}
    };

    const manager = new AudioManager(events, 16_000, 20, systemCapture);

    await manager.startRecording();

    expect(events.onErrorDisplay).toHaveBeenCalledWith({
      message:
        'System audio permission denied. Allow Scribejam in System Settings > Privacy & Security > System Audio Recording, or continue recording microphone only.',
      action: 'open-settings'
    });
  });

  it('shows a startup guidance banner when system audio fails to start', async () => {
    const events = createEvents();
    const systemCapture: SystemCaptureAdapter = {
      start: async (callbacks: SystemCaptureCallbacks) => {
        callbacks.onUnavailable({
          reason: 'start_failed',
          error: new Error('AudioTee failed to initialize')
        });
      },
      stop: async () => {}
    };

    const manager = new AudioManager(events, 16_000, 20, systemCapture);

    await manager.startRecording();

    expect(events.onErrorDisplay).toHaveBeenCalledWith({
      message:
        'System audio failed to start. Check System Audio Recording permission and macOS compatibility. Recording microphone only.'
    });
  });

  it('shows the module load failure detail when Electron cannot load the system audio module', async () => {
    const events = createEvents();
    const systemCapture: SystemCaptureAdapter = {
      start: async (callbacks: SystemCaptureCallbacks) => {
        callbacks.onUnavailable({
          reason: 'module_load_failed',
          moduleName: 'audiotee',
          error: new Error(
            "The module '/Users/tester/Projects/scribejam/node_modules/audiotee/build/Release/audiotee.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 127."
          )
        });
      },
      stop: async () => {}
    };

    const manager = new AudioManager(events, 16_000, 20, systemCapture);

    await manager.startRecording();

    expect(events.onErrorDisplay).toHaveBeenCalledWith({
      message:
        'System audio module failed to load (audiotee). Recording microphone only. Detail: The module \'<path>\' was compiled against a different Node.js version using NODE_MODULE_VERSION 127.'
    });
  });

  it('ignores microphone payloads in system-only capture mode', async () => {
    const events = createEvents();
    const systemCapture: SystemCaptureAdapter = {
      start: async () => {},
      stop: async () => {}
    };

    const manager = new AudioManager(events, 16_000, 20, systemCapture, () => 'system');

    await manager.startRecording();
    manager.ingestMicPayload({
      seq: 1,
      ts: Date.now(),
      frames: new Int16Array(320).fill(8_000)
    });

    expect(events.onSourceFrame).not.toHaveBeenCalled();
    expect(events.onAudioLevel).not.toHaveBeenCalled();
  });
});
