import React, { useState } from 'react';
import { KeyRound, Mail } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const requiredInterests = ['Home', 'Prayer', 'Messages', 'Masjids', 'Network', 'Profile'];
const optionalInterests = ['Events', 'Library', 'Volunteer', 'Jobs', 'Business'];

export default function AuthScreen({ onLogin }) {
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState(params.get('resetToken') ? 'reset' : 'login');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: params.get('email') || '',
    password: '',
    dateOfBirth: '',
    city: '',
    bio: '',
    resetToken: params.get('resetToken') || '',
    interests: []
  });

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
      if (mode === 'forgot') return;
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      onLogin(data.user);
    } catch (err) {
      console.error(err);
      alert('Cannot reach backend. Check VITE_API_URL and Render CORS.');
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
      alert('Cannot reach backend. Check VITE_API_URL and Render CORS.');
    }
  }

  return (
    <main className="screen auth-screen">
      <div className="brand-mark">UC</div>
      <h1>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Join Ummah Connect' : mode === 'forgot' ? 'Reset password' : 'Choose new password'}</h1>
      <p className="muted">A community app for masjids, MSAs, imams, students, volunteers, and Muslim professionals.</p>

      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <>
            <input required placeholder="Name / organization" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input required type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} aria-label="Date of birth" />
            <input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            <textarea placeholder="Short bio" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
            <section className="interest-picker">
              <div>
                <strong>Included</strong>
                <p>{requiredInterests.join(', ')}</p>
              </div>
              <div className="interest-options">
                {optionalInterests.map((interest) => (
                  <label key={interest} className="check-toggle">
                    <input type="checkbox" checked={form.interests.includes(interest)} onChange={() => toggleInterest(interest)} />
                    {interest}
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
