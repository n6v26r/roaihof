import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const checked = '2026-06-19';
const profileCacheDir = '/tmp/onia-mlcompete-profiles';
const participantsURL = 'https://docs.google.com/spreadsheets/d/1W8bptasd7CqXVyLROwJhvEgJHexbc722ol22AMIbdn0/gviz/tq?tqx=out:csv&gid=0';
const participantsHTMLURL = 'https://docs.google.com/spreadsheets/d/1W8bptasd7CqXVyLROwJhvEgJHexbc722ol22AMIbdn0/htmlview?pli=1';

const nationalPath = path.join(root, 'data/raw/onia/rezultate-nationala-2026.json');
const platformPath = path.join(root, 'data/manual/onia-platform-leaderboards.json');
const aliasesPath = path.join(root, 'data/manual/aliases.json');
const participantsPath = '/tmp/onia-national-participants.csv';
const outputPath = path.join(root, 'data/manual/onia-2026-national-recovery.json');

const national = JSON.parse(await fs.readFile(nationalPath, 'utf8'));
const platform = JSON.parse(await fs.readFile(platformPath, 'utf8'));
const aliases = await loadAliases(aliasesPath);
const allParticipants = parseParticipants(await loadCachedText(participantsPath, participantsURL));
const namedNationalParticipants = officialNamedParticipantKeys(national);

await fs.mkdir(profileCacheDir, { recursive: true });

const platformRows = nationalPlatformRows(platform.leaderboards);
const stageAppearances = await loadStageAppearances();
const guests = nationalGuests(allParticipants, platformRows);
const anonymousRows = officialAnonymousRows(national);
const excluded = anonymousRows.filter((row) => row.kind === 'absent').map(excludedAbsentRow);
const recovery = await recoverAnonymousRows(
  anonymousRows.filter((row) => row.kind !== 'absent'),
  allParticipants,
  platformRows,
  stageAppearances
);

