/*
 * 反骨小猫 — deterministic question engine.
 *
 * This file intentionally has no DOM dependencies: the browser UI can import
 * createRun and render the returned question object however it likes.
 */

const TYPES = ["side", "size", "number", "color", "count", "word"];
const COLORS = ["red", "blue", "yellow", "purple"];

function hashString(input) {
  // FNV-1a gives us a small, stable seed without relying on platform crypto.
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function intBetween(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function choose(random, values) {
  return values[Math.floor(random() * values.length)];
}

/**
 * Normalize a user/share seed into a short, stable identifier.
 * Punctuation is converted to dashes so it is safe in a URL fragment.
 */
export function normalizeSeed(value) {
  const raw = String(value ?? "").normalize("NFKD");
  let normalized = raw
    .replace(/[^\x00-\x7F]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!normalized) {
    // A hash preserves determinism even for an all-Unicode seed.
    const source = raw || "REBEL-CAT";
    normalized = `S${hashString(source).toString(36).toUpperCase()}`;
  }
  return normalized;
}

/** Return a globally stable seed for a calendar day (YYYY-MM-DD). */
export function dailySeed(date) {
  let key;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    key = date.replaceAll("-", "");
  } else {
    const parsed = date instanceof Date ? date : date == null ? new Date() : new Date(date);
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(safeDate);
    key = ["year", "month", "day"].map((type) => parts.find((part) => part.type === type).value).join("");
  }
  return `RC-DAILY-${key}`;
}

/** Create a shareable random seed. */
export function newSeed() {
  const bytes = new Uint32Array(2);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    bytes[0] = Math.floor(Math.random() * 0x100000000) >>> 0;
    bytes[1] = Date.now() >>> 0;
  }
  return `RC-${bytes[0].toString(36).toUpperCase()}${bytes[1].toString(36).toUpperCase()}`;
}

function orderedPair(random, correct, wrong) {
  const options = [correct, wrong];
  if (random() < 0.5) options.reverse();
  return {
    options,
    correctIndex: options[0] === correct ? 0 : 1,
  };
}

function makeSide(random) {
  const target = random() < 0.5 ? "左边" : "右边";
  const opposite = target === "左边" ? "右边" : "左边";
  return {
    type: "side", prompt: `点${target}！`, hint: "注意左右位置。",
    options: [
      { id: "a", label: "左边", kind: "direction", value: "left" },
      { id: "b", label: "右边", kind: "direction", value: "right" },
    ],
    correctIndex: target === "左边" ? 1 : 0,
    explanation: `命令叫你点${target}，所以应该点${opposite}。`,
  };
}

function makeSize(random) {
  const targetBig = random() < 0.5;
  const small = { label: "小猫", kind: "cat", value: "cat", size: "small" };
  const large = { label: "大猫", kind: "cat", value: "cat", size: "large" };
  return {
    type: "size", prompt: `点${targetBig ? "大" : "小"}的猫！`, hint: "只比较猫的大小。",
    ...orderedPair(random, targetBig ? small : large, targetBig ? large : small),
    explanation: `命令要${targetBig ? "大" : "小"}猫，所以选${targetBig ? "小" : "大"}猫。`,
  };
}

function makeNumber(random, round) {
  const low = intBetween(random, round >= 6 ? 10 : 2, round >= 6 ? 50 : 9);
  const high = low + intBetween(random, 1, round >= 6 ? 8 : 4);
  const targetBig = random() < 0.5;
  const lowOption = { label: `${low}`, kind: "number", value: low };
  const highOption = { label: `${high}`, kind: "number", value: high };
  return {
    type: "number", prompt: `点数字${targetBig ? "大" : "小"}的！`, hint: "只比较数字大小。",
    ...orderedPair(random, targetBig ? lowOption : highOption, targetBig ? highOption : lowOption),
    explanation: `命令要${targetBig ? "大" : "小"}的数字，所以应选 ${targetBig ? low : high}。`,
  };
}

