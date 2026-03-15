import { useEffect, useMemo, useState } from 'react';
import type { CustomTemplateSettings, Settings, SettingsSaveRequest } from '../../shared/ipc';
import { MAX_TEMPLATE_INSTRUCTIONS_LENGTH } from '../../shared/ipc';
import { BUILT_IN_TEMPLATES, getCustomTemplateDefinition } from '../../shared/templates';

interface TemplatesPanelProps {
  settings: Settings | null;
  onSave: (payload: SettingsSaveRequest) => Promise<void>;
}

const BUILT_IN_DESCRIPTIONS: Record<string, string> = {
  auto: 'No instructions — the AI decides the best structure based on the transcript.',
  'one-on-one': 'Structures output for manager/direct-report 1:1s with blockers, growth, and attributed action items.',
  standup: 'One heading block per person with what they completed, are working on, and any blockers.',
  'tech-review': 'Captures the design under review, objections, trade-offs, open questions, and decisions reached.'
};

export function TemplatesPanel({ settings, onSave }: TemplatesPanelProps): JSX.Element {
  const [defaultTemplateId, setDefaultTemplateId] = useState<NonNullable<Settings['defaultTemplateId']>>('auto');
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [customTemplateInstructions, setCustomTemplateInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedConfirm, setSavedConfirm] = useState(false);

  const hasLoaded = useMemo(() => settings !== null, [settings]);

  useEffect(() => {
    if (settings) {
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
  const isCustomTemplateTooLong = customTemplateInstructions.length > MAX_TEMPLATE_INSTRUCTIONS_LENGTH;
  const charCount = customTemplateInstructions.length;
  const charLimit = MAX_TEMPLATE_INSTRUCTIONS_LENGTH;

  useEffect(() => {
    if (!normalizedCustomTemplate && defaultTemplateId === 'custom') {
      setDefaultTemplateId('auto');
    }
  }, [defaultTemplateId, normalizedCustomTemplate]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setSavedConfirm(false);
    try {
      const payload: SettingsSaveRequest = {
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
      await onSave(payload);
      setSavedConfirm(true);
      setTimeout(() => setSavedConfirm(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const builtInTemplates = BUILT_IN_TEMPLATES.filter((t) => t.id !== 'custom');

  return (
    <div data-testid="templates-panel" className="flex flex-col gap-6">
      {/* Built-in templates */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-800">Built-in templates</h3>
        <p className="mb-3 text-xs text-zinc-500">
          These are read-only. Select one as your default below.
        </p>
        <div className="grid gap-2">
          {builtInTemplates.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3"
            >
              <div className="text-sm font-medium text-zinc-800">{template.name}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {BUILT_IN_DESCRIPTIONS[template.id] ?? ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom template editor */}
      <div className="border-t border-zinc-100 pt-6">
        <h3 className="mb-1 text-sm font-semibold text-zinc-800">Custom template</h3>
        <p className="mb-3 text-xs text-zinc-500">
          Natural-language instructions that shape enhancement for your recurring meeting type.
        </p>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-600" htmlFor="templates-custom-name">
              Template name
            </label>
            <input
              id="templates-custom-name"
              data-testid="settings-input-custom-template-name"
              value={customTemplateName}
              onChange={(event) => setCustomTemplateName(event.target.value)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              placeholder="e.g. Customer interview"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-zinc-600" htmlFor="templates-custom-instructions">
              Instructions
            </label>
            <textarea
              id="templates-custom-instructions"
              data-testid="settings-input-custom-template-instructions"
              value={customTemplateInstructions}
              onChange={(event) => setCustomTemplateInstructions(event.target.value)}
              className="min-h-52 rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm leading-relaxed focus:border-zinc-500 focus:outline-none"
              placeholder="Describe what matters in this meeting type, how blocks should be structured, and when action items or decisions should stay empty."
            />
            <div className="flex items-center justify-between text-xs">
              <span
                data-testid="settings-custom-template-char-count"
                className={isCustomTemplateTooLong ? 'text-rose-600' : 'text-zinc-400'}
              >
                {charCount}/{charLimit}
              </span>
              {isCustomTemplateTooLong ? (
                <span data-testid="settings-custom-template-validation" className="text-rose-600">
                  Keep instructions at or under {charLimit} characters.
                </span>
              ) : hasPartialCustomTemplate ? (
                <span data-testid="settings-custom-template-validation" className="text-rose-600">
                  Add both a name and instructions to save a custom template.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Default template */}
      <div className="border-t border-zinc-100 pt-4">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-zinc-600" htmlFor="templates-default">
            Default enhancement template
          </label>
          <select
            id="templates-default"
            data-testid="settings-input-default-template"
            value={defaultTemplateId}
            onChange={(event) =>
              setDefaultTemplateId(event.target.value as NonNullable<Settings['defaultTemplateId']>)
            }
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            {builtInTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
            {normalizedCustomTemplate ? (
              <option value="custom">Custom: {normalizedCustomTemplate.name}</option>
            ) : null}
          </select>
          <p className="text-xs text-zinc-400">
            Applied automatically when you generate notes for a new meeting.
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="border-t border-zinc-100 pt-4">
        <div className="flex items-center gap-3">
          <button
            data-testid="templates-save-button"
            type="button"
            onClick={() => void handleSave()}
            disabled={!hasLoaded || saving || hasPartialCustomTemplate || isCustomTemplateTooLong}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {saving ? 'Saving…' : 'Save Templates'}
          </button>
          {savedConfirm ? (
            <span className="text-xs font-medium text-emerald-600">Saved.</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
