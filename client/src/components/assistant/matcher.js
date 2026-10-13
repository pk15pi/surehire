import { INTENTS, SYNONYMS } from './knowledgeBase.js';

// Low-information words: still matched, but with reduced weight.
const WEAK = new Set(['how', 'what', 'who', 'why', 'kya', 'want', 'help', 'work', 'new', 'job', 'company',
  'candidate', 'send', 'process', 'about', 'find', 'call', 'type', 'size', 'level', 'free', 'text', 'message', 'chat']);
const STOP = new Set(['a', 'an', 'the', 'is', 'are', 'am', 'i', 'me', 'my', 'you', 'your', 'to', 'for', 'of', 'in', 'on',
  'and', 'or', 'do', 'does', 'can', 'could', 'please', 'pls', 'plz', 'it', 'this', 'that', 'with', 'be', 'we', 'us',
  'hai', 'ho', 'ka', 'ki', 'ke', 'ko', 'se', 'mai', 'main', 'mein', 'me', 'kar', 'karo', 'kare', 'karna', 'raha', 'rahe']);

export const normalize = (s) => String(s || '').toLowerCase()
  .replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const stem = (w) => {
  if (w.length <= 4) return w;
  if (w.endsWith('ies') && w.length > 5) return w.slice(0, -3) + 'y';
  if (w.endsWith('ing') && w.length > 6) return w.slice(0, -3);
  if (w.endsWith('ed') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('es') && w.length > 5) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
};
export const canon = (w) => SYNONYMS[w] || SYNONYMS[stem(w)] || stem(w);

export const levenshtein = (a, b, max = 2) => {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  // Optimal string alignment distance: insertions, deletions, substitutions and adjacent transpositions.
  let prev2 = null;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
};

// Precompute canonical keyword sets.
const COMPILED = INTENTS.map((it) => ({
  intent: it,
  keys: new Set((it.keywords || []).map((k) => canon(normalize(k)))),
  phrases: (it.phrases || []).map(normalize),
  canonPhrases: (it.phrases || []).map((p) => normalize(p).split(' ').map(canon).join(' ')),
}));
const VOCAB = new Set([...COMPILED.flatMap((c) => [...c.keys]), ...Object.keys(SYNONYMS)]);

// Map a token to its canonical form, using typo tolerance for longer words.
const resolveToken = (t) => {
  const c = canon(t);
  if (VOCAB.has(c) || VOCAB.has(t) || t.length < 5) return { tok: SYNONYMS[t] || c, fuzzy: false };
  const max = t.length >= 8 ? 2 : 1;
  let best = null; let bestD = max + 1;
  for (const v of VOCAB) {
    if (v.length < 4) continue;
    const d = levenshtein(t, v, max);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best ? { tok: SYNONYMS[best] || canon(best), fuzzy: true } : { tok: c, fuzzy: false };
};

// 0.8 lets a single typo'd strong keyword (e.g. "industires") match; weak words alone (0.5) still fall back.
export const THRESHOLD = 0.8;

export function match(query) {
  const norm = normalize(query);
  if (!norm) return { intent: null, score: 0, ranked: [] };
  const raw = norm.split(' ').filter((t) => t && !STOP.has(t));
  const resolved = raw.map(resolveToken);
  const canonText = ' ' + norm.split(' ').map((t) => resolveToken(t).tok).join(' ') + ' ';
  const padded = ' ' + norm + ' ';

  const ranked = COMPILED.map(({ intent, keys, phrases, canonPhrases }) => {
    let score = 0;
    const seen = new Set();
    for (const { tok, fuzzy } of resolved) {
      if (seen.has(tok) || !keys.has(tok)) continue;
      seen.add(tok);
      score += (WEAK.has(tok) ? 0.5 : 1) * (fuzzy ? 0.8 : 1);
    }
    phrases.forEach((p, i) => {
      if (padded.includes(' ' + p + ' ') || canonText.includes(' ' + canonPhrases[i] + ' ')) score += 2 + p.split(' ').length * 0.5;
    });
    return { intent, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);

  const top = ranked[0];
  return top && top.score >= THRESHOLD
    ? { intent: top.intent, score: top.score, ranked }
    : { intent: null, score: top ? top.score : 0, ranked };
}

export const getIntent = (id) => INTENTS.find((i) => i.id === id);
