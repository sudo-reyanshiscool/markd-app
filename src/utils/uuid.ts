/**
 * Local-row id generator. Supabase rows get real uuids from the database;
 * these ids only label guest-mode rows and optimistic placeholders, so
 * Math.random is acceptable (no security property attaches to them).
 */
export function localId(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) {
    if (i === 12) {
      out += "4";
      continue;
    }
    const r = Math.floor(Math.random() * 16);
    out += hex[i === 16 ? (r & 0x3) | 0x8 : r];
  }
  return (
    out.slice(0, 8) +
    "-" +
    out.slice(8, 12) +
    "-" +
    out.slice(12, 16) +
    "-" +
    out.slice(16, 20) +
    "-" +
    out.slice(20)
  );
}
