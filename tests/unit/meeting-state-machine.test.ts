import { describe, expect, it } from 'vitest';
import { MeetingStateMachine } from '../../src/main/meeting/state-machine';

describe('MeetingStateMachine', () => {
  it('transitions idle -> recording -> stopped', () => {
    const machine = new MeetingStateMachine();

    const started = machine.start('Weekly sync');
    expect(started.state).toBe('recording');
    expect(started.meetingId).toBeTypeOf('string');

    const stopped = machine.stop(started.meetingId ?? '');
    expect(stopped.state).toBe('stopped');
    expect(stopped.meetingId).toBe(started.meetingId);
  });

  it('rejects invalid transitions', () => {
    const machine = new MeetingStateMachine();
    expect(() => machine.stop('missing')).toThrowError();

    machine.start('Daily standup');
    expect(() => machine.start('Duplicate')).toThrowError();
  });
});
