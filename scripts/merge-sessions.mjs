#!/usr/bin/env node
// One-time migration: merge consecutive same-story sessions that were split by
// the blur-flush bug (every tab-out ended the session prematurely).
// Sessions of the same story on the same date with a gap < GAP_MS are merged.

import { readFileSync, writeFileSync, copyFileSync } from 'fs'

const GAP_MS     = 10 * 60 * 1000  // 10-minute gap = new session
const TELEMETRY  = `${process.env.HOME}/Library/Application Support/Borges/.borges/telemetry.json`
const BACKUP     = TELEMETRY + '.merge-bak'

const sessions = JSON.parse(readFileSync(TELEMETRY, 'utf-8'))

// Sort chronologically so we can walk them in order
const sorted = [...sessions].sort((a, b) => a.startedAt - b.startedAt)

const merged = []
let mergeCount = 0

for (const s of sorted) {
  const prev = merged[merged.length - 1]

  const sameStory = prev && prev.storyId === s.storyId
  const sameDate  = prev && prev.date === s.date
  const gapMs     = prev ? s.startedAt - prev.endedAt : Infinity

  if (sameStory && sameDate && gapMs < GAP_MS) {
    // Merge s into prev
    const combinedActiveMs = prev.activeMs + s.activeMs
    const typedWords       = s.wordsEnd - prev.wordsStart
    const wpm              = combinedActiveMs > 0
      ? Math.round(Math.max(0, typedWords) / (combinedActiveMs / 60_000))
      : 0

    console.log(
      `Merging ${s.id} into ${prev.id} (${prev.storyId}) ` +
      `gap=${(gapMs / 60000).toFixed(1)}m  words ${prev.wordsStart}→${s.wordsEnd}  wpm ${prev.wpm}→${wpm}`
    )

    prev.endedAt   = s.endedAt
    prev.wordsEnd  = s.wordsEnd
    prev.activeMs  = combinedActiveMs
    prev.wpm       = wpm
    mergeCount++
  } else {
    merged.push({ ...s })
  }
}

if (mergeCount === 0) {
  console.log('No sessions to merge.')
  process.exit(0)
}

copyFileSync(TELEMETRY, BACKUP)
console.log(`\nBacked up to ${BACKUP}`)
writeFileSync(TELEMETRY, JSON.stringify(merged, null, 2), 'utf-8')
console.log(`Done. Merged ${mergeCount} session(s) → ${merged.length} total (was ${sessions.length}).`)
