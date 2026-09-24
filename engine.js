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
    key = safeDate.toISOString().slice(0, 10).replaceAll("-", "");
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

function makeSide(random, round) {
  const target = round % 2 === 0 ? "左边" : "右边";
  const opposite = target === "左边" ? "右边" : "左边";
  const pair = orderedPair(
    random,
    { id: "a", label: opposite, kind: "direction", value: opposite === "左边" ? "left" : "right" },
    { id: "b", label: target, kind: "direction", value: target === "左边" ? "left" : "right" },
  );
  return {
    type: "side",
    prompt: `点${target}！`,
    hint: "反着来：选择命令相反的一边。",
    ...pair,
    explanation: `命令叫你点${target}，所以正确答案是${opposite}。`,
  };
}

function makeSize(random, round) {
  const correctSize = "small";
  const pair = orderedPair(
    random,
    { id: "a", label: "小猫", kind: "cat", value: "cat", size: correctSize },
    { id: "b", label: "大猫", kind: "cat", value: "cat", size: "large" },
  );
  return {
    type: "size",
    prompt: round % 2 ? "点大的猫！" : "点最大那只猫！",
    hint: "猫猫也要反着选：请选小猫。",
    ...pair,
    explanation: "命令要求大的，反骨规则要选小猫。",
  };
}

function makeNumber(random, round) {
  const floor = round >= 6 ? 10 : 2;
  const left = intBetween(random, floor, floor + (round >= 6 ? 15 : 7));
  const gap = intBetween(random, 1, round >= 6 ? 8 : 4);
  const low = left;
  const high = left + gap;
  const lowOption = { id: "a", label: `${low}`, kind: "number", value: low };
  const highOption = { id: "b", label: `${high}`, kind: "number", value: high };
  const pair = orderedPair(random, lowOption, highOption);
  return {
    type: "number",
    prompt: "点数字大的！",
    hint: "只看数字：反着选较小的那个。",
    ...pair,
    explanation: `命令要大的数字（${high}），所以应选较小的 ${low}。`,
  };
}

function makeColor(random) {
  const correct = { id: "a", label: "蓝色", kind: "color", value: "blue", color: "blue" };
  const wrong = { id: "b", label: "红色", kind: "color", value: "red", color: "red" };
  const pair = orderedPair(random, correct, wrong);
  return {
    type: "color",
    prompt: "点红色！",
    hint: "命令说红色，反着选蓝色。",
    ...pair,
    explanation: "红色的反面是蓝色，所以选蓝色。",
  };
}

function makeCount(random, round) {
  const low = intBetween(random, 1, round >= 6 ? 3 : 2);
  const high = low + intBetween(random, 1, round >= 6 ? 4 : 2);
  const lowOption = { id: "a", label: `${low}只猫`, kind: "count", value: low, count: low };
  const highOption = { id: "b", label: `${high}只猫`, kind: "count", value: high, count: high };
  const pair = orderedPair(random, lowOption, highOption);
  return {
    type: "count",
    prompt: "点猫多的！",
    hint: "反着来：选择猫更少的选项。",
    ...pair,
    explanation: `命令要猫多的（${high}只），所以正确是较少的 ${low}只。`,
  };
}

function makeWord(random, round) {
  // The ink is deliberately independent from the character. The prompt says
  // to judge the written word, so a renderer must use value rather than color.
  const blueInk = choose(random, COLORS.filter((color) => color !== "blue"));
  const redInk = choose(random, COLORS.filter((color) => color !== "red"));
  const correct = { id: "a", label: "蓝", kind: "word", value: "蓝", color: blueInk };
  const wrong = { id: "b", label: "红", kind: "word", value: "红", color: redInk };
  const pair = orderedPair(random, correct, wrong);
  return {
    type: "word",
    prompt: round % 2 ? "点写着「红」的！" : "找出写着「红」的选项！",
    hint: "只认字，不认墨水颜色；反着选写着「蓝」的。",
    ...pair,
    explanation: "命令指定了「红」字，反骨答案是写着「蓝」的选项，墨水颜色不影响判断。",
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
  return {
    next() {
      const type = TYPES[index % TYPES.length]; // first question is always side
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

