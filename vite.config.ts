import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

type CommitInfo = {
  hash: string;
  shortHash: string;
  message: string;
  url: string;
};

const repositoryUrl = 'https://github.com/n6v26r/roaihof';

export default defineConfig(async () => {
  const commit = await resolveCommitInfo();

  return {
    plugins: [react()],
    define: {
      __ROAIHOF_COMMIT__: JSON.stringify(commit)
    },
    build: {
      sourcemap: true,
      assetsInlineLimit: 4096
    }
  };
});

async function resolveCommitInfo(): Promise<CommitInfo> {
  const env = ((globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {});
  const hash = env.VERCEL_GIT_COMMIT_SHA || await git('rev-parse HEAD');
  const message = env.VERCEL_GIT_COMMIT_MESSAGE || await git('log -1 --pretty=%s');

  return {
    hash,
    shortHash: hash.slice(0, 7),
    message,
    url: hash ? `${repositoryUrl}/commit/${hash}` : repositoryUrl
  };
}

async function git(command: string): Promise<string> {
  try {
    const nodeModule = 'node:child_process';
    const { execSync } = await import(nodeModule) as {
      execSync: (command: string, options: { encoding: 'utf8' }) => string;
    };

    return execSync(`git ${command}`, { encoding: 'utf8' }).trim();
  } catch (error) {
    const stdout = (error as { stdout?: unknown }).stdout;
    if (typeof stdout === 'string') return stdout.trim();

    return '';
  }
}
