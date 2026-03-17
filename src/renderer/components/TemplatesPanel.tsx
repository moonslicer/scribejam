import { useEffect, useMemo, useRef, useState } from 'react';
import type { CustomTemplateSettings, Settings, SettingsSaveRequest } from '../../shared/ipc';
import { MAX_TEMPLATE_INSTRUCTIONS_LENGTH } from '../../shared/ipc';
import {
  BUILT_IN_TEMPLATES,
  getCustomTemplateDefinition,
  isBuiltInTemplateId
} from '../../shared/templates';

interface TemplatesPanelProps {
  settings: Settings | null;
  onSave: (payload: SettingsSaveRequest) => Promise<void>;
}

const BUILT_IN_DESCRIPTIONS: Record<string, string> = {
  auto: 'No instructions — the AI decides the best structure based on the transcript.',
  'one-on-one':
    'Structures output for manager/direct-report 1:1s with blockers, growth, and attributed action items.',
  standup:
    'One heading block per person with what they completed, are working on, and any blockers.',
  'tech-review':
    'Captures the design under review, objections, trade-offs, open questions, and decisions reached.'
};

function generateId(): string {
  return 'cust_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** A template entry that has been started but is not yet fully valid. */
function isPartialTemplate(t: CustomTemplateSettings): boolean {
  return (
    (t.name.trim().length > 0 || t.instructions.trim().length > 0) &&
    getCustomTemplateDefinition(t) === undefined
  );
}

export function TemplatesPanel({ settings, onSave }: TemplatesPanelProps): JSX.Element {
  const [templates, setTemplates] = useState<CustomTemplateSettings[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string>('auto');
  const [saving, setSaving] = useState(false);
  const [savedConfirm, setSavedConfirm] = useState(false);
  const saveConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveConfirmTimerRef.current) clearTimeout(saveConfirmTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (settings) {
      setTemplates(settings.customTemplates ?? []);
      setDefaultTemplateId(settings.defaultTemplateId ?? 'auto');
    }
  }, [settings]);

  const updateField = (
    id: string,
    field: keyof Pick<CustomTemplateSettings, 'name' | 'instructions'>,
    value: string
  ): void => {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  };

  const addTemplate = (): void => {
    const newId = generateId();
    setTemplates((prev) => [...prev, { id: newId, name: '', instructions: '' }]);
    setExpandedId(newId);
  };

  const deleteTemplate = (id: string): void => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (expandedId === id) setExpandedId(null);
    if (defaultTemplateId === id) setDefaultTemplateId('auto');
  };

  const validCustomTemplates = useMemo(
    () => templates.filter((t) => getCustomTemplateDefinition(t) !== undefined),
    [templates]
  );

  const hasAnyInvalid = useMemo(() => templates.some(isPartialTemplate), [templates]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    setSavedConfirm(false);
    try {
      const resolvedDefault =
        validCustomTemplates.some((t) => t.id === defaultTemplateId) ||
        isBuiltInTemplateId(defaultTemplateId)
          ? defaultTemplateId
          : 'auto';
      await onSave({ customTemplates: validCustomTemplates, defaultTemplateId: resolvedDefault });
      if (saveConfirmTimerRef.current) clearTimeout(saveConfirmTimerRef.current);
      setSavedConfirm(true);
      saveConfirmTimerRef.current = setTimeout(() => setSavedConfirm(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="templates-panel" className="flex flex-col gap-6">
      {/* Built-in templates */}
      <div>
        <h3 className="mb-1 text-sm font-semibold text-zinc-800">Built-in templates</h3>
        <p className="mb-3 text-xs text-zinc-500">Read-only. Select one as your default below.</p>
        <div className="grid gap-2">
          {BUILT_IN_TEMPLATES.map((template) => (
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

      {/* Custom templates */}
      <div className="border-t border-zinc-100 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-800">Custom templates</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Natural-language instructions that shape enhancement for your recurring meeting
              types.
            </p>
          </div>
          <button
            type="button"
            onClick={addTemplate}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <PlusIcon />
            Add template
          </button>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 py-8 text-center">
            <p className="text-sm text-zinc-400">No custom templates yet.</p>
            <button
              type="button"
              onClick={addTemplate}
              className="mt-2 text-xs font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-800"
            >
              Add your first template
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {templates.map((template) => {
              const isExpanded = expandedId === template.id;
              const isValid = getCustomTemplateDefinition(template) !== undefined;
              const hasPartial = isPartialTemplate(template);
              const trimmedInstructions = template.instructions.trim();
              const isTooLong = trimmedInstructions.length > MAX_TEMPLATE_INSTRUCTIONS_LENGTH;

              return (
                <div
                  key={template.id}
                  className={[
                    'rounded-lg border',
                    hasPartial ? 'border-rose-300 bg-rose-50/40' : 'border-zinc-200 bg-white'
                  ].join(' ')}
                >
                  {/* Card header */}
                  <div className="flex items-center gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      {isValid ? (
                        <>
                          <div className="truncate text-sm font-medium text-zinc-800">
                            {template.name}
                          </div>
                          <div className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
                            {trimmedInstructions.slice(0, 100)}
                            {trimmedInstructions.length > 100 ? '…' : ''}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm font-medium text-rose-600">
                          {template.name.trim().length === 0 &&
                          template.instructions.trim().length === 0
                            ? 'New template'
                            : 'Incomplete — needs name and instructions'}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : template.id)}
                      className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                    >
                      {isExpanded ? 'Done' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(template.id)}
                      className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-rose-600"
                      aria-label="Delete template"
                    >
                      <TrashIcon />
                    </button>
                  </div>

                  {/* Inline editor */}
                  {isExpanded ? (
                    <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
                      <div className="grid gap-3">
                        <div className="grid gap-1">
                          <label
                            className="text-xs font-medium text-zinc-600"
                            htmlFor={`tpl-name-${template.id}`}
                          >
                            Name
                          </label>
                          <input
                            id={`tpl-name-${template.id}`}
                            value={template.name}
                            onChange={(e) => updateField(template.id, 'name', e.target.value)}
                            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                            placeholder="e.g. Customer Interview"
                            autoFocus
                          />
                        </div>
                        <div className="grid gap-1">
                          <label
                            className="text-xs font-medium text-zinc-600"
                            htmlFor={`tpl-inst-${template.id}`}
                          >
                            Instructions
                          </label>
                          <textarea
                            id={`tpl-inst-${template.id}`}
                            value={template.instructions}
                            onChange={(e) =>
                              updateField(template.id, 'instructions', e.target.value)
                            }
                            className="min-h-44 rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm leading-relaxed focus:border-zinc-500 focus:outline-none"
                            placeholder="Describe what matters in this meeting type, how blocks should be structured, and when action items or decisions should stay empty."
                          />
                          <div className="flex items-center justify-between text-xs">
                            <span className={isTooLong ? 'text-rose-600' : 'text-zinc-400'}>
                              {trimmedInstructions.length}/{MAX_TEMPLATE_INSTRUCTIONS_LENGTH}
                            </span>
                            {isTooLong ? (
                              <span className="text-rose-600">
                                Keep instructions under {MAX_TEMPLATE_INSTRUCTIONS_LENGTH}{' '}
                                characters.
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
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
            onChange={(e) => setDefaultTemplateId(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          >
            <optgroup label="Built-in">
              {BUILT_IN_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
            {validCustomTemplates.length > 0 ? (
              <optgroup label="Custom">
                {validCustomTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
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
            disabled={settings === null || saving || hasAnyInvalid}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {saving ? 'Saving…' : 'Save Templates'}
          </button>
          {savedConfirm ? (
            <span className="text-xs font-medium text-emerald-600">Saved.</span>
          ) : null}
          {hasAnyInvalid ? (
            <span className="text-xs text-rose-600">
              Finish or remove incomplete templates first.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4H5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
