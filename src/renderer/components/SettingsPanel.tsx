import { useMemo, useState } from 'react';
import type { Settings, SettingsSaveRequest } from '../../shared/ipc';

interface SettingsPanelProps {
  settings: Settings | null;
  onSave: (payload: SettingsSaveRequest) => Promise<void>;
}

export function SettingsPanel({ settings, onSave }: SettingsPanelProps): JSX.Element {
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const hasLoaded = useMemo(() => settings !== null, [settings]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      await onSave({
        firstRunAcknowledged: true,
        deepgramApiKey,
        openaiApiKey,
        anthropicApiKey
      });
      setDeepgramApiKey('');
      setOpenaiApiKey('');
      setAnthropicApiKey('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section data-testid="settings-panel" className="rounded-xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-ink">Settings (M1 Shell)</h2>
      <p className="mb-3 text-xs text-slate">API values are stored via Electron safeStorage.</p>

      <div className="grid gap-2 text-xs text-zinc-600">
        <span data-testid="settings-deepgram-configured">
          Deepgram key configured: {settings?.deepgramApiKeySet ? 'yes' : 'no'}
        </span>
        <span data-testid="settings-openai-configured">OpenAI key configured: {settings?.openaiApiKeySet ? 'yes' : 'no'}</span>
        <span data-testid="settings-anthropic-configured">
          Anthropic key configured: {settings?.anthropicApiKeySet ? 'yes' : 'no'}
        </span>
        <span data-testid="settings-first-run-ack">First-run acknowledged: {settings?.firstRunAcknowledged ? 'yes' : 'no'}</span>
      </div>

      <div className="mt-3 grid gap-2">
        <input
          data-testid="settings-input-deepgram"
          value={deepgramApiKey}
          onChange={(event) => setDeepgramApiKey(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Deepgram API key"
          autoComplete="off"
        />
        <input
          data-testid="settings-input-openai"
          value={openaiApiKey}
          onChange={(event) => setOpenaiApiKey(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="OpenAI API key"
          autoComplete="off"
        />
        <input
          data-testid="settings-input-anthropic"
          value={anthropicApiKey}
          onChange={(event) => setAnthropicApiKey(event.target.value)}
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Anthropic API key"
          autoComplete="off"
        />
        <button
          data-testid="settings-save-button"
          type="button"
          onClick={() => void handleSave()}
          disabled={!hasLoaded || saving}
          className="w-fit rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </section>
  );
}
