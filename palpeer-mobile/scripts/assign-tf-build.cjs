/**
 * Assign the latest valid iOS build to the external TestFlight beta group.
 * That triggers App Store Connect / TestFlight emails for group members.
 * Excludes any email containing "covenant" when printing the audience.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BETA_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
const ASC_APP_ID = '6826088742';
const ACCOUNT = 'toniksystemslab';
const EXCLUDE_SUBSTRING = 'covenant';

function loadSession() {
  const state = JSON.parse(
    fs.readFileSync(path.join(process.env.USERPROFILE, '.expo', 'state.json'), 'utf8'),
  );
  const session = state?.auth?.sessionSecret || state?.sessionSecret;
  if (!session) throw new Error('No Expo session');
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
  const keys = listData.account.byName.appStoreConnectApiKeysPaginated.edges.map((e) => e.node);
  let jwt = null;
  for (const k of keys) {
    try {
      const detail = await gql(
        session,
        `query ($id: ID!) {
          appStoreConnectApiKey { byId(id: $id) { keyIdentifier issuerIdentifier keyP8 } }
        }`,
        { id: k.id },
      );
      const key = detail.appStoreConnectApiKey.byId;
      jwt = makeJwt({
        keyP8: key.keyP8,
        keyId: key.keyIdentifier,
        issuerId: key.issuerIdentifier,
      });
      await asc(jwt, 'GET', `/v1/betaGroups/${BETA_GROUP}`);
      break;
    } catch {
      jwt = null;
    }
  }
  if (!jwt) throw new Error('No working ASC API key');

  const builds = await asc(
    jwt,
    'GET',
    `/v1/builds?filter[app]=${ASC_APP_ID}&sort=-uploadedDate&limit=10&fields[builds]=version,uploadedDate,processingState,expired`,
  );
  let build = null;
  for (const b of builds.data || []) {
    const state = (b.attributes?.processingState || '').toUpperCase();
    if (b.attributes?.expired) continue;
    if (state === 'FAILED' || state === 'INVALID') continue;
    build = b;
    break;
  }
  if (!build) throw new Error('No valid build to assign');
  console.log(
    'assignBuild=' +
      JSON.stringify({
        id: build.id,
        version: build.attributes?.version,
        state: build.attributes?.processingState,
      }),
  );

  try {
    await asc(jwt, 'POST', `/v1/builds/${build.id}/relationships/betaGroups`, {
      data: [{ type: 'betaGroups', id: BETA_GROUP }],
    });
    console.log('assigned build to Palpeer tester group');
  } catch (e) {
    console.log('assign status=' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 400));
  }

  // Resend via betaTesterInvitations without build relationship (ASC API shape).
  let url = `/v1/betaGroups/${BETA_GROUP}/betaTesters?limit=200`;
  const testers = [];
  while (url) {
    const page = await asc(jwt, 'GET', url);
    testers.push(...(page.data || []));
    url = page.links?.next
      ? page.links.next.replace('https://api.appstoreconnect.apple.com', '')
      : null;
  }

  const invited = [];
  const skipped = [];
  const failed = [];
  for (const t of testers) {
    const email = (t.attributes?.email || '').toLowerCase();
    if (!email) continue;
    if (email.includes(EXCLUDE_SUBSTRING) || email === 'covenantifeoluwa4@gmail.com') {
      skipped.push(email);
      continue;
    }
    try {
      await asc(jwt, 'POST', '/v1/betaTesterInvitations', {
        data: {
          type: 'betaTesterInvitations',
          relationships: {
            betaTester: { data: { type: 'betaTesters', id: t.id } },
            build: { data: { type: 'builds', id: build.id } },
          },
        },
      });
      invited.push(email);
      console.log('invited ' + email);
    } catch (e) {
      // Fallback: re-link in group (often re-sends the TestFlight email).
      try {
        try {
          await asc(jwt, 'DELETE', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
            data: [{ type: 'betaTesters', id: t.id }],
          });
        } catch {
          /* ignore */
        }
        await asc(jwt, 'POST', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
          data: [{ type: 'betaTesters', id: t.id }],
        });
        invited.push(email + ' (relinked)');
        console.log('relinked ' + email);
      } catch (e2) {
        failed.push(email);
        console.log('failed ' + email + ' ' + e.status + '/' + e2.status);
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        skipped,
        invited,
        failed,
        buildId: build.id,
        buildVersion: build.attributes?.version,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body).slice(0, 800));
  process.exit(1);
});
