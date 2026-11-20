/**
 * Clear stuck V1 Palpeer TestFlight association for topmostbukky@gmail.com
 * ("already been associated to this app") then re-invite to V1 + ensure Mobile.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EMAIL = 'topmostbukky@gmail.com';
const ACCOUNT = 'toniksystemslab';
const MOBILE_APP = '6826088742';
const MOBILE_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
const V1_APP = '6753612161';
const V1_GROUP = 'de165dd2-6e36-4500-9716-38a775a6c16c';

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

async function getJwt(session) {
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
      const jwt = makeJwt({
        keyP8: key.keyP8,
        keyId: key.keyIdentifier,
        issuerId: key.issuerIdentifier,
      });
      await asc(jwt, 'GET', `/v1/betaGroups/${MOBILE_GROUP}`);
      console.log('usingKey=' + key.keyIdentifier);
      return jwt;
    } catch {
      /* next */
    }
  }
  throw new Error('no key');
}

async function find(jwt) {
  const page = await asc(
    jwt,
    'GET',
    `/v1/betaTesters?filter[email]=${encodeURIComponent(EMAIL)}&limit=20`,
  );
  return page.data || [];
}

async function dump(jwt, t) {
  const apps = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/apps?limit=20`).catch(() => ({
    data: [],
  }));
  const groups = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/betaGroups?limit=20`).catch(
    () => ({ data: [] }),
  );
  console.log(
    JSON.stringify({
      id: t.id,
      apps: (apps.data || []).map((a) => a.id + ':' + a.attributes?.name),
      groups: (groups.data || []).map((g) => g.id + ':' + g.attributes?.name),
    }),
  );
  return { apps: apps.data || [], groups: groups.data || [] };
}

async function invite(jwt, testerId, appId) {
  try {
    await asc(jwt, 'POST', '/v1/betaTesterInvitations', {
      data: {
        type: 'betaTesterInvitations',
        relationships: {
          app: { data: { type: 'apps', id: appId } },
          betaTester: { data: { type: 'betaTesters', id: testerId } },
        },
      },
    });
    console.log('INVITED app=' + appId + ' tester=' + testerId);
  } catch (e) {
    console.log(
      'invite app=' + appId + ' ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 400),
    );
  }
}

(async () => {
  const jwt = await getJwt(loadSession());
  let all = await find(jwt);
  console.log('before=' + all.length);
  for (const t of all) await dump(jwt, t);

  // Reset V1 association (the stuck Accept invite)
  for (const t of all) {
    const { apps } = await dump(jwt, t);
    if (!apps.some((a) => a.id === V1_APP)) continue;
    try {
      await asc(jwt, 'DELETE', `/v1/betaGroups/${V1_GROUP}/relationships/betaTesters`, {
        data: [{ type: 'betaTesters', id: t.id }],
      });
      console.log('removed from V1 Testers ' + t.id);
    } catch (e) {
      console.log('rm v1 group ' + e.status);
    }
    try {
      await asc(jwt, 'DELETE', `/v1/betaTesters/${t.id}/relationships/apps`, {
        data: [{ type: 'apps', id: V1_APP }],
      });
      console.log('removed V1 app access ' + t.id);
    } catch (e) {
      console.log('rm v1 app ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 250));
    }
    try {
      await asc(jwt, 'DELETE', `/v1/betaTesters/${t.id}`);
      console.log('deleted tester ' + t.id);
    } catch (e) {
      console.log('delete ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 250));
    }
  }

  await new Promise((r) => setTimeout(r, 2500));
  all = await find(jwt);
  console.log('afterV1Cleanup=' + all.length);
  for (const t of all) await dump(jwt, t);

  // Recreate V1 tester so Accept works again on old app if needed
  const v1 = await asc(jwt, 'POST', '/v1/betaTesters', {
    data: {
      type: 'betaTesters',
      attributes: { email: EMAIL, firstName: 'TopMost', lastName: 'Bukky' },
      relationships: { betaGroups: { data: [{ type: 'betaGroups', id: V1_GROUP }] } },
    },
  });
  console.log('recreated V1 tester ' + v1.data.id);
  await invite(jwt, v1.data.id, V1_APP);

  // Ensure Mobile still present; recreate if wiped
  all = await find(jwt);
  let hasMobile = false;
  for (const t of all) {
    const apps = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/apps?limit=20`);
    if ((apps.data || []).some((a) => a.id === MOBILE_APP)) {
      hasMobile = true;
      await invite(jwt, t.id, MOBILE_APP);
    }
  }
  if (!hasMobile) {
    const m = await asc(jwt, 'POST', '/v1/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: { email: EMAIL, firstName: 'TopMost', lastName: 'Bukky' },
        relationships: { betaGroups: { data: [{ type: 'betaGroups', id: MOBILE_GROUP }] } },
      },
    });
    console.log('recreated Mobile tester ' + m.data.id);
    await invite(jwt, m.data.id, MOBILE_APP);
  }

  console.log('=== FINAL ===');
  for (const t of await find(jwt)) await dump(jwt, t);
  console.log(
    JSON.stringify({
      email: EMAIL,
      mobilePublicLink: 'https://testflight.apple.com/join/fEf3DzCz',
      guidance:
        'Screenshot was old V1 Palpeer. For current builds use Mobile public link or the new Mobile email invite. Tap OK on the stuck dialog, then Redeem/open the Mobile link.',
    }),
  );
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 1200));
  process.exit(1);
});
