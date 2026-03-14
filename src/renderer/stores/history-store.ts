import { create } from 'zustand';
import type {
  MeetingHistoryItem,
  MeetingListRequest,
  MeetingListResponse
} from '../../shared/ipc';

type ListMeetings = (payload?: MeetingListRequest) => Promise<MeetingListResponse>;

export interface HistoryStoreState {
  items: MeetingHistoryItem[];
  isLoading: boolean;
  errorMessage: string | null;
  searchQuery: string;
  selectedMeetingId: string | null;
}

export interface HistoryStoreActions {
  setSearchQuery: (searchQuery: string) => void;
  setSelectedMeetingId: (meetingId: string | null) => void;
  loadHistory: (listMeetings: ListMeetings, query?: string) => Promise<void>;
}

export type HistoryStore = HistoryStoreState & HistoryStoreActions;

export const createHistoryStore = () =>
  create<HistoryStore>((set, get) => ({
    items: [],
    isLoading: false,
    errorMessage: null,
    searchQuery: '',
    selectedMeetingId: null,
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedMeetingId: (selectedMeetingId) => set({ selectedMeetingId }),
    loadHistory: async (listMeetings, query) => {
      const nextQuery = query ?? get().searchQuery;
      const trimmedQuery = nextQuery.trim();

      set({
        isLoading: true,
        errorMessage: null,
        searchQuery: nextQuery
      });

      try {
        const response = await listMeetings(
          trimmedQuery.length > 0 ? { query: trimmedQuery } : undefined
        );

        set({
          items: response.items,
          isLoading: false,
          errorMessage: null
        });
      } catch {
        set({
          isLoading: false,
          errorMessage: 'Failed to load meeting history.'
        });
      }
    }
  }));

export const useHistoryStore = createHistoryStore();
