import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('app launches and creates a window', async () => {
  const app = await electron.launch({
    args: [join(process.cwd(), '.')]
  });

  const window = await app.firstWindow();
  await expect(window).toHaveTitle(/Scribejam/i);
  await app.close();
});
