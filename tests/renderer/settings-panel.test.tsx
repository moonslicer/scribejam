import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../../src/renderer/components/SettingsPanel';

afterEach(() => {
  cleanup();
});

describe('SettingsPanel', () => {
  it('preserves stored keys when saving unrelated settings changes', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    const onValidateKey = vi.fn(async () => ({ valid: true }));

    render(
      <SettingsPanel
        settings={{
          firstRunAcknowledged: true,
          sttProvider: 'deepgram',
          llmProvider: 'openai',
          captureSource: 'mixed',
          deepgramApiKeySet: true,
          openaiApiKeySet: true,
          anthropicApiKeySet: false
        }}
        onSave={onSave}
        onValidateKey={onValidateKey}
      />
    );

    await user.selectOptions(screen.getByTestId('settings-input-capture-source'), 'system');
    await user.click(screen.getByTestId('settings-save-button'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        captureSource: 'system'
      })
    );
  });

  it('includes replacement keys when the user enters new values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    const onValidateKey = vi.fn(async () => ({ valid: true }));

    render(
      <SettingsPanel
        settings={{
          firstRunAcknowledged: true,
          sttProvider: 'deepgram',
          llmProvider: 'openai',
          captureSource: 'mixed',
          deepgramApiKeySet: true,
          openaiApiKeySet: false,
          anthropicApiKeySet: false
        }}
        onSave={onSave}
        onValidateKey={onValidateKey}
      />
    );

    await user.type(screen.getByTestId('settings-input-deepgram'), 'dg-replacement');
    await user.click(screen.getByTestId('settings-save-button'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        captureSource: 'mixed',
        deepgramApiKey: 'dg-replacement'
      })
    );
  });
});
