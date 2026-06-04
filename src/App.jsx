import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Bookmark, Briefcase, Building2, CalendarDays, Home, LogOut, MapPin, MessageCircle, Plus, Search, Send, User, UserCheck, Users } from 'lucide-react';
import AuthScreen from './components/AuthScreen.jsx';
import { prayers, seedEvents, seedOrganizations, seedPeople } from './data/seedData.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const tabs = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'network', label: 'Network', icon: Users },
  { key: 'connect', label: 'Connect', icon: MessageCircle }
];

function canPost(user) { return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType); }
function token() { return localStorage.getItem('token'); }
function formatEventTime(value) { if (!value) return 'Time TBA'; try { return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); } catch { return value; } }

function AvatarButton({ user, setTab }) {
  return <button className="avatar-btn" onClick={() => setTab('account')}>{user?.name?.[0]?.toUpperCase() || <User size={18}/>}</button>;
}

function EventCard({ event, onRegister }) {
  const id = event.id;
  return (
    <article className="event-card">
      <div className="event-topline"><span className="event-type">{event.type || 'Event'}</span><button className="icon-btn"><Bookmark size={17} fill={event.saved ? 'currentColor' : 'none'} /></button></div>
      <h3>{event.title}</h3>
      <p className="muted host">{event.host || event.organization?.name || event.createdBy?.name || 'Community'}</p>
      <div className="meta-row"><CalendarDays size={15}/> {event.time || formatEventTime(event.startTime)}</div>
      <div className="meta-row"><MapPin size={15}/> {event.place || event.location || 'Location TBA'} {event.distance ? `• ${event.distance}` : ''}</div>
      <div className="tag-row">{(event.tags || []).map(tag => <span key={tag}>{tag}</span>)}</div>
      <div className="card-actions"><button className="primary-btn" onClick={() => onRegister?.(id)}>Register</button><span>{event.going || event.registrations?.length || 0} going</span></div>
    </article>
  );
}

function HomeScreen({ user, setTab, events, registerEvent }) {
  return (
    <main className="screen">
      <header className="topbar"><AvatarButton user={user} setTab={setTab}/><div><p className="eyebrow">Assalamu alaikum</p><h1>What’s happening near you?</h1></div><button className="round-btn"><Bell size={20}/></button></header>
      <section className="search-box"><Search size={18}/><span>Search events, masjids, MSAs, imams, people</span></section>
      <section className="prayer-card"><div className="section-head no-margin"><div><p className="eyebrow">Nearby masjid</p><h2>Prayer times today</h2></div><button onClick={() => setTab('events')}>View</button></div><div className="prayer-grid">{prayers.map(([name, time]) => <div key={name}><strong>{time}</strong><span>{name}</span></div>)}</div></section>
      <section className="quick-actions">{canPost(user) && <button onClick={() => setTab('post')}><Plus size={18}/> Post event</button>}<button onClick={() => setTab('connect')}><UserCheck size={18}/> Find people</button></section>
      <section><div className="section-head"><h2>For you</h2><button onClick={() => setTab('events')}>See all</button></div>{events.slice(0, 2).map(event => <EventCard key={event.id} event={event} onRegister={registerEvent}/>)}</section>
    </main>
  );
}

function EventsScreen({ user, setTab, events, registerEvent }) {
  return <main className="screen"><header className="plain-header row-header"><div><h1>Events</h1><p>Lectures, halaqahs, qiyams, fundraisers, MSA programs.</p></div>{canPost(user) && <button className="round-btn" onClick={() => setTab('post')}><Plus size={20}/></button>}</header><div className="chip-scroll">{['Nearby','Today','MSA','Youth','Sisters','Career','Fundraiser'].map(x => <span className="pill" key={x}>{x}</span>)}</div>{events.map(event => <EventCard key={event.id} event={event} onRegister={registerEvent}/>)}</main>;
}

