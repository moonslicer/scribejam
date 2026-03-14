import { useEffect, useState } from 'react';
import type { ErrorAction, Settings, TranscriptionStatusEvent } from '../shared/ipc';
import { useMicCapture } from './audio/useMicCapture';
import { AudioLevel } from './components/AudioLevel';
import { MeetingBar } from './components/MeetingBar';
import { Notepad } from './components/Notepad';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupWizard } from './components/SetupWizard';
import { StatusBanner } from './components/StatusBanner';
import { TranscriptPanel } from './components/TranscriptPanel';
import { useNoteAutosave } from './hooks/use-note-autosave';
import { useHistoryStore } from './stores/history-store';
import { useMeetingStore } from './stores/meeting-store';

const NOOP_SAVE_NOTES = (): void => {};

export default function App(): JSX.Element {
  const api = window.scribejam;
  const saveNotes = api?.saveNotes ?? NOOP_SAVE_NOTES;
  const saveEnhancedNote = api?.saveEnhancedNote ?? NOOP_SAVE_NOTES;
  const [settings, setSettings] = useState<Settings | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ErrorAction | null>(null);
  const [meetingActionPending, setMeetingActionPending] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatusEvent>({ status: 'idle' });
  const [levels, setLevels] = useState({ mic: 0, system: 0 });
  const meetingState = useMeetingStore((state) => state.meetingState);
  const meetingId = useMeetingStore((state) => state.meetingId);
  const meetingTitle = useMeetingStore((state) => state.meetingTitle);
  const transcriptEntries = useMeetingStore((state) => state.transcriptEntries);
  const noteContent = useMeetingStore((state) => state.noteContent);
  const enhancedNoteContent = useMeetingStore((state) => state.enhancedNoteContent);
  const editorContent = useMeetingStore((state) => state.editorContent);
  const editorMode = useMeetingStore((state) => state.editorMode);
  const noteSaveState = useMeetingStore((state) => state.noteSaveState);
  const enhancementProgress = useMeetingStore((state) => state.enhancementProgress);
  const setMeetingState = useMeetingStore((state) => state.setMeetingState);
  const setMeetingId = useMeetingStore((state) => state.setMeetingId);
  const setMeetingTitle = useMeetingStore((state) => state.setMeetingTitle);
  const clearMeeting = useMeetingStore((state) => state.clearMeeting);
  const applyTranscriptUpdate = useMeetingStore((state) => state.applyTranscriptUpdate);
  const hydrateMeeting = useMeetingStore((state) => state.hydrateMeeting);
  const resetTranscript = useMeetingStore((state) => state.resetTranscript);
  const setNoteContent = useMeetingStore((state) => state.setNoteContent);
  const setEnhancedNoteContent = useMeetingStore((state) => state.setEnhancedNoteContent);
  const setEnhancedOutput = useMeetingStore((state) => state.setEnhancedOutput);
  const setEnhancementProgress = useMeetingStore((state) => state.setEnhancementProgress);
  const resumeEditingNotes = useMeetingStore((state) => state.resumeEditingNotes);
  const editorInstanceKey = useMeetingStore((state) => state.editorInstanceKey);
  const setNoteSaveState = useMeetingStore((state) => state.setNoteSaveState);
  const loadHistory = useHistoryStore((state) => state.loadHistory);

  useMicCapture({
    enabled: meetingState === 'recording' && settings?.captureSource !== 'system',
    onError: setErrorMessage
  });

  useEffect(() => {
    if (settings?.captureSource === 'system') {
      setLevels((previous) => ({ ...previous, mic: 0 }));
      return;
    }

    if (settings?.captureSource === 'mic') {
      setLevels((previous) => ({ ...previous, system: 0 }));
    }
  }, [settings?.captureSource]);

  useNoteAutosave({
    enabled:
      meetingState === 'recording' ||
      meetingState === 'stopped' ||
      meetingState === 'enhance_failed' ||
      meetingState === 'done',
    meetingId,
    noteContent: editorMode === 'enhanced' ? enhancedNoteContent : noteContent,
    noteSaveState,
    setNoteSaveState,
    saveNotes: editorMode === 'enhanced' ? saveEnhancedNote : saveNotes,
    onError: setErrorMessage
  });

  useEffect(() => {
    if (!api || !meetingId) {
      return;
    }

    let cancelled = false;
    void api
      .getMeeting({ meetingId })
      .then((meeting) => {
        if (!cancelled && meeting) {
          hydrateMeeting(meeting);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage('Failed to load saved meeting notes.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [api, hydrateMeeting, meetingId]);

  useEffect(() => {
    if (!api) {
      setErrorMessage('Desktop bridge unavailable. Restart the app.');
      return;
    }

    void api.getSettings().then(setSettings).catch(() => {
      setErrorMessage('Failed to load settings.');
    });
    if (api.listMeetings) {
      void loadHistory(api.listMeetings);
    }

    const unsubState = api.onMeetingStateChanged((event) => {
      setMeetingState(event.state);
      if (event.meetingId) {
        setMeetingId(event.meetingId);
      }
    });
    const unsubEnhanceProgress = api.onEnhanceProgress((event) => {
      const activeMeetingId = useMeetingStore.getState().meetingId;
      if (activeMeetingId && activeMeetingId !== event.meetingId) {
        return;
      }
      setEnhancementProgress(event);
    });

    const unsubLevel = api.onAudioLevel((event) => {
      setLevels((previous) => ({
        ...previous,
        [event.source]: event.rms
      }));
    });

    const unsubError = api.onErrorDisplay((event) => {
      setErrorMessage(event.message);
      setErrorAction(event.action ?? null);
    });
    const unsubTranscript = api.onTranscriptUpdate((event) => {
      applyTranscriptUpdate(event);
    });
    const unsubTranscriptionStatus = api.onTranscriptionStatus((event) => {
      setTranscriptionStatus(event);
    });

    return () => {
      unsubState();
      unsubEnhanceProgress();
      unsubLevel();
      unsubError();
      unsubTranscript();
      unsubTranscriptionStatus();
    };
  }, [api, applyTranscriptUpdate, loadHistory, setEnhancementProgress, setMeetingId, setMeetingState]);

  const setupRequired = settings !== null && !settings.firstRunAcknowledged;

  const onPrimaryAction = async (): Promise<void> => {
    if (meetingActionPending) {
      return;
    }

    setMeetingActionPending(true);
    try {
      setErrorMessage(null);
      setErrorAction(null);
      setEnhancementProgress(null);
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
      if (meetingState === 'stopped' || meetingState === 'enhance_failed') {
        if (!api) {
          setErrorMessage('Desktop bridge unavailable.');
          return;
        }
        if (!meetingId) {
          setErrorMessage('No stopped meeting id found.');
          return;
        }

        setMeetingState('enhancing');
        try {
          const response = await api.enhanceMeeting({ meetingId });
          setEnhancedOutput(response.output);
          setMeetingState('done');
        } catch (error) {
          setMeetingState('enhance_failed');
          throw error;
        }
        return;
      }
      if (meetingState === 'done') {
        if (!api) {
          setErrorMessage('Desktop bridge unavailable.');
          return;
        }
        if (!meetingId) {
          setErrorMessage('No completed meeting id found.');
          return;
        }

        flushPendingEnhancedNote();

        const response = await api.startMeeting({
          title: meetingTitle.trim(),
          meetingId
        });
        setMeetingTitle(response.title);
        setMeetingId(response.meetingId);
        resumeEditingNotes();
        setMeetingState('recording');
        return;
      }
      if (setupRequired) {
        setErrorMessage('Complete first-run setup to enable cloud transcription.');
        return;
      }
      if (meetingState === 'enhancing') {
        setErrorMessage('This meeting is not ready for another action yet.');
        return;
      }
      if (!api) {
        setErrorMessage('Desktop bridge unavailable.');
        return;
      }
      const response = await api.startMeeting({ title: meetingTitle.trim() });
      setMeetingTitle(response.title);
      setMeetingId(response.meetingId);
      resetTranscript();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update meeting state.');
    } finally {
      setMeetingActionPending(false);
    }
  };

  const onSecondaryAction = async (): Promise<void> => {
    if (meetingActionPending) {
      return;
    }

    setMeetingActionPending(true);
    try {
      setErrorMessage(null);
      setErrorAction(null);
      setEnhancementProgress(null);
      if (meetingState === 'enhance_failed') {
        if (!api) {
          setErrorMessage('Desktop bridge unavailable.');
          return;
        }
        if (!meetingId) {
          setErrorMessage('No failed meeting id found.');
          return;
        }

        await api.dismissEnhancementFailure({ meetingId });
        setMeetingState('stopped');
        return;
      }
      if (meetingState !== 'done') {
        return;
      }
      if (!api) {
        setErrorMessage('Desktop bridge unavailable.');
        return;
      }

      flushPendingEnhancedNote();

      await api.resetMeeting();
      clearMeeting();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to prepare a new meeting.');
    } finally {
      setMeetingActionPending(false);
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

  const completeFirstRunSetup = async (payload: {
    deepgramApiKey: string;
    openaiApiKey: string;
  }): Promise<void> => {
    const savePayload: Parameters<typeof window.scribejam.saveSettings>[0] = {
      firstRunAcknowledged: true
    };

    if (payload.deepgramApiKey.trim().length > 0) {
      savePayload.deepgramApiKey = payload.deepgramApiKey;
    }
    if (payload.openaiApiKey.trim().length > 0) {
      savePayload.openaiApiKey = payload.openaiApiKey;
    }

    await saveSettings(savePayload);
    setErrorMessage(null);
    setErrorAction(null);
  };

  const validateProviderKey = async (
    provider: 'deepgram' | 'openai',
    key: string
  ): Promise<{ valid: boolean; error?: string }> => {
    if (!api) {
      return {
        valid: false,
        error: 'Desktop bridge unavailable.'
      };
    }

    return (api.validateProviderKey ?? api.validateSttKey)({
      provider,
      key
    });
  };

  const bannerMessage = errorMessage ?? enhancementProgress?.detail ?? transcriptionStatus.detail ?? null;
  const bannerActionLabel =
    errorMessage && errorAction === 'retry'
      ? 'Retry'
      : errorMessage && errorAction === 'open-settings'
        ? 'Open Settings'
        : undefined;
  const meetingSecondaryActionLabel =
    meetingState === 'done'
      ? 'New Meeting'
      : meetingState === 'enhance_failed'
        ? 'Keep Editing'
        : undefined;
  const showEnhancementDisclosure =
    meetingState === 'stopped' || meetingState === 'enhance_failed' || meetingState === 'enhancing';

  const onBannerAction = (): void => {
    if (errorAction === 'retry') {
      void onPrimaryAction();
      return;
    }

    if (errorAction === 'open-settings') {
      document
        .querySelector<HTMLElement>('[data-testid="settings-panel"]')
        ?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }
  };

  const flushPendingEnhancedNote = (): void => {
    if (
      editorMode !== 'enhanced' ||
      noteSaveState !== 'dirty' ||
      !meetingId ||
      !enhancedNoteContent
    ) {
      return;
    }

    saveEnhancedNote({
      meetingId,
      content: enhancedNoteContent
    });
    setNoteSaveState('saved');
  };

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
        <SetupWizard
          hasStoredDeepgramKey={settings?.deepgramApiKeySet === true}
          onValidateKey={validateProviderKey}
          onComplete={completeFirstRunSetup}
        />
      ) : null}

      <MeetingBar
        meetingState={meetingState}
        meetingTitle={meetingTitle}
        onMeetingTitleChange={setMeetingTitle}
        onPrimaryAction={() => void onPrimaryAction()}
        onSecondaryAction={() => void onSecondaryAction()}
        disabled={settings === null || meetingActionPending}
        {...(meetingSecondaryActionLabel
          ? { secondaryActionLabel: meetingSecondaryActionLabel }
          : {})}
      />
      <StatusBanner
        message={bannerMessage}
        {...(bannerActionLabel
          ? {
              actionLabel: bannerActionLabel,
              onAction: onBannerAction
            }
          : {})}
      />
      {showEnhancementDisclosure ? (
        <section
          data-testid="enhancement-disclosure"
          className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-semibold">Enhancement sends content to OpenAI only when you request it.</p>
          <p className="mt-1 text-amber-900">
            Clicking {meetingState === 'enhance_failed' ? 'Retry Enhancement' : 'Enhance Notes'} sends this meeting&apos;s
            saved notes and transcript text to OpenAI. Raw audio is not sent, and you can keep taking notes if enhancement
            fails.
          </p>
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
        <div className="rounded-2xl bg-zinc-50/70 p-3">
          <Notepad
            key={`${meetingId ?? 'draft'}:${editorInstanceKey}`}
            content={editorContent}
            editable={
              meetingState === 'recording' ||
              meetingState === 'stopped' ||
              meetingState === 'enhance_failed' ||
              meetingState === 'done'
            }
            onChange={editorMode === 'enhanced' ? setEnhancedNoteContent : setNoteContent}
          />
        </div>
        <div className="flex flex-col gap-3">
          <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-1">
            <AudioLevel source="mic" label="Microphone" value={levels.mic} />
            <AudioLevel source="system" label="System Audio" value={levels.system} />
          </section>
          <TranscriptPanel entries={transcriptEntries} />
        </div>
      </section>

      <SettingsPanel
        settings={settings}
        onSave={saveSettings}
        onValidateKey={validateProviderKey}
      />
    </main>
  );
}
