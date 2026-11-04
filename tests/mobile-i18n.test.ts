import { test } from "node:test";
import assert from "node:assert/strict";
import { translations } from "../src/lib/i18n";

test("i18n: English and Telugu dictionary key parity", () => {
  const enKeys = Object.keys(translations.en);
  const teKeys = Object.keys(translations.te);

  assert.ok(enKeys.length > 100, `Expected >100 English keys, got ${enKeys.length}`);
  assert.ok(teKeys.length > 100, `Expected >100 Telugu keys, got ${teKeys.length}`);

  const missingInTe = enKeys.filter(k => !(k in translations.te));
  assert.deepEqual(missingInTe, [], `Missing Telugu translations for keys: ${missingInTe.join(", ")}`);

  const missingInEn = teKeys.filter(k => !(k in translations.en));
  assert.deepEqual(missingInEn, [], `Missing English translations for keys: ${missingInEn.join(", ")}`);
});

test("i18n: Telugu script verification", () => {
  // Telugu Unicode block is \u0C00-\u0C7F
  const teluguRegex = /[\u0C00-\u0C7F]/;

  const sampleTeluguKeys = ["brand", "home", "directory", "ghats", "restaurants", "heroTitle"];
  for (const key of sampleTeluguKeys) {
    const text = (translations.te as any)[key];
    assert.ok(text, `Telugu text missing for key ${key}`);
    assert.ok(teluguRegex.test(text), `Telugu text for '${key}' does not contain valid Telugu script: "${text}"`);
  }
});

test("i18n: No empty string translations", () => {
  for (const [key, val] of Object.entries(translations.en)) {
    assert.ok(typeof val === "string" && val.trim().length > 0, `English key '${key}' has empty translation`);
  }
  for (const [key, val] of Object.entries(translations.te)) {
    assert.ok(typeof val === "string" && val.trim().length > 0, `Telugu key '${key}' has empty translation`);
  }
});
