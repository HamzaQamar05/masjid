import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  HeartHandshake,
  Home,
  Library,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Navigation,
  Plus,
  Search,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import AuthScreen from './components/AuthScreen.jsx';
import { defaultLocation, prayers, seedEvents, seedOrganizations, volunteerRoles } from './data/seedData.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const navItems = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'organizations', label: 'Masjids', icon: Building2 },
  { key: 'network', label: 'Network', icon: Users },
  { key: 'volunteers', label: 'Volunteer', icon: HeartHandshake },
  { key: 'messages', label: 'Messages', icon: Mail },
  { key: 'profile', label: 'Profile', icon: UserCheck },
  { key: 'dashboard', label: 'Admin', icon: BarChart3 }
];

const mobileNavKeys = ['home', 'organizations', 'network', 'volunteers', 'messages', 'profile'];

function token() {
  return sessionStorage.getItem('token') || localStorage.getItem('token');
}

function canPost(user) {
  return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType);
}

function initials(name = 'UC') {
  return name.split(' ').filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function listToText(value) {
  return Array.isArray(value) ? value.join(', ') : value || '';
}

function textToList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

function directionsUrl(item) {
  const query = item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : encodeURIComponent(item.address || item.location || item.name);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const savedToken = token();
  if (savedToken) headers.Authorization = `Bearer ${savedToken}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function distanceText(item) {
  if (item.distanceKm == null) return 'Distance unavailable';
  return `${item.distanceKm.toFixed ? item.distanceKm.toFixed(1) : item.distanceKm} km away`;
}

function Shell({ user, tab, setTab, children, searchQuery, setSearchQuery, searchResults, onLogout }) {
  const [navOpen, setNavOpen] = useState(false);
  function navigate(key) {
    setTab(key);
    setNavOpen(false);
  }
  return (
    <div className="app">
      <header className="top-nav">
        <button className="icon-button mobile-menu" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
        <button className="brand" onClick={() => navigate('home')} aria-label="Ummah Connect home"><span>UC</span><strong>Ummah Connect</strong></button>
        <div className="search-wrap">
          <label className="global-search">
            <Search size={18} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search users, masjids, events, skills" />
          </label>
          {searchQuery && (
            <div className="search-results">
              {searchResults.length ? searchResults.map((result) => (
                <button key={`${result.kind}-${result.id}`} onClick={() => { navigate(result.tab); setSearchQuery(''); }}>
                  <span>{result.kind}</span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </button>
              )) : <p>No matches yet.</p>}
            </div>
          )}
        </div>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notifications"><Bell size={20} /></button>
          <button className="post-button" onClick={() => navigate(canPost(user) ? 'post' : 'events')}><Plus size={18} /><span>Event</span></button>
          <button className="profile-chip" onClick={() => navigate('profile')}><span>{initials(user.name)}</span><strong>{user.name}</strong></button>
        </div>
      </header>
      <div className={navOpen ? 'mobile-drawer open' : 'mobile-drawer'}>
        <div className="drawer-head"><strong>Menu</strong><button className="icon-button" onClick={() => setNavOpen(false)}><X size={20} /></button></div>
        <div className="drawer-profile">
          <button className="profile-avatar" onClick={() => navigate('profile')}>{initials(user.name)}</button>
          <div><strong>{user.name}</strong><span>{user.accountType}</span></div>
        </div>
        <NavigationList tab={tab} setTab={navigate} user={user} />
        <button className="mobile-logout" onClick={onLogout}><LogOut size={18} />Logout</button>
      </div>
      <aside className="rail left-rail">
        <ProfileSummary user={user} onLogout={onLogout} setTab={navigate} />
        <NavigationList tab={tab} setTab={navigate} user={user} />
      </aside>
      <main className="main-panel">{children}</main>
    </div>
  );
}

function NavigationList({ tab, setTab, user }) {
  return (
    <nav className="side-nav">
      {navItems.filter((item) => item.key !== 'dashboard' || user.accountType === 'ADMIN').map((item) => {
        const Icon = item.icon;
        return <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><Icon size={19} /><span>{item.label}</span></button>;
      })}
    </nav>
  );
}

function ProfileSummary({ user, onLogout, setTab }) {
  return (
    <section className="profile-card">
      <div className="profile-cover" />
      <div className="profile-body">
        <button className="profile-avatar" onClick={() => setTab('profile')}>{initials(user.name)}</button>
        <h2>{user.name}</h2>
        <p>{user.bio || 'Add your bio, experience, skills, education, languages, and interests.'}</p>
        <div className="profile-meta"><span>{user.accountType}</span><span>{user.city || 'No city yet'}</span></div>
        <button className="text-action" onClick={onLogout}><LogOut size={16} />Logout</button>
      </div>
    </section>
  );
}

function HomeScreen({ user, masjids, locationStatus, requestLocation, prayerTimes, setTab }) {
  return (
    <div className="content-grid">
      <section className="feed-column">
        <section className="composer">
          <div className="composer-main">
            <button onClick={() => setTab('profile')}>Complete your profile so other Muslims can find your skills, studies, and interests</button>
          </div>
          <div className="composer-actions">
            <button onClick={() => setTab('events')}><CalendarDays size={18} />Events</button>
            <button onClick={() => setTab('network')}><Users size={18} />Network</button>
            <button onClick={() => setTab('messages')}><Mail size={18} />Messages</button>
          </div>
        </section>
        <NearbyMasjids masjids={masjids.slice(0, 5)} locationStatus={locationStatus} requestLocation={requestLocation} />
      </section>
      <aside className="right-rail">
        <PrayerWidget prayerTimes={prayerTimes} />
        <section className="panel">
          <div className="section-title"><h2>Account</h2><button onClick={() => setTab('profile')}>Edit</button></div>
          <p className="helper-text">Logged in as {user.name}. Network, messages, connections, events, and profile data are now backend-backed.</p>
        </section>
      </aside>
    </div>
  );
}

function PrayerWidget({ prayerTimes }) {
  return (
    <section className="panel prayer-panel">
      <div className="section-title"><div><p className="eyebrow">Live API</p><h2>Prayer times today</h2></div><ShieldCheck size={22} /></div>
      <div className="prayer-grid detailed">
        {prayerTimes.map((item) => (
          <div key={item.name}><span>{item.name}</span><strong>{item.adhan}</strong><em>Iqamah {item.iqamah || 'Set by masjid'}</em></div>
        ))}
      </div>
    </section>
  );
}

function NearbyMasjids({ masjids, locationStatus, requestLocation }) {
  return (
    <section className="panel nearby-panel">
      <div className="section-title">
        <div><p className="eyebrow">Location</p><h2>Nearby masjids</h2></div>
        <button onClick={requestLocation}><Navigation size={16} />Refresh location</button>
      </div>
      <p className="helper-text">{locationStatus}</p>
      <div className="nearby-list">
        {masjids.map((masjid) => (
          <article className="nearby-card" key={masjid.id}>
            <div>
              <h3>{masjid.name}</h3>
              <p>{masjid.address || masjid.city || 'Address unavailable'}</p>
              <p>{distanceText(masjid)}{masjid.walkingMinutes ? ` - ${masjid.walkingMinutes} min walk - ${masjid.drivingMinutes} min drive` : ''}</p>
            </div>
            <div className="nearby-actions">
              <a className="secondary-button" href={directionsUrl(masjid)} target="_blank" rel="noreferrer">Directions</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function EventsScreen({ user, events, loadEvents }) {
  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    await api(`/api/events/${id}`, { method: 'DELETE' });
    await loadEvents();
  }
  return (
    <Page title="Events" subtitle="Create, register for, and delete events you own. Admins can delete any event.">
      <div className="card-grid two">
        {events.map((event) => {
          const canDelete = user.accountType === 'ADMIN' || event.createdById === user.id || event.createdBy?.id === user.id;
          return (
            <article className="event-card" key={event.id}>
              <div className="event-top"><span>Event</span>{canDelete && <button className="secondary-button danger" onClick={() => deleteEvent(event.id)}>Delete</button>}</div>
              <h3>{event.title}</h3>
              <p>{event.description || 'No description yet.'}</p>
              <div className="meta-line"><CalendarDays size={16} />{event.startTime ? new Date(event.startTime).toLocaleString() : event.time || 'Time TBA'}</div>
              <div className="meta-line"><MapPin size={16} />{event.location || event.place || 'Location TBA'}</div>
              <div className="card-footer"><span>{event.createdBy?.name ? `By ${event.createdBy.name}` : 'Community event'}</span></div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}

function PostEventScreen({ setTab, loadEvents }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', startTime: '' });
  async function submit(event) {
    event.preventDefault();
    await api('/api/events', { method: 'POST', body: JSON.stringify(form) });
    await loadEvents();
    setTab('events');
  }
  return (
    <Page title="Post Event" subtitle="Events are saved to the backend and can be deleted afterward.">
      <form className="post-form" onSubmit={submit}>
        <input required placeholder="Event title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <textarea placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <input placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        <input required type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
        <button className="primary-button">Post event</button>
      </form>
    </Page>
  );
}

function OrganizationsScreen({ masjids, locationStatus, requestLocation }) {
  return (
    <Page title="Masjid Discovery" subtitle="Actual nearby masjids from OpenStreetMap, sorted by your browser location.">
      <NearbyMasjids masjids={masjids} locationStatus={locationStatus} requestLocation={requestLocation} />
    </Page>
  );
}

function NetworkScreen({ user, users, connections, loadNetwork, openProfile, startMessage }) {
  function connectionFor(otherId) {
    return connections.find((connection) => [connection.requesterId, connection.receiverId].includes(otherId));
  }
  async function connect(otherId) {
    await api(`/api/connections/${otherId}`, { method: 'POST' });
    await loadNetwork();
  }
  async function accept(connectionId) {
    await api(`/api/connections/${connectionId}`, { method: 'PUT', body: JSON.stringify({ status: 'ACCEPTED' }) });
    await loadNetwork();
  }
  return (
    <Page title="Network" subtitle="Every registered account appears here automatically. Connect, view profiles, and message each other.">
      <div className="card-grid two">
        {users.map((person) => {
          const connection = connectionFor(person.id);
          const incoming = connection?.receiverId === user.id && connection.status === 'PENDING';
          return (
            <article className="person-card" key={person.id}>
              <button className="profile-avatar" onClick={() => openProfile(person)}>{initials(person.name)}</button>
              <div><h3>{person.name}</h3><p>{person.accountType} - {person.city || 'No city'}</p></div>
              <p>{person.bio || 'No bio yet.'}</p>
              <TagRow tags={person.skills || []} />
              <div className="card-footer profile-actions">
                <button className="secondary-button" onClick={() => openProfile(person)}>View profile</button>
                {person.id !== user.id && <button className="secondary-button" onClick={() => startMessage(person)}>Message</button>}
                {person.id !== user.id && !connection && <button className="primary-button" onClick={() => connect(person.id)}>Connect</button>}
                {incoming && <button className="primary-button" onClick={() => accept(connection.id)}>Accept</button>}
                {connection && !incoming && <span>{connection.status}</span>}
              </div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}

function MessagesScreen({ users, selectedUser, setSelectedUser, messages, loadMessages, loadThreads }) {
  const [draft, setDraft] = useState('');
  useEffect(() => {
    if (!selectedUser?.id) return undefined;
    let active = true;
    async function refreshThread() {
      try {
        if (active) {
          await loadMessages(selectedUser.id);
          await loadThreads();
        }
      } catch (error) {
        console.error(error);
      }
    }
    refreshThread();
    const timer = setInterval(refreshThread, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedUser?.id]);

  async function chooseUser(person) {
    setSelectedUser(person);
    await loadMessages(person.id);
  }
  async function sendMessage() {
    if (!selectedUser || !draft.trim()) return;
    await api('/api/messages', { method: 'POST', body: JSON.stringify({ receiverId: selectedUser.id, content: draft }) });
    setDraft('');
    await loadMessages(selectedUser.id);
    await loadThreads();
  }
  return (
    <Page title="Messages" subtitle="Start a conversation with any registered user and send backend-backed messages.">
      <div className="messaging-layout">
        <section className="panel inbox-list">
          {users.map((person) => <button key={person.id} className={selectedUser?.id === person.id ? 'active' : ''} onClick={() => chooseUser(person)}><strong>{person.name}</strong><span>{person.accountType}</span><p>{person.city || 'No city'}</p></button>)}
        </section>
        <section className="panel message-thread">
          {selectedUser ? (
            <>
              <div className="thread-head"><div className="org-logo">{initials(selectedUser.name)}</div><div><h2>{selectedUser.name}</h2><p>Conversation</p></div></div>
              <div className="message-list">
                {messages.map((message) => <div className={message.senderId === selectedUser.id ? 'chat-bubble received' : 'chat-bubble sent'} key={message.id}>{message.content}</div>)}
              </div>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${selectedUser.name}`} />
              <button className="primary-button" onClick={sendMessage}><Send size={18} />Send message</button>
            </>
          ) : <p className="helper-text">Choose a person to start messaging.</p>}
        </section>
      </div>
    </Page>
  );
}

