import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SetupWizard } from '../../src/renderer/components/SetupWizard';

afterEach(() => {
  cleanup();
});

describe('SetupWizard', () => {
  it('allows setup completion with Deepgram validation only', async () => {
    const user = userEvent.setup();
    const onValidateKey = vi.fn(async (provider: 'deepgram' | 'openai') =>
      provider === 'deepgram' ? { valid: true } : { valid: false, error: 'Quota exceeded.' }
    );
    const onComplete = vi.fn(async () => {});

    render(
      <SetupWizard
        hasStoredDeepgramKey={false}
        onValidateKey={onValidateKey}
        onComplete={onComplete}
      />
    );

    expect(screen.getByText(/raw audio is not sent to openai/i)).toBeInTheDocument();
    expect(screen.getByText(/enhance notes or retry enhancement/i)).toBeInTheDocument();

    await user.type(screen.getByTestId('setup-input-deepgram'), 'dg-test-key');
    await user.click(screen.getByTestId('setup-validate-deepgram-button'));
    await screen.findByTestId('setup-validation-deepgram');

    await user.click(screen.getByTestId('setup-disclosure-ack'));

    await waitFor(() => expect(screen.getByTestId('setup-continue-button')).toBeEnabled());
    await user.click(screen.getByTestId('setup-continue-button'));

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({
        deepgramApiKey: 'dg-test-key',
        openaiApiKey: ''
      })
    );
  });

  it('allows acknowledgement with an already stored Deepgram key', async () => {
    const user = userEvent.setup();
    const onValidateKey = vi.fn(async () => ({ valid: true }));
    const onComplete = vi.fn(async () => {});

    render(
      <SetupWizard
        hasStoredDeepgramKey={true}
        onValidateKey={onValidateKey}
        onComplete={onComplete}
      />
    );

    expect(screen.getByText(/already stored on this device/i)).toBeInTheDocument();
    expect(
      screen.getByText(/understand when scribejam sends data to deepgram and openai/i)
    ).toBeInTheDocument();

    await user.click(screen.getByTestId('setup-disclosure-ack'));
    await waitFor(() => expect(screen.getByTestId('setup-continue-button')).toBeEnabled());
    await user.click(screen.getByTestId('setup-continue-button'));

    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({
        deepgramApiKey: '',
        openaiApiKey: ''
      })
    );
    expect(onValidateKey).not.toHaveBeenCalled();
  });
});
