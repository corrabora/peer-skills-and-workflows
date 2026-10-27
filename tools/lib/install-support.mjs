// User-level support hooks travel with the workflow install set. Receipts own
// only the exact entries added by this installer, never pre-existing matches.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { hookConfig } from './successor.mjs';
import { isOwnedLink } from './install.mjs';
import { supportHookScopes } from './paths.mjs';

const RECEIPT = '.agent-workflow-successor-hooks.json';
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const encode = (v) => `${JSON.stringify(v, null, 2)}\n`;
const selected = (sets) => sets === undefined || sets.includes('workflow');

function read(file) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch (error) { if (error.code === 'ENOENT') return { file, bytes: null, value: {} }; throw error; }
  if (!stat.isFile()) throw new Error(`${file}: expected a regular file; links and other entries are left alone`);
  const bytes = fs.readFileSync(file, 'utf8');
  const value = JSON.parse(bytes);
  if (!object(value)) throw new Error(`${file}: expected a JSON object`);
  return { file, bytes, value, mode: stat.mode & 0o777, dev: stat.dev, ino: stat.ino };
}

function unchanged(snapshot) {
  const current = read(snapshot.file);
  if (current.bytes !== snapshot.bytes || current.dev !== snapshot.dev || current.ino !== snapshot.ino) {
    throw new Error(`${snapshot.file}: changed during installation; preserved, rerun after reconciling the edit`);
  }
}

