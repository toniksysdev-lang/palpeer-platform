import { router, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { BALANCE_CARD_MIN_HEIGHT } from '@/features/wallets/components/BalanceCard';
import { useTheme } from '@/providers/ThemeProvider';
import type { MarketingAdvertResponse } from '@/types/api/marketing';

const BANNER_HEIGHT = Math.round(BALANCE_CARD_MIN_HEIGHT * 0.6);
const AUTO_ADVANCE_MS = 4500;

type Props = {
  adverts: readonly MarketingAdvertResponse[];
};

/**
 * Fancy home marketing strip: image-backed slides with title, brief, and CTA.
 * Height is 60% of the wallet balance card.
 */
export function MarketingCarousel({ adverts }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (adverts.length < 2 || width <= 0) return;
    const timer = setInterval(() => {
      const next = (indexRef.current + 1) % adverts.length;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [adverts.length, width]);

  if (adverts.length === 0) return null;

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    setIndex(Math.max(0, Math.min(next, adverts.length - 1)));
  };

  const openCta = (path: string) => {
    const href = (path.startsWith('/') ? path : `/${path}`) as Href;
    router.push(href);
  };

  return (
    <View style={{ gap: theme.spacing.xs }} testID="home-marketing">
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          scrollEnabled={adverts.length > 1}
          decelerationRate="fast"
        >
          {adverts.map((advert) => (
            <View key={advert.id} style={{ width: width || undefined }}>
              <Pressable
                onPress={() => openCta(advert.ctaPath)}
                accessibilityRole="button"
                accessibilityLabel={`${advert.title}. ${advert.ctaLabel}`}
                testID={`home-marketing-${advert.id}`}
                style={[
                  theme.shadows.card,
                  {
                    height: BANNER_HEIGHT,
                    borderRadius: theme.radius.lg,
                    overflow: 'hidden',
                  },
                ]}
              >
                <ImageBackground
                  source={{ uri: advert.imageUrl }}
                  style={{ flex: 1 }}
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={['rgba(6, 28, 22, 0.82)', 'rgba(6, 28, 22, 0.35)', 'rgba(11, 110, 79, 0.55)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: theme.spacing.md,
                      paddingVertical: theme.spacing.sm,
                      gap: theme.spacing.sm,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <AppText
                        variant="bodyStrong"
                        numberOfLines={1}
                        style={{ color: '#FFFFFF', fontSize: 14, lineHeight: 18 }}
                      >
                        {advert.title}
                      </AppText>
                      <AppText
                        variant="caption"
                        numberOfLines={1}
                        style={{ color: 'rgba(255,255,255,0.88)', fontSize: 11, lineHeight: 14 }}
                      >
                        {advert.body}
                      </AppText>
                    </View>
                    <View
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: theme.radius.pill,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: 6,
                        maxWidth: 112,
                      }}
                    >
                      <AppText
                        variant="caption"
                        numberOfLines={1}
                        style={{
                          color: theme.colors.heroStart,
                          fontWeight: '700',
                          fontSize: 11,
                        }}
                      >
                        {advert.ctaLabel}
                      </AppText>
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
      {adverts.length > 1 ? (
        <View
          style={{ flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.xs }}
          accessibilityLabel={`Promotion ${index + 1} of ${adverts.length}`}
        >
          {adverts.map((advert, i) => (
            <View
              key={advert.id}
              style={{
                height: 5,
                width: i === index ? 16 : 5,
                borderRadius: 3,
                backgroundColor: i === index ? theme.colors.primary : theme.colors.borderStrong,
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}
