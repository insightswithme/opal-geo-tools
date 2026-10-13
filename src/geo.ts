import { Country, State, ICountry, IState } from "country-state-city";

export interface CountryDetails {
  name: string;
  iso2: string;
  currency: string;
  phonecode: string;
  flag: string;
  latitude: string;
  longitude: string;
}

export interface StateDetails {
  name: string;
  stateCode: string;
  type: string;
}

export interface CountryMatchResult {
  match?: CountryDetails;
  suggestions?: Array<{ name: string; iso2: string; flag: string }>;
}

function toDetails(c: ICountry): CountryDetails {
  return {
    name: c.name,
    iso2: c.isoCode,
    currency: c.currency,
    phonecode: c.phonecode,
    flag: c.flag,
    latitude: c.latitude,
    longitude: c.longitude,
  };
}

function inferStateType(countryCode: string, stateName: string): string {
  const code = countryCode.toUpperCase();
  const name = stateName.toLowerCase();

  if (code === "IN") {
    const territories = [
      "andaman",
      "chandigarh",
      "dadra",
      "daman",
      "delhi",
      "jammu",
      "ladakh",
      "lakshadweep",
      "puducherry",
    ];
    if (territories.some((t) => name.includes(t))) return "Union Territory";
    return "State";
  }

  if (code === "AU") {
    if (name.includes("territory") || name === "australian capital territory" || name === "northern territory") {
      return "Territory";
    }
    return "State";
  }

  if (code === "CA") return "Province/Territory";
  if (code === "US") return "State";
  if (code === "GB") return "Country/Region";

  return "Administrative Division";
}

function scoreMatch(query: string, country: ICountry): number {
  const q = query.toLowerCase().trim();
  const name = country.name.toLowerCase();
  const iso = country.isoCode.toLowerCase();

  if (iso === q || name === q) return 100;
  if (name.startsWith(q)) return 80;
  if (name.includes(q)) return 60;
  if (q.length >= 2 && iso.startsWith(q)) return 50;

  // Token overlap for multi-word names (e.g. "United" → United States)
  const qTokens = q.split(/\s+/);
  const nameTokens = name.split(/\s+/);
  const overlap = qTokens.filter((t) => nameTokens.some((n) => n.startsWith(t))).length;
  if (overlap > 0) return 40 + overlap * 10;

  return 0;
}

export function findCountry(query: string): CountryMatchResult {
  if (!query || !query.trim()) {
    return { suggestions: [] };
  }

  const countries = Country.getAllCountries();
  const exact = countries.find(
    (c) =>
      c.isoCode.toLowerCase() === query.toLowerCase().trim() ||
      c.name.toLowerCase() === query.toLowerCase().trim()
  );

  if (exact) {
    return { match: toDetails(exact) };
  }

  const ranked = countries
    .map((c) => ({ country: c, score: scoreMatch(query, c) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return {
    suggestions: ranked.map((r) => ({
      name: r.country.name,
      iso2: r.country.isoCode,
      flag: r.country.flag,
    })),
  };
}

export function getStatesByCountryCode(countryCode: string): {
  countryCode: string;
  totalStates: number;
  states: StateDetails[];
} {
  const code = countryCode.toUpperCase().trim();
  const states: IState[] = State.getStatesOfCountry(code);

  return {
    countryCode: code,
    totalStates: states.length,
    states: states.map((s) => ({
      name: s.name,
      stateCode: s.isoCode,
      type: inferStateType(code, s.name),
    })),
  };
}

export function listCountriesForDropdown(): Array<{
  value: string;
  label: string;
  flag: string;
}> {
  return Country.getAllCountries()
    .map((c) => ({
      value: c.isoCode,
      label: `${c.flag} ${c.name}`,
      flag: c.flag,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