const output = {
  sources: [
    {
      id: 'onia-2026-national-participants-sheet',
      title: 'ONIA 2026 national participant room assignment sheet',
      url: participantsHTMLURL,
      accessedAt: checked,
      status: 'ok'
    },
    {
      id: 'mlcompete-11-final',
      title: 'ONIA 2026 local IX-X mlcompete final leaderboard',
      url: 'https://platform.olimpiada-ai.ro/ro/competitions/11?tab=final',
      accessedAt: checked,
      status: 'ok'
    },
    {
      id: 'mlcompete-12-final',
      title: 'ONIA 2026 local XI-XII mlcompete final leaderboard',
      url: 'https://platform.olimpiada-ai.ro/ro/competitions/12?tab=final',
      accessedAt: checked,
      status: 'ok'
    },
    {
      id: 'mlcompete-14-final',
      title: 'ONIA 2026 county IX-X mlcompete final leaderboard',
      url: 'https://platform.olimpiada-ai.ro/ro/competitions/14?tab=final',
      accessedAt: checked,
      status: 'ok'
    },
    {
      id: 'mlcompete-15-final',
      title: 'ONIA 2026 county XI-XII mlcompete final leaderboard',
      url: 'https://platform.olimpiada-ai.ro/ro/competitions/15?tab=final',
      accessedAt: checked,
      status: 'ok'
    },
    {
      id: 'mlcompete-2026-profile-pages',
      title: 'ONIA 2026 public mlcompete profile pages',
      url: 'https://platform.olimpiada-ai.ro/ro/profile/',
      accessedAt: checked,
      status: 'partial'
    }
  ],
  note: 'Recovered IX-XII anonymous ONIA 2026 national rows by matching public mlcompete national scores to usernames, then iteratively matching remaining participants by public profile institution/county, username-name evidence, and local/county stage username appearances. Grade 8 national invitees are tracked separately as guest participations. Official absent placeholders are excluded because they did not participate in the contest.',
  guests,
  excluded,
  recovered: recovery.matches,
  unresolved: recovery.unresolved
};

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${recovery.matches.length} recovered rows, ${guests.length} guests, ${excluded.length} excluded absent rows, and ${recovery.unresolved.length} unresolved rows to ${outputPath}`);

async function recoverAnonymousRows(rows, participants, platformRows, stageAppearances) {
  let availableParticipants = participants
    .filter((participant) => participant.grade !== '8')
    .filter((participant) => !namedNationalParticipants.has(participantKey(participant)));
  const matches = [];
  const unresolved = [];
  const usedUsernames = new Set();
  const matchedRows = new Set();
  const profiles = new Map();

  const profileFor = async (username) => {
    if (!username) return null;
    if (!profiles.has(username)) {
      profiles.set(username, await loadProfile(username));
    }
    return profiles.get(username);
  };

  const removeParticipant = (participant) => {
    availableParticipants = availableParticipants.filter((item) => item !== participant);
  };

  const bestForRow = async (row, candidates) => {
    const options = [];
    for (const candidate of candidates.filter((item) => !usedUsernames.has(item.username))) {
      const profile = await profileFor(candidate.username);
      for (const participant of availableParticipants.filter((item) => item.grade === row.grade)) {
        const score = participantMatchScore({
          username: candidate.username,
          rowScore: row.score,
          platformScore: candidate.score,
          profile,
          participant,
          availableParticipants
        });
        if (score > 0) {
          options.push({ candidate, participant, profile, score });
        }
      }
    }
    options.sort((a, b) => b.score - a.score);
    if (options.length === 0) return null;
    if (options.length > 1 && options[0].score === options[1].score) return null;
    return options[0].score >= 6 ? options[0] : null;
  };

  let progress = true;
  while (progress) {
    progress = false;
    const positiveRows = rows
      .filter((row) => row.kind === 'positive' && !matchedRows.has(rowKey(row)))
      .sort((a, b) => b.score - a.score || Number(a.grade) - Number(b.grade) || a.place - b.place);
    for (const row of positiveRows) {
      const candidates = (platformRows.get(row.section) ?? []).filter((candidate) => scoresClose(candidate.score, row.score));
      const match = await bestForRow(row, candidates);
      if (!match) continue;
      matches.push(recoveredRow(row, match, stageAppearances));
      usedUsernames.add(match.candidate.username);
      matchedRows.add(rowKey(row));
      removeParticipant(match.participant);
      progress = true;
    }
  }

  for (const section of ['IX-X', 'XI-XII']) {
    const sectionGrades = section === 'IX-X' ? ['9', '10'] : ['11', '12'];
    const zeroUsers = (platformRows.get(section) ?? []).filter((row) => row.score === 0 && !usedUsernames.has(row.username));
    const pairings = [];
    for (const candidate of zeroUsers) {
      const profile = await profileFor(candidate.username);
      const options = [];
      for (const participant of availableParticipants.filter((item) => sectionGrades.includes(item.grade))) {
        const score = participantMatchScore({
          username: candidate.username,
          rowScore: 0,
          platformScore: 0,
          profile,
          participant,
          availableParticipants,
          ignoreScore: true
        });
        if (score > 0) {
          options.push({ candidate, participant, profile, score });
        }
      }
      options.sort((a, b) => b.score - a.score);
      if (options.length === 0 || (options.length > 1 && options[0].score === options[1].score) || options[0].score < 6) {
        continue;
      }
      pairings.push(options[0]);
      usedUsernames.add(candidate.username);
      removeParticipant(options[0].participant);
    }

    const zeroRows = rows.filter((row) => row.section === section && row.kind === 'zero' && !matchedRows.has(rowKey(row)));
    for (const grade of sectionGrades) {
      const gradeRows = zeroRows.filter((row) => row.grade === grade).sort((a, b) => a.place - b.place);
      const gradePairings = pairings
        .filter((pairing) => pairing.participant.grade === grade)
        .sort((a, b) => a.candidate.rank - b.candidate.rank || a.candidate.username.localeCompare(b.candidate.username));
      for (let index = 0; index < Math.min(gradeRows.length, gradePairings.length); index++) {
        const row = gradeRows[index];
        matches.push(recoveredRow(row, gradePairings[index], stageAppearances));
        matchedRows.add(rowKey(row));
      }
    }
  }

  for (const row of rows.filter((item) => !matchedRows.has(rowKey(item)))) {
    const candidates = (platformRows.get(row.section) ?? []).filter((candidate) => row.kind === 'zero' ? candidate.score === 0 : scoresClose(candidate.score, row.score));
    unresolved.push({
      grade: row.grade,
      place: row.place,
      score: row.score,
      anonymousName: row.anonymousName,
      kind: row.kind,
      candidateCount: candidates.length,
      reason: 'ambiguous or missing participant match'
    });
  }

  matches.sort((a, b) => Number(a.grade) - Number(b.grade) || a.place - b.place);
  unresolved.sort((a, b) => Number(a.grade) - Number(b.grade) || a.place - b.place);
  return { matches, unresolved };
}

function excludedAbsentRow(row) {
  return {
    grade: row.grade,
    place: row.place,
    anonymousName: row.anonymousName,
    kind: row.kind,
    reason: 'official national source marks the row absent'
  };
}

function recoveredRow(row, match, stageAppearances) {
  const evidence = [];
  const explicitName = profileName(match.profile);
  if (explicitName && nameKey(explicitName) === nameKey(match.participant.name)) {
    evidence.push('profile-name');
  }
  if (profileInstitutionEvidence(match.profile, match.participant)) {
    evidence.push('profile-institution');
  }
  if (usernameNameScore(match.candidate.username, match.participant.name) > 0) {
    evidence.push('username-name');
  }
  for (const stage of stageAppearances.get(usernameKey(match.candidate.username)) ?? []) {
    evidence.push(stage);
  }
  evidence.push(row.kind === 'zero' ? 'national-zero-score' : 'national-score');

  return {
    grade: row.grade,
    place: row.place,
    score: row.score,
    username: match.candidate.username,
    userId: match.candidate.userId,
    platformRank: match.candidate.rank,
    name: match.participant.name,
    school: match.participant.school,
    county: match.participant.county,
    evidence: [...new Set(evidence)]
  };
}

function participantMatchScore({ username, rowScore, platformScore, profile, participant, availableParticipants, ignoreScore = false }) {
  let score = usernameNameScore(username, participant.name);
  const explicitName = profileName(profile);
  if (explicitName && nameKey(explicitName) === nameKey(participant.name)) {
    score += 100;
  }
  const institution = profile?.institution?.name ?? '';
  if (institution) {
    if (isCountyInstitution(institution, availableParticipants) && sameCountyName(institution, participant.county)) {
      score += 35;
    }
    if (sameSchool(institution, participant.school)) {
      score += 70;
    }
  }
  if (!ignoreScore && rowScore != null && platformScore != null) {
    const delta = Math.abs(Number(rowScore) - Number(platformScore));
    if (delta < 0.005) {
      score += 100;
    } else {
      score -= delta * 1000;
    }
  }
  return score;
}

function profileInstitutionEvidence(profile, participant) {
  const institution = profile?.institution?.name ?? '';
  if (!institution) return false;
  return sameCountyName(institution, participant.county) || sameSchool(institution, participant.school);
}

function officialAnonymousRows(file) {
  const groups = [
    ['9', file.Clasa_9 ?? []],
    ['10', file.Clasa_10 ?? []],
    ['11', file.Clasa_11 ?? []],
    ['12', file.Clasa_12 ?? []]
  ];
  const rows = [];
  for (const [grade, items] of groups) {
    for (const item of items) {
      if (!nameKey(item.Username).startsWith('participant ')) continue;
      rows.push({
        grade,
        place: item.Pozitie,
        score: typeof item.ScorTotal === 'number' ? item.ScorTotal : 0,
        kind: scoreKind(item),
        section: sectionForGrade(grade),
        anonymousName: item.Username
      });
    }
  }
  return rows;
}

function scoreKind(row) {
  if (typeof row.ScorTotal === 'number') {
    return row.ScorTotal === 0 ? 'zero' : 'positive';
  }
  if (cleanHuman(row.ScorTotal).toLowerCase() === 'absent' || row.ScorFinal == null) {
    return 'absent';
  }
  return 'zero';
}

function officialNamedParticipantKeys(file) {
  const groups = [
    ['9', file.Clasa_9 ?? []],
    ['10', file.Clasa_10 ?? []],
    ['11', file.Clasa_11 ?? []],
    ['12', file.Clasa_12 ?? []]
  ];
  const keys = new Set();
  for (const [grade, items] of groups) {
    for (const item of items) {
      if (nameKey(item.Username).startsWith('participant ')) continue;
      keys.add(`${grade}:${nameKey(canonicalName(item.Username))}`);
    }
  }
  return keys;
}

function nationalPlatformRows(leaderboards) {
  const rows = new Map();
  for (const leaderboard of leaderboards) {
    if (leaderboard.contestId !== 'onia-2026-nationala') continue;
    rows.set(leaderboard.section, leaderboard.rows.map((row) => ({
      userId: row.userId ?? '',
      username: row.username ?? '',
      rank: row.rank,
      score: Number(row.score)
    })));
  }
  return rows;
}

function nationalGuests(participants, platformRows) {
  const guestUsernameByName = new Map([
    ['boac mihai cosmin', 'Cosminane'],
    ['boca petru', 'petru_boca'],
    ['calin tudor ioan', 'Sobolansky'],
    ['chelaru ioan cristian', 'iccjoc'],
    ['predesel mathias alexandru', 'andreiminunat']
  ]);
  const ixXRows = platformRows.get('IX-X') ?? [];
  return participants
    .filter((participant) => participant.grade === '8')
    .map((participant) => {
      const username = guestUsernameByName.get(nameKey(participant.name));
      const platformRow = username ? ixXRows.find((row) => row.username === username) : undefined;
      if (!platformRow) {
        throw new Error(`missing ONIA grade 8 guest platform row for ${participant.name}`);
      }
      return {
        name: participant.name,
        grade: participant.grade,
        school: participant.school,
        county: participant.county,
        username: platformRow.username,
        userId: platformRow.userId,
        platformRank: platformRow.rank,
        score: platformRow.score,
        status: 'guest',
        evidence: ['participant-sheet', 'national-extra-row']
      };
    });
}

async function loadStageAppearances() {
  const specs = [
    {
      evidence: 'local-stage-username',
      cachePath: '/tmp/mlcompete-competition-11.html',
      fallbackCachePath: '/tmp/mlcompete-11-final.html',
      url: 'https://platform.olimpiada-ai.ro/ro/competitions/11?tab=final'
    },
    {
      evidence: 'local-stage-username',
      cachePath: '/tmp/mlcompete-competition-12.html',
      fallbackCachePath: '/tmp/mlcompete-12-final.html',
      url: 'https://platform.olimpiada-ai.ro/ro/competitions/12?tab=final'
    },
    {
      evidence: 'county-stage-username',
      cachePath: '/tmp/mlcompete-competition-14.html',
      fallbackCachePath: '/tmp/mlcompete-14-final.html',
      url: 'https://platform.olimpiada-ai.ro/ro/competitions/14?tab=final'
    },
    {
      evidence: 'county-stage-username',
      cachePath: '/tmp/mlcompete-competition-15.html',
      fallbackCachePath: '/tmp/mlcompete-15-final.html',
      url: 'https://platform.olimpiada-ai.ro/ro/competitions/15?tab=final'
    }
  ];
  const appearances = new Map();
  for (const spec of specs) {
    const html = await loadCachedTextWithFallback(spec.cachePath, spec.fallbackCachePath, spec.url);
    for (const row of extractLeaderboardRows(html)) {
      const key = usernameKey(row.username);
      if (!appearances.has(key)) {
        appearances.set(key, []);
      }
      appearances.get(key).push(spec.evidence);
    }
  }
  for (const [key, values] of appearances) {
    appearances.set(key, [...new Set(values)]);
  }
  return appearances;
}

function extractLeaderboardRows(html) {
  const marker = '\\"partialLeaderboard\\":';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return [];
  const start = html.indexOf('[', markerIndex + marker.length);
  let depth = 0;
  let end = -1;
  for (let index = start; index < html.length; index++) {
    const char = html[index];
    if (char === '[') depth++;
    if (char === ']') {
      depth--;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  if (start < 0 || end < 0) return [];
  return JSON.parse(html.slice(start, end).replace(/\\"/g, '"'));
}

function parseParticipants(csv) {
  const [header, ...lines] = parseCSV(csv);
  const indices = Object.fromEntries(header.map((name, index) => [name, index]));
  return lines
    .map((row) => {
      const rawName = cleanHuman(`${row[indices.Nume] ?? ''} ${row[indices.Prenume] ?? ''}`);
      return {
        name: rawName,
        canonicalName: canonicalName(rawName),
        originalName: rawName,
        grade: parseGrade(row[indices.Clasa] ?? ''),
        school: cleanHuman(row[indices.Liceu] ?? ''),
        county: titleCounty(row[indices['Județ']] ?? '')
      };
    })
    .filter((row) => row.name && row.grade);
}

function parseCSV(input) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ''));
}

async function loadProfile(username) {
  const cachePath = path.join(profileCacheDir, `${encodeURIComponent(username)}.html`);
  const url = `https://platform.olimpiada-ai.ro/ro/profile/${encodeURIComponent(username)}`;
  const html = await loadCachedText(cachePath, url);
  return extractProfile(html);
}

