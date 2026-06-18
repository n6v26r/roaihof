import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const checked = '2026-06-19';
const profileCacheDir = '/tmp/onia-mlcompete-profiles';
const participantsURL = 'https://docs.google.com/spreadsheets/d/1W8bptasd7CqXVyLROwJhvEgJHexbc722ol22AMIbdn0/gviz/tq?tqx=out:csv';
const participantsHTMLURL = 'https://docs.google.com/spreadsheets/d/1W8bptasd7CqXVyLROwJhvEgJHexbc722ol22AMIbdn0/htmlview?pli=1';

const nationalPath = path.join(root, 'data/raw/onia/rezultate-nationala-2026.json');
const platformPath = path.join(root, 'data/manual/onia-platform-leaderboards.json');
const participantsPath = '/tmp/onia-national-participants.csv';
const outputPath = path.join(root, 'data/manual/onia-2026-national-recovery.json');

const national = JSON.parse(await fs.readFile(nationalPath, 'utf8'));
const platform = JSON.parse(await fs.readFile(platformPath, 'utf8'));
const namedNationalParticipants = officialNamedParticipantKeys(national);
const allParticipants = parseParticipants(await loadCachedText(participantsPath, participantsURL));
const participants = allParticipants
  .filter((participant) => participant.grade !== '8')
  .filter((participant) => !namedNationalParticipants.has(`${participant.grade}:${nameKey(participant.name)}`));

await fs.mkdir(profileCacheDir, { recursive: true });

const platformRows = nationalPlatformRows(platform.leaderboards);
const guests = nationalGuests(allParticipants, platformRows);
const anonymousRows = officialAnonymousRows(national).filter((row) => typeof row.score === 'number' && row.score > 0);
const candidateRows = [];
const usernames = new Set();

for (const row of anonymousRows) {
  const rows = (platformRows.get(sectionForGrade(row.grade)) ?? []).filter((candidate) => scoresClose(candidate.score, row.score));
  if (rows.length !== 1) {
    continue;
  }
  const candidate = rows[0];
  candidateRows.push({ ...row, username: candidate.username, userId: candidate.userId, platformRank: candidate.rank });
  usernames.add(candidate.username);
}

const profiles = new Map();
for (const username of [...usernames].sort((a, b) => a.localeCompare(b))) {
  profiles.set(username, await loadProfile(username));
}

const participantByName = new Map(participants.map((participant) => [nameKey(participant.name), participant]));
const matches = [];
const unresolved = [];

for (const row of candidateRows) {
  const profile = profiles.get(row.username);
  const candidates = participantCandidates(row, profile, participants);
  if (candidates.length !== 1) {
    unresolved.push(unresolvedRow(row, profile, candidates));
    continue;
  }
  const participant = candidates[0];
  const evidence = [];
  if (profile?.firstName || profile?.lastName) evidence.push('profile-name');
  if (profile?.institution?.name) evidence.push('profile-institution');
  evidence.push('national-score');
  matches.push({
    grade: row.grade,
    place: row.place,
    score: row.score,
    username: row.username,
    userId: row.userId,
    name: participant.name,
    school: participant.school,
    county: participant.county,
    evidence
  });
}

