import { describe, expect, it, vi } from 'vitest';
import { createHistoryStore } from '../../src/renderer/stores/history-store';

describe('history store', () => {
  it('loads meeting history through the bridge and tracks loading state', async () => {
    const store = createHistoryStore();
    const listMeetings = vi.fn().mockResolvedValue({
      items: [
        {
          id: 'meeting-1',
          title: 'Roadmap review',
          state: 'done',
          createdAt: '2026-03-12T18:00:00.000Z',
          updatedAt: '2026-03-12T18:15:00.000Z',
          durationMs: 900000,
          hasEnhancedOutput: true,
          previewText: 'Roadmap approved for beta.'
        }
      ]
    });

    const loadPromise = store.getState().loadHistory(listMeetings, ' roadmap ');

    expect(store.getState()).toMatchObject({
      isLoading: true,
      errorMessage: null,
      searchQuery: ' roadmap '
    });

    await loadPromise;

    expect(listMeetings).toHaveBeenCalledWith({ query: 'roadmap' });
    expect(store.getState()).toMatchObject({
      isLoading: false,
      errorMessage: null,
      searchQuery: ' roadmap '
    });
    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0]?.title).toBe('Roadmap review');
  });

  it('preserves the selected meeting and exposes load failures', async () => {
    const store = createHistoryStore();
    const listMeetings = vi.fn().mockRejectedValue(new Error('boom'));

    store.getState().setSelectedMeetingId('meeting-2');
    await store.getState().loadHistory(listMeetings);

    expect(store.getState()).toMatchObject({
      isLoading: false,
      errorMessage: 'Failed to load meeting history.',
      selectedMeetingId: 'meeting-2'
    });
    expect(store.getState().items).toEqual([]);
  });
});
