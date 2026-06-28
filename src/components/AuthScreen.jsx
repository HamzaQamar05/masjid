import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, KeyRound, Mail, MapPin, Sparkles, User2 } from 'lucide-react';
import { API_BASE as API, persistAuth } from '../lib/authStorage.js';
const requiredInterests = ['Home', 'Prayer', 'Messages', 'Masjids', 'Network', 'Profile'];
const optionalInterests = ['Events', 'Library', 'Volunteer', 'Jobs', 'Business'];

export default function AuthScreen({ onLogin, initialMode = 'login' }) {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('resetToken') || '';
  const [mode, setMode] = useState(resetToken ? 'reset' : initialMode);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: params.get('email') || '',
    password: '',
    dateOfBirth: '',
    city: '',
    bio: '',
    resetToken,
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
    if (mode === 'forgot') return requestReset();
    const endpoint = mode === 'reset' ? '/api/auth/reset-password' : (mode === 'login' ? '/api/auth/login' : '/api/auth/register');
    const payload = mode === 'register' ? { ...form, interests: [...requiredInterests, ...form.interests] } : form;
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  async function requestReset() {
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email })
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Something went wrong');
      setMessage(data.devResetLink ? `${data.message} Dev link: ${data.devResetLink}` : data.message);
    } catch (err) {
      console.error(err);
      alert('Cannot reach Mujtama right now. Check your connection and try again.');
    }
  }

  return (
    <main className="screen auth-screen">
      <div className="brand-mark"><img src="/icons/mujtama-icon-192.png" alt="" /></div>
      <h1>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Join Mujtama' : mode === 'forgot' ? 'Reset password' : 'Choose new password'}</h1>
      <p className="muted">A community app for masjids, MSAs, imams, students, volunteers, and Muslim professionals.</p>

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
        <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        {mode === 'reset' && <input required placeholder="Reset token" value={form.resetToken} onChange={e => setForm({ ...form, resetToken: e.target.value })} />}
        {mode !== 'forgot' && <input required placeholder={mode === 'reset' ? 'New password' : 'Password'} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />}
        <button className="primary-button">{mode === 'login' ? 'Login' : mode === 'register' ? 'Create account' : mode === 'forgot' ? <><Mail size={18} />Email reset link</> : <><KeyRound size={18} />Save password</>}</button>
      </form>
      {message && <p className="helper-text reset-message">{message}</p>}

      <div className="auth-links">
        <button className="text-btn" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }}>
          {mode === 'login' ? 'Need an account? Register' : 'Back to login'}
        </button>
        {mode === 'login' && <button className="text-btn" onClick={() => { setMode('forgot'); setMessage(''); }}>Forgot password?</button>}
      </div>
    </main>
  );
}