function VolunteersScreen({ roles, updateVolunteerRole }) {
  const verifiedTotal = roles.reduce((sum, role) => sum + (Number(role.verifiedHours) || 0), 0);
  const approvedCount = roles.filter((role) => role.status === 'Approved').length;
  return (
    <Page title="Volunteer Marketplace" subtitle="Find shifts, manage approvals, and keep verified service hours organized.">
      <section className="hours-summary panel">
        <div>
          <span>Verified Hours</span>
          <h2>{verifiedTotal}</h2>
          <p>{approvedCount} approved role{approvedCount === 1 ? '' : 's'} ready for check-in tracking.</p>
        </div>
        <button className="secondary-button">Download PDF</button>
      </section>
      <div className="card-grid two">
        {roles.map((role) => (
          <article className="role-card" key={role.id}>
            <div className="role-icon"><HeartHandshake size={24} /></div>
            <div>
              <h3>{role.title}</h3>
              <p>{role.org}</p>
              <TagRow tags={[role.shift, `${role.hours} hours`, role.skill]} />
            </div>
            <div className="check-row"><span>Applicants</span><strong>{role.applicants}</strong></div>
            <div className="check-row"><span>Approved</span><strong>{role.approved}</strong></div>
            <div className="check-row"><span>Status</span><strong>{role.status}</strong></div>
            <div className="check-row"><span>Check-in</span><strong>{role.checkIn || 'Not checked in'}</strong></div>
            <div className="check-row"><span>Check-out</span><strong>{role.checkOut || 'Not checked out'}</strong></div>
            <div className="card-footer">
              {role.status === 'Open' && <button className="primary-button" onClick={() => updateVolunteerRole(role.id, 'apply')}>Apply</button>}
              {role.status === 'Pending approval' && <button className="secondary-button" onClick={() => updateVolunteerRole(role.id, 'approve')}>Approve</button>}
              {role.status === 'Approved' && !role.checkIn && <button className="primary-button" onClick={() => updateVolunteerRole(role.id, 'check-in')}>Check in</button>}
              {role.status === 'Approved' && role.checkIn && !role.checkOut && <button className="primary-button" onClick={() => updateVolunteerRole(role.id, 'check-out')}>Check out</button>}
              {role.checkOut && <span>{role.verifiedHours} verified hours</span>}
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function ProfileScreen({ user, viewedUser, onCloseViewed, onSave }) {
  const editingSelf = !viewedUser || viewedUser.id === user.id;
  const profile = viewedUser || user;
  const [form, setForm] = useState(() => ({
    name: profile.name || '',
    city: profile.city || '',
    location: profile.location || '',
    bio: profile.bio || '',
    education: profile.education || '',
    experience: profile.experience || '',
    availability: profile.availability || '',
    skills: listToText(profile.skills),
    interests: listToText(profile.interests),
    languages: listToText(profile.languages),
    hobbies: listToText(profile.hobbies)
  }));

  useEffect(() => {
    setForm({
      name: profile.name || '',
      city: profile.city || '',
      location: profile.location || '',
      bio: profile.bio || '',
      education: profile.education || '',
      experience: profile.experience || '',
      availability: profile.availability || '',
      skills: listToText(profile.skills),
      interests: listToText(profile.interests),
      languages: listToText(profile.languages),
      hobbies: listToText(profile.hobbies)
    });
  }, [profile.id]);

  async function submit(event) {
    event.preventDefault();
    const updated = await api('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ ...form, skills: textToList(form.skills), interests: textToList(form.interests), languages: textToList(form.languages), hobbies: textToList(form.hobbies) })
    });
    onSave(updated);
  }

  return (
    <Page title={editingSelf ? 'Your Profile' : profile.name} subtitle="Community profile with education, experience, skills, languages, interests, and hobbies.">
      {!editingSelf && <button className="secondary-button" onClick={onCloseViewed}>Back to your profile</button>}
      <section className="panel profile-detail">
        <div className="profile-hero"><div className="profile-avatar">{initials(profile.name)}</div><div><h2>{profile.name}</h2><p>{profile.accountType} - {profile.city || 'No city yet'}</p></div></div>
        {editingSelf ? (
          <form className="profile-form" onSubmit={submit}>
            {['name', 'city', 'location', 'availability'].map((field) => <input key={field} placeholder={field} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />)}
            <textarea placeholder="Bio" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
            <textarea placeholder="Experience" value={form.experience} onChange={(event) => setForm({ ...form, experience: event.target.value })} />
            <textarea placeholder="Education" value={form.education} onChange={(event) => setForm({ ...form, education: event.target.value })} />
            <input placeholder="Skills, comma separated" value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} />
            <input placeholder="Interests, comma separated" value={form.interests} onChange={(event) => setForm({ ...form, interests: event.target.value })} />
            <input placeholder="Languages, comma separated" value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })} />
            <input placeholder="Hobbies, comma separated" value={form.hobbies} onChange={(event) => setForm({ ...form, hobbies: event.target.value })} />
            <button className="primary-button">Save profile</button>
          </form>
        ) : <ReadOnlyProfile profile={profile} />}
      </section>
    </Page>
  );
}

