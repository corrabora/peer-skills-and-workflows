// Worker configuration: a catalog of named profiles (agent, model, effort)
// and assignments of roles and review seats to profile names. Layers apply in
// increasing precedence: shared defaults, repository, plan, phase, operator.
// Catalogs are prototype-free dictionaries and lookups use own keys only, so a
// name such as `constructor` is defined only when a layer defines it.

import fs from 'node:fs';
import { quoteShowingSpaces, revealTextSpaces } from './text-spaces.mjs';
import { decodeUtf8, parseYaml, YamlError } from './yaml.mjs';

export const ROLES = ['responsible-party', 'adjudicator-1', 'adjudicator-2', 'investigator'];
export const SEATS = ['R1', 'R2', 'R3', 'R4'];
const PROFILE_FIELDS = ['agent', 'model', 'effort'];
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** Read one UTF-8 YAML layer file; returns null when it does not exist. */
export function readLayerFile(file, { allowPhases = false } = {}) {
  let bytes;
  try {
    bytes = fs.readFileSync(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const text = decodeUtf8(bytes);
  if (text === null) throw new Error(`${file}: the file is not valid UTF-8; save it as UTF-8`);
  let data;
  try {
    data = parseYaml(text.replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error instanceof YamlError) throw new Error(`${file}: ${error.message}`);
    throw error;
  }
  return checkLayer(data ?? {}, file, { allowPhases });
}

/** Validate the shape of one layer and return it with empty sections filled in. */
export function checkLayer(data, origin, { allowPhases = false } = {}) {
  const fail = (message) => { throw new Error(`${origin}: ${message}`); };
  if (!isMapping(data)) fail('configuration must be a mapping');
  const allowed = ['profiles', 'roles', 'review-seats', ...(allowPhases ? ['phases'] : [])];
  for (const key of Object.keys(data)) {
    if (!allowed.includes(key)) fail(`unknown section ${quoteShowingSpaces(key)} (allowed: ${allowed.join(', ')})`);
  }
  const layer = { profiles: dictionary(), roles: dictionary(), 'review-seats': dictionary(), phases: dictionary() };
  for (const [name, profile] of entries(own(data, 'profiles'), 'profiles', fail)) {
    if (!NAME.test(name)) {
      fail(`profile name '${name}' must start with a letter or digit and contain only letters, digits, '.', '_' or '-'`
        + spacesInName(name));
    }
    if (!isMapping(profile)) fail(`profile '${name}' must be a mapping of ${PROFILE_FIELDS.join(', ')}`);
    for (const key of Object.keys(profile)) {
      if (!PROFILE_FIELDS.includes(key)) fail(`profile '${name}' has unknown field ${quoteShowingSpaces(key)}`);
    }
    for (const field of PROFILE_FIELDS) {
      const value = own(profile, field);
      if (typeof value !== 'string' || !value.trim()) fail(`profile '${name}' needs a non-empty string '${field}'`);
    }
    layer.profiles[name] = { agent: profile.agent, model: profile.model, effort: profile.effort };
  }
  const sections = [['roles', ROLES, 'review-seats', SEATS], ['review-seats', SEATS, 'roles', ROLES]];
  for (const [section, known, other, otherKnown] of sections) {
    for (const [key, profile] of entries(own(data, section), section, fail)) {
      if (!known.includes(key)) {
        const hint = otherKnown.includes(key) ? `; '${key}' belongs under ${other}` : '';
        fail(`unknown ${section} entry ${quoteShowingSpaces(key)} (known: ${known.join(', ')}${hint})`);
      }
      if (typeof profile !== 'string' || !NAME.test(profile)) {
        fail(`${section}.${key} must name a profile${spacesInName(profile)}`);
      }
      layer[section][key] = profile;
    }
  }
  for (const [phase, phaseData] of entries(own(data, 'phases'), 'phases', fail)) {
    layer.phases[String(phase)] = checkLayer(phaseData ?? {}, `${origin} phase ${phase}`);
  }
  return layer;
}

/**
 * Merge layers (lowest precedence first). A profile defined in a later layer
 * replaces the same-named profile whole; each role or seat assignment is
 * replaced individually. Every role and seat must end assigned to a defined
 * profile.
 */
export function resolveConfiguration(layers) {
  const profiles = dictionary();
  const assignments = dictionary();
  for (const { name, layer } of layers) {
    for (const [profileName, profile] of Object.entries(layer.profiles)) {
      profiles[profileName] = { ...profile, source: name };
    }
    for (const [key, profile] of [...Object.entries(layer.roles), ...Object.entries(layer['review-seats'])]) {
      assignments[key] = { profile, source: name };
    }
  }
  const effective = {};
  for (const key of [...ROLES, ...SEATS]) {
    const assignment = own(assignments, key);
    if (!assignment) throw new Error(`no profile is assigned to '${key}'`);
    const profile = own(profiles, assignment.profile);
    if (!profile) throw new Error(`'${key}' (from ${assignment.source}) names undefined profile '${assignment.profile}'`);
    effective[key] = {
      profile: assignment.profile,
      agent: profile.agent,
      model: profile.model,
      effort: profile.effort,
      assignedBy: assignment.source,
      profileFrom: profile.source,
    };
  }
  return { profiles, assignments: effective };
}

/** Build the operator layer from `name=agent,model,effort` and `key=profile` strings. */
export function operatorLayer(profileArgs, assignArgs) {
  const data = { profiles: dictionary(), roles: dictionary(), 'review-seats': dictionary() };
  for (const arg of profileArgs) {
    const match = /^([^=]+)=([^,]+),([^,]+),([^,]+)$/.exec(arg);
    if (!match) throw new Error(`--profile '${arg}' must be name=agent,model,effort`);
    data.profiles[match[1]] = { agent: match[2], model: match[3], effort: match[4] };
  }
  for (const arg of assignArgs) {
    const match = /^([^=]+)=(.+)$/.exec(arg);
    if (!match) throw new Error(`--assign '${arg}' must be role=profile or seat=profile`);
    if (!ROLES.includes(match[1]) && !SEATS.includes(match[1])) {
      throw new Error(`--assign '${arg}' names unknown role or seat '${match[1]}' `
        + `(roles: ${ROLES.join(', ')}; seats: ${SEATS.join(', ')})`);
    }
    const section = SEATS.includes(match[1]) ? 'review-seats' : 'roles';
    data[section][match[1]] = match[2];
  }
  return checkLayer(data, 'operator overrides');
}

// A refused name holding one of the Unicode spaces YAML keeps as text looks
// valid when printed, so its error shows them written out.
function spacesInName(name) {
  const spaces = typeof name === 'string' ? revealTextSpaces(name) : null;
  if (!spaces) return '';
  const [it, looks] = spaces.plural ? ['them', 'they look like spaces but are'] : ['it', 'it looks like a space but is'];
  return `; the name is "${spaces.shown}" with ${spaces.named} written as \\uXXXX: ${looks} part of `
    + `the name, and profile names cannot contain spaces, so delete ${it}`;
}

function dictionary() {
  return Object.create(null);
}

/** The value of `key` when it is an own property of `object`, otherwise undefined. */
function own(object, key) {
  return Object.hasOwn(object, key) ? object[key] : undefined;
}

function entries(section, name, fail) {
  if (section === undefined || section === null) return [];
  if (!isMapping(section)) fail(`'${name}' must be a mapping`);
  return Object.entries(section);
}

function isMapping(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
