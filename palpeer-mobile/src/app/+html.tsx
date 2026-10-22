import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web-only root document. Paints the branded splash immediately (before the JS bundle)
 * so cold start never shows a blank white page ahead of BrandSplash.
 */
const bootSplashCss = `
html, body, #root {
  height: 100%;
  margin: 0;
  background-color: #FFFFFF;
}
#palpeer-boot-splash {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 0 32px;
  background-color: #FFFFFF;
  pointer-events: none;
  transition: opacity 140ms ease-out;
}
#palpeer-boot-splash img {
  width: 200px;
  height: 84px;
  object-fit: contain;
}
#palpeer-boot-splash .track {
  width: 148px;
  height: 4px;
  border-radius: 999px;
  background-color: #F4F6F5;
  overflow: hidden;
  margin-top: 4px;
}
#palpeer-boot-splash .fill {
  height: 100%;
  width: 28%;
  border-radius: 999px;
  background-color: #0E9F6E;
  animation: palpeer-boot-bar 1.6s ease-in-out infinite alternate;
}
@keyframes palpeer-boot-bar {
  from { transform: translateX(0); width: 28%; }
  to { transform: translateX(160%); width: 55%; }
}
#palpeer-boot-splash.is-hidden {
  opacity: 0;
  visibility: hidden;
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: bootSplashCss }} />
      </head>
      <body>
        <div id="palpeer-boot-splash" aria-hidden="true">
          <img src="/palpeer-logo.png" alt="" width={200} height={84} />
          <div className="track">
            <div className="fill" />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