matches.sort((a, b) => Number(a.grade) - Number(b.grade) || a.place - b.place);
unresolved.sort((a, b) => Number(a.grade) - Number(b.grade) || a.place - b.place);

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
      id: 'mlcompete-2026-profile-pages',
      title: 'ONIA 2026 public mlcompete profile pages',
      url: 'https://platform.olimpiada-ai.ro/ro/profile/',
      accessedAt: checked,
      status: 'partial'
    }
  ],
  note: 'Recovered IX-XII anonymous ONIA 2026 national rows by exact national-score match to the public mlcompete final leaderboard, then by public profile identity/institution against the official national participant sheet. Grade 8 national invitees are tracked separately as guest participations; their scores come from the extra IX-X mlcompete final rows not present in the official IX-X national JSON.',
  guests,
  recovered: matches,
  unresolved
};

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${matches.length} recovered rows, ${guests.length} guests, and ${unresolved.length} unresolved rows to ${outputPath}`);

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
        score: typeof item.ScorTotal === 'number' ? item.ScorTotal : item.ScorTotal,
        anonymousName: item.Username
      });
    }
  }
  return rows;
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
			keys.add(`${grade}:${nameKey(item.Username)}`);
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

function participantCandidates(row, profile, participants) {
	const gradeParticipants = participants.filter((participant) => participant.grade === row.grade);
	const explicitName = profileName(profile);
	if (explicitName) {
		const participant = participantByName.get(nameKey(explicitName));
		if (participant?.grade === row.grade) return [participant];
	}

	const profileInstitution = profile?.institution?.name ?? '';
	if (profileInstitution && isCountyInstitution(profileInstitution, participants)) {
		const sameCounty = gradeParticipants.filter((participant) => sameCountyName(profileInstitution, participant.county));
		if (sameCounty.length === 1) {
			return sameCounty;
		}
		const countyUsernameMatches = rankedUsernameMatches(row.username, sameCounty);
		if (countyUsernameMatches.length === 1) {
			return countyUsernameMatches;
		}
	} else if (profileInstitution) {
		const sameInstitution = gradeParticipants.filter((participant) => sameSchool(profileInstitution, participant.school));
		if (sameInstitution.length === 1) {
			return sameInstitution;
		}
		const schoolUsernameMatches = rankedUsernameMatches(row.username, sameInstitution);
		if (schoolUsernameMatches.length === 1) {
			return schoolUsernameMatches;
		}
	}

	return rankedUsernameMatches(row.username, gradeParticipants, 2);
}

function unresolvedRow(row, profile, candidates) {
  return {
    grade: row.grade,
    place: row.place,
    score: row.score,
    username: row.username,
    userId: row.userId,
    profileName: profileName(profile),
    profileInstitution: profile?.institution?.name ?? '',
    candidateCount: candidates.length
  };
}

function parseParticipants(csv) {
  const [header, ...lines] = parseCSV(csv);
  const indices = Object.fromEntries(header.map((name, index) => [name, index]));
  return lines
    .map((row) => ({
      name: cleanHuman(`${row[indices.Nume] ?? ''} ${row[indices.Prenume] ?? ''}`),
      grade: parseGrade(row[indices.Clasa] ?? ''),
      school: cleanHuman(row[indices.Liceu] ?? ''),
      county: titleCounty(row[indices['Județ']] ?? '')
    }))
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

function rankedUsernameMatches(username, participants, minimumScore = 1) {
	const scored = participants
		.map((participant) => ({ participant, score: usernameNameScore(username, participant.name) }))
		.filter((item) => item.score >= minimumScore)
		.sort((a, b) => b.score - a.score);
	if (scored.length === 0) return [];
	if (scored.length > 1 && scored[0].score === scored[1].score) return [];
	return [scored[0].participant];
}

function usernameNameScore(username, name) {
	const key = usernameKey(username);
	if (!key) return 0;
	const tokens = nameKey(name).split(' ').filter(Boolean);
	let score = 0;
	for (const token of tokens) {
		if (token.length >= 4 && key.includes(token)) score += token.length;
		if (token.length >= 5 && key.includes(token.replace(/s$/, 'sh'))) score += token.length - 1;
		if (token.length >= 6 && key.includes(token.slice(0, 3))) score += 1;
	}
	for (const permutation of tokenPermutations(tokens)) {
		const compact = permutation.join('');
		if (compact.length >= 8 && key.includes(compact)) score += compact.length * 2;
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
			output.push([...current]);
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
    .replace(/\b(colegiul|colegiul national|national|liceul|liceul teoretic|teoretic|de|din|municipiul|bucuresti|bucuresti|sectorul|sector)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoresClose(left, right) {
  return Math.abs(Number(left) - Number(right)) <= 0.05 + Number.EPSILON;
}

function usernameKey(value) {
  return nameKey(value).replaceAll(' ', '');
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
