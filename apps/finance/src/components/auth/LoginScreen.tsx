/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Lock,
  Mail,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  UserCheck,
  KeyRound,
  RotateCw,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
} from '../../services/firebase';
import { api } from '../../services/api';
import { SystemUser, UserRoleDefinition, AccessControlState } from '../../types';
import { AtriumLogo } from '../common/AtriumLogo';

interface LoginScreenProps {
  onLoginSuccess: (user: SystemUser, role: UserRoleDefinition, state: AccessControlState) => void;
  registeredUsers: SystemUser[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  registeredUsers,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'email' | 'quick-select'>('email');

  // Direct login verification against backend RBAC registry
  const handleVerifyEmail = async (targetEmail: string, targetPassword?: string, isGoogleOAuth = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.verifyUser({
        email: targetEmail,
        password: targetPassword,
        isGoogleOAuth,
      });
      if (result.authorized) {
        onLoginSuccess(result.user, result.role, result.state);
      } else {
        setError('Access denied: Invalid email or password.');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify your email and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your corporate email address.');
      return;
    }
    if (!password.trim()) {
      setError('Please enter your account password.');
      return;
    }
    await handleVerifyEmail(email.trim(), password.trim(), false);
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const userEmail = res.user.email;
      if (!userEmail) {
        throw new Error('Unable to retrieve email from Google account.');
      }
      await handleVerifyEmail(userEmail, undefined, true);
    } catch (err: any) {
      // In preview iframe, popups might require fallback
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        setError('Popup was blocked by the browser. Please use the corporate email and password fields below.');
      } else {
        setError(err.message || 'Failed to authenticate with Google.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center p-4 selection:bg-slate-900/30 selection:text-emerald-200">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/20 via-slate-950 to-slate-950 -z-10 pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Brand Header: PT Atrium Management Group */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white border border-amber-500/30 shadow-xs shadow-amber-950/40 mb-2">
            <AtriumLogo variant="arch-only" size="lg" theme="dark" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
            PT ATRIUM MANAGEMENT GROUP
          </h1>
          <p className="text-xs text-amber-700/90 font-mono tracking-widest uppercase">
            Double-Entry Hotel ERP &bull; USALI 12th Revised Edition
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-700" />
                Employee &amp; Financial Controller Portal
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Only administrator-approved corporate accounts are authorized to sign in.
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900/10 text-emerald-700 border border-emerald-800 font-semibold">
              RBAC PROTECTED
            </span>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-600/10/50 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Access Denied</span>
                <span className="text-[11px] text-rose-300 leading-relaxed block">{error}</span>
              </div>
            </div>
          )}

          {/* Google Sign-in Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-850 border border-slate-200 hover:border-slate-200 text-slate-700 text-xs font-semibold transition-all shadow-xs disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google (Authorized Account)</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[10px] text-slate-500 font-mono uppercase tracking-wider">
              Or sign in with corporate credentials
            </span>
          </div>

          {/* Email Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Corporate Email Address:
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. laluzayen@gmail.com"
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Password:
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Managed by Controller
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter account password"
                  required
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <span className="text-[10px] text-slate-500 block mt-1">
                Passwords can be configured or reset via the Administrator panel.
              </span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs shadow-emerald-950 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to PT Atrium Management ERP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Authorized Personas Showcase for easy access testing */}
          <div className="pt-2 border-t border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Authorized Staff Profiles (Demo / Test):
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {registeredUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setEmail(u.email);
                    setPassword(u.password || 'AtriumHotel2026!');
                    handleVerifyEmail(u.email, u.password || 'AtriumHotel2026!', false);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-white/70 hover:bg-slate-850 border border-slate-200 hover:border-emerald-500/40 text-left transition-colors group"
                >
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700 group-hover:text-emerald-700">
                        {u.name}
                      </span>
                      {u.email === 'laluzayen@gmail.com' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900/10 border border-emerald-800 text-emerald-700 font-mono">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 block truncate">
                      {u.email}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 font-medium group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
                    Sign In →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security Notice Footer */}
        <div className="text-center mt-6 space-y-1">
          <p className="text-[11px] text-slate-500 font-mono">
            Tiered Security &bull; Role-Based Access Control (RBAC) &bull; Active Audit Trail
          </p>
          <p className="text-[10px] text-slate-500">
            To configure staff roles or module access permissions, access <strong>Pillar 8: Administration</strong> after signing in.
          </p>
        </div>
      </div>
    </div>
  );
};
