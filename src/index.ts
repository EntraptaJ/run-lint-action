// src/index.ts
import { getInput, setFailed } from '@actions/core';
import { sync } from 'glob';
import { parse } from 'path';
import run from './run';
import * as github from '@actions/github';

const token = getInput('github-token', { required: true });
const octokit = new github.GitHub(token);

interface FailLintArgs {
  pr: number
  result: string
}

async function failLint({ pr, result }: FailLintArgs): Promise<void> {
  const message: string = `\`npm run lint\` has failed\n\`\`\`${result}\`\`\``
  octokit.issues.createComment({
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    issue_number: pr,
    body: message,
  });
  setFailed(message)
}

async function runLint(): Promise<void> {
  const { pull_request: pr } = github.context.payload;
  if (!pr) throw new Error('Event payload missing `pull_request`');

  try {
    const filenames = sync(`${process.env.GITHUB_WORKSPACE}/**/package.json`);

    for (const filename of filenames) {
      await run(`npm install`, { cwd: parse(filename).dir });
      const { code, result } = await run(`npm run lint`);

      console.log({ code, result })
      if (code !== 0) failLint({ pr: pr.number, result })
    }
  } catch (error) {
    setFailed(error.message);
  }
}

runLint();