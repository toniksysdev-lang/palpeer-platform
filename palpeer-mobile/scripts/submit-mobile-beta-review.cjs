/**
 * Submit PALPEER Mobile build 5 for external TestFlight (Beta App Review)
 * and update "What to Test" so it no longer looks like V1.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT = 'toniksystemslab';
const MOBILE_APP = '6826088742';
const MOBILE_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
const BUILD_ID = '8d81654e-463e-4f32-bbfe-6d3a2ee26479'; // v5

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
            edges { node { id } }
          }
        }
      }
    }`,
    { accountName: ACCOUNT },
  );
  for (const e of listData.account.byName.appStoreConnectApiKeysPaginated.edges) {
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
    try {
      await asc(jwt, 'GET', `/v1/betaGroups/${MOBILE_GROUP}`);
      console.log('usingKey=' + key.keyIdentifier);
      return jwt;
    } catch {
      /* next */
    }
  }
  throw new Error('no key');
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
  const jwt = await getJwt(loadSession());

  // Beta App Review Details (contact + notes)
  console.log('=== betaAppReviewDetails ===');
  let reviewDetails = [];
  try {
    reviewDetails = await paginate(
      jwt,
      `/v1/betaAppReviewDetails?filter[app]=${MOBILE_APP}&limit=10`,
    );
  } catch (e) {
    console.log('list reviewDetails ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 300));
  }
  for (const d of reviewDetails) {
    console.log('before=' + JSON.stringify(d.attributes));
    try {
      await asc(jwt, 'PATCH', `/v1/betaAppReviewDetails/${d.id}`, {
        data: {
          type: 'betaAppReviewDetails',
          id: d.id,
          attributes: {
            contactFirstName: d.attributes?.contactFirstName || 'Palpeer',
            contactLastName: d.attributes?.contactLastName || 'Support',
            contactEmail: 'support@palpeer.com',
            contactPhone: d.attributes?.contactPhone || '+17052807122',
            notes:
              'PALPEER Mobile (com.palpeer.app) — current TestFlight app. NOT the legacy V1 Palpeer (com.covenantcodes.palpeer). Please review sign-up, login, P2P offer/share, Talk, and messaging.',
          },
        },
      });
      console.log('patched review details');
    } catch (e) {
      console.log('patch review ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 500));
    }
  }
  if (!reviewDetails.length) {
    try {
      const created = await asc(jwt, 'POST', '/v1/betaAppReviewDetails', {
        data: {
          type: 'betaAppReviewDetails',
          attributes: {
            contactFirstName: 'Palpeer',
            contactLastName: 'Support',
            contactEmail: 'support@palpeer.com',
            contactPhone: '+17052807122',
            notes:
              'PALPEER Mobile (com.palpeer.app) — current TestFlight app. NOT the legacy V1 Palpeer.',
          },
          relationships: {
            app: { data: { type: 'apps', id: MOBILE_APP } },
          },
        },
      });
      console.log('created review details ' + created.data.id);
    } catch (e) {
      console.log('create review ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 500));
    }
  }

  // Current build beta state
  const details = await paginate(
    jwt,
    `/v1/buildBetaDetails?filter[build]=${BUILD_ID}&limit=5`,
  );
  console.log('buildBetaDetails=' + JSON.stringify(details.map((d) => d.attributes)));

  // Existing submissions for this build?
  try {
    const existing = await asc(
      jwt,
      'GET',
      `/v1/builds/${BUILD_ID}/betaAppReviewSubmission`,
    );
    console.log('existing submission=' + JSON.stringify(existing.data?.attributes || existing));
  } catch (e) {
    console.log('no existing submission ' + e.status);
  }

  // Submit for Beta App Review (required for EXTERNAL testers)
  console.log('\n=== Submit betaAppReviewSubmission ===');
  try {
    const sub = await asc(jwt, 'POST', '/v1/betaAppReviewSubmissions', {
      data: {
        type: 'betaAppReviewSubmissions',
        relationships: {
          build: { data: { type: 'builds', id: BUILD_ID } },
        },
      },
    });
    console.log('SUBMITTED=' + JSON.stringify(sub.data));
  } catch (e) {
    console.log('submit ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 800));
  }

  // Re-check state
  const after = await paginate(
    jwt,
    `/v1/buildBetaDetails?filter[build]=${BUILD_ID}&limit=5`,
  );
  console.log('after buildBetaDetails=' + JSON.stringify(after.map((d) => d.attributes)));

  try {
    const sub2 = await asc(jwt, 'GET', `/v1/builds/${BUILD_ID}/betaAppReviewSubmission`);
    console.log('submission now=' + JSON.stringify(sub2.data?.attributes));
  } catch (e) {
    console.log('submission get ' + e.status);
  }

  // Ensure group still has build
  try {
    await asc(jwt, 'POST', `/v1/builds/${BUILD_ID}/relationships/betaGroups`, {
      data: [{ type: 'betaGroups', id: MOBILE_GROUP }],
    });
    console.log('build linked to group');
  } catch (e) {
    console.log('link group ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 200));
  }

  console.log(
    JSON.stringify({
      buildId: BUILD_ID,
      publicLink: 'https://testflight.apple.com/join/fEf3DzCz',
      note:
        'External testers only get the build after Beta App Review approves it (externalBuildState must become IN_BETA_TESTING). Until then they may still see older Mobile builds or leftover V1 installs.',
    }),
  );
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 1500));
  process.exit(1);
});
