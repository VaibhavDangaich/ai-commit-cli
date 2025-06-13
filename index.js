#!/usr/bin/env node

import { execSync } from 'child_process';
import axios from 'axios';
import readline from 'readline';

// Step 1: Get staged git diff
let diff;
try {
    // Increase maxBuffer to handle larger diff outputs (e.g., large SVG files)
    // Default is 1MB. Setting to 50MB to accommodate even larger diffs.
    diff = execSync('git diff --cached', { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }); // Increased to 50MB

    if (!diff) {
        console.log('No staged changes to commit.');
        process.exit(0);
    }

    console.log('🧠 Generating commit message using Gemini AI...');
} catch (err) {
    // Reverted to the original, simpler error message for git diff failures
    console.error('❌ Failed to get git diff:', err.message);
    process.exit(1);
}

// Step 2: Send diff to your backend
let message;
try {
    // Ensure this URL is the correct one for your deployed Render backend
    const backendUrl = 'https://ai-commit-backend.onrender.com';
    console.log(`Attempting to connect to backend at: ${backendUrl}/generate`); // Log the URL
    const res = await axios.post(`${backendUrl}/generate`, { diff });
    message = res.data.message;
    console.log('\n✅ Suggested commit message:\n');
    console.log(message);
} catch (err) {
    console.error('❌ Failed to get commit message!!');
    // Log more details about the Axios error
    if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('  Status:', err.response.status);
        console.error('  Data:', err.response.data);
        console.error('  Headers:', err.response.headers);
    } else if (err.request) {
        // The request was made but no response was received
        // `err.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.error('  No response received. Request details:', err.request);
    } else {
        // Something happened in setting up the request that triggered an Error
        console.error('  Error setting up request:', err.message);
    }
    console.error('  Full error object:', err); // Log the entire error object
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
