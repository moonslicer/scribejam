import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import {
  MAX_TEMPLATE_INSTRUCTIONS_LENGTH,
  type CustomTemplateSettings,
  type Settings,
  type SettingsSaveRequest,
  type TemplateId
} from '../../shared/ipc';
import { isBuiltInTemplateId } from '../../shared/templates';
import { SecureSecrets } from './secure-secrets';

interface PersistedSettings {
  firstRunAcknowledged: boolean;
  sttProvider: Settings['sttProvider'];
  llmProvider: Settings['llmProvider'];
  defaultTemplateId: TemplateId;
  customTemplates?: CustomTemplateSettings[];
}

/** Shape of the old on-disk format before multi-template support. */
interface LegacyPersistedSettings extends PersistedSettings {
  customTemplate?: { name: string; instructions: string };
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
      ...(persisted.customTemplates && persisted.customTemplates.length > 0
        ? { customTemplates: persisted.customTemplates }
        : {}),
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
    if (update.customTemplates !== undefined) {
      const valid = update.customTemplates.filter(
        (t) =>
          typeof t.id === 'string' &&
          t.id.length > 0 &&
          t.name.trim().length > 0 &&
          t.instructions.trim().length > 0 &&
          t.instructions.trim().length <= MAX_TEMPLATE_INSTRUCTIONS_LENGTH
      );
      if (valid.length > 0) {
        next.customTemplates = valid;
      } else {
        delete next.customTemplates;
      }

      // If the default points to a template that was just removed, fall back.
      if (!isBuiltInTemplateId(next.defaultTemplateId) && !valid.some((t) => t.id === next.defaultTemplateId)) {
        next.defaultTemplateId = 'auto';
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
      const parsed = JSON.parse(raw) as Partial<LegacyPersistedSettings>;

      if (
        typeof parsed.firstRunAcknowledged !== 'boolean' ||
        parsed.sttProvider !== 'deepgram' ||
        (parsed.llmProvider !== 'openai' && parsed.llmProvider !== 'anthropic')
      ) {
        return { ...DEFAULT_SETTINGS };
      }

      // ── Migrate custom templates ──────────────────────────────────────────
      let customTemplates: CustomTemplateSettings[] | undefined;
      let defaultTemplateId: TemplateId =
        parsed.defaultTemplateId ?? DEFAULT_SETTINGS.defaultTemplateId;

      if (Array.isArray(parsed.customTemplates) && parsed.customTemplates.length > 0) {
        // New format — validate each entry
        customTemplates = parsed.customTemplates.filter(
          (t) =>
            t &&
            typeof t === 'object' &&
            typeof t.id === 'string' &&
            t.id.length > 0 &&
            typeof t.name === 'string' &&
            t.name.trim().length > 0 &&
            typeof t.instructions === 'string' &&
            t.instructions.trim().length > 0 &&
            t.instructions.trim().length <= MAX_TEMPLATE_INSTRUCTIONS_LENGTH
        );
      } else if (
        parsed.customTemplate &&
        typeof parsed.customTemplate === 'object' &&
        typeof parsed.customTemplate.name === 'string' &&
        typeof parsed.customTemplate.instructions === 'string' &&
        parsed.customTemplate.name.trim().length > 0 &&
        parsed.customTemplate.instructions.trim().length > 0
      ) {
        // Legacy single-template format — migrate to array and write back immediately
        // so subsequent reads use the new format and the ID stays stable.
        const migratedId = 'cust_' + Date.now().toString(36);
        customTemplates = [
          {
            id: migratedId,
            name: parsed.customTemplate.name.trim(),
            instructions: parsed.customTemplate.instructions.trim()
          }
        ];
        if (defaultTemplateId === 'custom') {
          defaultTemplateId = migratedId;
        }
        this.writeSettings({
          firstRunAcknowledged: parsed.firstRunAcknowledged,
          sttProvider: parsed.sttProvider,
          llmProvider: parsed.llmProvider,
          defaultTemplateId,
          customTemplates
        });
      }

      // ── Validate defaultTemplateId ────────────────────────────────────────
      if (!isBuiltInTemplateId(defaultTemplateId) && !customTemplates?.some((t) => t.id === defaultTemplateId)) {
        defaultTemplateId = DEFAULT_SETTINGS.defaultTemplateId;
      }

      return {
        firstRunAcknowledged: parsed.firstRunAcknowledged,
        sttProvider: parsed.sttProvider,
        llmProvider: parsed.llmProvider,
        defaultTemplateId,
        ...(customTemplates && customTemplates.length > 0 ? { customTemplates } : {})
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private writeSettings(settings: PersistedSettings): void {
    writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  }
}
