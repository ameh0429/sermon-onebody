/** Convenience only: never use this browser-stored identity as authentication. */
export interface RememberedAccount {
  name: string;
  email: string;
}
export const rememberedAccountKey = "onebody.rememberedAccount";
export function readRememberedAccount(): RememberedAccount | null {
  try {
    const raw = localStorage.getItem(rememberedAccountKey);
    if (!raw || raw.length > 1024) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const { name, email } = value as Partial<RememberedAccount>;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.length > 100 ||
      typeof email !== "string" ||
      email.length > 255 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    )
      return null;
    return { name: name.trim(), email: email.trim().toLowerCase() };
  } catch {
    return null;
  }
}
export function rememberAccount(account: RememberedAccount) {
  try {
    localStorage.setItem(
      rememberedAccountKey,
      JSON.stringify({
        name: account.name,
        email: account.email.trim().toLowerCase(),
      }),
    );
  } catch {
    /* Remembering is optional when storage is blocked. */
  }
}
export function forgetAccount() {
  try {
    localStorage.removeItem(rememberedAccountKey);
  } catch {
    /* The form still clears for this visit. */
  }
}
