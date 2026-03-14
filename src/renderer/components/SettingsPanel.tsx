import { useEffect, useMemo, useState } from 'react';
import type { Settings, SettingsSaveRequest } from '../../shared/ipc';

interface SettingsPanelProps {
  settings: Settings | null;
  onSave: (payload: SettingsSaveRequest) => Promise<void>;
  onValidateKey: (
    provider: 'deepgram' | 'openai',
    key: string
  ) => Promise<{ valid: boolean; error?: string }>;
}

export function SettingsPanel({ settings, onSave, onValidateKey }: SettingsPanelProps): JSX.Element {
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [captureSource, setCaptureSource] = useState<Settings['captureSource']>('mixed');
  const [saving, setSaving] = useState(false);
  const [validatingDeepgram, setValidatingDeepgram] = useState(false);
  const [validatingOpenAI, setValidatingOpenAI] = useState(false);
  const [deepgramValidation, setDeepgramValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [openaiValidation, setOpenaiValidation] = useState<{ valid: boolean; error?: string } | null>(null);

  const hasLoaded = useMemo(() => settings !== null, [settings]);

  useEffect(() => {
    if (settings) {
      setCaptureSource(settings.captureSource);
    }
  }, [settings]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const payload: SettingsSaveRequest = {
        captureSource
      };

      if (deepgramApiKey.trim().length > 0) {
        payload.deepgramApiKey = deepgramApiKey;
      }
      if (openaiApiKey.trim().length > 0) {
        payload.openaiApiKey = openaiApiKey;
      }
      if (anthropicApiKey.trim().length > 0) {
        payload.anthropicApiKey = anthropicApiKey;
      }

      await onSave(payload);
      setDeepgramApiKey('');
      setOpenaiApiKey('');
      setAnthropicApiKey('');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (provider: 'deepgram' | 'openai'): Promise<void> => {
    if (provider === 'deepgram') {
      setValidatingDeepgram(true);
    } else {
      setValidatingOpenAI(true);
    }

    try {
      const result = await onValidateKey(
        provider,
        provider === 'deepgram' ? deepgramApiKey : openaiApiKey
      );

      if (provider === 'deepgram') {
        setDeepgramValidation(result);
      } else {
        setOpenaiValidation(result);
      }
    } finally {
      if (provider === 'deepgram') {
        setValidatingDeepgram(false);
      } else {
        setValidatingOpenAI(false);
      }
    }
  };

  return (
    <section data-testid="settings-panel" className="rounded-xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-ink">Settings</h2>
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
        <span data-testid="settings-capture-source">Capture source: {settings?.captureSource ?? 'mixed'}</span>
      </div>

      <div className="mt-3 grid gap-2">
        <label className="grid gap-1 text-sm text-zinc-700" htmlFor="settings-capture-source-input">
          <span className="font-medium">Capture source</span>
          <select
            id="settings-capture-source-input"
            data-testid="settings-input-capture-source"
            value={captureSource}
            onChange={(event) => setCaptureSource(event.target.value as Settings['captureSource'])}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="mixed">System audio + microphone</option>
            <option value="system">System audio only</option>
            <option value="mic">Microphone only</option>
          </select>
        </label>
        <p className="text-xs text-zinc-500">
          Use `system audio only` to debug lyric pickup without mic bleed. Changes apply fully on the next meeting start.
        </p>
        <input
          data-testid="settings-input-deepgram"
          value={deepgramApiKey}
          onChange={(event) => {
            setDeepgramApiKey(event.target.value);
            setDeepgramValidation(null);
          }}
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Deepgram API key"
          autoComplete="off"
        />
        <button
          data-testid="settings-validate-deepgram-button"
          type="button"
          onClick={() => void handleValidate('deepgram')}
          disabled={deepgramApiKey.trim().length === 0 || validatingDeepgram}
          className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {validatingDeepgram ? 'Validating...' : 'Validate Deepgram'}
        </button>
        {deepgramValidation ? (
          <p data-testid="settings-validation-deepgram" className={`text-sm ${deepgramValidation.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
            {deepgramValidation.valid ? 'Key is valid.' : deepgramValidation.error ?? 'Unable to validate key.'}
          </p>
        ) : null}
        <input
          data-testid="settings-input-openai"
          value={openaiApiKey}
          onChange={(event) => {
            setOpenaiApiKey(event.target.value);
            setOpenaiValidation(null);
          }}
          className="rounded border border-zinc-300 px-3 py-2 text-sm"
          placeholder="OpenAI API key"
          autoComplete="off"
        />
        <button
          data-testid="settings-validate-openai-button"
          type="button"
          onClick={() => void handleValidate('openai')}
          disabled={openaiApiKey.trim().length === 0 || validatingOpenAI}
          className="w-fit rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {validatingOpenAI ? 'Validating...' : 'Validate OpenAI'}
        </button>
        {openaiValidation ? (
          <p data-testid="settings-validation-openai" className={`text-sm ${openaiValidation.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
            {openaiValidation.valid ? 'Key is valid.' : openaiValidation.error ?? 'Unable to validate key.'}
          </p>
        ) : null}
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
