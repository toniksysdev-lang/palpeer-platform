import {
  ArrowLeftRight,
  BadgePercent,
  Banknote,
  Bell,
  ClipboardList,
  CreditCard,
  FileBarChart2,
  Gift,
  KeyRound,
  Landmark,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Percent,
  Scale,
  Shield,
  ShieldCheck,
  Settings,
  Sparkles,
  UserCog,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  /** Permission code when Phase 2+ wires RBAC. Phase 1 shows all. */
  permission?: string;
  contractPending?: boolean;
  /** Nested sidebar items (e.g. Fee Management → P2P Fees). */
  children?: NavItem[];
};

export const primaryNav: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'App users', path: '/admin/users', icon: Users, permission: 'users:read' },
  { id: 'kyc', label: 'KYC', path: '/admin/kyc', icon: ShieldCheck, permission: 'kyc:read' },
  {
    id: 'wallets',
    label: 'Wallets',
    path: '/admin/wallets',
    icon: Wallet,
    permission: 'wallets:read',
  },
  {
    id: 'pool-funds',
    label: 'Pool Funds',
    path: '/admin/pool-funds',
    icon: Landmark,
    permission: 'wallets:read',
  },
  { id: 'rates', label: 'Rates', path: '/admin/rates', icon: ArrowLeftRight },
  {
    id: 'transactions',
    label: 'Transactions',
    path: '/admin/transactions',
    icon: Banknote,
    permission: 'transactions:read',
  },
  { id: 'p2p', label: 'P2P', path: '/admin/p2p', icon: Scale, permission: 'p2p:read' },
  {
    id: 'fees',
    label: 'Fee Management',
    path: '/admin/fees',
    icon: Percent,
    permission: 'fees:read',
    children: [
      {
        id: 'fees-p2p',
        label: 'P2P Fees',
        path: '/admin/fees/p2p',
        icon: Scale,
        permission: 'fees:read',
      },
    ],
  },
  {
    id: 'negotiations',
    label: 'Negotiations',
    path: '/admin/negotiations',
    icon: ClipboardList,
    permission: 'negotiations:read',
  },
  {
    id: 'chat',
    label: 'Chat',
    path: '/admin/chat',
    icon: MessageSquare,
    permission: 'chat:read',
  },
  {
    id: 'cards',
    label: 'Cards',
    path: '/admin/cards',
    icon: CreditCard,
    permission: 'cards:read',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    path: '/admin/notifications',
    icon: Bell,
    permission: 'notifications:read',
  },
  {
    id: 'push-message',
    label: 'Push Message',
    path: '/admin/push-message',
    icon: Megaphone,
    permission: 'notifications:write',
  },
  {
    id: 'promotions',
    label: 'Promotions',
    path: '/admin/promotions',
    icon: BadgePercent,
    permission: 'promotions:write',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    path: '/admin/marketing',
    icon: Sparkles,
    permission: 'promotions:write',
  },
  {
    id: 'referrals',
    label: 'Referrals',
    path: '/admin/referrals',
    icon: Gift,
    permission: 'promotions:write',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/admin/reports',
    icon: FileBarChart2,
    permission: 'reports:read',
  },
  {
    id: 'audit',
    label: 'Audit Logs',
    path: '/admin/audit',
    icon: ClipboardList,
    permission: 'audit:read',
  },
  {
    id: 'admins',
    label: 'Admins',
    path: '/admin/admins',
    icon: UserCog,
    permission: 'admin:manage',
  },
  {
    id: 'roles',
    label: 'Roles',
    path: '/admin/roles',
    icon: Shield,
    permission: 'admin:manage',
  },
  {
    id: 'permissions',
    label: 'Permissions',
    path: '/admin/permissions',
    icon: KeyRound,
    permission: 'admin:manage',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/admin/settings',
    icon: Settings,
  },
  {
    id: 'admin-profile',
    label: 'Admin user profile',
    path: '/admin/profile',
    icon: UserRound,
  },
  {
    id: 'security',
    label: 'Security',
    path: '/admin/profile#security',
    icon: Shield,
  },
];

/** Path without hash fragment (for matching). */
function navPath(path: string): string {
  const hashAt = path.indexOf('#');
  return hashAt >= 0 ? path.slice(0, hashAt) : path;
}

/** Flatten primary nav including nested children for path matching. */
export function flattenNav(items: NavItem[] = primaryNav): NavItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenNav(item.children) : [])]);
}

export function findNavItem(pathname: string, hash = ''): NavItem | undefined {
  const hashId = hash.replace(/^#/, '');
  if (pathname === '/admin/profile' || pathname.startsWith('/admin/profile/')) {
    if (hashId === 'security') {
      return flattenNav().find((item) => item.id === 'security');
    }
    return flattenNav().find((item) => item.id === 'admin-profile');
  }

  // Prefer the longest matching path so nested routes win over parents.
  const matches = flattenNav().filter((item) => {
    const base = navPath(item.path);
    return pathname === base || pathname.startsWith(`${base}/`);
  });
  return matches.sort((a, b) => navPath(b.path).length - navPath(a.path).length)[0];
}
