#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('Testing Gemini EDA CLI...\n');

const child = spawn('node', ['dist/bin/gemini-eda-v0_1.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Send commands
setTimeout(() => {
  child.stdin.write('/help\n');
}, 100);

setTimeout(() => {
  child.stdin.write('/eda:help\n');
}, 200);

setTimeout(() => {
  child.stdin.write('/exit\n');
}, 300);

child.stdout.on('data', (data) => {
  console.log(data.toString());
});

child.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

child.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
});
