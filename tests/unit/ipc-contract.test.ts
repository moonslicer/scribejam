import { describe, expect, it } from 'vitest';
import {
  IPC_CHANNELS,
  isEnhanceMeetingRequest,
  isMeetingGetRequest,
  isNotesSaveRequest,
  isSettingsSaveRequest,
  isSettingsValidateKeyRequest,
  type EnhanceMeetingRequest,
  type SettingsValidateKeyRequest
} from '../../src/shared/ipc';

describe('ipc contract validators', () => {
  it('defines the enhancement channel constant', () => {
    expect(IPC_CHANNELS.meetingEnhance).toBe('meeting:enhance');
  });

  it('defines the meeting reset channel constant', () => {
    expect(IPC_CHANNELS.meetingReset).toBe('meeting:reset');
  });

  it('accepts deepgram key validation payloads', () => {
    const payload: SettingsValidateKeyRequest = {
      provider: 'deepgram',
      key: 'dg-test'
    };
    expect(isSettingsValidateKeyRequest(payload)).toBe(true);
  });

  it('accepts openai key validation payloads', () => {
    const payload: SettingsValidateKeyRequest = {
      provider: 'openai',
      key: 'sk-test'
    };
    expect(isSettingsValidateKeyRequest(payload)).toBe(true);
  });

  it('rejects invalid key validation payloads', () => {
    expect(isSettingsValidateKeyRequest({ provider: 'deepgram', key: 123 })).toBe(false);
    expect(isSettingsValidateKeyRequest({ provider: 'other', key: 'x' })).toBe(false);
    expect(isSettingsValidateKeyRequest(null)).toBe(false);
  });

  it('accepts and rejects meeting get payloads', () => {
    expect(isMeetingGetRequest({ meetingId: 'meeting-1' })).toBe(true);
    expect(isMeetingGetRequest({ meetingId: '' })).toBe(false);
    expect(isMeetingGetRequest({})).toBe(false);
  });

  it('accepts and rejects meeting enhance payloads', () => {
    const payload: EnhanceMeetingRequest = {
      meetingId: 'meeting-1'
    };

    expect(isEnhanceMeetingRequest(payload)).toBe(true);
    expect(isEnhanceMeetingRequest({ meetingId: '' })).toBe(false);
    expect(isEnhanceMeetingRequest({ meetingId: 123 })).toBe(false);
    expect(isEnhanceMeetingRequest(null)).toBe(false);
  });

  it('accepts and rejects note save payloads', () => {
    expect(
      isNotesSaveRequest({
        meetingId: 'meeting-1',
        content: {
          type: 'doc',
          content: []
        }
      })
    ).toBe(true);

    expect(isNotesSaveRequest({ meetingId: 'meeting-1', content: [] })).toBe(false);
    expect(isNotesSaveRequest({ meetingId: '', content: { type: 'doc' } })).toBe(false);
    expect(isNotesSaveRequest({ meetingId: 'meeting-1', content: null })).toBe(false);
  });

  it('accepts valid capture source settings and rejects unknown values', () => {
    expect(isSettingsSaveRequest({ captureSource: 'system' })).toBe(true);
    expect(isSettingsSaveRequest({ captureSource: 'mic' })).toBe(true);
    expect(isSettingsSaveRequest({ captureSource: 'mixed' })).toBe(true);
    expect(isSettingsSaveRequest({ captureSource: 'loopback' })).toBe(false);
  });
});
