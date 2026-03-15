import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { TEMPLATE_IDS, type Settings, type SettingsSaveRequest } from '../../shared/ipc';
import { getCustomTemplateDefinition } from '../../shared/templates';
import { SecureSecrets } from './secure-secrets';

interface PersistedSettings {
  firstRunAcknowledged: boolean;
  sttProvider: Settings['sttProvider'];
  llmProvider: Settings['llmProvider'];
  defaultTemplateId: NonNullable<Settings['defaultTemplateId']>;
  customTemplate?: Settings['customTemplate'];
}

const DEFAULT_SETTINGS: PersistedSettings = {
  firstRunAcknowledged: false,
  sttProvider: 'deepgram',
  llmProvider: 'openai',
  defaultTemplateId: 'auto'
};

export class SettingsStore {
  private readonly settingsPath: string;
  private readonly secrets: SecureSecrets;

  public constructor(options?: { baseDir?: string; secrets?: SecureSecrets }) {
    const baseDir = options?.baseDir ?? app.getPath('userData');
    this.settingsPath = join(baseDir, 'settings.json');
    this.secrets = options?.secrets ?? new SecureSecrets(join(baseDir, 'secrets.enc.json'));
  }

  public getSettings(): Settings {
    const persisted = this.readSettings();
    return {
      firstRunAcknowledged: persisted.firstRunAcknowledged,
      sttProvider: persisted.sttProvider,
      llmProvider: persisted.llmProvider,
      defaultTemplateId: persisted.defaultTemplateId,
      ...(persisted.customTemplate ? { customTemplate: persisted.customTemplate } : {}),
      deepgramApiKeySet: this.secrets.has('deepgramApiKey'),
      openaiApiKeySet: this.secrets.has('openaiApiKey'),
      anthropicApiKeySet: this.secrets.has('anthropicApiKey')
    };
  }

  public saveSettings(update: SettingsSaveRequest): void {
    const next = this.readSettings();

    if (update.firstRunAcknowledged !== undefined) {
      next.firstRunAcknowledged = update.firstRunAcknowledged;
    }
    if (update.sttProvider !== undefined) {
      next.sttProvider = update.sttProvider;
    }
    if (update.llmProvider !== undefined) {
      next.llmProvider = update.llmProvider;
    }
    if (update.defaultTemplateId !== undefined) {
      next.defaultTemplateId = update.defaultTemplateId;
    }
    if (update.customTemplate !== undefined) {
      const normalizedTemplate = getCustomTemplateDefinition(update.customTemplate);
      if (normalizedTemplate) {
        next.customTemplate = {
          name: normalizedTemplate.name,
          instructions: normalizedTemplate.instructions
        };
      } else {
        delete next.customTemplate;
      }
    }
    if (update.deepgramApiKey !== undefined) {
      this.secrets.set('deepgramApiKey', update.deepgramApiKey);
    }
    if (update.openaiApiKey !== undefined) {
      this.secrets.set('openaiApiKey', update.openaiApiKey);
    }
    if (update.anthropicApiKey !== undefined) {
      this.secrets.set('anthropicApiKey', update.anthropicApiKey);
    }

    this.writeSettings(next);
  }

  public getSecret(
    name: 'deepgramApiKey' | 'openaiApiKey' | 'anthropicApiKey'
  ): string | undefined {
    return this.secrets.get(name);
  }

  private readSettings(): PersistedSettings {
    if (!existsSync(this.settingsPath)) {
      return { ...DEFAULT_SETTINGS };
    }

    try {
      const raw = readFileSync(this.settingsPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      const defaultTemplateId =
        parsed.defaultTemplateId === undefined ? DEFAULT_SETTINGS.defaultTemplateId : parsed.defaultTemplateId;
      const customTemplate = getCustomTemplateDefinition(parsed.customTemplate);
      if (
        typeof parsed.firstRunAcknowledged !== 'boolean' ||
        parsed.sttProvider !== 'deepgram' ||
        (parsed.llmProvider !== 'openai' && parsed.llmProvider !== 'anthropic') ||
        !TEMPLATE_IDS.includes(defaultTemplateId as (typeof TEMPLATE_IDS)[number])
      ) {
        return { ...DEFAULT_SETTINGS };
      }

      return {
        firstRunAcknowledged: parsed.firstRunAcknowledged,
        sttProvider: parsed.sttProvider,
        llmProvider: parsed.llmProvider,
        defaultTemplateId,
        ...(customTemplate
          ? {
              customTemplate: {
                name: customTemplate.name,
                instructions: customTemplate.instructions
              }
            }
          : {})
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private writeSettings(settings: PersistedSettings): void {
    writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }
}
