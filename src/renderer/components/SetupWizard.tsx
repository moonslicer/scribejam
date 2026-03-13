import { useMemo, useState } from 'react';

interface SetupWizardProps {
  onValidateKey: (key: string) => Promise<{ valid: boolean; error?: string }>;
  onComplete: (payload: { deepgramApiKey: string }) => Promise<void>;
}

export function SetupWizard({ onValidateKey, onComplete }: SetupWizardProps): JSX.Element {
  const [deepgramApiKey, setDeepgramApiKey] = useState('');
  const [hasAcknowledged, setHasAcknowledged] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);

  const canContinue = useMemo(() => {
    return validationResult?.valid === true && hasAcknowledged && !isSaving;
  }, [hasAcknowledged, isSaving, validationResult]);

  const validateKey = async (): Promise<void> => {
    setIsValidating(true);
    try {
      const result = await onValidateKey(deepgramApiKey);
      setValidationResult(result);
    } finally {
      setIsValidating(false);
    }
  };

  const finishSetup = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await onComplete({ deepgramApiKey });
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
        Scribejam sends mixed meeting audio to Deepgram for transcription in cloud-assisted mode.
      </p>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700">
        <li>Audio capture runs locally in this app.</li>
        <li>Raw audio is processed in-memory and not written to disk by Scribejam.</li>
        <li>Transcript text is returned from Deepgram and shown in the Transcript panel.</li>
      </ul>

      <div className="mt-4 flex flex-col gap-2">
        <label className="text-sm font-medium text-zinc-700" htmlFor="setup-deepgram-key">
          Deepgram API key
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="setup-deepgram-key"
            data-testid="setup-input-deepgram"
            value={deepgramApiKey}
            onChange={(event) => {
              setDeepgramApiKey(event.target.value);
              setValidationResult(null);
            }}
            placeholder="dg_..."
            autoComplete="off"
            className="min-w-[280px] flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            data-testid="setup-validate-button"
            type="button"
            onClick={() => void validateKey()}
            disabled={deepgramApiKey.trim().length === 0 || isValidating}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isValidating ? 'Validating...' : 'Validate'}
          </button>
        </div>

        {validationResult?.valid === true ? (
          <p data-testid="setup-validation-result" className="text-sm text-emerald-700">
            Key is valid.
          </p>
        ) : null}

        {validationResult?.valid === false ? (
          <p data-testid="setup-validation-result" className="text-sm text-rose-700">
            {validationResult.error ?? 'Unable to validate key.'}
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
