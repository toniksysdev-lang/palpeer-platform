import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

type Props = { size?: number };

/** Flag art drawn in a unit space (clipped to a circle of radius 1), scaled into place. */
type FlagArt = () => ReactNode;

const STAR =
  'M0,-0.42 L0.12,-0.13 L0.42,-0.13 L0.18,0.05 L0.26,0.36 L0,0.18 L-0.26,0.36 L-0.18,0.05 L-0.42,-0.13 L-0.12,-0.13 Z';

const FLAGS = {
  CA: () => (
    <>
      <Rect x={-1} y={-1} width={2} height={2} fill="#FFFFFF" />
      <Rect x={-1} y={-1} width={0.5} height={2} fill="#D52B1E" />
      <Rect x={0.5} y={-1} width={0.5} height={2} fill="#D52B1E" />
      <Path
        d="M0,-0.55 L0.1,-0.3 L0.28,-0.38 L0.2,-0.08 L0.38,-0.12 L0.3,0.06 L0.42,0.12 L0.12,0.3 L0.06,0.25 L0.04,0.55 L-0.04,0.55 L-0.06,0.25 L-0.12,0.3 L-0.42,0.12 L-0.3,0.06 L-0.38,-0.12 L-0.2,-0.08 L-0.28,-0.38 L-0.1,-0.3 Z"
        fill="#D52B1E"
      />
    </>
  ),
  US: () => (
    <>
      <Rect x={-1} y={-1} width={2} height={2} fill="#FFFFFF" />
      {Array.from({ length: 7 }, (_, i) => (
        <Rect key={i} x={-1} y={-1 + i * 0.3077} width={2} height={0.154} fill="#B22234" />
      ))}
      <Rect x={-1} y={-1} width={1.05} height={1.08} fill="#3C3B6E" />
      {[-0.8, -0.55, -0.3].flatMap((x) =>
        [-0.8, -0.55, -0.3].map((y) => (
          <Circle key={`${x}${y}`} cx={x + 0.12} cy={y + 0.1} r={0.05} fill="#FFFFFF" />
        )),
      )}
    </>
  ),
  GB: () => (
    <>
      <Rect x={-1} y={-1} width={2} height={2} fill="#012169" />
      <Path d="M-1,-1 L1,1 M1,-1 L-1,1" stroke="#FFFFFF" strokeWidth={0.4} />
      <Path d="M-1,-1 L1,1 M1,-1 L-1,1" stroke="#C8102E" strokeWidth={0.14} />
      <Path d="M0,-1 V1 M-1,0 H1" stroke="#FFFFFF" strokeWidth={0.55} />
      <Path d="M0,-1 V1 M-1,0 H1" stroke="#C8102E" strokeWidth={0.32} />
    </>
  ),
  GH: () => (
    <>
      <Rect x={-1} y={-1} width={2} height={0.67} fill="#CE1126" />
      <Rect x={-1} y={-0.34} width={2} height={0.68} fill="#FCD116" />
      <Rect x={-1} y={0.33} width={2} height={0.67} fill="#006B3F" />
      <Path d={STAR} fill="#000000" transform="scale(0.8)" />
    </>
  ),
  NG: () => (
    <>
      <Rect x={-1} y={-1} width={2} height={2} fill="#FFFFFF" />
      <Rect x={-1} y={-1} width={0.67} height={2} fill="#008751" />
      <Rect x={0.33} y={-1} width={0.67} height={2} fill="#008751" />
    </>
  ),
  KE: () => (
    <>
      <Rect x={-1} y={-1} width={2} height={0.62} fill="#000000" />
      <Rect x={-1} y={-0.38} width={2} height={0.1} fill="#FFFFFF" />
      <Rect x={-1} y={-0.28} width={2} height={0.56} fill="#BB0000" />
      <Rect x={-1} y={0.28} width={2} height={0.1} fill="#FFFFFF" />
      <Rect x={-1} y={0.38} width={2} height={0.62} fill="#006600" />
      <Ellipse cx={0} cy={0} rx={0.2} ry={0.5} fill="#BB0000" stroke="#000000" strokeWidth={0.06} />
      <Path d="M0,-0.45 V0.45" stroke="#FFFFFF" strokeWidth={0.05} />
    </>
  ),
} satisfies Record<string, FlagArt>;

