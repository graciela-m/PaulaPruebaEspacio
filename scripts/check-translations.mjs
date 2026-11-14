import { readFileSync } from 'node:fs';

const read = (file) => JSON.parse(readFileSync(new URL(`../src/data/${file}.json`, import.meta.url), 'utf8'));
const spanish = read('locales/es');
const english = read('locales/en');
const missing = [];

function compareKeys(source, target, path = '') {
  for (const [key, value] of Object.entries(source)) {
    const fullPath = path ? `${path}.${key}` : key;
    if (path === '' && key === 'galleryCaptions') continue;
    if (target?.[key] === undefined || target[key] === null || target[key] === '') {
      missing.push(fullPath);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      compareKeys(value, target[key], fullPath);
    }
  }
}

compareKeys(spanish, english);
compareKeys(english, spanish);
const stories = read('intro-story').messages;
for (const story of stories) {
  if (!spanish.story.messages[story.id] || !english.story.messages[story.id]) missing.push(`story.messages.${story.id}`);
}

const groups = [
  [read('planets').objects, ['name', 'description', 'observationHistory', 'characteristics', 'interestingFact']],
  [read('moons').objects, ['name', 'description', 'discoveryHistory', 'scientificImportance']],
  [read('equipment').records, ['name', 'description', 'mission', 'destination', 'objective', 'discoveries', 'operationalStatus', 'whyRemains', 'scientificLegacy', 'realLocation']],
  [[read('sun')], ['name', 'description', 'observationHistory', 'characteristics', 'interestingFact']],
];
for (const [records, fields] of groups) {
  for (const record of records) {
    for (const field of fields) {
      if (!record[field] || !record.translations?.en?.[field]) missing.push(`${record.id}.${field}`);
    }
  }
}
const assets = read('assets').images;
for (const record of groups.flatMap(([records]) => records)) {
  for (const item of record.gallery ?? []) {
    const asset = assets.find((entry) => entry.id === item.assetId);
    if (!asset || !spanish.galleryCaptions?.[item.assetId] || !asset.title) missing.push(`gallery.${item.assetId}`);
  }
}
if (missing.length) {
  console.error(`Missing translations: ${missing.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log('Translation keys, stories, object fields and gallery captions are complete.');
}