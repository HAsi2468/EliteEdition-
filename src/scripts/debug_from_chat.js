#!/usr/bin/env node
/**
 * 🛠️ Debug From Chat Helper Script
 * Automatically checks the target group (Testing BOT / Defect Reporting)
 * Compares against chat_debug_tracker.json so already investigated/solved bugs are NEVER repeated.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config/config');

const TRACKER_PATH = fs.existsSync(path.resolve(__dirname, '../../../chat_debug_tracker.json'))
  ? path.resolve(__dirname, '../../../chat_debug_tracker.json')
  : path.resolve(__dirname, '../../chat_debug_tracker.json');

function loadTracker() {
  try {
    if (fs.existsSync(TRACKER_PATH)) {
      return JSON.parse(fs.readFileSync(TRACKER_PATH, 'utf8'));
    }
  } catch (err) {
    console.warn('Warning: Could not read tracker:', err.message);
  }
  return {
    targetRoom: { roomId: '6ad7368c94f929759ae7b42a', name: 'Testing BOT' },
    lastCheckedTimestamp: null,
    resolvedBugs: [],
    knownOpenBugs: []
  };
}

function saveTracker(tracker) {
  try {
    fs.writeFileSync(TRACKER_PATH, JSON.stringify(tracker, null, 2), 'utf8');
    console.log(`✅ Updated persistent tracker at: ${TRACKER_PATH}`);
  } catch (err) {
    console.error('Failed to save tracker:', err.message);
  }
}

async function run() {
  const tracker = loadTracker();
  const roomId = tracker.targetRoom?.roomId || '6ad7368c94f929759ae7b42a';

  console.log(`🔍 Checking chat group: "${tracker.targetRoom?.name || 'Testing BOT'}" (${roomId})...`);

  await mongoose.connect(config.mongoose.url, config.mongoose.options);
  const db = mongoose.connection.db;

  const resolvedMsgIds = new Set(tracker.resolvedBugs.map(b => String(b.sourceMsgId)));
  const resolvedBugSummaries = tracker.resolvedBugs.map(b => b.summary.toLowerCase());

  // Fetch the latest 30 messages in the group
  const messages = await db.collection('chatmessages')
    .find({ roomId: new mongoose.Types.ObjectId(roomId), isDeleted: { $ne: true } })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray();

  const newDefects = [];

  for (const msg of messages) {
    const msgIdStr = String(msg._id);
    const content = msg.content || '';

    // Check if message is a bug report or QA execution report
    const isDefectReport = /bug|defect|degraded|failed|fail|error|issue|stuck|broken/i.test(content);
    if (!isDefectReport) continue;

    // Check if message ID was already solved
    if (resolvedMsgIds.has(msgIdStr)) {
      continue;
    }

    newDefects.push({
      id: msgIdStr,
      date: msg.createdAt,
      snippet: content.length > 500 ? content.substring(0, 500) + '...' : content,
      fullContent: content
    });
  }

  console.log(`\n======================================================`);
  console.log(`📋 DEBUG FROM CHAT SUMMARY`);
  console.log(`======================================================`);
  console.log(`• Total Resolved Bugs Tracked: ${tracker.resolvedBugs.length}`);
  console.log(`• New Unresolved Bug Reports Found: ${newDefects.length}`);

  if (newDefects.length === 0) {
    console.log(`\n🎉 All bugs reported in this chat group are currently SOLVED! No new bugs detected.`);
  } else {
    console.log(`\n⚠️ The following NEW bugs were found in chat:`);
    newDefects.forEach((d, idx) => {
      console.log(`\n[#${idx + 1}] MSG ID: ${d.id} | Date: ${d.date.toISOString()}`);
      console.log(d.snippet);
    });
  }
  console.log(`======================================================\n`);

  process.exit(0);
}

run().catch(err => {
  console.error('Error running debug_from_chat:', err);
  process.exit(1);
});
