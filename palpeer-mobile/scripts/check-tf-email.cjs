const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EMAIL = process.argv[2] || 'topmostbukky@gmail.com';
const ACCOUNT = 'toniksystemslab';
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
      account { byName(accountName: $accountName) {
        appStoreConnectApiKeysPaginated(first: 20) {
          edges { node { id keyIdentifier issuerIdentifier } }
        }
      } }
    }`,
    { accountName: ACCOUNT },
  );
  let jwt;
  for (const e of listData.account.byName.appStoreConnectApiKeysPaginated.edges) {
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
    try {
      await asc(t, 'GET', `/v1/betaGroups/${MOBILE_GROUP}`);
      jwt = t;
      break;
    } catch {
      /* next */
    }
  }
  const page = await asc(
    jwt,
    'GET',
    `/v1/betaTesters?filter[email]=${encodeURIComponent(EMAIL)}&limit=20`,
  );
  for (const t of page.data || []) {
    const apps = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/apps?limit=20`).catch(() => ({
      data: [],
    }));
    const groups = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/betaGroups?limit=20`).catch(
      () => ({ data: [] }),
    );
    console.log(
      JSON.stringify({
        id: t.id,
        email: t.attributes?.email,
        firstName: t.attributes?.firstName,
        lastName: t.attributes?.lastName,
        inviteType: t.attributes?.inviteType,
        apps: (apps.data || []).map((a) => a.attributes?.name),
        groups: (groups.data || []).map((g) => g.attributes?.name),
      }),
    );
    // delete orphans (no apps, no groups)
    if (!(apps.data || []).length && !(groups.data || []).length) {
      try {
        await asc(jwt, 'DELETE', `/v1/betaTesters/${t.id}`);
        console.log('deleted orphan ' + t.id);
      } catch (e) {
        console.log('orphan delete ' + e.status);
      }
    }
  }

  // Also confirm Mobile group membership for this email
  const group = await asc(jwt, 'GET', `/v1/betaGroups/${MOBILE_GROUP}/betaTesters?limit=200`);
  const hit = (group.data || []).filter(
    (t) => (t.attributes?.email || '').toLowerCase() === EMAIL.toLowerCase(),
  );
  console.log(
    'in Palpeer tester group: ' +
      JSON.stringify(hit.map((t) => ({ id: t.id, email: t.attributes?.email }))),
  );
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body).slice(0, 800));
  process.exit(1);
});
