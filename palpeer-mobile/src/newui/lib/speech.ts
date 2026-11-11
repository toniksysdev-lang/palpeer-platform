import * as Speech from 'expo-speech';
import { useCallback, useEffect, useState } from 'react';
import { trFr, trFrSentences, useLang } from './i18n';

/**
 * Listen voice.
 * English: a young adult Nigerian English female voice (en-NG) when the phone has one.
 * French: a female voice with a West African French accent (fr-SN, fr-CI, fr-CM ...) when available,
 * otherwise France French. For the same voice on every phone, swap this for a cloud
 * text-to-speech voice (for example Azure en-NG "Ezinne" and an African French library voice).
 */
const FEMALE = /female|woman|femme|ezinne|samantha|zira|aria|jenny|ariane|awa|aminata|fatou|denise|eloise|vivienne|brigitte|amelie|amélie|julie|audrey/i;
const AFR = /^fr[-_](SN|CI|CM|CD|ML|BF|BJ|TG|GN|GA|CG|NE|MG|RW|BI|TD|CF|DJ|KM)/i;

let voices: Speech.Voice[] | null = null;
async function loadVoices() {
  if (!voices) {
    try {
      voices = await Speech.getAvailableVoicesAsync();
    } catch {
      voices = [];
    }
  }
  return voices;
}

async function pickVoice(fr: boolean) {
  const all = await loadVoices();
  const fem = (v: Speech.Voice) => FEMALE.test(v.name || '') || FEMALE.test(v.identifier || '');
  if (fr) {
    const f = all.filter((v) => /^fr/i.test(v.language));
    return (
      f.find((v) => AFR.test(v.language) && fem(v)) ||
      f.find((v) => AFR.test(v.language)) ||
      f.find((v) => /^fr[-_]FR/i.test(v.language) && fem(v)) ||
      f.find((v) => /^fr[-_]FR/i.test(v.language)) ||
      f[0]
    );
  }
  const ng = all.filter((v) => /en[-_]NG/i.test(v.language));
  return ng.find(fem) || ng[0] || all.find((v) => /^en/i.test(v.language) && fem(v));
}

/** Hook for the Listen button: returns the label ("Listen" or "Stop") and a toggle. */
export function useListen() {
  const { lang } = useLang();
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => void Speech.stop(), []);
  const toggle = useCallback(
    async (text: string) => {
      if (speaking) {
        await Speech.stop();
        setSpeaking(false);
        return;
      }
      const fr = lang === 'fr';
      const said = fr ? trFr(text) || trFrSentences(text) || text : text;
      const v = await pickVoice(fr);
      setSpeaking(true);
      Speech.speak(said, {
        language: v?.language || (fr ? 'fr-SN' : 'en-NG'),
        voice: v?.identifier,
        rate: fr ? 0.95 : 1,
        pitch: v ? 1 : 1.15,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    },
    [speaking, lang],
  );
  return { listenLabel: speaking ? 'Stop' : 'Listen', listen: toggle };
}
