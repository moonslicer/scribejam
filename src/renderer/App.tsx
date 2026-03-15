import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ErrorAction, Settings, TranscriptionStatusEvent } from '../shared/ipc';
import { useMicCapture } from './audio/useMicCapture';
import { MeetingBar } from './components/MeetingBar';
import { MeetingDock } from './components/MeetingDock';
import { MeetingsSidebar } from './components/MeetingsSidebar';
import { Notepad } from './components/Notepad';
import { SettingsPanel } from './components/SettingsPanel';
import { SetupWizard } from './components/SetupWizard';
import { StatusBanner } from './components/StatusBanner';
import { TranscriptPanel } from './components/TranscriptPanel';
import { useNoteAutosave } from './hooks/use-note-autosave';
import { useHistoryStore } from './stores/history-store';
import { useMeetingStore } from './stores/meeting-store';

const NOOP_SAVE_NOTES = (): void => {};
type AppPage = 'workspace' | 'settings';

export default function App(): JSX.Element {
  const api = window.scribejam;
  const saveNotes = api?.saveNotes ?? NOOP_SAVE_NOTES;
  const saveEnhancedNote = api?.saveEnhancedNote ?? NOOP_SAVE_NOTES;
  const didRestoreInitialMeetingRef = useRef(false);
  const mainProcessRecordingIdRef = useRef<string | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<ErrorAction | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const [meetingActionPending, setMeetingActionPending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState<AppPage>('workspace');
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<TranscriptionStatusEvent>({ status: 'idle' });
  const [levels, setLevels] = useState({ mic: 0, system: 0 });
  const meetingState = useMeetingStore((state) => state.meetingState);
  const meetingId = useMeetingStore((state) => state.meetingId);
  const meetingTitle = useMeetingStore((state) => state.meetingTitle);
  const transcriptEntries = useMeetingStore((state) => state.transcriptEntries);
  const noteContent = useMeetingStore((state) => state.noteContent);
  const enhancedNoteContent = useMeetingStore((state) => state.enhancedNoteContent);
  const enhancedOutput = useMeetingStore((state) => state.enhancedOutput);
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
  const showEnhancedNotes = useMeetingStore((state) => state.showEnhancedNotes);
  const resumeEditingNotes = useMeetingStore((state) => state.resumeEditingNotes);
  const editorInstanceKey = useMeetingStore((state) => state.editorInstanceKey);
  const setNoteSaveState = useMeetingStore((state) => state.setNoteSaveState);
  const loadHistory = useHistoryStore((state) => state.loadHistory);
  const historyItems = useHistoryStore((state) => state.items);
  const historyLoading = useHistoryStore((state) => state.isLoading);
  const historyErrorMessage = useHistoryStore((state) => state.errorMessage);
  const historySearchQuery = useHistoryStore((state) => state.searchQuery);
  const selectedHistoryMeetingId = useHistoryStore((state) => state.selectedMeetingId);
  const setSelectedHistoryMeetingId = useHistoryStore((state) => state.setSelectedMeetingId);

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
          // Crash recovery: if the DB has a stale 'recording' state but the main
          // process is not actually recording this meeting, treat it as 'stopped'.
          const isStaleRecording =
            meeting.state === 'recording' &&
            mainProcessRecordingIdRef.current !== meeting.id;
          hydrateMeeting(isStaleRecording ? { ...meeting, state: 'stopped' } : meeting);
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
    setSelectedHistoryMeetingId(meetingId);
  }, [meetingId, setSelectedHistoryMeetingId]);

  useEffect(() => {
    if (!historyReady || didRestoreInitialMeetingRef.current || historyLoading) {
      return;
    }

    if (meetingId) {
      didRestoreInitialMeetingRef.current = true;
      return;
    }

    const initialMeetingId = historyItems[0]?.id ?? null;
    didRestoreInitialMeetingRef.current = true;

    if (!initialMeetingId) {
      return;
    }

    setSelectedHistoryMeetingId(initialMeetingId);
    setMeetingId(initialMeetingId);
  }, [historyItems, historyLoading, historyReady, meetingId, setMeetingId, setSelectedHistoryMeetingId]);

  useEffect(() => {
    if (!api) {
      setErrorMessage('Desktop bridge unavailable. Restart the app.');
      return;
    }

    void api.getSettings().then(setSettings).catch(() => {
      setErrorMessage('Failed to load settings.');
    });
    if (api.listMeetings) {
      void loadHistory(api.listMeetings).finally(() => {
        setHistoryReady(true);
      });
    } else {
      setHistoryReady(true);
    }

    const unsubState = api.onMeetingStateChanged((event) => {
      setMeetingState(event.state);
      if (event.meetingId) {
        setMeetingId(event.meetingId);
      }
      mainProcessRecordingIdRef.current = event.state === 'recording' && event.meetingId ? event.meetingId : null;
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

  const resumeMeetingRecording = async (): Promise<void> => {
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
  };

  const onEnhanceAction = async (): Promise<void> => {
    if (meetingActionPending) {
      return;
    }

    setMeetingActionPending(true);
    try {
      setErrorMessage(null);
      setErrorAction(null);
      setEnhancementProgress(null);

      if (meetingState !== 'stopped' && meetingState !== 'enhance_failed') {
        return;
      }
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update meeting state.');
    } finally {
      setMeetingActionPending(false);
    }
  };

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
      if (meetingState === 'stopped' || meetingState === 'done') {
        await resumeMeetingRecording();
        return;
      }
      if (meetingState === 'enhance_failed') {
        if (!api) {
          setErrorMessage('Desktop bridge unavailable.');
          return;
        }
        if (!meetingId) {
          setErrorMessage('No failed meeting id found.');
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
  const onBannerAction = (): void => {
    if (errorAction === 'retry') {
      void onPrimaryAction();
      return;
    }

    if (errorAction === 'open-settings') {
      setActivePage('settings');
      setSidebarOpen(true);
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

  const onNewMeeting = async (): Promise<void> => {
    if (meetingState === 'recording' || meetingState === 'enhancing' || meetingActionPending) {
      return;
    }
    if (meetingState === 'idle') {
      return;
    }
    setMeetingActionPending(true);
    try {
      setErrorMessage(null);
      setErrorAction(null);
      setEnhancementProgress(null);
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

  useEffect(() => {
    if (!api) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const shortcutPressed = (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey;
      if (!shortcutPressed || event.repeat || event.key.toLowerCase() !== 'e') {
        return;
      }
      if (meetingActionPending || setupRequired) {
        return;
      }
      if (meetingState !== 'stopped' && meetingState !== 'enhance_failed') {
        return;
      }

      event.preventDefault();
      void onEnhanceAction();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [api, meetingActionPending, meetingState, onEnhanceAction, setupRequired]);

  useEffect(() => {
    if (activePage !== 'workspace' && transcriptOpen) {
      setTranscriptOpen(false);
    }
  }, [activePage, transcriptOpen]);

  const onArchiveMeeting = async (meetingIdToArchive: string): Promise<void> => {
    if (!api?.archiveMeeting) {
      return;
    }
    try {
      await api.archiveMeeting({ meetingId: meetingIdToArchive });
      if (meetingIdToArchive === meetingId) {
        clearMeeting();
      }
      if (api.listMeetings) {
        void loadHistory(api.listMeetings, historySearchQuery);
      }
    } catch {
      setErrorMessage('Failed to archive meeting.');
    }
  };

  const onHistorySearchChange = (value: string): void => {
    if (!api?.listMeetings) {
      return;
    }

    void loadHistory(api.listMeetings, value);
  };

  const onHistorySelectMeeting = (nextMeetingId: string): void => {
    if (meetingState === 'recording' || meetingState === 'enhancing') {
      return;
    }

    setActivePage('workspace');
    setSelectedHistoryMeetingId(nextMeetingId);
    setMeetingId(nextMeetingId);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#262321] pt-7 text-[#f3eee8]">
      <div
        className="fixed inset-x-0 top-0 z-50 flex h-7 items-center justify-between px-3"
        style={{ WebkitAppRegion: 'drag' } as CSSProperties}
      >
        <div className="flex items-center gap-2">
          <div className="w-[78px] flex-shrink-0" />
          {activePage === 'workspace' ? (
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Close history' : 'Open history'}
              className="rounded-full border border-white/10 bg-[#2d2926]/90 p-2 text-[#d8d1c6] transition hover:border-white/20 hover:bg-[#37312d] hover:text-white"
              style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
            >
              <MenuIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActivePage('workspace')}
              className="rounded-full border border-white/10 bg-[#2d2926]/90 px-3 py-1.5 text-xs font-medium text-[#efe9de] transition hover:border-white/20 hover:bg-[#37312d]"
              style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
            >
              Back to notes
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activePage === 'workspace' ? (
            <button
              data-testid="workspace-settings-button"
              type="button"
              onClick={() => setActivePage('settings')}
              className="rounded-full border border-white/10 bg-[#2d2926]/90 p-2 text-[#d8d1c6] transition hover:border-white/20 hover:bg-[#37312d] hover:text-white"
              style={{ WebkitAppRegion: 'no-drag' } as CSSProperties}
            >
              <SettingsIcon />
            </button>
          ) : null}
        </div>
      </div>

      <MeetingsSidebar
        isOpen={sidebarOpen}
        activePage={activePage}
        items={historyItems}
        isLoading={historyLoading}
        errorMessage={historyErrorMessage}
        searchQuery={historySearchQuery}
        selectedMeetingId={selectedHistoryMeetingId}
        selectionDisabled={meetingState === 'recording' || meetingState === 'enhancing'}
        newMeetingDisabled={meetingState === 'recording' || meetingState === 'enhancing'}
        onToggle={() => setSidebarOpen(false)}
        onSearchChange={onHistorySearchChange}
        onSelectMeeting={onHistorySelectMeeting}
        onNewMeeting={() => {
          setActivePage('workspace');
          void onNewMeeting();
        }}
        onOpenSettings={() => setActivePage('settings')}
        onArchiveMeeting={(id) => void onArchiveMeeting(id)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <main
          data-testid="app-shell"
          className="relative flex flex-1 flex-col overflow-hidden"
        >
          {activePage === 'workspace' ? (
            <div className="relative flex flex-1 flex-col overflow-hidden px-4 pb-36 pt-6 sm:px-8 lg:px-12">
              <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-4">
                <h1 data-testid="app-shell-title" className="sr-only">
                  Granola-style workspace
                </h1>

                {setupRequired ? (
                  <SetupWizard
                    hasStoredDeepgramKey={settings?.deepgramApiKeySet === true}
                    onValidateKey={validateProviderKey}
                    onComplete={completeFirstRunSetup}
                  />
                ) : null}

                <StatusBanner
                  message={bannerMessage}
                  {...(bannerActionLabel
                    ? {
                        actionLabel: bannerActionLabel,
                        onAction: onBannerAction
                      }
                    : {})}
                />

                <section className="relative flex min-h-0 flex-1 overflow-hidden rounded-[2rem] border border-white/10 bg-[#efe9dd] shadow-[0_32px_90px_rgba(0,0,0,0.28)]">
                  <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-white/50 to-transparent" />
                  <div className="relative flex min-h-0 flex-1 flex-col">
                    <MeetingBar
                      meetingState={meetingState}
                      meetingTitle={meetingTitle}
                      onMeetingTitleChange={setMeetingTitle}
                      disabled={settings === null || meetingActionPending}
                    />
                    <div className="min-h-0 flex-1 px-1 pb-8">
                      <Notepad
                        key={`${meetingId ?? 'draft'}:${editorInstanceKey}`}
                        content={editorContent}
                        editable={meetingState !== 'enhancing'}
                        editorMode={editorMode}
                        showViewToggle={Boolean(enhancedNoteContent || enhancedOutput)}
                        onShowOriginalNotes={resumeEditingNotes}
                        onShowEnhancedNotes={showEnhancedNotes}
                        onChange={editorMode === 'enhanced' ? setEnhancedNoteContent : setNoteContent}
                      />
                    </div>
                  </div>
                </section>

                {(meetingState === 'stopped' || meetingState === 'enhance_failed') ? (
                  <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[35] flex justify-center">
                    <button
                      data-testid="generate-notes-button"
                      type="button"
                      disabled={settings === null || meetingActionPending}
                      onClick={() => void onEnhanceAction()}
                      className="pointer-events-auto rounded-[2rem] bg-[#7ea218] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(0,0,0,0.28)] transition hover:bg-[#8db61c] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {meetingState === 'enhance_failed' ? '✦ Retry notes' : '✦ Generate notes'}
                    </button>
                  </div>
                ) : null}
              </div>

              <TranscriptPanel
                entries={transcriptEntries}
                isOpen={transcriptOpen}
                onClose={() => setTranscriptOpen(false)}
              />

              <MeetingDock
                meetingState={meetingState}
                transcriptOpen={transcriptOpen}
                micLevel={levels.mic}
                systemLevel={levels.system}
                transcriptionStatus={transcriptionStatus}
                onToggleTranscript={() => setTranscriptOpen((previous) => !previous)}
                onPrimaryAction={() => void onPrimaryAction()}
                onSecondaryAction={() => void onSecondaryAction()}
                secondaryActionLabel={
                  meetingState === 'done'
                    ? 'New Meeting'
                    : meetingState === 'enhance_failed'
                      ? 'Keep Editing'
                      : undefined
                }
                disabled={settings === null || meetingActionPending}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-start justify-center overflow-auto px-4 py-12 sm:px-8">
              <section data-testid="settings-page" className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-[#2d2926] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.3)]">
                <h1 data-testid="app-shell-title" className="mb-2 text-2xl font-semibold text-[#f4efe6]">
                  Settings
                </h1>
                <p className="mb-6 text-sm text-[#b7aea2]">
                  Provider keys and capture preferences stay separate from the meeting workspace.
                </p>
                <SettingsPanel
                  settings={settings}
                  onSave={saveSettings}
                  onValidateKey={validateProviderKey}
                />
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function MenuIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10M3 8h10M3 11.5h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SettingsIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v1.2M8 12.3v1.2M13.5 8h-1.2M3.7 8H2.5M11.9 4.1l-.85.85M4.95 11.05l-.85.85M11.9 11.9l-.85-.85M4.95 4.95l-.85-.85"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
