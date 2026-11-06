// Run verification with the same Node executable as the caller, without a shell.
import { spawnSync } from 'node:child_process';

/** Run Node with `args` in `cwd`; `environment` defaults to the caller's. */
export function runNode(args, cwd, environment = process.env) {
  const env = { ...environment };
  // The test suite exercises the real hook in fixture repositories. Node sets
  // this internal marker in test workers; inheriting it can disable a nested
  // --test invocation instead of running the fixture's suite.
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, args, { cwd, env, stdio: 'inherit' });
  if (result.error) console.error(`verify: cannot start Node: ${result.error.message}`);
  else if (result.signal) console.error(`verify: Node terminated by ${result.signal}`);
  return result.status === 0 && !result.error;
}
