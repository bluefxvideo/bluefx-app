/**
 * Light is the app's default from LIGHT_DEFAULT_SINCE on (owner 2026-10-19). Accounts made before then keep the dark
 * app they know, and that the tutorial videos show, until they pick Light themselves; new accounts, such as the free
 * video ad's buyers, start in light like the bluefx.net pages they come from. Set the date to the day this ships.
 */
export const LIGHT_DEFAULT_SINCE = '2026-10-20T00:00:00Z';

/** True for an account that keeps dark until its owner picks a theme. */
export function keepsDarkByDefault(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  return Date.parse(createdAt) < Date.parse(LIGHT_DEFAULT_SINCE);
}

/**
 * Runs while the page loads (before the first paint), so an older account never flashes white: dark is stored as
 * its choice unless the person already picked Light or Dark in this browser.
 */
export const KEEP_DARK_SCRIPT = `try{if(!localStorage.getItem('theme')){localStorage.setItem('theme','dark');var d=document.documentElement;d.classList.remove('light');d.classList.add('dark');d.style.colorScheme='dark'}}catch(e){}`;