async function loadCachedText(cachePath, url) {
  let html;
  try {
    html = await fs.readFile(cachePath, 'utf8');
  } catch {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${url}: HTTP ${response.status}`);
    }
    html = await response.text();
    await fs.writeFile(cachePath, html);
  }
  return html;
}

async function loadCachedTextWithFallback(cachePath, fallbackCachePath, url) {
  try {
    return await fs.readFile(cachePath, 'utf8');
  } catch {
    try {
      const text = await fs.readFile(fallbackCachePath, 'utf8');
      await fs.writeFile(cachePath, text);
      return text;
    } catch {
      return loadCachedText(cachePath, url);
    }
  }
}

function extractProfile(html) {
  const marker = '\\"profile\\":{\\"userId\\"';
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const objectStart = html.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let index = objectStart; index < html.length; index++) {
    const char = html[index];
    if (char === '{') depth++;
    if (char === '}') depth--;
    if (depth === 0) {
      end = index + 1;
      break;
    }
  }
  if (end < 0) return null;
  const blob = html.slice(objectStart, end);
  const institutionStart = blob.indexOf('\\"institution\\":{');
  const institutionEnd = institutionStart >= 0 ? matchingObjectEnd(blob, blob.indexOf('{', institutionStart)) : -1;
  const institutionBlob = institutionStart >= 0 && institutionEnd > institutionStart ? blob.slice(institutionStart, institutionEnd) : '';
  return {
    userId: escapedField(blob, 'userId'),
    username: escapedField(blob, 'username'),
    firstName: escapedField(blob, 'firstName'),
    lastName: escapedField(blob, 'lastName'),
    location: escapedField(blob, 'location'),
    institution: institutionBlob ? {
      name: escapedField(institutionBlob, 'name'),
      county: {
        name: escapedField(institutionBlob, 'name', institutionBlob.indexOf('\\"county\\":{'))
      }
    } : null
  };
}

function matchingObjectEnd(text, objectStart) {
  if (objectStart < 0) return -1;
  let depth = 0;
  for (let index = objectStart; index < text.length; index++) {
    const char = text[index];
    if (char === '{') depth++;
    if (char === '}') depth--;
    if (depth === 0) return index + 1;
  }
  return -1;
}

function escapedField(text, field, offset = 0) {
  if (offset < 0) return '';
  const pattern = new RegExp(`\\\\\\"${field}\\\\\\":(?:null|\\\\\\"((?:\\\\\\\\.|[^\\\\"])*)\\\\\\")`);
  const match = text.slice(offset).match(pattern);
  if (!match || match[1] == null) return '';
  return unescapeJSONString(match[1]);
}

