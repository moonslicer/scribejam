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
    if (this.snapshot.state === 'recording') {
      throw new Error('Meeting is already recording.');
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

  public resetToIdle(): MeetingSnapshot {
    this.snapshot = { state: 'idle' };
    return this.getSnapshot();
  }
}
