import { router, type Href } from 'expo-router';
import { useMemo } from 'react';

import { Card, H1, Screen, TopBar, Txt } from '@/newui/ui/kit';

type Props = {
  title: string;
  body: string;
  say?: string;
};

/** Renders long legal copy as readable paragraphs. */
export default function LegalDocument({ title, body, say }: Props) {
  const paragraphs = useMemo(
    () =>
      body
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean),
    [body],
  );

  const back = () => {
    if (router.canGoBack()) router.back();
    // Public legal pages can open while signed out — fall back to Start, not More.
    else router.replace('/' as Href);
  };

  return (
    <Screen scroll gap={12}>
      <TopBar onBack={back} say={say || title} />
      <H1>{title}</H1>
      <Card gap={12}>
        {paragraphs.map((p, i) => (
          <Txt key={i} size={15} color="text2" noTr style={{ marginBottom: 2 }}>
            {p}
          </Txt>
        ))}
      </Card>
    </Screen>
  );
}
