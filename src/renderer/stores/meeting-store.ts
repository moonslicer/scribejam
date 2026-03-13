import { create } from 'zustand';
import type { JsonObject, MeetingDetails, MeetingState, TranscriptUpdateEvent } from '../../shared/ipc';
import { applyTranscriptEvent, type TranscriptEntry } from '../transcript/transcript-state';

export type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved';

export interface MeetingStoreState {
  meetingState: MeetingState;
  meetingId: string | null;
  meetingTitle: string;
  transcriptEntries: TranscriptEntry[];
  noteContent: JsonObject | null;
  noteSaveState: NoteSaveState;
}

export interface MeetingStoreActions {
  setMeetingState: (meetingState: MeetingState) => void;
  setMeetingId: (meetingId: string | null) => void;
  setMeetingTitle: (meetingTitle: string) => void;
  resetTranscript: () => void;
  applyTranscriptUpdate: (event: TranscriptUpdateEvent) => void;
  setNoteContent: (content: JsonObject | null) => void;
  setNoteSaveState: (state: NoteSaveState) => void;
  hydrateMeeting: (meeting: MeetingDetails) => void;
}

export type MeetingStore = MeetingStoreState & MeetingStoreActions;

export const createMeetingStore = () =>
  create<MeetingStore>((set) => ({
    meetingState: 'idle',
    meetingId: null,
    meetingTitle: '',
    transcriptEntries: [],
    noteContent: null,
    noteSaveState: 'idle',
    setMeetingState: (meetingState) => set({ meetingState }),
    setMeetingId: (meetingId) => set({ meetingId }),
    setMeetingTitle: (meetingTitle) => set({ meetingTitle }),
    resetTranscript: () => set({ transcriptEntries: [] }),
    applyTranscriptUpdate: (event) =>
      set((state) => ({
        transcriptEntries: applyTranscriptEvent(state.transcriptEntries, event)
      })),
    setNoteContent: (noteContent) =>
      set({
        noteContent,
        noteSaveState: noteContent ? 'dirty' : 'idle'
      }),
    setNoteSaveState: (noteSaveState) => set({ noteSaveState }),
    hydrateMeeting: (meeting) =>
      set({
        meetingState: meeting.state,
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        noteContent: meeting.noteContent,
        transcriptEntries: meeting.transcriptSegments.map((segment) => ({
          id: String(segment.id),
          ts: segment.startTs,
          text: segment.text,
          speaker: segment.speaker,
          isFinal: segment.isFinal
        })),
        noteSaveState: meeting.noteContent ? 'saved' : 'idle'
      })
  }));

export const useMeetingStore = createMeetingStore();
