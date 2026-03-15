import { create } from 'zustand';
import type {
  EnhanceProgressEvent,
  EnhancedOutput,
  JsonObject,
  MeetingDetails,
  MeetingState,
  TranscriptUpdateEvent
} from '../../shared/ipc';
import { enhancedOutputToDoc } from '../editor/enhanced-output-to-doc';
import { applyTranscriptEvent, type TranscriptEntry } from '../transcript/transcript-state';

export type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved';
export type EditorMode = 'notes' | 'enhanced';

export interface MeetingStoreState {
  meetingState: MeetingState;
  meetingId: string | null;
  meetingTitle: string;
  transcriptEntries: TranscriptEntry[];
  noteContent: JsonObject | null;
  enhancedNoteContent: JsonObject | null;
  editorContent: JsonObject | null;
  editorMode: EditorMode;
  enhancedOutput: EnhancedOutput | null;
  enhancementProgress: EnhanceProgressEvent | null;
  editorInstanceKey: number;
  noteSaveState: NoteSaveState;
  noteEditedAfterEnhancement: boolean;
}

export interface MeetingStoreActions {
  setMeetingState: (meetingState: MeetingState) => void;
  setMeetingId: (meetingId: string | null) => void;
  setMeetingTitle: (meetingTitle: string) => void;
  clearMeeting: () => void;
  resetTranscript: () => void;
  applyTranscriptUpdate: (event: TranscriptUpdateEvent) => void;
  setNoteContent: (content: JsonObject | null) => void;
  setEnhancedNoteContent: (content: JsonObject | null) => void;
  setEnhancedOutput: (output: EnhancedOutput | null) => void;
  setEnhancementProgress: (progress: EnhanceProgressEvent | null) => void;
  showEnhancedNotes: () => void;
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
    enhancedNoteContent: null,
    editorContent: null,
    editorMode: 'notes',
    enhancedOutput: null,
    enhancementProgress: null,
    editorInstanceKey: 0,
    noteSaveState: 'idle',
  noteEditedAfterEnhancement: false,
    setMeetingState: (meetingState) =>
      set((state) => {
        const editorMode = deriveEditorMode(
          meetingState,
          state.enhancedNoteContent,
          state.enhancedOutput
        );

        return {
          meetingState,
          editorMode,
          editorContent: deriveEditorContent(
            editorMode,
            state.noteContent,
            state.enhancedNoteContent,
            state.enhancedOutput
          )
        };
      }),
    setMeetingId: (meetingId) => set({ meetingId }),
    setMeetingTitle: (meetingTitle) => set({ meetingTitle }),
    clearMeeting: () =>
      set((state) => ({
        meetingState: 'idle',
        meetingId: null,
        meetingTitle: '',
        transcriptEntries: [],
        noteContent: null,
        enhancedNoteContent: null,
        editorContent: null,
        editorMode: 'notes',
        enhancedOutput: null,
        enhancementProgress: null,
        editorInstanceKey: state.editorInstanceKey + 1,
        noteSaveState: 'idle',
        noteEditedAfterEnhancement: false
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
          editorContent:
            state.editorMode === 'notes'
              ? cloneJsonObject(noteContent)
              : cloneJsonObject(state.editorContent),
          noteSaveState: noteContent ? 'dirty' : 'idle',
          noteEditedAfterEnhancement: state.meetingState === 'done' ? true : state.noteEditedAfterEnhancement
        };
      }),
    setEnhancedNoteContent: (enhancedNoteContent) =>
      set((state) => {
        const previousSerialized = JSON.stringify(state.enhancedNoteContent);
        const nextSerialized = JSON.stringify(enhancedNoteContent);
        if (previousSerialized === nextSerialized) {
          return state;
        }

        return {
          enhancedNoteContent: cloneJsonObject(enhancedNoteContent),
          editorContent:
            state.editorMode === 'enhanced'
              ? cloneJsonObject(enhancedNoteContent)
              : cloneJsonObject(state.editorContent),
          noteSaveState: enhancedNoteContent ? 'dirty' : 'idle',
          noteEditedAfterEnhancement: state.meetingState === 'done' ? true : state.noteEditedAfterEnhancement
        };
      }),
    setEnhancedOutput: (enhancedOutput) =>
      set((state) => {
        const enhancedNoteContent = enhancedOutput ? enhancedOutputToDoc(enhancedOutput) : null;
        const editorMode = enhancedOutput ? 'enhanced' : 'notes';

        return {
          enhancedOutput,
          enhancedNoteContent,
          editorMode,
          editorContent: deriveEditorContent(
            editorMode,
            state.noteContent,
            enhancedNoteContent,
            enhancedOutput
          ),
          noteSaveState: enhancedNoteContent ? 'saved' : state.noteSaveState,
          noteEditedAfterEnhancement: false
        };
      }),
    setEnhancementProgress: (enhancementProgress) => set({ enhancementProgress }),
    showEnhancedNotes: () =>
      set((state) => ({
        enhancementProgress: null,
        editorMode: 'enhanced',
        editorContent: deriveEditorContent(
          'enhanced',
          state.noteContent,
          state.enhancedNoteContent,
          state.enhancedOutput
        ),
        editorInstanceKey: state.editorInstanceKey + 1
      })),
    resumeEditingNotes: () =>
      set((state) => ({
        enhancementProgress: null,
        editorMode: 'notes',
        editorContent: cloneJsonObject(state.noteContent),
        editorInstanceKey: state.editorInstanceKey + 1
      })),
    setNoteSaveState: (noteSaveState) => set({ noteSaveState }),
    hydrateMeeting: (meeting) =>
      set(() => {
        const editorMode = deriveEditorMode(
          meeting.state,
          meeting.enhancedNoteContent,
          meeting.enhancedOutput
        );

        return {
          meetingState: meeting.state,
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          noteContent: cloneJsonObject(meeting.noteContent),
          enhancedNoteContent: cloneJsonObject(meeting.enhancedNoteContent),
          enhancedOutput: meeting.enhancedOutput,
          enhancementProgress: null,
          editorMode,
          editorContent: deriveEditorContent(
            editorMode,
            meeting.noteContent,
            meeting.enhancedNoteContent,
            meeting.enhancedOutput
          ),
          transcriptEntries: meeting.transcriptSegments.map((segment) => ({
            id: String(segment.id),
            ts: segment.startTs,
            text: segment.text,
            speaker: segment.speaker,
            isFinal: segment.isFinal
          })),
          editorInstanceKey: 0,
          noteSaveState:
            meeting.noteContent || meeting.enhancedNoteContent || meeting.enhancedOutput
              ? 'saved'
              : 'idle'
        };
      })
  }));

export const useMeetingStore = createMeetingStore();

function deriveEditorMode(
  meetingState: MeetingState,
  enhancedNoteContent: JsonObject | null,
  enhancedOutput: EnhancedOutput | null
): EditorMode {
  if (
    (meetingState === 'done' || meetingState === 'enhance_failed') &&
    (enhancedNoteContent !== null || enhancedOutput !== null)
  ) {
    return 'enhanced';
  }

  return 'notes';
}

function deriveEditorContent(
  editorMode: EditorMode,
  noteContent: JsonObject | null,
  enhancedNoteContent: JsonObject | null,
  enhancedOutput: EnhancedOutput | null
): JsonObject | null {
  if (editorMode === 'enhanced') {
    return (
      cloneJsonObject(enhancedNoteContent) ??
      (enhancedOutput ? enhancedOutputToDoc(enhancedOutput) : null)
    );
  }

  return cloneJsonObject(noteContent);
}
