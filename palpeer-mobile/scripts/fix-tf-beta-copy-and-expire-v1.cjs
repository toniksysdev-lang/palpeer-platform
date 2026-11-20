/**
 * Fix testers seeing "old app":
 * 1) Update Mobile beta localizations / group test info (remove V1 wording)
 * 2) Expire active V1 external builds
 * 3) Confirm Mobile build 5 is external-ready and notify group
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

  // --- Beta App Localizations (what TestFlight invite screen shows) ---
  console.log('\n=== MOBILE betaAppLocalizations ===');
  const mobileLocs = await paginate(
    jwt,
    `/v1/apps/${MOBILE_APP}/betaAppLocalizations?limit=20`,
  );
  for (const loc of mobileLocs) {
    console.log('MOBILE loc before=' + JSON.stringify(loc.attributes));
    try {
      await asc(jwt, 'PATCH', `/v1/betaAppLocalizations/${loc.id}`, {
        data: {
          type: 'betaAppLocalizations',
          id: loc.id,
          attributes: {
            description:
              'PALPEER Mobile — the current Palpeer iOS app. Test sign-up, login, P2P offers, Talk, messaging, and wallets. This is not the legacy V1 Palpeer app.',
            feedbackEmail: 'support@palpeer.com',
            marketingUrl: 'https://palpeer.com',
            privacyPolicyUrl: 'https://palpeer.com/privacy',
            tvOsPrivacyPolicy: undefined,
          },
        },
      });
      console.log('patched mobile localization ' + loc.id);
    } catch (e) {
      console.log(
        'patch mobile loc ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 500),
      );
      // retry without optional fields Apple may reject
      try {
        await asc(jwt, 'PATCH', `/v1/betaAppLocalizations/${loc.id}`, {
          data: {
            type: 'betaAppLocalizations',
            id: loc.id,
            attributes: {
              description:
                'PALPEER Mobile — current Palpeer iOS app. Test sign-up, login, P2P, Talk, messaging, and wallets. Not the legacy V1 app.',
              feedbackEmail: 'support@palpeer.com',
            },
          },
        });
        console.log('patched mobile localization (minimal) ' + loc.id);
      } catch (e2) {
        console.log(
          'patch mobile loc2 ' + e2.status + ' ' + JSON.stringify(e2.body || {}).slice(0, 500),
        );
      }
    }
  }
  if (!mobileLocs.length) {
    try {
      const created = await asc(jwt, 'POST', '/v1/betaAppLocalizations', {
        data: {
          type: 'betaAppLocalizations',
          attributes: {
            locale: 'en-US',
            description:
              'PALPEER Mobile — current Palpeer iOS app. Test sign-up, login, P2P, Talk, messaging, and wallets. Not the legacy V1 app.',
            feedbackEmail: 'support@palpeer.com',
          },
          relationships: {
            app: { data: { type: 'apps', id: MOBILE_APP } },
          },
        },
      });
      console.log('created mobile localization ' + created.data.id);
    } catch (e) {
      console.log('create loc ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 500));
    }
  }

  console.log('\n=== V1 betaAppLocalizations ===');
  const v1Locs = await paginate(jwt, `/v1/apps/${V1_APP}/betaAppLocalizations?limit=20`);
  for (const loc of v1Locs) {
    console.log('V1 loc=' + JSON.stringify(loc.attributes));
    try {
      await asc(jwt, 'PATCH', `/v1/betaAppLocalizations/${loc.id}`, {
        data: {
          type: 'betaAppLocalizations',
          id: loc.id,
          attributes: {
            description:
              'DEPRECATED — do not use. Use PALPEER Mobile TestFlight instead: https://testflight.apple.com/join/fEf3DzCz',
            feedbackEmail: 'support@palpeer.com',
          },
        },
      });
      console.log('patched V1 localization to deprecated notice');
    } catch (e) {
      console.log('patch v1 loc ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 400));
    }
  }

  // --- Beta group test info ---
  console.log('\n=== Groups ===');
  for (const [label, gid] of [
    ['MOBILE', MOBILE_GROUP],
    ['V1', V1_GROUP],
  ]) {
    const g = await asc(jwt, 'GET', `/v1/betaGroups/${gid}`);
    console.log(label + ' group attrs=' + JSON.stringify(g.data?.attributes));
  }

  // Patch Mobile group name/hasAccessToAllBuilds if useful
  try {
    await asc(jwt, 'PATCH', `/v1/betaGroups/${MOBILE_GROUP}`, {
      data: {
        type: 'betaGroups',
        id: MOBILE_GROUP,
        attributes: {
          name: 'PALPEER Mobile testers',
          publicLinkEnabled: true,
        },
      },
    });
    console.log('renamed Mobile group to PALPEER Mobile testers');
  } catch (e) {
    console.log('rename mobile group ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 300));
  }

  try {
    await asc(jwt, 'PATCH', `/v1/betaGroups/${V1_GROUP}`, {
      data: {
        type: 'betaGroups',
        id: V1_GROUP,
        attributes: {
          name: 'V1 DEPRECATED — do not use',
          publicLinkEnabled: false,
        },
      },
    });
    console.log('renamed V1 group to deprecated');
  } catch (e) {
    console.log('rename v1 group ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 300));
  }

  // --- Expire V1 non-expired builds ---
  console.log('\n=== Expire V1 builds ===');
  const v1Builds = await paginate(
    jwt,
    `/v1/builds?filter[app]=${V1_APP}&sort=-uploadedDate&limit=20&fields[builds]=version,expired,processingState`,
  );
  for (const b of v1Builds) {
    if (b.attributes?.expired) {
      console.log('already expired v=' + b.attributes.version);
      continue;
    }
    try {
      await asc(jwt, 'PATCH', `/v1/builds/${b.id}`, {
        data: {
          type: 'builds',
          id: b.id,
          attributes: { expired: true },
        },
      });
      console.log('EXPIRED V1 build v=' + b.attributes?.version + ' ' + b.id);
    } catch (e) {
      console.log(
        'expire v=' +
          b.attributes?.version +
          ' ' +
          e.status +
          ' ' +
          JSON.stringify(e.body || {}).slice(0, 300),
      );
    }
  }

  // --- Ensure Mobile build 5 assigned + beta details ---
  const mobileBuilds = await paginate(
    jwt,
    `/v1/builds?filter[app]=${MOBILE_APP}&sort=-uploadedDate&limit=5&fields[builds]=version,expired,processingState`,
  );
  const latest = mobileBuilds.find(
    (b) => !b.attributes?.expired && (b.attributes?.processingState || '').toUpperCase() === 'VALID',
  );
  console.log('\n=== Mobile latest === ' + JSON.stringify(latest && {
    id: latest.id,
    v: latest.attributes?.version,
  }));

  if (latest) {
    try {
      await asc(jwt, 'POST', `/v1/builds/${latest.id}/relationships/betaGroups`, {
        data: [{ type: 'betaGroups', id: MOBILE_GROUP }],
      });
      console.log('assigned latest to Mobile group');
    } catch (e) {
      console.log('assign ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 250));
    }

    // betaAppReviewSubmission / external state
    try {
      const details = await paginate(
        jwt,
        `/v1/buildBetaDetails?filter[build]=${latest.id}&limit=5`,
      );
      console.log('buildBetaDetails=' + JSON.stringify(details.map((d) => ({ id: d.id, a: d.attributes }))));
      for (const d of details) {
        try {
          await asc(jwt, 'PATCH', `/v1/buildBetaDetails/${d.id}`, {
            data: {
              type: 'buildBetaDetails',
              id: d.id,
              attributes: { autoNotifyEnabled: true },
            },
          });
          console.log('autoNotifyEnabled on ' + d.id);
        } catch (e) {
          console.log('notify patch ' + e.status + ' ' + JSON.stringify(e.body || {}).slice(0, 250));
        }
      }
    } catch (e) {
      console.log('betaDetails ' + e.status);
    }
  }

  // beta license / what to test via betaGroup betaRecruitmentCriteria? skip

  // Resend invites for Mobile testers
  const testers = await paginate(jwt, `/v1/betaGroups/${MOBILE_GROUP}/betaTesters?limit=200`);
  const invited = [];
  for (const t of testers) {
    const email = (t.attributes?.email || '').toLowerCase();
    if (!email || email.includes('covenant')) continue;
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
      console.log('INVITED ' + email);
    } catch (e) {
      const body = JSON.stringify(e.body || {});
      if (body.includes('ALREADY_ACCEPTED')) console.log('accepted ' + email);
      else console.log('invite fail ' + email + ' ' + e.status + ' ' + body.slice(0, 180));
    }
  }

  // Final read of localizations
  const finalLocs = await paginate(
    jwt,
    `/v1/apps/${MOBILE_APP}/betaAppLocalizations?limit=20`,
  );
  console.log('\n=== FINAL ===');
  console.log(
    JSON.stringify(
      {
        mobileLocalizations: finalLocs.map((l) => l.attributes),
        invited,
        publicLink: 'https://testflight.apple.com/join/fEf3DzCz',
        instructions:
          'Testers: delete old "Palpeer" app from home screen AND remove it in TestFlight (swipe left → Delete App). Then open join/fEf3DzCz and install PALPEER Mobile build 5.',
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
