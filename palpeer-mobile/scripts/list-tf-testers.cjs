/**
 * List TestFlight / App Store Connect beta testers for PALPEER Mobile.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BETA_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
const ASC_APP_ID = '6826088742';
const ACCOUNT = 'toniksystemslab';

function loadSession() {
  const state = JSON.parse(
    fs.readFileSync(path.join(process.env.USERPROFILE, '.expo', 'state.json'), 'utf8'),
  );
  const session = state?.auth?.sessionSecret || state?.sessionSecret;
  if (!session) throw new Error('No Expo session in ~/.expo/state.json — run eas login');
  return session;
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

async function asc(jwt, method, urlPath) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/json',
    },
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
    err.body = json;
    throw err;
  }
  return json;
}

async function paginate(jwt, firstUrl) {
  const out = [];
  let url = firstUrl;
  while (url) {
    const page = await asc(jwt, 'GET', url);
    out.push(...(page.data || []));
    const next = page.links?.next;
    url = next ? next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return out;
}

(async () => {
  const session = loadSession();
  const listData = await gql(
    session,
    `
    query ($accountName: String!) {
      account {
        byName(accountName: $accountName) {
          appStoreConnectApiKeysPaginated(first: 20) {
            edges { node { id keyIdentifier issuerIdentifier } }
          }
        }
      }
    }
  `,
    { accountName: ACCOUNT },
  );
  const keys = listData.account.byName.appStoreConnectApiKeysPaginated.edges.map((e) => e.node);
  if (!keys.length) throw new Error('No ASC API keys on Expo account');

  let jwt = null;
  for (const k of keys) {
    try {
      const detail = await gql(
        session,
        `
        query ($id: ID!) {
          appStoreConnectApiKey { byId(id: $id) { keyIdentifier issuerIdentifier keyP8 } }
        }
      `,
        { id: k.id },
      );
      const key = detail.appStoreConnectApiKey.byId;
      jwt = makeJwt({
        keyP8: key.keyP8,
        keyId: key.keyIdentifier,
        issuerId: key.issuerIdentifier,
      });
      await asc(jwt, 'GET', `/v1/betaGroups/${BETA_GROUP}`);
      console.log('usingKey=' + key.keyIdentifier);
      break;
    } catch (e) {
      console.log(`key ${k.keyIdentifier} failed: ${e.message}`);
      jwt = null;
    }
  }
  if (!jwt) throw new Error('No working ASC API key');

  const groups = await paginate(jwt, `/v1/apps/${ASC_APP_ID}/betaGroups?limit=50`);
  console.log('=== BETA GROUPS ===');
  for (const g of groups) {
    const a = g.attributes || {};
    console.log(
      `${a.name || ''} | id=${g.id} | internal=${a.isInternalGroup} | publicLink=${a.publicLinkEnabled}`,
    );
  }

  const all = await paginate(jwt, `/v1/betaTesters?filter[apps]=${ASC_APP_ID}&limit=200`);
  console.log(`=== ALL APP TESTERS (${all.length}) ===`);
  for (const t of all.sort((a, b) =>
    String(a.attributes?.email || '').localeCompare(String(b.attributes?.email || '')),
  )) {
    const a = t.attributes || {};
    console.log(
      [a.email || '', a.firstName || '', a.lastName || '', a.state || '', a.inviteType || ''].join(
        ' | ',
      ),
    );
  }

  const groupTesters = await paginate(jwt, `/v1/betaGroups/${BETA_GROUP}/betaTesters?limit=200`);
  console.log(`=== EXTERNAL GROUP TESTERS (${groupTesters.length}) ===`);
  for (const t of groupTesters.sort((a, b) =>
    String(a.attributes?.email || '').localeCompare(String(b.attributes?.email || '')),
  )) {
    const a = t.attributes || {};
    console.log([a.email || '', a.firstName || '', a.lastName || '', a.state || ''].join(' | '));
  }
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2));
  process.exit(1);
});