/** Badge positions (centre x, centre y, radius) in the 200×200 artboard. */
const BADGES: [keyof typeof FLAGS, number, number, number][] = [
  ['CA', 55, 48, 13],
  ['US', 40, 82, 13],
  ['GB', 158, 50, 14],
  ['GH', 170, 82, 12],
  ['NG', 128, 108, 13],
  ['KE', 172, 110, 12],
];

function FlagBadge({
  code,
  cx,
  cy,
  r,
  size,
  delayMs,
}: {
  code: keyof typeof FLAGS;
  cx: number;
  cy: number;
  r: number;
  size: number;
  delayMs: number;
}) {
  const scale = size / 200;
  const diameter = r * 2 * scale;
  const left = cx * scale - diameter / 2;
  const top = cy * scale - diameter / 2;

  const bob = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    bob.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(4, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      ),
    );
    pulse.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    );
  }, [bob, delayMs, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { scale: pulse.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.flag,
        {
          width: diameter,
          height: diameter,
          left,
          top,
          borderRadius: diameter / 2,
        },
        style,
      ]}
    >
      <Svg width={diameter} height={diameter} viewBox="-1.12 -1.12 2.24 2.24">
        <Defs>
          <ClipPath id={`flag-${code}`}>
            <Circle cx={0} cy={0} r={1} />
          </ClipPath>
        </Defs>
        <Circle cx={0} cy={0} r={1.12} fill="#FFFFFF" />
        <G clipPath={`url(#flag-${code})`}>{FLAGS[code]()}</G>
      </Svg>
    </Animated.View>
  );
}

/**
 * Globe with the flags of the currencies' home countries.
 * Globe spins slowly; flags bob and pulse with a staggered delay.
 */
export function GlobeIllustration({ size = 220 }: Props) {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 28_000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const globeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[{ width: size, height: size }, globeStyle]}>
        <Svg width={size} height={size} viewBox="0 0 200 200">
          <Defs>
            <RadialGradient id="ocean" cx="38%" cy="32%" r="75%">
              <Stop offset="0" stopColor="#7FD6F2" />
              <Stop offset="0.55" stopColor="#1FA3D6" />
              <Stop offset="1" stopColor="#0B5E93" />
            </RadialGradient>
            <ClipPath id="globe">
              <Circle cx={100} cy={96} r={72} />
            </ClipPath>
          </Defs>

          <Circle cx={100} cy={96} r={72} fill="url(#ocean)" />
          <G clipPath="url(#globe)" fill="#2E9E6B">
            <Path d="M20,52 C34,34 62,30 78,40 C86,46 80,58 70,62 C62,66 66,78 58,84 C50,90 40,84 36,76 C30,66 18,64 20,52 Z" />
            <Path d="M58,92 C66,90 74,98 76,110 C78,124 70,140 62,156 C58,164 52,160 52,150 C52,136 48,124 50,112 C51,102 52,94 58,92 Z" />
            <Path d="M88,26 C98,22 110,26 108,34 C106,40 94,42 88,36 Z" />
            <Path d="M120,46 C132,40 150,44 156,54 C160,62 150,66 146,74 C156,80 164,92 162,108 C160,124 150,138 140,146 C134,150 130,142 132,132 C134,120 124,112 122,100 C120,90 126,82 120,74 C114,66 112,52 120,46 Z" />
          </G>
          <Circle
            cx={100}
            cy={96}
            r={72}
            fill="none"
            stroke="#0A4F7C"
            strokeOpacity={0.35}
            strokeWidth={1.5}
          />
          <Ellipse cx={74} cy={60} rx={26} ry={14} fill="#FFFFFF" opacity={0.18} />
        </Svg>
      </Animated.View>

      {BADGES.map(([code, cx, cy, r], index) => (
        <FlagBadge
          key={code}
          code={code}
          cx={cx}
          cy={cy}
          r={r}
          size={size}
          delayMs={index * 180}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flag: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
