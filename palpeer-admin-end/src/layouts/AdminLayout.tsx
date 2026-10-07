import { Outlet } from 'react-router-dom';
import { ShellProvider } from '@/app/providers/ShellProvider';
import { MockModeBanner } from '@/components/feedback/MockModeBanner';
import { Header } from '@/components/navigation/Header';
import { Sidebar } from '@/components/navigation/Sidebar';

export function AdminLayout() {
  return (
    <ShellProvider>
      <a
        href="#main-content"
        className="skip-to-content"
      >
        Skip to main content
      </a>
      <div className="flex min-h-screen flex-col">
        <MockModeBanner />
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <main id="main-content" className="flex-1 overflow-y-auto bg-background px-4 py-6 lg:px-6" tabIndex={-1}>
              <div className="mx-auto w-full max-w-[1400px] animate-fade-in">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </ShellProvider>
  );
}
