import { Navigate, Route, Routes } from 'react-router-dom';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequirePermission } from '@/features/auth/RequirePermission';
import { SignInPage } from '@/features/auth/SignInPage';
import { AdminsPage } from '@/features/admins/AdminsPage';
import { CardDetailPage } from '@/features/cards/CardDetailPage';
import { CardsPage } from '@/features/cards/CardsPage';
import { ChatPage } from '@/features/chat/ChatPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { KycDetailPage } from '@/features/kyc/KycDetailPage';
import { KycPage } from '@/features/kyc/KycPage';
import { NegotiationDetailPage } from '@/features/negotiations/NegotiationDetailPage';
import { NegotiationsPage } from '@/features/negotiations/NegotiationsPage';
import { AuditPage } from '@/features/audit/AuditPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { P2PFeesPage } from '@/features/fees/P2PFeesPage';
import { P2PDetailPage } from '@/features/p2p/P2PDetailPage';
import { P2PPage } from '@/features/p2p/P2PPage';
import { PermissionsPage } from '@/features/permissions/PermissionsPage';
import { PromotionsPage } from '@/features/promotions/PromotionsPage';
import { RatesPage } from '@/features/rates/RatesPage';
import { ReferralDetailPage } from '@/features/referrals/ReferralDetailPage';
import { ReferralsPage } from '@/features/referrals/ReferralsPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { RolesPage } from '@/features/roles/RolesPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TransactionDetailPage } from '@/features/transactions/TransactionDetailPage';
import { TransactionsPage } from '@/features/transactions/TransactionsPage';
import { UserDetailPage } from '@/features/users/UserDetailPage';
import { UsersPage } from '@/features/users/UsersPage';
import { WalletDetailPage } from '@/features/wallets/WalletDetailPage';
import { WalletsPage } from '@/features/wallets/WalletsPage';
import { AdminLayout } from '@/layouts/AdminLayout';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route
          path="users"
          element={
            <RequirePermission permission="users:read">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="users/:id"
          element={
            <RequirePermission permission="users:read">
              <UserDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="kyc"
          element={
            <RequirePermission permission="kyc:read">
              <KycPage />
            </RequirePermission>
          }
        />
        <Route
          path="kyc/:caseId"
          element={
            <RequirePermission permission="kyc:read">
              <KycDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="wallets"
          element={
            <RequirePermission permission="wallets:read">
              <WalletsPage />
            </RequirePermission>
          }
        />
        <Route
          path="wallets/:id"
          element={
            <RequirePermission permission="wallets:read">
              <WalletDetailPage />
            </RequirePermission>
          }
        />
        <Route path="rates" element={<RatesPage />} />
        <Route
          path="transactions"
          element={
            <RequirePermission permission="transactions:read">
              <TransactionsPage />
            </RequirePermission>
          }
        />
        <Route
          path="transactions/:id"
          element={
            <RequirePermission permission="transactions:read">
              <TransactionDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="p2p"
          element={
            <RequirePermission permission="p2p:read">
              <P2PPage />
            </RequirePermission>
          }
        />
        <Route
          path="p2p/manage-rate"
          element={<Navigate to="/admin/rates?channel=P2P" replace />}
        />
        <Route
          path="p2p/:id"
          element={
            <RequirePermission permission="p2p:read">
              <P2PDetailPage />
            </RequirePermission>
          }
        />
        <Route path="fees" element={<Navigate to="/admin/fees/p2p" replace />} />
        <Route
          path="fees/p2p"
          element={
            <RequirePermission permission="fees:read">
              <P2PFeesPage />
            </RequirePermission>
          }
        />
        <Route
          path="negotiations"
          element={
            <RequirePermission permission="negotiations:read">
              <NegotiationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="negotiations/:id"
          element={
            <RequirePermission permission="negotiations:read">
              <NegotiationDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="chat"
          element={
            <RequirePermission permission="chat:read">
              <ChatPage />
            </RequirePermission>
          }
        />
        <Route
          path="cards"
          element={
            <RequirePermission permission="cards:read">
              <CardsPage />
            </RequirePermission>
          }
        />
        <Route
          path="cards/:id"
          element={
            <RequirePermission permission="cards:read">
              <CardDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="notifications"
          element={
            <RequirePermission permission="notifications:read">
              <NotificationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="promotions"
          element={
            <RequirePermission permission="promotions:write">
              <PromotionsPage />
            </RequirePermission>
          }
        />
        <Route
          path="referrals"
          element={
            <RequirePermission permission="promotions:write">
              <ReferralsPage />
            </RequirePermission>
          }
        />
        <Route
          path="referrals/:id"
          element={
            <RequirePermission permission="promotions:write">
              <ReferralDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="reports"
          element={
            <RequirePermission permission="reports:read">
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="audit"
          element={
            <RequirePermission permission="audit:read">
              <AuditPage />
            </RequirePermission>
          }
        />
        <Route
          path="admins"
          element={
            <RequirePermission permission="admin:manage">
              <AdminsPage />
            </RequirePermission>
          }
        />
        <Route
          path="roles"
          element={
            <RequirePermission permission="admin:manage">
              <RolesPage />
            </RequirePermission>
          }
        />
        <Route
          path="roles/:code"
          element={
            <RequirePermission permission="admin:manage">
              <RolesPage />
            </RequirePermission>
          }
        />
        <Route
          path="permissions"
          element={
            <RequirePermission permission="admin:manage">
              <PermissionsPage />
            </RequirePermission>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}
