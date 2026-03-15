import type { Settings, SettingsSaveRequest } from '../../shared/ipc';
import { ProvidersPanel } from './ProvidersPanel';
import { TemplatesPanel } from './TemplatesPanel';

export type SettingsSection = 'templates' | 'providers';

const NAV_ITEMS: { id: SettingsSection; label: string; icon: () => JSX.Element }[] = [
  { id: 'templates', label: 'Templates', icon: TemplatesIcon },
  { id: 'providers', label: 'Providers', icon: ProvidersIcon }
];

interface SettingsShellProps {
  settings: Settings | null;
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  onSave: (payload: SettingsSaveRequest) => Promise<void>;
  onValidateKey: (
    provider: 'deepgram' | 'openai' | 'anthropic',
    key: string
  ) => Promise<{ valid: boolean; error?: string }>;
}

export function SettingsShell({
  settings,
  activeSection,
  onSectionChange,
  onSave,
  onValidateKey
}: SettingsShellProps): JSX.Element {
  return (
    <section
      data-testid="settings-page"
      className="flex w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#2d2926] shadow-[0_28px_80px_rgba(0,0,0,0.3)]"
      style={{ minHeight: '520px' }}
    >
      {/* Left sidebar nav */}
      <nav className="flex w-48 shrink-0 flex-col border-r border-white/8 px-3 py-6">
        <div className="mb-6 px-2">
          <h1 className="text-xl font-semibold text-[#f4efe6]">Settings</h1>
        </div>
        <ul className="flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeSection === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onSectionChange(id)}
                  className={[
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors',
                    active
                      ? 'bg-white/10 text-[#f4efe6]'
                      : 'text-[#8c847d] hover:bg-white/6 hover:text-[#c8bfb5]'
                  ].join(' ')}
                >
                  <Icon />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Content area */}
      <div className="flex flex-1 flex-col overflow-auto">
        <div className="flex flex-1 flex-col rounded-r-[2rem] bg-[#faf8f5] p-8">
          <SectionHeading section={activeSection} />
          <div className="mt-5">
            {activeSection === 'templates' ? (
              <TemplatesPanel settings={settings} onSave={onSave} />
            ) : (
              <ProvidersPanel settings={settings} onSave={onSave} onValidateKey={onValidateKey} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHeading({ section }: { section: SettingsSection }): JSX.Element {
  if (section === 'templates') {
    return (
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Templates</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          Built-in templates and your custom template for meeting enhancement.
        </p>
      </div>
    );
  }
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900">Providers</h2>
      <p className="mt-0.5 text-sm text-zinc-500">
        API keys and LLM provider selection. Keys are encrypted on this device.
      </p>
    </div>
  );
}

function TemplatesIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9 11.5h5M11.5 9v5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ProvidersIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2a6 6 0 100 12A6 6 0 008 2z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M6 8a2 2 0 104 0 2 2 0 00-4 0z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