function makeColor(random) {
  const targetRed = random() < 0.5;
  const blue = { label: "蓝色", kind: "color", value: "blue", color: "blue" };
  const red = { label: "红色", kind: "color", value: "red", color: "red" };
  return {
    type: "color", prompt: `点${targetRed ? "红" : "蓝"}色！`, hint: "看色块的颜色。",
    ...orderedPair(random, targetRed ? blue : red, targetRed ? red : blue),
    explanation: `只有两个选项，避开${targetRed ? "红" : "蓝"}色即可。`,
  };
}

function makeCount(random, round) {
  const low = intBetween(random, 1, round >= 6 ? 3 : 2);
  const high = low + intBetween(random, 1, round >= 6 ? 3 : 2);
  const targetMore = random() < 0.5;
  const lowOption = { label: `${low}只猫`, kind: "count", value: low, count: low };
  const highOption = { label: `${high}只猫`, kind: "count", value: high, count: high };
  return {
    type: "count", prompt: `点猫${targetMore ? "多" : "少"}的！`, hint: "数一数有几只猫。",
    ...orderedPair(random, targetMore ? lowOption : highOption, targetMore ? highOption : lowOption),
    explanation: `命令要猫${targetMore ? "多" : "少"}的，所以选 ${targetMore ? low : high} 只。`,
  };
}

function makeWord(random) {
  const targetRed = random() < 0.5;
  const blue = { label: "蓝", kind: "word", value: "蓝", color: choose(random, COLORS.filter(color => color !== "blue")) };
  const red = { label: "红", kind: "word", value: "红", color: choose(random, COLORS.filter(color => color !== "red")) };
  return {
    type: "word", prompt: `点写着「${targetRed ? "红" : "蓝"}」的！`, hint: "看文字，不看字的颜色。",
    ...orderedPair(random, targetRed ? blue : red, targetRed ? red : blue),
    explanation: `避开「${targetRed ? "红" : "蓝"}」字，选「${targetRed ? "蓝" : "红"}」字。`,
  };
}

/**
 * Start a deterministic run. Calling next repeatedly generates a 30-second
 * ready stream; the UI owns the timer and can stop after 30 seconds.
 */
export function createRun(seed = dailySeed()) {
  const normalized = normalizeSeed(seed);
  const random = mulberry32(hashString(normalized));
  let index = 0;
  let previousType = null;
  let bag = [];
  function nextType() {
    if (index < 3) return TYPES[index];
    if (!bag.length) {
      bag = [...TYPES];
      for (let i = bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag[0] === previousType) [bag[0], bag[1]] = [bag[1], bag[0]];
    }
    return bag.shift();
  }
  return {
    next() {
      const type = nextType();
      previousType = type;
      const builders = { side: makeSide, size: makeSize, number: makeNumber, color: makeColor, count: makeCount, word: makeWord };
      const question = builders[type](random, index);
      const result = {
        id: `${normalized}-Q${index + 1}`,
        type: question.type,
        prompt: question.prompt,
        hint: question.hint,
        options: question.options.map((option, optionIndex) => ({ ...option, id: optionIndex === 0 ? "a" : "b" })),
        correctIndex: question.correctIndex,
        explanation: question.explanation,
      };
      index += 1;
      return result;
    },
  };
}

/** Score a correct answer, given the combo count before this answer. */
export function scoreAnswer(combo = 0) {
  const previous = Number.isFinite(Number(combo)) ? Math.max(0, Math.floor(Number(combo))) : 0;
  const nextCombo = previous + 1;
  const bonus = Math.min(10, Math.floor(nextCombo / 3) * 2);
  return { points: 10 + bonus, nextCombo };
}

/** Honest score bands; no percentile claims are implied. */
export function getRank(score = 0) {
  const value = Number.isFinite(Number(score)) ? Math.max(0, Number(score)) : 0;
  if (value >= 150) return { name: "反骨传说", emoji: "👑", description: "你已经把反着来练成了本能。" };
  if (value >= 80) return { name: "逆向高手", emoji: "🐾", description: "每一步都踩在命令的反方向。" };
  if (value >= 30) return { name: "反骨学徒", emoji: "😼", description: "反应越来越快，继续保持这股猫劲。" };
  return { name: "新手猫", emoji: "🐱", description: "先记住秘诀：听到什么，就选相反的。" };
}

export { TYPES };

