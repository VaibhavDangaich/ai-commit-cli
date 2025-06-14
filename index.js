#!/usr/bin/env node

import { execSync } from 'child_process';
import axios from 'axios';
import readline from 'readline';

// Function to filter out diffs for large binary/asset files
function filterLargeAssetDiffs(fullDiff) {
    const lines = fullDiff.split('\n');
    let filteredDiffLines = [];
    let currentFileIsLargeAsset = false;

    // List of file extensions to exclude from the diff sent to AI
    const largeAssetExtensions = [
        '.svg', '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp',
        '.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv',
        '.mp3', '.wav', '.ogg', '.flac',
        '.zip', '.rar', '.7z', '.tar', '.gz',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    ];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for new file headers in the diff (e.g., 'diff --git a/path/to/file.ext b/path/to/file.ext')
        if (line.startsWith('diff --git')) {
            const filePathMatch = line.match(/a\/([^ ]+) b\/([^ ]+)/);
            if (filePathMatch && filePathMatch[1]) {
                const filePath = filePathMatch[1];
                const fileExtension = '.' + filePath.split('.').pop().toLowerCase();
                if (largeAssetExtensions.includes(fileExtension)) {
                    currentFileIsLargeAsset = true;
                    // Optionally add a placeholder to indicate a large file was skipped
                    filteredDiffLines.push(`[Skipping diff for large asset: ${filePath}]`);
                    continue; // Skip processing lines for this file
                } else {
                    currentFileIsLargeAsset = false;
                }
            }
        }

        if (!currentFileIsLargeAsset) {
            filteredDiffLines.push(line);
        }
    }
    return filteredDiffLines.join('\n').trim();
}


// Step 1: Get staged git diff
let diff;
try {
    // Increase maxBuffer to handle larger diff outputs from git itself,
    // before filtering is applied. Setting to 50MB.
    diff = execSync('git diff --cached', { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

    if (!diff) {
        console.log('No staged changes to commit.');
        process.exit(0);
    }

    // Filter out large asset diffs before sending to the backend/AI
    const filteredDiff = filterLargeAssetDiffs(diff);

    if (!filteredDiff) {
        console.log('No relevant code changes found to generate a commit message (large assets were filtered out).');
        process.exit(0);
    }

    console.log('🧠 Generating commit message using Gemini AI...');

    // Use the filtered diff for the AI call
    diff = filteredDiff;

} catch (err) {
    console.error('❌ Failed to get git diff:', err.message);
    process.exit(1);
}

// Step 2: Send diff to your backend
let message;
try {
    // Ensure this URL is the correct one for your deployed Render backend
    const backendUrl = 'https://ai-commit-backend.onrender.com';
     // Log the URL
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
