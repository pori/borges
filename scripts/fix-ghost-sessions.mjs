#!/usr/bin/env node
// One-time migration: remove ghost sessions created by clicking into a document
// without typing. These have activeMs === 0 (no keystrokes recorded).

import { readFileSync, writeFileSync, copyFileSync } from 'fs'

const TELEMETRY = `${process.env.HOME}/Library/Application Support/Borges/.borges/telemetry.json`
const BACKUP    = TELEMETRY + '.ghost-bak'

const sessions = JSON.parse(readFileSync(TELEMETRY, 'utf-8'))

const ghosts  = sessions.filter(s => s.activeMs === 0)
const cleaned = sessions.filter(s => s.activeMs > 0)

if (ghosts.length === 0) {
  console.log('No ghost sessions found.')
  process.exit(0)
}

for (const s of ghosts) {
  console.log(`Removing ghost session ${s.id} (${s.storyId}) date=${s.date} words ${s.wordsStart}→${s.wordsEnd}`)
}

copyFileSync(TELEMETRY, BACKUP)
console.log(`\nBacked up to ${BACKUP}`)
writeFileSync(TELEMETRY, JSON.stringify(cleaned, null, 2), 'utf-8')
console.log(`Done. Removed ${ghosts.length} ghost session(s) → ${cleaned.length} total (was ${sessions.length}).`)
