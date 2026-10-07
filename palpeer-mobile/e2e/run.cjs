#!/usr/bin/env node
/**
 * Runs the Maestro E2E suite against a development backend and an emulator with the release APK
 * installed. Required env: E2E_BACKEND_LOG (backend stdout, for the development OTP lines) and
 * E2E_ADMIN_PASSWORD (seeded admin, completes fundings). Optional: E2E_API, E2E_ADB, E2E_MAESTRO,
 * E2E_SKIP_FINGERPRINT=1 to skip fingerprint enrollment (it is skipped anyway once one is enrolled).
 *
 *   node e2e/run.cjs [--from=03] [maestro test args...]
 */
const { execFileSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const helper = require('./helper.cjs');

const HELPER_PORT = 8765;
const DEVICE_PIN = '1111';
const ADB = process.env.E2E_ADB ?? 'adb';
const MAESTRO = process.env.E2E_MAESTRO ?? 'maestro';
const FLOWS = path.join(__dirname, 'flows');
const RESULTS = path.join(__dirname, 'results');

for (const name of ['E2E_BACKEND_LOG', 'E2E_ADMIN_PASSWORD']) {
  if (!process.env[name]) {
    console.error(`${name} is not set`);
    process.exit(2);
  }
}

function adb(...args) {
  return execFileSync(ADB, ['-e', ...args], { encoding: 'utf8' });
}

/** The enrolled fingerprint needs a device PIN, so the keyguard shows after every reboot. */
function unlockDevice() {
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
  const focus = /mCurrentFocus=.*/.exec(adb('shell', 'dumpsys', 'window'))?.[0] ?? '';
  if (
    focus.includes('NotificationShade') &&
    adb('shell', 'dumpsys', 'trust').includes('deviceLocked=1')
  ) {
    adb('shell', 'wm', 'dismiss-keyguard');
    adb('shell', 'input', 'text', DEVICE_PIN);
    adb('shell', 'input', 'keyevent', 'KEYCODE_ENTER');
  }
  adb('shell', 'cmd', 'statusbar', 'collapse');
}

// Async on purpose: the helper server lives in this process and must keep serving Maestro.
function maestro(args, env) {
  const envArgs = Object.entries(env).flatMap(([key, value]) => ['-e', `${key}=${value}`]);
  const child = spawn(MAESTRO, ['test', ...envArgs, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return new Promise((resolve) => child.on('close', (code) => resolve(code ?? 1)));
}

async function main() {
  // Slow emulators raise system ANR dialogs ("Phone isn't responding") over the app under test.
  for (const [key, value] of [
    ['hide_error_dialogs', '1'],
    ['anr_show_background', '0'],
    ['window_animation_scale', '0'],
    ['transition_animation_scale', '0'],
    ['animator_duration_scale', '0'],
  ]) {
    adb('shell', 'settings', 'put', 'global', key, value);
  }
  const server = await helper.start(HELPER_PORT);
  const common = { HELPER: `http://localhost:${HELPER_PORT}` };

  try {
    const enrolled = /"count":[1-9]/.test(adb('shell', 'dumpsys', 'fingerprint'));
    if (!enrolled && !process.env.E2E_SKIP_FINGERPRINT) {
      try {
        adb('shell', 'locksettings', 'set-pin', DEVICE_PIN);
      } catch {
        // Already set by an earlier run.
      }
      adb('shell', 'am', 'start', '-a', 'android.settings.FINGERPRINT_ENROLL');
      const status = await maestro([path.join(FLOWS, 'setup', 'enroll-fingerprint.yaml')], {
        ...common,
        DEVICE_PIN,
      });
      if (status !== 0) throw new Error('Fingerprint enrollment failed');
    }

    // No on-screen keyboard (the AVD needs hw.keyboard=yes): it covers footer buttons, and
    // Maestro's hideKeyboard can press Back instead. The helper types with adb key events.
    adb('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '0');
    adb('wait-for-device');
    unlockDevice();
    fs.mkdirSync(RESULTS, { recursive: true });
    const stamp = Date.now();
    const env = {
      ...common,
      EMAIL: `e2e-app-${stamp}@example.com`,
      PHONE: `+1555${String(stamp).slice(-7)}`,
      PASSWORD: helper.PASSWORD,
      PIN: '1357',
    };

    // --from=03 skips launch and registration: a pre-registered user on a fresh install.
    const fromArg = process.argv.find((arg) => arg.startsWith('--from='));
    const passThrough = process.argv.slice(2).filter((arg) => arg !== fromArg);
    let targets = [FLOWS];
    if (fromArg) {
      const from = fromArg.slice('--from='.length).padStart(2, '0');
      if (from !== '03')
        throw new Error('--from supports 03 only: later flows need the PIN from 04');
      const response = await fetch(`${common.HELPER}/verifiedUser`);
      if (!response.ok) throw new Error(`verifiedUser failed: ${await response.text()}`);
      env.EMAIL = (await response.json()).email;
      if ((await maestro([path.join(FLOWS, 'setup', 'to-login.yaml')], env)) !== 0) {
        throw new Error('Could not reach the login screen');
      }
      targets = fs
        .readdirSync(FLOWS)
        .filter((name) => /^\d\d-.*\.yaml$/.test(name) && name.slice(0, 2) >= from)
        .sort()
        .map((name) => path.join(FLOWS, name));
    }

    process.exitCode = await maestro(
      [
        '--format',
        'junit',
        '--output',
        path.join(RESULTS, `report-${stamp}.xml`),
        '--test-output-dir',
        path.join(RESULTS, `artifacts-${stamp}`),
        ...passThrough,
        ...targets,
      ],
      env,
    );
  } finally {
    server.close();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exitCode = 1;
});
