import { useMemo, useState } from 'react';

interface SetupWizardProps {
  hasStoredDeepgramKey: boolean;
  onValidateKey: (
    provider: 'deepgram' | 'openai',
    key: string
  ) => Promise<{ valid: boolean; error?: string }>;
  onComplete: (payload: { deepgramApiKey: string; openaiApiKey: string }) => Promise<void>;
}

export function SetupWizard({
  hasStoredDeepgramKey,
  onValidateKey,
  onComplete
}: SetupWizardProps): JSX.Element {
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isValidatingDeepgram, setIsValidatingDeepgram] = useState(false);
  const [isValidatingOpenAI, setIsValidatingOpenAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deepgramValidation, setDeepgramValidation] = useState<{ valid: boolean; error?: string } | null>(null);
  const [openaiValidation, setOpenaiValidation] = useState<{ valid: boolean; error?: string } | null>(null);

  const canContinue = useMemo(() => {
    return (hasStoredDeepgramKey || deepgramValidation?.valid === true) && hasAcknowledged && !isSaving;
  }, [deepgramValidation, hasAcknowledged, hasStoredDeepgramKey, isSaving]);

  const validateKey = async (provider: 'deepgram' | 'openai'): Promise<void> => {
    if (provider === 'deepgram') {
      setIsValidatingDeepgram(true);
    } else {
      setIsValidatingOpenAI(true);
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
        setIsValidatingDeepgram(false);
      } else {
        setIsValidatingOpenAI(false);
      }
    }
  };

  const finishSetup = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await onComplete({ deepgramApiKey, openaiApiKey });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      data-testid="setup-wizard"
      className="rounded-xl border border-zinc-300 bg-white p-5 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-ink">Before You Start</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Scribejam sends mixed meeting audio to Deepgram for transcription and sends saved notes plus transcript text to OpenAI for post-meeting enhancement in cloud-assisted mode.
      </p>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
        <li>Audio capture runs locally in this app.</li>
        <li>Raw audio is processed in-memory and not written to disk by Scribejam.</li>
        <li>Transcript text is returned from Deepgram and shown in the Transcript panel.</li>
        <li>Saved notes and transcript text are sent to OpenAI only when you run enhancement.</li>
      </ul>

      <div className="mt-4 flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700" htmlFor="setup-deepgram-key">
          Deepgram API key
        </label>
        {hasStoredDeepgramKey ? (
          <p className="text-xs text-zinc-500">
            A Deepgram key is already stored on this device. Leave this blank to keep it, or enter a new one to replace it.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <input
            id="setup-deepgram-key"
            data-testid="setup-input-deepgram"
            value={deepgramApiKey}
            onChange={(event) => {
              setDeepgramApiKey(event.target.value);
              setDeepgramValidation(null);
            }}
            placeholder="dg_..."
            autoComplete="off"
            className="min-w-[280px] flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            data-testid="setup-validate-deepgram-button"
            type="button"
            onClick={() => void validateKey('deepgram')}
            disabled={deepgramApiKey.trim().length === 0 || isValidatingDeepgram}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isValidatingDeepgram ? 'Validating...' : 'Validate'}
          </button>
        </div>

        {deepgramValidation?.valid === true ? (
          <p data-testid="setup-validation-deepgram" className="text-sm text-emerald-700">
            Key is valid.
          </p>
        ) : null}

        {deepgramValidation?.valid === false ? (
          <p data-testid="setup-validation-deepgram" className="text-sm text-rose-700">
            {deepgramValidation.error ?? 'Unable to validate key.'}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700" htmlFor="setup-openai-key">
          OpenAI API key (optional for enhancement)
        </label>
        <p className="text-xs text-zinc-500">
          You can skip this for now and add it later in Settings. Transcription and note-taking do not require OpenAI.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            id="setup-openai-key"
            data-testid="setup-input-openai"
            value={openaiApiKey}
            onChange={(event) => {
              setOpenaiApiKey(event.target.value);
              setOpenaiValidation(null);
            }}
            placeholder="sk-..."
            autoComplete="off"
            className="min-w-[280px] flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            data-testid="setup-validate-openai-button"
            type="button"
            onClick={() => void validateKey('openai')}
            disabled={openaiApiKey.trim().length === 0 || isValidatingOpenAI}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isValidatingOpenAI ? 'Validating...' : 'Validate'}
          </button>
        </div>

        {openaiValidation?.valid === true ? (
          <p data-testid="setup-validation-openai" className="text-sm text-emerald-700">
            Key is valid.
          </p>
        ) : null}

        {openaiValidation?.valid === false ? (
          <p data-testid="setup-validation-openai" className="text-sm text-rose-700">
            {openaiValidation.error ?? 'Unable to validate key.'}
          </p>
        ) : null}
      </div>

      <label className="mt-4 flex items-start gap-2 text-sm text-zinc-700">
        <input
          data-testid="setup-disclosure-ack"
          type="checkbox"
          checked={hasAcknowledged}
          onChange={(event) => setHasAcknowledged(event.target.checked)}
          className="mt-0.5"
        />
        <span>I understand the provider data flow and want to continue in cloud-assisted mode.</span>
      </label>

      <button
        data-testid="setup-continue-button"
        type="button"
        onClick={() => void finishSetup()}
        disabled={!canContinue}
        className="mt-4 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isSaving ? 'Saving...' : 'Finish Setup'}
      </button>
    </section>
  );
}
