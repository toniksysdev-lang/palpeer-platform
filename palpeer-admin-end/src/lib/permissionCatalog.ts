/**
 * Canonical admin permission catalog: modules × actions.
 * Codes stay `resource:action` for the API; UI labels use Read / Edit / Delete / Other.
 * Keep in sync with Flyway admin_permissions seeds and @PreAuthorize authorities.
 */

export type PermissionActionKind = 'read' | 'edit' | 'delete' | 'other';

export type CatalogAction = {
  /** Full permission code stored in admin_permissions / JWT authorities. */
  code: string;
  kind: PermissionActionKind;
  /** Column / chip label shown in the matrix. */
  label: string;
  description: string;
};

export type CatalogModule = {
  id: string;
  label: string;
  /** Admin nav paths this module gates (for operator context). */
  covers: string[];
  actions: CatalogAction[];
};

function action(
  code: string,
  kind: PermissionActionKind,
  label: string,
  description: string,
): CatalogAction {
  return { code, kind, label, description };
}

/** All admin-end modules with Read / Edit / Delete / other actions. */
export const PERMISSION_MODULES: CatalogModule[] = [
  {
    id: 'users',
    label: 'App users',
    covers: ['/admin/users'],
    actions: [
      action('users:read', 'read', 'Read', 'List and view app users'),
      action('users:write', 'edit', 'Edit', 'Update user status / enabled'),
      action('users:delete', 'delete', 'Delete', 'Remove or hard-disable user records'),
      action('users:notes:read', 'other', 'Notes read', 'View internal user notes'),
      action('users:notes:write', 'other', 'Notes edit', 'Create or edit internal user notes'),
    ],
  },
  {
    id: 'kyc',
    label: 'KYC',
    covers: ['/admin/kyc'],
    actions: [
      action('kyc:read', 'read', 'Read', 'List and view KYC cases'),
      action('kyc:review', 'other', 'Review', 'Approve or reject KYC'),
      action('kyc:write', 'edit', 'Edit', 'Update KYC case metadata'),
      action('kyc:delete', 'delete', 'Delete', 'Remove KYC artifacts or cases'),
    ],
  },
  {
    id: 'wallets',
    label: 'Wallets & pool funds',
    covers: ['/admin/wallets', '/admin/pool-funds'],
    actions: [
      action('wallets:read', 'read', 'Read', 'View wallets, ledger, and pool funds'),
      action('wallets:write', 'edit', 'Edit', 'Adjust wallet / pool settings'),
      action('wallets:delete', 'delete', 'Delete', 'Remove wallet-side operational records'),
      action('payments:operate', 'other', 'Operate payments', 'Manual funding / withdrawal operator actions'),
    ],
  },
  {
    id: 'rates',
    label: 'Rates & currencies',
    covers: ['/admin/rates'],
    actions: [
      action('rates:read', 'read', 'Read', 'View FX rates and bounds'),
      action('rates:write', 'edit', 'Edit', 'Publish rates and P2P bounds'),
      action('rates:delete', 'delete', 'Delete', 'Remove rate channels or drafts'),
      action('currencies:write', 'other', 'Currencies', 'Create or update currencies'),
    ],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    covers: ['/admin/transactions'],
    actions: [
      action('transactions:read', 'read', 'Read', 'View user and platform transactions'),
      action('transactions:write', 'edit', 'Edit', 'Annotate or adjust transaction records'),
      action('transactions:delete', 'delete', 'Delete', 'Remove transaction artifacts'),
    ],
  },
  {
    id: 'p2p',
    label: 'P2P',
    covers: ['/admin/p2p'],
    actions: [
      action('p2p:read', 'read', 'Read', 'View P2P requests and orders'),
      action('p2p:write', 'edit', 'Edit', 'Cancel, complete, or update P2P'),
      action('p2p:delete', 'delete', 'Delete', 'Remove P2P listings'),
    ],
  },
  {
    id: 'fees',
    label: 'Fee management',
    covers: ['/admin/fees', '/admin/fees/p2p', '/admin/fees/instantex'],
    actions: [
      action('fees:read', 'read', 'Read', 'View P2P and InstantEX fee tiers'),
      action('fees:write', 'edit', 'Edit', 'Create or update fee tiers'),
      action('fees:delete', 'delete', 'Delete', 'Remove fee tiers'),
    ],
  },
  {
    id: 'platform-revenue',
    label: 'Platform revenue',
    covers: ['/admin/platform-fees'],
    actions: [
      action('reports:read', 'read', 'Read', 'View platform fee revenue reports'),
      action('fees:read', 'other', 'Fees read', 'Also required for some revenue views'),
    ],
  },
  {
    id: 'negotiations',
    label: 'Negotiations',
    covers: ['/admin/negotiations'],
    actions: [
      action('negotiations:read', 'read', 'Read', 'List and view negotiations'),
      action('negotiations:write', 'edit', 'Edit', 'Update negotiation lifecycle'),
      action('negotiations:delete', 'delete', 'Delete', 'Remove negotiation records'),
    ],
  },
  {
    id: 'chat',
    label: 'Chat',
    covers: ['/admin/chat'],
    actions: [
      action('chat:read', 'read', 'Read', 'View chat rooms and messages'),
      action('chat:write', 'edit', 'Edit', 'Moderate or send as operator'),
      action('chat:delete', 'delete', 'Delete', 'Delete chat messages or rooms'),
    ],
  },
  {
    id: 'cards',
    label: 'Cards',
    covers: ['/admin/cards'],
    actions: [
      action('cards:read', 'read', 'Read', 'List cards and card transactions'),
      action('cards:write', 'edit', 'Edit', 'Block or unblock cards'),
      action('cards:delete', 'delete', 'Delete', 'Remove card records'),
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications & push',
    covers: ['/admin/notifications', '/admin/push-message'],
    actions: [
      action('notifications:read', 'read', 'Read', 'List notifications across users'),
      action('notifications:write', 'edit', 'Edit', 'Send push / create notifications'),
      action('notifications:delete', 'delete', 'Delete', 'Remove notification records'),
    ],
  },
  {
    id: 'promotions',
    label: 'Promotions, marketing & referrals',
    covers: ['/admin/promotions', '/admin/marketing', '/admin/referrals'],
    actions: [
      action('promotions:read', 'read', 'Read', 'View promotions, ads, and referrals'),
      action('promotions:write', 'edit', 'Edit', 'Create or update promotions and marketing'),
      action('promotions:delete', 'delete', 'Delete', 'Remove promotions or adverts'),
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    covers: ['/admin/reports'],
    actions: [
      action('reports:read', 'read', 'Read', 'View and export report datasets'),
      action('reports:write', 'edit', 'Edit', 'Configure report jobs'),
      action('reports:delete', 'delete', 'Delete', 'Remove saved report exports'),
    ],
  },
  {
    id: 'audit',
    label: 'Audit logs',
    covers: ['/admin/audit'],
    actions: [
      action('audit:read', 'read', 'Read', 'Read audit logs'),
      action('audit:write', 'edit', 'Edit', 'Annotate audit entries'),
      action('audit:delete', 'delete', 'Delete', 'Purge audit retention (ops)'),
    ],
  },
  {
    id: 'admin-rbac',
    label: 'Admins, roles & permissions',
    covers: ['/admin/admins', '/admin/roles', '/admin/permissions'],
    actions: [
      action('admin:manage', 'other', 'Manage', 'Create admins, roles, and permissions'),
      action('admin:read', 'read', 'Read', 'View admin operators and RBAC catalog'),
      action('admin:delete', 'delete', 'Delete', 'Delete admin operators or roles'),
    ],
  },
  {
    id: 'settings',
    label: 'Settings & security',
    covers: ['/admin/settings', '/admin/profile', '/admin/settings?tab=security'],
    actions: [
      action('settings:read', 'read', 'Read', 'View platform settings'),
      action('settings:write', 'edit', 'Edit', 'Update platform settings (limits, countries, PIN policy)'),
      action('admin:manage', 'other', 'Manage', 'Also covers several settings write APIs today'),
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    covers: ['/admin/dashboard'],
    actions: [
      action('dashboard:read', 'read', 'Read', 'View admin dashboard aggregates'),
    ],
  },
];

/** Unique permission codes from the catalog (stable order). */
export const CATALOG_PERMISSION_CODES: string[] = (() => {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const module of PERMISSION_MODULES) {
    for (const item of module.actions) {
      if (seen.has(item.code)) continue;
      seen.add(item.code);
      codes.push(item.code);
    }
  }
  return codes;
})();

export function catalogActionByCode(code: string): CatalogAction | undefined {
  for (const module of PERMISSION_MODULES) {
    const found = module.actions.find((item) => item.code === code);
    if (found) return found;
  }
  return undefined;
}

export function catalogDescription(code: string): string {
  return catalogActionByCode(code)?.description ?? code;
}

export const ACTION_KIND_COLUMNS: { kind: PermissionActionKind; label: string }[] = [
  { kind: 'read', label: 'Read' },
  { kind: 'edit', label: 'Edit' },
  { kind: 'delete', label: 'Delete' },
  { kind: 'other', label: 'Other' },
];
