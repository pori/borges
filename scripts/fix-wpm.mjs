#!/usr/bin/env node
// One-time migration: zero out WPM for sessions that are clearly paste artifacts.
// A session is flagged when activeMs < 5000 (sub-5-second burst) and the resulting
// WPM exceeds 300 — no human types that fast.

import { readFileSync, writeFileSync, cpSync } from 'fs'

const TELEMETRY = `${process.env.HOME}/Library/Application Support/Borges/.borges/telemetry.json`
const BACKUP    = TELEMETRY + '.bak'

const sessions = JSON.parse(readFileSync(TELEMETRY, 'utf-8'))

let fixed = 0
const patched = sessions.map(s => {
  if (s.wpm > 300 && s.activeMs < 5000) {
    fixed++
    console.log(`Fixing session ${s.id} (${s.storyId}): wpm ${s.wpm} → 0  [activeMs=${s.activeMs}, words ${s.wordsStart}→${s.wordsEnd}]`)
    return { ...s, wpm: 0 }
  }
  return s
})

if (fixed === 0) {
  console.log('No sessions to fix.')
  process.exit(0)
}

cpSync(TELEMETRY, BACKUP)
console.log(`Backed up to ${BACKUP}`)
writeFileSync(TELEMETRY, JSON.stringify(patched, null, 2), 'utf-8')
console.log(`Done. Fixed ${fixed} session(s).`)
