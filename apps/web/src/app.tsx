import { QueryClientProvider } from '@tanstack/react-query';
import { Calculator, FileText, LogOut } from 'lucide-react';
import { lazy, Suspense } from 'react';
import {
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
} from 'react-router-dom';
import { AuthPage, Brand } from '@/auth/auth-page';
import { AuthProvider, useAuth } from '@/auth/session';
import { Loading } from '@/components/feedback';
import { CalculatorPage } from '@/features/repayment/calculator';

const ContractsPage = lazy(async () => ({
  default: (await import('@/features/contracts/contracts')).ContractsPage,
}));
const ContractDetail = lazy(async () => ({
  default: (await import('@/features/contracts/contracts')).ContractDetail,
}));

function Protected() {
  const { session, signOut } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  return (
    <QueryClientProvider key={session.key} client={session.queryClient}>
      <div className="workspace">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <aside className="sidebar">
          <Link className="brand-link" to="/" aria-label="Device Finance home">
            <Brand />
          </Link>
          <nav aria-label="Main navigation">
            <NavLink to="/" end>
              <Calculator size={19} aria-hidden="true" />
              <span>Calculator</span>
            </NavLink>
            <NavLink to="/contracts">
              <FileText size={19} aria-hidden="true" />
              <span>My Contracts</span>
            </NavLink>
          </nav>
          <div className="sidebar-account">
            <div className="account-email">
              <span aria-hidden="true">
                {session.email.slice(0, 1).toUpperCase()}
              </span>
              <strong title={session.email}>{session.email}</strong>
            </div>
            <button
              className="sign-out"
              type="button"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut size={18} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>
        <main className="workspace-main" id="main-content" tabIndex={-1}>
          <Suspense fallback={<Loading>Loading page…</Loading>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </QueryClientProvider>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route
          path="/login"
          element={<AuthPage key="login" registering={false} />}
        />
        <Route
          path="/register"
          element={<AuthPage key="register" registering />}
        />
        <Route element={<Protected />}>
          <Route index element={<CalculatorPage />} />
          <Route path="contracts" element={<ContractsPage />} />
          <Route path="contracts/:id" element={<ContractDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
