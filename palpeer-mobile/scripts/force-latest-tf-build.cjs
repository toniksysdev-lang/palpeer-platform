/**
 * Force external testers onto latest Mobile build without re-inviting:
 * - keep only latest VALID build in the tester group
 * - expire older Mobile builds still in beta testing
 * - ensure autoNotifyEnabled on latest
 * - confirm V1 external link stays off / builds expired
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNT = 'toniksystemslab';
const MOBILE_APP = '6826088742';
const MOBILE_GROUP = '96e35b07-e000-459f-8b86-c87722a5bf81';
const V1_APP = '6753612161';
const V1_GROUP = 'de165dd2-6e36-4500-9716-38a775a6c16c';

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
    const token = makeJwt({
      keyP8: key.keyP8,
      keyId: key.keyIdentifier,
      issuerId: key.issuerIdentifier,
    });
    try {
      await asc(token, 'GET', `/v1/betaGroups/${MOBILE_GROUP}`);
      console.log('usingKey=' + key.keyIdentifier);
      return token;
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

  const builds = await paginate(
    jwt,
    `/v1/builds?filter[app]=${MOBILE_APP}&sort=-uploadedDate&limit=30&fields[builds]=version,processingState,expired,uploadedDate`,
  );

  const enriched = [];
  for (const b of builds) {
    const det = await asc(jwt, 'GET', `/v1/buildBetaDetails?filter[build]=${b.id}&limit=1`).catch(
      () => ({ data: [] }),
    );
    const a = (det.data || [])[0]?.attributes;
    enriched.push({
      id: b.id,
      detailId: (det.data || [])[0]?.id,
      v: b.attributes?.version,
      state: b.attributes?.processingState,
      expired: b.attributes?.expired,
      external: a?.externalBuildState,
      internal: a?.internalBuildState,
      autoNotify: a?.autoNotifyEnabled,
    });
  }
  console.log('mobileBuilds=' + JSON.stringify(enriched.slice(0, 10), null, 2));

  const latest = enriched.find(
    (b) => !b.expired && b.state === 'VALID' && b.external === 'IN_BETA_TESTING',
  );
  if (!latest) {
    console.log('ERROR: no external IN_BETA_TESTING build');
    process.exit(2);
  }
  console.log('latestExternal=' + latest.v + ' ' + latest.id);

  // Ensure latest is on the external group
  try {
    await asc(jwt, 'POST', `/v1/builds/${latest.id}/relationships/betaGroups`, {
      data: [{ type: 'betaGroups', id: MOBILE_GROUP }],
    });
    console.log('assigned latest to group');
  } catch (e) {
    console.log('assign ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 200));
  }

  if (latest.detailId && latest.autoNotify !== true) {
    try {
      await asc(jwt, 'PATCH', `/v1/buildBetaDetails/${latest.detailId}`, {
        data: {
          type: 'buildBetaDetails',
          id: latest.detailId,
          attributes: { autoNotifyEnabled: true },
        },
      });
      console.log('autoNotify enabled on v=' + latest.v);
    } catch (e) {
      console.log('autoNotify ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 200));
    }
  }

  // Remove older builds from the external group, then expire them so TestFlight pushes Update
  const groupBuilds = await paginate(
    jwt,
    `/v1/betaGroups/${MOBILE_GROUP}/builds?limit=50&fields[builds]=version,expired`,
  );
  console.log(
    'groupBuildsBefore=' +
      JSON.stringify(groupBuilds.map((b) => ({ id: b.id, v: b.attributes?.version, expired: b.attributes?.expired }))),
  );

  for (const b of groupBuilds) {
    if (b.id === latest.id) continue;
    try {
      await asc(jwt, 'DELETE', `/v1/builds/${b.id}/relationships/betaGroups`, {
        data: [{ type: 'betaGroups', id: MOBILE_GROUP }],
      });
      console.log('unlinked from group v=' + b.attributes?.version);
    } catch (e) {
      // alternate relationship delete shape
      try {
        await asc(jwt, 'DELETE', `/v1/betaGroups/${MOBILE_GROUP}/relationships/builds`, {
          data: [{ type: 'builds', id: b.id }],
        });
        console.log('unlinked via group v=' + b.attributes?.version);
      } catch (e2) {
        console.log(
          'unlink v=' +
            b.attributes?.version +
            ' ' +
            e.status +
            '/' +
            e2.status +
            ' ' +
            JSON.stringify(e2.body || e.body || {}).slice(0, 200),
        );
      }
    }
  }

  const expired = [];
  for (const b of enriched) {
    if (b.id === latest.id) continue;
    if (b.expired) continue;
    // Expire previous external builds so devices can't stay on them
    if (b.external === 'IN_BETA_TESTING' || String(b.v) === '5' || String(b.v) === '4') {
      try {
        await asc(jwt, 'PATCH', `/v1/builds/${b.id}`, {
          data: { type: 'builds', id: b.id, attributes: { expired: true } },
        });
        expired.push(b.v);
        console.log('EXPIRED mobile v=' + b.v);
      } catch (e) {
        console.log('expire v=' + b.v + ' ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 200));
      }
    }
  }

  // V1: keep public link off; expire any non-expired builds
  try {
    await asc(jwt, 'PATCH', `/v1/betaGroups/${V1_GROUP}`, {
      data: {
        type: 'betaGroups',
        id: V1_GROUP,
        attributes: { publicLinkEnabled: false },
      },
    });
    console.log('V1 publicLinkEnabled=false');
  } catch (e) {
    console.log('V1 link ' + e.status);
  }
  const v1Builds = await paginate(
    jwt,
    `/v1/builds?filter[app]=${V1_APP}&sort=-uploadedDate&limit=15&fields[builds]=version,expired`,
  );
  for (const b of v1Builds) {
    if (b.attributes?.expired) continue;
    try {
      await asc(jwt, 'PATCH', `/v1/builds/${b.id}`, {
        data: { type: 'builds', id: b.id, attributes: { expired: true } },
      });
      console.log('EXPIRED V1 v=' + b.attributes?.version);
    } catch (e) {
      console.log('V1 expire ' + e.status);
    }
  }

  const groupAfter = await paginate(
    jwt,
    `/v1/betaGroups/${MOBILE_GROUP}/builds?limit=20&fields[builds]=version,expired`,
  );
  const groupMeta = await asc(
    jwt,
    'GET',
    `/v1/betaGroups/${MOBILE_GROUP}?fields[betaGroups]=name,publicLink,publicLinkEnabled`,
  );

  console.log(
    JSON.stringify(
      {
        latestBuild: latest.v,
        expiredMobile: expired,
        groupBuildsAfter: groupAfter.map((b) => ({
          v: b.attributes?.version,
          expired: b.attributes?.expired,
        })),
        publicLink: groupMeta.data?.attributes?.publicLink,
        testerSteps: [
          'Open TestFlight (not the home-screen app icon alone).',
          'Select PALPEER Mobile — not legacy Palpeer.',
          'Pull to refresh; tap Update / Install for build ' + latest.v + '.',
          'If still wrong: delete the old Palpeer app, then open PALPEER Mobile from TestFlight.',
          'No new invite email required.',
        ],
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
