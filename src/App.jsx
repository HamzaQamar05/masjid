import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Bookmark,
  Briefcase, 
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Heart,
  HeartHandshake,
  Home,
  Library,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import AuthScreen from './components/AuthScreen.jsx';
import {
  businesses,
  dashboardMetrics,
  feedPosts,
  lectures,
  prayers,
  seedEvents,
  seedOrganizations,
  seedPeople,
  volunteerRoles
} from './data/seedData.js';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const defaultUser = {
  name: 'Hamza Qamar',
  email: 'hamza@example.com',
  accountType: 'ADMIN',
  city: 'Milton',
  bio: 'Building the community operating system for masjids, MSAs, imams, volunteers, and Muslim professionals.'
};

const navItems = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'organizations', label: 'Organizations', icon: Building2 },
  { key: 'network', label: 'Network', icon: Users },
  { key: 'volunteers', label: 'Volunteers', icon: HeartHandshake },
  { key: 'lectures', label: 'Lectures', icon: Library },
  { key: 'businesses', label: 'Businesses', icon: Briefcase },
  { key: 'dashboard', label: 'Dashboard', icon: BarChart3 }
];

function token() {
  return localStorage.getItem('token');
}

function canPost(user) {
  return ['MASJID', 'MSA', 'ADMIN'].includes(user?.accountType);
}

function formatEventTime(value) {
  if (!value) return 'Time TBA';
  try {
    return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return value;
  }
}

