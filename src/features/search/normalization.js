/** Shared runtime/build normalization; keep this CommonJS module Node 22 and Metro compatible. */
function normalizeSearchText(value) {
  if (/[\p{Cc}\p{Cf}]/u.test(value)) throw new Error("INVALID_SEARCH");
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePlaceName(value) {
  return normalizeSearchText(value).replace(
    /\s+(city|town|village|borough|municipality|cdp|balance)$/,
    "",
  );
}

module.exports = { normalizePlaceName, normalizeSearchText };