function NetworkScreen({ setTab }) {
  return <main className="screen"><header className="plain-header"><h1>Network</h1><p>Follow masjids, MSAs, founders, volunteers, and local Muslim communities.</p></header><section className="org-list">{seedOrganizations.map(org => <article className="org-card" key={org.id}><div className="avatar"><Building2 size={23}/></div><div className="org-content"><div className="org-top"><h3>{org.name}</h3><span className={org.verified ? 'verified' : 'unclaimed'}>{org.verified ? '✓ Verified' : 'Unclaimed'}</span></div><p>{org.type} • {org.city}</p><small>{org.organization}</small><p className="org-description">{org.description}</p><div className="tag-row compact">{org.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="facility-row">{org.facilities.slice(0,3).join(' • ')}</div><a href={org.website} target="_blank" rel="noreferrer">Visit website →</a></div><button onClick={() => setTab('messages')}>Contact</button></article>)}</section></main>;
}

function ConnectScreen({ setTab }) {
  return <main className="screen"><header className="plain-header"><h1>Connect</h1><p>Find imams, students of knowledge, speakers, volunteers, founders, and regular community members.</p></header>{seedPeople.map(person => <article className="speaker-card" key={person.id}><div className="speaker-avatar">{person.name.split(' ').map(x => x[0]).slice(0,2).join('')}</div><div className="speaker-info"><h3>{person.name}</h3><p>{person.role}</p><div className="tag-row compact">{person.areas.map(area => <span key={area}>{area}</span>)}</div><small>{person.city} • {person.available}</small></div><button className="message-btn" onClick={() => setTab('messages')}><MessageCircle size={17}/></button></article>)}<section className="business-card"><Briefcase size={24}/><h2>Community marketplace later</h2><p>Muslim founders, mentors, businesses, job posts, volunteers, and partnerships.</p></section></main>;
}

function PostEventScreen({ setTab, refreshEvents }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', startTime: '' });
  async function submit(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Could not post event');
      alert('Event posted');
      await refreshEvents();
      setTab('events');
    } catch (err) { console.error(err); alert('Could not reach backend'); }
  }
  return <main className="screen"><header className="plain-header"><h1>Post event</h1><p>Only masjid, MSA, and admin accounts can post events right now.</p></header><form className="auth-form" onSubmit={submit}><input required placeholder="Event title" value={form.title} onChange={e => setForm({...form, title: e.target.value})}/><textarea placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})}/><input placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})}/><input required type="datetime-local" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})}/><button className="primary-btn">Post event</button></form></main>;
}

function MessagesScreen() {
  return <main className="screen"><header className="plain-header"><h1>Messages</h1><p>Basic inbox placeholder for contacting imams, coordinators, masjids, MSAs, and community members.</p></header><article className="event-card"><h3>Start a conversation</h3><p className="muted">Messaging backend routes are included. Next step is a real inbox list and user search.</p><div className="card-actions"><button className="primary-btn"><Send size={16}/> New message</button></div></article></main>;
}

function AccountScreen({ user, setUser }) {
  function logout() { localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null); }
  return <main className="screen"><header className="plain-header"><h1>Account</h1><p>Manage your Ummah Connect profile.</p></header><section className="business-card"><div className="profile-avatar-large">{user?.name?.[0]?.toUpperCase()}</div><h2>{user?.name}</h2><p>{user?.email}</p><p>{user?.accountType}</p><button className="primary-btn" onClick={logout}><LogOut size={16}/> Logout</button></section></main>;
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [events, setEvents] = useState(seedEvents);
  const [user, setUser] = useState(() => { const saved = localStorage.getItem('user'); return saved ? JSON.parse(saved) : null; });

  async function refreshEvents() {
    try { const res = await fetch(`${API}/api/events`); if (!res.ok) throw new Error('bad'); const data = await res.json(); setEvents([...data, ...seedEvents]); } catch { setEvents(seedEvents); }
  }
  useEffect(() => { refreshEvents(); }, []);
  async function registerEvent(id) { try { const res = await fetch(`${API}/api/events/${id}/register`, { method:'POST', headers:{ Authorization:`Bearer ${token()}` }}); const data = await res.json(); if (!res.ok) return alert(data.error || 'Could not register'); alert('Registered for event'); refreshEvents(); } catch { alert('This demo event is local only, or backend is sleeping.'); } }

  if (!user) return <div className="app-shell"><div className="phone-app"><AuthScreen onLogin={setUser}/></div></div>;
  const screens = {
    home: <HomeScreen user={user} setTab={setTab} events={events} registerEvent={registerEvent}/>,
    events: <EventsScreen user={user} setTab={setTab} events={events} registerEvent={registerEvent}/>,
    network: <NetworkScreen setTab={setTab}/>,
    connect: <ConnectScreen setTab={setTab}/>,
    post: <PostEventScreen setTab={setTab} refreshEvents={refreshEvents}/>,
    messages: <MessagesScreen/>,
    account: <AccountScreen user={user} setUser={setUser}/>
  };
  return <div className="app-shell"><div className="phone-app">{screens[tab] || screens.home}{canPost(user) && <button className="fab" onClick={() => setTab('post')}><Plus size={24}/></button>}<nav className="bottom-nav">{tabs.map(item => { const Icon = item.icon; return <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><Icon size={20}/><span>{item.label}</span></button>; })}</nav></div></div>;
}
