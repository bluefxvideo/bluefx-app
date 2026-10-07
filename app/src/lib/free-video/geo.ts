/**
 * The visitor's country, for the free video ad's country list (BLOCKED_COUNTRIES in config.ts).
 *
 * Two signals, so a VPN alone does not get through:
 * - the IP, looked up in DB-IP's free country database (data/dbip-country-lite-YYYY-MM.mmdb.gz, CC BY 4.0, credited
 *   in the funnel footer). Refresh it every few months: download https://download.db-ip.com/free/dbip-country-lite-YYYY-MM.mmdb.gz
 *   into app/data/, change COUNTRY_DB below and delete the old file. next.config.ts traces data/ into the standalone build.
 * - the browser's time zone (Intl), sent with the form: a laptop set to Asia/Kolkata is in India whatever its IP says.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { Reader, type CountryResponse } from 'maxmind';
import { BLOCKED_COUNTRIES } from '@/lib/free-video/config';

const COUNTRY_DB = path.join(process.cwd(), 'data', 'dbip-country-lite-2026-10.mmdb.gz');

/** The time zones of the countries the list may name (IANA ids, old aliases included). Only these are looked at. */
const TIME_ZONE_COUNTRIES: Readonly<Record<string, string>> = {
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD',
  'Asia/Dacca': 'BD',
  'Asia/Kathmandu': 'NP',
  'Asia/Katmandu': 'NP',
  'Asia/Colombo': 'LK',
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Nairobi': 'KE',
  'Africa/Cairo': 'EG',
  Egypt: 'EG',
  'Europe/Moscow': 'RU',
  'Europe/Kaliningrad': 'RU',
  'Europe/Samara': 'RU',
  'Europe/Volgograd': 'RU',
  'Europe/Saratov': 'RU',
  'Europe/Ulyanovsk': 'RU',
  'Europe/Astrakhan': 'RU',
  'Europe/Kirov': 'RU',
  'Asia/Yekaterinburg': 'RU',
  'Asia/Omsk': 'RU',
  'Asia/Novosibirsk': 'RU',
  'Asia/Barnaul': 'RU',
  'Asia/Tomsk': 'RU',
  'Asia/Novokuznetsk': 'RU',
  'Asia/Krasnoyarsk': 'RU',
  'Asia/Irkutsk': 'RU',
  'Asia/Chita': 'RU',
  'Asia/Yakutsk': 'RU',
  'Asia/Khandyga': 'RU',
  'Asia/Vladivostok': 'RU',
  'Asia/Ust-Nera': 'RU',
  'Asia/Magadan': 'RU',
  'Asia/Sakhalin': 'RU',
  'Asia/Srednekolymsk': 'RU',
  'Asia/Kamchatka': 'RU',
  'Asia/Anadyr': 'RU',
  'W-SU': 'RU',
  'Europe/Minsk': 'BY',
  'Asia/Shanghai': 'CN',
  'Asia/Chongqing': 'CN',
  'Asia/Chungking': 'CN',
  'Asia/Harbin': 'CN',
  'Asia/Urumqi': 'CN',
  PRC: 'CN',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Saigon': 'VN',
  'Asia/Jakarta': 'ID',
  'Asia/Pontianak': 'ID',
  'Asia/Makassar': 'ID',
  'Asia/Ujung_Pandang': 'ID',
  'Asia/Jayapura': 'ID',
  'Asia/Manila': 'PH',
};

/** undefined: not loaded yet. null: the file could not be read (logged once; nobody is refused for it). */
let reader: Reader<CountryResponse> | null | undefined;

function countryReader(): Reader<CountryResponse> | null {
  if (reader !== undefined) return reader;
  try {
    reader = new Reader<CountryResponse>(zlib.gunzipSync(fs.readFileSync(COUNTRY_DB)));
  } catch (error) {
    console.error('❌ [free-video] Country database not loaded, so no country is refused:', error);
    reader = null;
  }
  return reader;
}

/** The ISO 3166 alpha-2 code of an IP, or null (no IP, a private address, or no database). */
export function countryOfIp(ip: string | null): string | null {
  if (!ip) return null;
  try {
    const hit = countryReader()?.get(ip);
    return hit?.country?.iso_code ?? hit?.registered_country?.iso_code ?? null;
  } catch {
    return null;
  }
}

/** The country of a time zone the list may name, or null for any other time zone. */
export function countryOfTimeZone(timeZone: string | null | undefined): string | null {
  return timeZone ? (TIME_ZONE_COUNTRIES[timeZone] ?? null) : null;
}

export interface BlockedCountry {
  code: string;
  /** As the refusal says it: "India", "the Philippines". */
  name: string;
}

/** The listed country this visitor is in, by IP or by time zone, or null when the free video ad is open to them. */
export function blockedCountry(ip: string | null, timeZone?: string | null): BlockedCountry | null {
  for (const code of [countryOfIp(ip), countryOfTimeZone(timeZone)]) {
    if (code && BLOCKED_COUNTRIES[code]) return { code, name: BLOCKED_COUNTRIES[code] };
  }
  return null;
}
