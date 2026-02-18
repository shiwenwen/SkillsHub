/**
 * i18n Key Consistency Checker
 *
 * Validates that all locale files have exactly the same keys as the English baseline.
 * Reports missing keys, extra keys, and untranslated values (same as English).
 *
 * Usage: npx tsx scripts/check-i18n.ts
 */

import { en } from "../src/locales/en";
import { zh } from "../src/locales/zh";
import { ja } from "../src/locales/ja";
import { ko } from "../src/locales/ko";
import { fr } from "../src/locales/fr";
import { de } from "../src/locales/de";
import { es } from "../src/locales/es";
import { pt } from "../src/locales/pt";
import { ru } from "../src/locales/ru";

type NestedRecord = { [key: string]: string | NestedRecord };

const locales: Record<string, NestedRecord> = {
    zh: zh as unknown as NestedRecord,
    ja: ja as unknown as NestedRecord,
    ko: ko as unknown as NestedRecord,
    fr: fr as unknown as NestedRecord,
    de: de as unknown as NestedRecord,
    es: es as unknown as NestedRecord,
    pt: pt as unknown as NestedRecord,
    ru: ru as unknown as NestedRecord,
};

function flattenKeys(
    obj: NestedRecord,
    prefix = ""
): Map<string, string> {
    const result = new Map<string, string>();
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "string") {
            result.set(fullKey, value);
        } else {
            for (const [k, v] of flattenKeys(value, fullKey)) {
                result.set(k, v);
            }
        }
    }
    return result;
}

const enKeys = flattenKeys(en as unknown as NestedRecord);
let hasErrors = false;
let totalMissing = 0;
let totalExtra = 0;
let totalUntranslated = 0;

for (const [lang, translations] of Object.entries(locales)) {
    const langKeys = flattenKeys(translations);
    const missing: string[] = [];
    const extra: string[] = [];
    const untranslated: string[] = [];

    for (const key of enKeys.keys()) {
        if (!langKeys.has(key)) {
            missing.push(key);
        } else if (langKeys.get(key) === enKeys.get(key)) {
            // Same value as English - might be untranslated
            // Skip common/technical terms that are expected to be the same
            const skipPatterns = [/skill/i, /hub/i, /^common\.(version|sync)$/];
            if (!skipPatterns.some((p) => p.test(key) || p.test(langKeys.get(key)!))) {
                untranslated.push(key);
            }
        }
    }

    for (const key of langKeys.keys()) {
        if (!enKeys.has(key)) {
            extra.push(key);
        }
    }

    if (missing.length > 0 || extra.length > 0) {
        hasErrors = true;
    }

    totalMissing += missing.length;
    totalExtra += extra.length;
    totalUntranslated += untranslated.length;

    // Report
    const status = missing.length === 0 && extra.length === 0 ? "OK" : "FAIL";
    const details = [];
    if (missing.length > 0) details.push(`${missing.length} missing`);
    if (extra.length > 0) details.push(`${extra.length} extra`);
    if (untranslated.length > 0)
        details.push(`${untranslated.length} possibly untranslated`);

    console.log(
        `  [${status}] ${lang}: ${langKeys.size}/${enKeys.size} keys${details.length > 0 ? ` (${details.join(", ")})` : ""}`
    );

    if (missing.length > 0) {
        for (const key of missing) {
            console.log(`        - missing: ${key}`);
        }
    }
    if (extra.length > 0) {
        for (const key of extra) {
            console.log(`        + extra:   ${key}`);
        }
    }
}

console.log("");
console.log(
    `Summary: ${enKeys.size} baseline keys (en), ${Object.keys(locales).length} languages checked`
);
if (totalMissing > 0) console.log(`  Missing: ${totalMissing} total`);
if (totalExtra > 0) console.log(`  Extra:   ${totalExtra} total`);
if (totalUntranslated > 0)
    console.log(`  Possibly untranslated: ${totalUntranslated} total`);

if (hasErrors) {
    console.log("\ni18n check FAILED - fix missing/extra keys above");
    process.exit(1);
} else {
    console.log("\ni18n check PASSED");
}
