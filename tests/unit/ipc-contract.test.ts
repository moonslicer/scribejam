import { describe, expect, it } from 'vitest';
import {
  IPC_CHANNELS,
  TEMPLATE_IDS,
  isDismissEnhancementFailureRequest,
  isEnhancedNoteSaveRequest,
  isEnhanceMeetingRequest,
  isMeetingGetRequest,
  isMeetingListRequest,
  isNotesSaveRequest,
  isSettingsSaveRequest,
  isSettingsValidateKeyRequest,
  isTestConfigureEnhancementMockRequest,
  type EnhanceMeetingRequest,
  type MeetingListRequest,
  type SettingsValidateKeyRequest
} from '../../src/shared/ipc';

describe('ipc contract validators', () => {
  it('defines the enhancement channel constant', () => {
    expect(IPC_CHANNELS.meetingEnhance).toBe('meeting:enhance');
  });

  it('defines the meeting reset channel constant', () => {
    expect(IPC_CHANNELS.meetingReset).toBe('meeting:reset');
  });

  it('defines the meeting list channel constant', () => {
    expect(IPC_CHANNELS.meetingList).toBe('meeting:list');
  });

  it('defines the supported template ids', () => {
    expect(TEMPLATE_IDS).toEqual(['auto', 'one-on-one', 'standup', 'tech-review', 'custom']);
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

  it('accepts and rejects meeting list payloads', () => {
    const payload: MeetingListRequest = {
      query: 'roadmap'
    };

    expect(isMeetingListRequest(undefined)).toBe(true);
    expect(isMeetingListRequest({})).toBe(true);
    expect(isMeetingListRequest(payload)).toBe(true);
    expect(isMeetingListRequest({ query: '' })).toBe(true);
    expect(isMeetingListRequest({ query: 'a'.repeat(200) })).toBe(true);
    expect(isMeetingListRequest({ query: 'a'.repeat(201) })).toBe(false);
    expect(isMeetingListRequest({ query: 123 })).toBe(false);
    expect(isMeetingListRequest(null)).toBe(false);
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

  it('accepts dismissal requests for failed enhancement state', () => {
    expect(isDismissEnhancementFailureRequest({ meetingId: 'meeting-1' })).toBe(true);
    expect(isDismissEnhancementFailureRequest({ meetingId: '' })).toBe(false);
  });

  it('accepts enhanced note save payloads', () => {
    expect(
      isEnhancedNoteSaveRequest({
        meetingId: 'meeting-1',
        content: {
          type: 'doc',
          content: []
        }
      })
    ).toBe(true);
    expect(isEnhancedNoteSaveRequest({ meetingId: 'meeting-1', content: [] })).toBe(false);
  });

  it('accepts test enhancement mock payloads and rejects unknown outcomes', () => {
    expect(
      isTestConfigureEnhancementMockRequest({
        outcomes: ['network', 'success']
      })
    ).toBe(true);
    expect(
      isTestConfigureEnhancementMockRequest({
        outcomes: ['boom']
      })
    ).toBe(false);
    expect(isTestConfigureEnhancementMockRequest({ outcomes: 'network' })).toBe(false);
  });
});
