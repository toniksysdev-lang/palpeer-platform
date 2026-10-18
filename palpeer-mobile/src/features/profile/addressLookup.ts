import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { PROFILE_COUNTRIES, STATES_BY_COUNTRY } from './profileOptions';

export type StructuredAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2 when known. */
  countryCode: string;
  /** Subdivision key matching {@link STATES_BY_COUNTRY}, when matched. */
  stateTerritory: string;
  /** Full place label for suggestion rows. */
  label: string;
};

export type AddressSuggestion = StructuredAddress & {
  id: string;
};

const PROFILE_COUNTRY_CODES = new Set(Object.keys(STATES_BY_COUNTRY));

const COUNTRY_NAME_BY_ISO: Record<string, string> = Object.fromEntries(
  PROFILE_COUNTRIES.map((c) => [c.key, c.title]),
);

type NominatimAddress = {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
  state_district?: string;
  region?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  name?: string;
};

type NominatimResult = {
  place_id: number | string;
  display_name: string;
  name?: string;
  address?: NominatimAddress;
};

type PhotonFeature = {
  properties?: {
    osm_id?: number | string;
    osm_type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    district?: string;
    city?: string;
    locality?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
  };
};

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Map a geocoder region name onto our subdivision keys for a country. */
export function matchStateTerritory(
  countryCode: string,
  region: string | null | undefined,
): string {
  const options = STATES_BY_COUNTRY[countryCode.toUpperCase()];
  if (!options || !region?.trim()) return '';
  const needle = normalize(region);
  const byKey = options.find((o) => normalize(o.key) === needle);
  if (byKey) return byKey.key;
  const byTitle = options.find((o) => normalize(o.title) === needle);
  if (byTitle) return byTitle.key;
  const partial = options.find(
    (o) => normalize(o.title).includes(needle) || needle.includes(normalize(o.title)),
  );
  return partial?.key ?? '';
}

function buildSuggestion(input: {
  id: string;
  label: string;
  street?: string;
  line2?: string;
  city?: string;
  postalCode?: string;
  countryCode?: string;
  region?: string;
}): AddressSuggestion | null {
  const countryCode = (input.countryCode ?? '').toUpperCase();
  if (!countryCode || !PROFILE_COUNTRY_CODES.has(countryCode)) return null;

  const street = (input.street ?? '').trim();
  const city = (input.city ?? '').trim();
  const label = input.label.trim();
  if (!street && !city && !label) return null;

  return {
    id: input.id,
    label: label || [street, city].filter(Boolean).join(', '),
    addressLine1: street || city || label.split(',')[0]!.trim(),
    addressLine2: (input.line2 ?? '').trim(),
    city: city || '',
    postalCode: (input.postalCode ?? '').trim(),
    countryCode,
    stateTerritory: matchStateTerritory(countryCode, input.region),
  };
}

export function mapNominatimResult(result: NominatimResult): AddressSuggestion | null {
  const address = result.address ?? {};
  const street = [address.house_number, address.road ?? address.pedestrian]
    .filter(Boolean)
    .join(' ')
    .trim();
  const city =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.county ??
    '';
  return buildSuggestion({
    id: String(result.place_id),
    label: result.display_name || result.name || street || city,
    street: street || result.name || address.name || '',
    line2: address.suburb ?? address.neighbourhood ?? '',
    city,
    postalCode: address.postcode ?? '',
    countryCode: address.country_code,
    region: address.state ?? address.state_district ?? address.region ?? '',
  });
}

export function mapPhotonFeature(feature: PhotonFeature, index: number): AddressSuggestion | null {
  const p = feature.properties;
  if (!p) return null;
  const street = [p.housenumber, p.street].filter(Boolean).join(' ').trim();
  const city = p.city ?? p.locality ?? p.county ?? '';
  const label = [
    street || p.name,
    city,
    p.state,
    p.postcode,
    p.country,
  ]
    .filter(Boolean)
    .join(', ');
  return buildSuggestion({
    id: `${p.osm_type ?? 'photon'}-${p.osm_id ?? index}`,
    label,
    street: street || p.name || '',
    line2: p.district ?? '',
    city,
    postalCode: p.postcode ?? '',
    countryCode: p.countrycode,
    region: p.state ?? '',
  });
}

export function mapExpoGeocodedAddress(
  place: Location.LocationGeocodedAddress,
): StructuredAddress | null {
  const street = [place.streetNumber, place.street].filter(Boolean).join(' ').trim();
  const city = place.city ?? place.subregion ?? place.district ?? '';
  return buildSuggestion({
    id: 'expo',
    label: [street, city, place.postalCode, place.country].filter(Boolean).join(', '),
    street,
    line2: place.district && place.district !== city ? place.district : '',
    city,
    postalCode: place.postalCode ?? '',
    countryCode: place.isoCountryCode ?? undefined,
    region: place.region ?? place.subregion ?? '',
  });
}

