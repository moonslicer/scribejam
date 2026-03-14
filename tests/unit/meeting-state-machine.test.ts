import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeetingStateMachine } from '../../src/main/meeting/state-machine';

describe('MeetingStateMachine', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('transitions idle -> recording -> stopped', () => {
    const machine = new MeetingStateMachine();

    const started = machine.start('Weekly sync');
    expect(started.state).toBe('recording');
    expect(started.meetingId).toBeTypeOf('string');

    const stopped = machine.stop(started.meetingId ?? '');
    expect(stopped.state).toBe('stopped');
    expect(stopped.meetingId).toBe(started.meetingId);
  });

  it('supports enhancement lifecycle transitions', () => {
    const machine = new MeetingStateMachine();

    const started = machine.start('Weekly sync');
    const stopped = machine.stop(started.meetingId ?? '');
    const enhancing = machine.beginEnhancement(stopped.meetingId ?? '');
    const failed = machine.failEnhancement(enhancing.meetingId ?? '');
    const retried = machine.retryEnhancement(failed.meetingId ?? '');
    const done = machine.completeEnhancement(retried.meetingId ?? '');
    const idle = machine.resetToIdle();

    expect(enhancing.state).toBe('enhancing');
    expect(failed.state).toBe('enhance_failed');
    expect(retried.state).toBe('enhancing');
    expect(done.state).toBe('done');
    expect(idle.state).toBe('idle');
  });

  it('lets a failed enhancement return to stopped for continued note-taking', () => {
    const machine = new MeetingStateMachine();

    const started = machine.start('Weekly sync');
    const stopped = machine.stop(started.meetingId ?? '');
    const enhancing = machine.beginEnhancement(stopped.meetingId ?? '');
    const failed = machine.failEnhancement(enhancing.meetingId ?? '');
    const dismissed = machine.dismissEnhancementFailure(failed.meetingId ?? '');

    expect(dismissed.state).toBe('stopped');
    expect(dismissed.meetingId).toBe(started.meetingId);
  });

  it('resumes the same meeting after enhancement completes', () => {
    const machine = new MeetingStateMachine();

    const started = machine.start('Weekly sync');
    const stopped = machine.stop(started.meetingId ?? '');
    const enhancing = machine.beginEnhancement(stopped.meetingId ?? '');
    const done = machine.completeEnhancement(enhancing.meetingId ?? '');
    const resumed = machine.resume(done.meetingId ?? '');

    expect(resumed.state).toBe('recording');
    expect(resumed.meetingId).toBe(started.meetingId);
    expect(resumed.title).toBe(started.title);
  });

  it('allows starting a new meeting after a stopped meeting', () => {
    const machine = new MeetingStateMachine();

    const first = machine.start('Daily standup');
    machine.stop(first.meetingId ?? '');
    const second = machine.start('Retro');

    expect(second.state).toBe('recording');
    expect(second.meetingId).not.toBe(first.meetingId);
  });

  it('rejects invalid transitions', () => {
    const machine = new MeetingStateMachine();
    expect(() => machine.stop('missing')).toThrowError();

    const started = machine.start('Daily standup');
    expect(() => machine.start('Duplicate')).toThrowError();
    expect(() => machine.completeEnhancement(started.meetingId ?? '')).toThrowError();

    const stopped = machine.stop(started.meetingId ?? '');
    expect(() => machine.retryEnhancement(stopped.meetingId ?? '')).toThrowError();

    const enhancing = machine.beginEnhancement(stopped.meetingId ?? '');
    machine.failEnhancement(enhancing.meetingId ?? '');
    expect(() => machine.start('Blocked')).toThrowError();
  });

  it('falls back to the current date and time when the title is blank', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-12T09:07:00'));

    const machine = new MeetingStateMachine();
    const started = machine.start('   ');

    expect(started.title).toBe('Mar 12 09:07');
  });
});
