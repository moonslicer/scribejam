import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetupWizard } from '../../src/renderer/components/SetupWizard';

describe('SetupWizard', () => {
  it('allows setup completion with Deepgram validation only', async () => {
    const user = userEvent.setup();
    const onValidateKey = vi.fn(async (provider: 'deepgram' | 'openai') =>
      provider === 'deepgram' ? { valid: true } : { valid: false, error: 'Quota exceeded.' }
    );
    const onComplete = vi.fn(async () => {});

    render(<SetupWizard onValidateKey={onValidateKey} onComplete={onComplete} />);

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
});
