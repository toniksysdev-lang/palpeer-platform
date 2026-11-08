// Browser APIs the design's logic code uses, provided on React Native:
//   window.speechSynthesis / SpeechSynthesisUtterance  -> expo-speech ("Listen" buttons)
//   navigator.clipboard.writeText                      -> expo-clipboard
//   navigator.share                                    -> React Native Share sheet
//   window.addEventListener('pointerdown' | 'keydown') -> touches on the screen (3-minute log-out timer)
//   window.palpeerLook                                 -> light/dark look, saved on the device
// On the web build the browser's own APIs are used where they exist.
import { Share } from 'react-native';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

const g = globalThis;
if (typeof g.window === 'undefined') g.window = g;
const win = g.window;

/* ---------- window events ---------- */
const listeners = {};
if (typeof win.addEventListener !== 'function') {
  win.addEventListener = (type, fn) => { (listeners[type] = listeners[type] || new Set()).add(fn); };
  win.removeEventListener = (type, fn) => { listeners[type] && listeners[type].delete(fn); };
}
g.__dcEmit = (type) => {
  if (listeners[type]) listeners[type].forEach((fn) => { try { fn({ type }); } catch (e) {} });
};

/* ---------- speech ---------- */
if (!win.speechSynthesis) {
  let voices = [];
  Speech.getAvailableVoicesAsync()
    .then((list) => { voices = list.map((v) => ({ name: v.name || v.identifier, lang: v.language, voiceURI: v.identifier, identifier: v.identifier })); })
    .catch(() => {});

  g.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
    constructor(text) {
      this.text = text; this.lang = undefined; this.voice = null;
      this.pitch = 1; this.rate = 1; this.onend = null; this.onerror = null;
    }
  };

  win.speechSynthesis = {
    getVoices: () => voices,
    speak(u) {
      const done = () => { if (u.onend) u.onend({}); };
      Speech.speak(u.text, {
        language: u.lang,
        voice: u.voice ? u.voice.identifier : undefined,
        pitch: u.pitch, rate: u.rate,
        onDone: done, onStopped: done,
        onError: (e) => { if (u.onerror) u.onerror(e); done(); },
      });
    },
    cancel() { Speech.stop(); },
    get speaking() { return false; },
  };
}

/* ---------- clipboard and share ---------- */
const nav = g.navigator || (g.navigator = {});
if (!nav.clipboard) {
  nav.clipboard = { writeText: (t) => Clipboard.setStringAsync(String(t)) };
}
if (!nav.share) {
  nav.share = ({ text, url, title }) => Share.share({ message: [text, url].filter(Boolean).join(' '), title });
}

/* ---------- light / dark look ---------- */
const KEY = 'palpeer-look';
// Persisted look is unused by app routes now: landing is always dark, other
// design screens are always light. Keep the shim for older design previews.
let look = 'light';
const lookListeners = new Set();
win.palpeerLook = {
  get: () => look,
  set(v) {
    look = v === 'dark' ? 'dark' : 'light';
    AsyncStorage.setItem(KEY, look).catch(() => {});
    lookListeners.forEach((fn) => fn(look));
  },
};

export function subscribeLook(fn) {
  lookListeners.add(fn);
  return () => {
    lookListeners.delete(fn);
  };
}

export async function loadLook() {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === 'dark' || v === 'light') look = v;
    else look = 'light';
  } catch (e) {
    look = 'light';
  }
  return look;
}
