'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Zap, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, user, signOut } = useAuth();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error: signUpError } = await signUp(email, password);
        if (signUpError) {
          setError(signUpError.message);
        } else {
          setMessage('Account created successfully! You can now access the dashboard.');
          setTimeout(() => {
            router.push('/');
          }, 1500);
        }
      } else {
        const { error: signInError } = await signIn(email, password);
        if (signInError) {
          setError(signInError.message);
        } else {
          router.push('/');
        }
      }
    } catch (err: any) {
      setError(err?.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: '16px',
    padding: '36px 32px',
    width: '100%',
    maxWidth: '440px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
  };

  const inputWrapperStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid var(--color-border)',
    borderRadius: '8px',
    backgroundColor: 'var(--color-bg-primary)',
    padding: '0 12px',
    marginBottom: '16px',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '12px 10px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--color-text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 20px',
    backgroundColor: 'var(--color-accent)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
    width: '100%',
    marginTop: '8px',
    transition: 'all 0.2s ease',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg-primary)',
      padding: '24px',
    }}>
      <div style={cardStyle}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'rgba(20, 184, 166, 0.15)',
            color: 'var(--color-accent)',
            marginBottom: '16px',
          }}>
            <Zap size={26} />
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: '0 0 6px 0',
          }}>
            Smart Energy Meter
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)',
            margin: 0,
          }}>
            {isSignUp ? 'Create an account for device access' : 'Sign in to access your energy meter dashboard'}
          </p>
        </div>

        {user ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid var(--color-border)',
            }}>
              <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>Currently logged in as:</p>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text-primary)' }}>{user.email}</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => router.push('/')}
                style={buttonStyle}
              >
                Go to Dashboard <ArrowRight size={18} />
              </button>
              <button
                onClick={() => signOut()}
                style={{
                  ...buttonStyle,
                  backgroundColor: 'transparent',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Mode Switcher */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '8px',
              padding: '4px',
              marginBottom: '24px',
            }}>
              <button
                type="button"
                onClick={() => { setIsSignUp(false); setError(null); setMessage(null); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: !isSignUp ? 'var(--color-bg-card)' : 'transparent',
                  color: !isSignUp ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  transition: 'all 0.2s ease',
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsSignUp(true); setError(null); setMessage(null); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: isSignUp ? 'var(--color-bg-card)' : 'transparent',
                  color: isSignUp ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  transition: 'all 0.2s ease',
                }}
              >
                Sign Up
              </button>
            </div>

            {/* Error & Message Alerts */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid var(--color-danger)',
                color: 'var(--color-danger)',
                fontSize: '0.875rem',
                marginBottom: '16px',
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid var(--color-success)',
                color: 'var(--color-success)',
                fontSize: '0.875rem',
                marginBottom: '16px',
              }}>
                <CheckCircle2 size={18} />
                <span>{message}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                marginBottom: '6px',
              }}>
                Email Address
              </label>
              <div style={inputWrapperStyle}>
                <Mail size={18} color="var(--color-text-secondary)" />
                <input
                  type="email"
                  required
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <label style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--color-text-secondary)',
                marginBottom: '6px',
              }}>
                Password
              </label>
              <div style={inputWrapperStyle}>
                <Lock size={18} color="var(--color-text-secondary)" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <button type="submit" disabled={isLoading} style={buttonStyle}>
                {isLoading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
                {!isLoading && <ArrowRight size={18} />}
              </button>
            </form>

            {/* Dev bypass / guest link */}
            <div style={{ textAlign: 'center', marginTop: '20px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
              <Link
                href="/"
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--color-text-secondary)',
                  textDecoration: 'none',
                }}
              >
                Skip / Continue as Guest (Dev Mode) →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
