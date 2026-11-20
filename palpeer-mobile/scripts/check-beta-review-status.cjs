/** Check PALPEER Mobile build 5 external Beta Review status. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT = 'toniksystemslab';
const MOBILE_APP = '6826088742';
const BUILD_ID = '8d81654e-463e-4f32-bbfe-6d3a2ee26479';
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

async function asc(jwt, method, urlPath) {
  const res = await fetch(`https://api.appstoreconnect.apple.com${urlPath}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
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

  const build = await asc(
    jwt,
    'GET',
    `/v1/builds/${BUILD_ID}?fields[builds]=version,processingState,expired,uploadedDate`,
  );
  const details = await asc(
    jwt,
    'GET',
    `/v1/buildBetaDetails?filter[build]=${BUILD_ID}&limit=5`,
  );
  let submission = null;
  try {
    submission = await asc(jwt, 'GET', `/v1/builds/${BUILD_ID}/betaAppReviewSubmission`);
  } catch (e) {
    submission = { error: e.message, body: e.body };
  }

  const latest = await asc(
    jwt,
    'GET',
    `/v1/builds?filter[app]=${MOBILE_APP}&sort=-uploadedDate&limit=5&fields[builds]=version,expired,processingState`,
  );
  const rows = [];
  for (const b of latest.data || []) {
    const d = await asc(jwt, 'GET', `/v1/buildBetaDetails?filter[build]=${b.id}&limit=1`);
    const a = (d.data || [])[0]?.attributes;
    rows.push({
      v: b.attributes?.version,
      expired: b.attributes?.expired,
      external: a?.externalBuildState,
      internal: a?.internalBuildState,
    });
  }

  const external = (details.data || [])[0]?.attributes?.externalBuildState;
  const reviewState = submission?.data?.attributes?.betaReviewState;
  const approved =
    external === 'IN_BETA_TESTING' ||
    reviewState === 'APPROVED';

  console.log(
    JSON.stringify(
      {
        build: {
          id: BUILD_ID,
          version: build.data?.attributes?.version,
          processingState: build.data?.attributes?.processingState,
          expired: build.data?.attributes?.expired,
        },
        buildBetaDetails: (details.data || []).map((d) => d.attributes),
        betaAppReviewSubmission: submission?.data?.attributes || submission,
        approved,
        recentBuilds: rows,
        publicLink: 'https://testflight.apple.com/join/fEf3DzCz',
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 800));
  process.exit(1);
});