function initials(name = 'UC') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Shell({ user, tab, setTab, children, onLogout, onAuthOpen }) {
  const [navOpen, setNavOpen] = useState(false);

  function navigate(key) {
    setTab(key);
    setNavOpen(false);
  }

  return (
    <div className="app">
      <header className="top-nav">
        <button className="icon-button mobile-menu" onClick={() => setNavOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
        <button className="brand" onClick={() => navigate('home')} aria-label="Ummah Connect home">
          <span>UC</span>
          <strong>Ummah Connect</strong>
        </button>
        <label className="global-search">
          <Search size={18} />
          <input placeholder="Search masjids, MSAs, events, lectures, mentors" />
        </label>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notifications">
            <Bell size={20} />
          </button>
          <button className="post-button" onClick={() => navigate(canPost(user) ? 'post' : 'events')}>
            <Plus size={18} />
            <span>Post</span>
          </button>
          <button className="profile-chip" onClick={onAuthOpen}>
            <span>{initials(user.name)}</span>
            <strong>{user.name}</strong>
          </button>
        </div>
      </header>

      <div className={navOpen ? 'mobile-drawer open' : 'mobile-drawer'}>
        <div className="drawer-head">
          <strong>Menu</strong>
          <button className="icon-button" onClick={() => setNavOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <Navigation tab={tab} setTab={navigate} />
      </div>

      <aside className="rail left-rail">
        <ProfileSummary user={user} onLogout={onLogout} />
        <Navigation tab={tab} setTab={navigate} />
      </aside>

      <main className="main-panel">{children}</main>
    </div>
  );
}

function Navigation({ tab, setTab }) {
  return (
    <nav className="side-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>
            <Icon size={19} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function ProfileSummary({ user, onLogout }) {
  return (
    <section className="profile-card">
      <div className="profile-cover" />
      <div className="profile-body">
        <div className="profile-avatar">{initials(user.name)}</div>
        <h2>{user.name}</h2>
        <p>{user.bio}</p>
        <div className="profile-meta">
          <span>{user.accountType}</span>
          <span>{user.city}</span>
        </div>
        <button className="text-action" onClick={onLogout}>
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </section>
  );
}

function HeroComposer({ user, setTab }) {
  return (
    <section className="composer">
      <div className="composer-main">
        <div className="profile-avatar small">{initials(user.name)}</div>
        <button onClick={() => setTab(canPost(user) ? 'post' : 'events')}>Share an announcement, event, lecture, fundraiser, or volunteer role</button>
      </div>
      <div className="composer-actions">
        <button onClick={() => setTab('events')}>
          <CalendarDays size={18} />
          Event
        </button>
        <button onClick={() => setTab('volunteers')}>
          <HeartHandshake size={18} />
          Volunteer
        </button>
        <button onClick={() => setTab('lectures')}>
          <Library size={18} />
          Lecture
        </button>
      </div>
    </section>
  );
}

function FeedPost({ post }) {
  return (
    <article className="feed-post">
      <div className="post-head">
        <div className="org-logo">{initials(post.org)}</div>
        <div>
          <h3>{post.org}</h3>
          <p>{post.role} · {post.time}</p>
        </div>
        <span>{post.type}</span>
      </div>
      <h2>{post.title}</h2>
      <p>{post.body}</p>
      <div className="tag-row">
        {post.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="post-actions">
        <button>
          <Heart size={18} />
          {post.reactions}
        </button>
        <button>
          <MessageCircle size={18} />
          {post.comments}
        </button>
        <button>
          <Send size={18} />
          Share
        </button>
      </div>
    </article>
  );
}

function EventCard({ event, onRegister }) {
  const going = event.going || event.registrations?.length || 0;

  return (
    <article className="event-card">
      <div className="event-top">
        <span>{event.type || 'Event'}</span>
        <button className="icon-button" aria-label="Save event">
          <Bookmark size={18} fill={event.saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <h3>{event.title}</h3>
      <p>{event.description || 'Community event details will appear here.'}</p>
      <div className="meta-line">
        <CalendarDays size={16} />
        {event.time || formatEventTime(event.startTime)}
      </div>
      <div className="meta-line">
        <MapPin size={16} />
        {event.place || event.location || 'Location TBA'} {event.distance ? `· ${event.distance}` : ''}
      </div>
      <div className="tag-row">
        {(event.tags || []).map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
      <div className="card-footer">
        <strong>{going} going</strong>
        <button className="primary-button" onClick={() => onRegister?.(event.id)}>Register</button>
      </div>
    </article>
  );
}

function HomeScreen({ user, events, setTab, registerEvent }) {
  return (
    <div className="content-grid">
      <section className="feed-column">
        <HeroComposer user={user} setTab={setTab} />
        {feedPosts.map((post) => (
          <FeedPost key={post.id} post={post} />
        ))}
      </section>

      <aside className="right-rail">
        <PrayerWidget />
        <section className="panel">
          <div className="section-title">
            <h2>Trending events</h2>
            <button onClick={() => setTab('events')}>See all</button>
          </div>
          <div className="stack">
            {events.slice(0, 2).map((event) => (
              <CompactEvent key={event.id} event={event} onRegister={registerEvent} />
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="section-title">
            <h2>Admin pulse</h2>
            <button onClick={() => setTab('dashboard')}>Open</button>
          </div>
          <div className="metric-list">
            {dashboardMetrics.slice(0, 3).map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <em>{metric.change}</em>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function PrayerWidget() {
  return (
    <section className="panel prayer-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">Nearby masjid</p>
          <h2>Prayer times today</h2>
        </div>
        <ShieldCheck size={22} />
      </div>
      <div className="prayer-grid">
        {prayers.map(([name, time]) => (
          <div key={name}>
            <strong>{time}</strong>
            <span>{name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CompactEvent({ event, onRegister }) {
  return (
    <article className="compact-card">
      <span>{event.type}</span>
      <h3>{event.title}</h3>
      <p>{event.host}</p>
      <button onClick={() => onRegister(event.id)}>
        Register
        <ChevronRight size={16} />
      </button>
    </article>
  );
}

function EventsScreen({ events, registerEvent, setTab, user }) {
  return (
    <Page title="Events" subtitle="Eventbrite-style discovery for halaqahs, classes, fundraisers, youth nights, MSA programs, and conferences." action={canPost(user) ? { label: 'Post event', onClick: () => setTab('post') } : null}>
      <FilterBar items={['Nearby', 'Today', 'Youth', 'Sisters', 'Family', 'MSA', 'Fundraiser', 'Online']} />
      <div className="card-grid two">
        {events.map((event) => (
          <EventCard key={event.id} event={event} onRegister={registerEvent} />
        ))}
      </div>
    </Page>
  );
}

function OrganizationsScreen() {
  return (
    <Page title="Organization Directory" subtitle="Every masjid, MSA, Islamic charity, school, and dawah organization gets a profile, feed, events, followers, and admin tools.">
      <FilterBar items={['Masjids near me', 'Youth programs', 'Sisters programs', 'MSAs', 'Charities', 'Classes']} />
      <div className="organization-grid">
        {seedOrganizations.map((org) => (
          <article className="organization-card" key={org.id}>
            <div className="org-cover" style={{ backgroundImage: `url(${org.cover})` }} />
            <div className="org-card-body">
              <div className="org-title-row">
                <div className="org-logo">{initials(org.name)}</div>
                <div>
                  <h3>{org.name}</h3>
                  <p>{org.type} · {org.city}</p>
                </div>
                {org.verified && <CheckCircle2 size={20} />}
              </div>
              <p>{org.description}</p>
              <div className="tag-row">
                {org.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <div className="org-detail-row">
                <span>{org.followers} followers</span>
                <span>{org.facilities.slice(0, 2).join(' · ')}</span>
              </div>
              <div className="card-footer">
                <a href={org.website} target="_blank" rel="noreferrer">Website</a>
                <button className="primary-button">Follow</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function NetworkScreen() {
  return (
    <Page title="Community Network" subtitle="LinkedIn-style profiles for imams, speakers, students, founders, mentors, volunteers, and regular community members.">
      <FilterBar items={['Imams', 'Mentors', 'Students', 'Volunteers', 'Founders', 'Speakers']} />
      <div className="card-grid two">
        {seedPeople.map((person) => (
          <article className="person-card" key={person.id}>
            <div className="profile-avatar">{initials(person.name)}</div>
            <div>
              <h3>{person.name}</h3>
              <p>{person.role} · {person.city}</p>
            </div>
            <p>{person.headline}</p>
            <div className="tag-row">
              {person.areas.map((area) => (
                <span key={area}>{area}</span>
              ))}
            </div>
            <div className="card-footer">
              <span>{person.available}</span>
              <button className="primary-button">
                <UserCheck size={16} />
                Connect
              </button>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function VolunteersScreen() {
  return (
    <Page title="Volunteer Marketplace" subtitle="Masjids post needs, community members apply in one click, and students track verified hours.">
      <div className="card-grid two">
        {volunteerRoles.map((role) => (
          <article className="role-card" key={role.title}>
            <div className="role-icon">
              <HeartHandshake size={22} />
            </div>
            <h3>{role.title}</h3>
            <p>{role.org}</p>
            <div className="role-meta">
              <span>{role.hours}</span>
              <span>{role.skill}</span>
              <span>{role.applicants} applicants</span>
            </div>
            <button className="primary-button">Apply</button>
          </article>
        ))}
      </div>
    </Page>
  );
}

function LecturesScreen() {
  return (
    <Page title="Lecture Library" subtitle="Audio, video, articles, and PDF notes by imams, teachers, and speakers.">
      <FilterBar items={['Aqeedah', 'Fiqh', 'Tafsir', 'Seerah', 'Marriage', 'Parenting', 'Youth']} />
      <div className="card-grid three">
        {lectures.map((lecture) => (
          <article className="library-card" key={lecture.title}>
            <div className="library-icon">
              <Library size={24} />
            </div>
            <span>{lecture.category}</span>
            <h3>{lecture.title}</h3>
            <p>{lecture.speaker}</p>
            <strong>{lecture.format}</strong>
          </article>
        ))}
      </div>
    </Page>
  );
}

function BusinessesScreen() {
  return (
    <Page title="Muslim Business Directory" subtitle="Local businesses, professionals, tutors, clinics, realtors, restaurants, and future job listings.">
      <div className="card-grid three">
        {businesses.map((business) => (
          <article className="business-card" key={business.name}>
            <Briefcase size={24} />
            <h3>{business.name}</h3>
            <p>{business.category} · {business.city}</p>
            <strong>{business.rating} rating</strong>
            <button className="secondary-button">View page</button>
          </article>
        ))}
      </div>
    </Page>
  );
}

function DashboardScreen() {
  return (
    <Page title="Masjid Admin Dashboard" subtitle="The paid product surface: communication, registration, donations, volunteers, membership, and analytics in one place.">
      <div className="metric-grid">
        {dashboardMetrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <em>{metric.change}</em>
          </article>
        ))}
      </div>
      <div className="admin-grid">
        <section className="panel">
          <h2>Campaigns</h2>
          <div className="campaign-row">
            <CircleDollarSign size={22} />
            <div>
              <strong>Ramadan community fund</strong>
              <p>$18,420 raised of $30,000</p>
            </div>
          </div>
          <div className="progress"><span style={{ width: '61%' }} /></div>
        </section>
        <section className="panel">
          <h2>Engagement queue</h2>
          <ul className="plain-list">
            <li>Approve 8 new volunteer applications</li>
            <li>Publish Friday khutbah recording</li>
            <li>Send reminder for youth halaqah</li>
          </ul>
        </section>
      </div>
    </Page>
  );
}

function PostEventScreen({ setTab, refreshEvents }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', startTime: '' });

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Could not post event');
      await refreshEvents();
      setTab('events');
    } catch (err) {
      console.error(err);
      alert('Could not reach backend. The frontend demo content is still available.');
    }
  }

  return (
    <Page title="Post Event" subtitle="Masjid, MSA, and admin accounts can publish events into the community feed.">
      <form className="post-form" onSubmit={submit}>
        <input required placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <input required type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        <button className="primary-button">Post event</button>
      </form>
    </Page>
  );
}

function Page({ title, subtitle, action, children }) {
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <p className="eyebrow">Ummah Connect</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {action && (
          <button className="primary-button" onClick={action.onClick}>
            <Plus size={18} />
            {action.label}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function FilterBar({ items }) {
  return (
    <div className="filter-bar">
      {items.map((item, index) => (
        <button className={index === 0 ? 'active' : ''} key={item}>{item}</button>
      ))}
    </div>
  );
}

function AuthModal({ onClose, onLogin }) {
  return (
    <div className="modal-backdrop">
      <div className="auth-modal">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close login">
          <X size={20} />
        </button>
        <AuthScreen onLogin={(user) => { onLogin(user); onClose(); }} />
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [events, setEvents] = useState(seedEvents);
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : defaultUser;
  });

  const sortedEvents = useMemo(() => events, [events]);

  async function refreshEvents() {
    try {
      const res = await fetch(`${API}/api/events`);
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      setEvents([...data, ...seedEvents]);
    } catch {
      setEvents(seedEvents);
    }
  }

  useEffect(() => {
    refreshEvents();
  }, []);

  async function registerEvent(id) {
    try {
      const res = await fetch(`${API}/api/events/${id}/register`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }
      });
      const data = await res.json();
      if (!res.ok) return alert(data.error || 'Could not register');
      refreshEvents();
    } catch {
      alert('Demo event saved locally. Connect the backend to enable real registration.');
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(defaultUser);
  }

  const screens = {
    home: <HomeScreen user={user} events={sortedEvents} setTab={setTab} registerEvent={registerEvent} />,
    events: <EventsScreen user={user} setTab={setTab} events={sortedEvents} registerEvent={registerEvent} />,
    organizations: <OrganizationsScreen />,
    network: <NetworkScreen />,
    volunteers: <VolunteersScreen />,
    lectures: <LecturesScreen />,
    businesses: <BusinessesScreen />,
    dashboard: <DashboardScreen />,
    post: <PostEventScreen setTab={setTab} refreshEvents={refreshEvents} />
  };

  return (
    <>
      <Shell user={user} tab={tab} setTab={setTab} onLogout={logout} onAuthOpen={() => setAuthOpen(true)}>
        {screens[tab] || screens.home}
      </Shell>
      <section className="mobile-bottom-nav">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}>
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </section>
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onLogin={setUser} />}
      <div className="app-glow" />
    </>
  );
}
