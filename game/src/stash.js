// localStorage autosave for SOLMAR HEAT. Plain JSON, one key, guarded
// so private-mode / headless storage failures never break the game.
// Saves carry a version number; an older or unknown shape is ignored
// instead of loading half a save.
const KEY = 'solmar-heat-save-v2';
const SAVE_VERSION = 2;

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (data.v !== undefined && data.v !== SAVE_VERSION) return null;
    return data;
  } catch (e) { return null; }
}

export function storeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ v: SAVE_VERSION, ...data }));
    return true;
  } catch (e) { return false; }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) {}
}
