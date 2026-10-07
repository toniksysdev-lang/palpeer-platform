import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

const GREEN = '#6CB33F';
const GREEN_TEXT = '#3E9A35';
const GREY = '#8C8C8C';

type Props = { width?: number };

/**
 * The PALPEER logo lockup: two-figure mark, wordmark and "Your Rate Your Way" tagline.
 * Redrawn as vectors from the supplied logo so it stays sharp and works on any background.
 */
export function PalpeerLogo({ width = 180 }: Props) {
  const scale = width / 180;
  return (
    <View
      style={{ width, alignItems: 'center' }}
      accessibilityRole="image"
      accessibilityLabel="PALPEER. Your Rate Your Way"
    >
      <View style={styles.row}>
        <Svg width={54 * scale} height={49 * scale} viewBox="0 0 64 58">
          <Defs>
            <LinearGradient id="palpeer-green" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#A2CF3F" />
              <Stop offset="1" stopColor="#1F7A33" />
            </LinearGradient>
            <LinearGradient id="palpeer-grey" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#DCDCDC" />
              <Stop offset="1" stopColor="#7A7A7A" />
            </LinearGradient>
          </Defs>
          <Circle cx={21} cy={9} r={7} fill="url(#palpeer-green)" />
          <Circle cx={43} cy={9} r={7} fill="url(#palpeer-grey)" />
          <Path
            d="M63,16 C54,22 41,32 34,52 C32,44 32,36 35,29 L33,21 C38,22 41,25 43,28 C48,21 55,17 63,16 Z"
            fill="url(#palpeer-grey)"
          />
          <Path
            d="M1,17 C9,24 18,36 21,57 L30,57 C29,46 29,36 31,29 L37,19 C31,21 27,25 25,30 C20,22 11,17 1,17 Z"
            fill="url(#palpeer-green)"
          />
        </Svg>
        <Text
          style={[styles.wordmark, { fontSize: 31 * scale, marginLeft: 2 * scale }]}
          allowFontScaling={false}
        >
          <Text style={{ color: GREEN_TEXT }}>PAL</Text>
          <Text style={{ color: GREY }}>PEER</Text>
        </Text>
      </View>
      <View style={[styles.row, { gap: 5 * scale, marginTop: 1 * scale }]}>
        <View style={[styles.rule, { width: 24 * scale }]} />
        <Text style={[styles.tagline, { fontSize: 12.5 * scale }]} allowFontScaling={false}>
          <Text style={{ color: GREY }}>Your Rate </Text>
          <Text style={{ color: GREEN }}>Your Way</Text>
          <Text style={{ color: GREY, fontSize: 8 * scale }}> ™</Text>
        </Text>
        <View style={[styles.rule, { width: 24 * scale }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  wordmark: { fontWeight: '800', letterSpacing: -0.5, includeFontPadding: false },
  tagline: { fontWeight: '500' },
  rule: { height: 1, backgroundColor: GREEN, alignSelf: 'center' },
});
