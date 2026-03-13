import { useEffect, useState } from 'react';
import type { MeetingState, Settings, TranscriptionStatusEvent } from '../shared/ipc';
import { useMicCapture } from './audio/useMicCapture';
import { AudioLevel } from './components/AudioLevel';
import { MeetingBar } from './components/MeetingBar';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupWizard } from './components/SetupWizard';
import { StatusBanner } from './components/StatusBanner';
import { TranscriptPanel } from './components/TranscriptPanel';
import { useMeetingStore } from './stores/meeting-store';

export default function App(): JSX.Element {
  const api = window.scribejam;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatusEvent>({ status: 'idle' });
  const [levels, setLevels] = useState({ mic: 0, system: 0 });
  const meetingState = useMeetingStore((state) => state.meetingState);
  const meetingId = useMeetingStore((state) => state.meetingId);
  const meetingTitle = useMeetingStore((state) => state.meetingTitle);
  const transcriptEntries = useMeetingStore((state) => state.transcriptEntries);
  const setMeetingState = useMeetingStore((state) => state.setMeetingState);
  const setMeetingId = useMeetingStore((state) => state.setMeetingId);
  const setMeetingTitle = useMeetingStore((state) => state.setMeetingTitle);
  const applyTranscriptUpdate = useMeetingStore((state) => state.applyTranscriptUpdate);
  const resetTranscript = useMeetingStore((state) => state.resetTranscript);

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
    const unsubTranscript = api.onTranscriptUpdate((event) => {
      applyTranscriptUpdate(event);
    });
    const unsubTranscriptionStatus = api.onTranscriptionStatus((event) => {
      setTranscriptionStatus(event);
    });

    return () => {
      unsubState();
      unsubLevel();
      unsubError();
      unsubTranscript();
      unsubTranscriptionStatus();
    };
  }, [api, applyTranscriptUpdate, setMeetingId, setMeetingState]);

  const setupRequired = settings !== null && !settings.firstRunAcknowledged;

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
      if (setupRequired) {
        setErrorMessage('Complete first-run setup to enable cloud transcription.');
        return;
      }
      if (meetingState === 'enhancing' || meetingState === 'enhance_failed' || meetingState === 'done') {
        setErrorMessage('Enhancement controls are not wired in this milestone yet.');
        return;
      }
      const trimmedTitle = meetingTitle.trim();
      if (trimmedTitle.length === 0) {
        setErrorMessage('Meeting title is required.');
        return;
      }

      if (!api) {
        setErrorMessage('Desktop bridge unavailable.');
        return;
      }
      const response = await api.startMeeting({ title: trimmedTitle });
      setMeetingId(response.meetingId);
      resetTranscript();
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

  const completeFirstRunSetup = async (payload: { deepgramApiKey: string }): Promise<void> => {
    await saveSettings({
      deepgramApiKey: payload.deepgramApiKey,
      firstRunAcknowledged: true
    });
    setErrorMessage(null);
  };

  const validateDeepgramKey = async (key: string): Promise<{ valid: boolean; error?: string }> => {
    if (!api) {
      return {
        valid: false,
        error: 'Desktop bridge unavailable.'
      };
    }

    return api.validateSttKey({
      provider: 'deepgram',
      key
    });
  };

  const bannerMessage = errorMessage ?? transcriptionStatus.detail ?? null;

  return (
    <main data-testid="app-shell" className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Scribejam</p>
        <h1 data-testid="app-shell-title" className="text-2xl font-semibold text-ink">
          Notepad-first meeting capture shell
        </h1>
        <p data-testid="transcription-status" className="mt-1 text-xs text-zinc-500">
          Transcription: {transcriptionStatus.status}
        </p>
      </header>

      {setupRequired ? (
        <SetupWizard onValidateKey={validateDeepgramKey} onComplete={completeFirstRunSetup} />
      ) : null}

      <MeetingBar
        meetingState={meetingState}
        meetingTitle={meetingTitle}
        onMeetingTitleChange={setMeetingTitle}
        onPrimaryAction={() => void onPrimaryAction()}
        disabled={settings === null}
      />
      <StatusBanner message={bannerMessage} />

      <section className="grid gap-3 md:grid-cols-2">
        <AudioLevel source="mic" label="Microphone" value={levels.mic} />
        <AudioLevel source="system" label="System Audio" value={levels.system} />
      </section>

      <TranscriptPanel entries={transcriptEntries} />

      <SettingsPanel settings={settings} onSave={saveSettings} />
    </main>
  );
}
