/**
 * Stop iOS testers landing on old V1 Palpeer:
 * - disable V1 public link
 * - remove external testers from V1 Testers (keep Mobile)
 * - ensure build 5 on Palpeer tester + resend Mobile invites
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT = 'toniksystemslab';
const MOBILE_APP = '6826088742';
const MOBILE_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
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

  // 1) Disable V1 public link
  try {
    const before = await asc(
      jwt,
      'GET',
      `/v1/betaGroups/${V1_GROUP}?fields[betaGroups]=name,publicLink,publicLinkEnabled`,
    );
    console.log('V1 before=' + JSON.stringify(before.data?.attributes));
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
    console.log('V1 after=' + JSON.stringify(after.data?.attributes));
  } catch (e) {
    console.log('disable V1 link ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 400));
  }

  // 2) Remove external testers from V1 (drops old app from their TestFlight)
  const v1Testers = await paginate(jwt, `/v1/betaGroups/${V1_GROUP}/betaTesters?limit=200`);
  const removed = [];
  for (const t of v1Testers) {
    const email = (t.attributes?.email || '').toLowerCase();
    if (!email) continue;
    try {
      await asc(jwt, 'DELETE', `/v1/betaGroups/${V1_GROUP}/relationships/betaTesters`, {
        data: [{ type: 'betaTesters', id: t.id }],
      });
      removed.push(email);
      console.log('REMOVED from V1 ' + email);
    } catch (e) {
      console.log('remove V1 ' + email + ' ' + e.status);
    }
    // Also strip V1 app access so association clears
    try {
      await asc(jwt, 'DELETE', `/v1/betaTesters/${t.id}/relationships/apps`, {
        data: [{ type: 'apps', id: '6753612161' }],
      });
      console.log('stripped V1 app ' + email);
    } catch (e) {
      console.log('strip V1 app ' + email + ' ' + e.status);
    }
  }

  // 3) Assign latest Mobile build + invite Mobile invites
  const builds = await paginate(
    jwt,
    `/v1/builds?filter[app]=${MOBILE_APP}&sort=-uploadedDate&limit=10&fields[builds]=version,uploadedDate,processingState,expired`,
  );
  const build = builds.find((b) => {
    const a = b.attributes || {};
    const state = (a.processingState || '').toUpperCase();
    return !a.expired && state !== 'FAILED' && state !== 'INVALID';
  });
  if (build) {
    try {
      await asc(jwt, 'POST', `/v1/builds/${build.id}/relationships/betaGroups`, {
        data: [{ type: 'betaGroups', id: MOBILE_GROUP }],
      });
      console.log('Mobile build assigned v=' + build.attributes?.version);
    } catch (e) {
      console.log('assign ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 250));
    }
  }

  const mobileTesters = await paginate(
    jwt,
    `/v1/betaGroups/${MOBILE_GROUP}/betaTesters?limit=200`,
  );
  const invited = [];
  const accepted = [];
  for (const t of mobileTesters) {
    const email = (t.attributes?.email || '').toLowerCase();
    if (!email || EXCLUDE.test(email)) continue;
    try {
      await asc(jwt, 'POST', '/v1/betaTesterInvitations', {
        data: {
          type: 'betaTesterInvitations',
          relationships: {
            app: { data: { type: 'apps', id: MOBILE_APP } },
            betaTester: { data: { type: 'betaTesters', id: t.id } },
          },
        },
      });
      invited.push(email);
      console.log('INVITED Mobile ' + email);
    } catch (e) {
      if (String(JSON.stringify(e.body || {})).includes('ALREADY_ACCEPTED')) {
        accepted.push(email);
        console.log('already accepted Mobile ' + email);
      } else {
        console.log('invite ' + email + ' ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 200));
      }
    }
  }

  const mobileMeta = await asc(
    jwt,
    'GET',
    `/v1/betaGroups/${MOBILE_GROUP}?fields[betaGroups]=name,publicLink,publicLinkEnabled`,
  );

  console.log(
    JSON.stringify(
      {
        removedFromV1: removed,
        mobileInvited: invited,
        mobileAlreadyAccepted: accepted,
        mobileBuild: build
          ? { id: build.id, version: build.attributes?.version }
          : null,
        mobilePublicLink: mobileMeta.data?.attributes?.publicLink,
        testerMessage:
          'In TestFlight, open PALPEER Mobile (com.palpeer.app), not Palpeer. Delete the old Palpeer app if still installed. Link: ' +
          (mobileMeta.data?.attributes?.publicLink || ''),
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
