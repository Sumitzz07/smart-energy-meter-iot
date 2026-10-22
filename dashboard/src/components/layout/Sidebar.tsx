'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  Bell,
  Zap,
  X,
  User as UserIcon,
  LogOut,
  LogIn,
  Cpu,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  unacknowledgedCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({
  isOpen,
  onClose,
  unacknowledgedCount = 0,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/device', label: 'Device Status', icon: Cpu },
    { href: '/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/alerts', label: 'Alerts & Faults', icon: Bell, badge: unacknowledgedCount },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const sidebarWidth = isCollapsed ? '72px' : '260px';

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 90,
            display: 'block',
          }}
          className="mobile-overlay"
        />
      )}

      {/* Main Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: sidebarWidth,
          backgroundColor: 'var(--color-bg-secondary)',
          borderRight: '1px solid var(--color-border)',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
          overflowY: 'auto',
        }}
        className={`sidebar ${isOpen ? 'mobile-open' : ''}`}
      >
        {/* Brand Header */}
        <div
          style={{
            height: '64px',
            padding: isCollapsed ? '0 1rem' : '0 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--color-border-subtle)',
            flexShrink: 0,
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'var(--color-text-primary)',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-accent-transparent)',
                border: '1px solid var(--color-accent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-accent)',
                flexShrink: 0,
              }}
            >
              <Zap size={20} />
            </div>
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    lineHeight: 1.2,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  SMART METER
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--color-text-muted)',
                    fontWeight: 500,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  IoT Energy Platform
                </span>
              </div>
            )}
          </Link>

          {/* Close button on mobile */}
          <button
            onClick={onClose}
            className="mobile-close-btn"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              display: 'none',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation List */}
        <nav style={{ flex: 1, padding: isCollapsed ? '1rem 0.5rem' : '1rem 0.75rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onClose()}
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: isCollapsed ? '0.75rem 0' : '0.6875rem 0.875rem',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      borderRadius: 'var(--radius-md)',
                      textDecoration: 'none',
                      color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                      backgroundColor: isActive ? 'var(--color-accent-transparent)' : 'transparent',
                      border: isActive ? '1px solid var(--color-accent-border)' : '1px solid transparent',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '0.875rem',
                      transition: 'all var(--transition-fast)',
                      position: 'relative',
                    }}
                  >
                    <Icon size={19} style={{ flexShrink: 0 }} />
                    {!isCollapsed && <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{item.label}</span>}
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        style={{
                          backgroundColor: 'var(--color-danger)',
                          color: '#fff',
                          fontSize: '0.7rem',
                          padding: isCollapsed ? '1px 4px' : '2px 7px',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 700,
                          lineHeight: 1.2,
                          position: isCollapsed ? 'absolute' : 'static',
                          top: isCollapsed ? '4px' : undefined,
                          right: isCollapsed ? '4px' : undefined,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Collapse / Expand Toggle Button (Desktop) */}
        {onToggleCollapse && (
          <div
            style={{
              padding: isCollapsed ? '0.75rem 0.5rem' : '0.75rem 1rem',
              borderTop: '1px solid var(--color-border-subtle)',
              display: 'flex',
              justifyContent: isCollapsed ? 'center' : 'flex-end',
            }}
            className="collapse-toggle-wrapper"
          >
            <button
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)',
                fontSize: '0.75rem',
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {isCollapsed ? (
                <ChevronRight size={16} />
              ) : (
                <>
                  <ChevronLeft size={16} />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* User Account / Auth Section */}
        <div
          style={{
            padding: isCollapsed ? '0.75rem 0.5rem' : '0.875rem 1rem',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'hsla(222, 24%, 6%, 0.5)',
            flexShrink: 0,
          }}
        >
          {mounted && user ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'space-between',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-accent)',
                    flexShrink: 0,
                  }}
                >
                  <UserIcon size={16} />
                </div>
                {!isCollapsed && (
                  <div style={{ overflow: 'hidden' }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                      }}
                    >
                      {user.email?.split('@')[0]}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.6875rem',
                        color: 'var(--color-success)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <ShieldCheck size={11} /> Authenticated
                    </p>
                  </div>
                )}
              </div>
              {!isCollapsed && (
                <button
                  onClick={() => signOut()}
                  title="Sign out"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LogOut size={16} />
                </button>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => onClose()}
              title={isCollapsed ? 'Sign In / Auth' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                color: 'var(--color-text-secondary)',
                backgroundColor: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                fontSize: '0.8125rem',
                justifyContent: 'center',
                fontWeight: 500,
              }}
            >
              <LogIn size={15} color="var(--color-accent)" />
              {!isCollapsed && <span>Sign In</span>}
            </Link>
          )}
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%) !important;
            width: 260px !important;
          }
          .sidebar.mobile-open {
            transform: translateX(0) !important;
            box-shadow: var(--shadow-lg) !important;
          }
          .mobile-close-btn {
            display: flex !important;
          }
          .collapse-toggle-wrapper {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
}