function ReadOnlyProfile({ profile }) {
  return (
    <div className="profile-read">
      <p>{profile.bio || 'No bio yet.'}</p>
      <InfoBlock title="Experience" value={profile.experience} />
      <InfoBlock title="Education" value={profile.education} />
      <InfoBlock title="Availability" value={profile.availability} />
      <TagRow tags={profile.skills || []} />
      <TagRow tags={profile.interests || []} />
      <TagRow tags={profile.languages || []} />
      <TagRow tags={profile.hobbies || []} />
    </div>
  );
}

function InfoBlock({ title, value }) {
  return <div className="info-block"><strong>{title}</strong><p>{value || 'Not added yet.'}</p></div>;
}

function AdminScreen({ user, users, loadNetwork }) {
  async function deleteUser(id) {
    if (!confirm('Delete this user and their messages/events?')) return;
    await api(`/api/users/${id}`, { method: 'DELETE' });
    await loadNetwork();
  }
  return (
    <Page title="Admin" subtitle="Admin-only user cleanup for test accounts.">
      <div className="card-grid two">
        {users.filter((person) => person.id !== user.id).map((person) => (
          <article className="person-card" key={person.id}><h3>{person.name}</h3><p>{person.email}</p><p>{person.accountType}</p><button className="secondary-button danger" onClick={() => deleteUser(person.id)}>Delete user</button></article>
        ))}
      </div>
    </Page>
  );
}

