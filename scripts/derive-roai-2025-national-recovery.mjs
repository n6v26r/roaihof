import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const checked = '2026-06-19';
const sourcesDir = path.join(root, 'data/sources/files');
const outputPath = path.join(root, 'data/manual/roai-2025-national-recovery.json');

const finalText = pdfText(path.join(sourcesDir, 'roai-2025-finale.pdf'));
const qualifiedText = [
  pdfText(path.join(sourcesDir, 'roai-2025-calificati-9-10.pdf')),
  pdfText(path.join(sourcesDir, 'roai-2025-calificati-11-12.pdf'))
].join('\n');
const scoresFile = JSON.parse(await fs.readFile(path.join(root, 'data/manual/roai-2025-national-scores.json'), 'utf8'));
const roaiFile = JSON.parse(await fs.readFile(path.join(root, 'data/manual/roai-2026-results.json'), 'utf8'));

const finalRows = parseFinalRows(finalText);
const finalByCode = new Map(finalRows.map((row) => [row.nationalCode, row]));
const scoredFinalRows = finalRows.filter((row) => !row.absent);
const qualifiedRows = parseQualifiedRows(qualifiedText);
const knownRows = roaiFile.national.filter((row) => Number(row.year || 2026) === 2025);
const knownByPlace = new Map(knownRows.map((row) => [row.place, row]));
const countyUsernameByCode = assignCountyUsernames(qualifiedRows);

const assigned = assignNationalCodes(qualifiedRows, finalRows);
validateKnownRows(knownRows, assigned, finalRows);
const nationalUsernameByCode = assignNationalUsernames(assigned, finalRows, scoresFile.scores, countyUsernameByCode);

const recovered = [];
const excluded = [];
for (const row of assigned) {
  const final = finalByCode.get(row.nationalCode);
  if (!final) {
    throw new Error(`missing final row for national code ${row.nationalCode}`);
  }
  if (final.absent) {
    excluded.push({
      nationalCode: row.nationalCode,
      grade: final.grade,
      ojiaGrade: row.ojiaGrade,
      ojiaCode: row.ojiaCode,
      name: row.name,
      school: row.school,
      county: row.county,
      ojiaTaskScores: row.ojiaTaskScores,
      ojiaScore: row.ojiaScore,
      reason: 'official national source marks the row absent'
    });
    continue;
  }

  const usernameMatch = nationalUsernameByCode.get(row.nationalCode);
  if (!usernameMatch) {
    throw new Error(`missing recovered Nitro username for national code ${row.nationalCode}`);
  }
  const known = knownByPlace.get(final.place);
  recovered.push({
    section: `Clasa ${final.grade}`,
    year: 2025,
    sourceId: known?.sourceId ?? sourceForGrade(final.grade),
    username: usernameMatch.username,
    nationalCode: row.nationalCode,
    ojiaGrade: row.ojiaGrade,
    ojiaCode: row.ojiaCode,
    name: row.name,
    grade: final.grade,
    school: row.school,
    county: row.county,
    place: final.place,
    score: final.total,
    scoreMax: usernameMatch.scoreMax,
    finalTaskScores: final.taskScores,
    ojiaTaskScores: row.ojiaTaskScores,
    ojiaScore: row.ojiaScore,
    prize: known?.prize ?? '',
    medal: known?.medal ?? '',
    status: final.grade === row.ojiaGrade ? '' : 'guest',
    evidence: [
      'national-anonymized-code',
      'qualified-list-alphabetical-code-order',
      ...usernameMatch.evidence
    ]
  });
}

recovered.sort((a, b) => a.place - b.place || a.name.localeCompare(b.name));
excluded.sort((a, b) => Number(a.nationalCode) - Number(b.nationalCode));

if (recovered.length !== scoredFinalRows.length) {
  throw new Error(`recovered scored rows = ${recovered.length}, want ${scoredFinalRows.length}`);
}
if (excluded.length !== finalRows.length - scoredFinalRows.length) {
  throw new Error(`excluded absent rows = ${excluded.length}, want ${finalRows.length - scoredFinalRows.length}`);
}