function unescapeJSONString(value) {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\u0026/g, '&');
  }
}

function profileName(profile) {
  if (!profile) return '';
  if (!profile.firstName && !profile.lastName) return '';
  return cleanHuman(`${profile.lastName ?? ''} ${profile.firstName ?? ''}`);
}

function sectionForGrade(grade) {
  return grade === '9' || grade === '10' ? 'IX-X' : 'XI-XII';
}

function parseGrade(raw) {
  const key = nameKey(raw);
  if (key.includes('viii')) return '8';
  if (key.includes('ix')) return '9';
  if (key.includes('xii')) return '12';
  if (key.includes('xi')) return '11';
  if (key.includes('x')) return '10';
  return '';
}

function usernameNameScore(username, name) {
  const key = usernameKey(username);
  if (!key) return 0;
  const tokens = nameKey(name).split(' ').filter(Boolean);
  let score = 0;
  for (const token of tokens) {
    if (token.length >= 4 && key.includes(token)) score += token.length * 3;
    if (token.length >= 4 && key.includes(token.slice(0, 4))) score += 4;
    if (token.length >= 3 && key.includes(token)) score += token.length;
  }
  for (const permutation of tokenPermutations(tokens.map((token) => token[0]))) {
    if (permutation.length >= 2 && key.includes(permutation)) score += permutation.length * 3;
  }
  for (let left = 0; left < tokens.length; left++) {
    for (let right = 0; right < tokens.length; right++) {
      if (left === right) continue;
      const firstInitialThenToken = `${tokens[left][0]}${tokens[right]}`;
      const tokenThenInitial = `${tokens[right]}${tokens[left][0]}`;
      if (firstInitialThenToken.length >= 4 && key.includes(firstInitialThenToken)) {
        score += firstInitialThenToken.length * 3;
      }
      if (tokenThenInitial.length >= 4 && key.includes(tokenThenInitial)) {
        score += tokenThenInitial.length * 2;
      }
    }
  }
  return score;
}

