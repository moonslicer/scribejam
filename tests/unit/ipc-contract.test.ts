import { describe, expect, it } from 'vitest';
import {
  isSettingsValidateKeyRequest,
  type SettingsValidateKeyRequest
} from '../../src/shared/ipc';

describe('ipc contract validators', () => {
  it('accepts deepgram key validation payloads', () => {
    const payload: SettingsValidateKeyRequest = {
      provider: 'deepgram',
      key: 'dg-test'
    };
    expect(isSettingsValidateKeyRequest(payload)).toBe(true);
  });

  it('rejects invalid key validation payloads', () => {
    expect(isSettingsValidateKeyRequest({ provider: 'deepgram', key: 123 })).toBe(false);
    expect(isSettingsValidateKeyRequest({ provider: 'other', key: 'x' })).toBe(false);
    expect(isSettingsValidateKeyRequest(null)).toBe(false);
  });
});
