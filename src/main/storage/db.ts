import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { app } from 'electron';

const CURRENT_SCHEMA_VERSION = 3;

export interface StorageDatabaseOptions {
  dbPath?: string;
}

export function createStorageDatabase(options?: StorageDatabaseOptions): Database.Database {
  const dbPath = options?.dbPath ?? join(app.getPath('userData'), 'scribejam.sqlite');
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);

  return db;
}

export function migrate(db: Database.Database): void {
  const currentVersion = db.pragma('user_version', { simple: true }) as number;
  if (currentVersion >= CURRENT_SCHEMA_VERSION) {
    return;
  }

  const tx = db.transaction(() => {
    if (currentVersion < 1) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS meetings (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'idle',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          duration_ms INTEGER
        );

        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(meeting_id)
        );

        CREATE TABLE IF NOT EXISTS transcript_segments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          speaker TEXT NOT NULL,
          text TEXT NOT NULL,
          start_ts REAL NOT NULL,
          end_ts REAL,
          is_final INTEGER NOT NULL DEFAULT 1
        );

        CREATE INDEX IF NOT EXISTS idx_notes_meeting_id
          ON notes (meeting_id);

        CREATE INDEX IF NOT EXISTS idx_transcript_segments_meeting_id
          ON transcript_segments (meeting_id, id);
      `);
    }

    if (currentVersion < 2) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS enhanced_outputs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_enhanced_outputs_meeting_id
          ON enhanced_outputs (meeting_id, id DESC);
      `);
    }

    if (currentVersion < 3) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS enhanced_note_documents (
          id TEXT PRIMARY KEY,
          meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(meeting_id)
        );

        CREATE INDEX IF NOT EXISTS idx_enhanced_note_documents_meeting_id
          ON enhanced_note_documents (meeting_id);
      `);
    }

    db.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);
  });

  tx();
}
