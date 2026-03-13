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
  it('creates the M3 tables on an empty database', () => {
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
      expect.arrayContaining(['meetings', 'notes', 'sqlite_sequence', 'transcript_segments'])
    );
    expect(db.pragma('user_version', { simple: true })).toBe(1);

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
});
