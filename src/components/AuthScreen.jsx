import React, { useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', accountType: 'USER', city: '', bio: '' });

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
      <div className="brand-mark">UC</div>
      <h1>{mode === 'login' ? 'Welcome back' : 'Join Ummah Connect'}</h1>
      <p className="muted">A community app for masjids, MSAs, imams, students, volunteers, and Muslim professionals.</p>

      <form onSubmit={submit} className="auth-form">
        {mode === 'register' && (
          <>
            <input required placeholder="Name / organization" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })}>
              <option value="USER">Regular user</option>
              <option value="IMAM">Imam</option>
              <option value="STUDENT_OF_KNOWLEDGE">Student of knowledge</option>
              <option value="MASJID">Masjid account</option>
              <option value="MSA">MSA account</option>
              <option value="BUSINESS">Business / founder</option>
              <option value="ADMIN">Admin</option>
            </select>
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
