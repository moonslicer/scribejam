import { randomUUID } from 'node:crypto';
import type { MeetingState } from '../../shared/ipc';

export interface MeetingSnapshot {
  state: MeetingState;
  meetingId?: string;
  title?: string;
  startedAt?: number;
  stoppedAt?: number;
}

export class MeetingStateMachine {
  private snapshot: MeetingSnapshot = { state: 'idle' };

  public getSnapshot(): MeetingSnapshot {
    return { ...this.snapshot };
  }

  public start(title: string): MeetingSnapshot {
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      throw new Error('Meeting title is required.');
    }
    if (this.snapshot.state === 'recording' || this.snapshot.state === 'enhancing') {
      throw new Error('Cannot start a meeting from the current state.');
    }
    if (this.snapshot.state === 'enhance_failed') {
      throw new Error('Dismiss enhancement failure before starting a new meeting.');
    }
    if (this.snapshot.state === 'done') {
      throw new Error('Reset to idle before starting a new meeting.');
    }

    this.snapshot = {
      state: 'recording',
      meetingId: randomUUID(),
      title: trimmed,
      startedAt: Date.now()
    };

    return this.getSnapshot();
  }

  public stop(meetingId: string): MeetingSnapshot {
    if (this.snapshot.state !== 'recording' || this.snapshot.meetingId !== meetingId) {
      throw new Error('Cannot stop meeting from current state.');
    }

    this.snapshot = {
      ...this.snapshot,
      state: 'stopped',
      stoppedAt: Date.now()
    };

    return this.getSnapshot();
  }

  public beginEnhancement(meetingId: string): MeetingSnapshot {
    if (this.snapshot.state !== 'stopped' || this.snapshot.meetingId !== meetingId) {
      throw new Error('Cannot begin enhancement from current state.');
    }

    this.snapshot = {
      ...this.snapshot,
      state: 'enhancing'
    };

    return this.getSnapshot();
  }

  public completeEnhancement(meetingId: string): MeetingSnapshot {
    if (this.snapshot.state !== 'enhancing' || this.snapshot.meetingId !== meetingId) {
      throw new Error('Cannot complete enhancement from current state.');
    }

    this.snapshot = {
      ...this.snapshot,
      state: 'done'
    };

    return this.getSnapshot();
  }

  public failEnhancement(meetingId: string): MeetingSnapshot {
    if (this.snapshot.state !== 'enhancing' || this.snapshot.meetingId !== meetingId) {
      throw new Error('Cannot fail enhancement from current state.');
    }

    this.snapshot = {
      ...this.snapshot,
      state: 'enhance_failed'
    };

    return this.getSnapshot();
  }

  public retryEnhancement(meetingId: string): MeetingSnapshot {
    if (this.snapshot.state !== 'enhance_failed' || this.snapshot.meetingId !== meetingId) {
      throw new Error('Cannot retry enhancement from current state.');
    }

    this.snapshot = {
      ...this.snapshot,
      state: 'enhancing'
    };

    return this.getSnapshot();
  }

  public dismissEnhancementFailure(meetingId: string): MeetingSnapshot {
    if (this.snapshot.state !== 'enhance_failed' || this.snapshot.meetingId !== meetingId) {
      throw new Error('Cannot dismiss enhancement failure from current state.');
    }

    this.snapshot = {
      ...this.snapshot,
      state: 'stopped'
    };

    return this.getSnapshot();
  }

  public resetToIdle(): MeetingSnapshot {
    if (this.snapshot.state !== 'done') {
      throw new Error('Can only reset to idle after a completed meeting.');
    }

    this.snapshot = { state: 'idle' };
    return this.getSnapshot();
  }
}
