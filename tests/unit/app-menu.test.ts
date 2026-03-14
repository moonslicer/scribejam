import { describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => ({
  buildFromTemplate: vi.fn(),
  setApplicationMenu: vi.fn()
}));

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: electronMocks.buildFromTemplate,
    setApplicationMenu: electronMocks.setApplicationMenu
  }
}));

import { buildAppMenuTemplate, installAppMenu } from '../../src/main/shell/app-menu';

describe('app menu', () => {
  it('builds a menu with app, edit, and window controls', () => {
    const showApp = vi.fn();
    const stopRecordingIfActive = vi.fn();
    const quitApp = vi.fn();

    const template = buildAppMenuTemplate({
      showApp,
      stopRecordingIfActive,
      getMeetingState: () => 'recording',
      quitApp
    });

    const appMenu = template[0];
    const editMenu = template[1];
    const windowMenu = template[2];
    expect(appMenu?.label).toBe('Scribejam');
    expect(Array.isArray(appMenu?.submenu)).toBe(true);
    expect(editMenu).toMatchObject({ role: 'editMenu' });
    expect(windowMenu).toMatchObject({ role: 'windowMenu' });

    const submenu = appMenu?.submenu as Array<{
      click?: (menuItem: unknown, browserWindow: unknown, event: unknown) => void;
    }>;
    const showItem = submenu[0];
    const stopItem = submenu[1];
    const quitItem = submenu[3];

    showItem?.click?.({} as never, {} as never, {} as never);
    stopItem?.click?.({} as never, {} as never, {} as never);
    quitItem?.click?.({} as never, {} as never, {} as never);

    expect(showApp).toHaveBeenCalledTimes(1);
    expect(stopRecordingIfActive).toHaveBeenCalledTimes(1);
    expect(quitApp).toHaveBeenCalledTimes(1);
  });

  it('falls back to showing the app instead of stopping when no recording is active', () => {
    const showApp = vi.fn();
    const stopRecordingIfActive = vi.fn();

    const template = buildAppMenuTemplate({
      showApp,
      stopRecordingIfActive,
      getMeetingState: () => 'stopped',
      quitApp: vi.fn()
    });

    const stopItem = (template[0]?.submenu as Array<{
      click?: (menuItem: unknown, browserWindow: unknown, event: unknown) => void;
    }>)[1];
    stopItem?.click?.({} as never, {} as never, {} as never);

    expect(stopRecordingIfActive).not.toHaveBeenCalled();
    expect(showApp).toHaveBeenCalledTimes(1);
  });

  it('installs the built menu through Electron Menu APIs', () => {
    electronMocks.buildFromTemplate.mockReturnValueOnce('menu-instance');

    installAppMenu({
      showApp: vi.fn(),
      stopRecordingIfActive: vi.fn(),
      getMeetingState: () => 'idle',
      quitApp: vi.fn()
    });

    expect(electronMocks.buildFromTemplate).toHaveBeenCalledTimes(1);
    expect(electronMocks.setApplicationMenu).toHaveBeenCalledWith('menu-instance');
  });
});