function tokenPermutations(tokens) {
  if (tokens.length < 2 || tokens.length > 4) return [];
  const output = [];
  const used = new Array(tokens.length).fill(false);
  const current = [];
  function walk() {
    if (current.length === tokens.length) {
      output.push(current.join(''));
      return;
    }
    for (let index = 0; index < tokens.length; index++) {
      if (used[index]) continue;
      used[index] = true;
      current.push(tokens[index]);
      walk();
      current.pop();
      used[index] = false;
    }
  }
  walk();
  return output;
}

function isCountyInstitution(value, participants) {
  const key = nameKey(value);
  return participants.some((participant) => nameKey(participant.county) === key);
}

function sameCountyName(left, right) {
  return nameKey(left) === nameKey(right);
}

function sameSchool(left, right) {
  const leftKey = schoolKey(left);
  const rightKey = schoolKey(right);
  return leftKey && rightKey && (leftKey === rightKey || leftKey.includes(rightKey) || rightKey.includes(leftKey));
}

function schoolKey(value) {
  return nameKey(value)
    .replace(/\b(colegiul|colegiul national|national|liceul|liceul teoretic|teoretic|de|din|municipiul|bucuresti|sectorul|sector|cn|c n)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoresClose(left, right) {
  return Math.abs(Number(left) - Number(right)) <= 0.05 + Number.EPSILON;
}

function participantKey(participant) {
  return `${participant.grade}:${nameKey(participant.canonicalName ?? participant.name)}`;
}

function rowKey(row) {
  return `${row.grade}:${row.place}`;
}

function canonicalName(name) {
  const clean = cleanHuman(name);
  return aliases.get(nameKey(clean)) ?? clean;
}

async function loadAliases(filePath) {
  const file = JSON.parse(await fs.readFile(filePath, 'utf8'));
  const map = new Map();
  for (const item of file.aliases ?? []) {
    map.set(nameKey(item.alias), cleanHuman(item.canonical));
  }
  return map;
}

function usernameKey(value) {
  return nameKey(value)
    .replaceAll(' ', '')
    .replace(/[013457]/g, (char) => ({ 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't' })[char] ?? char);
}

function nameKey(value) {
  return cleanHuman(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[„”]/g, '"')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cleanHuman(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function titleCounty(value) {
  const text = cleanHuman(value);
  if (!text) return '';
  if (nameKey(text) === 'bucuresti') return 'București';
  return text.toLocaleLowerCase('ro-RO').replace(/\p{L}+/gu, (word) => word[0].toLocaleUpperCase('ro-RO') + word.slice(1));
}
