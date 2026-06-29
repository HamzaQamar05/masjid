import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, KeyRound, Mail, MapPin, Search, Sparkles, User2 } from 'lucide-react';
import { API_BASE as API, persistAuth } from '../lib/authStorage.js';
const requiredInterests = ['Home', 'Prayer', 'Messages', 'Masjids', 'Network', 'Profile'];
const optionalInterests = ['Events', 'Library', 'Volunteer', 'Jobs', 'Business'];

export default function AuthScreen({ onLogin, onExplore, initialMode = 'login' }) {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('resetToken') || '';
  const [mode, setMode] = useState(resetToken ? 'reset' : initialMode);
  const [message, setMessage] = useState('');
  const [socialLoading, setSocialLoading] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: params.get('email') || '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    city: '',
    bio: '',
    resetToken,
    verificationCode: '',
    interests: [...optionalInterests]
  });

  useEffect(() => {
    if (!resetToken) setMode(initialMode);
  }, [initialMode, resetToken]);

  function toggleInterest(interest) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest]
    }));
  }

  async function submit(e) {
    e.preventDefault();
    if (mode === 'verify') return verifyEmail();
    if (mode === 'forgot') return requestReset();
    if (mode === 'reset' && form.password !== form.confirmPassword) return alert('Passwords do not match');
    const endpoint = mode === 'reset' ? '/api/auth/reset-password' : (mode === 'login' ? '/api/auth/login' : '/api/auth/register');
    const payload = mode === 'register' ? { ...form, interests: [...requiredInterests, ...form.interests] } : { ...form, resetToken: form.resetToken || form.verificationCode, code: form.verificationCode };
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.verificationRequired) {
          setForm((current) => ({ ...current, email: data.email || current.email, verificationCode: '' }));
          setMessage(data.error || 'Check your email for the verification code.');
          setMode('verify');
          return;
        }
        return alert(data.error || 'Something went wrong');
      }
      if (mode === 'register' && data.verificationRequired) {
        setForm((current) => ({ ...current, email: data.email || current.email, verificationCode: '' }));
        setMessage(data.message || 'Check your email for the verification code.');
        setMode('verify');
        return;
      }
      persistAuth(data.user, data.token);
      onLogin(data.user);
    } catch (err) {
      console.error(err);
      alert('Cannot reach Mujtama right now. Check your connection and try again.');
    }
  }

  async function requestReset() {
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email })
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Something went wrong');
      if (!data.resetCodeSent) {
        setMessage(data.message || 'No reset code was sent.');
        return;
      }
      setMessage(data.devResetCode ? `${data.message} Dev code: ${data.devResetCode}` : 'Check your email for the reset code.');
      setMode('reset');
    } catch (err) {
      console.error(err);
      alert('Cannot reach Mujtama right now. Check your connection and try again.');
    }
  }

  async function completeProviderLogin(provider, identityToken, profile = {}) {
    setSocialLoading(provider);
    setMessage('');
    try {
      const res = await fetch(`${API}/api/auth/oauth/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identityToken, profile })
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || `${provider} sign-in failed`);
      persistAuth(data.user, data.token);
      onLogin(data.user);
    } catch (err) {
      console.error(err);
      alert('Cannot complete social sign-in right now. Check your connection and try again.');
    } finally {
      setSocialLoading('');
    }
  }

  async function socialSignIn(provider) {
    if (provider === 'google') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      if (!clientId || !window.google?.accounts?.id) {
        setMessage('Google Sign-In needs VITE_GOOGLE_CLIENT_ID and the Google Identity script configured.');
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => completeProviderLogin('google', response.credential)
      });
      window.google.accounts.id.prompt();
      return;
    }
    if (provider === 'apple') {
      const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
      const redirectURI = import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin;
      if (!clientId || !window.AppleID?.auth) {
        setMessage('Sign in with Apple needs VITE_APPLE_CLIENT_ID and AppleID JS configured.');
        return;
      }
      try {
        window.AppleID.auth.init({ clientId, scope: 'name email', redirectURI, usePopup: true });
        const response = await window.AppleID.auth.signIn();
        await completeProviderLogin('apple', response?.authorization?.id_token, response?.user?.name ? { name: [response.user.name.firstName, response.user.name.lastName].filter(Boolean).join(' ') } : {});
      } catch (error) {
        console.error(error);
        setMessage('Apple sign-in was cancelled or could not be completed.');
      }
    }
  }

  async function verifyEmail() {
    try {
      const res = await fetch(`${API}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, code: form.verificationCode })
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Something went wrong');
      persistAuth(data.user, data.token);
      onLogin(data.user);
    } catch (err) {
      console.error(err);
      alert('Cannot reach Mujtama right now. Check your connection and try again.');
    }
  }

  async function resendVerification() {
    try {
      const res = await fetch(`${API}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email })
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Something went wrong');
      setMessage(data.devVerificationCode ? `${data.message} Dev code: ${data.devVerificationCode}` : 'Verification code sent. Check your email.');
    } catch (err) {
      console.error(err);
      alert('Cannot reach Mujtama right now. Check your connection and try again.');
    }
  }

  return (
    <main className="screen auth-screen">
      <div className="brand-mark"><img src="/icons/mujtama-icon-192.png" alt="" /></div>
      <h1>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Join Mujtama' : mode === 'forgot' ? 'Reset password' : mode === 'verify' ? 'Verify email' : 'Choose new password'}</h1>
      <p className="muted">{mode === 'verify' ? `Enter the 6-digit code sent to ${form.email}.` : mode === 'reset' ? 'Enter the code from your email, then choose a new password.' : 'A community app for masjids, MSAs, imams, students, volunteers, and Muslim professionals.'}</p>

      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <>
            <div className="auth-register-grid">
              <label className="auth-field-shell">
                <User2 size={18} />
                <input required placeholder="Name or organization" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="auth-field-shell auth-date-shell">
                <CalendarDays size={18} />
                <span>
                  <small>Date of birth</small>
                  <input required aria-label="Date of birth" type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
                </span>
              </label>
              <label className="auth-field-shell">
                <MapPin size={18} />
                <input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
              </label>
            </div>
            <label className="auth-field-shell auth-bio-shell">
              <Sparkles size={18} />
              <textarea placeholder="Headline or short bio" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
            </label>
            <section className="interest-picker auth-interest-picker">
              <div className="interest-picker-head">
                <div>
                  <strong>Choose your spaces</strong>
                  <p>Core tabs are included. Pick the extra areas you want to see first.</p>
                </div>
                <span>{form.interests.length}/{optionalInterests.length}</span>
              </div>
              <div className="interest-options">
                {optionalInterests.map((interest) => (
                  <label key={interest} className={form.interests.includes(interest) ? 'check-toggle active' : 'check-toggle'}>
                    <input type="checkbox" checked={form.interests.includes(interest)} onChange={() => toggleInterest(interest)} />
                    <span>{interest}</span>
                    <Check size={15} />
                  </label>
                ))}
              </div>
            </section>
          </>
        )}
        {mode !== 'verify' && <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />}
        {mode === 'verify' && <input required className="auth-code-input" placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.verificationCode} onChange={e => setForm({ ...form, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) })} />}
        {mode === 'reset' && <input required className="auth-code-input" placeholder="6-digit reset code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.verificationCode} onChange={e => setForm({ ...form, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6), resetToken: e.target.value.replace(/\D/g, '').slice(0, 6) })} />}
        {mode !== 'forgot' && mode !== 'verify' && <input required placeholder={mode === 'reset' ? 'New password' : 'Password'} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />}
        {mode === 'reset' && <input required placeholder="Confirm new password" type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} />}
        <button className="primary-button">{mode === 'login' ? 'Login' : mode === 'register' ? 'Create account' : mode === 'verify' ? <><Mail size={18} />Verify and log in</> : mode === 'forgot' ? <><Mail size={18} />Send reset code</> : <><KeyRound size={18} />Save password</>}</button>
      </form>
      {['login', 'register'].includes(mode) && (
        <div className="social-auth-row">
          <button type="button" className="secondary-button" onClick={() => socialSignIn('apple')} disabled={Boolean(socialLoading)}>
            {socialLoading === 'apple' ? 'Connecting...' : 'Sign in with Apple'}
          </button>
          <button type="button" className="secondary-button" onClick={() => socialSignIn('google')} disabled={Boolean(socialLoading)}>
            {socialLoading === 'google' ? 'Connecting...' : 'Sign in with Google'}
          </button>
        </div>
      )}
      {message && <p className="helper-text reset-message">{message}</p>}

      {onExplore && mode === 'login' && (
        <button type="button" className="secondary-button auth-explore-button" onClick={onExplore}>
          <Search size={18} />
          Explore masjids first
        </button>
      )}

      <div className="auth-links">
        <button className="text-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }}>
          {mode === 'login' ? 'Need an account? Register' : 'Back to login'}
        </button>
        {mode === 'verify' && <button className="text-btn" onClick={resendVerification}>Resend code</button>}
        {mode === 'login' && <button className="text-btn" onClick={() => { setMode('forgot'); setMessage(''); }}>Forgot password?</button>}
      </div>
    </main>
  );
}
