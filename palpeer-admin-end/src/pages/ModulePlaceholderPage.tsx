import { findNavItem } from '@/config/navigation';
import { ContractPendingState } from '@/components/feedback/ContractPendingState';
import { useLocation } from 'react-router-dom';

export function ModulePlaceholderPage() {
  const location = useLocation();
  const item = findNavItem(location.pathname);
  const label = item?.label ?? 'Module';
  const pending = item?.contractPending ?? false;

  return (
    <div className="space-y-4">
      <div className="rounded-[0.6rem] border border-border bg-surface p-6 shadow-card">
        <h2 className="text-xl font-semibold text-text-primary">{label}</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Route shell for <code className="font-mono text-xs text-primary">{location.pathname}</code>.
          Feature implementation follows the phased gates after the application shell.
        </p>
      </div>
      {pending ? (
        <ContractPendingState
          title={`${label} admin API not verified`}
          description={`No dedicated admin contract for ${label} was confirmed in Phase 0. The navigation entry is reserved; mutation and live data views stay disabled.`}
        />
      ) : (
        <div className="rounded-[0.6rem] border border-dashed border-border bg-surface-secondary/40 p-6 text-sm text-text-secondary">
          Verified backend routes exist for this domain. List/detail UI will be implemented in later
          phases without inventing fields or actions.
        </div>
      )}
    </div>
  );
}
