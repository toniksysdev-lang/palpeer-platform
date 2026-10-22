import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect } from 'react';

const receiveSound = require('../../../assets/sounds/chat-receive.wav') as number;

/**
 * Soft in-chat chime for messages the other participant sends while this room is open.
 * Own echoes on the room topic are ignored by the caller.
 */
export function useChatReceiveSound() {
  const player = useAudioPlayer(receiveSound);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'mixWithOthers',
    }).catch(() => undefined);
  }, []);

  return useCallback(() => {
    try {
      void player.seekTo(0).then(
        () => {
          player.play();
        },
        () => {
          player.play();
        },
      );
    } catch {
      // Best-effort — never interrupt messaging if audio fails.
    }
  }, [player]);
}
