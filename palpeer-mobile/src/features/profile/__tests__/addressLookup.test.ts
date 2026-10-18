import {
  mapExpoGeocodedAddress,
  mapNominatimResult,
  mapPhotonFeature,
  matchStateTerritory,
} from '../addressLookup';

describe('addressLookup', () => {
  it('matches subdivision titles and keys', () => {
    expect(matchStateTerritory('CA', 'Ontario')).toBe('ON');
    expect(matchStateTerritory('CA', 'on')).toBe('ON');
    expect(matchStateTerritory('US', 'California')).toBe('CA');
    expect(matchStateTerritory('NG', 'Unknown state')).toBe('');
  });

  it('maps Nominatim results into profile fields', () => {
    const mapped = mapNominatimResult({
      place_id: 42,
      display_name: '100 Queen St W, Toronto, ON M5H 2N2, Canada',
      address: {
        house_number: '100',
        road: 'Queen St W',
        city: 'Toronto',
        state: 'Ontario',
        postcode: 'M5H 2N2',
        country_code: 'ca',
      },
    });
    expect(mapped).toEqual({
      id: '42',
      label: '100 Queen St W, Toronto, ON M5H 2N2, Canada',
      addressLine1: '100 Queen St W',
      addressLine2: '',
      city: 'Toronto',
      postalCode: 'M5H 2N2',
      countryCode: 'CA',
      stateTerritory: 'ON',
    });
  });

  it('maps Nominatim place-name results without a street', () => {
    const mapped = mapNominatimResult({
      place_id: 9,
      display_name: 'Lagos, Nigeria',
      name: 'Lagos',
      address: { country_code: 'ng', city: 'Lagos' },
    });
    expect(mapped).toMatchObject({
      addressLine1: 'Lagos',
      city: 'Lagos',
      countryCode: 'NG',
    });
  });

  it('maps Photon features into profile fields', () => {
    const mapped = mapPhotonFeature(
      {
        properties: {
          osm_id: 100,
          osm_type: 'N',
          name: 'Toronto City Hall',
          housenumber: '100',
          street: 'Queen Street West',
          city: 'Toronto',
          state: 'Ontario',
          postcode: 'M5H 2N2',
          country: 'Canada',
          countrycode: 'CA',
        },
      },
      0,
    );
    expect(mapped).toMatchObject({
      id: 'N-100',
      addressLine1: '100 Queen Street West',
      city: 'Toronto',
      postalCode: 'M5H 2N2',
      countryCode: 'CA',
      stateTerritory: 'ON',
    });
  });

  it('ignores Nominatim results outside supported countries', () => {
    expect(
      mapNominatimResult({
        place_id: 1,
        display_name: 'Somewhere',
        address: { country_code: 'fr', city: 'Paris', road: 'Rue' },
      }),
    ).toBeNull();
  });

  it('maps expo reverse-geocode results', () => {
    const mapped = mapExpoGeocodedAddress({
      streetNumber: '100',
      street: 'Queen St W',
      city: 'Toronto',
      region: 'Ontario',
      postalCode: 'M5H 2N2',
      country: 'Canada',
      isoCountryCode: 'CA',
      district: null,
      subregion: null,
      name: null,
      timezone: null,
      formattedAddress: null,
    });
    expect(mapped).toMatchObject({
      addressLine1: '100 Queen St W',
      city: 'Toronto',
      postalCode: 'M5H 2N2',
      countryCode: 'CA',
      stateTerritory: 'ON',
    });
  });
});
