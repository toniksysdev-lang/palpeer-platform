/**
 * Restore veronica on legacy Palpeer app / V1 Testers if missing.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT = 'toniksystemslab';
const EMAIL = 'veronica.oladipo@palpeer.com';
const LEGACY_APP = '6753612161';
const LEGACY_GROUP = 'de165dd2-6e36-4500-9716-38a775a6c16c';
const MOBILE_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';

function loadSession() {
  const state = JSON.parse(
    fs.readFileSync(path.join(process.env.USERPROFILE, '.expo', 'state.json'), 'utf8'),
  );
  return state?.auth?.sessionSecret || state?.sessionSecret;
}

async function gql(session, query, variables = {}) {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'expo-session': session,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt({ keyP8, keyId, issuerId }) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({ iss: issuerId, iat: now, exp: now + 1100, aud: 'appstoreconnect-v1' }),
  );
  const data = `${header}.${payload}`;
  const key = crypto.createPrivateKey(keyP8);
  const sig = crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `${data}.${sig.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;
}

async function asc(jwt, method, urlPath, body) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${urlPath} -> ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

(async () => {
  const session = loadSession();
  const listData = await gql(
    session,
    `query ($accountName: String!) {
      account {
        byName(accountName: $accountName) {
          appStoreConnectApiKeysPaginated(first: 20) {
            edges { node { id keyIdentifier issuerIdentifier } }
          }
        }
      }
    }`,
    { accountName: ACCOUNT },
  );
  let jwt = null;
  for (const e of listData.account.byName.appStoreConnectApiKeysPaginated.edges) {
    try {
      const detail = await gql(
        session,
        `query ($id: ID!) {
          appStoreConnectApiKey { byId(id: $id) { keyIdentifier issuerIdentifier keyP8 } }
        }`,
        { id: e.node.id },
      );
      const key = detail.appStoreConnectApiKey.byId;
      const t = makeJwt({
        keyP8: key.keyP8,
        keyId: key.keyIdentifier,
        issuerId: key.issuerIdentifier,
      });
      await asc(jwt || t, 'GET', `/v1/betaGroups/${MOBILE_GROUP}`);
      jwt = t;
      console.log('usingKey=' + key.keyIdentifier);
      break;
    } catch {
      /* try next */
    }
  }
  if (!jwt) throw new Error('no key');

  const found = await asc(
    jwt,
    'GET',
    `/v1/betaTesters?filter[email]=${encodeURIComponent(EMAIL)}&limit=20`,
  );
  let hasLegacy = false;
  for (const t of found.data || []) {
    const apps = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/apps?limit=20`);
    const groups = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/betaGroups?limit=20`);
    console.log(
      JSON.stringify({
        id: t.id,
        apps: (apps.data || []).map((a) => a.id + ':' + a.attributes?.name),
        groups: (groups.data || []).map((g) => g.id + ':' + g.attributes?.name),
      }),
    );
    if ((apps.data || []).some((a) => a.id === LEGACY_APP)) hasLegacy = true;
  }

  if (hasLegacy) {
    console.log('legacy already present');
    return;
  }

  const created = await asc(jwt, 'POST', '/v1/betaTesters', {
    data: {
      type: 'betaTesters',
      attributes: { email: EMAIL, firstName: 'Veronica', lastName: 'Oladipo' },
      relationships: {
        betaGroups: { data: [{ type: 'betaGroups', id: LEGACY_GROUP }] },
      },
    },
  });
  console.log('restored legacy tester ' + created.data.id + ' app=' + LEGACY_APP);
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 800));
  process.exit(1);
});
