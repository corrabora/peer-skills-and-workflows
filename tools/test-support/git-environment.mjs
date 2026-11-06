// The caller's environment without any Git variable. A Git hook, `git rebase
// --exec` or a linked worktree can export GIT_DIR, GIT_INDEX_FILE and similar,
// which would point fixture repositories' Git commands at the caller's
// repository and index.
export const WITHOUT_GIT = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));

/** Remove Git variables from this process, for tests that call Git-using libraries in process. */
export function dropGitEnvironment() {
  for (const name of Object.keys(process.env)) if (name.startsWith('GIT_')) delete process.env[name];
}
