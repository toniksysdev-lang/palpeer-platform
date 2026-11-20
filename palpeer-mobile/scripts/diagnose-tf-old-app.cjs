/**
 * Deep diagnose: why TestFlight still shows old V1 Palpeer.
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
      await asc(jwt, 'GET', `/v1/apps/${MOBILE_APP}`);
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

async function appInfo(jwt, id) {
  const app = await asc(
    jwt,
    'GET',
    `/v1/apps/${id}?fields[apps]=name,bundleId,sku,primaryLocale`,
  );
  return app.data;
}

(async () => {
  const jwt = await getJwt(loadSession());

  for (const [label, id] of [
    ['V1', V1_APP],
    ['MOBILE', MOBILE_APP],
  ]) {
    const a = await appInfo(jwt, id);
    console.log(
      `\n=== APP ${label} ===`,
      JSON.stringify({
        id,
        name: a.attributes?.name,
        bundleId: a.attributes?.bundleId,
        sku: a.attributes?.sku,
      }),
    );

    const groups = await paginate(jwt, `/v1/apps/${id}/betaGroups?limit=50`);
    for (const g of groups) {
      const testers = await paginate(jwt, `/v1/betaGroups/${g.id}/betaTesters?limit=200`);
      const builds = await paginate(
        jwt,
        `/v1/betaGroups/${g.id}/builds?limit=20&fields[builds]=version,processingState,expired,uploadedDate`,
      ).catch(() => []);
      console.log(
        JSON.stringify({
          group: g.attributes?.name,
          groupId: g.id,
          internal: g.attributes?.isInternalGroup,
          publicLinkEnabled: g.attributes?.publicLinkEnabled,
          publicLink: g.attributes?.publicLink,
          testers: testers.map((t) => t.attributes?.email),
          builds: builds.slice(0, 5).map((b) => ({
            v: b.attributes?.version,
            state: b.attributes?.processingState,
            expired: b.attributes?.expired,
          })),
        }),
      );
    }

    // prerelease versions / beta app review detail
    try {
      const pr = await paginate(
        jwt,
        `/v1/apps/${id}/prereleaseVersions?limit=10&fields[prereleaseVersions]=version,platform`,
      );
      console.log(
        'prereleaseVersions=' +
          JSON.stringify(
            pr.map((p) => ({ id: p.id, v: p.attributes?.version, plat: p.attributes?.platform })),
          ),
      );
    } catch (e) {
      console.log('prerelease err ' + e.status);
    }

    const builds = await paginate(
      jwt,
      `/v1/builds?filter[app]=${id}&sort=-uploadedDate&limit=8&fields[builds]=version,processingState,expired,uploadedDate,usesNonExemptEncryption`,
    );
    for (const b of builds.slice(0, 5)) {
      let groupsForBuild = [];
      try {
        const bg = await asc(jwt, 'GET', `/v1/builds/${b.id}/betaGroups?limit=20`);
        groupsForBuild = (bg.data || []).map((g) => g.attributes?.name);
      } catch {
        /* ignore */
      }
      let betaDetail = null;
      try {
        const bd = await asc(
          jwt,
          'GET',
          `/v1/builds/${b.id}/buildBetaDetail?fields[buildBetaDetails]=externalBuildState,internalBuildState, autoNotifyEnabled`,
        );
        betaDetail = bd.data?.attributes;
      } catch (e) {
        betaDetail = { err: e.status };
      }
      console.log(
        JSON.stringify({
          buildId: b.id,
          v: b.attributes?.version,
          state: b.attributes?.processingState,
          expired: b.attributes?.expired,
          groups: groupsForBuild,
          betaDetail,
        }),
      );
    }
  }

  // Sample known tester emails — what apps are they on?
  const emails = [
    'topmostbukky@gmail.com',
    'veronica.oladipo@palpeer.com',
    'samuel.adeolauk@gmail.com',
    'funmifadele@gmail.com',
  ];
  console.log('\n=== PER TESTER APP MEMBERSHIP ===');
  for (const email of emails) {
    const found = await asc(
      jwt,
      'GET',
      `/v1/betaTesters?filter[email]=${encodeURIComponent(email)}&limit=20`,
    );
    for (const t of found.data || []) {
      const apps = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/apps?limit=20`).catch(() => ({
        data: [],
      }));
      const groups = await asc(jwt, 'GET', `/v1/betaTesters/${t.id}/betaGroups?limit=20`).catch(
        () => ({ data: [] }),
      );
      console.log(
        JSON.stringify({
          email: t.attributes?.email,
          id: t.id,
          apps: (apps.data || []).map((a) => a.attributes?.name + '/' + a.attributes?.bundleId),
          groups: (groups.data || []).map((g) => g.attributes?.name),
        }),
      );
    }
  }

  // Fetch public link pages (HTML titles)
  console.log('\n=== PUBLIC LINKS HTTP ===');
  for (const url of [
    'https://testflight.apple.com/join/fEf3DzCz',
    'https://testflight.apple.com/join/98BkUqXf',
  ]) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const html = await res.text();
      const title = (html.match(/<title>([^<]*)<\/title>/i) || [])[1];
      console.log(JSON.stringify({ url, status: res.status, final: res.url, title }));
    } catch (e) {
      console.log(url + ' err ' + e.message);
    }
  }
})().catch((e) => {
  console.error(e.message || e);
  if (e.body) console.error(JSON.stringify(e.body, null, 2).slice(0, 1500));
  process.exit(1);
});
