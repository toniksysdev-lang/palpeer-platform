/**
 * Investigate why testers see old V1 Palpeer instead of PALPEER Mobile.
 * List both apps' groups/testers/builds; move external testers onto Mobile;
 * assign latest valid Mobile build; resend Mobile invites (exclude covenant).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT = 'toniksystemslab';
const MOBILE_APP = '6826088742';
const MOBILE_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
const V1_APP = '6753612161';
const V1_GROUP = 'de165dd2-6e36-4500-9716-38a775a6c16c';
const EXCLUDE = /covenant/i;

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
      await asc(jwt, 'GET', `/v1/apps/${MOBILE_APP}`);
      console.log('usingKey=' + key.keyIdentifier);
      return jwt;
    } catch (err) {
      console.log('key fail ' + e.node.keyIdentifier);
    }
  }
  throw new Error('no ASC key');
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

async function summarizeApp(jwt, appId, label) {
  const app = await asc(jwt, 'GET', `/v1/apps/${appId}?fields[apps]=name,bundleId`);
  const groups = await paginate(jwt, `/v1/apps/${appId}/betaGroups?limit=50`);
  const builds = await paginate(
    jwt,
    `/v1/builds?filter[app]=${appId}&sort=-uploadedDate&limit=10&fields[builds]=version,uploadedDate,processingState,expired`,
  );
  console.log(`\n=== ${label} ===`);
  console.log(
    JSON.stringify({
      id: appId,
      name: app.data?.attributes?.name,
      bundleId: app.data?.attributes?.bundleId,
    }),
  );
  for (const g of groups) {
    const testers = await paginate(jwt, `/v1/betaGroups/${g.id}/betaTesters?limit=200`);
    console.log(
      JSON.stringify({
        groupId: g.id,
        name: g.attributes?.name,
        publicLink: g.attributes?.publicLink,
        publicLinkEnabled: g.attributes?.publicLinkEnabled,
        isInternalGroup: g.attributes?.isInternalGroup,
        testerCount: testers.length,
        emails: testers.map((t) => t.attributes?.email).filter(Boolean).sort(),
      }),
    );
  }
  console.log(
    'builds=' +
      JSON.stringify(
        builds.slice(0, 5).map((b) => ({
          id: b.id,
          v: b.attributes?.version,
          state: b.attributes?.processingState,
          expired: b.attributes?.expired,
          uploaded: b.attributes?.uploadedDate,
        })),
      ),
  );
  return { app, groups, builds, testersByGroup: null };
}

(async () => {
  const jwt = await getJwt(loadSession());

  await summarizeApp(jwt, V1_APP, 'OLD V1 Palpeer');
  const mobile = await summarizeApp(jwt, MOBILE_APP, 'NEW PALPEER Mobile');

  const v1Testers = await paginate(jwt, `/v1/betaGroups/${V1_GROUP}/betaTesters?limit=200`);
  const mobileTesters = await paginate(
    jwt,
    `/v1/betaGroups/${MOBILE_GROUP}/betaTesters?limit=200`,
  );
  const mobileEmails = new Set(
    mobileTesters.map((t) => (t.attributes?.email || '').toLowerCase()).filter(Boolean),
  );

  const mobileGroupMeta = await asc(
    jwt,
    'GET',
    `/v1/betaGroups/${MOBILE_GROUP}?fields[betaGroups]=name,publicLink,publicLinkEnabled`,
  );
  console.log('\n=== ACTION: ensure V1 emails are on Mobile ===');

  const results = { alreadyOnMobile: [], added: [], invited: [], failed: [], skipped: [] };

  for (const t of v1Testers) {
    const email = (t.attributes?.email || '').toLowerCase();
    if (!email) continue;
    if (EXCLUDE.test(email)) {
      results.skipped.push(email);
      continue;
    }
    if (mobileEmails.has(email)) {
      results.alreadyOnMobile.push(email);
      continue;
    }

    // Create/link Mobile tester
    let mobileId = null;
    const found = await asc(
      jwt,
      'GET',
      `/v1/betaTesters?filter[email]=${encodeURIComponent(email)}&limit=20`,
    );
    for (const cand of found.data || []) {
      const apps = await asc(jwt, 'GET', `/v1/betaTesters/${cand.id}/apps?limit=20`).catch(() => ({
        data: [],
      }));
      if ((apps.data || []).some((a) => a.id === MOBILE_APP)) {
        mobileId = cand.id;
        break;
      }
    }

    try {
      if (!mobileId) {
        const created = await asc(jwt, 'POST', '/v1/betaTesters', {
          data: {
            type: 'betaTesters',
            attributes: {
              email,
              firstName: (t.attributes?.firstName || email.split('@')[0]).slice(0, 30),
              lastName: (t.attributes?.lastName || 'Tester').slice(0, 30),
            },
            relationships: {
              betaGroups: { data: [{ type: 'betaGroups', id: MOBILE_GROUP }] },
            },
          },
        });
        mobileId = created.data.id;
        results.added.push(email);
        console.log('ADDED ' + email);
      } else {
        await asc(jwt, 'POST', `/v1/betaGroups/${MOBILE_GROUP}/relationships/betaTesters`, {
          data: [{ type: 'betaTesters', id: mobileId }],
        });
        results.added.push(email + ' (linked)');
        console.log('LINKED ' + email);
      }

      try {
        await asc(jwt, 'POST', '/v1/betaTesterInvitations', {
          data: {
            type: 'betaTesterInvitations',
            relationships: {
              app: { data: { type: 'apps', id: MOBILE_APP } },
              betaTester: { data: { type: 'betaTesters', id: mobileId } },
            },
          },
        });
        results.invited.push(email);
        console.log('INVITED Mobile ' + email);
      } catch (e) {
        console.log(
          'invite ' + email + ' ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 220),
        );
        if (e.status === 409) results.alreadyOnMobile.push(email + ' (accepted)');
        else results.failed.push(email);
      }
    } catch (e) {
      results.failed.push(email);
      console.log('fail ' + email + ' ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 250));
    }
  }

  // Assign latest valid Mobile build to Palpeer tester
  const build = (mobile.builds || []).find((b) => {
    const a = b.attributes || {};
    const state = (a.processingState || '').toUpperCase();
    return !a.expired && state !== 'FAILED' && state !== 'INVALID';
  });
  if (build) {
    try {
      await asc(jwt, 'POST', `/v1/builds/${build.id}/relationships/betaGroups`, {
        data: [{ type: 'betaGroups', id: MOBILE_GROUP }],
      });
      console.log('assigned build v=' + build.attributes?.version + ' id=' + build.id);
    } catch (e) {
      console.log('assign build ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 300));
    }
  }

  // Optionally disable V1 public confusion: leave V1 testers but print warning
  console.log(
    JSON.stringify(
      {
        results,
        mobilePublicLink: mobileGroupMeta.data?.attributes?.publicLink,
        assignedBuild: build
          ? { id: build.id, version: build.attributes?.version }
          : null,
        note:
          'Testers must open PALPEER Mobile (not V1 Palpeer). Use Mobile public link. V1 group still exists and can confuse email Accept screens.',
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 1500));
  process.exit(1);
});
