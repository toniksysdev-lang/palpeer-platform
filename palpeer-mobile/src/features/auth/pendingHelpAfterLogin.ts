/** When "I need help" is tapped on Log in before auth, open Get help after a successful log in. */
let pending = false;

export const pendingHelpAfterLogin = {
  request() {
    pending = true;
  },
  take() {
    const value = pending;
    pending = false;
    return value;
  },
  peek() {
    return pending;
  },
};
