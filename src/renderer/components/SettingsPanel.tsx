import { useEffect, useMemo, useState } from 'react';
import type {
  CustomTemplateSettings,
  LlmProvider,
  Settings,
  SettingsSaveRequest
} from '../../shared/ipc';
import { MAX_TEMPLATE_INSTRUCTIONS_LENGTH } from '../../shared/ipc';
import { BUILT_IN_TEMPLATES, getCustomTemplateDefinition } from '../../shared/templates';

interface SettingsPanelProps {
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

export function SettingsPanel({ settings, onSave, onValidateKey }: SettingsPanelProps): JSX.Element {
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [llmProvider, setLlmProvider] = useState<LlmProvider>('openai');
  const [defaultTemplateId, setDefaultTemplateId] = useState<NonNullable<Settings['defaultTemplateId']>>('auto');
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customTemplateInstructions, setCustomTemplateInstructions] = useState('');
  const [saving, setSaving] = useState(false);
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
      setDefaultTemplateId(settings.defaultTemplateId ?? 'auto');
      setCustomTemplateName(settings.customTemplate?.name ?? '');
      setCustomTemplateInstructions(settings.customTemplate?.instructions ?? '');
    }
  }, [settings]);

  const normalizedCustomTemplate = getCustomTemplateDefinition({
    name: customTemplateName,
    instructions: customTemplateInstructions
  });
  const hasCustomTemplateInput =
    customTemplateName.trim().length > 0 || customTemplateInstructions.trim().length > 0;
  const hasPartialCustomTemplate =
    hasCustomTemplateInput &&
    (!normalizedCustomTemplate || customTemplateInstructions.trim().length > MAX_TEMPLATE_INSTRUCTIONS_LENGTH);
  const isCustomTemplateTooLong =
    customTemplateInstructions.length > MAX_TEMPLATE_INSTRUCTIONS_LENGTH;
  const customCharacterCount = `${customTemplateInstructions.length}/${MAX_TEMPLATE_INSTRUCTIONS_LENGTH}`;

  useEffect(() => {
    if (!normalizedCustomTemplate && defaultTemplateId === 'custom') {
      setDefaultTemplateId('auto');
    }
  }, [defaultTemplateId, normalizedCustomTemplate]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const payload: SettingsSaveRequest = {
        llmProvider,
        defaultTemplateId:
          defaultTemplateId === 'custom' && !normalizedCustomTemplate ? 'auto' : defaultTemplateId,
        ...(settings?.customTemplate !== undefined || hasCustomTemplateInput
          ? {
              customTemplate: normalizedCustomTemplate
                ? {
                    name: normalizedCustomTemplate.name,
                    instructions: normalizedCustomTemplate.instructions
                  }
                : ({ name: '', instructions: '' } satisfies CustomTemplateSettings)
            }
          : {})
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

  const handleValidate = async (provider: 'deepgram' | 'openai' | 'anthropic'): Promise<void> => {
    if (provider === 'deepgram') {
      setValidatingDeepgram(true);
    } else if (provider === 'openai') {
      setValidatingOpenAI(true);
    } else {
      setValidatingAnthropic(true);
    }

    try {
      const key =
        provider === 'deepgram' ? deepgramApiKey : provider === 'openai' ? openaiApiKey : anthropicApiKey;
      const result = await onValidateKey(provider, key);

      if (provider === 'deepgram') {
        setDeepgramValidation(result);
      } else if (provider === 'openai') {
        setOpenaiValidation(result);
      } else {
        setAnthropicValidation(result);
      }
    } finally {
      if (provider === 'deepgram') {
        setValidatingDeepgram(false);
      } else if (provider === 'openai') {
        setValidatingOpenAI(false);
      } else {
        setValidatingAnthropic(false);
      }
    }
  };

  return (
    <section data-testid="settings-panel" className="rounded-xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-ink">Settings</h2>
      <p className="mb-4 text-xs text-slate">API keys are encrypted via Electron safeStorage.</p>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">AI Providers</h3>

        <div className="mb-3 grid gap-1">
          <label className="text-sm font-medium text-zinc-700" htmlFor="settings-llm-provider-input">
            LLM provider
          </label>
          <select
            id="settings-llm-provider-input"
            data-testid="settings-input-llm-provider"
            value={llmProvider}
            onChange={(event) => setLlmProvider(event.target.value as LlmProvider)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>

        <div className="mb-3 grid gap-2 border-t border-zinc-100 pt-3">
          <div>
            <h3 className="text-sm font-medium text-zinc-700">Custom template</h3>
            <p className="text-xs text-zinc-500">
              Natural-language instructions that shape enhancement for your recurring meeting type.
            </p>
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium text-zinc-700" htmlFor="settings-custom-template-name-input">
              Template name
            </label>
            <input
              id="settings-custom-template-name-input"
              data-testid="settings-input-custom-template-name"
              value={customTemplateName}
              onChange={(event) => setCustomTemplateName(event.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="e.g. Customer interview"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium text-zinc-700" htmlFor="settings-custom-template-instructions-input">
              Instructions
            </label>
            <textarea
              id="settings-custom-template-instructions-input"
              data-testid="settings-input-custom-template-instructions"
              value={customTemplateInstructions}
              onChange={(event) => setCustomTemplateInstructions(event.target.value)}
              className="min-h-32 rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="Describe what matters in this meeting type, how blocks should be structured, and when action items or decisions should stay empty."
            />
            <div className="flex items-center justify-between text-xs">
              <span
                data-testid="settings-custom-template-char-count"
                className={isCustomTemplateTooLong ? 'text-rose-700' : 'text-zinc-500'}
              >
                {customCharacterCount}
              </span>
              {isCustomTemplateTooLong ? (
                <span data-testid="settings-custom-template-validation" className="text-rose-700">
                  Keep instructions at or under {MAX_TEMPLATE_INSTRUCTIONS_LENGTH} characters.
                </span>
              ) : hasPartialCustomTemplate ? (
                <span data-testid="settings-custom-template-validation" className="text-rose-700">
                  Add both a name and instructions to save a custom template.
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mb-3 grid gap-1 border-t border-zinc-100 pt-3">
          <label className="text-sm font-medium text-zinc-700" htmlFor="settings-default-template-input">
            Default enhancement template
          </label>
          <select
            id="settings-default-template-input"
            data-testid="settings-input-default-template"
            value={defaultTemplateId}
            onChange={(event) =>
              setDefaultTemplateId(event.target.value as NonNullable<Settings['defaultTemplateId']>)
            }
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            {BUILT_IN_TEMPLATES.filter((template) => template.id !== 'custom').map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
            {normalizedCustomTemplate ? (
              <option value="custom">Custom: {normalizedCustomTemplate.name}</option>
            ) : null}
          </select>
        </div>

        <div className="mb-3 grid gap-1.5 border-t border-zinc-100 pt-3">
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
              className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder={settings?.deepgramApiKeySet ? 'Replace existing key…' : 'Enter API key…'}
              autoComplete="off"
            />
            <button
              data-testid="settings-validate-deepgram-button"
              type="button"
              onClick={() => void handleValidate('deepgram')}
              disabled={deepgramApiKey.trim().length === 0 || validatingDeepgram}
              className="shrink-0 rounded bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {validatingDeepgram ? 'Validating…' : 'Validate'}
            </button>
          </div>
          {deepgramValidation ? (
            <p data-testid="settings-validation-deepgram" className={`text-xs ${deepgramValidation.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
              {deepgramValidation.valid ? 'Key is valid.' : deepgramValidation.error ?? 'Unable to validate key.'}
            </p>
          ) : null}
        </div>

        <div className="mb-3 grid gap-1.5 border-t border-zinc-100 pt-3">
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
              className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder={settings?.openaiApiKeySet ? 'Replace existing key…' : 'Enter API key…'}
              autoComplete="off"
            />
            <button
              data-testid="settings-validate-openai-button"
              type="button"
              onClick={() => void handleValidate('openai')}
              disabled={openaiApiKey.trim().length === 0 || validatingOpenAI}
              className="shrink-0 rounded bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {validatingOpenAI ? 'Validating…' : 'Validate'}
            </button>
          </div>
          {openaiValidation ? (
            <p data-testid="settings-validation-openai" className={`text-xs ${openaiValidation.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
              {openaiValidation.valid ? 'Key is valid.' : openaiValidation.error ?? 'Unable to validate key.'}
            </p>
          ) : null}
        </div>

        <div className="mb-3 grid gap-1.5 border-t border-zinc-100 pt-3">
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
              className="min-w-0 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder={settings?.anthropicApiKeySet ? 'Replace existing key…' : 'Enter API key…'}
              autoComplete="off"
            />
            <button
              data-testid="settings-validate-anthropic-button"
              type="button"
              onClick={() => void handleValidate('anthropic')}
              disabled={anthropicApiKey.trim().length === 0 || validatingAnthropic}
              className="shrink-0 rounded bg-zinc-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
            >
              {validatingAnthropic ? 'Validating…' : 'Validate'}
            </button>
          </div>
          {anthropicValidation ? (
            <p data-testid="settings-validation-anthropic" className={`text-xs ${anthropicValidation.valid ? 'text-emerald-700' : 'text-rose-700'}`}>
              {anthropicValidation.valid ? 'Key is valid.' : anthropicValidation.error ?? 'Unable to validate key.'}
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-zinc-100 pt-3">
        <button
          data-testid="settings-save-button"
          type="button"
          onClick={() => void handleSave()}
          disabled={!hasLoaded || saving || hasPartialCustomTemplate || isCustomTemplateTooLong}
          className="w-fit rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </section>
  );
}
