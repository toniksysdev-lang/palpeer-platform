/**
 * Diagnose TestFlight invite delivery and try working invite methods.
 * Excludes emails containing "covenant".
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BETA_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
const ASC_APP_ID = '6826088742';
const ACCOUNT = 'toniksystemslab';
const EXCLUDE = 'covenant';

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
  const keys = listData.account.byName.appStoreConnectApiKeysPaginated.edges.map((e) => e.node);
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
      const jwt = makeJwt({
        keyP8: key.keyP8,
        keyId: key.keyIdentifier,
        issuerId: key.issuerIdentifier,
      });
      await asc(jwt, 'GET', `/v1/betaGroups/${BETA_GROUP}`);
      return jwt;
    } catch {
      /* try next */
    }
  }
  throw new Error('No working ASC key');
}

(async () => {
  const jwt = await getJwt(loadSession());

  // Beta group details + public link
  const group = await asc(
    jwt,
    'GET',
    `/v1/betaGroups/${BETA_GROUP}?fields[betaGroups]=name,isInternalGroup,publicLinkEnabled,publicLink,publicLinkLimit,publicLinkLimitEnabled,feedbackEnabled,hasAccessToAllBuilds`,
  );
  console.log('=== GROUP ===');
  console.log(JSON.stringify(group.data?.attributes || {}, null, 2));

  // Recent ASC builds
  const builds = await asc(
    jwt,
    'GET',
    `/v1/builds?filter[app]=${ASC_APP_ID}&sort=-uploadedDate&limit=8&fields[builds]=version,uploadedDate,processingState,expired,usesNonExemptEncryption`,
  );
  console.log('=== ASC BUILDS ===');
  for (const b of builds.data || []) {
    const a = b.attributes || {};
    console.log(
      `${b.id} | v=${a.version} | state=${a.processingState} | expired=${a.expired} | uploaded=${a.uploadedDate}`,
    );
  }

  const valid = (builds.data || []).find((b) => {
    const a = b.attributes || {};
    const state = (a.processingState || '').toUpperCase();
    return !a.expired && state !== 'FAILED' && state !== 'INVALID';
  });
  if (!valid) throw new Error('No valid ASC build');
  console.log('usingBuild=' + valid.id + ' v=' + valid.attributes?.version);

  // Groups for this build
  try {
    const bg = await asc(jwt, 'GET', `/v1/builds/${valid.id}/betaGroups`);
    console.log(
      'buildBetaGroups=' +
        JSON.stringify((bg.data || []).map((g) => ({ id: g.id, name: g.attributes?.name }))),
    );
  } catch (e) {
    console.log('buildBetaGroups error ' + e.status + ' ' + JSON.stringify(e.body).slice(0, 300));
  }

  // Ensure build is in external group
  try {
    await asc(jwt, 'POST', `/v1/builds/${valid.id}/relationships/betaGroups`, {
      data: [{ type: 'betaGroups', id: BETA_GROUP }],
    });
    console.log('assigned build -> Palpeer tester');
  } catch (e) {
    console.log('assign ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 400));
  }

  // List group testers
  const testersPage = await asc(jwt, 'GET', `/v1/betaGroups/${BETA_GROUP}/betaTesters?limit=200`);
  const testers = (testersPage.data || []).filter((t) => {
    const email = (t.attributes?.email || '').toLowerCase();
    return email && !email.includes(EXCLUDE);
  });
  console.log('inviteAudience=' + testers.map((t) => t.attributes.email).sort().join(','));

  // Try invite payloads
  const sample = testers[0];
  if (sample) {
    const attempts = [
      {
        name: 'invitation_with_build',
        body: {
          data: {
            type: 'betaTesterInvitations',
            relationships: {
              build: { data: { type: 'builds', id: valid.id } },
              betaTester: { data: { type: 'betaTesters', id: sample.id } },
            },
          },
        },
      },
      {
        name: 'invitation_build_only_first',
        body: {
          data: {
            type: 'betaTesterInvitations',
            relationships: {
              betaTester: { data: { type: 'betaTesters', id: sample.id } },
              build: { data: { type: 'builds', id: valid.id } },
            },
          },
        },
      },
    ];
    for (const attempt of attempts) {
      try {
        await asc(jwt, 'POST', '/v1/betaTesterInvitations', attempt.body);
        console.log('OK ' + attempt.name + ' for ' + sample.attributes.email);
      } catch (e) {
        console.log(
          'FAIL ' +
            attempt.name +
            ' ' +
            e.status +
            ' ' +
            JSON.stringify(e.body || {}).slice(0, 500),
        );
      }
    }
  }

  // Per-tester: delete + recreate tester invite via adding to group after brief remove
  // and also try POST betaTesters with email again
  const results = { resent: [], failed: [] };
  for (const t of testers) {
    const email = t.attributes.email;
    try {
      // Remove from group
      try {
        await asc(jwt, 'DELETE', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
          data: [{ type: 'betaTesters', id: t.id }],
        });
      } catch {
        /* ignore */
      }
      // Create fresh invitation resource if API supports email-only create
      try {
        await asc(jwt, 'POST', '/v1/betaTesterInvitations', {
          data: {
            type: 'betaTesterInvitations',
            relationships: {
              build: { data: { type: 'builds', id: valid.id } },
              betaTester: { data: { type: 'betaTesters', id: t.id } },
            },
          },
        });
        results.resent.push(email + ':invitation');
        console.log('invited ' + email);
        continue;
      } catch (invErr) {
        // Re-add to group (Apple often emails on add for INVITED users)
        await asc(jwt, 'POST', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
          data: [{ type: 'betaTesters', id: t.id }],
        });
        results.resent.push(email + ':relink');
        console.log('relinked ' + email + ' (inviteAPI ' + invErr.status + ')');
      }
    } catch (e) {
      results.failed.push({ email, status: e.status, body: e.body });
      console.log('failed ' + email);
    }
  }

  // Public link
  const g2 = await asc(
    jwt,
    'GET',
    `/v1/betaGroups/${BETA_GROUP}?fields[betaGroups]=publicLink,publicLinkEnabled,name`,
  );
  console.log(
    JSON.stringify(
      {
        publicLink: g2.data?.attributes?.publicLink,
        publicLinkEnabled: g2.data?.attributes?.publicLinkEnabled,
        results,
        build: { id: valid.id, version: valid.attributes?.version, state: valid.attributes?.processingState },
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 1000));
  process.exit(1);
});