const output = {
  sources: [
    {
      id: 'roai-2025-national-anonymized-final',
      title: 'ROAI 2025 national anonymized final ranking PDF',
      url: 'https://olimpiada.nitro-ai.org/2025/onia/finale.pdf',
      accessedAt: checked,
      status: 'text-pdf'
    },
    {
      id: 'roai-2025-qualified-9-10',
      title: 'ROAI 2025 OJIA IX-X qualified list PDF',
      url: 'https://olimpiada.nitro-ai.org/2025/ojia/calificati-9-10.pdf',
      accessedAt: checked,
      status: 'text-pdf'
    },
    {
      id: 'roai-2025-qualified-11-12',
      title: 'ROAI 2025 OJIA XI-XII qualified list PDF',
      url: 'https://olimpiada.nitro-ai.org/2025/ojia/calificati-11-12.pdf',
      accessedAt: checked,
      status: 'text-pdf'
    },
    {
      id: 'roai-2025-county-9-10-judge',
      title: 'ROAI 2025 OJIA IX-X complete Nitro leaderboard',
      url: 'https://judge.nitro-ai.org/competitions/roai-2025/ojia-9-10/leaderboard/complete?page=1&page_size=100',
      accessedAt: checked,
      status: 'archived-html'
    },
    {
      id: 'roai-2025-county-11-12-judge',
      title: 'ROAI 2025 OJIA XI-XII complete Nitro leaderboard',
      url: 'https://judge.nitro-ai.org/competitions/roai-2025/ojia/leaderboard/complete?page=1&page_size=100',
      accessedAt: checked,
      status: 'archived-html'
    }
  ],
  note: 'Recovered ROAI 2025 national identities by assigning national anonymization codes alphabetically within each OJIA grade group from the official qualified lists. National usernames are joined by exact national task-score groups from the Nitro final leaderboard, with county-stage Nitro score/name evidence used only to resolve tied national username blocks. Official absent rows are excluded because they did not participate in the national contest.',
  national: recovered,
  excluded
};

