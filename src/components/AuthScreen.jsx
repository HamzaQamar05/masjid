import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AuthScreen({ onLogin, theme, toggleTheme, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '', city: '', bio: '' });

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  async function submit(e) {
    e.preventDefault();
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Something went wrong');
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

  return (
    <main className="screen auth-screen">
      <button className="icon-button auth-theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <div className="brand-mark">UC</div>
      <h1>{mode === 'login' ? 'Welcome back' : 'Join Ummah Connect'}</h1>
      <p className="muted">A community app for masjids, MSAs, imams, students, volunteers, and Muslim professionals.</p>

      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <>
            <input required placeholder="Name / organization" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
            <textarea placeholder="Short bio" value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
          </>
        )}
        <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input required placeholder="Password" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <button className="primary-button">{mode === 'login' ? 'Login' : 'Create account'}</button>
      </form>

      <button className="text-btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
      </button>
    </main>
  );
}
