#!/usr/bin/env node

import { execSync } from 'child_process';
import axios from 'axios';
import readline from 'readline';

// Step 1: Get staged git diff
let diff;
try {
    diff = execSync('git diff --cached', { encoding: 'utf-8' });

    if (!diff) {
        console.log('No staged changes to commit.');
        process.exit(0);
    }

    console.log('🧠 Generating commit message using Gemini AI...');
} catch (err) {
    console.error('❌ Failed to get git diff:', err.message);
    process.exit(1);
}

// Step 2: Send diff to your backend
let message;
try {
    const res = await axios.post('http://localhost:3000/generate', { diff });
    message = res.data.message;
    console.log('\n✅ Suggested commit message:\n');
    console.log(message);
} catch (err) {
    console.error('❌ Failed to get commit message:', err.message);
    process.exit(1);
}

// Step 3: Ask user to confirm
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('\nDo you want to use this commit message? (y/n): ', async (answer) => {
    rl.close();

    if (answer.toLowerCase() === 'y') {
        try {
            execSync(`git commit -m "${message}"`, { stdio: 'inherit' });

            // Get list of branches
            const branches = execSync('git branch', { encoding: 'utf-8' })
                .split('\n')
                .filter(Boolean)
                .map((b) => b.replace('*', '').trim());

            console.log('\nBranches:');
            branches.forEach((b, i) => console.log(`${i + 1}. ${b}`));

            const rl2 = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl2.question('\nEnter the number of the branch to push to: ', (num) => {
                rl2.close();

                const branch = branches[parseInt(num) - 1];
                if (!branch) {
                    console.log('❌ Invalid selection. Skipping push.');
                    return;
                }

                try {
                    execSync(`git push origin ${branch}`, { stdio: 'inherit' });
                } catch (err) {
                    console.error(`❌ Failed to push to ${branch}:`, err.message);
                }
            });
        } catch (err) {
            console.error('❌ Commit failed:', err.message);
        }
    } else {
        console.log('❌ Commit canceled.');
    }
});