function Page({ title, subtitle, action, children }) {
  return <section className="page"><div className="page-header"><div><p className="eyebrow">Ummah Connect</p><h1>{title}</h1><p>{subtitle}</p></div>{action && <button className="primary-button" onClick={action.onClick}><Plus size={18} />{action.label}</button>}</div>{children}</section>;
}

function TagRow({ tags = [] }) {
  if (!tags.length) return null;
  return <div className="tag-row">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>;
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem('user') || localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [connections, setConnections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewedUser, setViewedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState(defaultLocation);
  const [locationStatus, setLocationStatus] = useState('Waiting for browser location permission.');
  const [masjids, setMasjids] = useState([]);
  const [prayerTimes, setPrayerTimes] = useState(prayers);
  const [volunteerShifts, setVolunteerShifts] = useState(volunteerRoles);

  async function bootstrap() {
    if (!token()) return;
    const me = await api('/api/me');
    sessionStorage.setItem('user', JSON.stringify(me));
    setUser(me);
    await Promise.all([loadNetwork(), loadEvents()]);
  }

  async function loadNetwork() {
    if (!token()) return;
    const [loadedUsers, loadedConnections] = await Promise.all([api('/api/users'), api('/api/connections')]);
    setUsers(loadedUsers);
    setConnections(loadedConnections);
  }

  async function loadEvents() {
    const loadedEvents = await api('/api/events').catch(() => seedEvents);
    setEvents(loadedEvents);
  }

  async function loadMessages(userId) {
    if (!userId) return;
    const loaded = await api(`/api/messages/${userId}`);
    setMessages(loaded);
  }

  async function loadThreads() {
    await api('/api/messages/threads').catch(() => []);
  }

  function updateVolunteerRole(roleId, action) {
    const now = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    setVolunteerShifts((roles) => roles.map((role) => {
      if (role.id !== roleId) return role;
      if (action === 'apply') return { ...role, status: 'Pending approval', applicants: role.applicants + 1 };
      if (action === 'approve') return { ...role, status: 'Approved', approved: role.approved + 1 };
      if (action === 'check-in') return { ...role, checkIn: now, checkOut: null, verifiedHours: 0 };
      if (action === 'check-out') return { ...role, checkOut: now, verifiedHours: role.hours };
      return role;
    }));
  }

  async function loadLocationData(nextLocation) {
    try {
      const [masjidData, prayerData] = await Promise.all([
        api(`/api/location/masjids?lat=${nextLocation.latitude}&lng=${nextLocation.longitude}`),
        api(`/api/prayer-times?lat=${nextLocation.latitude}&lng=${nextLocation.longitude}&date=${Math.floor(Date.now() / 1000)}`)
      ]);
      setMasjids(masjidData);
      const timings = prayerData.timings || {};
      setPrayerTimes(prayers.map((item) => ({ ...item, adhan: (timings[item.name] || item.adhan).slice(0, 5) })));
    } catch {
      setMasjids(seedOrganizations);
      setPrayerTimes(prayers);
    }
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('GPS is unavailable in this browser.');
      loadLocationData(defaultLocation);
      return;
    }
    setLocationStatus('Requesting browser GPS permission...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { label: 'Your location', latitude: position.coords.latitude, longitude: position.coords.longitude };
        setLocation(next);
        setLocationStatus('Location enabled. Nearby masjids and prayer times refreshed.');
        loadLocationData(next);
      },
      () => {
        setLocationStatus('Location permission denied. Showing Milton fallback data.');
        loadLocationData(defaultLocation);
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  }

  useEffect(() => { bootstrap().catch(() => logout()); }, []);
  useEffect(() => { if (user) requestLocation(); }, [Boolean(user)]);
  useEffect(() => {
    function refreshOnFocus() {
      if (document.visibilityState === 'visible') loadLocationData(location);
    }
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => document.removeEventListener('visibilitychange', refreshOnFocus);
  }, [location]);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    setUser(null);
    setUsers([]);
    setConnections([]);
    setMessages([]);
  }

  function afterLogin(nextUser) {
    sessionStorage.setItem('user', JSON.stringify(nextUser));
    setUser(nextUser);
    setTab('home');
    setTimeout(() => bootstrap().catch(console.error), 0);
  }

  function openProfile(person) {
    setViewedUser(person);
    setTab('profile');
  }

  function startMessage(person) {
    setSelectedUser(person);
    setTab('messages');
    loadMessages(person.id).catch(console.error);
  }

  const otherUsers = users.filter((person) => person.id !== user?.id);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const index = [
      ...users.map((person) => ({ id: person.id, kind: 'User', title: person.name, subtitle: `${person.accountType} ${person.city || ''} ${(person.skills || []).join(' ')}`, tab: 'network' })),
      ...masjids.map((masjid) => ({ id: masjid.id, kind: 'Masjid', title: masjid.name, subtitle: `${masjid.address || ''} ${masjid.city || ''}`, tab: 'organizations' })),
      ...events.map((event) => ({ id: event.id, kind: 'Event', title: event.title, subtitle: `${event.description || ''} ${event.location || ''}`, tab: 'events' }))
    ];
    return index.filter((item) => `${item.kind} ${item.title} ${item.subtitle}`.toLowerCase().includes(query)).slice(0, 8);
  }, [searchQuery, users, masjids, events]);

  if (!user) return <div className="app auth-only"><AuthScreen onLogin={afterLogin} /></div>;

  const screens = {
    home: <HomeScreen user={user} masjids={masjids} locationStatus={locationStatus} requestLocation={requestLocation} prayerTimes={prayerTimes} setTab={setTab} />,
    events: <EventsScreen user={user} events={events} loadEvents={loadEvents} />,
    post: <PostEventScreen setTab={setTab} loadEvents={loadEvents} />,
    organizations: <OrganizationsScreen masjids={masjids} locationStatus={locationStatus} requestLocation={requestLocation} />,
    network: <NetworkScreen user={user} users={users} connections={connections} loadNetwork={loadNetwork} openProfile={openProfile} startMessage={startMessage} />,
    volunteers: <VolunteersScreen roles={volunteerShifts} updateVolunteerRole={updateVolunteerRole} />,
    messages: <MessagesScreen users={otherUsers} selectedUser={selectedUser} setSelectedUser={setSelectedUser} messages={messages} loadMessages={loadMessages} loadThreads={loadThreads} />,
    profile: <ProfileScreen user={user} viewedUser={viewedUser} onCloseViewed={() => setViewedUser(null)} onSave={(updated) => { setUser(updated); sessionStorage.setItem('user', JSON.stringify(updated)); loadNetwork(); }} />,
    dashboard: <AdminScreen user={user} users={users} loadNetwork={loadNetwork} />
  };

  return (
    <>
      <Shell user={user} tab={tab} setTab={setTab} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={searchResults} onLogout={logout}>
        {screens[tab] || screens.home}
      </Shell>
      <section className="mobile-bottom-nav">
        {navItems.filter((item) => mobileNavKeys.includes(item.key)).map((item) => {
          const Icon = item.icon;
          return <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><Icon size={19} /><span>{item.label}</span></button>;
        })}
      </section>
      <div className="app-glow" />
    </>
  );
}
