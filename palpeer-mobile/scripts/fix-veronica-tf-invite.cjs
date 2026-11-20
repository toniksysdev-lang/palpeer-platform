/**
 * Investigate + force-resend TestFlight invite for veronica.oladipo@palpeer.com.
 * ALREADY_ACCEPTED blocks invite emails; remove from app then recreate tester.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BETA_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
const ASC_APP_ID = '6826088742';
const ACCOUNT = 'toniksystemslab';
const EMAIL = 'veronica.oladipo@palpeer.com';

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
  console.log('--- tester ---');
  console.log(
    JSON.stringify(
      {
        id: t.id,
        email: t.attributes?.email,
        firstName: t.attributes?.firstName,
        lastName: t.attributes?.lastName,
        state: t.attributes?.state,
        inviteType: t.attributes?.inviteType,
      },
      null,
      2,
    ),
  );
  try {
    const apps = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/apps?limit=20`);
    console.log(
      'apps=' +
        JSON.stringify((apps.data || []).map((a) => ({ id: a.id, name: a.attributes?.name }))),
    );
  } catch (e) {
    console.log('apps err ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 200));
  }
  try {
    const groups = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/betaGroups?limit=20`);
    console.log(
      'groups=' +
        JSON.stringify((groups.data || []).map((g) => ({ id: g.id, name: g.attributes?.name }))),
    );
  } catch (e) {
    console.log('groups err ' + e.status);
  }
}

(async () => {
  const jwt = await getJwt(loadSession());

  const group = await asc(
    jwt,
    'GET',
    `/v1/betaGroups/${BETA_GROUP}?fields[betaGroups]=name,publicLink,publicLinkEnabled`,
  );
  console.log('publicLink=' + group.data?.attributes?.publicLink);

  let existing = await findByEmail(jwt, EMAIL);
  console.log('foundCount=' + existing.length);
  for (const t of existing) await dumpTester(jwt, t);

  // Try invite first (expect ALREADY_ACCEPTED)
  if (existing.length) {
    const t = existing[0];
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
      console.log('INVITE_OK without recreate');
      process.exit(0);
    } catch (e) {
      console.log(
        'invite blocked: ' +
          e.status +
          ' ' +
          JSON.stringify(e.body || {}).slice(0, 400),
      );
    }
  }

  // Force reset: remove from group + remove app access, then delete tester if possible
  for (const t of existing) {
    try {
      await asc(jwt, 'DELETE', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
        data: [{ type: 'betaTesters', id: t.id }],
      });
      console.log('removed from group ' + t.id);
    } catch (e) {
      console.log('remove group ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 200));
    }

    try {
      await asc(jwt, 'DELETE', `/v1/betaTesters/${t.id}/relationships/apps`, {
        data: [{ type: 'apps', id: ASC_APP_ID }],
      });
      console.log('removed app access ' + t.id);
    } catch (e) {
      console.log('remove apps ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 300));
    }

    try {
      await asc(jwt, 'DELETE', `/v1/betaTesters/${t.id}`);
      console.log('deleted tester ' + t.id);
    } catch (e) {
      console.log('delete tester ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 300));
    }
  }

  // Brief pause so ASC settles
  await new Promise((r) => setTimeout(r, 2000));

  existing = await findByEmail(jwt, EMAIL);
  console.log('afterCleanup foundCount=' + existing.length);
  for (const t of existing) await dumpTester(jwt, t);

  // Recreate via betaGroups only (ASC rejects apps on CREATE)
  let testerId = existing[0]?.id;
  if (!testerId) {
    const created = await asc(jwt, 'POST', '/v1/betaTesters', {
      data: {
        type: 'betaTesters',
        attributes: {
          email: EMAIL,
          firstName: 'Veronica',
          lastName: 'Oladipo',
        },
        relationships: {
          betaGroups: { data: [{ type: 'betaGroups', id: BETA_GROUP }] },
        },
      },
    });
    testerId = created.data.id;
    console.log('created tester ' + testerId);
  } else {
    try {
      await asc(jwt, 'POST', `/v1/betaGroups/${BETA_GROUP}/relationships/betaTesters`, {
        data: [{ type: 'betaTesters', id: testerId }],
      });
      console.log('re-added to group');
    } catch (e) {
      console.log('re-add group ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 300));
    }
  }

  // Send invitation
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
    console.log(
      'final invite failed ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 500),
    );
  }

  const final = await findByEmail(jwt, EMAIL);
  for (const t of final) await dumpTester(jwt, t);

  // Restore tester on legacy Palpeer app if missing (cleanup may have removed it)
  const LEGACY_APP = '6753612161';
  const LEGACY_GROUP = 'de165dd2-6e36-4500-9716-38a775a6c16c';
  try {
    const all = await findByEmail(jwt, EMAIL);
    const onLegacy = [];
    for (const t of all) {
      const apps = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/apps?limit=20`);
      if ((apps.data || []).some((a) => a.id === LEGACY_APP)) onLegacy.push(t.id);
    }
    if (!onLegacy.length) {
      const created = await asc(jwt, 'POST', '/v1/betaTesters', {
        data: {
          type: 'betaTesters',
          attributes: {
            email: EMAIL,
            firstName: 'Veronica',
            lastName: 'Oladipo',
          },
          relationships: {
            betaGroups: { data: [{ type: 'betaGroups', id: LEGACY_GROUP }] },
          },
        },
      });
      console.log('restored legacy Palpeer tester ' + created.data.id);
    } else {
      console.log('legacy Palpeer already present ' + onLegacy.join(','));
    }
  } catch (e) {
    console.log(
      'legacy restore skipped ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 300),
    );
  }

  console.log(
    JSON.stringify(
      {
        email: EMAIL,
        testerId,
        publicLink: group.data?.attributes?.publicLink,
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
