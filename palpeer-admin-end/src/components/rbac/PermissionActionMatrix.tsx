import {
  ACTION_KIND_COLUMNS,
  PERMISSION_MODULES,
  type CatalogAction,
  type PermissionActionKind,
} from '@/lib/permissionCatalog';

type Mode = 'catalog' | 'select';

type Props = {
  mode: Mode;
  /** Codes present in the live API catalog. */
  existingCodes: ReadonlySet<string> | readonly string[];
  /** Selected codes when mode=select. */
  selectedCodes?: readonly string[];
  onToggle?: (code: string) => void;
  /** Called when an operator wants to create a missing catalog permission. */
  onEnsure?: (action: CatalogAction) => void;
  ensuringCode?: string | null;
  disabled?: boolean;
  className?: string;
};

function asSet(value: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  return value instanceof Set ? value : new Set(value);
}

function actionsForKind(actions: CatalogAction[], kind: PermissionActionKind): CatalogAction[] {
  return actions.filter((action) => action.kind === kind);
}

export function PermissionActionMatrix({
  mode,
  existingCodes,
  selectedCodes = [],
  onToggle,
  onEnsure,
  ensuringCode,
  disabled,
  className,
}: Props) {
  const existing = asSet(existingCodes);
  const selected = new Set(selectedCodes);

  return (
    <div className={className}>
      <div className="overflow-x-auto rounded-[0.6rem] border border-border">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-surface-muted/60 text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Module</th>
              {ACTION_KIND_COLUMNS.map((column) => (
                <th key={column.kind} className="px-3 py-2 font-medium">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((module) => (
              <tr key={module.id} className="border-t border-border align-top">
                <td className="px-3 py-3">
                  <p className="font-medium text-text-primary">{module.label}</p>
                  <p className="mt-0.5 text-[11px] text-text-muted">{module.covers.join(', ')}</p>
                </td>
                {ACTION_KIND_COLUMNS.map((column) => {
                  const actions = actionsForKind(module.actions, column.kind);
                  return (
                    <td key={column.kind} className="px-3 py-3">
                      {actions.length === 0 ? (
                        <span className="text-xs text-text-muted">—</span>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {actions.map((action) => {
                            const inCatalog = existing.has(action.code);
                            const checked = selected.has(action.code);
                            if (mode === 'catalog') {
                              return (
                                <div
                                  key={action.code}
                                  className="rounded-[0.5rem] border border-border px-2 py-1.5"
                                  title={action.description}
                                >
                                  <p className="text-xs font-medium text-text-primary">{action.label}</p>
                                  <p className="font-mono text-[10px] text-text-muted">{action.code}</p>
                                  {inCatalog ? (
                                    <p className="mt-1 text-[11px] text-success">In catalog</p>
                                  ) : (
                                    <button
                                      type="button"
                                      className="mt-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
                                      disabled={disabled || ensuringCode === action.code}
                                      onClick={() => onEnsure?.(action)}
                                    >
                                      {ensuringCode === action.code ? 'Creating…' : 'Add to catalog'}
                                    </button>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <label
                                key={action.code}
                                className={`flex cursor-pointer items-start gap-2 rounded-[0.5rem] border px-2 py-1.5 ${
                                  checked ? 'border-primary/40 bg-primary/5' : 'border-border'
                                } ${!inCatalog ? 'opacity-60' : ''}`}
                                title={
                                  inCatalog
                                    ? action.description
                                    : `${action.description} (not in catalog yet — sync on Permissions page)`
                                }
                              >
                                <input
                                  type="checkbox"
                                  className="mt-0.5"
                                  checked={checked}
                                  disabled={disabled || !inCatalog}
                                  onChange={() => onToggle?.(action.code)}
                                />
                                <span>
                                  <span className="block text-xs font-medium text-text-primary">
                                    {action.label}
                                  </span>
                                  <span className="block font-mono text-[10px] text-text-muted">
                                    {action.code}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