function searchHeaders(): HeadersInit {
  // Browsers forbid setting User-Agent; a custom UA also forces a CORS preflight.
  if (Platform.OS === 'web') {
    return { Accept: 'application/json' };
  }
  return {
    Accept: 'application/json',
    'User-Agent': 'PalpeerMobile/0.1 (personal-information address lookup)',
  };
}

async function searchPhoton(
  query: string,
  countryCode?: string | null,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const iso = countryCode?.trim().toUpperCase();
  const countryName = iso ? COUNTRY_NAME_BY_ISO[iso] : undefined;
  const q = countryName && !query.toLowerCase().includes(countryName.toLowerCase())
    ? `${query}, ${countryName}`
    : query;

  const params = new URLSearchParams({
    q,
    limit: '8',
    lang: 'en',
  });
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, {
    method: 'GET',
    headers: searchHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Photon search failed (${response.status})`);
  }
  const payload = (await response.json()) as { features?: PhotonFeature[] };
  const features = Array.isArray(payload.features) ? payload.features : [];
  const mapped = features
    .map((feature, index) => mapPhotonFeature(feature, index))
    .filter((item): item is AddressSuggestion => item != null);

  if (iso && PROFILE_COUNTRY_CODES.has(iso)) {
    const biased = mapped.filter((item) => item.countryCode === iso);
    if (biased.length > 0) return biased;
  }
  return mapped.filter((item) => PROFILE_COUNTRY_CODES.has(item.countryCode));
}

async function searchNominatim(
  query: string,
  countryCode?: string | null,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '8',
    q: query,
  });
  const iso = countryCode?.trim().toUpperCase();
  if (iso && PROFILE_COUNTRY_CODES.has(iso)) {
    params.set('countrycodes', iso.toLowerCase());
  } else {
    params.set(
      'countrycodes',
      [...PROFILE_COUNTRY_CODES].map((code) => code.toLowerCase()).join(','),
    );
  }

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    method: 'GET',
    headers: searchHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(`Nominatim search failed (${response.status})`);
  }
  const payload = (await response.json()) as NominatimResult[];
  if (!Array.isArray(payload)) return [];
  return payload.map(mapNominatimResult).filter((item): item is AddressSuggestion => item != null);
}

/**
 * Address autocomplete: Photon first (fast / CORS-friendly), Nominatim fallback.
 * If a country filter yields nothing, retries without the country bias.
 */
export async function searchAddresses(
  query: string,
  countryCode?: string | null,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const trySearch = async (country: string | null | undefined) => {
    try {
      const photon = await searchPhoton(trimmed, country, signal);
      if (photon.length > 0) return photon;
    } catch {
      // Fall through to Nominatim.
    }
    return searchNominatim(trimmed, country, signal);
  };

  const primary = await trySearch(countryCode);
  if (primary.length > 0) return primary;

  // Country bias can over-filter short queries — retry across corridor countries.
  if (countryCode?.trim()) {
    return trySearch(null);
  }
  return [];
}

/** Reverse-geocode coordinates when the platform geocoder is empty (common on web). */
export async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<StructuredAddress | null> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    lat: String(latitude),
    lon: String(longitude),
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
    method: 'GET',
    headers: searchHeaders(),
    signal,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as NominatimResult & { error?: string };
  if (!payload || payload.error || payload.place_id == null) return null;
  return mapNominatimResult(payload);
}

export type LocationPickupResult =
  | { ok: true; address: StructuredAddress }
  | { ok: false; reason: 'permission_denied' | 'unavailable' | 'unsupported_country' | 'failed'; message: string };

/** Resolve the device position into structured address fields. */
export async function pickupCurrentAddress(): Promise<LocationPickupResult> {
  try {
    const services = await Location.hasServicesEnabledAsync();
    if (!services) {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'Turn on location services to pick up your address.',
      };
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      return {
        ok: false,
        reason: 'permission_denied',
        message: 'Location permission is needed to pick up your address automatically.',
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    const { latitude, longitude } = position.coords;

    let mapped: StructuredAddress | null = null;
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      const first = places[0];
      if (first) mapped = mapExpoGeocodedAddress(first);
    } catch {
      // Platform reverse-geocode is unavailable on some web builds — fall through.
    }
    if (!mapped) {
      mapped = await reverseGeocodeNominatim(latitude, longitude);
    }
    if (!mapped) {
      return {
        ok: false,
        reason: 'unavailable',
        message: 'Could not resolve an address for your current location.',
      };
    }
    if (!PROFILE_COUNTRY_CODES.has(mapped.countryCode)) {
      return {
        ok: false,
        reason: 'unsupported_country',
        message: 'Your current location is outside supported countries of residence.',
      };
    }
    return { ok: true, address: mapped };
  } catch {
    return {
      ok: false,
      reason: 'failed',
      message: 'Could not pick up your address. Try again or enter it manually.',
    };
  }
}
