import { useEffect, useMemo, useState } from 'react';
import type { LlmProvider, Settings, SettingsSaveRequest } from '../../shared/ipc';

interface ProvidersPanelProps {
  settings: Settings | null;
  onSave: (payload: SettingsSaveRequest) => Promise<void>;
  onValidateKey: (
    provider: 'deepgram' | 'openai' | 'anthropic',
    key: string
  ) => Promise<{ valid: boolean; error?: string }>;
}

function KeyStatus({ isSet }: { isSet: boolean }): JSX.Element {
  return isSet ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Key saved
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
      No key set
    </span>
  );
}

export function ProvidersPanel({ settings, onSave, onValidateKey }: ProvidersPanelProps): JSX.Element {
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [llmProvider, setLlmProvider] = useState<LlmProvider>('openai');
  const [saving, setSaving] = useState(false);
  const [savedConfirm, setSavedConfirm] = useState(false);
  const [validatingDeepgram, setValidatingDeepgram] = useState(false);
  const [validatingOpenAI, setValidatingOpenAI] = useState(false);
  const [validatingAnthropic, setValidatingAnthropic] = useState(false);
  const [deepgramValidation, setDeepgramValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [openaiValidation, setOpenaiValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [anthropicValidation, setAnthropicValidation] = useState<{ valid: boolean; error?: string } | null>(null);

  const hasLoaded = useMemo(() => settings !== null, [settings]);

  useEffect(() => {
    if (settings) {
      setLlmProvider(settings.llmProvider);
    }
  }, [settings]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setSavedConfirm(false);
    try {
      const payload: SettingsSaveRequest = { llmProvider };
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
      setSavedConfirm(true);
      setTimeout(() => setSavedConfirm(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (provider: 'deepgram' | 'openai' | 'anthropic'): Promise<void> => {
    const key =
      provider === 'deepgram' ? deepgramApiKey : provider === 'openai' ? openaiApiKey : anthropicApiKey;

    if (provider === 'deepgram') setValidatingDeepgram(true);
    else if (provider === 'openai') setValidatingOpenAI(true);
    else setValidatingAnthropic(true);

    try {
      const result = await onValidateKey(provider, key);
      if (provider === 'deepgram') setDeepgramValidation(result);
      else if (provider === 'openai') setOpenaiValidation(result);
      else setAnthropicValidation(result);
    } finally {
      if (provider === 'deepgram') setValidatingDeepgram(false);
      else if (provider === 'openai') setValidatingOpenAI(false);
      else setValidatingAnthropic(false);
    }
  };

  return (
    <div data-testid="providers-panel" className="flex flex-col gap-6">
      {/* LLM provider */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-800">LLM provider</h3>
        <p className="mb-3 text-xs text-zinc-500">Used for note enhancement.</p>
        <select
          id="settings-llm-provider-input"
          data-testid="settings-input-llm-provider"
          value={llmProvider}
          onChange={(event) => setLlmProvider(event.target.value as LlmProvider)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
        >
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>

      {/* API keys */}
      <div className="border-t border-zinc-100 pt-4">
        <h3 className="mb-1 text-sm font-semibold text-zinc-800">API keys</h3>
        <p className="mb-4 text-xs text-zinc-500">
          Keys are encrypted via Electron safeStorage and never leave this device.
        </p>

        <div className="grid gap-5">
          {/* Deepgram */}
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-700">Deepgram</span>
              <span className="text-xs text-zinc-400">Speech-to-text</span>
              <KeyStatus isSet={settings?.deepgramApiKeySet ?? false} />
            </div>
            <div className="flex gap-2">
              <input
                data-testid="settings-input-deepgram"
                value={deepgramApiKey}
                onChange={(event) => {
                  setDeepgramApiKey(event.target.value);
                  setDeepgramValidation(null);
                }}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                placeholder={settings?.deepgramApiKeySet ? 'Replace existing key…' : 'Enter API key…'}
                autoComplete="off"
              />
              <button
                data-testid="settings-validate-deepgram-button"
                type="button"
                onClick={() => void handleValidate('deepgram')}
                disabled={deepgramApiKey.trim().length === 0 || validatingDeepgram}
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                {validatingDeepgram ? 'Validating…' : 'Validate'}
              </button>
            </div>
            {deepgramValidation ? (
              <p
                data-testid="settings-validation-deepgram"
                className={`text-xs ${deepgramValidation.valid ? 'text-emerald-700' : 'text-rose-600'}`}
              >
                {deepgramValidation.valid ? 'Key is valid.' : (deepgramValidation.error ?? 'Unable to validate key.')}
              </p>
            ) : null}
          </div>

          {/* OpenAI */}
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-700">OpenAI</span>
              <KeyStatus isSet={settings?.openaiApiKeySet ?? false} />
            </div>
            <div className="flex gap-2">
              <input
                data-testid="settings-input-openai"
                value={openaiApiKey}
                onChange={(event) => {
                  setOpenaiApiKey(event.target.value);
                  setOpenaiValidation(null);
                }}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                placeholder={settings?.openaiApiKeySet ? 'Replace existing key…' : 'Enter API key…'}
                autoComplete="off"
              />
              <button
                data-testid="settings-validate-openai-button"
                type="button"
                onClick={() => void handleValidate('openai')}
                disabled={openaiApiKey.trim().length === 0 || validatingOpenAI}
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                {validatingOpenAI ? 'Validating…' : 'Validate'}
              </button>
            </div>
            {openaiValidation ? (
              <p
                data-testid="settings-validation-openai"
                className={`text-xs ${openaiValidation.valid ? 'text-emerald-700' : 'text-rose-600'}`}
              >
                {openaiValidation.valid ? 'Key is valid.' : (openaiValidation.error ?? 'Unable to validate key.')}
              </p>
            ) : null}
          </div>

          {/* Anthropic */}
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-700">Anthropic</span>
              <KeyStatus isSet={settings?.anthropicApiKeySet ?? false} />
            </div>
            <div className="flex gap-2">
              <input
                data-testid="settings-input-anthropic"
                value={anthropicApiKey}
                onChange={(event) => {
                  setAnthropicApiKey(event.target.value);
                  setAnthropicValidation(null);
                }}
                className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                placeholder={settings?.anthropicApiKeySet ? 'Replace existing key…' : 'Enter API key…'}
                autoComplete="off"
              />
              <button
                data-testid="settings-validate-anthropic-button"
                type="button"
                onClick={() => void handleValidate('anthropic')}
                disabled={anthropicApiKey.trim().length === 0 || validatingAnthropic}
                className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                {validatingAnthropic ? 'Validating…' : 'Validate'}
              </button>
            </div>
            {anthropicValidation ? (
              <p
                data-testid="settings-validation-anthropic"
                className={`text-xs ${anthropicValidation.valid ? 'text-emerald-700' : 'text-rose-600'}`}
              >
                {anthropicValidation.valid ? 'Key is valid.' : (anthropicValidation.error ?? 'Unable to validate key.')}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="border-t border-zinc-100 pt-4">
        <div className="flex items-center gap-3">
          <button
            data-testid="settings-save-button"
            type="button"
            onClick={() => void handleSave()}
            disabled={!hasLoaded || saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {saving ? 'Saving…' : 'Save Providers'}
          </button>
          {savedConfirm ? (
            <span className="text-xs font-medium text-emerald-600">Saved.</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