await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${recovered.length} recovered national rows and ${excluded.length} excluded absent rows to ${outputPath}`);

function pdfText(filePath) {
  const result = spawnSync('pdftotext', ['-layout', filePath, '-'], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0 && !result.stdout) {
    throw new Error(`${filePath}: pdftotext failed: ${result.stderr || result.error?.message || result.status}`);
  }
  return result.stdout;
}

function parseFinalRows(text) {
  const rows = [];
  for (const line of text.split(/\n/)) {
    let match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/);
    if (match) {
      rows.push({
        place: Number(match[1]),
        nationalCode: match[2],
        grade: match[3],
        taskScores: [Number(match[4]), Number(match[5])],
        total: Number(match[6]),
        absent: false
      });
      continue;
    }
    match = line.match(/^\s*-\s+(\d+)\s+(\d+)\s+absent\s*$/);
    if (match) {
      rows.push({
        place: 0,
        nationalCode: match[1],
        grade: match[2],
        taskScores: [],
        total: 0,
        absent: true
      });
    }
  }
  if (rows.length === 0) {
    throw new Error('no rows parsed from ROAI 2025 final anonymized PDF');
  }
  return rows;
}

function parseQualifiedRows(text) {
  const rows = [];
  for (const line of text.split(/\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+([A-Z]+(?:-S\d+)?-\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s*$/u);
    if (!match) continue;

    const beforeScores = match[4];
    const countyRaw = extractCounty(beforeScores);
    const county = cleanHuman(countyRaw);
    const beforeCounty = beforeScores.slice(0, beforeScores.lastIndexOf(countyRaw)).trimEnd();
    const schoolStart = schoolStartIndex(beforeCounty);
    if (schoolStart < 0) {
      throw new Error(`could not split qualified row school: ${line}`);
    }

    const namePart = beforeCounty.slice(0, schoolStart).trimEnd();
    const paddedName = namePart.match(/^(.+?)\s{2,}(.+)$/u);
    const last = cleanHuman(paddedName ? paddedName[1] : namePart.slice(0, 19));
    const first = cleanHuman(paddedName ? paddedName[2] : namePart.slice(19));
    const school = cleanHuman(beforeCounty.slice(schoolStart));
    if (!last || !first || !school || !county) {
      throw new Error(`invalid qualified row: ${line}`);
    }

    rows.push({
      grade: match[1],
      ojiaGrade: match[2],
      ojiaCode: match[3],
      name: cleanQualifiedName(`${last} ${first}`),
      school,
      county,
      ojiaTaskScores: [Number(match[5]), Number(match[6])],
      ojiaScore: Number(match[7]),
      raw: cleanHuman(beforeScores)
    });
  }
  if (rows.length === 0) {
    throw new Error('no rows parsed from ROAI 2025 qualified PDFs');
  }
  return rows;
}

function assignNationalCodes(qualifiedRows, finalRows) {
  const codesByGroup = new Map();
  for (const row of finalRows) {
    const group = String(Math.floor(Number(row.nationalCode) / 100));
    if (!codesByGroup.has(group)) {
      codesByGroup.set(group, []);
    }
    codesByGroup.get(group).push(row.nationalCode);
  }
  for (const codes of codesByGroup.values()) {
    codes.sort((a, b) => Number(a) - Number(b));
  }

  const assigned = [];
  for (const [group, codes] of codesByGroup) {
    const rows = qualifiedRows
      .filter((row) => row.ojiaGrade === group)
      .sort((a, b) => nameKey(a.name).localeCompare(nameKey(b.name)));
    if (rows.length !== codes.length) {
      throw new Error(`qualified rows for OJIA grade ${group} = ${rows.length}, national codes = ${codes.length}`);
    }
    rows.forEach((row, index) => {
      assigned.push({ ...row, nationalCode: codes[index] });
    });
  }
  return assigned;
}

function validateKnownRows(knownRows, assignedRows, finalRows) {
  const codeByName = new Map(assignedRows.map((row) => [nameKey(row.name), row.nationalCode]));
  const finalCodeByPlace = new Map(finalRows.filter((row) => !row.absent).map((row) => [row.place, row.nationalCode]));
  const mismatches = [];
  for (const row of knownRows) {
    const expected = finalCodeByPlace.get(row.place);
    const actual = codeByName.get(nameKey(row.name));
    if (expected !== actual) {
      mismatches.push(`${row.name}: place ${row.place} expected ${expected}, got ${actual}`);
    }
  }
  if (mismatches.length > 0) {
    throw new Error(`known ROAI 2025 class rows do not match derived code order:\n${mismatches.join('\n')}`);
  }
}

function assignCountyUsernames(qualifiedRows) {
  const sections = [
    {
      rows: qualifiedRows.filter((row) => row.ojiaGrade === '9' || row.ojiaGrade === '10'),
      leaderboard: parseJudgeLeaderboard([
        path.join(sourcesDir, 'roai-2025-county-9-10-judge-page1.html'),
        path.join(sourcesDir, 'roai-2025-county-9-10-judge-page2.html'),
        path.join(sourcesDir, 'roai-2025-county-9-10-judge-page3.html')
      ])
    },
    {
      rows: qualifiedRows.filter((row) => row.ojiaGrade === '11' || row.ojiaGrade === '12'),
      leaderboard: parseJudgeLeaderboard([
        path.join(sourcesDir, 'roai-2025-county-11-12-judge-page1.html'),
        path.join(sourcesDir, 'roai-2025-county-11-12-judge-page2.html')
      ])
    }
  ];

  const usernames = new Map();
  for (const section of sections) {
    const byScore = groupBy(section.rows, (row) => scoreKey(row.ojiaTaskScores, row.ojiaScore));
    const usersByScore = groupBy(section.leaderboard, (row) => scoreKey(row.taskScores, row.score));
    for (const [key, rows] of byScore) {
      const users = usersByScore.get(key) ?? [];
      const used = new Set();

      if (rows.length === 1 && users.length === 1) {
        usernames.set(rows[0].ojiaCode, {
          username: users[0].username,
          evidence: 'county-score-unique'
        });
        continue;
      }

      const matches = [];
      for (const row of rows) {
        for (const user of users) {
          matches.push({
            row,
            user,
            score: usernameNameScore(row.name, user.username)
          });
        }
      }
      matches.sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));
      for (const match of matches) {
        if (match.score < 35 || usernames.has(match.row.ojiaCode) || used.has(match.user.username)) {
          continue;
        }
        usernames.set(match.row.ojiaCode, {
          username: match.user.username,
          evidence: `county-score-name-similarity:${match.score}`
        });
        used.add(match.user.username);
      }
    }
  }
  return usernames;
}

function assignNationalUsernames(assignedRows, finalRows, nationalScores, countyUsernameByCode) {
  const assignedByCode = new Map(assignedRows.map((row) => [row.nationalCode, row]));
  const scoredRows = finalRows
    .filter((row) => !row.absent)
    .map((row) => ({ ...assignedByCode.get(row.nationalCode), final: row }));
  const byScore = groupBy(scoredRows, (row) => scoreKey(row.final.taskScores, row.final.total));
  const usersByScore = groupBy(nationalScores, (row) => scoreKey(row.taskScores, row.score));
  const usernames = new Map();
  const unresolved = [];

  for (const [key, rows] of byScore) {
    const users = usersByScore.get(key) ?? [];
    if (users.length !== rows.length) {
      throw new Error(`national Nitro score group ${key} has ${users.length} usernames and ${rows.length} anonymized rows`);
    }

    const used = new Set();
    for (const row of rows) {
      const county = countyUsernameByCode.get(row.ojiaCode);
      if (!county || used.has(county.username) || !users.some((user) => user.username === county.username)) {
        continue;
      }
      const user = users.find((candidate) => candidate.username === county.username);
      usernames.set(row.nationalCode, {
        username: user.username,
        scoreMax: user.scoreMax,
        evidence: [`${county.evidence};national-score-group`]
      });
      used.add(user.username);
    }

    if (rows.length === 1 && users.length === 1 && !usernames.has(rows[0].nationalCode)) {
      usernames.set(rows[0].nationalCode, {
        username: users[0].username,
        scoreMax: users[0].scoreMax,
        evidence: ['national-score-unique']
      });
      used.add(users[0].username);
    }

    const matches = [];
    for (const row of rows) {
      for (const user of users) {
        matches.push({
          row,
          user,
          score: usernameNameScore(row.name, user.username)
        });
      }
    }
    matches.sort((a, b) => b.score - a.score || a.row.name.localeCompare(b.row.name));
    for (const match of matches) {
      if (match.score < 35 || usernames.has(match.row.nationalCode) || used.has(match.user.username)) {
        continue;
      }
      usernames.set(match.row.nationalCode, {
        username: match.user.username,
        scoreMax: match.user.scoreMax,
        evidence: [`national-score-name-similarity:${match.score}`]
      });
      used.add(match.user.username);
    }

    const remainingRows = rows.filter((row) => !usernames.has(row.nationalCode));
    const remainingUsers = users.filter((user) => !used.has(user.username));
    if (remainingRows.length === 1 && remainingUsers.length === 1) {
      usernames.set(remainingRows[0].nationalCode, {
        username: remainingUsers[0].username,
        scoreMax: remainingUsers[0].scoreMax,
        evidence: ['national-score-last-remaining']
      });
      used.add(remainingUsers[0].username);
      continue;
    }
    if (remainingRows.length > 0) {
      unresolved.push({
        score: key,
        rows: remainingRows.map((row) => `${row.nationalCode} ${row.name}`),
        usernames: remainingUsers.map((user) => user.username)
      });
    }
  }

  if (unresolved.length > 0) {
    throw new Error(`could not resolve ROAI 2025 national username groups:\n${JSON.stringify(unresolved, null, 2)}`);
  }
  return usernames;
}

function parseJudgeLeaderboard(files) {
  const rows = [];
  const rowPattern = /<div class="flex center flex-col"><p>(\d+)<\/p><\/div><div class="flex center"><p class="text-sm mr-2">@<!-- -->([^<]+)<\/p><\/div><div class="flex center">(\d+)<!-- --> \/ 100<\/div><div class="flex center">(\d+)<!-- --> \/ 100<\/div><div class="flex center">(\d+)<!-- --> \/ <!-- -->200<\/div>/g;
  for (const file of files) {
    let html = '';
    try {
      html = fsSync.readFileSync(file, 'utf8');
    } catch (error) {
      throw new Error(`${file}: could not read archived Nitro leaderboard: ${error instanceof Error ? error.message : error}`);
    }
    let match;
    while ((match = rowPattern.exec(html))) {
      rows.push({
        rank: Number(match[1]),
        username: match[2],
        taskScores: [Number(match[3]), Number(match[4])],
        score: Number(match[5])
      });
    }
  }
  return rows;
}

function groupBy(values, keyFunc) {
  const grouped = new Map();
  for (const value of values) {
    const key = keyFunc(value);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(value);
  }
  return grouped;
}

function scoreKey(taskScores, total) {
  return `${taskScores[0]}/${taskScores[1]}/${total}`;
}

function usernameNameScore(name, username) {
  const usernameNormalized = usernameKey(username);
  const tokens = nameKey(name).split(' ').filter(Boolean);
  let score = 0;

  for (const token of tokens) {
    if (usernameNormalized === token) {
      score += 100 + token.length;
    }
    if (token.length >= 3 && usernameNormalized.includes(token)) {
      score += 70 + token.length;
    }
    if (token.length >= 4 && token.includes(usernameNormalized)) {
      score += 25;
    }
    if (token.length >= 4 && usernameNormalized.includes(token.slice(0, 5))) {
      score += 10;
    }
  }

  const joined = tokens.join('');
  const reversed = [...tokens].reverse().join('');
  if (usernameNormalized === joined || usernameNormalized === reversed) {
    score += 220;
  }
  if (joined.includes(usernameNormalized) || reversed.includes(usernameNormalized)) {
    score += 35;
  }
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = 0; j < tokens.length; j += 1) {
      if (i === j) continue;
      const left = tokens[i];
      const right = tokens[j];
      for (const pattern of [left + right[0], left[0] + right]) {
        if (usernameNormalized === pattern) {
          score += 180;
        }
        if (pattern.length >= 4 && usernameNormalized.startsWith(pattern)) {
          score += 50;
        }
      }
    }
  }
  return score;
}

function sourceForGrade(grade) {
  return 'roai-2025-national-anonymized-final';
}

function schoolStartIndex(value) {
  const match = value.match(/\b(Colegiul|Liceul|Școala|Scoala|Teleorman)\b/u);
  return match?.index ?? -1;
}

function extractCounty(value) {
  const counties = [
    'București, sector 1',
    'București, sector 2',
    'București, sector 3',
    'București, sector 4',
    'București, sector 5',
    'București, sector 6',
    'Bistriţa-Năsăud',
    'Caraş-Severin',
    'Constanţa',
    'Covasna',
    'Dâmboviţa',
    'Harghita',
    'Ialomiţa',
    'Maramureş',
    'Mehedinţi',
    'Satu Mare',
    'Teleorman',
    'Suceava',
    'Prahova',
    'Vrancea',
    'Giurgiu',
    'Călăraşi',
    'Botoşani',
    'Hunedoara',
    'Ilfov',
    'Vâlcea',
    'Vaslui',
    'Braşov',
    'Brăila',
    'Bihor',
    'Argeş',
    'Alba',
    'Sălaj',
    'Timiş',
    'Tulcea',
    'Galaţi',
    'Mureş',
    'Buzău',
    'Bacău',
    'Dolj',
    'Cluj',
    'Gorj',
    'Sibiu',
    'Neamţ',
    'Olt',
    'Arad',
    'Iaşi'
  ].sort((a, b) => b.length - a.length);
  const trimmed = value.trimEnd();
  const county = counties.find((item) => trimmed.endsWith(item));
  if (!county) {
    throw new Error(`could not extract county from ${JSON.stringify(value)}`);
  }
  return county;
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

function usernameKey(value) {
  return nameKey(value).replaceAll(' ', '');
}

function cleanHuman(value) {
  return String(value ?? '')
    .replace(/[“”„]/g, '"')
    .replace(/''/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/Ţ/g, 'Ț')
    .replace(/ţ/g, 'ț')
    .replace(/Ş/g, 'Ș')
    .replace(/ş/g, 'ș')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanQualifiedName(value) {
  const cleaned = cleanHuman(value);
  const corrections = new Map([
    ['Durduman-Burtescu T udor', 'Durduman-Burtescu Tudor']
  ]);
  return corrections.get(cleaned) ?? cleaned;
}
