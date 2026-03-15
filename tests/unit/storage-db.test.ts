import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createStorageDatabase } from '../../src/main/storage/db';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('storage database bootstrap', () => {
  it('creates the M4 tables on an empty database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-'));
    tempDirs.push(dir);

    const db = createStorageDatabase({ dbPath: join(dir, 'scribejam.sqlite') });

    const tables = db
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name
      `)
      .all() as Array<{ name: string }>;

    expect(tables.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        'enhanced_note_documents',
        'enhanced_outputs',
        'meetings',
        'notes',
        'sqlite_sequence',
        'transcript_segments'
      ])
    );
    const columns = db.prepare('PRAGMA table_info(meetings)').all() as Array<{ name: string }>;

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['archived_at', 'last_template_id', 'last_template_name'])
    );
    expect(db.pragma('user_version', { simple: true })).toBe(5);

    db.close();
  });

  it('preserves existing rows when the database is reopened', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'scribejam.sqlite');

    const firstDb = createStorageDatabase({ dbPath });
    firstDb
      .prepare(
        `
          INSERT INTO meetings (id, title, state, created_at, updated_at, duration_ms)
          VALUES (@id, @title, @state, @createdAt, @updatedAt, @durationMs)
        `
      )
      .run({
        id: 'meeting-1',
        title: 'Weekly sync',
        state: 'stopped',
        createdAt: '2026-03-12T10:00:00.000Z',
        updatedAt: '2026-03-12T10:30:00.000Z',
        durationMs: 1800000
      });
    firstDb.close();

    const secondDb = createStorageDatabase({ dbPath });
    const persisted = secondDb
      .prepare('SELECT id, title, state FROM meetings WHERE id = ?')
      .get('meeting-1') as { id: string; title: string; state: string } | undefined;

    expect(persisted).toEqual({
      id: 'meeting-1',
      title: 'Weekly sync',
      state: 'stopped'
    });

    secondDb.close();
  });

  it('upgrades an M3 database to the current schema without losing existing rows', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scribejam-storage-'));
    tempDirs.push(dir);
    const dbPath = join(dir, 'scribejam.sqlite');

    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE meetings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'idle',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        duration_ms INTEGER
      );

      CREATE TABLE notes (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(meeting_id)
      );

      CREATE TABLE transcript_segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        speaker TEXT NOT NULL,
        text TEXT NOT NULL,
        start_ts REAL NOT NULL,
        end_ts REAL,
        is_final INTEGER NOT NULL DEFAULT 1
      );
    `);
    legacyDb.pragma('user_version = 1');
    legacyDb
      .prepare(
        `
          INSERT INTO meetings (id, title, state, created_at, updated_at, duration_ms)
          VALUES (@id, @title, @state, @createdAt, @updatedAt, @durationMs)
        `
      )
      .run({
        id: 'meeting-legacy',
        title: 'Legacy sync',
        state: 'stopped',
        createdAt: '2026-03-12T10:00:00.000Z',
        updatedAt: '2026-03-12T10:30:00.000Z',
        durationMs: 1800000
      });
    legacyDb.close();

    const upgradedDb = createStorageDatabase({ dbPath });
    const tables = upgradedDb
      .prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name
      `)
      .all() as Array<{ name: string }>;
    const persisted = upgradedDb
      .prepare('SELECT id, title, state FROM meetings WHERE id = ?')
      .get('meeting-legacy') as { id: string; title: string; state: string } | undefined;

    const columns = upgradedDb.prepare('PRAGMA table_info(meetings)').all() as Array<{ name: string }>;

    expect(tables.map((row) => row.name)).toEqual(
      expect.arrayContaining(['enhanced_note_documents', 'enhanced_outputs'])
    );
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['archived_at', 'last_template_id', 'last_template_name'])
    );
    expect(upgradedDb.pragma('user_version', { simple: true })).toBe(5);
    expect(persisted).toEqual({
      id: 'meeting-legacy',
      title: 'Legacy sync',
      state: 'stopped'
    });

    upgradedDb.close();
  });
});
