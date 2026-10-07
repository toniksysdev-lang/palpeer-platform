import { appConfig } from '@/config/env';

export function MockModeBanner() {
  if (!appConfig.useMockApi) {
    return null;
  }

  return (
    <div
      className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-center text-xs font-medium text-warning"
      role="status"
    >
      Mock API mode is enabled — data shown here is not production operational data.
    </div>
  );
}
