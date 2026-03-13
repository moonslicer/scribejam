import { create } from 'zustand';
import type {
  EnhancedOutput,
  JsonObject,
  MeetingDetails,
  MeetingState,
  TranscriptUpdateEvent
} from '../../shared/ipc';
import { enhancedOutputToDoc } from '../editor/enhanced-output-to-doc';
import { applyTranscriptEvent, type TranscriptEntry } from '../transcript/transcript-state';

export type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved';

export interface MeetingStoreState {
  meetingState: MeetingState;
  meetingId: string | null;
  meetingTitle: string;
  transcriptEntries: TranscriptEntry[];
  noteContent: JsonObject | null;
  editorContent: JsonObject | null;
  enhancedOutput: EnhancedOutput | null;
  editorInstanceKey: number;
  noteSaveState: NoteSaveState;
}

export interface MeetingStoreActions {
  setMeetingState: (meetingState: MeetingState) => void;
  setMeetingId: (meetingId: string | null) => void;
  setMeetingTitle: (meetingTitle: string) => void;
  clearMeeting: () => void;
  resetTranscript: () => void;
  applyTranscriptUpdate: (event: TranscriptUpdateEvent) => void;
  setNoteContent: (content: JsonObject | null) => void;
  setEnhancedOutput: (output: EnhancedOutput | null) => void;
  resumeEditingNotes: () => void;
  setNoteSaveState: (state: NoteSaveState) => void;
  hydrateMeeting: (meeting: MeetingDetails) => void;
}

export type MeetingStore = MeetingStoreState & MeetingStoreActions;

function cloneJsonObject<T extends JsonObject | null>(value: T): T {
  if (value === null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

export const createMeetingStore = () =>
  create<MeetingStore>((set) => ({
    meetingState: 'idle',
    meetingId: null,
    meetingTitle: '',
    transcriptEntries: [],
    noteContent: null,
    editorContent: null,
    enhancedOutput: null,
    editorInstanceKey: 0,
    noteSaveState: 'idle',
    setMeetingState: (meetingState) => set({ meetingState }),
    setMeetingId: (meetingId) => set({ meetingId }),
    setMeetingTitle: (meetingTitle) => set({ meetingTitle }),
    clearMeeting: () =>
      set((state) => ({
        meetingState: 'idle',
        meetingId: null,
        meetingTitle: '',
        transcriptEntries: [],
        noteContent: null,
        editorContent: null,
        enhancedOutput: null,
        editorInstanceKey: state.editorInstanceKey + 1,
        noteSaveState: 'idle'
      })),
    resetTranscript: () => set({ transcriptEntries: [] }),
    applyTranscriptUpdate: (event) =>
      set((state) => ({
        transcriptEntries: applyTranscriptEvent(state.transcriptEntries, event)
      })),
    setNoteContent: (noteContent) =>
      set((state) => {
        const previousSerialized = JSON.stringify(state.noteContent);
        const nextSerialized = JSON.stringify(noteContent);
        if (previousSerialized === nextSerialized) {
          return state;
        }

        return {
          noteContent: cloneJsonObject(noteContent),
          editorContent: cloneJsonObject(noteContent),
          noteSaveState: noteContent ? 'dirty' : 'idle'
        };
      }),
    setEnhancedOutput: (enhancedOutput) =>
      set((state) => ({
        enhancedOutput,
        editorContent: enhancedOutput
          ? enhancedOutputToDoc(enhancedOutput)
          : cloneJsonObject(state.noteContent)
      })),
    resumeEditingNotes: () =>
      set((state) => ({
        enhancedOutput: null,
        editorContent: cloneJsonObject(state.noteContent),
        editorInstanceKey: state.editorInstanceKey + 1
      })),
    setNoteSaveState: (noteSaveState) => set({ noteSaveState }),
    hydrateMeeting: (meeting) =>
      set({
        meetingState: meeting.state,
        meetingId: meeting.id,
        meetingTitle: meeting.title,
        noteContent: cloneJsonObject(meeting.noteContent),
        enhancedOutput: meeting.enhancedOutput,
        editorContent: meeting.enhancedOutput
          ? enhancedOutputToDoc(meeting.enhancedOutput)
          : cloneJsonObject(meeting.noteContent),
        transcriptEntries: meeting.transcriptSegments.map((segment) => ({
          id: String(segment.id),
          ts: segment.startTs,
          text: segment.text,
          speaker: segment.speaker,
          isFinal: segment.isFinal
        })),
        editorInstanceKey: 0,
        noteSaveState: meeting.noteContent ? 'saved' : 'idle'
      })
  }));

export const useMeetingStore = createMeetingStore();
