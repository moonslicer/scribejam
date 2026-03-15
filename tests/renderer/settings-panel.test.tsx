import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsPanel } from '../../src/renderer/components/SettingsPanel';

afterEach(() => {
  cleanup();
});

describe('SettingsPanel', () => {
  it('omits empty api keys from save payload', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    const onValidateKey = vi.fn(async () => ({ valid: true }));

    render(
      <SettingsPanel
        settings={{
          firstRunAcknowledged: true,
          sttProvider: 'deepgram',
          llmProvider: 'openai',
          defaultTemplateId: 'auto',
          deepgramApiKeySet: true,
          openaiApiKeySet: true,
          anthropicApiKeySet: false
        }}
        onSave={onSave}
        onValidateKey={onValidateKey}
      />
    );

    await user.click(screen.getByTestId('settings-save-button'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        llmProvider: 'openai',
        defaultTemplateId: 'auto'
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
          defaultTemplateId: 'auto',
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
        llmProvider: 'openai',
        defaultTemplateId: 'auto',
        deepgramApiKey: 'dg-replacement'
      })
    );
  });

  it('saves the selected default template', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    const onValidateKey = vi.fn(async () => ({ valid: true }));

    render(
      <SettingsPanel
        settings={{
          firstRunAcknowledged: true,
          sttProvider: 'deepgram',
          llmProvider: 'openai',
          defaultTemplateId: 'auto',
          deepgramApiKeySet: false,
          openaiApiKeySet: false,
          anthropicApiKeySet: false
        }}
        onSave={onSave}
        onValidateKey={onValidateKey}
      />
    );

    await user.selectOptions(screen.getByTestId('settings-input-default-template'), 'standup');
    await user.click(screen.getByTestId('settings-save-button'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        llmProvider: 'openai',
        defaultTemplateId: 'standup'
      })
    );
  });

  it('saves a configured custom template and can select it as the default', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    const onValidateKey = vi.fn(async () => ({ valid: true }));

    render(
      <SettingsPanel
        settings={{
          firstRunAcknowledged: true,
          sttProvider: 'deepgram',
          llmProvider: 'openai',
          defaultTemplateId: 'auto',
          deepgramApiKeySet: false,
          openaiApiKeySet: false,
          anthropicApiKeySet: false
        }}
        onSave={onSave}
        onValidateKey={onValidateKey}
      />
    );

    await user.type(screen.getByTestId('settings-input-custom-template-name'), 'Customer interview');
    await user.type(
      screen.getByTestId('settings-input-custom-template-instructions'),
      'Focus on pain points and requests.'
    );
    await user.selectOptions(screen.getByTestId('settings-input-default-template'), 'custom');
    await user.click(screen.getByTestId('settings-save-button'));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        llmProvider: 'openai',
        defaultTemplateId: 'custom',
        customTemplate: {
          name: 'Customer interview',
          instructions: 'Focus on pain points and requests.'
        }
      })
    );
  });

  it('disables save when the custom template is only partially filled', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    const onValidateKey = vi.fn(async () => ({ valid: true }));

    render(
      <SettingsPanel
        settings={{
          firstRunAcknowledged: true,
          sttProvider: 'deepgram',
          llmProvider: 'openai',
          defaultTemplateId: 'auto',
          deepgramApiKeySet: false,
          openaiApiKeySet: false,
          anthropicApiKeySet: false
        }}
        onSave={onSave}
        onValidateKey={onValidateKey}
      />
    );

    await user.type(screen.getByTestId('settings-input-custom-template-name'), 'Customer interview');

    expect(screen.getByTestId('settings-save-button')).toBeDisabled();
    expect(screen.getByTestId('settings-custom-template-validation')).toHaveTextContent(
      'Add both a name and instructions to save a custom template.'
    );
  });
});
