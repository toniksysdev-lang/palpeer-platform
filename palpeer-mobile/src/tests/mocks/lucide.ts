import { createElement } from 'react';
import { View } from 'react-native';

/** Test stand-in for lucide-react-native: every icon renders a View with `testID="icon-<Name>"`. */
const icons = new Map<string, unknown>();

module.exports = new Proxy(
  {},
  {
    get: (_target, name) => {
      if (name === '__esModule') return true;
      if (typeof name !== 'string') return undefined;
      if (!icons.has(name)) {
        const Stub = (props: Record<string, unknown>) =>
          createElement(View, { testID: `icon-${name}`, ...props });
        Stub.displayName = name;
        icons.set(name, Stub);
      }
      return icons.get(name);
    },
  },
);