// Atomic publication, plus a before-state check for outside settings writers.
// The adjacent lock serializes installers, not editors that ignore that lock.
function write(snapshot, value) {
  if (isDeepStrictEqual(snapshot.value, value) && snapshot.bytes !== null) return;
  const temp = `${snapshot.file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, encode(value), { flag: 'wx', mode: snapshot.mode ?? 0o600 });
    unchanged(snapshot);
    if (snapshot.bytes === null) fs.linkSync(temp, snapshot.file); // refuses a concurrent creation
    else fs.renameSync(temp, snapshot.file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}

function validateConfig(snapshot) {
  const { value, file } = snapshot;
  if (value.hooks !== undefined && !object(value.hooks)) throw new Error(`${file}: hooks must be an object`);
  for (const [event, groups] of Object.entries(value.hooks ?? {})) {
    if (!Array.isArray(groups) || groups.some((group) => !object(group) || !Array.isArray(group.hooks) || group.hooks.some((handler) => !object(handler)))) {
      throw new Error(`${file}: malformed ${event} hook groups; settings left alone`);
    }
  }
}

function readReceipt(snapshot, engine, platform) {
  if (snapshot.bytes === null) return null;
  const r = snapshot.value;
  if (r.version !== 1 || r.engine !== engine || typeof r.sourceRoot !== 'string'
      || !path.isAbsolute(r.sourceRoot) || typeof r.executable !== 'string'
      || !path.isAbsolute(r.executable) || !object(r.ownedHooks)) {
    throw new Error(`${snapshot.file}: unsupported or malformed ownership receipt; preserved`);
  }
  validateConfig({ file: snapshot.file, value: { hooks: r.ownedHooks } });
  const allowed = hookConfig(engine, path.join(r.sourceRoot, 'tools', 'successor.mjs'), r.executable, platform).hooks;
  for (const [event, groups] of Object.entries(r.ownedHooks)) {
    if (groups.length !== 1 || !isDeepStrictEqual(groups, allowed[event])) {
      throw new Error(`${snapshot.file}: ownership includes an unexpected hook; preserved`);
    }
  }
  return r;
}

function groupsFor(config, event) { return config.hooks?.[event] ?? []; }

function matches(config, event, group) {
  return groupsFor(config, event).filter((entry) => isDeepStrictEqual(entry, group)).length;
}

// A changed matcher/handler must not be silently replaced. If the operator
// changed the command itself, it is no longer an exact owned entry: retain it.
function altered(config, event, owned) {
  const commands = new Set(owned.hooks.map((h) => h.command).filter(Boolean));
  return groupsFor(config, event).some((g) => g.hooks.some((h) => commands.has(h.command)));
}

function removeOwned(config, ownedHooks) {
  for (const [event, groups] of Object.entries(ownedHooks)) {
    for (const group of groups) {
      const count = matches(config, event, group);
      if (count > 1) throw new Error(`${event}: duplicate owned hook definitions; reconcile before updating or removing`);
      if (count === 0) {
        if (altered(config, event, group)) throw new Error(`${event}: owned hook definition was modified; preserved for review`);
        continue; // deleted by the operator, or replaced with a different command
      }
      config.hooks[event].splice(config.hooks[event].findIndex((g) => isDeepStrictEqual(g, group)), 1);
      if (!config.hooks[event].length) delete config.hooks[event];
    }
  }
  if (config.hooks && Object.keys(config.hooks).length === 0) delete config.hooks;
}

function one({ action, sourceRoot, scope, skillScope, executable, platform, out }) {
  const receiptFile = path.join(path.dirname(scope.file), RECEIPT);
  const inspect = () => {
    const config = read(scope.file);
    validateConfig(config);
    const receiptSnapshot = read(receiptFile);
    const receipt = readReceipt(receiptSnapshot, scope.engine, platform);
    return { config, receiptSnapshot, receipt };
  };
  const expected = hookConfig(scope.engine, path.join(sourceRoot, 'tools', 'successor.mjs'), executable, platform).hooks;
  if (action === 'check') {
    const { config, receipt } = inspect();
    for (const [event, [group]] of Object.entries(expected)) {
      if (matches(config.value, event, group) !== 1) throw new Error(`${event}: missing, changed or duplicate required hook in ${scope.file}`);
    }
    if (receipt && receipt.sourceRoot !== sourceRoot) throw new Error(`${receiptFile}: hooks belong to ${receipt.sourceRoot}`);
    out.info(`hooks ok ${scope.file} (definitions only; host trust and delivery require verification)`);
    return;
  }

  // An uninstall with nothing registered must neither create directories nor
  // adopt pre-existing configuration as its own.
  if (action === 'unlink' && read(receiptFile).bytes === null) {
    out.info(`hooks kept ${scope.file} (no installer-owned entries)`);
    return;
  }
  if (action === 'link' && !isOwnedLink(path.join(skillScope.dir, 'successor'), path.join(sourceRoot, 'skills', 'successor'), platform)) {
    throw new Error(`successor is not this checkout's installed link in ${skillScope.dir}; hooks left alone`);
  }
  fs.mkdirSync(path.dirname(scope.file), { recursive: true });
  const lock = `${receiptFile}.lock`;
  const fd = fs.openSync(lock, 'wx', 0o600);
  try {
    const { config, receiptSnapshot, receipt } = inspect();
    if (receipt && receipt.sourceRoot !== sourceRoot) {
      if (action === 'unlink') {
        out.info(`hooks kept ${scope.file} (owned by ${receipt.sourceRoot})`);
        return;
      }
      // Match the skill installer's repair rule: a missing former checkout,
      // not merely a different preferred source, permits relocation.
      try {
        fs.statSync(path.join(receipt.sourceRoot, 'skills', 'successor'));
        throw new Error(`hooks belong to ${receipt.sourceRoot}; unlink there before switching checkouts`);
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
      }
    }
    const updated = structuredClone(config.value);
    const retainedOwned = {};
    const obsolete = {};
    for (const [event, groups] of Object.entries(receipt?.ownedHooks ?? {})) {
      if (action === 'link' && isDeepStrictEqual(groups, expected[event])) retainedOwned[event] = groups;
      else obsolete[event] = groups;
    }
    removeOwned(updated, obsolete);
    if (action === 'unlink') {
      if (config.bytes !== null) write(config, updated);
      unchanged(receiptSnapshot);
      fs.unlinkSync(receiptFile);
      out.info(`hooks removed ${scope.file} (unrelated entries and settings preserved)`);
      return;
    }
    const ownedHooks = {};
    for (const [event, [group]] of Object.entries(expected)) {
      const count = matches(updated, event, group);
      if (count > 1) throw new Error(`${event}: duplicate required hooks in ${scope.file}; preserved for review`);
      if (count === 1) {
        if (retainedOwned[event]) ownedHooks[event] = [group];
        continue; // pre-existing matching hook: use, but do not own or remove
      }
      if (altered(updated, event, group)) throw new Error(`${event}: conflicting definition of the successor command in ${scope.file}; preserved`);
      updated.hooks ??= {};
      updated.hooks[event] ??= [];
      updated.hooks[event].push(group);
      ownedHooks[event] = [group];
    }
    write(config, updated);
    // If receipt publication fails, report failure. A retry preserves exact
    // unrecorded entries as pre-existing rather than claiming their ownership.
    write(receiptSnapshot, { version: 1, engine: scope.engine, sourceRoot, executable, ownedHooks });
    out.info(`hooks installed ${scope.file} (SessionStart, UserPromptSubmit, Stop)`);
    if (scope.engine === 'codex') out.info('hooks review: open /hooks in Codex and trust each new or changed definition; the installer never changes trust records.');
  } finally {
    fs.closeSync(fd);
    fs.unlinkSync(lock);
  }
}

/** Manage support needed by the selected skills, without touching project files. */
export function supportHooks({ action, sourceRoot, scopes, sets, host, out, executable = process.execPath }) {
  if (!['link', 'check', 'unlink'].includes(action)) throw new Error(`unknown support hook action '${action}'`);
  if (!selected(sets)) return true;
  let ok = true;
  for (const scope of supportHookScopes(host)) {
    try {
      one({ action, sourceRoot, scope, skillScope: scopes.find((s) => s.engine === scope.engine), executable, platform: host.platform, out });
    } catch (error) {
      out.error(`hooks FAIL ${scope.file}: ${error.message}`);
      ok = false;
    }
  }
  return ok;
}
