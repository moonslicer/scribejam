# Setup Guide

This guide covers the local desktop app, not the M0 harness.

## Before You Start

You need:
- macOS
- Node.js 22+
- npm

Optional but required for real cloud-assisted flows:
- Deepgram API key for live transcription
- OpenAI API key for note enhancement

## Install

From the repo root:

```bash
npm install
```

Rebuild native Electron modules:

```bash
npm run rebuild-native:electron
```

## Run the App

Development mode:

```bash
npm run dev
```

Production-style build:

```bash
npm run build
```

## First-Run Disclosure

The first-run flow must be completed before cloud features are enabled.

In cloud-assisted MVP mode:
- Deepgram receives streamed transcript audio
- OpenAI receives saved note text and transcript text only when you explicitly trigger enhancement
- raw audio is not written to disk
- meeting artifacts persist locally in SQLite

If you do not acknowledge the disclosure, transcription stays paused.

## macOS Permissions

Scribejam may need:
- System Audio Recording permission for system capture
- Microphone permission for mic capture

Expected degraded behavior:
- if system audio capture is unavailable, the app continues in mic-only mode
- if provider credentials are invalid, only the affected feature is blocked
- if the network drops, note-taking continues and cloud features pause or retry

## Provider Keys

Current MVP keys:
- Deepgram
- OpenAI

Keys are stored through Electron secure storage handling. Do not commit keys to the repo or add them to screenshots, logs, or test fixtures.

## Helpful Commands

Typecheck:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

Run startup smoke:

```bash
npm run smoke
```

Run Playwright smoke:

```bash
npm run smoke:playwright
```

## Troubleshooting

If the app starts but transcription does not:
- confirm first-run disclosure is completed
- confirm the Deepgram key is valid
- confirm the network is available

If system audio does not start:
- check macOS System Audio Recording permission
- rebuild native dependencies
- retry in mic-only mode to confirm the rest of the app remains healthy

If enhancement fails:
- confirm the OpenAI key is valid
- retry from the stopped or enhancement-failed state
- continue taking or editing notes; the app should not block note-taking
