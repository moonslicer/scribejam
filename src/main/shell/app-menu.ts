import type { MenuItemConstructorOptions } from 'electron';
import { Menu } from 'electron';
import type { MeetingState } from '../../shared/ipc';

export interface AppMenuOptions {
  showApp: () => void;
  stopRecordingIfActive: () => Promise<void> | void;
  getMeetingState: () => MeetingState;
  quitApp: () => void;
}

export function installAppMenu(options: AppMenuOptions): void {
  const menu = Menu.buildFromTemplate(buildAppMenuTemplate(options));
  Menu.setApplicationMenu(menu);
}

export function buildAppMenuTemplate(options: AppMenuOptions): MenuItemConstructorOptions[] {
  return [
    {
      label: 'Scribejam',
      submenu: [
        {
          label: 'Show Scribejam',
          click: () => {
            options.showApp();
          }
        },
        {
          label: 'Stop Active Recording',
          click: () => {
            if (options.getMeetingState() !== 'recording') {
              options.showApp();
              return;
            }

            void options.stopRecordingIfActive();
          }
        },
        { type: 'separator' },
        {
          label: 'Quit Scribejam',
          click: () => {
            options.quitApp();
          }
        }
      ]
    },
    {
      role: 'windowMenu'
    }
  ];
}
