/**
 * The bytes that get signed.
 *
 * One implementation, used by the app and by the signing script, so the
 * two cannot drift apart. A release is signed over these bytes and
 * verified over these bytes, so a difference between the two would fail
 * every check.
 *
 * The rules: object keys are sorted at every level, so the same value
 * always gives the same bytes. `undefined` is left out, because it is not
 * JSON. Nothing else is changed: the shape of the value is the shape of
 * the bytes.
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** The bytes of a log entry that are signed and hashed: the same without
 * the signature, so a signature never covers itself. */
export function entryBody(entry) {
  const body = { ...entry };
  delete body.sig;
  return canonicalJson(body);
}
