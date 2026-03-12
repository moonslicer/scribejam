import { useEffect, useState } from 'react';
import type { MeetingState, Settings } from '../shared/ipc';
import { useMicCapture } from './audio/useMicCapture';
import { AudioLevel } from './components/AudioLevel';
import { MeetingBar } from './components/MeetingBar';
import { SettingsPanel } from './components/SettingsPanel';
import { StatusBanner } from './components/StatusBanner';

export default function App(): JSX.Element {
  const api = window.scribejam;
  const [meetingState, setMeetingState] = useState<MeetingState>('idle');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [levels, setLevels] = useState({ mic: 0, system: 0 });

  useMicCapture({
    enabled: meetingState === 'recording',
    onError: setErrorMessage
  });

  useEffect(() => {
    if (!api) {
      setErrorMessage('Desktop bridge unavailable. Restart the app.');
      return;
    }

    void api.getSettings().then(setSettings).catch(() => {
      setErrorMessage('Failed to load settings.');
    });

    const unsubState = api.onMeetingStateChanged((event) => {
      setMeetingState(event.state);
      if (event.meetingId) {
        setMeetingId(event.meetingId);
      }
    });

    const unsubLevel = api.onAudioLevel((event) => {
      setLevels((previous) => ({
        ...previous,
        [event.source]: event.rms
      }));
    });

    const unsubError = api.onErrorDisplay((event) => {
      setErrorMessage(event.message);
    });

    return () => {
      unsubState();
      unsubLevel();
      unsubError();
    };
  }, [api]);

  const onPrimaryAction = async (): Promise<void> => {
    try {
      setErrorMessage(null);
      if (meetingState === 'recording') {
        if (!api) {
          setErrorMessage('Desktop bridge unavailable.');
          return;
        }
        if (!meetingId) {
          setErrorMessage('No active meeting id found.');
          return;
        }
        await api.stopMeeting({ meetingId });
        return;
      }

      if (!api) {
        setErrorMessage('Desktop bridge unavailable.');
        return;
      }
      const response = await api.startMeeting({ title: 'Untitled Meeting' });
      setMeetingId(response.meetingId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update meeting state.');
    }
  };

  const saveSettings = async (payload: Parameters<typeof window.scribejam.saveSettings>[0]): Promise<void> => {
    if (!api) {
      setErrorMessage('Desktop bridge unavailable.');
      return;
    }
    await api.saveSettings(payload);
    const refreshed = await api.getSettings();
    setSettings(refreshed);
  };

  return (
    <main data-testid="app-shell" className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Scribejam</p>
        <h1 data-testid="app-shell-title" className="text-2xl font-semibold text-ink">
          Notepad-first meeting capture shell
        </h1>
      </header>

      <MeetingBar meetingState={meetingState} onPrimaryAction={() => void onPrimaryAction()} />
      <StatusBanner message={errorMessage} />

      <section className="grid gap-3 md:grid-cols-2">
        <AudioLevel source="mic" label="Microphone" value={levels.mic} />
        <AudioLevel source="system" label="System Audio" value={levels.system} />
      </section>

      <SettingsPanel settings={settings} onSave={saveSettings} />
    </main>
  );
}
