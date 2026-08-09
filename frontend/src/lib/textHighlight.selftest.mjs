/**
 * Regression checks for the in-conversation message search highlighter.
 * Run: node frontend/src/lib/textHighlight.selftest.mjs
 */
import { escapeRegExp, splitHighlightRanges } from "./textHighlight.js";

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(escapeRegExp("a.b*c") === "a\\.b\\*c", "escapes regex metacharacters");

const none = splitHighlightRanges("hello world", "");
assert(none.length === 1 && none[0].isMatch === false && none[0].text === "hello world", "empty needle -> no highlight");

const single = splitHighlightRanges("hello world", "world");
assert(single.length === 2, "splits around one match");
assert(single[0].text === "hello " && single[0].isMatch === false, "leading text is not a match");
assert(single[1].text === "world" && single[1].isMatch === true, "matched segment is flagged");

const caseInsensitive = splitHighlightRanges("Hello WORLD hello", "hello");
const matches = caseInsensitive.filter((s) => s.isMatch);
assert(matches.length === 2, "case-insensitive match finds both occurrences");
assert(matches[0].text === "Hello" && matches[1].text === "hello", "preserves original casing in matched text");

const noMatch = splitHighlightRanges("nothing here", "xyz");
assert(noMatch.length === 1 && noMatch[0].isMatch === false, "no match returns the original text untouched");

const special = splitHighlightRanges("price is $5.00 today", "$5.00");
assert(special.some((s) => s.isMatch && s.text === "$5.00"), "regex special characters in the query are escaped and matched literally");

console.log("textHighlight.selftest.mjs: ok");
