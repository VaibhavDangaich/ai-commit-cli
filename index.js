#!/usr/bin/env node

import { execSync } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error('❌ Missing GEMINI_API_KEY in .env file');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

function ask(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

async function main() {
    let diff;
    try {
        diff = execSync('git diff --cached', { encoding: 'utf-8' });
        if (!diff.trim()) {
            console.log('✅ No staged changes found.');
            return;
        }
    } catch (err) {
        console.error('❌ Failed to get git diff:', err.message);
        return;
    }

    console.log('🧠 Generating commit message using Gemini AI...\n');

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Generate a clear and concise Git commit message based on the following staged diff:\n\n${diff}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const message = response.text().trim();

        console.log(`✅ Suggested commit message:\n\n${message}\n`);

        const confirmCommit = await ask('Do you want to use this message to commit? (y/n): ');

        if (confirmCommit === 'y') {
            const escapedMessage = message.replace(/"/g, '\\"');
            execSync(`git commit -m "${escapedMessage}"`, { stdio: 'inherit' });
            console.log('\n✅ Changes committed successfully.');

            // List all branches
            const branchesOutput = execSync('git branch', { encoding: 'utf-8' });
            const branches = branchesOutput
                .split('\n')
                .filter(b => b.trim())
                .map(b => b.replace('*', '').trim());

            console.log('\n🌿 Available branches:');
            branches.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));

            const branchIndex = await ask('\nEnter the number of the branch you want to push to: ');
            const selectedBranch = branches[parseInt(branchIndex, 10) - 1];

            if (!selectedBranch) {
                console.log('❌ Invalid selection. Push aborted.');
                return;
            }

            execSync(`git push origin ${selectedBranch}`, { stdio: 'inherit' });
            console.log(`\n🚀 Changes pushed to branch: ${selectedBranch}`);
        } else {
            console.log('❌ Commit cancelled.');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

main();