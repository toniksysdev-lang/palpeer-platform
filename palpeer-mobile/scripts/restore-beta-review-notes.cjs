/**
 * Restore Mobile betaAppReviewDetails notes (demo account + clear "not V1" wording).
 * Does not print secrets.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT = 'toniksystemslab';
const MOBILE_APP = '6826088742';
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

  const page = await asc(
    jwt,
    'GET',
    `/v1/betaAppReviewDetails?filter[app]=${MOBILE_APP}&limit=10`,
  );
  for (const d of page.data || []) {
    const a = d.attributes || {};
    const demoUser = a.demoAccountName || 'apple.review@palpeer.com';
    const demoPass = a.demoAccountPassword || '';
    const notes = [
      'THIS IS PALPEER MOBILE (com.palpeer.app) — the current app. Do NOT review the legacy V1 Palpeer (com.covenantcodes.palpeer).',
      '',
      'Demo account for App Review (email sign-in):',
      `Username: ${demoUser}`,
      demoPass ? `Password: ${demoPass}` : 'Password: (see demoAccountPassword field)',
      '',
      'After sign-in you can access Home, Wallets, Instant Exchange, P2P, Activity, KYC, Live Chat/Support, Notifications, and Settings.',
      'Sign-in uses email + password on the Sign In screen (not Google). Network access to production API is required.',
    ].join('\n');

    await asc(jwt, 'PATCH', `/v1/betaAppReviewDetails/${d.id}`, {
      data: {
        type: 'betaAppReviewDetails',
        id: d.id,
        attributes: {
          contactFirstName: a.contactFirstName || 'Palpeer',
          contactLastName: a.contactLastName || 'Global',
          contactEmail: a.contactEmail || 'support@palpeer.com',
          contactPhone: a.contactPhone || '+17052807122',
          demoAccountRequired: true,
          demoAccountName: demoUser,
          ...(demoPass ? { demoAccountPassword: demoPass } : {}),
          notes,
        },
      },
    });
    console.log(
      JSON.stringify({
        id: d.id,
        restored: true,
        demoAccountName: demoUser,
        demoPasswordPresent: Boolean(demoPass),
        notesHasNotV1: notes.includes('legacy V1'),
        notesHasDemo: notes.includes('Demo account'),
      }),
    );
  }

  // Check build 4 external state — testers should use that until 5 is approved
  const builds = await asc(
    jwt,
    'GET',
    `/v1/builds?filter[app]=${MOBILE_APP}&sort=-uploadedDate&limit=5&fields[builds]=version,expired,processingState`,
  );
  for (const b of builds.data || []) {
    const details = await asc(
      jwt,
      'GET',
      `/v1/buildBetaDetails?filter[build]=${b.id}&limit=1`,
    ).catch(() => ({ data: [] }));
    const d0 = (details.data || [])[0];
    console.log(
      JSON.stringify({
        v: b.attributes?.version,
        expired: b.attributes?.expired,
        external: d0?.attributes?.externalBuildState,
        internal: d0?.attributes?.internalBuildState,
      }),
    );
  }
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 600));
  process.exit(1);
});
