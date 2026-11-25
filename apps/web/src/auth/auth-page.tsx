import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Calculator, Eye, EyeOff, Smartphone } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { createApi, type Credentials } from '@/api/client';
import { ErrorNotice } from '@/components/feedback';
import { Button } from '@/components/ui/button';
import { useAuth } from './session';

const api = createApi();
function credentialsSchema(register: boolean) {
  return z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .pipe(z.email('Enter a valid email address.')),
    password: z
      .string()
      .min(
        register ? 12 : 1,
        register ? 'Use at least 12 characters.' : 'Enter your password.',
      )
      .max(128, 'Use at most 128 characters.'),
  });
}

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <Smartphone size={20} strokeWidth={2.5} aria-hidden="true" />
      </span>
      <span>
        Device<span className="brand-secondary">Finance</span>
      </span>
    </div>
  );
}

export function AuthPage({ registering }: { registering: boolean }) {
  const { session, expired, signIn } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [error, setError] = useState<unknown>(null);
  const [visible, setVisible] = useState(false);
  const active = useRef<AbortController | null>(null);
  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema(registering)),
    defaultValues: { email: '', password: '' },
  });
  useEffect(() => () => active.current?.abort(), []);

  if (session) return <Navigate to="/" replace />;

  const submit = form.handleSubmit(async (credentials) => {
    setError(null);
    const controller = new AbortController();
    active.current = controller;
    try {
      if (registering) {
        await api.register(credentials, controller.signal);
        if (!controller.signal.aborted)
          void navigate('/login?registered=1', { replace: true });
      } else {
        const token = await api.login(credentials, controller.signal);
        if (!controller.signal.aborted) signIn(token, credentials.email);
      }
    } catch (issue) {
      if (!controller.signal.aborted) setError(issue);
    }
  });
  const { errors, isSubmitting } = form.formState;

  return (
    <div className="auth-layout">
      <main className="auth-main">
        <Brand />
        <div className="auth-form">
          <h1>{registering ? 'Create your account' : 'Welcome back'}</h1>
          <p className="subtle">
            {registering
              ? 'Start comparing device repayments and saving your contracts.'
              : 'Sign in to compare repayments and manage your contracts.'}
          </p>
          {!registering && search === '?registered=1' && (
            <p role="status" className="notice notice-success">
              Account created. You can now sign in.
            </p>
          )}
          {!registering && expired && (
            <p role="status" className="notice notice-info">
              Your session expired. Sign in again to continue.
            </p>
          )}
          {error != null && <ErrorNotice error={error} />}
          <form noValidate onSubmit={(event) => void submit(event)}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...form.register('email')}
            />
            {errors.email && (
              <p className="field-error" id="email-error" role="alert">
                {errors.email.message}
              </p>
            )}
            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={visible ? 'text' : 'password'}
                autoComplete={registering ? 'new-password' : 'current-password'}
                aria-invalid={!!errors.password}
                aria-describedby={
                  errors.password
                    ? 'password-error'
                    : registering
                      ? 'password-help'
                      : undefined
                }
                {...form.register('password')}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={visible ? 'Hide password' : 'Show password'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {errors.password ? (
              <p className="field-error" id="password-error" role="alert">
                {errors.password.message}
              </p>
            ) : (
              registering && (
                <p className="field-help" id="password-help">
                  Use at least 12 characters.
                </p>
              )
            )}
            <Button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Please wait…'
                : registering
                  ? 'Create account'
                  : 'Sign in'}
              <ArrowRight size={17} aria-hidden="true" />
            </Button>
          </form>
          <p className="auth-switch">
            {registering
              ? 'Already have an account?'
              : 'New to Device Finance?'}{' '}
            <Link to={registering ? '/login' : '/register'}>
              {registering ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </div>
        <p className="auth-footer">Refreshing the page signs you out.</p>
      </main>
      <aside className="auth-side">
        <div className="auth-side-content">
          <span className="auth-side-icon">
            <Calculator size={36} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <h2>Find a repayment that fits.</h2>
          <p>
            Compare 12, 24 and 36 month plans side by side before saving a
            contract.
          </p>
          <div className="term-strip" aria-hidden="true">
            <span>12 months</span>
            <span>24 months</span>
            <span>36 months</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
