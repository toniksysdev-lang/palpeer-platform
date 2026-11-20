/**
 * Diagnose + reset a TestFlight tester invite that fails with
 * "already been associated to this app".
 *
 * Usage: node scripts/fix-tf-tester-invite.cjs email@example.com
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const EMAIL = (process.argv[2] || '').trim().toLowerCase();
if (!EMAIL || !EMAIL.includes('@')) {
  console.error('Usage: node scripts/fix-tf-tester-invite.cjs email@example.com');
  process.exit(1);
}

const BETA_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81'; // Palpeer tester (PALPEER Mobile)
const ASC_APP_ID = '6826088742'; // PALPEER Mobile
const ACCOUNT = 'toniksystemslab';
const LEGACY_APP = '6753612161'; // Palpeer (V1)
const LEGACY_GROUP = 'de165dd2-6e36-4500-9716-38a775a6c16c';

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
      console.log('usingKey=' + key.keyIdentifier);
      return jwt;
    } catch (e) {
      console.log('key failed ' + k.keyIdentifier + ' ' + e.message);
    }
  }
  throw new Error('No working ASC key');
}

async function findByEmail(jwt, email) {
  const page = await asc(
    jwt,
    'GET',
    `/v1/betaTesters?filter[email]=${encodeURIComponent(email)}&limit=20`,
  );
  return page.data || [];
}

async function dumpTester(jwt, t) {
  const apps = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/apps?limit=20`).catch(() => ({
    data: [],
  }));
  const groups = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/betaGroups?limit=20`).catch(
    () => ({ data: [] }),
  );
  console.log(
    JSON.stringify(
      {
        id: t.id,
        email: t.attributes?.email,
        firstName: t.attributes?.firstName,
        lastName: t.attributes?.lastName,
        state: t.attributes?.state,
        inviteType: t.attributes?.inviteType,
        apps: (apps.data || []).map((a) => ({ id: a.id, name: a.attributes?.name })),
        groups: (groups.data || []).map((g) => ({ id: g.id, name: g.attributes?.name })),
      },
      null,
      2,
    ),
  );
  return { apps: apps.data || [], groups: groups.data || [] };
}

(async () => {
  const jwt = await getJwt(loadSession());

  const mobileGroup = await asc(
    jwt,
    'GET',
    `/v1/betaGroups/${BETA_GROUP}?fields[betaGroups]=name,publicLink,publicLinkEnabled,isInternalGroup`,
  );
  console.log(
    'mobileGroup=' +
      JSON.stringify({
        id: BETA_GROUP,
        name: mobileGroup.data?.attributes?.name,
        publicLink: mobileGroup.data?.attributes?.publicLink,
        enabled: mobileGroup.data?.attributes?.publicLinkEnabled,
      }),
  );

  let existing = await findByEmail(jwt, EMAIL);
  console.log('foundCount=' + existing.length);
  const details = [];
  for (const t of existing) details.push({ t, ...(await dumpTester(jwt, t)) });

  // Prefer resetting PALPEER Mobile association; keep legacy if present after recreate
  const mobileTesters = details.filter((d) => d.apps.some((a) => a.id === ASC_APP_ID));
  const legacyTesters = details.filter((d) => d.apps.some((a) => a.id === LEGACY_APP));
  const targets = mobileTesters.length ? mobileTesters : details;

  console.log('resetTargets=' + targets.map((d) => d.t.id).join(','));

  for (const d of targets) {
    const id = d.t.id;
    try {
      await asc(jwt, 'DELETE', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
        data: [{ type: 'betaTesters', id }],
      });
      console.log('removed from Palpeer tester ' + id);
    } catch (e) {
      console.log('remove mobile group ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 200));
    }
    try {
      await asc(jwt, 'DELETE', `/v1/betaTesters/${id}/relationships/apps`, {
        data: [{ type: 'apps', id: ASC_APP_ID }],
      });
      console.log('removed PALPEER Mobile app access ' + id);
    } catch (e) {
      console.log('remove mobile app ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 250));
    }
    // If this tester record only had mobile (or is orphaned), delete it
    const remainingApps = (d.apps || []).filter((a) => a.id !== ASC_APP_ID);
    if (!remainingApps.length) {
      try {
        await asc(jwt, 'DELETE', `/v1/betaTesters/${id}`);
        console.log('deleted tester ' + id);
      } catch (e) {
        console.log('delete ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 250));
      }
    }
  }

  await new Promise((r) => setTimeout(r, 2500));

  existing = await findByEmail(jwt, EMAIL);
  console.log('afterCleanup foundCount=' + existing.length);
  for (const t of existing) await dumpTester(jwt, t);

  // Ensure on mobile group
  let onMobile = false;
  for (const t of existing) {
    const apps = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/apps?limit=20`);
    if ((apps.data || []).some((a) => a.id === ASC_APP_ID)) {
      onMobile = true;
      try {
        await asc(jwt, 'POST', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
          data: [{ type: 'betaTesters', id: t.id }],
        });
        console.log('linked existing to Palpeer tester');
      } catch (e) {
        console.log('link group ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 250));
      }
      try {
        await asc(jwt, 'POST', '/v1/betaTesterInvitations', {
          data: {
            type: 'betaTesterInvitations',
            relationships: {
              app: { data: { type: 'apps', id: ASC_APP_ID } },
              betaTester: { data: { type: 'betaTesters', id: t.id } },
            },
          },
        });
        console.log('INVITED (existing) ' + EMAIL);
      } catch (e) {
        console.log(
          'invite existing ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 400),
        );
      }
    }
  }

  if (!onMobile) {
    const created = await asc(jwt, 'POST', '/v1/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: {
          email: EMAIL,
          firstName: EMAIL.split('@')[0].slice(0, 20),
          lastName: 'Tester',
        },
        relationships: {
          betaGroups: { data: [{ type: 'betaGroups', id: BETA_GROUP }] },
        },
      },
    });
    const testerId = created.data.id;
    console.log('created tester ' + testerId);
    try {
      await asc(jwt, 'POST', '/v1/betaTesterInvitations', {
        data: {
          type: 'betaTesterInvitations',
          relationships: {
            app: { data: { type: 'apps', id: ASC_APP_ID } },
            betaTester: { data: { type: 'betaTesters', id: testerId } },
          },
        },
      });
      console.log('INVITED ' + EMAIL);
    } catch (e) {
      console.log('invite ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 500));
    }
  }

  // If they were only on legacy V1 and that caused confusion, leave legacy unless we wiped it
  const final = await findByEmail(jwt, EMAIL);
  console.log('=== FINAL ===');
  for (const t of final) await dumpTester(jwt, t);
  console.log(
    JSON.stringify(
      {
        email: EMAIL,
        publicLink: mobileGroup.data?.attributes?.publicLink,
        note:
          'If TestFlight still shows V1 Beta / old app, open the public link while signed into the same Apple ID, or remove the old Palpeer (V1) invite in TestFlight.',
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
