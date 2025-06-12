#!/usr/bin/env node

import { execSync } from 'child_process';

try {
    const diff = execSync('git diff --cached', { encoding: 'utf-8' });

    if (!diff) {
        console.log('No staged changes to commit.');
        process.exit(0);
    }

    console.log('🧠 Analyzing the following staged diff:\n');
    console.log(diff);

    // We'll call AI API here next
} catch (err) {
    console.error('❌ Failed to get git diff:', err.message);
}