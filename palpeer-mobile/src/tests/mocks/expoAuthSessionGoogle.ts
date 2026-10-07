export function useIdTokenAuthRequest() {
  return [
    { url: 'https://accounts.google.com' },
    null,
    jest.fn(async () => ({ type: 'dismiss' as const })),
  ] as const;
}
