// Calls the local E2E helper (e2e/helper.cjs). ACTION and QUERY come from runScript env.
const query = typeof QUERY === 'undefined' ? '' : QUERY;
const response = http.get(`${HELPER}/${ACTION}?${query}`);
if (response.status !== 200) {
  throw new Error(`helper ${ACTION} failed: ${response.status} ${response.body}`);
}
output.helper = json(response.body);
