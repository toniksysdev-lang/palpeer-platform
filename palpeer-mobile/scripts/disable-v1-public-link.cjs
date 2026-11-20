const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT = 'toniksystemslab';
const V1_GROUP = 'de165dd2-6e36-4500-9716-38a775a6c16c';
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
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(`${method} ${urlPath} -> ${res.status}`);
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
            edges { node { id } }
          }
        }
      }
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
    const token = makeJwt({
      keyP8: key.keyP8,
      keyId: key.keyIdentifier,
      issuerId: key.issuerIdentifier,
    });
    try {
      await asc(token, 'GET', `/v1/betaGroups/${MOBILE_GROUP}`);
      jwt = token;
      break;
    } catch {
      /* next */
    }
  }

  const before = await asc(
    jwt,
    'GET',
    `/v1/betaGroups/${V1_GROUP}?fields[betaGroups]=name,publicLink,publicLinkEnabled`,
  );
  console.log('before=' + JSON.stringify(before.data.attributes));

  await asc(jwt, 'PATCH', `/v1/betaGroups/${V1_GROUP}`, {
    data: {
      type: 'betaGroups',
      id: V1_GROUP,
      attributes: { publicLinkEnabled: false },
    },
  });

  const after = await asc(
    jwt,
    'GET',
    `/v1/betaGroups/${V1_GROUP}?fields[betaGroups]=name,publicLink,publicLinkEnabled`,
  );
  console.log('after=' + JSON.stringify(after.data.attributes));

  const left = await asc(jwt, 'GET', `/v1/betaGroups/${V1_GROUP}/betaTesters?limit=50`);
  console.log(
    'v1TestersLeft=' + JSON.stringify((left.data || []).map((t) => t.attributes?.email)),
  );
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 800));
  process.exit(1);
});
