// Turns a generated screen into an Expo Router route and wires up its links.
import React, { useCallback } from 'react';
import { router, useNavigation } from 'expo-router';
import { Screen, openExternal } from './runtime';
import { ROUTES } from './routes';

// <a href="Main.dc.html"> in the design: go back to that screen if it is already
// open further down the stack, otherwise open it on top.
export function useGo() {
  const navigation = useNavigation();
  return useCallback((href) => {
    if (!href || href[0] === '#') return;
    if (/^(https?:|mailto:|tel:)/.test(href)) { openExternal(href); return; }
    const name = href.split('/').pop().replace(/\.dc\.html$/, '');
    const path = ROUTES[name];
    if (!path) { console.warn(`No screen for link ${href}`); return; }
    const routeName = path === '/' ? 'index' : name;
    const state = navigation.getState ? navigation.getState() : null;
    if (state && Array.isArray(state.routes)) {
      const idx = state.routes.findIndex((r) => r.name === routeName);
      if (idx === state.index) return;
      if (idx >= 0) { router.dismiss(state.index - idx); return; }
    }
    router.push(path);
  }, [navigation]);
}

/**
 * @param {any} Component design screen
 * @param {object} [props] static props (stage, showAll, …)
 * @param {() => object} [useLiveProps] optional hook that injects backend data/handlers
 */
export function screen(Component, props = {}, useLiveProps) {
  function Route() {
    const go = useGo();
    const live = typeof useLiveProps === 'function' ? useLiveProps() : {};
    return (
      <Screen bg={Component.background} go={go}>
        <Component {...props} {...live} />
      </Screen>
    );
  }
  Route.displayName = `${Component.name}Route`;
  return Route;
}
