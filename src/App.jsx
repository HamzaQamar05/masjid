import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HeartHandshake,
  Home,
  ImageIcon,
  Library,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Navigation,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Volume2,
  VolumeX,
  X
} from 'lucide-react';
import AuthScreen from './components/AuthScreen.jsx';
import MasjidTvDisplay from './components/MasjidTvDisplay.jsx';
import { businesses, defaultLocation, lectures, prayers, seedEvents, seedOrganizations } from './data/seedData.js';
import { API_BASE as API, clearAuth, persistAuth, storedUser, token } from './lib/authStorage.js';
import { api } from './lib/apiClient.js';
import { coreInterestLabels, optionalInterestLabels, canPost, canManageOrgs, isOrganizationAccount, isImamAccount, isUserAccount, userPreferenceLabels, hasPreference, canUseJobs, displayRoleLabel } from './lib/account.js';
import { initials, safeList, listToText, textToList, normalizeList, escapeHtml } from './lib/text.js';
import { toDateInput } from './lib/date.js';
import { distanceText, withLocalDistance } from './lib/geo.js';
import { buildPrayerEditForm, cleanPrayerRows, dashboardIqamahTimes, directionsUrl, emptyAdditionalPrayer, emptyTemporaryPrayer, masjidAnnouncementTypes, standardPrayerKeys } from './lib/masjid.js';

const EVENT_AUTO_REFRESH_MS = 15000;
const notificationTimers = new Map();
const notifiedMessageIds = new Set();
const seedOrganizationsWithoutPrograms = seedOrganizations.map((org) => ({ ...org, classes: [], programs: [] }));

const defaultNotificationPreferences = {
  masjidAnnouncements: true,
  eventsFromFollowedMasjids: true,
  programsFromFollowedMasjids: true,
  jobOpportunities: true,
  volunteerOpportunities: true,
  prayerTimeReminders: false,
  jamaatTimeUpdates: true,
  eventReminders: true,
  applicationStatusUpdates: true,
  messages: true,
  whatsappNotifications: false,
  nearbyMasjids: false,
  nearbyEvents: false,
  nearbyVolunteerOpportunities: false,
  jobOpportunitySource: 'followed',
  volunteerOpportunitySource: 'followed'
};
const notificationToggleGroups = [
  {
    title: 'Notifications',
    items: [
      ['masjidAnnouncements', 'Masjid announcements'],
      ['eventsFromFollowedMasjids', 'Events from followed masjids'],
      ['programsFromFollowedMasjids', 'Programs/classes from followed masjids'],
      ['messages', 'Messages']
    ]
  },
  {
    title: 'Events',
    items: [
      ['eventReminders', 'Event reminders'],
      ['applicationStatusUpdates', 'Application status updates']
    ]
  },
  {
    title: 'Opportunities',
    items: [
      ['jobOpportunities', 'Job opportunities'],
      ['volunteerOpportunities', 'Volunteer opportunities']
    ]
  },
  {
    title: 'Prayer Times',
    items: [
      ['prayerTimeReminders', 'Prayer time reminders'],
      ['jamaatTimeUpdates', 'Jamaat time updates']
    ]
  },
  {
    title: 'Nearby',
    items: [
      ['nearbyMasjids', 'Nearby masjids'],
      ['nearbyEvents', 'Nearby events'],
      ['nearbyVolunteerOpportunities', 'Nearby volunteer opportunities']
    ]
  }
];
const navItems = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'prayer', label: 'Prayer', icon: ShieldCheck },
  { key: 'messages', label: 'Messages', icon: Mail },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'organizations', label: 'Masjids', icon: Building2 },
  { key: 'network', label: 'Network', icon: Users },
  { key: 'volunteers', label: 'Volunteer', icon: HeartHandshake },
  { key: 'jobs', label: 'Jobs', icon: Briefcase },
  { key: 'library', label: 'Library', icon: Library },
  { key: 'businesses', label: 'Business', icon: Briefcase },
  { key: 'profile', label: 'Profile', icon: UserCheck },
  { key: 'dashboard', label: 'Admin', icon: BarChart3 }
];

const leftNavKeys = ['organizations', 'events', 'library', 'volunteers', 'jobs', 'businesses', 'dashboard'];
const mobileNavKeys = ['home', 'prayer', 'messages', 'network', 'profile'];
const swipeDistance = 64;
const swipeEdgeWidth = 34;
const swipeVerticalTolerance = 44;

function pathForTab(key, id) {
  const paths = {
    home: '/home',
    prayer: '/prayer',
    events: id ? `/events/${id}` : '/events',
    post: '/events/new',
    organizations: '/masjids',
    masjidProfile: id ? `/masjids/${id}` : '/masjids',
    network: '/network',
    volunteers: '/network/volunteers',
    jobs: '/network/jobs',
    library: '/library',
    businesses: '/businesses',
    messages: id ? `/messages/${id}` : '/messages',
    profile: id ? `/profile/${id}` : '/profile/me',
    profileEdit: '/profile/edit',
    dashboard: '/dashboard',
    settings: '/settings'
  };
  return paths[key] || '/home';
}

function tabForPath(pathname) {
  if (pathname === '/' || pathname === '/home') return 'home';
  if (pathname.startsWith('/prayer')) return 'prayer';
  if (pathname === '/login' || pathname === '/register') return 'auth';
  if (pathname.startsWith('/events/new')) return 'post';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/masjids/') && pathname !== '/masjids') return 'masjidProfile';
  if (pathname.startsWith('/masjids')) return 'organizations';
  if (pathname.startsWith('/network/jobs')) return 'jobs';
  if (pathname.startsWith('/network/volunteers')) return 'volunteers';
  if (pathname.startsWith('/network')) return 'network';
  if (pathname.startsWith('/messages')) return 'messages';
  if (pathname.startsWith('/profile/edit')) return 'profile';
  if (pathname.startsWith('/profile')) return 'profile';
  if (pathname.startsWith('/library')) return 'library';
  if (pathname.startsWith('/businesses')) return 'businesses';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'home';
}

function routeId(pathname, prefix) {
  if (!pathname.startsWith(prefix)) return '';
  return decodeURIComponent(pathname.slice(prefix.length).split('/')[0] || '');
}
function isStandalonePwa() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function ResilientImage({ src, fallback = null, onError, ...props }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return fallback;
  return (
    <img
      {...props}
      src={src}
      onError={(event) => {
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}

function profileBannerStyle(item = {}) {
  const image = item.bannerUrl || item.heroImageUrl || item.cover || item.coverImageUrl;
  return image ? { backgroundImage: `url(${image})` } : undefined;
}

async function showPrayerNotification(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({ type: 'SHOW_PRAYER_NOTIFICATION', title, body, tag });
      return;
    }
    await registration.showNotification(title, { body, tag });
    return;
  }
  new Notification(title, { body, tag });
}

async function showAppNotification({ title, body, tag, url }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({ type: 'SHOW_APP_NOTIFICATION', title, body, tag, url });
      return;
    }
    await registration.showNotification(title, { body, tag, data: { url } });
    return;
  }
  const notification = new Notification(title, { body, tag });
  notification.onclick = () => {
    if (url) window.location.assign(url);
  };
}

function Shell({ user, tab, setTab, children, searchQuery, setSearchQuery, searchResults, onSearchSelect, onLogout, hasDashboardAccess, onNotificationsClick, notificationUnread = 0, openSettings, detailMode = false, mobileTabs = mobileNavKeys }) {
  const [navOpen, setNavOpen] = useState(false);
  const [pageMotion, setPageMotion] = useState('');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDraggingPage, setIsDraggingPage] = useState(false);
  const previousTab = useRef(tab);
  const touchStart = useRef(null);
  const touchLatest = useRef(null);
  const touchHandled = useRef(false);
  function navigate(key) {
    setTab(key);
    setNavOpen(false);
  }
  useEffect(() => {
    if (previousTab.current === tab) return undefined;
    const previousIndex = mobileTabs.indexOf(previousTab.current);
    const nextIndex = mobileTabs.indexOf(tab);
    previousTab.current = tab;
    if (detailMode || previousIndex === -1 || nextIndex === -1) {
      setPageMotion('');
      return undefined;
    }
    setPageMotion(nextIndex > previousIndex ? 'slide-next' : 'slide-prev');
    const timer = window.setTimeout(() => setPageMotion(''), 260);
    return () => window.clearTimeout(timer);
  }, [tab, detailMode, mobileTabs.join('|')]);
  function onTouchStart(event) {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
    touchLatest.current = touchStart.current;
    touchHandled.current = false;
  }
  function onTouchMove(event) {
    if (!touchStart.current || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    touchLatest.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    if (Math.abs(deltaY) > swipeVerticalTolerance && Math.abs(deltaY) > Math.abs(deltaX)) {
      touchStart.current = null;
      touchLatest.current = null;
      setIsDraggingPage(false);
      setDragOffset(0);
      return;
    }
    if (Math.abs(deltaX) < 10 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (!navOpen && touchStart.current.x <= swipeEdgeWidth && deltaX > swipeDistance) {
      setNavOpen(true);
      touchHandled.current = true;
      setIsDraggingPage(false);
      setDragOffset(0);
      return;
    }
    if (navOpen && deltaX < -swipeDistance) {
      setNavOpen(false);
      touchHandled.current = true;
      return;
    }
    if (touchHandled.current || detailMode || navOpen) return;
    const index = mobileTabs.indexOf(tab);
    if (index === -1) return;
    const canMoveNext = deltaX < 0 && index < mobileTabs.length - 1;
    const canMovePrev = deltaX > 0 && index > 0 && touchStart.current.x > swipeEdgeWidth;
    if (!canMoveNext && !canMovePrev) return;
    event.preventDefault();
    setIsDraggingPage(true);
    setDragOffset(Math.max(-96, Math.min(96, deltaX)));
  }
  function onTouchEnd() {
    if (isDraggingPage && touchStart.current && touchLatest.current) {
      const deltaX = touchLatest.current.x - touchStart.current.x;
      const elapsed = Math.max(1, touchLatest.current.time - touchStart.current.time);
      const velocity = Math.abs(deltaX) / elapsed;
      const index = mobileTabs.indexOf(tab);
      const shouldCommit = Math.abs(deltaX) > 72 || velocity > 0.42;
      if (shouldCommit && deltaX < 0 && index < mobileTabs.length - 1) {
        navigate(mobileTabs[index + 1]);
      } else if (shouldCommit && deltaX > 0 && index > 0 && touchStart.current.x > swipeEdgeWidth) {
        navigate(mobileTabs[index - 1]);
      }
    }
    touchStart.current = null;
    touchLatest.current = null;
    touchHandled.current = false;
    setIsDraggingPage(false);
    setDragOffset(0);
  }
  const dragStyle = isDraggingPage ? { '--drag-x': `${dragOffset}px`, '--drag-opacity': String(1 - Math.min(Math.abs(dragOffset) / 420, 0.22)) } : undefined;
  return (
    <div className={detailMode ? 'app detail-mode' : 'app'} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
      <header className="top-nav">
        <button className="icon-button mobile-menu" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
        <button className="brand" onClick={() => navigate('home')} aria-label="Mujtama home"><span className="brand-logo"><img src="/icons/mujtama-icon-192.png" alt="" /></span><strong>Mujtama</strong></button>
        <div className="search-wrap">
          <label className="global-search">
            <Search size={18} />
            <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search users, masjids, events, skills" />
          </label>
          {searchQuery && (
            <div className="search-results">
              {searchResults.length ? searchResults.map((result) => (
                <button key={`${result.kind}-${result.id}`} onClick={() => { onSearchSelect(result); setSearchQuery(''); setNavOpen(false); }}>
                  <span>{result.kind}</span>
                  <strong>{result.title}</strong>
                  <small>{result.subtitle}</small>
                </button>
              )) : <p>No matches yet.</p>}
            </div>
          )}
        </div>
        <div className="top-actions">
          <button className="icon-button notification-button" onClick={onNotificationsClick} aria-label="Notifications"><Bell size={20} />{notificationUnread > 0 && <em>{notificationUnread > 9 ? '9+' : notificationUnread}</em>}</button>
          <button className="icon-button" onClick={openSettings} aria-label="Open settings"><Settings size={20} /></button>
          <button className="post-button" onClick={() => navigate(canPost(user) ? 'dashboard' : 'events')}><Plus size={18} /><span>{canPost(user) ? 'Create' : 'Event'}</span></button>
          <button className="dm-top-button" onClick={() => navigate('messages')} aria-label="Open messages">
  <Mail size={22} />
  <span className="dm-dot"></span>
</button>
          <button className="profile-chip" onClick={() => navigate('profile')}><span>{initials(user.name)}</span><strong>{user.name}</strong></button>
        </div>
        
      </header>
      <button className="standalone-menu-trigger" onClick={() => setNavOpen(true)} aria-label="Open profile and menu">
        <span>{initials(user.name)}</span>
        <Menu size={20} />
      </button>
      {navOpen && <button className="drawer-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} />}
      <div className={navOpen ? 'mobile-drawer open' : 'mobile-drawer'}>
        <div className="drawer-head"><strong>Menu</strong><button className="icon-button" onClick={() => setNavOpen(false)}><X size={20} /></button></div>
        <div className="drawer-profile">
          <button className="profile-avatar" onClick={() => navigate('profile')}>{initials(user.name)}</button>
          <div><strong>{user.name}</strong><span>{user.accountType}</span></div>
        </div>
        <NavigationList tab={tab} setTab={navigate} user={user} hasDashboardAccess={hasDashboardAccess} />
        <button className="mobile-logout" onClick={onLogout}><LogOut size={18} />Logout</button>
      </div>
      <aside className="rail left-rail">
        <ProfileSummary user={user} onLogout={onLogout} setTab={navigate} />
        <NavigationList tab={tab} setTab={navigate} user={user} hasDashboardAccess={hasDashboardAccess} />
      </aside>
      <main className={['main-panel', pageMotion ? `page-motion ${pageMotion}` : '', isDraggingPage ? 'page-dragging' : ''].filter(Boolean).join(' ')} data-swipe-surface="true" style={dragStyle}>{children}</main>
    </div>
  );
}

function NavigationList({ tab, setTab, user, hasDashboardAccess }) {
  const visibleNav = navItems.filter((item) => leftNavKeys.includes(item.key)).filter((item) => {
    if (item.key === 'dashboard') return canManageOrgs(user) || hasDashboardAccess || isImamAccount(user);
    if (!hasPreference(user, item.key)) return false;
    if (isOrganizationAccount(user) && ['volunteers', 'jobs', 'businesses'].includes(item.key)) return false;
    if (item.key === 'jobs' && !canUseJobs(user)) return false;
    return true;
  });
  return (
    <nav className="side-nav">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const label = item.key === 'dashboard' && user.accountType !== 'ADMIN' ? 'Dashboard' : item.label;
        return <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><Icon size={19} /><span>{label}</span></button>;
      })}
    </nav>
  );
}

function ProfileSummary({ user, onLogout, setTab }) {
  return (
    <section className="profile-card">
      <div className="profile-cover" style={profileBannerStyle(user)} />
      <div className="profile-body">
        <button className="profile-avatar" onClick={() => setTab('profile')}>{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.name)}</button>
        <h2>{user.name}</h2>
        <p>{isOrganizationAccount(user) ? 'Manage posts, applications, prayer times, imams, followers, and messages from your dashboard.' : (user.bio || 'Add your bio, experience, skills, education, languages, and interests.')}</p>
        <div className="profile-meta"><span>{displayRoleLabel(user.accountType)}</span><span>{user.city || 'No city yet'}</span></div>
        <button className="text-action" onClick={onLogout}><LogOut size={16} />Logout</button>
      </div>
    </section>
  );
}

function HomeScreen({ user, posts, masjids, favoriteMasjids, locationStatus, requestLocation, prayerTimes, setTab, openOrganization, toggleLikePost, toggleSavePost, addPostComment, deletePostComment, notificationState, enablePushNotifications, prayerPreferences }) {
  const orgAccount = isOrganizationAccount(user);
  const favoritePrograms = favoriteMasjids.flatMap((masjid) => (masjid.classes || masjid.programs || []).map((program) => ({ ...program, masjid })));
  return (
    <div className="content-grid">
      <section className="feed-column">
        <section className="composer">
          <div className="composer-main">
            <button onClick={() => setTab(orgAccount ? 'dashboard' : 'profile')}>
              {orgAccount ? 'Open your masjid operations dashboard for posts, applications, prayer times, classes, and imams' : 'Complete your profile so masjids can understand your skills, studies, and interests'}
            </button>
          </div>
          <div className="composer-actions">
            <button onClick={() => setTab(orgAccount ? 'dashboard' : 'events')}><CalendarDays size={18} />{orgAccount ? 'Manage' : 'Events'}</button>
            <button onClick={() => setTab('network')}><Users size={18} />Network</button>
            <button onClick={() => setTab('messages')}><Mail size={18} />Messages</button>
          </div>
        </section>
        <PostFeed user={user} posts={posts} openOrganization={openOrganization} toggleLikePost={toggleLikePost} toggleSavePost={toggleSavePost} addPostComment={addPostComment} deletePostComment={deletePostComment} />
      </section>
      <aside className="right-rail">
        <FirstRunSetupCard
          favoriteMasjids={favoriteMasjids}
          locationStatus={locationStatus}
          notificationState={notificationState}
          prayerPreferences={prayerPreferences}
          requestLocation={requestLocation}
          enablePushNotifications={enablePushNotifications}
          setTab={setTab}
        />
        <NotificationSetupCard notificationState={notificationState} enablePushNotifications={enablePushNotifications} />
        {orgAccount ? <MasjidPrayerManagerNotice setTab={setTab} /> : <PrayerWidget prayerTimes={prayerTimes} favoriteMasjids={favoriteMasjids} openOrganization={openOrganization} notificationState={notificationState} enablePushNotifications={enablePushNotifications} />}
        <FavoritePrograms programs={favoritePrograms} openOrganization={openOrganization} />
        <NearbyMasjids masjids={masjids.slice(0, 3)} locationStatus={locationStatus} requestLocation={requestLocation} openOrganization={openOrganization} />
        <section className="panel">
          <div className="section-title"><h2>Account</h2><button onClick={() => setTab('profile')}>Edit</button></div>
          <p className="helper-text">{orgAccount ? `Logged in as ${user.name}, an organization account. User-only application flows are hidden; use Dashboard for management.` : `Logged in as ${user.name}. Feed, applications, followed masjids, messages, and profile data are backend-backed.`}</p>
        </section>
      </aside>
    </div>
  );
}

function FirstRunSetupCard({ favoriteMasjids = [], locationStatus, notificationState, prayerPreferences, requestLocation, enablePushNotifications, setTab }) {
  const hasLocation = !/waiting|permission denied|fallback/i.test(locationStatus || '');
  const hasNotifications = notificationState?.permission === 'granted';
  const hasMasjid = favoriteMasjids.length > 0;
  const hasPrayerSetup = Boolean(prayerPreferences?.enabled);
  const complete = hasLocation && hasNotifications && hasMasjid && hasPrayerSetup;
  if (complete) return null;
  const steps = [
    { label: 'Location', done: hasLocation, action: requestLocation, actionLabel: hasLocation ? 'Refresh' : 'Enable', icon: Navigation },
    { label: 'Notifications', done: hasNotifications, action: enablePushNotifications, actionLabel: hasNotifications ? 'Refresh' : 'Enable', icon: Bell },
    { label: 'Follow masjid', done: hasMasjid, action: () => setTab('organizations'), actionLabel: hasMasjid ? 'View' : 'Find', icon: Building2 },
    { label: 'Prayer reminders', done: hasPrayerSetup, action: () => setTab('prayer'), actionLabel: hasPrayerSetup ? 'Edit' : 'Set up', icon: ShieldCheck }
  ];
  return (
    <section className="panel first-run-card">
      <div className="section-title">
        <div><p className="eyebrow">First-run setup</p><h2>Get Mujtama ready</h2></div>
        <CheckCircle2 size={22} />
      </div>
      <div className="setup-step-list">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div className={step.done ? 'setup-step done' : 'setup-step'} key={step.label}>
              <span><Icon size={16} /></span>
              <strong>{step.label}</strong>
              <button disabled={step.done} onClick={step.action}>{step.done ? 'Done' : step.actionLabel}</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FavoritePrograms({ programs, openOrganization }) {
  return (
    <section className="panel favorite-programs">
      <div className="section-title"><div><p className="eyebrow">Favorite masjids</p><h2>Programs first</h2></div><span>{programs.length}</span></div>
      <div className="stack-list">
        {programs.slice(0, 4).map((program, index) => (
          <article className="mini-row" key={program.id || `${program.masjid.id}-${program.title}-${index}`}>
            <strong>{program.title || 'Program'}</strong>
            <span>{program.masjid.name} - {program.dayTime || 'Schedule TBD'}</span>
            <p>{program.teacher || program.description || program.location || 'Details coming soon.'}</p>
            <div className="manager-row">
              <button onClick={() => openOrganization(program.masjid.id)}>Open masjid</button>
              {program.registrationLink && <a className="secondary-button" href={program.registrationLink} target="_blank" rel="noreferrer">Register</a>}
            </div>
          </article>
        ))}
        {!programs.length && <p className="helper-text">Enable prayer notifications on a masjid profile to see that masjid's classes and programs first.</p>}
      </div>
    </section>
  );
}

function PostFeed({ user, posts, openOrganization, toggleLikePost, toggleSavePost, addPostComment, deletePostComment }) {
  const [commentForms, setCommentForms] = useState({});
  const [commentingPostId, setCommentingPostId] = useState('');
  function sharePost(post) {
    const text = `${post.title} - ${post.organization?.name || 'Mujtama'}`;
    if (navigator.share) {
      navigator.share({ title: post.title, text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).catch(() => {});
      alert('Post title copied.');
    }
  }
  async function submitComment(event, post) {
    event.preventDefault();
    const content = (commentForms[post.id] || '').trim();
    if (!content) return;
    setCommentingPostId(post.id);
    try {
      await addPostComment(post, content);
      setCommentForms((forms) => ({ ...forms, [post.id]: '' }));
    } finally {
      setCommentingPostId('');
    }
  }
  function canDeleteComment(comment) {
    return comment.author?.id === user?.id || user?.accountType === 'ADMIN' || isOrganizationAccount(user);
  }
  return (
    <section className="panel">
      <div className="section-title"><div><p className="eyebrow">Feed</p><h2>Community updates</h2></div><span>{posts.length}</span></div>
      <div className="stack-list">
        {posts.map((post) => (
          <article className="mini-row feed-post" key={post.id}>
            <div className="thread-head">
              <div className="org-logo">
                <ResilientImage src={post.organization?.imageUrl} alt="" fallback={initials(post.organization?.name || 'UC')} />
              </div>
              <div>
                <button className="text-action" onClick={() => post.organization?.id && openOrganization(post.organization.id)}>{post.organization?.name || 'Community'}</button>
                <p>{post.type} - {new Date(post.createdAt).toLocaleString()}</p>
              </div>
            </div>
            <ResilientImage
              className="post-image"
              src={post.imageUrl}
              alt={post.title ? `${post.title} post image` : 'Post image'}
              fallback={post.imageUrl ? <div className="post-image-fallback"><ImageIcon size={30} /><span>Image unavailable</span><small>The original source expired. Ask the masjid to re-upload it.</small></div> : null}
            />
            <strong>{post.title}</strong>
            <p>{post.content}</p>
            {post.location && <div className="meta-line"><MapPin size={16} />{post.location}</div>}
            {post.eventTime && <div className="meta-line"><CalendarDays size={16} />{new Date(post.eventTime).toLocaleString()}</div>}
            <div className="post-social-row">
              <button onClick={() => toggleLikePost(post)}><HeartHandshake size={17} />{post.isLiked ? 'Liked' : 'Like'}{post.likeCount ? ` ${post.likeCount}` : ''}</button>
              <button onClick={() => setCommentForms((forms) => ({ ...forms, [post.id]: forms[post.id] || '' }))}><MessageCircle size={17} />Comment{post.commentCount ? ` ${post.commentCount}` : ''}</button>
              <button onClick={() => post.organization?.id && openOrganization(post.organization.id)}><Building2 size={17} />View masjid</button>
              <button onClick={() => sharePost(post)}><Send size={17} />Share</button>
              <button onClick={() => toggleSavePost(post)}><Library size={17} />{post.isSaved ? 'Saved' : 'Save'}</button>
              {post.eventTime && <button onClick={() => post.organization?.id && openOrganization(post.organization.id)}><CalendarDays size={17} />Event</button>}
            </div>
            <div className="post-comments">
              {(post.comments || []).map((comment) => (
                <div className="comment-row" key={comment.id}>
                  <div className="tiny-avatar">
                    <ResilientImage src={comment.author?.avatarUrl} alt="" fallback={initials(comment.author?.name || 'U')} />
                  </div>
                  <div className="comment-bubble">
                    <p><strong>{comment.author?.name || 'Community member'}</strong>{comment.content}</p>
                    {canDeleteComment(comment) && <button aria-label="Delete comment" onClick={() => deletePostComment(post, comment)}><X size={13} /></button>}
                  </div>
                </div>
              ))}
              {post.commentCount > (post.comments || []).length && <span className="comment-more">{post.commentCount - (post.comments || []).length} more comments</span>}
              <form className="comment-form" onSubmit={(event) => submitComment(event, post)}>
                <input value={commentForms[post.id] || ''} maxLength={500} onChange={(event) => setCommentForms((forms) => ({ ...forms, [post.id]: event.target.value }))} placeholder="Add a comment" />
                <button type="submit" disabled={commentingPostId === post.id || !(commentForms[post.id] || '').trim()}><Send size={15} /></button>
              </form>
            </div>
            <div className="tag-row">{post.isLiked && <span>Liked</span>}{post.isSaved && <span>Saved</span>}{post.isFromFavoriteMasjid && <span>Favorite masjid</span>}{post.isFromFollowedMasjid && <span>Following</span>}{post.followerCount ? <span>{post.followerCount} followers</span> : null}</div>
          </article>
        ))}
        {!posts.length && <p className="helper-text">Follow masjids or ask an admin to create posts to populate your feed.</p>}
      </div>
    </section>
  );
}

function PrayerWidget({ prayerTimes, favoriteMasjids = [], openOrganization, notificationState, enablePushNotifications }) {
  const [favoriteId, setFavoriteId] = useState('');
  const [favoriteAdhan, setFavoriteAdhan] = useState({});
  const favorite = favoriteMasjids.find((item) => item.id === favoriteId) || favoriteMasjids[0];
  const iqamah = dashboardIqamahTimes(favorite);
  const savedAdhan = favorite?.iqamahTimes || {};

  useEffect(() => {
    if (!favorite?.id) {
      setFavoriteAdhan({});
      return undefined;
    }
    setFavoriteId(favorite.id);
    let active = true;
    if (!Number.isFinite(Number(favorite.latitude)) || !Number.isFinite(Number(favorite.longitude))) {
      setFavoriteAdhan({});
      return undefined;
    }
    api(`/api/prayer-times?lat=${encodeURIComponent(favorite.latitude)}&lng=${encodeURIComponent(favorite.longitude)}&city=${encodeURIComponent(favorite.city || '')}`)
      .then((data) => {
        if (active) setFavoriteAdhan(data.timings || {});
      })
      .catch(() => {
        if (active) setFavoriteAdhan({});
      });
    return () => {
      active = false;
    };
  }, [favorite?.id, favorite?.latitude, favorite?.longitude]);

  return (
    <section className="panel prayer-panel">
      <div className="section-title"><div><p className="eyebrow">{favorite ? 'Favorite masjid' : 'Live API'}</p><h2>{favorite ? favorite.name : 'Prayer times today'}</h2></div><ShieldCheck size={22} /></div>
      {favoriteMasjids.length > 1 && (
        <div className="favorite-prayer-switcher">
          {favoriteMasjids.map((masjid) => <button className={favorite?.id === masjid.id ? 'active' : ''} key={masjid.id} onClick={() => setFavoriteId(masjid.id)}>{masjid.name}</button>)}
        </div>
      )}
      {favorite && <p className="helper-text">Adhan is calculated for this masjid. Iqamah comes from its dashboard.</p>}
      <div className="prayer-grid detailed">
        {prayerTimes.map((item) => (
          <div key={item.name}><span>{item.name}</span><strong>{favorite ? favoriteAdhan[item.name] || savedAdhan[item.name] || item.adhan : item.adhan}</strong><em>Iqamah {iqamah[item.name] || item.iqamah || 'Set by masjid'}</em></div>
        ))}
      </div>
      {favorite?.prayerNotes && <p className="helper-text">{favorite.prayerNotes}</p>}
      {favorite && openOrganization && <button className="secondary-button prayer-profile-button" onClick={() => openOrganization(favorite.id)}>Open masjid profile</button>}
      {notificationState?.permission !== 'granted' && enablePushNotifications && (
        <button className="primary-button prayer-profile-button" onClick={enablePushNotifications}>Enable prayer notifications</button>
      )}
    </section>
  );
}

function MasjidPrayerManagerNotice({ setTab }) {
  return (
    <section className="panel prayer-panel">
      <div className="section-title"><div><p className="eyebrow">Masjid tools</p><h2>Prayer times</h2></div><ShieldCheck size={22} /></div>
      <p>Update your own iqamah and prayer notes from the masjid dashboard.</p>
      <button className="primary-button" onClick={() => setTab('dashboard')}>Open dashboard</button>
    </section>
  );
}

function NearbyMasjids({ masjids, locationStatus, requestLocation, openOrganization }) {
  function openMasjid(masjid) {
    if (openOrganization) openOrganization(masjid.id);
  }

  function handleCardKey(event, masjid) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openMasjid(masjid);
  }

  return (
    <section className="panel nearby-panel">
      <div className="section-title">
        <div><p className="eyebrow">Location</p><h2>Nearby masjids</h2></div>
        <button onClick={requestLocation}><Navigation size={16} />Refresh location</button>
      </div>
      <p className="helper-text">{locationStatus}</p>
      <div className="nearby-list">
        {masjids.map((masjid) => (
          <article className="nearby-card" key={masjid.id} role={openOrganization ? 'button' : undefined} tabIndex={openOrganization ? 0 : undefined} onClick={() => openMasjid(masjid)} onKeyDown={(event) => handleCardKey(event, masjid)}>
            <div className="nearby-image">
              <ResilientImage src={masjid.imageUrl || masjid.heroImageUrl || masjid.cover} alt="" fallback={<span>{initials(masjid.name)}</span>} />
            </div>
            <div className="nearby-copy">
              <div className="nearby-title-row">
                <h3>{masjid.name}</h3>
                {masjid.verified && <span>Verified</span>}
              </div>
              <p>{masjid.address || masjid.city || 'Address unavailable'}</p>
              <p className="nearby-distance">{distanceText(masjid)}{masjid.walkingMinutes ? ` - ${masjid.walkingMinutes} min walk - ${masjid.drivingMinutes} min drive` : ''}</p>
              <p className="nearby-summary">{masjid.description || `${masjid.followerCount || masjid.followers || 0} followers - ${(masjid.events || []).length} events - ${(masjid.opportunities || []).length} opportunities`}</p>
            </div>
            <div className="nearby-actions">
              {openOrganization && <button className="secondary-button" onClick={(event) => { event.stopPropagation(); openOrganization(masjid.id); }}>Profile</button>}
              {masjid.website && <a className="secondary-button" href={masjid.website} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Website</a>}
              <a className="secondary-button" href={directionsUrl(masjid)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Directions</a>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationSetupCard({ notificationState, enablePushNotifications }) {
  const standalone = isStandalonePwa();
  const unsupported = !('Notification' in window);
  const pushUnavailable = !('serviceWorker' in navigator) || !('PushManager' in window);
  const blocked = notificationState.permission === 'denied';
  return (
    <section className="panel notification-card">
      <div className="section-title">
        <div><p className="eyebrow">First-run setup</p><h2>Notifications</h2></div>
        <Bell size={22} />
      </div>
      <p>Enable prayer reminders, followed masjid posts, event updates, direct messages, and important community announcements.</p>
      {unsupported ? (
        <p className="helper-text">This browser does not support PWA push notifications.</p>
      ) : (
        <>
          <p className="helper-text">{standalone ? 'Running from the installed app. You can receive message and prayer reminders.' : 'On iPhone, add Ummah Connect to your Home Screen and open it from the app icon for full push support. Browser notifications still help while the app is open.'}</p>
          {pushUnavailable && <p className="helper-text">Full closed-app push is unavailable in this browser, but live message notifications can still work after permission is granted.</p>}
          {blocked && <p className="helper-text warning-text">Notifications are blocked in this browser. Re-enable them from browser or device settings, then return here and refresh notifications.</p>}
          <div className="manager-row">
            <button className="primary-button" onClick={enablePushNotifications}>{notificationState.permission === 'granted' ? 'Refresh notifications' : 'Enable notifications'}</button>
            <span className="status-pill">{notificationState.permission || 'default'}</span>
          </div>
          {notificationState.message && <p className="helper-text">{notificationState.message}</p>}
        </>
      )}
    </section>
  );
}

function PrayerSettingsCard({ user, locationStatus, prayerPreferences, updatePrayerPreferences, requestLocation, saveManualLocation }) {
  const [manualLocation, setManualLocation] = useState(user.location || user.city || '');
  const prefs = prayerPreferences || { enabled: false, offsetMinutes: 0, prayers: {} };
  const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  return (
    <section className="panel prayer-settings-card">
      <div className="section-title"><div><p className="eyebrow">Location</p><h2>Prayer settings</h2></div><MapPin size={22} /></div>
      <p className="helper-text">{user.location || user.city || 'No saved location yet.'}</p>
      <p className="helper-text">{locationStatus}</p>
      <div className="manager-row">
        <button className="secondary-button" onClick={requestLocation}><Navigation size={16} />Use my current location</button>
      </div>
      <form className="compact-location-form" onSubmit={(event) => { event.preventDefault(); saveManualLocation(manualLocation); }}>
        <input value={manualLocation} onChange={(event) => setManualLocation(event.target.value)} placeholder="City or location" />
        <button className="secondary-button">Save</button>
      </form>
      <label className="check-toggle">
        <input type="checkbox" checked={prefs.enabled} onChange={(event) => updatePrayerPreferences({ ...prefs, enabled: event.target.checked })} />
        Enable prayer reminders
      </label>
      <div className="prayer-preference-grid">
        {prayerNames.map((name) => (
          <label className="check-toggle" key={name}>
            <input type="checkbox" checked={prefs.prayers?.[name] !== false} onChange={(event) => updatePrayerPreferences({ ...prefs, prayers: { ...prefs.prayers, [name]: event.target.checked } })} />
            {name}
          </label>
        ))}
      </div>
      <label className="preference-select">
        Reminder
        <select value={prefs.offsetMinutes || 0} onChange={(event) => updatePrayerPreferences({ ...prefs, offsetMinutes: Number(event.target.value) })}>
          <option value="0">At prayer time</option>
          <option value="5">5 minutes before</option>
          <option value="10">10 minutes before</option>
        </select>
      </label>
    </section>
  );
}

function PrayerScreen({ user, prayerTimes, favoriteMasjids, myOrganizations = [], locationStatus, requestLocation, notificationState, enablePushNotifications, prayerPreferences, updatePrayerPreferences, saveManualLocation, openOrganization, setTab }) {
  if (isOrganizationAccount(user)) {
    return (
      <Page title="Prayer" subtitle="Masjid accounts edit their own public prayer schedule from the dashboard.">
        <MasjidPrayerManagerNotice setTab={setTab} />
        <div className="card-grid two">
          {myOrganizations.map((org) => (
            <article className="organization-card" key={org.id}>
              <h3>{org.name}</h3>
              <p>{org.prayerNotes || 'No prayer notes added yet.'}</p>
              <TagRow tags={[org.prayerTimes?.Fajr && `Fajr ${org.prayerTimes.Fajr}`, org.prayerTimes?.Dhuhr && `Dhuhr ${org.prayerTimes.Dhuhr}`, org.prayerTimes?.Asr && `Asr ${org.prayerTimes.Asr}`, org.prayerTimes?.Maghrib && `Maghrib ${org.prayerTimes.Maghrib}`, org.prayerTimes?.Isha && `Isha ${org.prayerTimes.Isha}`].filter(Boolean)} />
            </article>
          ))}
        </div>
      </Page>
    );
  }
  return (
    <Page title="Prayer" subtitle="Location-based prayer times, saved location, and PWA reminders.">
      <div className="prayer-app-layout">
        <PrayerWidget prayerTimes={prayerTimes} favoriteMasjids={favoriteMasjids} openOrganization={openOrganization} notificationState={notificationState} enablePushNotifications={enablePushNotifications} />
        <NotificationSetupCard notificationState={notificationState} enablePushNotifications={enablePushNotifications} />
        <PrayerSettingsCard user={user} locationStatus={locationStatus} prayerPreferences={prayerPreferences} updatePrayerPreferences={updatePrayerPreferences} requestLocation={requestLocation} saveManualLocation={saveManualLocation} />
      </div>
    </Page>
  );
}

function EventsScreen({ user, events, masjids = [], loadEvents, loadPosts, myOrganizations, registerEvent, unregisterEvent, toggleEventSubscription, detailEventId, openEvent, openOrganization, onBack }) {
  const [eventQuery, setEventQuery] = useState('');
  const [eventKind, setEventKind] = useState('all');
  const [eventCategory, setEventCategory] = useState('all');
  const [eventDate, setEventDate] = useState('all');
  const [eventLocation, setEventLocation] = useState('all');
  const [eventHost, setEventHost] = useState('all');
  const [detailItem, setDetailItem] = useState(null);
  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    await api(`/api/events/${id}`, { method: 'DELETE' });
    await Promise.all([loadEvents(), loadPosts?.()]);
  }
  function eventTiming(event) {
    if (event.isProgram) return null;
    const date = event.startTime ? new Date(event.startTime) : null;
    return date && Number.isFinite(date.getTime()) ? date : null;
  }
  function eventImage(event) {
    return event?.imageUrl || event?.bannerUrl || event?.organization?.heroImageUrl || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80';
  }
  function openItem(item) {
    setDetailItem(item);
  }
  function matchesDate(event) {
    if (eventDate === 'all') return true;
    const date = eventTiming(event);
    if (!date) return eventDate === 'unscheduled';
    const now = new Date();
    const end = new Date(now);
    if (eventDate === 'today') end.setHours(23, 59, 59, 999);
    if (eventDate === 'week') end.setDate(now.getDate() + 7);
    if (eventDate === 'month') end.setMonth(now.getMonth() + 1);
    return date >= now && date <= end;
  }
  const programOrganizations = [
    ...masjids,
    ...myOrganizations.filter((org) => !masjids.some((masjid) => String(masjid.id) === String(org.id)))
  ];
  const programItems = programOrganizations.flatMap((masjid) => (masjid.classes || masjid.programs || []).map((program, index) => ({
    ...program,
    id: `program-${masjid.id}-${program.id || index}`,
    isProgram: true,
    title: program.title || 'Program',
    description: program.description || program.notes || '',
    location: program.location || masjid.address || masjid.city,
    imageUrl: program.imageUrl || program.heroImageUrl || masjid.heroImageUrl || masjid.imageUrl,
    startTime: null,
    dayTime: program.dayTime || program.time || 'Schedule TBA',
    type: 'PROGRAM',
    category: 'Program',
    organizationId: masjid.id,
    organization: masjid
  })));
  const eventItems = events.map((event) => ({ ...event, isProgram: false, category: event.category || event.type || (event.requiresApproval ? 'Approval required' : 'Event') }));
  const discoveryItems = [...eventItems, ...programItems];
  const categoryOptions = ['all', ...Array.from(new Set(discoveryItems.map((event) => event.category || event.type || 'Community').filter(Boolean)))];
  const locationOptions = ['all', ...Array.from(new Set(discoveryItems.map((event) => event.location || event.place).filter(Boolean)))];
  const hostOptions = ['all', ...Array.from(new Set(discoveryItems.map((event) => event.organization?.name || event.createdBy?.name).filter(Boolean)))];
  const visibleEvents = discoveryItems.filter((event) => {
    const query = eventQuery.trim().toLowerCase();
    const haystack = `${event.title} ${event.description || ''} ${event.location || ''} ${event.dayTime || ''} ${event.teacher || ''} ${event.organization?.name || ''} ${event.createdBy?.name || ''}`.toLowerCase();
    const category = event.category || event.type || 'Community';
    const host = event.organization?.name || event.createdBy?.name || '';
    if (eventKind === 'events' && event.isProgram) return false;
    if (eventKind === 'programs' && !event.isProgram) return false;
    if (query && !haystack.includes(query)) return false;
    if (eventCategory !== 'all' && category !== eventCategory) return false;
    if (eventLocation !== 'all' && (event.location || event.place) !== eventLocation) return false;
    if (eventHost !== 'all' && host !== eventHost) return false;
    return matchesDate(event);
  });
  const routeEvent = detailEventId ? events.find((event) => String(event.id) === String(detailEventId)) : null;
  const featuredEvent = routeEvent || detailItem;
  const detailMode = Boolean(detailEventId);
  function DetailContent({ item }) {
    if (!item) return null;
    return (
      <article className="event-detail-panel panel">
        <div className="event-detail-image" style={{ backgroundImage: `url(${eventImage(item)})` }} />
        <div>
          <p className="eyebrow">{item.organization?.name || item.createdBy?.name || 'Community host'}</p>
          <h2>{item.title}</h2>
          <p>{item.description || 'Event details will appear here once the host adds them.'}</p>
          <div className="meta-line"><CalendarDays size={16} />{item.isProgram ? item.dayTime || 'Schedule TBA' : eventTiming(item)?.toLocaleString() || item.time || 'Time TBA'}</div>
          <div className="meta-line"><MapPin size={16} />{item.location || item.place || 'Location TBA'}</div>
          <TagRow tags={[(item.category || item.type || 'Community'), item.teacher && `Teacher: ${item.teacher}`, item.requiresApproval && 'Approval required', item.capacity && `${item.capacity} capacity`].filter(Boolean)} />
          <div className="hub-actions">
            {item.isProgram && item.registrationLink && <a className="primary-button" href={item.registrationLink} target="_blank" rel="noreferrer">Register</a>}
            {item.isProgram && openOrganization && <button className="secondary-button" onClick={() => openOrganization(item.organizationId)}>Open masjid</button>}
            {!item.isProgram && (isOrganizationAccount(user) ? <span className="status-pill">Dashboard only</span> : (item.registrations || []).find((registration) => registration.userId === user.id) ? <button className="secondary-button" onClick={() => unregisterEvent(item.id)}>Cancel registration</button> : <button className="primary-button" onClick={() => registerEvent(item.id)}>{item.requiresApproval ? 'Request entry' : 'Register'}</button>)}
            {!item.isProgram && !isOrganizationAccount(user) && <button className="secondary-button" onClick={() => toggleEventSubscription(item, { saved: !item.isSaved, notify: item.notifyMe })}>{item.isSaved ? 'Saved' : 'Save event'}</button>}
            {!item.isProgram && !isOrganizationAccount(user) && <button className={item.notifyMe ? 'primary-button' : 'secondary-button'} onClick={() => toggleEventSubscription(item, { saved: true, notify: !item.notifyMe })}>{item.notifyMe ? 'Reminders on' : 'Notify me'}</button>}
            {(item.location || item.place) && <a className="secondary-button" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location || item.place)}`} target="_blank" rel="noreferrer">Map</a>}
          </div>
        </div>
      </article>
    );
  }
  function EventCard({ event }) {
    const canDelete = !event.isProgram && (user.accountType === 'ADMIN' || event.createdById === user.id || event.createdBy?.id === user.id || myOrganizations.some((org) => org.id === event.organizationId));
    const registration = (event.registrations || []).find((item) => item.userId === user.id);
    const registeredCount = (event.registrations || []).filter((item) => item.status !== 'DENIED').length;
    const remaining = event.capacity ? Math.max(0, event.capacity - registeredCount) : null;
    const date = eventTiming(event);
    const category = event.category || event.type || (event.requiresApproval ? 'Approval required' : 'Community');
    return (
      <article className="event-card event-card-upgraded" key={event.id}>
        <button className="event-banner" type="button" onClick={() => openItem(event)} style={{ backgroundImage: `url(${eventImage(event)})` }} aria-label={`View ${event.title}`}>
          <span className="event-date-badge"><strong>{event.isProgram ? 'Program' : date ? date.toLocaleDateString(undefined, { month: 'short' }) : 'TBA'}</strong>{event.isProgram ? '' : date ? date.getDate() : ''}</span>
        </button>
        <div className="event-top"><span>{category}</span>{canDelete && <button className="secondary-button danger" onClick={() => deleteEvent(event.id)}>Delete</button>}</div>
        <h3>{event.title}</h3>
        <p>{event.description || 'No description yet.'}</p>
        <div className="meta-line"><CalendarDays size={16} />{event.isProgram ? event.dayTime || 'Schedule TBA' : date ? date.toLocaleString() : event.time || 'Time TBA'}</div>
        <div className="meta-line"><MapPin size={16} />{event.location || event.place || 'Location TBA'}</div>
        <TagRow tags={[event.organization?.name || event.createdBy?.name || 'Community event', remaining !== null ? `${remaining} spots left` : `${registeredCount} registered`, event.requiresApproval && 'Approval required', registration && `Your status: ${registration.status}`].filter(Boolean)} />
        <div className="card-footer">
          <button className="secondary-button" onClick={() => openItem(event)}>Details</button>
          {event.isProgram && event.registrationLink && <a className="primary-button" href={event.registrationLink} target="_blank" rel="noreferrer">Register</a>}
          {event.isProgram && openOrganization && <button className="secondary-button" onClick={() => openOrganization(event.organizationId)}>Masjid</button>}
          {!event.isProgram && (isOrganizationAccount(user) ? <span className="status-pill">Dashboard only</span> : registration ? <button className="secondary-button" onClick={() => unregisterEvent(event.id)}>Cancel</button> : <button className="primary-button" onClick={() => registerEvent(event.id)}>{event.requiresApproval ? 'Request entry' : 'Register'}</button>)}
          {!event.isProgram && !isOrganizationAccount(user) && <button className="secondary-button" onClick={() => toggleEventSubscription(event, { saved: !event.isSaved, notify: event.notifyMe })}>{event.isSaved ? 'Saved' : 'Save'}</button>}
          {!event.isProgram && !isOrganizationAccount(user) && <button className={event.notifyMe ? 'primary-button' : 'secondary-button'} onClick={() => toggleEventSubscription(event, { saved: true, notify: !event.notifyMe })}>{event.notifyMe ? 'Reminders on' : 'Notify me'}</button>}
        </div>
      </article>
    );
  }
  return (
    <Page title={detailMode && featuredEvent ? featuredEvent.title : 'Events'} subtitle="Discover masjid programs, community gatherings, classes, and approval-based registrations.">
      {isOrganizationAccount(user) && (
        <section className="panel role-notice">
          <strong>Masjid account</strong>
          <p>Event attendance registration is for community member accounts. Manage your own events and attendees from the dashboard.</p>
        </section>
      )}
      {detailMode && <BackHeader title="Event" subtitle={featuredEvent?.organization?.name || featuredEvent?.createdBy?.name || 'Community'} onBack={onBack} />}
      <section className={detailMode ? 'event-discovery detail-route' : 'event-discovery'}>
        {detailMode && featuredEvent && <DetailContent item={featuredEvent} />}
        {!detailMode && <section className="filter-panel event-filters">
          <label><Search size={15} /><input placeholder="Search events and programs" value={eventQuery} onChange={(event) => setEventQuery(event.target.value)} /></label>
          <select value={eventKind} onChange={(event) => setEventKind(event.target.value)}>
            <option value="all">Events and programs</option>
            <option value="events">Events only</option>
            <option value="programs">Programs only</option>
          </select>
          <select value={eventCategory} onChange={(event) => setEventCategory(event.target.value)}>{categoryOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'All categories' : item}</option>)}</select>
          <select value={eventDate} onChange={(event) => setEventDate(event.target.value)}>
            <option value="all">Any date</option>
            <option value="today">Today</option>
            <option value="week">Next 7 days</option>
            <option value="month">This month</option>
            <option value="unscheduled">Unscheduled</option>
          </select>
          <select value={eventLocation} onChange={(event) => setEventLocation(event.target.value)}>{locationOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'All locations' : item}</option>)}</select>
          <select value={eventHost} onChange={(event) => setEventHost(event.target.value)}>{hostOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'All masjids' : item}</option>)}</select>
        </section>}
        {!detailMode && <div className="card-grid two">
          {visibleEvents.map((event) => <EventCard key={event.id} event={event} />)}
          {!visibleEvents.length && <section className="panel"><p className="helper-text">No events match those filters yet.</p></section>}
        </div>}
      </section>
      {!detailMode && detailItem && (
        <div className="modal-backdrop event-detail-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${detailItem.title} details`} onClick={() => setDetailItem(null)}>
          <div className="event-detail-modal" onClick={(event) => event.stopPropagation()}>
            <button className="icon-button modal-close-button" onClick={() => setDetailItem(null)} aria-label="Close details"><X size={18} /></button>
            <DetailContent item={detailItem} />
          </div>
        </div>
      )}
    </Page>
  );
}

function PostEventScreen({ setTab, createEvent, myOrganizations }) {
  const [form, setForm] = useState({ title: '', description: '', location: '', imageUrl: '', startTime: '', organizationId: '', capacity: '', requiresApproval: false });
  async function submit(event) {
    event.preventDefault();
    await createEvent(form);
    setTab('events');
  }
  return (
    <Page title="Post Event" subtitle="Events are saved to the backend and can be deleted afterward.">
      <form className="post-form" onSubmit={submit}>
        <input required placeholder="Event title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        <textarea placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <input placeholder="Location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} />
        <input placeholder="Event image URL" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
        <input required type="datetime-local" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
        <select value={form.organizationId} onChange={(event) => setForm({ ...form, organizationId: event.target.value })}>
          <option value="">Personal/admin event</option>
          {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
        </select>
        <input placeholder="Capacity" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} />
        <label className="check-toggle"><input type="checkbox" checked={form.requiresApproval} onChange={(event) => setForm({ ...form, requiresApproval: event.target.checked })} />Requires approval/payment</label>
        <button className="primary-button">Post event</button>
      </form>
    </Page>
  );
}

function OrganizationsScreen({ masjids, locationStatus, requestLocation, openOrganization }) {
  return (
    <Page title="Masjid Discovery" subtitle="SQL-backed masjid profiles sorted by your browser location.">
      <NearbyMasjids masjids={masjids} locationStatus={locationStatus} requestLocation={requestLocation} openOrganization={openOrganization} />
    </Page>
  );
}

function NetworkScreen({ user, users, connections, loadNetwork, openProfile, startMessage }) {
  const [networkQuery, setNetworkQuery] = useState('');

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

  const filteredUsers = users.filter((person) => {
    const query = networkQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      person.name,
      person.email,
      person.accountType,
      displayRoleLabel(person.accountType),
      person.city,
      person.location,
      person.bio,
      ...(person.skills || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  return (
    <Page title="Network" subtitle="LinkedIn-style community directory for masjids, imams, professionals, businesses, and volunteers.">
      <section className="panel network-search-panel">
        <label className="network-search">
          <Search size={18} />
          <input
            value={networkQuery}
            onChange={(event) => setNetworkQuery(event.target.value)}
            placeholder="Search users, masjids, imams, skills, city, or role"
          />
        </label>
        <p className="helper-text">
          Showing {filteredUsers.length} of {users.length} profiles
        </p>
      </section>

      <div className="card-grid two">
        {filteredUsers.map((person) => {
          const connection = connectionFor(person.id);
          const incoming = connection?.receiverId === user.id && connection.status === 'PENDING';

          return (
            <article className="person-card" key={person.id}>
              <div className="person-banner" style={profileBannerStyle(person)} />
              <button className="profile-avatar network-avatar" onClick={() => openProfile(person)}>
                {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : initials(person.name)}
              </button>
              <div>
                <h3>{person.name}</h3>
                <p>{displayRoleLabel(person.accountType)} - {person.city || person.location || 'Location not added'}</p>
              </div>
              <div className="trust-strip">
                <span>{displayRoleLabel(person.accountType)}</span>
                <span>{person.city || person.location || 'Location open'}</span>
                <span>{(person.skills || []).length} skills</span>
              </div>
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

        {!filteredUsers.length && (
          <p className="helper-text">No profiles match your search.</p>
        )}
      </div>
    </Page>
  );
}

function formatConversationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function messageDayLabel(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function SwipeThreadRow({ person, thread, isOnline, active, onOpen, onMute, onDelete }) {
  const [offset, setOffset] = useState(0);
  const offsetRef = useRef(0);
  const start = useRef(null);
  const actionWidth = 144;

  function touchStart(event) {
    event.stopPropagation();
    const touch = event.touches[0];
    start.current = { x: touch.clientX, y: touch.clientY, offset };
  }

  function touchMove(event) {
    event.stopPropagation();
    if (!start.current) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - start.current.x;
    const deltaY = touch.clientY - start.current.y;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    const nextOffset = Math.max(-actionWidth, Math.min(0, start.current.offset + deltaX));
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  }

  function touchEnd(event) {
    event?.stopPropagation();
    const nextOffset = offsetRef.current < -54 ? -actionWidth : 0;
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
    start.current = null;
  }

  return (
    <div className="dm-swipe-row">
      <div className="dm-row-actions" aria-hidden={offset === 0}>
        <button type="button" className="dm-mute-action" onClick={() => { offsetRef.current = 0; setOffset(0); onMute(); }} aria-label={thread?.muted ? `Unmute ${person.name}` : `Mute ${person.name}`}>
          {thread?.muted ? <Volume2 size={21} /> : <VolumeX size={21} />}
          <span>{thread?.muted ? 'Unmute' : 'Mute'}</span>
        </button>
        <button type="button" className="dm-delete-action" onClick={() => { offsetRef.current = 0; setOffset(0); onDelete(); }} aria-label={`Delete chat with ${person.name}`}>
          <Trash2 size={21} />
          <span>Delete</span>
        </button>
      </div>
      <button
        type="button"
        className={`dm-thread-row${active ? ' active' : ''}`}
        style={{ transform: `translate3d(${offset}px, 0, 0)` }}
        onTouchStart={touchStart}
        onTouchMove={touchMove}
        onTouchEnd={touchEnd}
        onTouchCancel={touchEnd}
        onClick={() => {
          if (offsetRef.current) {
            offsetRef.current = 0;
            setOffset(0);
          } else {
            onOpen();
          }
        }}
      >
        <span className="org-logo dm-avatar">
          <ResilientImage src={person.avatarUrl} alt="" fallback={initials(person.name)} />
          {isOnline && <i className="dm-online-dot" />}
        </span>
        <span className="dm-thread-copy">
          <strong>{person.name}{thread?.muted && <VolumeX size={13} />}</strong>
          <span>{thread?.lastMessage || person.city || 'Start a conversation'}</span>
        </span>
        <span className="dm-thread-meta">
          <time>{formatConversationTime(thread?.lastMessageAt)}</time>
          {thread?.unread > 0 && <em>{thread.unread > 99 ? '99+' : thread.unread}</em>}
        </span>
      </button>
    </div>
  );
}

function MessagesScreen({
  currentUser,
  users,
  selectedUser,
  setSelectedUser,
  messages,
  threads,
  loadMessages,
  loadOlderMessages,
  loadThreads,
  messagePage,
  sendTyping,
  onlineUserIds,
  typingUserIds,
  reactToMessage,
  unsendMessage,
  detailMode = false,
  onThreadOpen,
  onBackToInbox
}) {
  const [draft, setDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState('');
  const messageEndRef = useRef(null);
  const [conversationQuery, setConversationQuery] = useState('');
  const [conversationFilter, setConversationFilter] = useState('all');
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatMode, setNewChatMode] = useState('direct');
  const [newChatQuery, setNewChatQuery] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupMemberIds, setGroupMemberIds] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const conversationTouch = useRef(null);
  const selectedThread = selectedUser ? threads.find((thread) => thread.user.id === selectedUser.id) : null;
  const conversationUsers = conversationQuery.trim()
    ? users
    : threads.map((thread) => thread.user);
  const visibleUsers = conversationUsers
    .filter((person) => {
      const thread = threads.find((item) => item.user.id === person.id);
      const matchesQuery = `${person.name} ${person.accountType} ${person.city || ''} ${thread?.lastMessage || ''}`.toLowerCase().includes(conversationQuery.trim().toLowerCase());
      const matchesFilter = conversationFilter === 'unread' ? (thread?.unread || 0) > 0 : conversationFilter === 'online' ? onlineUserIds.includes(person.id) : true;
      return matchesQuery && matchesFilter;
    })
    .sort((a, b) => {
      const aThread = threads.find((item) => item.user.id === a.id);
      const bThread = threads.find((item) => item.user.id === b.id);
      return new Date(bThread?.lastMessageAt || 0) - new Date(aThread?.lastMessageAt || 0);
    });

  async function loadGroups() {
    const loaded = await api('/api/groups').catch(() => ({ groups: [] }));
    setGroups(loaded.groups || []);
    return loaded.groups || [];
  }

  async function loadGroupMessages(groupId) {
    const loaded = await api(`/api/groups/${groupId}/messages?limit=60`);
    setGroupMessages(loaded.messages || []);
    return loaded.messages || [];
  }

  useEffect(() => {
    loadGroups();
    const timer = setInterval(loadGroups, 10_000);
    return () => clearInterval(timer);
  }, []);

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

  useEffect(() => {
    if (!selectedGroup?.id) return undefined;
    let active = true;
    async function refreshGroup() {
      try {
        if (active) {
          await loadGroupMessages(selectedGroup.id);
          const refreshed = await loadGroups();
          const current = refreshed.find((group) => group.id === selectedGroup.id);
          if (current) setSelectedGroup(current);
        }
      } catch (error) {
        console.error(error);
      }
    }
    refreshGroup();
    const timer = setInterval(refreshGroup, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [selectedGroup?.id]);

  useEffect(() => {
    if (!selectedUser?.id) return undefined;
    sendTyping(selectedUser.id, Boolean(draft.trim()));
    const timer = setTimeout(() => sendTyping(selectedUser.id, false), 900);
    return () => clearTimeout(timer);
  }, [draft, selectedUser?.id]);

  async function chooseUser(person) {
    setSelectedGroup(null);
    setGroupMessages([]);
    setSelectedUser(person);
    onThreadOpen?.(person);
    await loadMessages(person.id);
  }

  async function chooseGroup(group) {
    setSelectedUser(null);
    setSelectedGroup(group);
    await loadGroupMessages(group.id);
  }

  async function createGroupChat() {
    const normalizedGroupName = groupName.trim();
    if (!normalizedGroupName) {
      setMessageError('Add a group name first.');
      return;
    }
    if (!groupMemberIds.length) {
      setMessageError('Select at least one person for the group.');
      return;
    }
    setCreatingGroup(true);
    setMessageError('');
    try {
      const group = await api('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: normalizedGroupName, memberIds: groupMemberIds })
      });
      setGroupName('');
      setGroupMemberIds([]);
      setNewChatQuery('');
      setNewChatMode('direct');
      setShowNewChat(false);
      await loadGroups();
      await chooseGroup(group);
    } catch (error) {
      setMessageError(error.message || 'Group could not be created.');
    } finally {
      setCreatingGroup(false);
    }
  }

  async function toggleThreadMute(person, thread) {
    await api(`/api/messages/threads/${person.id}`, { method: 'PUT', body: JSON.stringify({ muted: !thread?.muted }) });
    await loadThreads();
  }

  async function deleteThread(person) {
    if (!confirm(`Remove your conversation with ${person.name} from the inbox? New messages will make it reappear.`)) return;
    await api(`/api/messages/threads/${person.id}`, { method: 'DELETE' });
    if (selectedUser?.id === person.id) onBackToInbox?.();
    await loadThreads();
  }
  async function sendMessage() {
    if ((!selectedUser && !selectedGroup) || !draft.trim()) return;
    const content = draft.trim();
    setDraft('');
    setSendingMessage(true);
    setMessageError('');
    try {
      if (selectedGroup) {
        await api(`/api/groups/${selectedGroup.id}/messages`, { method: 'POST', body: JSON.stringify({ content }) });
        await loadGroupMessages(selectedGroup.id);
        await loadGroups();
      } else {
        await api('/api/messages', { method: 'POST', body: JSON.stringify({ receiverId: selectedUser.id, content }) });
        await loadMessages(selectedUser.id);
        await loadThreads();
      }
    } catch (error) {
      setDraft(content);
      setMessageError(error.message || 'Message failed to send.');
    } finally {
      setSendingMessage(false);
    }
  }

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, groupMessages.length, selectedUser?.id, selectedGroup?.id]);

  function onMessageScroll(event) {
    if (!selectedGroup && event.currentTarget.scrollTop < 24 && messagePage.hasMore && !messagePage.loadingOlder) {
      loadOlderMessages(selectedUser.id);
    }
  }

  function onComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function onConversationTouchStart(event) {
    event.stopPropagation();
    const touch = event.touches[0];
    conversationTouch.current = { x: touch.clientX, y: touch.clientY };
  }

  function onConversationTouchMove(event) {
    event.stopPropagation();
  }

  function onConversationTouchEnd(event) {
    event.stopPropagation();
    if (!conversationTouch.current) return;
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - conversationTouch.current.x;
    const deltaY = touch.clientY - conversationTouch.current.y;
    if (conversationTouch.current.x < 36 && deltaX > 72 && Math.abs(deltaY) < 70) onBackToInbox?.();
    conversationTouch.current = null;
  }

  const activeMessages = selectedGroup ? groupMessages : messages;
  const renderedMessages = activeMessages.map((message, index) => {
    const previous = activeMessages[index - 1];
    const showDay = !previous || messageDayLabel(previous.createdAt) !== messageDayLabel(message.createdAt);
    const incoming = message.senderId !== currentUser?.id;
    const sender = selectedGroup ? message.sender : selectedUser;
    return (
      <React.Fragment key={message.id}>
        {showDay && <div className="message-day"><span>{messageDayLabel(message.createdAt)}</span></div>}
        <div className={incoming ? 'chat-line received' : 'chat-line sent'}>
          {incoming && (
            <span className="chat-avatar">
              <ResilientImage src={sender?.avatarUrl} alt="" fallback={initials(sender?.name || 'U')} />
            </span>
          )}
          <div className={incoming ? 'chat-bubble received' : 'chat-bubble sent'}>
            {selectedGroup && incoming && <b className="group-message-sender">{sender?.name}</b>}
            <p>{message.content}</p>
            <small>{message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}</small>
            {!!message.reactions?.length && <div className="reaction-row">{message.reactions.map((reaction) => <span key={reaction.id}>{reaction.emoji}</span>)}</div>}
            {!selectedGroup && !message.isDeleted && (
              <div className="message-actions">
                {['heart', 'smile', 'dua', 'like'].map((emoji) => <button key={emoji} onClick={() => reactToMessage(message.id, emoji)}>{emoji}</button>)}
                {incoming ? null : <button onClick={() => unsendMessage(message.id)}>Unsend</button>}
              </div>
            )}
          </div>
        </div>
      </React.Fragment>
    );
  });

  return (
    <Page>
      <div className={detailMode || selectedUser || selectedGroup ? 'messaging-layout thread-route' : 'messaging-layout'}>
        <section className="panel inbox-list">
          <div className="dm-mobile-titlebar">
            <span className="org-logo dm-self-avatar"><ResilientImage src={currentUser?.avatarUrl} alt="" fallback={initials(currentUser?.name || 'M')} /></span>
            <strong>Chats</strong>
            <button type="button" onClick={() => setShowNewChat(true)} aria-label="Create new chat"><Plus size={23} /></button>
          </div>
          <label className="dm-search"><Search size={16} /><input placeholder="Search conversations" value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} /></label>
          <div className="dm-filter-row">
            {[
              ['all', 'All'],
              ['unread', 'Unread'],
              ['online', 'Online']
            ].map(([key, label]) => <button key={key} className={conversationFilter === key ? 'active' : ''} onClick={() => setConversationFilter(key)}>{label}</button>)}
          </div>
          {groups.map((group) => (
            <button type="button" className={`dm-thread-row dm-group-row${selectedGroup?.id === group.id ? ' active' : ''}`} key={group.id} onClick={() => chooseGroup(group)}>
              <span className="org-logo dm-avatar"><ResilientImage src={group.avatarUrl} alt="" fallback={initials(group.name)} /></span>
              <span className="dm-thread-copy"><strong>{group.name}</strong><span>{group.lastMessage}</span></span>
              <span className="dm-thread-meta"><time>{formatConversationTime(group.lastMessageAt)}</time>{group.unread > 0 && <em>{group.unread > 99 ? '99+' : group.unread}</em>}</span>
            </button>
          ))}
          {visibleUsers.map((person) => {
            const thread = threads.find((item) => item.user.id === person.id);
            const isOnline = onlineUserIds.includes(person.id);
            return <SwipeThreadRow key={person.id} person={person} thread={thread} isOnline={isOnline} active={selectedUser?.id === person.id} onOpen={() => chooseUser(person)} onMute={() => toggleThreadMute(person, thread)} onDelete={() => deleteThread(person)} />;
          })}
          {!visibleUsers.length && <div className="dm-empty-inbox"><MessageCircle size={30} /><strong>No conversations yet</strong><span>Search for someone above to start a private chat.</span></div>}
        </section>
        <section className="panel message-thread" onTouchStart={onConversationTouchStart} onTouchMove={onConversationTouchMove} onTouchEnd={onConversationTouchEnd}>
          {selectedUser || selectedGroup ? (
            <>
              <div className="dm-conversation-header">
                <button type="button" className="dm-back-button" onClick={() => { if (selectedGroup) { setSelectedGroup(null); setGroupMessages([]); } else onBackToInbox?.(); }} aria-label="Back to chats"><ChevronLeft size={26} /></button>
                <span className="org-logo"><ResilientImage src={selectedGroup?.avatarUrl || selectedUser?.avatarUrl} alt="" fallback={initials(selectedGroup?.name || selectedUser?.name)} />{selectedUser && onlineUserIds.includes(selectedUser.id) && <i className="dm-online-dot" />}</span>
                <div><strong>{selectedGroup?.name || selectedUser?.name}</strong><span>{selectedGroup ? `${selectedGroup.members?.length || 0} members` : onlineUserIds.includes(selectedUser.id) ? 'Active now' : displayRoleLabel(selectedUser.accountType)}</span></div>
                {selectedGroup
                  ? <button type="button" className="dm-header-action" onClick={async () => { await api(`/api/groups/${selectedGroup.id}`, { method: 'PUT', body: JSON.stringify({ muted: !selectedGroup.muted }) }); await loadGroups(); }} aria-label={selectedGroup.muted ? 'Unmute group' : 'Mute group'}>{selectedGroup.muted ? <Volume2 size={21} /> : <VolumeX size={21} />}</button>
                  : <button type="button" className="dm-header-action" onClick={() => toggleThreadMute(selectedUser, selectedThread)} aria-label={selectedThread?.muted ? 'Unmute chat' : 'Mute chat'}>{selectedThread?.muted ? <Volume2 size={21} /> : <VolumeX size={21} />}</button>}
              </div>
              <div className="message-list" onScroll={onMessageScroll}>
                {!selectedGroup && messagePage.hasMore && <button className="load-more" onClick={() => loadOlderMessages(selectedUser.id)}>{messagePage.loadingOlder ? 'Loading...' : 'Load older messages'}</button>}
                {renderedMessages}
                {selectedUser && typingUserIds.includes(selectedUser.id) && <div className="typing-indicator">{selectedUser.name} is typing...</div>}
                <div ref={messageEndRef} />
              </div>
              <div className="message-composer">
                <button type="button" className="dm-add-button" aria-label="Add attachment"><Plus size={24} /></button>
                <textarea rows="1" value={draft} onChange={(event) => setDraft(event.target.value)} onInput={(event) => { event.currentTarget.style.height = 'auto'; event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`; }} onKeyDown={onComposerKeyDown} placeholder={`Message ${selectedGroup?.name || selectedUser?.name}`} />
                <button className="primary-button" onClick={sendMessage} disabled={sendingMessage || !draft.trim()} aria-label="Send message"><Send size={18} /></button>
              </div>
              {messageError && <p className="message-error">{messageError}</p>}
            </>
          ) : <div className="dm-empty-state"><MessageCircle size={30} /><h2>Select a conversation</h2><p>Search for a user, masjid, imam, or organization to start a direct message.</p></div>}
        </section>
      </div>
      {showNewChat && (
        <div className="modal-backdrop dm-new-chat-backdrop" onClick={() => setShowNewChat(false)}>
          <section className="panel dm-new-chat-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="dm-new-chat-head"><button type="button" onClick={() => setShowNewChat(false)}><X size={22} /></button><strong>New message</strong><button type="button" disabled={newChatMode !== 'group' || creatingGroup} onClick={createGroupChat}>{creatingGroup ? 'Creating...' : 'Create'}</button></div>
            <div className="dm-new-chat-tabs"><button className={newChatMode === 'direct' ? 'active' : ''} onClick={() => setNewChatMode('direct')}>Direct</button><button className={newChatMode === 'group' ? 'active' : ''} onClick={() => setNewChatMode('group')}>Group</button></div>
            {newChatMode === 'group' && <input className="dm-group-name" value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Group name" maxLength={80} />}
            <label className="dm-search"><Search size={16} /><input value={newChatQuery} onChange={(event) => setNewChatQuery(event.target.value)} placeholder="Search people" /></label>
            {messageError && <p className="message-error dm-new-chat-error">{messageError}</p>}
            <div className="dm-new-chat-people">
              {users.filter((person) => `${person.name} ${person.city || ''}`.toLowerCase().includes(newChatQuery.toLowerCase())).map((person) => {
                const selected = groupMemberIds.includes(person.id);
                return (
                  <button type="button" key={person.id} onClick={() => {
                    if (newChatMode === 'direct') {
                      setShowNewChat(false);
                      chooseUser(person);
                    } else {
                      setGroupMemberIds((ids) => selected ? ids.filter((id) => id !== person.id) : [...ids, person.id]);
                    }
                  }}>
                    <span className="org-logo dm-avatar"><ResilientImage src={person.avatarUrl} alt="" fallback={initials(person.name)} /></span>
                    <span><strong>{person.name}</strong><small>{displayRoleLabel(person.accountType)}</small></span>
                    {newChatMode === 'group' && <i className={selected ? 'selected' : ''}>{selected ? '✓' : ''}</i>}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}

function LibraryScreen() {
  return (
    <Page title="Lecture Library" subtitle="Save and browse community lectures, notes, videos, and audio.">
      <div className="card-grid three">
        {lectures.map((lecture) => (
          <article className="library-card" key={lecture.id}>
            <div className="library-icon"><Library size={24} /></div>
            <span>{lecture.category}</span>
            <h3>{lecture.title}</h3>
            <p>{lecture.speaker}</p>
            <div className="card-footer"><span>{lecture.format}</span><button className="secondary-button">{lecture.saved ? 'Saved' : 'Save'}</button></div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function BusinessDirectoryScreen() {
  return (
    <Page title="Business Directory" subtitle="Browse Muslim-owned businesses and event sponsors.">
      <div className="card-grid three">
        {businesses.map((business) => (
          <article className="business-card" key={business.id}>
            <Briefcase size={24} />
            <h3>{business.name}</h3>
            <p>{business.category} - {business.city}</p>
            <div className="card-footer"><span>{business.rating} rating</span><span>Sponsored: {business.sponsor}</span></div>
          </article>
        ))}
      </div>
    </Page>
  );
}

function MasjidPrayerSchedule({ organization }) {
  const [adhanTimes, setAdhanTimes] = useState({});
  const [loading, setLoading] = useState(false);
  const iqamahTimes = dashboardIqamahTimes(organization);
  const savedApiAdhanTimes = organization.iqamahTimes || {};
  const additionalPrayers = Array.isArray(organization.iqamahTimes?.additionalPrayers) ? organization.iqamahTimes.additionalPrayers : [];
  const jumuahTime = iqamahTimes.Jumuah || iqamahTimes.jumuah;
  const recurringPrayers = [
    ...(jumuahTime ? [{ id: 'jumuah', name: 'Jumuah', time: 'Friday', jamatTime: jumuahTime }] : []),
    ...additionalPrayers.filter((prayer) => !/jum|friday/i.test(prayer.name || ''))
  ];
  const temporaryPrayers = Array.isArray(organization.iqamahTimes?.temporaryPrayers) ? organization.iqamahTimes.temporaryPrayers : [];
  const standardPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  useEffect(() => {
    let active = true;
    if (!Number.isFinite(Number(organization.latitude)) || !Number.isFinite(Number(organization.longitude))) {
      setAdhanTimes({});
      return undefined;
    }
    setLoading(true);
    api(`/api/prayer-times?lat=${encodeURIComponent(organization.latitude)}&lng=${encodeURIComponent(organization.longitude)}&city=${encodeURIComponent(organization.city || '')}`)
      .then((data) => {
        if (active) setAdhanTimes(data.timings || {});
      })
      .catch(() => {
        if (active) setAdhanTimes({});
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organization.id, organization.latitude, organization.longitude]);

  return (
    <>
      <section className="panel masjid-prayer-schedule">
        <div className="section-title"><div><h2>Adhan & Iqamah</h2><p className="helper-text">Adhan is calculated live for this masjid. Iqamah is set by the masjid dashboard.</p></div><ShieldCheck size={20} /></div>
        <div className="masjid-prayer-table">
          <div className="masjid-prayer-table-head"><span>Prayer</span><span>Adhan</span><span>Iqamah</span></div>
          {standardPrayers.map((name) => (
            <div className="masjid-prayer-table-row" key={name}>
              <strong>{name}</strong>
              <span>{loading ? 'Loading…' : adhanTimes[name] || savedApiAdhanTimes[name] || savedApiAdhanTimes[name.toLowerCase()] || 'N/A'}</span>
              <em>{iqamahTimes[name] || iqamahTimes[name.toLowerCase()] || 'N/A'}</em>
            </div>
          ))}
        </div>
        <div className="section-title compact-title"><h3>Recurring prayers</h3><span>{recurringPrayers.length || 'N/A'}</span></div>
        {recurringPrayers.length ? (
          <div className="stack-list">
            {recurringPrayers.map((prayer, index) => (
              <article className="mini-row prayer-extra-row" key={prayer.id || `${prayer.name}-${index}`}>
                <strong>{prayer.name || 'Recurring prayer'}</strong>
                <span>{prayer.time || 'Adhan N/A'} · Iqamah {prayer.jamatTime || prayer.iqamahTime || 'N/A'}</span>
                {prayer.notes && <p>{prayer.notes}</p>}
              </article>
            ))}
          </div>
        ) : <p className="prayer-na">N/A</p>}
      </section>

      <section className="panel masjid-temporary-prayers">
        <div className="section-title"><div><h2>Temporary prayers</h2><p className="helper-text">Janazah, Qiyam, Taraweeh, Eid, and other time-limited prayers.</p></div><CalendarDays size={20} /></div>
        {temporaryPrayers.length ? (
          <div className="stack-list">
            {temporaryPrayers.map((prayer, index) => (
              <article className="mini-row prayer-extra-row" key={prayer.id || `${prayer.name}-${index}`}>
                <strong>{prayer.name || 'Temporary prayer'}</strong>
                <span>{prayer.time || 'Prayer time N/A'} · Iqamah {prayer.jamatTime || prayer.iqamahTime || 'N/A'}</span>
                {(prayer.startsAt || prayer.endsAt) && <small>{prayer.startsAt || 'Now'} – {prayer.endsAt || 'Until removed'}</small>}
                {prayer.notes && <p>{prayer.notes}</p>}
              </article>
            ))}
          </div>
        ) : <p className="prayer-na">N/A</p>}
      </section>
    </>
  );
}

function MasjidProfileScreen({ organization, user, onFollow, onUnfollow, onFavorite, onMessage, applyToOpportunity, onBack }) {
  if (!organization) return <Page title="Masjid Profile" subtitle="Choose a masjid to view its profile."><button className="secondary-button" onClick={onBack}>Back to masjids</button></Page>;
  const posts = organization.posts || [];
  const events = organization.events || [];
  const opportunities = organization.opportunities || [];
  const jobs = opportunities.filter((item) => item.type === 'JOB');
  const volunteer = opportunities.filter((item) => item.type !== 'JOB');
  const classes = organization.classes || organization.programs || [];
  const facilities = normalizeList(organization.facilities);
  const profileImage = organization.imageUrl || organization.heroImageUrl || organization.cover;
  const heroImage = organization.heroImageUrl || organization.cover || organization.imageUrl;
  const followerCount = organization.followerCount ?? organization.followers ?? 0;
  const profileStats = [
    { label: 'Followers', value: followerCount },
    { label: 'Events', value: events.length },
    { label: 'Programs', value: classes.length },
    { label: 'Team', value: organization.peopleCount || (organization.people || []).length }
  ];
  const latestPosts = posts.slice(0, 2);
  const upcomingEvents = events.slice(0, 2);
  const featuredClasses = classes;
  const featuredVolunteer = volunteer.slice(0, 2);
  const featuredJobs = jobs.slice(0, 2);
  const featuredTeam = (organization.people || []).slice(0, 3);
  const messageContact = (organization.people || []).find((person) => person.user && person.user.id !== user?.id)?.user;
  const tags = [
    organization.verified ? 'Verified masjid' : null,
    organization.city,
    organization.type,
    ...(organization.tags || [])
  ].filter(Boolean);
  const canFollowMasjid = isUserAccount(user);
  return (
    <Page title={organization.name} subtitle={organization.description || 'Masjid profile with events, opportunities, jobs, prayer times, location, and links.'}>
      <BackHeader title={organization.name} subtitle={organization.city || organization.address || 'Masjid'} onBack={onBack} />
      <section className="panel masjid-profile">
        <div className="masjid-hero" style={{ backgroundImage: heroImage ? `url(${heroImage})` : undefined }}>
          <div className="org-logo">{profileImage ? <img src={profileImage} alt="" /> : initials(organization.name)}</div>
          <div>
            <h2>{organization.name}</h2>
            <p>{organization.address || organization.city || 'Location not added yet'}</p>
          </div>
        </div>
        <div className="masjid-profile-summary">
          <TagRow tags={tags} />
          <p>{organization.description || 'This masjid profile is ready for onboarding details, prayer preferences, events, and announcements.'}</p>
          <div className="masjid-stat-strip">
            {profileStats.map((item) => <div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}
          </div>
          <div className="profile-info-grid">
            <div><span>Address</span><strong>{organization.address || organization.city || 'Location not added yet'}</strong></div>
            <div><span>Website</span><strong>{organization.website ? organization.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Not added yet'}</strong></div>
          </div>
        </div>
        <div className="profile-actions">
          {canFollowMasjid && <button className={organization.isFollowing ? 'secondary-button' : 'primary-button'} onClick={() => organization.isFollowing ? onUnfollow(organization.id) : onFollow(organization.id, organization.notifyPrayers)}>{organization.isFollowing ? 'Following' : 'Follow'}</button>}
          {canFollowMasjid && <button className={organization.isFavorited ? 'primary-button' : 'secondary-button'} onClick={() => onFavorite(organization.id, organization.isFavorited)}>{organization.isFavorited ? 'Favorited' : 'Favorite'}</button>}
          {canFollowMasjid && messageContact && <button className="secondary-button" onClick={() => onMessage(messageContact)}><MessageCircle size={17} />Message</button>}
          {canFollowMasjid && <button className={organization.notifyPrayers ? 'primary-button' : 'secondary-button'} onClick={() => onFollow(organization.id, true)}>{organization.notifyPrayers ? 'Notifications on' : 'Notify Me'}</button>}
          {!canFollowMasjid && <span className="status-pill">Organization profile</span>}
          <a className="secondary-button" href={directionsUrl(organization)} target="_blank" rel="noreferrer">Directions</a>
          {organization.website && <a className="secondary-button" href={organization.website} target="_blank" rel="noreferrer">Website</a>}
          {organization.donationUrl && <a className="secondary-button" href={organization.donationUrl} target="_blank" rel="noreferrer">Donate</a>}
        </div>
      </section>

      <div className="content-grid">
        <section className="feed-column">
          <section className="panel masjid-profile-section">
            <div className="section-title"><h2>Updates</h2><span>{posts.length}</span></div>
            <div className="stack-list">
              {latestPosts.map((post) => <article className="mini-row feed-post compact-profile-row" key={post.id}><span>{post.type} - {new Date(post.createdAt).toLocaleDateString()}</span><strong>{post.title}</strong><p>{post.content}</p>{post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}</article>)}
              {!posts.length && <p className="helper-text">No posts yet.</p>}
            </div>
          </section>
          <section className="panel masjid-profile-section">
            <div className="section-title"><h2>Events</h2><span>{events.length}</span></div>
            <div className="stack-list">
              {upcomingEvents.map((event) => <article className="mini-row compact-profile-row" key={event.id}><strong>{event.title}</strong><span>{new Date(event.startTime).toLocaleString()}</span><p>{event.description || event.location || 'No details yet.'}</p></article>)}
              {!events.length && <p className="helper-text">No events yet.</p>}
            </div>
          </section>
          <section className="panel masjid-profile-section">
            <div className="section-title"><h2>Classes & Programs</h2><span>{classes.length}</span></div>
            <div className="stack-list">
              {featuredClasses.map((item) => <article className="mini-row compact-profile-row" key={item.id || item.title}><strong>{item.title}</strong><span>{item.teacher || item.imam || item.dayTime || 'Schedule TBD'}</span><p>{item.description || item.location || item.registrationLink || 'Registration details coming soon.'}</p></article>)}
              {!classes.length && <p className="helper-text">No classes listed yet.</p>}
            </div>
          </section>
          <section className="panel masjid-profile-section">
            <div className="section-title"><h2>Opportunities</h2><span>{volunteer.length}</span></div>
            <div className="stack-list">
              {featuredVolunteer.map((item) => {
                const application = (item.applications || []).find((entry) => entry.applicantId === user?.id);
                return <article className="mini-row compact-profile-row" key={item.id}><strong>{item.title}</strong><span>{item.type}</span><p>{item.description || item.location || 'No details yet.'}</p>{isUserAccount(user) && (application ? <span className="status-pill">{application.status}</span> : <button className="secondary-button" onClick={() => applyToOpportunity(item.id, {})}>Apply</button>)}</article>;
              })}
              {!volunteer.length && <p className="helper-text">No opportunities yet.</p>}
            </div>
          </section>
          <section className="panel masjid-profile-section">
            <div className="section-title"><h2>Jobs</h2><span>{jobs.length}</span></div>
            <div className="stack-list">
              {featuredJobs.map((item) => {
                const application = (item.applications || []).find((entry) => entry.applicantId === user?.id);
                return <article className="mini-row compact-profile-row" key={item.id}><strong>{item.title}</strong><span>{item.location || 'Location TBD'}</span><p>{item.description || 'No details yet.'}</p>{isUserAccount(user) && (application ? <span className="status-pill">{application.status}</span> : <button className="secondary-button" onClick={() => applyToOpportunity(item.id, {})}>Apply</button>)}</article>;
              })}
              {!jobs.length && <p className="helper-text">No jobs posted yet.</p>}
            </div>
          </section>
        </section>
        <aside className="right-rail">
          <section className="panel">
            <div className="section-title"><h2>Imams & Team</h2><span>{organization.peopleCount || 0}</span></div>
            <div className="stack-list">
              {featuredTeam.map((person) => (
                <article className="mini-row compact-profile-row" key={person.id}>
                  <strong>{person.user?.name || 'Team member'}</strong>
                  <span>{person.roleLabel}</span>
                  <p>{person.user?.bio || person.user?.city || person.user?.accountType || 'Community profile'}</p>
                </article>
              ))}
              {!(organization.people || []).length && <p className="helper-text">No imams or team members listed yet.</p>}
            </div>
          </section>
          <MasjidPrayerSchedule organization={organization} />
          <section className="panel">
            <div className="section-title"><h2>Links</h2></div>
            <p>{organization.phone || 'Phone not added'}</p>
            <p>{organization.email || 'Email not added'}</p>
            <p>{facilities.length ? facilities.join(' - ') : 'Facilities not added'}</p>
          </section>
        </aside>
      </div>
    </Page>
  );
}

function printableHoursReport(user, visible) {
  const rows = visible
    .map((item) => ({ item, application: item.applications?.[0] }))
    .filter(({ application }) => application && Number(application.approvedHours || 0) > 0)
    .map(({ item, application }) => `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.organization?.name || 'Community organization')}</td>
        <td>${escapeHtml(application.status)}</td>
        <td>${escapeHtml(application.approvedHours || 0)}</td>
      </tr>
    `).join('');
  const total = visible.reduce((sum, item) => sum + (item.applications?.[0]?.approvedHours || 0), 0);
  const report = window.open('', '_blank');
  if (!report) return alert('Allow popups to print or save your volunteer hours report.');
  report.document.write(`
    <html>
      <head>
        <title>Verified Volunteer Hours</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #17212b; }
          h1 { margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 24px; }
          th, td { border: 1px solid #d7dee8; padding: 10px; text-align: left; }
          th { background: #f3f6f8; }
          .total { margin-top: 20px; font-size: 20px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>Verified Volunteer Hours</h1>
        <p>${escapeHtml(user.name)} - Generated ${escapeHtml(new Date().toLocaleString())}</p>
        <table><thead><tr><th>Opportunity</th><th>Masjid</th><th>Status</th><th>Hours</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No approved hours yet.</td></tr>'}</tbody></table>
        <p class="total">Total verified hours: ${total}</p>
      </body>
    </html>
  `);
  report.document.close();
  report.focus();
  report.print();
}

function OpportunitiesScreen({ user, opportunities, type = 'VOLUNTEER', applyToOpportunity, updateNotificationPreferences, notificationPreferences, title, subtitle }) {
  const [opportunityQuery, setOpportunityQuery] = useState('');
  const [workTypeFilter, setWorkTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const baseVisible = opportunities.filter((item) => item.type === type || (type === 'VOLUNTEER' && item.type === 'OPPORTUNITY'));
  const workTypeOptions = ['all', ...Array.from(new Set(baseVisible.map((item) => item.workType || item.type).filter(Boolean)))];
  const locationOptions = ['all', ...Array.from(new Set(baseVisible.map((item) => item.location).filter(Boolean)))];
  const visible = baseVisible.filter((item) => {
    const application = item.applications?.[0];
    const query = opportunityQuery.trim().toLowerCase();
    const haystack = `${item.title} ${item.description || ''} ${item.requirements || ''} ${item.organization?.name || ''} ${item.location || ''} ${Array.isArray(item.skills) ? item.skills.join(' ') : item.skills || ''}`.toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (workTypeFilter !== 'all' && (item.workType || item.type) !== workTypeFilter) return false;
    if (locationFilter !== 'all' && item.location !== locationFilter) return false;
    if (statusFilter === 'applied' && !application) return false;
    if (statusFilter === 'open' && application) return false;
    if (!['all', 'applied', 'open'].includes(statusFilter) && application?.status !== statusFilter) return false;
    return true;
  });
  const verifiedTotal = visible.reduce((sum, item) => sum + (item.applications?.[0]?.approvedHours || 0), 0);
  const [activeOpportunity, setActiveOpportunity] = useState(null);
  const [applicationForms, setApplicationForms] = useState({});
  const ageAllowed = type !== 'JOB' || canUseJobs(user);
  const userCanApply = isUserAccount(user) && ageAllowed;
  const activeQuestions = activeOpportunity ? normalizeList(activeOpportunity.applicationQuestions || activeOpportunity.questions) : [];
  const preferenceKey = type === 'JOB' ? 'jobOpportunities' : 'volunteerOpportunities';
  const sourceKey = type === 'JOB' ? 'jobOpportunitySource' : 'volunteerOpportunitySource';
  const preferences = { ...defaultNotificationPreferences, ...notificationPreferences };
  function updateApplicationForm(id, field, value) {
    setApplicationForms((current) => ({ ...current, [id]: { ...(current[id] || {}), [field]: value } }));
  }
  function updateAnswer(id, question, value) {
    setApplicationForms((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        answers: { ...((current[id] || {}).answers || {}), [question]: value }
      }
    }));
  }
  async function submitApplication(id) {
    await applyToOpportunity(id, applicationForms[id] || {});
    setApplicationForms((current) => ({ ...current, [id]: { note: '', contactPhone: '', resumeUrl: '' } }));
    setActiveOpportunity(null);
  }
  return (
    <Page title={title} subtitle={subtitle}>
      {!userCanApply && (
        <section className="panel role-notice">
          <strong>{isUserAccount(user) ? 'Age restricted' : 'Organization account'}</strong>
          <p>{isUserAccount(user) ? 'Job applications require a saved date of birth showing you are 18 or older.' : 'Masjid and MSA accounts manage listings from the dashboard. Applying is reserved for community member accounts.'}</p>
        </section>
      )}
      {type === 'VOLUNTEER' && (
        <section className="hours-summary panel">
          <div>
            <span>Verified Hours</span>
            <h2>{verifiedTotal}</h2>
            <p>Hours only count after the masjid approves them.</p>
          </div>
          <button className="secondary-button" onClick={() => printableHoursReport(user, visible)}>Download PDF</button>
        </section>
      )}
      <section className="filter-panel opportunity-filters">
        <label><Search size={15} /><input placeholder={`Search ${type === 'JOB' ? 'jobs' : 'volunteer roles'}`} value={opportunityQuery} onChange={(event) => setOpportunityQuery(event.target.value)} /></label>
        <select value={workTypeFilter} onChange={(event) => setWorkTypeFilter(event.target.value)}>{workTypeOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'All types' : item}</option>)}</select>
        <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)}>{locationOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'All locations' : item}</option>)}</select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">Any status</option>
          <option value="open">Open to apply</option>
          <option value="applied">Applied</option>
          <option value="PENDING">Pending</option>
          <option value="REVIEWING">Reviewing</option>
          <option value="INTERVIEW">Interview</option>
          <option value="APPROVED">Approved</option>
          <option value="COMPLETED">Completed</option>
        </select>
      </section>
      <div className="card-grid two">
        {visible.map((item) => {
          const application = item.applications?.[0];
          return (
          <article className={item.isFromFavoriteMasjid ? 'role-card opportunity-card favorite-opportunity' : 'role-card opportunity-card'} key={item.id}>
            <div className="role-icon">{item.type === 'JOB' ? <Briefcase size={24} /> : <HeartHandshake size={24} />}</div>
            <div>
              <h3>{item.title}</h3>
              <p>{item.organization?.name || 'Community organization'}</p>
              <TagRow tags={[item.isFromFavoriteMasjid && 'Favorite masjid', item.location || 'Location TBD', item.workType || item.type, item.deadline && `Deadline ${new Date(item.deadline).toLocaleDateString()}`, item.hours ? `${item.hours} hours` : null, ...(Array.isArray(item.skills) ? item.skills : normalizeList(item.skills))].filter(Boolean)} />
            </div>
            <p>{item.description || 'No description yet.'}</p>
            {item.requirements && <div className="check-row"><span>Requirements</span><strong>{item.requirements}</strong></div>}
            <div className="check-row"><span>Masjid</span><strong>{item.organization?.name || 'Community organization'}</strong></div>
            <div className="check-row"><span>Status</span><strong>{application?.status || 'Not applied'}</strong></div>
            <div className="check-row"><span>Approved hours</span><strong>{application?.approvedHours || 0}</strong></div>
            {application?.note && <div className="check-row"><span>Your note</span><strong>{application.note}</strong></div>}
            <div className="card-footer">
              {application ? <span className="status-pill">{application.status}</span> : userCanApply ? <button className="primary-button" onClick={() => setActiveOpportunity(item)}>Apply</button> : <span className="status-pill">Manage in dashboard</span>}
              {isUserAccount(user) && <button className={preferences[preferenceKey] ? 'primary-button' : 'secondary-button'} onClick={() => updateNotificationPreferences?.({ ...preferences, [preferenceKey]: true, [sourceKey]: item.isFromFavoriteMasjid ? 'favorited' : item.isFromFollowedMasjid ? 'followed' : preferences[sourceKey] })}>Notify me about similar</button>}
            </div>
          </article>
        );})}
        {!visible.length && <section className="panel"><p className="helper-text">No listings match those filters yet.</p></section>}
      </div>
      {activeOpportunity && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`Apply to ${activeOpportunity.title}`}>
          <section className="application-modal panel">
            <div className="section-title">
              <div><p className="eyebrow">{activeOpportunity.type === 'JOB' ? 'Job application' : 'Volunteer application'}</p><h2>{activeOpportunity.title}</h2></div>
              <button className="icon-button" onClick={() => setActiveOpportunity(null)} aria-label="Close application"><X size={18} /></button>
            </div>
            <p className="helper-text">{activeOpportunity.organization?.name || 'Community organization'} - {activeOpportunity.location || 'Location TBD'}</p>
            <div className="application-form modal-form">
              <div className="form-grid">
                <input placeholder="Full name" value={applicationForms[activeOpportunity.id]?.name || user.name || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'name', event.target.value)} />
                <input placeholder="Email" value={applicationForms[activeOpportunity.id]?.email || user.email || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'email', event.target.value)} />
                <input placeholder="Phone optional" value={applicationForms[activeOpportunity.id]?.contactPhone || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'contactPhone', event.target.value)} />
                <input placeholder="Resume/profile link optional" value={applicationForms[activeOpportunity.id]?.resumeUrl || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'resumeUrl', event.target.value)} />
              </div>
              <textarea placeholder={activeOpportunity.type === 'JOB' ? 'Cover message' : 'Availability or short message'} value={applicationForms[activeOpportunity.id]?.note || ''} onChange={(event) => updateApplicationForm(activeOpportunity.id, 'note', event.target.value)} />
              {activeQuestions.map((question) => (
                <label className="question-field" key={question}>
                  <span>{question}</span>
                  <textarea placeholder="Your answer" value={applicationForms[activeOpportunity.id]?.answers?.[question] || ''} onChange={(event) => updateAnswer(activeOpportunity.id, question, event.target.value)} />
                </label>
              ))}
              {!activeQuestions.length && <p className="helper-text">This listing does not have custom questions yet.</p>}
              <button className="primary-button" onClick={() => submitApplication(activeOpportunity.id)}>Submit application</button>
            </div>
          </section>
        </div>
      )}
    </Page>
  );
}

function ProfileScreen({ user, viewedUser, onCloseViewed, onSave, social, onFavorite, openOrganization, openEvent }) {
  const editingSelf = !viewedUser || viewedUser.id === user.id;
  const profile = viewedUser || user;
  const [editMode, setEditMode] = useState(false);
  const [activeList, setActiveList] = useState(null);

  const followers = social.followers || social.connections || [];
  const following = social.following || social.connections || [];
  const favoriteMasjids = social.favoriteMasjids || [];
  const followedMasjids = social.followingMasjids || [];
  const savedEvents = social.savedEvents || [];
  const [form, setForm] = useState(() => ({
    name: profile.name || '',
    dateOfBirth: toDateInput(profile.dateOfBirth),
    city: profile.city || '',
    location: profile.location || '',
    bio: profile.bio || '',
    education: profile.education || '',
    experience: profile.experience || '',
    availability: profile.availability || '',
    avatarUrl: profile.avatarUrl || '',
    bannerUrl: profile.bannerUrl || profile.heroImageUrl || '',
    skills: listToText(profile.skills),
    interests: listToText(profile.interests),
    languages: listToText(profile.languages),
    hobbies: listToText(profile.hobbies)
  }));

  useEffect(() => {
    setForm({
      name: profile.name || '',
      dateOfBirth: toDateInput(profile.dateOfBirth),
      city: profile.city || '',
      location: profile.location || '',
      bio: profile.bio || '',
      education: profile.education || '',
      experience: profile.experience || '',
      availability: profile.availability || '',
      avatarUrl: profile.avatarUrl || '',
      bannerUrl: profile.bannerUrl || profile.heroImageUrl || '',
      skills: listToText(profile.skills),
      interests: listToText(profile.interests),
      languages: listToText(profile.languages),
      hobbies: listToText(profile.hobbies)
    });
    setEditMode(false);
  }, [profile.id]);

  async function submit(event) {
    event.preventDefault();
    const updated = await api('/api/me', {
      method: 'PUT',
      body: JSON.stringify({
        ...form,
        skills: textToList(form.skills),
        interests: textToList(form.interests),
        languages: textToList(form.languages),
        hobbies: textToList(form.hobbies)
      })
    });
    onSave(updated);
    setEditMode(false);
  }

  function openList(title, people) {
    setActiveList({ title, people });
  }

  return (
    <Page title={editingSelf ? 'Your Profile' : profile.name} subtitle="Community profile, network, favorite masjids, and personal details.">
      {!editingSelf && <button className="secondary-button" onClick={onCloseViewed}>Back to your profile</button>}

      <section className="panel profile-detail">
        <div className="profile-banner" style={profileBannerStyle(profile)} />

        <div className="profile-header-card">
          <div className="profile-avatar large">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : initials(profile.name)}
          </div>

          <div className="profile-main-info">
            <h2>{profile.name}</h2>
            <p>{displayRoleLabel(profile.accountType)} · {profile.city || profile.location || 'Location open'}</p>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          </div>

          <div className="profile-actions">
            {editingSelf ? (
              <button className="primary-button" onClick={() => setEditMode(!editMode)}>
                {editMode ? 'Cancel edit' : 'Edit profile'}
              </button>
            ) : (
              <>
                <button className="primary-button">Follow</button>
                <button className="secondary-button">Message</button>
              </>
            )}
          </div>
        </div>

        <div className="profile-stat-row">
          <button type="button" onClick={() => openList('Followers', followers)}>
            <strong>{followers.length}</strong>
            <span>Followers</span>
          </button>
          <button type="button" onClick={() => openList('Following', following)}>
            <strong>{following.length}</strong>
            <span>Following</span>
          </button>
          <button type="button">
            <strong>{favoriteMasjids.length}</strong>
            <span>Favorite Masjids</span>
          </button>
        </div>

        {editMode && editingSelf ? (
          <form className="profile-form clean-edit-form" onSubmit={submit}>
            <div className="form-grid">
              <input placeholder="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} aria-label="Date of birth" />
              {['city', 'location', 'availability', 'avatarUrl', 'bannerUrl'].map((field) => <input key={field} placeholder={field} value={form[field]} onChange={(event) => setForm({ ...form, [field]: event.target.value })} />)}
            </div>

            <textarea placeholder="Bio" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
            <textarea placeholder="Experience" value={form.experience} onChange={(event) => setForm({ ...form, experience: event.target.value })} />
            <textarea placeholder="Education" value={form.education} onChange={(event) => setForm({ ...form, education: event.target.value })} />

            <input placeholder="Skills, comma separated" value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} />
            <input placeholder="Interests, comma separated" value={form.interests} onChange={(event) => setForm({ ...form, interests: event.target.value })} />
            <input placeholder="Languages, comma separated" value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })} />
            <input placeholder="Hobbies, comma separated" value={form.hobbies} onChange={(event) => setForm({ ...form, hobbies: event.target.value })} />

            <button className="primary-button">Save profile</button>
          </form>
        ) : (
          <ProfileSections profile={profile} />
        )}
      </section>

      <section className="panel profile-social">
        <div className="section-title">
          <h2>Favorite Masjids</h2>
          <span>{favoriteMasjids.length}</span>
        </div>

        <div className="favorite-masjid-grid">
          {favoriteMasjids.map((org) => (
            <article className="favorite-masjid-card" key={org.id}>
              <button className="mini-org-avatar" onClick={() => openOrganization?.(org.id)}>
                {org.logoUrl || org.imageUrl ? <img src={org.logoUrl || org.imageUrl} alt="" /> : initials(org.name)}
              </button>
              <div>
                <strong>{org.name}</strong>
                <span>{org.city || org.location || 'Location open'}</span>
              </div>
              {editingSelf && <button className="secondary-button compact-button" onClick={() => onFavorite?.(org.id, true)}>Unfavorite</button>}
            </article>
          ))}
        </div>

        {!favoriteMasjids.length && <p className="helper-text">You haven't favorited any masjids yet.</p>}

        <div className="section-title">
          <h2>Followed Masjids</h2>
          <span>{followedMasjids.length}</span>
        </div>
        <div className="stack-list">
          {followedMasjids.slice(0, 4).map((org) => (
            <article className="mini-row action-row" key={org.id}>
              <strong>{org.name}</strong>
              <span>{org.city || org.address || 'Location open'}</span>
              <button className="secondary-button compact-button" onClick={() => openOrganization?.(org.id)}>Open</button>
            </article>
          ))}
        </div>
        {!followedMasjids.length && <p className="helper-text">Follow masjids to receive announcements and event updates.</p>}

        <div className="section-title">
          <h2>Saved Events</h2>
          <span>{savedEvents.length}</span>
        </div>
        <div className="stack-list">
          {savedEvents.slice(0, 4).map((event) => (
            <article className="mini-row action-row" key={event.id}>
              <strong>{event.title}</strong>
              <span>{event.startTime ? new Date(event.startTime).toLocaleString() : event.location || 'Time TBA'}</span>
              <button className="secondary-button compact-button" onClick={() => openEvent?.(event.id)}>Open</button>
            </article>
          ))}
        </div>
        {!savedEvents.length && <p className="helper-text">No saved events yet.</p>}

        <div className="section-title">
          <h2>Masjid Roles</h2>
          <span>{social.affiliatedMasjids.length}</span>
        </div>

        <div className="stack-list">
          {social.affiliatedMasjids.map((item) => (
            <article className="mini-row" key={item.id}>
              <strong>{item.organization?.name}</strong>
              <span>{item.roleLabel}</span>
            </article>
          ))}
        </div>

        {!social.affiliatedMasjids.length && <p className="helper-text">No masjid roles listed yet.</p>}
      </section>

      {activeList && (
        <div className="modal-backdrop" onClick={() => setActiveList(null)}>
          <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-header">
              <h2>{activeList.title}</h2>
              <button onClick={() => setActiveList(null)}>×</button>
            </div>

            <div className="people-list">
              {activeList.people.map((person) => (
                <article className="person-list-row" key={person.id}>
                  <div className="profile-avatar small">
                    {person.avatarUrl ? <img src={person.avatarUrl} alt="" /> : initials(person.name)}
                  </div>
                  <div>
                    <strong>{person.name}</strong>
                    <span>{displayRoleLabel(person.accountType)}</span>
                  </div>
                  <button className="secondary-button">View</button>
                </article>
              ))}
            </div>

            {!activeList.people.length && <p className="helper-text">Nothing to show yet.</p>}
          </div>
        </div>
      )}
    </Page>
  );
}

function ProfileSections({ profile }) {
  return (
    <div className="profile-section-stack">
      <ProfileInfoBlock title="About" text={profile.bio || 'No bio added yet.'} />
      <ProfileInfoBlock title="Experience" text={profile.experience || 'No experience added yet.'} />
      <ProfileInfoBlock title="Education" text={profile.education || 'No education added yet.'} />

      <ChipSection title="Skills" items={profile.skills || []} />
      <ChipSection title="Interests" items={profile.interests || []} />
      <ChipSection title="Languages" items={profile.languages || []} />
      <ChipSection title="Hobbies" items={profile.hobbies || []} />
    </div>
  );
}

function ProfileInfoBlock({ title, text }) {
  return (
    <article className="profile-info-block">
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function ChipSection({ title, items }) {
  return (
    <article className="profile-info-block">
      <h3>{title}</h3>
      <div className="tag-row">
        {items.length ? items.map((item) => <span key={item}>{item}</span>) : <span>Not added yet</span>}
      </div>
    </article>
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

function SettingsScreen({ user, social = {}, notificationPreferences, updateNotificationPreferences, whatsappSettings, updateWhatsAppSettings, onSave, onFavorite, onUnfollow, openOrganization, openEvent, logout, theme = 'dark', setTheme }) {
  const selected = userPreferenceLabels(user);
  const [form, setForm] = useState(() => ({
    dateOfBirth: toDateInput(user.dateOfBirth),
    interests: optionalInterestLabels.filter((label) => selected.has(label))
  }));
  const [whatsappForm, setWhatsappForm] = useState(() => ({
    phone: whatsappSettings.phone || '',
    enabled: Boolean(whatsappSettings.enabled)
  }));
  const [whatsappSaveState, setWhatsappSaveState] = useState('');
  const preferences = { ...defaultNotificationPreferences, ...notificationPreferences };
  const favoriteMasjids = social.favoriteMasjids || [];
  const followedMasjids = social.followingMasjids || [];
  const savedEvents = social.savedEvents || [];

  useEffect(() => {
    const nextSelected = userPreferenceLabels(user);
    setForm({
      dateOfBirth: toDateInput(user.dateOfBirth),
      interests: optionalInterestLabels.filter((label) => nextSelected.has(label))
    });
  }, [user.id, user.dateOfBirth, (user.interests || []).join('|')]);

  useEffect(() => {
    setWhatsappForm({
      phone: whatsappSettings.phone || '',
      enabled: Boolean(whatsappSettings.enabled)
    });
  }, [whatsappSettings.phone, whatsappSettings.enabled]);

  function toggleOptional(label) {
    setForm((current) => ({
      ...current,
      interests: current.interests.includes(label)
        ? current.interests.filter((item) => item !== label)
        : [...current.interests, label]
    }));
  }

  async function submit(event) {
    event.preventDefault();
    const updated = await api('/api/me', {
      method: 'PUT',
      body: JSON.stringify({ dateOfBirth: form.dateOfBirth, interests: [...coreInterestLabels, ...form.interests] })
    });
    onSave(updated);
  }

  function togglePreference(key) {
    updateNotificationPreferences({ ...preferences, [key]: !preferences[key] });
  }

  function updateSource(key, value) {
    updateNotificationPreferences({ ...preferences, [key]: value });
  }

  async function saveWhatsAppSettings(event) {
    event.preventDefault();
    setWhatsappSaveState('Saving...');
    try {
      const saved = await updateWhatsAppSettings(whatsappForm);
      setWhatsappForm({ phone: saved?.phone || whatsappForm.phone, enabled: Boolean(saved?.enabled) });
      setWhatsappSaveState(saved?.enabled ? 'WhatsApp notifications enabled for this account.' : 'WhatsApp notifications are off for this account.');
    } catch (error) {
      setWhatsappSaveState(error.message || 'Could not save WhatsApp settings.');
    }
  }

  return (
    <Page title="Settings" subtitle="Profile, masjids, notifications, events, opportunities, and prayer preferences.">
      <form className="panel settings-panel mobile-settings" onSubmit={submit}>
        <div className="section-title"><div><p className="eyebrow">Account</p><h2>Profile settings</h2></div><Settings size={20} /></div>
        <label className="field-label">
          <span>Date of birth</span>
          <input type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
        </label>
        <section className="interest-picker settings-picker">
          <div>
            <strong>Always available</strong>
            <p>{coreInterestLabels.join(', ')}</p>
          </div>
          <div className="interest-options">
            {optionalInterestLabels.map((label) => (
              <label key={label} className="check-toggle">
                <input type="checkbox" checked={form.interests.includes(label)} onChange={() => toggleOptional(label)} disabled={label === 'Jobs' && !canUseJobs({ ...user, dateOfBirth: form.dateOfBirth })} />
                {label}{label === 'Jobs' && !canUseJobs({ ...user, dateOfBirth: form.dateOfBirth }) ? ' (18+)' : ''}
              </label>
            ))}
          </div>
        </section>
        <button className="primary-button">Save preferences</button>
      </form>

      <section className="panel settings-panel mobile-settings">
        <div className="section-title"><div><p className="eyebrow">Masjids</p><h2>Favorites</h2></div><span>{favoriteMasjids.length}</span></div>
        <div className="stack-list">
          {favoriteMasjids.map((org) => (
            <article className="mini-row action-row" key={org.id}>
              <strong>{org.name}</strong>
              <span>{org.city || org.address || 'Location open'}</span>
              <button className="secondary-button compact-button" onClick={() => openOrganization?.(org.id)}>Open</button>
              <button className="secondary-button compact-button" onClick={() => onFavorite?.(org.id, true)}>Unfavorite</button>
            </article>
          ))}
        </div>
        {!favoriteMasjids.length && <p className="helper-text">You haven't favorited any masjids yet.</p>}

        <div className="section-title"><div><p className="eyebrow">Masjids</p><h2>Following</h2></div><span>{followedMasjids.length}</span></div>
        <div className="stack-list">
          {followedMasjids.map((org) => (
            <article className="mini-row action-row" key={org.id}>
              <strong>{org.name}</strong>
              <span>{org.notifyPrayers ? 'Prayer notifications on' : 'Updates enabled'}</span>
              <button className="secondary-button compact-button" onClick={() => openOrganization?.(org.id)}>Open</button>
              <button className="secondary-button compact-button" onClick={() => onUnfollow?.(org.id)}>Unfollow</button>
            </article>
          ))}
        </div>
        {!followedMasjids.length && <p className="helper-text">Follow masjids to receive announcements and event updates.</p>}
      </section>

      <section className="panel settings-panel mobile-settings">
        {notificationToggleGroups.map((group) => (
          <div className="settings-group" key={group.title}>
            <div className="section-title compact-title"><h3>{group.title}</h3></div>
            <div className="toggle-list">
              {group.items.map(([key, label]) => (
                <label className="switch-row" key={key}>
                  <span>{label}</span>
                  <input type="checkbox" checked={Boolean(preferences[key])} onChange={() => togglePreference(key)} />
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="settings-source-grid">
          <label className="field-label"><span>Job alerts from</span><select value={preferences.jobOpportunitySource} onChange={(event) => updateSource('jobOpportunitySource', event.target.value)}><option value="followed">Followed masjids only</option><option value="favorited">Favorited masjids only</option><option value="nearby">All nearby masjids</option></select></label>
          <label className="field-label"><span>Volunteer alerts from</span><select value={preferences.volunteerOpportunitySource} onChange={(event) => updateSource('volunteerOpportunitySource', event.target.value)}><option value="followed">Followed masjids only</option><option value="favorited">Favorited masjids only</option><option value="nearby">All nearby masjids</option></select></label>
        </div>
      </section>

      <section className="panel settings-panel mobile-settings">
        <div className="section-title"><div><p className="eyebrow">Every account</p><h2>Appearance</h2></div><Settings size={20} /></div>
        <p className="helper-text">Choose the interface theme for this browser.</p>
        <div className="segmented-control settings-theme-toggle">
          <button type="button" className={theme === 'light' ? 'active' : ''} onClick={() => setTheme?.('light')}>Light</button>
          <button type="button" className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme?.('dark')}>Dark</button>
        </div>
      </section>

      <form className="panel settings-panel mobile-settings" onSubmit={saveWhatsAppSettings}>
        <div className="section-title"><div><p className="eyebrow">Every account</p><h2>WhatsApp notifications</h2></div><MessageCircle size={20} /></div>
        <p className="helper-text">Users, masjids, imams, MSAs, businesses, and admins can save their own number here. Your number is private and is used only for notification types you enable.</p>
        <label className="field-label">
          <span>WhatsApp phone number</span>
          <input type="tel" autoComplete="tel" inputMode="tel" value={whatsappForm.phone} onChange={(event) => setWhatsappForm({ ...whatsappForm, phone: event.target.value })} placeholder="+1 647 555 1234" />
          <small>Canadian and US 10-digit numbers are saved with +1 automatically. Other countries should include their country code.</small>
        </label>
        <label className="switch-row">
          <span>Receive WhatsApp notifications</span>
          <input type="checkbox" checked={whatsappForm.enabled} onChange={(event) => setWhatsappForm({ ...whatsappForm, enabled: event.target.checked })} />
        </label>
        <div className="tag-row">
          <span>{whatsappSettings.integrationEnabled ? 'Integration enabled' : 'Integration disabled'}</span>
          <span>{whatsappSettings.serviceConfigured ? 'Service configured' : 'Service not configured'}</span>
        </div>
        <button className="primary-button">Save WhatsApp settings</button>
        {whatsappSaveState && <p className="helper-text" role="status">{whatsappSaveState}</p>}
      </form>

      <section className="panel settings-panel mobile-settings">
        <div className="section-title"><div><p className="eyebrow">Events</p><h2>Saved events</h2></div><span>{savedEvents.length}</span></div>
        <div className="stack-list">
          {savedEvents.map((event) => (
            <article className="mini-row action-row" key={event.id}>
              <strong>{event.title}</strong>
              <span>{event.startTime ? new Date(event.startTime).toLocaleString() : event.location || 'Time TBA'}</span>
              <button className="secondary-button compact-button" onClick={() => openEvent?.(event.id)}>Open</button>
            </article>
          ))}
        </div>
        {!savedEvents.length && <p className="helper-text">No saved events yet.</p>}
      </section>

      <section className="panel settings-panel mobile-settings">
        <div className="section-title"><div><p className="eyebrow">Account</p><h2>Session</h2></div><LogOut size={20} /></div>
        <button className="secondary-button danger" onClick={logout}>Logout</button>
      </section>
    </Page>
  );
}

function ImamDashboard({ user, social, setTab }) {
  const linkedMasjids = social.affiliatedMasjids || [];
  const linkedPrograms = linkedMasjids.flatMap((affiliation) => (affiliation.organization?.classes || []).map((program) => ({ ...program, organization: affiliation.organization })));
  const profileFields = [user.bio, user.avatarUrl, user.bannerUrl, user.city || user.location, user.skills?.length, user.availability].filter(Boolean).length;
  const completion = Math.round((profileFields / 6) * 100);
  return (
    <Page title="Imam Dashboard" subtitle="Professional hub for profile, messages, linked masjids, classes, reminders, and future requests.">
      <div className="content-grid">
        <section className="feed-column">
          <section className="panel ops-overview">
            <div className="section-title"><div><p className="eyebrow">Imam workspace</p><h2>{user.name}</h2></div><span>{displayRoleLabel(user.accountType)}</span></div>
            <div className="metric-grid compact">
              <button type="button" className="metric-card metric-button" onClick={() => setTab('profile')}><span>Profile</span><strong>{completion}%</strong><em>Bio, topics, image, and availability</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setTab('messages')}><span>Messages</span><strong>DM</strong><em>Users and masjids can contact you</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setTab('organizations')}><span>Linked masjids</span><strong>{linkedMasjids.length}</strong><em>Affiliations and roles</em></button>
              <button type="button" className="metric-card metric-button" onClick={() => setTab('network')}><span>Network</span><strong>{social.connections.length}</strong><em>Community connections</em></button>
            </div>
          </section>

          <section className="panel">
            <div className="section-title"><h2>Profile Overview</h2><button onClick={() => setTab('profile')}>Edit</button></div>
            <div className="profile-hero"><div className="profile-avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials(user.name)}</div><div><h2>{user.name}</h2><p>{user.bio || 'Add your bio, credentials, topics, and availability.'}</p></div></div>
            <TagRow tags={[...(user.skills || []), user.availability, user.city || user.location].filter(Boolean)} />
          </section>

          <section className="panel">
            <div className="section-title"><h2>Classes & Programs</h2><span>{linkedPrograms.length}</span></div>
            <div className="stack-list">
              {linkedPrograms.map((program, index) => (
                <article className="mini-row" key={program.id || `${program.organization.id}-${program.title}-${index}`}>
                  <strong>{program.title}</strong>
                  <span>{program.organization.name} - {program.dayTime || 'Schedule TBD'}</span>
                  <p>{program.description || program.notes || program.location || 'Program details are not filled in yet.'}</p>
                </article>
              ))}
              {!linkedPrograms.length && <p className="helper-text">No linked classes yet. Ask the masjid dashboard manager to add your class or attach you to the masjid team.</p>}
            </div>
          </section>
        </section>

        <aside className="right-rail">
          <section className="panel">
            <div className="section-title"><h2>Linked Masjids</h2><span>{linkedMasjids.length}</span></div>
            <div className="stack-list">
              {linkedMasjids.map((affiliation) => (
                <article className="mini-row" key={affiliation.id}>
                  <strong>{affiliation.organization?.name || 'Masjid'}</strong>
                  <span>{affiliation.roleLabel}</span>
                  <p>{affiliation.organization?.city || affiliation.organization?.address || 'Location not added yet.'}</p>
                </article>
              ))}
              {!linkedMasjids.length && <p className="helper-text">No masjid affiliation is attached yet.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Requests</h2><span>Later</span></div>
            <div className="stack-list">
              <article className="mini-row"><strong>Speaking requests</strong><span>Khutbah, halaqah, class, and counseling request workflow planned.</span></article>
              <article className="mini-row"><strong>Reminder posts</strong><span>Imam-authored reminders can build on the existing post model.</span></article>
            </div>
          </section>
        </aside>
      </div>
    </Page>
  );
}


function MasjidReadinessPanel({ organization, metrics = {}, openSection, openUserView }) {
  const checks = [
    { key: 'profile', label: 'Logo and public profile', done: Boolean(organization?.imageUrl && organization?.description), action: () => openSection?.('prayerTimes'), actionLabel: 'Edit profile' },
    { key: 'contact', label: 'Address and contact links', done: Boolean(organization?.address && (organization?.phone || organization?.email || organization?.website)), action: () => openSection?.('prayerTimes'), actionLabel: 'Update info' },
    { key: 'prayer', label: 'Iqamah / Jumuah times', done: Boolean(organization?.prayerTimes || organization?.iqamahTimes), action: () => openSection?.('prayerTimes'), actionLabel: 'Set times' },
    { key: 'posts', label: 'At least one announcement', done: Number(metrics.posts || 0) > 0, action: () => openSection?.('posts'), actionLabel: 'Create post' },
    { key: 'events', label: 'Upcoming events/classes', done: Number(metrics.events || 0) > 0 || Number(metrics.programs || 0) > 0, action: () => openSection?.('events'), actionLabel: 'Add event' },
    { key: 'followers', label: 'Preview public profile', done: Boolean(organization?.id), action: openUserView, actionLabel: 'Preview' }
  ];
  const completeCount = checks.filter((check) => check.done).length;
  return (
    <section className="operator-section readiness-panel">
      <div className="operator-section-title">
        <div><p className="eyebrow">Launch readiness</p><h3>Make this masjid pitch-ready</h3></div>
        <span>{completeCount}/{checks.length}</span>
      </div>
      <p className="helper-text">Use this as the onboarding checklist before showing the dashboard to a real masjid. It focuses on what a masjid will immediately understand: profile, prayer times, announcements, events/classes, and followers.</p>
      <div className="readiness-list">
        {checks.map((check) => (
          <button key={check.key} type="button" className={check.done ? 'done' : ''} onClick={check.action}>
            <span>{check.done ? '✓' : '•'}</span>
            <strong>{check.label}</strong>
            <small>{check.done ? 'Ready' : check.actionLabel}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function AdminScreen({ user, users = [], threads = [], loadNetwork, loadMyOrganizations, myOrganizations = [], dashboardOrganizationsState = {}, createOrganization, onboardOrganization, updateOrganization, createOpportunity, updateOpportunity, createPost, updatePost, createEvent, updateEvent, deletePost, deleteEvent, updateApplication, bulkUpdateApplications, updateRegistration, bulkUpdateRegistrations, deleteOpportunity, addOrganizationPerson, inviteOrganizationPerson, removeOrganizationPerson, removeOrganizationFollower, openProfile, openOrganization, startMessage, setTab }) {
  const emptyOrgForm = { name: '', type: 'MASJID', city: '', address: '', website: '', email: '', phone: '', ownerEmail: '', description: '', facilities: '', imageUrl: '', heroImageUrl: '', donationUrl: '', instagramUrl: '', facebookUrl: '', latitude: '', longitude: '' };
  const [orgForm, setOrgForm] = useState(emptyOrgForm);
  const [postForm, setPostForm] = useState({ organizationId: '', type: 'ANNOUNCEMENT', title: '', content: '', imageUrl: '', location: '', eventTime: '' });
  const [announcementForm, setAnnouncementForm] = useState({ organizationId: '', category: 'GENERAL', title: '', content: '', imageUrl: '' });
  const [eventForm, setEventForm] = useState({ organizationId: '', title: '', description: '', location: '', imageUrl: '', startTime: '', capacity: '', requiresApproval: false });
  const [oppForm, setOppForm] = useState({ organizationId: '', type: 'VOLUNTEER', title: '', description: '', requirements: '', location: '', skills: '', hours: '', workType: 'volunteer', deadline: '', applicationQuestions: '' });
  const emptyClassForm = { organizationId: '', title: '', teacher: '', description: '', dayTime: '', location: '', imageUrl: '', notes: '', registrationLink: '' };
  const [classForm, setClassForm] = useState(emptyClassForm);
  const [peopleForm, setPeopleForm] = useState({ organizationId: '', userId: '', roleLabel: 'Imam' });
  const [inviteForm, setInviteForm] = useState({ organizationId: '', name: '', email: '', accountType: 'IMAM', roleLabel: 'Imam' });
  const [peopleQuery, setPeopleQuery] = useState('');
  const [editingOrgId, setEditingOrgId] = useState('');
  const [editOrgForm, setEditOrgForm] = useState({});
  const [editingPrayerOrgId, setEditingPrayerOrgId] = useState('');
  const [editPrayerForm, setEditPrayerForm] = useState(buildPrayerEditForm());
  const [newPrayerDraft, setNewPrayerDraft] = useState(emptyAdditionalPrayer);
  const [temporaryPrayerDraft, setTemporaryPrayerDraft] = useState(emptyTemporaryPrayer);
  const [editingPostId, setEditingPostId] = useState('');
  const [editPostForm, setEditPostForm] = useState({});
  const [editingEventId, setEditingEventId] = useState('');
  const [editEventForm, setEditEventForm] = useState({});
  const [editingClassKey, setEditingClassKey] = useState('');
  const [editClassForm, setEditClassForm] = useState({});
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [dashboardQuery, setDashboardQuery] = useState('');
  const [activeSection, setActiveSection] = useState('');
  const [adminCategory, setAdminCategory] = useState(user.accountType === 'ADMIN' ? 'platform' : 'masjid');
  const [adminUserQuery, setAdminUserQuery] = useState('');
  const [selectedAdminUserId, setSelectedAdminUserId] = useState('');
  const [adminWarnings, setAdminWarnings] = useState([]);
  const [onboardForm, setOnboardForm] = useState({ organizationId: '', ownerName: '', ownerEmail: '' });
  const query = dashboardQuery.trim().toLowerCase();
  const accountQuery = adminUserQuery.trim().toLowerCase();
  const peopleSearch = peopleQuery.trim().toLowerCase();
  const teamCandidates = users
    .filter((person) => person.id !== user.id)
    .filter((person) => !peopleSearch || `${person.name} ${person.email} ${person.accountType} ${person.city || ''} ${safeList(person.skills).join(' ')}`.toLowerCase().includes(peopleSearch))
    .slice(0, 40);
  const platformUsers = users
    .filter((person) => person.id !== user.id)
    .filter((person) => !accountQuery || `${person.name} ${person.email} ${person.accountType} ${person.city || ''} ${safeList(person.skills).join(' ')}`.toLowerCase().includes(accountQuery));
  const selectedAdminUser = users.find((person) => person.id === selectedAdminUserId) || platformUsers[0];
  const showSection = (section) => activeSection === section
    || (activeSection === 'eventApprovals' && section === 'events')
    || (activeSection === 'committee' && section === 'team');
  const showApplications = ['applications', 'volunteerApplications', 'jobApplications'].includes(activeSection);
  const applicationTypeFilter = activeSection === 'jobApplications' ? 'JOB' : activeSection === 'volunteerApplications' ? 'VOLUNTEER' : '';
  const scopedOrganizations = myOrganizations
    .filter((org) => !selectedOrgId || org.id === selectedOrgId)
    .filter((org) => {
      if (!query) return true;
      const searchable = [
        org.name,
        org.city,
        org.address,
        org.email,
        org.phone,
        ...(org.posts || []).map((post) => `${post.title} ${post.content} ${post.type}`),
        ...(org.events || []).map((event) => `${event.title} ${event.description || ''} ${event.location || ''}`),
        ...(org.classes || []).map((item) => `${item.title || ''} ${item.teacher || ''} ${item.description || ''} ${item.dayTime || ''} ${item.location || ''}`),
        ...(org.opportunities || []).map((opportunity) => `${opportunity.title} ${opportunity.description || ''} ${opportunity.type} ${opportunity.location || ''}`),
        ...(org.people || []).map((person) => `${person.user?.name || ''} ${person.roleLabel}`),
        ...(org.followers || []).map((follow) => follow.user?.name || '')
      ].join(' ').toLowerCase();
      return searchable.includes(query);
    });
  const pendingApplications = scopedOrganizations.flatMap((org) => (org.opportunities || []).flatMap((opportunity) => (opportunity.applications || []).filter((application) => application.status === 'PENDING').map((application) => ({ org, opportunity, application }))));
  const allApplications = scopedOrganizations.flatMap((org) => (org.opportunities || []).flatMap((opportunity) => (opportunity.applications || []).map((application) => ({ org, opportunity, application }))));
  const pendingRegistrations = scopedOrganizations.flatMap((org) => (org.events || []).flatMap((event) => (event.registrations || []).filter((registration) => registration.status === 'PENDING').map((registration) => ({ org, event, registration }))));
  const allFollowers = scopedOrganizations.flatMap((org) => (org.followers || []).map((follow) => ({ org, follow })));
  const adminStats = {
    users: users.filter((person) => person.accountType === 'USER').length,
    masjids: myOrganizations.filter((org) => ['MASJID', 'MSA'].includes(String(org.type).toUpperCase())).length,
    imams: users.filter((person) => ['IMAM', 'STUDENT_OF_KNOWLEDGE'].includes(person.accountType)).length,
    businesses: users.filter((person) => person.accountType === 'BUSINESS').length,
    posts: myOrganizations.reduce((sum, org) => sum + (org.posts || []).length, 0),
    opportunities: myOrganizations.reduce((sum, org) => sum + (org.opportunities || []).length, 0),
    reports: 0
  };
  const metrics = {
    followers: scopedOrganizations.reduce((sum, org) => sum + (org.followerCount || 0), 0),
    posts: scopedOrganizations.reduce((sum, org) => sum + (org.posts || []).length, 0),
    events: scopedOrganizations.reduce((sum, org) => sum + (org.events || []).length, 0),
    programs: scopedOrganizations.reduce((sum, org) => sum + (org.classes || []).length, 0),
    pendingApplications: pendingApplications.length,
    pendingRegistrations: pendingRegistrations.length,
    applications: allApplications.length,
    jobs: scopedOrganizations.reduce((sum, org) => sum + (org.opportunities || []).filter((item) => item.type === 'JOB').length, 0),
    volunteers: scopedOrganizations.reduce((sum, org) => sum + (org.opportunities || []).filter((item) => item.type !== 'JOB').length, 0)
  };
  const selectedOrg = myOrganizations.find((org) => org.id === selectedOrgId) || scopedOrganizations[0] || myOrganizations[0];
  const onboardingOrg = myOrganizations.find((org) => org.id === onboardForm.organizationId) || myOrganizations.find((org) => !org.verified) || myOrganizations[0];
  const unverifiedOrganizations = myOrganizations.filter((org) => !org.verified);
  const selectedOrgEvents = selectedOrg?.events || [];
  const selectedOrgApplications = (selectedOrg?.opportunities || []).flatMap((opportunity) => (opportunity.applications || []).map((application) => ({ opportunity, application })));
  const selectedOrgPendingApplications = selectedOrgApplications.filter(({ application }) => application.status === 'PENDING').length;
  const upcomingEvents = selectedOrgEvents.filter((event) => {
    const time = new Date(event.startTime || event.time || 0).getTime();
    return Number.isFinite(time) && time >= Date.now();
  }).length;
  const unreadMessages = (threads || []).reduce((sum, thread) => sum + (thread.unread || 0), 0);
  function openDashboardSection(section) {
    setEditingOrgId('');
    setEditOrgForm({});
    setEditingPrayerOrgId('');
    setEditPrayerForm(buildPrayerEditForm());
    cancelContentEdits();
    setActiveSection(section);
  }
  function openAnnouncementComposer() {
    setPostForm((current) => ({ ...current, type: 'ANNOUNCEMENT', title: current.title || '', content: current.content || '' }));
    openDashboardSection('posts');
  }
  function closeDashboardSection() {
    setEditingOrgId('');
    setEditOrgForm({});
    setEditingPrayerOrgId('');
    setEditPrayerForm(buildPrayerEditForm());
    cancelContentEdits();
    setActiveSection('');
  }
  const hubItems = [
    { key: 'followers', label: 'Followers', count: metrics.followers, detail: 'Community reach', icon: Users },
    { key: 'following', label: 'Following', count: 'Soon', detail: 'Not connected', icon: UserCheck },
    { key: 'team', label: 'Team', count: scopedOrganizations.reduce((sum, org) => sum + (org.people || []).length, 0), detail: 'Imams and staff', icon: UserCheck },
    { key: 'announcements', label: 'Masjid Announcements', count: metrics.posts, detail: 'Social feed posts', icon: MessageCircle },
    { key: 'posts', label: 'Posts', count: metrics.posts, detail: 'All post tools', icon: MessageCircle },
    { key: 'events', label: 'Events', count: metrics.events, detail: `${upcomingEvents} upcoming`, icon: CalendarDays },
    { key: 'eventApprovals', label: 'Event Approvals', count: metrics.pendingRegistrations, detail: 'Pending entries', icon: CheckCircle2 },
    { key: 'programs', label: 'Programs / Classes', count: metrics.programs, detail: 'Classes and halaqas', icon: Library },
    { key: 'jobs', label: 'Jobs', count: metrics.jobs, detail: 'Opportunities', icon: Briefcase },
    { key: 'jobApplications', label: 'Job Applications', count: allApplications.filter(({ opportunity }) => opportunity.type === 'JOB').length, detail: 'Hiring pipeline', icon: Mail },
    { key: 'volunteers', label: 'Volunteers', count: metrics.volunteers, detail: 'Service posts', icon: HeartHandshake },
    { key: 'volunteerApplications', label: 'Volunteer Applications', count: allApplications.filter(({ opportunity }) => opportunity.type !== 'JOB').length, detail: 'Service requests', icon: Users },
    { key: 'attention', label: 'Notifications', count: pendingApplications.length + pendingRegistrations.length + unreadMessages, detail: `${unreadMessages} unread DMs`, icon: Bell },
    { key: 'prayerTimes', label: 'Prayer Times', count: 'Jamaat', detail: selectedOrg?.prayerNotes || 'Iqamah schedule', icon: ShieldCheck },
    { key: 'applications', label: 'Application Portal', count: metrics.applications, detail: 'All applicants', icon: Building2 },
    { key: 'committee', label: 'Jamaat / Committee', count: scopedOrganizations.reduce((sum, org) => sum + (org.people || []).length, 0), detail: 'Leadership', icon: Users },
    { key: 'userView', label: 'Preview User View', count: selectedOrg ? 'Open' : 'Add profile', detail: 'Public profile', icon: Home }
  ];
  const snapshotItems = [
    { label: 'Followers', value: selectedOrg?.followerCount || metrics.followers, tone: 'calm' },
    { label: 'New applications', value: selectedOrgPendingApplications || metrics.pendingApplications, tone: metrics.pendingApplications ? 'urgent' : 'calm' },
    { label: 'Unread messages', value: unreadMessages, tone: unreadMessages ? 'urgent' : 'calm' }
  ];
  const quickActions = [
    { label: 'New Event', icon: CalendarDays, action: () => openDashboardSection('events'), primary: true },
    { label: 'New Post', icon: Plus, action: () => openDashboardSection('posts') },
    { label: 'New Program', icon: Library, action: () => openDashboardSection('programs') },
    { label: 'Prayer Times', icon: ShieldCheck, action: () => openDashboardSection('prayerTimes') },
    { label: 'Announcement', icon: Send, action: openAnnouncementComposer }
  ];
  const communityPublishingItems = [
    { key: 'prayerTimes', label: 'Prayer times', detail: 'Public profile + jamaat update notification', icon: ShieldCheck },
    { key: 'events', label: 'Events', detail: 'Events discovery + follower notification', icon: CalendarDays },
    { key: 'programs', label: 'Programs', detail: 'Masjid profile + program notification', icon: Library },
    { key: 'posts', label: 'Posts', detail: 'Home feed + announcement notification', icon: MessageCircle },
    { key: 'jobs', label: 'Opportunities', detail: 'Jobs/volunteer pages + user alerts', icon: Briefcase }
  ];
  const attentionItems = [
    { key: 'messages', label: 'Messages', count: unreadMessages, icon: Mail, action: () => setTab?.('messages') },
    { key: 'volunteerApplications', label: 'Volunteer Applications', count: allApplications.filter(({ opportunity }) => opportunity.type !== 'JOB').length, icon: HeartHandshake, action: () => openDashboardSection('volunteerApplications') },
    { key: 'jobApplications', label: 'Job Applications', count: allApplications.filter(({ opportunity }) => opportunity.type === 'JOB').length, icon: Briefcase, action: () => openDashboardSection('jobApplications') },
    { key: 'eventApprovals', label: 'Event Pending Approval', count: metrics.pendingRegistrations, icon: CheckCircle2, action: () => openDashboardSection('eventApprovals') }
  ];
  const inboxPreviewThreads = [...(threads || [])]
    .sort((a, b) => Number(Boolean(b.unread)) - Number(Boolean(a.unread)) || new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0))
    .slice(0, 3);
  const managementItems = [
    { key: 'events', label: 'Events', icon: CalendarDays },
    { key: 'programs', label: 'Programs', icon: Library },
    { key: 'announcements', label: 'Announcements', icon: MessageCircle },
    { key: 'posts', label: 'Posts', icon: MessageCircle },
    { key: 'prayerTimes', label: 'Prayer Times', icon: ShieldCheck },
    { key: 'team', label: 'Team', icon: UserCheck },
    { key: 'volunteers', label: 'Volunteers', icon: HeartHandshake },
    { key: 'jobs', label: 'Jobs', icon: Briefcase }
  ];
  const analyticsItems = [
    { key: 'followers', label: 'Followers', value: metrics.followers, icon: Users },
    { key: 'eventApprovals', label: 'Registrations', value: pendingRegistrations.length, icon: CheckCircle2 },
    { key: 'events', label: 'Attendance', value: selectedOrgEvents.reduce((sum, event) => sum + (event.registrations || []).filter((registration) => registration.status === 'ATTENDED').length, 0), icon: BarChart3 },
    { key: 'posts', label: 'Engagement', value: metrics.posts, icon: Bell }
  ];
  const activeDashboardFeature = hubItems.find((item) => item.key === activeSection);
  const orgPanelSections = new Set(['followers', 'announcements', 'posts', 'events', 'eventApprovals', 'programs', 'team', 'committee', 'prayerTimes', 'applications', 'jobApplications', 'volunteerApplications', 'volunteers', 'jobs']);
  const showOrgPanels = orgPanelSections.has(activeSection);
  const showProfileTools = activeSection === 'prayerTimes';
  function openUserView() {
    if (!selectedOrg?.id) return alert('Create or select a masjid profile first.');
    openOrganization(selectedOrg.id).catch(console.error);
  }
  async function deleteUser(id) {
    if (!confirm('Delete this user and their messages/events?')) return;
    await api(`/api/users/${id}`, { method: 'DELETE' });
    await loadNetwork();
  }
  async function updateRole(id, accountType) {
    await api(`/api/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ accountType }) });
    await Promise.all([loadNetwork(), loadMyOrganizations()]);
  }
  async function resetUserPassword(person) {
    if (!person?.id) return;
    if (!confirm(`Generate a password reset link for ${person.email}?`)) return;
    const result = await api(`/api/users/${person.id}/password-reset`, { method: 'POST' });
    if (result.resetLink) {
      await navigator.clipboard?.writeText(result.resetLink).catch(() => {});
      alert(`Password reset link generated${navigator.clipboard ? ' and copied to clipboard' : ''}:\n${result.resetLink}`);
    } else {
      alert(result.message || 'Password reset generated.');
    }
  }
  async function warnUser(person) {
    if (!person?.id) return;
    const reason = prompt(`Warning reason for ${person.name}?`, 'Community guideline warning');
    if (!reason) return;
    const note = prompt('Optional internal note', '') || '';
    await api(`/api/users/${person.id}/warnings`, { method: 'POST', body: JSON.stringify({ reason, note }) });
    await Promise.all([loadNetwork(), loadWarnings(person.id)]);
  }
  async function loadWarnings(id = selectedAdminUser?.id) {
    if (!id) return;
    const warnings = await api(`/api/users/${id}/warnings`).catch(() => []);
    setAdminWarnings(warnings);
    setSelectedAdminUserId(id);
  }
  async function submitOrg(event) {
    event.preventDefault();
    const created = await createOrganization(orgForm);
    if (created?.temporaryPassword) alert(`Masjid login created for ${orgForm.ownerEmail}. Temporary password: ${created.temporaryPassword}`);
    setOrgForm(emptyOrgForm);
  }
  async function submitOnboard(event) {
    event.preventDefault();
    const organizationId = onboardForm.organizationId || onboardingOrg?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    if (!onboardForm.ownerEmail.trim()) return alert('Masjid admin login email is required.');
    const result = await onboardOrganization(organizationId, onboardForm);
    if (result?.temporaryPassword) alert(`Masjid account created for ${onboardForm.ownerEmail}. Temporary password: ${result.temporaryPassword}`);
    else alert(`Masjid account connected for ${onboardForm.ownerEmail}.`);
    setOnboardForm({ organizationId: '', ownerName: '', ownerEmail: '' });
  }
  async function submitOpp(event) {
    event.preventDefault();
    const organizationId = oppForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    await createOpportunity(organizationId, oppForm);
    setOppForm({ organizationId, type: 'VOLUNTEER', title: '', description: '', requirements: '', location: '', skills: '', hours: '', workType: 'volunteer', deadline: '', applicationQuestions: '' });
  }
  function resetPostComposer(organizationId, type = postForm.type) {
    setPostForm({ organizationId, type, title: '', content: '', imageUrl: '', location: '', eventTime: '' });
  }
  function postDestination(type = postForm.type) {
    const upperType = String(type || '').toUpperCase();
    if (upperType === 'EVENT') return 'Events';
    if (upperType === 'CLASS') return 'Programs';
    if (upperType === 'VOLUNTEER') return 'Volunteers';
    if (upperType === 'JOB') return 'Jobs';
    return 'Home feed';
  }
  function postSubmitLabel(type = postForm.type) {
    const upperType = String(type || '').toUpperCase();
    if (upperType === 'EVENT') return 'Post event';
    if (upperType === 'CLASS') return 'Publish program';
    if (upperType === 'VOLUNTEER') return 'Post volunteer role';
    if (upperType === 'JOB') return 'Post job';
    if (upperType === 'ANNOUNCEMENT') return 'Send announcement';
    return 'Publish to home';
  }
  async function submitAnnouncement(event) {
    event.preventDefault();
    const organizationId = announcementForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    if (!announcementForm.title.trim() || !announcementForm.content.trim()) return alert('Title and announcement content are required.');
    const category = masjidAnnouncementTypes.find((item) => item.value === announcementForm.category) || masjidAnnouncementTypes[0];
    await createPost(organizationId, {
      type: category.postType,
      title: `${category.label}: ${announcementForm.title.trim()}`,
      content: announcementForm.content.trim(),
      imageUrl: announcementForm.imageUrl.trim(),
      location: '',
      eventTime: ''
    });
    setAnnouncementForm({ organizationId, category: 'GENERAL', title: '', content: '', imageUrl: '' });
    openDashboardSection('announcements');
  }
  async function submitPost(event) {
    event.preventDefault();
    const organizationId = postForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    const type = String(postForm.type || 'ANNOUNCEMENT').toUpperCase();
    if (type === 'EVENT') {
      if (!postForm.eventTime) return alert('Event date and time are required.');
      await createEvent({
        organizationId,
        title: postForm.title,
        description: postForm.content,
        location: postForm.location,
        imageUrl: postForm.imageUrl,
        startTime: postForm.eventTime,
        capacity: '',
        requiresApproval: false
      });
      resetPostComposer(organizationId, 'EVENT');
      openDashboardSection('events');
      return;
    }
    if (type === 'CLASS') {
      if (!postForm.title.trim()) return alert('Program title is required.');
      const org = myOrganizations.find((item) => item.id === organizationId);
      const nextClass = {
        id: `class-${Date.now()}`,
        title: postForm.title.trim(),
        teacher: '',
        description: postForm.content.trim(),
        dayTime: postForm.eventTime ? new Date(postForm.eventTime).toLocaleString() : '',
        location: postForm.location.trim(),
        imageUrl: postForm.imageUrl.trim(),
        notes: '',
        registrationLink: ''
      };
      await updateOrganization(organizationId, { classes: [...(org?.classes || []), nextClass] });
      resetPostComposer(organizationId, 'CLASS');
      openDashboardSection('programs');
      return;
    }
    if (['VOLUNTEER', 'JOB'].includes(type)) {
      await createOpportunity(organizationId, {
        type,
        title: postForm.title,
        description: postForm.content,
        requirements: '',
        location: postForm.location,
        skills: '',
        hours: '',
        workType: type === 'JOB' ? 'part-time' : 'volunteer',
        deadline: '',
        applicationQuestions: ''
      });
      resetPostComposer(organizationId, type);
      openDashboardSection(type === 'JOB' ? 'jobs' : 'volunteers');
      return;
    }
    await createPost(organizationId, { ...postForm, type });
    resetPostComposer(organizationId, type);
  }
  async function submitEvent(event) {
    event.preventDefault();
    const organizationId = eventForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    await createEvent({ ...eventForm, organizationId });
    setEventForm({ organizationId, title: '', description: '', location: '', imageUrl: '', startTime: '', capacity: '', requiresApproval: false });
    openDashboardSection('events');
  }
  async function submitClass(event) {
    event.preventDefault();
    const organizationId = classForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId) return alert('Create or select a masjid first.');
    if (!classForm.title.trim()) return alert('Class title is required.');
    const org = myOrganizations.find((item) => item.id === organizationId);
    const nextClass = {
      id: `class-${Date.now()}`,
      title: classForm.title.trim(),
      teacher: classForm.teacher.trim(),
      description: classForm.description.trim(),
      dayTime: classForm.dayTime.trim(),
      location: classForm.location.trim(),
      imageUrl: classForm.imageUrl.trim(),
      notes: classForm.notes.trim(),
      registrationLink: classForm.registrationLink.trim()
    };
    await updateOrganization(organizationId, { classes: [...(org?.classes || []), nextClass] });
    setClassForm({ ...emptyClassForm, organizationId });
    openDashboardSection('programs');
  }
  async function submitPerson(event) {
    event.preventDefault();
    const organizationId = peopleForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId || !peopleForm.userId) return alert('Select a masjid and person first.');
    await addOrganizationPerson(organizationId, { userId: peopleForm.userId, roleLabel: peopleForm.roleLabel });
    setPeopleForm({ organizationId, userId: '', roleLabel: 'Imam' });
  }
  async function submitInvite(event) {
    event.preventDefault();
    const organizationId = inviteForm.organizationId || myOrganizations[0]?.id;
    if (!organizationId || !inviteForm.email.trim()) return alert('Select a masjid and enter an email first.');
    const invited = await inviteOrganizationPerson(organizationId, inviteForm);
    if (invited?.temporaryPassword) alert(`Login created for ${inviteForm.email}. Temporary password: ${invited.temporaryPassword}`);
    setInviteForm({ organizationId, name: '', email: '', accountType: 'IMAM', roleLabel: 'Imam' });
    openDashboardSection('team');
  }
  async function quickAddTeam(organizationId, person, roleLabel = 'Team member') {
    if (!person?.id) return;
    const nextRole = prompt('Team role?', roleLabel);
    if (!nextRole) return;
    await addOrganizationPerson(organizationId, { userId: person.id, roleLabel: nextRole });
    openDashboardSection('team');
  }
  async function approveApplication(opportunityId, applicationId) {
    const approvedHours = Number(prompt('Approved volunteer hours?', '0') || 0);
    await updateApplication(opportunityId, applicationId, { status: 'APPROVED', approvedHours });
  }
  async function approvePendingApplications(opportunityId) {
    const approvedHours = Number(prompt('Approved hours for each pending applicant?', '0') || 0);
    await bulkUpdateApplications(opportunityId, { status: 'APPROVED', fromStatus: 'PENDING', approvedHours });
  }
  async function moveApplication(opportunityId, applicationId, status) {
    await updateApplication(opportunityId, applicationId, { status });
  }
  function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : 'Not recorded';
  }
  function toDateTimeInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }
  function contentEditKey(orgId, item, index) {
    return `${orgId}:${item.id || index}`;
  }
  function cancelContentEdits() {
    setEditingPostId('');
    setEditPostForm({});
    setEditingEventId('');
    setEditEventForm({});
    setEditingClassKey('');
    setEditClassForm({});
  }
  function eventAttendanceStats(eventItem) {
    const registrations = eventItem.registrations || [];
    const checkedIn = registrations.filter((registration) => registration.status === 'ATTENDED').length;
    const noShow = registrations.filter((registration) => registration.status === 'NO_SHOW').length;
    const pending = registrations.filter((registration) => registration.status === 'PENDING').length;
    const approved = registrations.filter((registration) => registration.status === 'APPROVED').length;
    const denied = registrations.filter((registration) => registration.status === 'DENIED').length;
    return {
      registered: registrations.length - denied,
      checkedIn,
      noShow,
      pending,
      approved,
      denied
    };
  }
  function startEditPost(post) {
    setEditingPostId(post.id);
    setEditPostForm({
      type: post.type || 'ANNOUNCEMENT',
      title: post.title || '',
      content: post.content || '',
      imageUrl: post.imageUrl || '',
      location: post.location || '',
      eventTime: toDateTimeInput(post.eventTime)
    });
  }
  async function submitEditPost(event, post) {
    event.preventDefault();
    await updatePost(post.id, editPostForm);
    setEditingPostId('');
    setEditPostForm({});
  }
  function startEditEvent(eventItem) {
    setEditingEventId(eventItem.id);
    setEditEventForm({
      title: eventItem.title || '',
      description: eventItem.description || '',
      location: eventItem.location || '',
      imageUrl: eventItem.imageUrl || '',
      startTime: toDateTimeInput(eventItem.startTime),
      endTime: toDateTimeInput(eventItem.endTime),
      capacity: eventItem.capacity ?? '',
      requiresApproval: Boolean(eventItem.requiresApproval)
    });
  }
  async function submitEditEvent(event, eventItem) {
    event.preventDefault();
    await updateEvent(eventItem.id, editEventForm);
    setEditingEventId('');
    setEditEventForm({});
  }
  async function editOpportunity(opportunity) {
    const title = prompt('Title', opportunity.title || '');
    if (title === null) return;
    const description = prompt('Description', opportunity.description || '');
    if (description === null) return;
    const location = prompt('Location', opportunity.location || '');
    if (location === null) return;
    const skills = prompt('Skills, comma separated', (opportunity.skills || []).join(', '));
    if (skills === null) return;
    const hours = prompt('Hours', opportunity.hours || '');
    if (hours === null) return;
    await updateOpportunity(opportunity.id, { title, description, location, skills, hours });
  }
  function startEditClass(org, classItem, classIndex) {
    setEditingClassKey(contentEditKey(org.id, classItem, classIndex));
    setEditClassForm({
      title: classItem.title || '',
      teacher: classItem.teacher || '',
      dayTime: classItem.dayTime || '',
      location: classItem.location || '',
      imageUrl: classItem.imageUrl || '',
      registrationLink: classItem.registrationLink || '',
      description: classItem.description || '',
      notes: classItem.notes || ''
    });
  }
  async function submitEditClass(event, org, classItem, classIndex) {
    event.preventDefault();
    if (!editClassForm.title?.trim()) return alert('Class title is required.');
    const classes = (org.classes || []).map((item, index) => (classItem.id ? item.id === classItem.id : index === classIndex) ? {
      ...item,
      title: editClassForm.title.trim(),
      teacher: (editClassForm.teacher || '').trim(),
      dayTime: (editClassForm.dayTime || '').trim(),
      location: (editClassForm.location || '').trim(),
      imageUrl: (editClassForm.imageUrl || '').trim(),
      registrationLink: (editClassForm.registrationLink || '').trim(),
      description: (editClassForm.description || '').trim(),
      notes: (editClassForm.notes || '').trim()
    } : item);
    await updateOrganization(org.id, { classes });
    setEditingClassKey('');
    setEditClassForm({});
  }
  async function deleteClass(org, classItem, classIndex) {
    if (!confirm('Delete this class or program?')) return;
    await updateOrganization(org.id, { classes: (org.classes || []).filter((item, index) => classItem.id ? item.id !== classItem.id : index !== classIndex) });
  }
  function startEditOrg(org) {
    setEditingOrgId(org.id);
    setEditOrgForm({
      name: org.name || '',
      type: org.type || 'MASJID',
      city: org.city || '',
      address: org.address || '',
      website: org.website || '',
      email: org.email || '',
      phone: org.phone || '',
      description: org.description || '',
      facilities: org.facilities || '',
      imageUrl: org.imageUrl || '',
      heroImageUrl: org.heroImageUrl || '',
      donationUrl: org.donationUrl || '',
      instagramUrl: org.instagramUrl || '',
      facebookUrl: org.facebookUrl || '',
      latitude: org.latitude || '',
      longitude: org.longitude || ''
    });
  }
  async function submitEditOrg(event) {
    event.preventDefault();
    await updateOrganization(editingOrgId, editOrgForm);
    setEditingOrgId('');
    setEditOrgForm({});
  }
  function startEditPrayers(org) {
    setEditingPrayerOrgId(org.id);
    setEditPrayerForm(buildPrayerEditForm(org));
    setNewPrayerDraft(emptyAdditionalPrayer);
    setTemporaryPrayerDraft(emptyTemporaryPrayer);
  }
  function updatePrayerRow(kind, index, field, value) {
    setEditPrayerForm((current) => ({
      ...current,
      [kind]: (current[kind] || []).map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row)
    }));
  }
  function removePrayerRow(kind, index) {
    setEditPrayerForm((current) => ({
      ...current,
      [kind]: (current[kind] || []).filter((_, rowIndex) => rowIndex !== index)
    }));
  }
  function addAdditionalPrayer() {
    if (!newPrayerDraft.name.trim()) return alert('Prayer name is required.');
    setEditPrayerForm((current) => ({
      ...current,
      additionalPrayers: [...(current.additionalPrayers || []), { ...newPrayerDraft, id: `custom-${Date.now()}` }]
    }));
    setNewPrayerDraft(emptyAdditionalPrayer);
  }
  function addTemporaryPrayer() {
    if (!temporaryPrayerDraft.name.trim()) return alert('Temporary prayer name is required.');
    setEditPrayerForm((current) => ({
      ...current,
      temporaryPrayers: [...(current.temporaryPrayers || []), { ...temporaryPrayerDraft, id: `temp-${Date.now()}` }]
    }));
    setTemporaryPrayerDraft(emptyTemporaryPrayer);
  }
  async function submitEditPrayers(event, org) {
    event.preventDefault();
    const prayerTimes = standardPrayerKeys.reduce((times, key) => ({ ...times, [key]: editPrayerForm[`${key}Jamat`] || '' }), {});
    const iqamahTimes = {
      ...(org.iqamahTimes || {}),
      notes: editPrayerForm.prayerNotes || '',
      additionalPrayers: cleanPrayerRows(editPrayerForm.additionalPrayers || []),
      temporaryPrayers: cleanPrayerRows(editPrayerForm.temporaryPrayers || [], true)
    };
    await updateOrganization(org.id, { prayerTimes, iqamahTimes, prayerNotes: editPrayerForm.prayerNotes || '' });
    setEditingPrayerOrgId('');
    setEditPrayerForm(buildPrayerEditForm());
  }
  return (
    <Page>
      {user.accountType === 'ADMIN' && (
        <section className="panel admin-category-panel">
          <div className="section-title">
            <div><p className="eyebrow">Admin mode</p><h2>{adminCategory === 'platform' ? 'Platform Admin' : 'Masjid Admin'}</h2></div>
            <span>{adminCategory === 'platform' ? `${platformUsers.length} accounts` : `${scopedOrganizations.length} masjids`}</span>
          </div>
          <div className="segmented-control admin-mode-switch">
            <button type="button" className={adminCategory === 'masjid' ? 'active' : ''} onClick={() => setAdminCategory('masjid')}>Masjid Admin</button>
            <button type="button" className={adminCategory === 'platform' ? 'active' : ''} onClick={() => setAdminCategory('platform')}>Platform Admin</button>
          </div>
        </section>
      )}
      {user.accountType === 'ADMIN' && adminCategory === 'platform' && (
        <div className="content-grid platform-admin-grid">
          <section className="feed-column">
            <section className="panel platform-admin-panel">
              <div className="section-title">
                <div><p className="eyebrow">Masjid onboarding</p><h2>Create and Claim Masjids</h2></div>
                <span>{unverifiedOrganizations.length} unverified</span>
              </div>
              <div className="metric-grid compact">
                <article className="metric-card"><span>Total masjids</span><strong>{myOrganizations.length}</strong><em>Profiles in discovery</em></article>
                <article className="metric-card"><span>Unverified</span><strong>{unverifiedOrganizations.length}</strong><em>Need operator account</em></article>
                <article className="metric-card"><span>Verified</span><strong>{myOrganizations.length - unverifiedOrganizations.length}</strong><em>Onboarded accounts</em></article>
              </div>
              <form className="profile-form onboarding-form" onSubmit={submitOnboard}>
                <div className="form-grid">
                  <select value={onboardForm.organizationId || onboardingOrg?.id || ''} onChange={(event) => setOnboardForm({ ...onboardForm, organizationId: event.target.value })}>
                    <option value="">Select masjid to onboard</option>
                    {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name} - {org.verified ? 'verified' : 'unverified'}</option>)}
                  </select>
                  <input placeholder="Masjid admin name" value={onboardForm.ownerName} onChange={(event) => setOnboardForm({ ...onboardForm, ownerName: event.target.value })} />
                  <input required placeholder="Masjid admin login email" value={onboardForm.ownerEmail} onChange={(event) => setOnboardForm({ ...onboardForm, ownerEmail: event.target.value })} />
                </div>
                <p className="helper-text">This creates or upgrades a MASJID/MSA account, attaches it as owner of the selected masjid, and marks the profile verified. Use this for Imam Bukhari Centre after selecting it above.</p>
                <button className="primary-button">Create masjid account and verify</button>
              </form>
              <div className="stack-list onboarding-list">
                {unverifiedOrganizations.slice(0, 8).map((org) => (
                  <article className="mini-row" key={org.id}>
                    <strong>{org.name}</strong>
                    <span>{org.address || org.city || 'No address saved'}</span>
                    <TagRow tags={[org.type || 'MASJID', 'Unverified', org.ownerId ? 'Owner linked' : 'No operator account'].filter(Boolean)} />
                    <div className="manager-row">
                      <button type="button" onClick={() => setOnboardForm({ organizationId: org.id, ownerName: `${org.name} Admin`, ownerEmail: org.email || '' })}>Onboard</button>
                      <button type="button" onClick={() => openOrganization(org.id)}>Preview</button>
                    </div>
                  </article>
                ))}
                {!unverifiedOrganizations.length && <p className="helper-text">All visible masjids are onboarded.</p>}
              </div>
            </section>
            <section className="panel">
              <div className="section-title"><h2>Add New Masjid Manually</h2><span>Starts unverified</span></div>
              <form className="profile-form" onSubmit={submitOrg}>
                <div className="form-grid">
                  <input required placeholder="Masjid name" value={orgForm.name} onChange={(event) => setOrgForm({ ...orgForm, name: event.target.value })} />
                  <select value={orgForm.type} onChange={(event) => setOrgForm({ ...orgForm, type: event.target.value })}><option value="MASJID">Masjid</option><option value="MSA">MSA</option></select>
                  <input placeholder="City" value={orgForm.city} onChange={(event) => setOrgForm({ ...orgForm, city: event.target.value })} />
                  <input placeholder="Address" value={orgForm.address} onChange={(event) => setOrgForm({ ...orgForm, address: event.target.value })} />
                  <input placeholder="Website" value={orgForm.website} onChange={(event) => setOrgForm({ ...orgForm, website: event.target.value })} />
                  <input placeholder="Public email" value={orgForm.email} onChange={(event) => setOrgForm({ ...orgForm, email: event.target.value })} />
                  <input placeholder="Phone" value={orgForm.phone} onChange={(event) => setOrgForm({ ...orgForm, phone: event.target.value })} />
                  <input placeholder="Optional operator email to onboard now" value={orgForm.ownerEmail} onChange={(event) => setOrgForm({ ...orgForm, ownerEmail: event.target.value })} />
                  <input placeholder="Logo image URL" value={orgForm.imageUrl} onChange={(event) => setOrgForm({ ...orgForm, imageUrl: event.target.value })} />
                  <input placeholder="Hero image URL" value={orgForm.heroImageUrl} onChange={(event) => setOrgForm({ ...orgForm, heroImageUrl: event.target.value })} />
                  <input placeholder="Donation URL" value={orgForm.donationUrl} onChange={(event) => setOrgForm({ ...orgForm, donationUrl: event.target.value })} />
                  <input placeholder="Instagram URL" value={orgForm.instagramUrl} onChange={(event) => setOrgForm({ ...orgForm, instagramUrl: event.target.value })} />
                  <input placeholder="Facebook URL" value={orgForm.facebookUrl} onChange={(event) => setOrgForm({ ...orgForm, facebookUrl: event.target.value })} />
                  <input placeholder="Latitude" value={orgForm.latitude} onChange={(event) => setOrgForm({ ...orgForm, latitude: event.target.value })} />
                  <input placeholder="Longitude" value={orgForm.longitude} onChange={(event) => setOrgForm({ ...orgForm, longitude: event.target.value })} />
                </div>
                <textarea placeholder="Description" value={orgForm.description} onChange={(event) => setOrgForm({ ...orgForm, description: event.target.value })} />
                <textarea placeholder="Facilities, programs, parking, accessibility notes" value={orgForm.facilities} onChange={(event) => setOrgForm({ ...orgForm, facilities: event.target.value })} />
                <p className="helper-text">Leave operator email blank to create a discovery profile only. Add the operator email now to create the masjid login and verify immediately.</p>
                <button className="primary-button">Create masjid profile</button>
              </form>
            </section>
            <section className="panel platform-admin-panel">
              <div className="section-title"><div><p className="eyebrow">Admin admin</p><h2>Account Management</h2></div><span>{platformUsers.length}</span></div>
              <div className="filter-panel">
                <label><Search size={15} /><input placeholder="Search accounts by name, email, role, city, skills" value={adminUserQuery} onChange={(event) => setAdminUserQuery(event.target.value)} /></label>
              </div>
              <div className="metric-grid compact">
                <article className="metric-card"><span>Total accounts</span><strong>{users.length}</strong><em>All registered users</em></article>
                <article className="metric-card"><span>Users</span><strong>{adminStats.users}</strong><em>Community accounts</em></article>
                <article className="metric-card"><span>Masjid/MSA</span><strong>{users.filter((person) => ['MASJID', 'MSA'].includes(person.accountType)).length}</strong><em>Operator accounts</em></article>
                <article className="metric-card"><span>Warnings</span><strong>{users.reduce((sum, person) => sum + Number(person.warningCount || 0), 0)}</strong><em>Issued records</em></article>
              </div>
              <div className="stack-list account-admin-list">
                {platformUsers.map((person) => (
                  <article className="mini-row account-admin-row" key={person.id}>
                    <div>
                      <strong>{person.name}</strong>
                      <span>{person.email}</span>
                      <TagRow tags={[person.accountType, person.city || person.location, person.warningCount ? `${person.warningCount} warnings` : 'No warnings'].filter(Boolean)} />
                    </div>
                    <select value={person.accountType} onChange={(event) => updateRole(person.id, event.target.value)} aria-label={`Change role for ${person.name}`}>
                      {['USER', 'MASJID', 'MSA', 'IMAM', 'STUDENT_OF_KNOWLEDGE', 'BUSINESS', 'ADMIN'].map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <div className="manager-row">
                      <button onClick={() => openProfile(person)}>Profile</button>
                      <button onClick={() => startMessage(person)}>Message</button>
                      <button onClick={() => resetUserPassword(person)}>Reset password</button>
                      <button onClick={() => warnUser(person)}>Give warning</button>
                      <button onClick={() => loadWarnings(person.id)}>View warnings</button>
                      <button className="secondary-button danger" onClick={() => deleteUser(person.id)}>Delete account</button>
                    </div>
                  </article>
                ))}
                {!platformUsers.length && <p className="helper-text">No accounts match that search.</p>}
              </div>
            </section>
          </section>
          <aside className="right-rail">
            <section className="panel">
              <div className="section-title"><h2>Selected Account</h2><span>{selectedAdminUser?.accountType || 'None'}</span></div>
              {selectedAdminUser ? (
                <div className="stack-list">
                  <article className="mini-row">
                    <strong>{selectedAdminUser.name}</strong>
                    <span>{selectedAdminUser.email}</span>
                    <p>{selectedAdminUser.city || selectedAdminUser.location || 'No location saved'}</p>
                    <div className="manager-row">
                      <button onClick={() => openProfile(selectedAdminUser)}>Open profile</button>
                      <button onClick={() => resetUserPassword(selectedAdminUser)}>Reset password</button>
                      <button onClick={() => warnUser(selectedAdminUser)}>Give warning</button>
                    </div>
                  </article>
                  <div className="section-title compact-title"><h3>Warnings</h3><button type="button" onClick={() => loadWarnings(selectedAdminUser.id)}>Refresh</button></div>
                  {adminWarnings.map((warning) => (
                    <article className="mini-row" key={warning.id}>
                      <strong>{warning.reason}</strong>
                      <span>{new Date(warning.createdAt).toLocaleString()} by {warning.issuer?.name || 'Admin'}</span>
                      {warning.note && <p>{warning.note}</p>}
                    </article>
                  ))}
                  {!adminWarnings.length && <p className="helper-text">Select View warnings to load warning history.</p>}
                </div>
              ) : <p className="helper-text">Search and select an account.</p>}
            </section>
          </aside>
        </div>
      )}
      {adminCategory !== 'platform' && (
      <div className="content-grid masjid-dashboard-grid">
        <section className="feed-column masjid-dashboard-main">
          <section className="panel masjid-hub">
            <div className="masjid-operator-head">
              <div className="org-logo hub-logo">
                <ResilientImage src={selectedOrg?.imageUrl} alt="" fallback={initials(selectedOrg?.name || user.name)} />
              </div>
              <div>
                <span>Assalamu Alaikum</span>
                <h2>{selectedOrg?.name || user.name}</h2>
                <p>{selectedOrg?.address || selectedOrg?.city || 'Select a masjid to manage daily operations.'}</p>
              </div>
            </div>
            <div className="form-grid">
              <select value={selectedOrgId} onChange={(event) => setSelectedOrgId(event.target.value)}>
                <option value="">All managed masjids/MSAs</option>
                {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
              </select>
              <input placeholder="Search posts, volunteers, jobs, imams, followers, events" value={dashboardQuery} onChange={(event) => setDashboardQuery(event.target.value)} />
            </div>
            {dashboardOrganizationsState.loading && !myOrganizations.length && (
              <div className="dashboard-status-card" role="status">
                <strong>Loading your masjid dashboard…</strong>
                <span>Fetching the profiles and management data connected to this account.</span>
              </div>
            )}
            {dashboardOrganizationsState.error && (
              <div className="dashboard-status-card error" role="alert">
                <strong>Dashboard data could not be loaded</strong>
                <span>{dashboardOrganizationsState.error}</span>
                <button type="button" className="secondary-button" onClick={() => loadMyOrganizations(user)}>Try again</button>
              </div>
            )}
            {!dashboardOrganizationsState.loading && !dashboardOrganizationsState.error && !myOrganizations.length && (
              <div className="dashboard-status-card" role="status">
                <strong>No masjid profile is connected yet</strong>
                <span>Ask a platform admin to assign this account as the owner or an approved manager.</span>
              </div>
            )}
            <div className="operator-snapshot">
              {snapshotItems.map((item) => (
                <article key={item.label} className={item.tone === 'urgent' ? 'urgent' : ''}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </article>
              ))}
            </div>
            <div className="operator-quick-actions">
              {quickActions.map((item) => {
                const Icon = item.icon;
                return <button key={item.label} type="button" className={item.primary ? 'primary-button' : 'secondary-button'} onClick={item.action}><Icon size={18} />{item.label}</button>;
              })}
            </div>
            <MasjidReadinessPanel organization={selectedOrg} metrics={metrics} openSection={openDashboardSection} openUserView={openUserView} />
            <section className="operator-section community-publishing">
              <div className="operator-section-title">
                <div><p className="eyebrow">Your masjid account</p><h3>Publish everything your community needs</h3></div>
                <span>Followers stay updated</span>
              </div>
              <p className="helper-text">Every tool below updates the public user experience. Followed and favorited masjids appear first, and eligible users receive in-app history plus push or WhatsApp alerts when enabled.</p>
              <div className="community-publishing-grid">
                {communityPublishingItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" onClick={() => openDashboardSection(item.key)}>
                      <span className="publishing-icon"><Icon size={20} /></span>
                      <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                      <ChevronRight size={17} />
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="operator-section attention-section">
              <div className="operator-section-title"><h3>Needs Attention</h3><span>Today</span></div>
              <div className="attention-list">
                {attentionItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" onClick={item.action}>
                      <Icon size={19} />
                      <span>{item.label}</span>
                      <strong className={item.count ? 'urgent-badge' : ''}>{item.count}</strong>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="operator-section masjid-inbox-preview">
              <div className="operator-section-title"><h3>Inbox</h3><button type="button" onClick={() => setTab?.('messages')}>Open all</button></div>
              <div className="inbox-preview-list">
                {inboxPreviewThreads.map((thread) => (
                  <button key={thread.user.id} type="button" onClick={() => startMessage(thread.user)}>
                    <div className="org-logo">{thread.user.avatarUrl ? <img src={thread.user.avatarUrl} alt="" /> : initials(thread.user.name)}</div>
                    <div>
                      <strong>{thread.user.name}</strong>
                      <span>{thread.lastMessage || 'No message preview'}</span>
                    </div>
                    {thread.unread > 0 && <em>{thread.unread}</em>}
                  </button>
                ))}
                {!inboxPreviewThreads.length && <p className="helper-text">No recent messages yet.</p>}
              </div>
            </section>
            <section className="operator-section">
              <div className="operator-section-title"><h3>Management</h3><button type="button" onClick={openUserView}>Preview</button></div>
              <div className="operator-management-grid">
                {managementItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" onClick={() => openDashboardSection(item.key)}>
                      <Icon size={19} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="operator-section">
              <div className="operator-section-title"><h3>Analytics</h3><span>Overview</span></div>
              <div className="analytics-strip">
                {analyticsItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button key={item.key} type="button" onClick={() => openDashboardSection(item.key)}>
                      <Icon size={17} />
                      <strong>{item.value}</strong>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
            <button type="button" className="operator-preview-button" onClick={openUserView}><Home size={18} />Preview User View</button>
          </section>

          {activeSection && activeSection !== 'userView' && (
            <div className="masjid-feature-screen" role="dialog" aria-modal="true" aria-label={activeDashboardFeature?.label || 'Dashboard feature'}>
              <div className="feature-screen-topbar">
                <button type="button" className="icon-button" onClick={closeDashboardSection} aria-label="Back to dashboard"><ChevronLeft size={22} /></button>
                <div>
                  <strong>{activeDashboardFeature?.label || 'Dashboard'}</strong>
                  <span>{activeDashboardFeature?.detail || 'Manage this masjid feature'}</span>
                </div>
              </div>
              <div className="feature-screen-content">
          {activeSection === 'following' && (
            <section className="panel">
              <div className="section-title"><h2>Following</h2><span>Not connected</span></div>
              <p className="helper-text">This masjid account does not have backend-connected following management yet. The button is ready for onboarding and can be connected when organization-to-organization follows are added.</p>
            </section>
          )}

          {activeSection === 'attention' && (
            <section className="panel">
              <div className="section-title"><h2>Needs attention</h2><span>{pendingApplications.length + pendingRegistrations.length}</span></div>
              <div className="stack-list">
                {pendingApplications.map(({ org, opportunity, application }) => (
                  <article className="mini-row" key={application.id}>
                    <strong>{application.applicant?.name || 'Applicant'} applied for {opportunity.title}</strong>
                    <span>{org.name} - {opportunity.type}</span>
                    {application.note && <p>{application.note}</p>}
                    <TagRow tags={[application.contactPhone && `Phone: ${application.contactPhone}`, application.resumeUrl && 'Resume/profile link'].filter(Boolean)} />
                    <div className="manager-row">
                      <button onClick={() => moveApplication(opportunity.id, application.id, 'REVIEWING')}>Reviewing</button>
                      <button onClick={() => moveApplication(opportunity.id, application.id, 'INTERVIEW')}>Interview</button>
                      <button onClick={() => moveApplication(opportunity.id, application.id, 'APPROVED')}>Accept</button>
                      <button onClick={() => moveApplication(opportunity.id, application.id, 'DENIED')}>Reject</button>
                      {application.resumeUrl && <a className="secondary-button" href={application.resumeUrl} target="_blank" rel="noreferrer">Open link</a>}
                      {application.applicant && <button onClick={() => startMessage(application.applicant)}>Message</button>}
                      {application.applicant && <button onClick={() => openProfile(application.applicant)}>Profile</button>}
                      {application.applicant && <button onClick={() => quickAddTeam(org.id, application.applicant, 'Volunteer Coordinator')}>Add to team</button>}
                    </div>
                  </article>
                ))}
                {pendingRegistrations.map(({ org, event, registration }) => (
                  <article className="mini-row" key={registration.id}>
                    <strong>{registration.user?.name || 'Attendee'} requested entry to {event.title}</strong>
                    <span>{org.name} - {new Date(event.startTime).toLocaleString()}</span>
                    <div className="manager-row">
                      <button onClick={() => updateRegistration(event.id, registration.id, 'APPROVED')}>Approve</button>
                      <button onClick={() => updateRegistration(event.id, registration.id, 'DENIED')}>Deny</button>
                      {registration.user && <button onClick={() => startMessage(registration.user)}>Message</button>}
                      {registration.user && <button onClick={() => openProfile(registration.user)}>Profile</button>}
                    </div>
                  </article>
                ))}
                {!pendingApplications.length && !pendingRegistrations.length && <p className="helper-text">No urgent applications or event approvals right now.</p>}
              </div>
            </section>
          )}

          {user.accountType === 'ADMIN' && activeSection === 'applications' && (
            <section className="panel">
            <div className="section-title"><h2>Create Masjid Profile</h2></div>
            <form className="profile-form" onSubmit={submitOrg}>
              <div className="form-grid">
                <input required placeholder="Masjid name" value={orgForm.name} onChange={(event) => setOrgForm({ ...orgForm, name: event.target.value })} />
                <select value={orgForm.type} onChange={(event) => setOrgForm({ ...orgForm, type: event.target.value })}><option value="MASJID">Masjid</option><option value="MSA">MSA</option></select>
                <input placeholder="City" value={orgForm.city} onChange={(event) => setOrgForm({ ...orgForm, city: event.target.value })} />
                <input placeholder="Address" value={orgForm.address} onChange={(event) => setOrgForm({ ...orgForm, address: event.target.value })} />
                <input placeholder="Website" value={orgForm.website} onChange={(event) => setOrgForm({ ...orgForm, website: event.target.value })} />
                <input placeholder="Public email" value={orgForm.email} onChange={(event) => setOrgForm({ ...orgForm, email: event.target.value })} />
                <input placeholder="Phone" value={orgForm.phone} onChange={(event) => setOrgForm({ ...orgForm, phone: event.target.value })} />
                <input placeholder="Masjid admin login email" value={orgForm.ownerEmail} onChange={(event) => setOrgForm({ ...orgForm, ownerEmail: event.target.value })} />
                <input placeholder="Logo image URL" value={orgForm.imageUrl} onChange={(event) => setOrgForm({ ...orgForm, imageUrl: event.target.value })} />
                <input placeholder="Hero image URL" value={orgForm.heroImageUrl} onChange={(event) => setOrgForm({ ...orgForm, heroImageUrl: event.target.value })} />
                <input placeholder="Donation URL" value={orgForm.donationUrl} onChange={(event) => setOrgForm({ ...orgForm, donationUrl: event.target.value })} />
                <input placeholder="Instagram URL" value={orgForm.instagramUrl} onChange={(event) => setOrgForm({ ...orgForm, instagramUrl: event.target.value })} />
                <input placeholder="Facebook URL" value={orgForm.facebookUrl} onChange={(event) => setOrgForm({ ...orgForm, facebookUrl: event.target.value })} />
                <input placeholder="Latitude" value={orgForm.latitude} onChange={(event) => setOrgForm({ ...orgForm, latitude: event.target.value })} />
                <input placeholder="Longitude" value={orgForm.longitude} onChange={(event) => setOrgForm({ ...orgForm, longitude: event.target.value })} />
              </div>
              <textarea placeholder="Description" value={orgForm.description} onChange={(event) => setOrgForm({ ...orgForm, description: event.target.value })} />
              <textarea placeholder="Facilities, programs, parking, accessibility notes" value={orgForm.facilities} onChange={(event) => setOrgForm({ ...orgForm, facilities: event.target.value })} />
              <button className="primary-button">Create profile</button>
            </form>
          </section>
          )}

          {activeSection === 'posts' && <section className="panel">
            <div className="section-title"><h2>Create From Dashboard</h2><span>{postDestination(postForm.type)}</span></div>
            <p className="helper-text">Choose a category and it will publish to the right place: Events, Programs, Volunteers, Jobs, or the Home feed.</p>
            <form className="profile-form" onSubmit={submitPost}>
              <div className="form-grid">
                <select value={postForm.organizationId} onChange={(event) => setPostForm({ ...postForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <select value={postForm.type} onChange={(event) => setPostForm({ ...postForm, type: event.target.value })}>
                  <option value="ANNOUNCEMENT">Announcement - Home feed</option>
                  <option value="REMINDER">Reminder - Home feed</option>
                  <option value="FUNDRAISER">Fundraiser - Home feed</option>
                  <option value="EVENT">Event - Events</option>
                  <option value="CLASS">Program/Class - Programs</option>
                  <option value="VOLUNTEER">Volunteer - Volunteers</option>
                  <option value="JOB">Job - Jobs</option>
                </select>
                <input required placeholder={`${postDestination(postForm.type)} title`} value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} />
                <input placeholder="Image URL" value={postForm.imageUrl} onChange={(event) => setPostForm({ ...postForm, imageUrl: event.target.value })} />
                <input placeholder="Location" value={postForm.location} onChange={(event) => setPostForm({ ...postForm, location: event.target.value })} />
                <input required={postForm.type === 'EVENT'} type="datetime-local" value={postForm.eventTime} onChange={(event) => setPostForm({ ...postForm, eventTime: event.target.value })} />
              </div>
              <textarea required placeholder={postForm.type === 'CLASS' ? 'Program description' : postForm.type === 'JOB' ? 'Job description' : postForm.type === 'VOLUNTEER' ? 'Volunteer role description' : postForm.type === 'EVENT' ? 'Event description' : 'What should followers know?'} value={postForm.content} onChange={(event) => setPostForm({ ...postForm, content: event.target.value })} />
              <button className="primary-button">{postSubmitLabel(postForm.type)}</button>
            </form>
          </section>}

          {(activeSection === 'events' || activeSection === 'eventApprovals') && <section className="panel">
            <div className="section-title"><h2>Create Event</h2></div>
            <form className="profile-form" onSubmit={submitEvent}>
              <div className="form-grid">
                <select value={eventForm.organizationId} onChange={(event) => setEventForm({ ...eventForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <input required placeholder="Event title" value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} />
                <input placeholder="Location" value={eventForm.location} onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })} />
                <input placeholder="Event image URL" value={eventForm.imageUrl} onChange={(event) => setEventForm({ ...eventForm, imageUrl: event.target.value })} />
                <input required type="datetime-local" value={eventForm.startTime} onChange={(event) => setEventForm({ ...eventForm, startTime: event.target.value })} />
                <input placeholder="Capacity" value={eventForm.capacity} onChange={(event) => setEventForm({ ...eventForm, capacity: event.target.value })} />
                <label className="check-toggle"><input type="checkbox" checked={eventForm.requiresApproval} onChange={(event) => setEventForm({ ...eventForm, requiresApproval: event.target.checked })} />Requires approval</label>
              </div>
              <textarea placeholder="Description" value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} />
              <button className="primary-button">Post event</button>
            </form>
          </section>}

          {activeSection === 'programs' && <section className="panel">
            <div className="section-title"><h2>Create Class or Program</h2></div>
            <form className="profile-form" onSubmit={submitClass}>
              <div className="form-grid">
                <select value={classForm.organizationId} onChange={(event) => setClassForm({ ...classForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <input required placeholder="Class title" value={classForm.title} onChange={(event) => setClassForm({ ...classForm, title: event.target.value })} />
                <input placeholder="Teacher or imam" value={classForm.teacher} onChange={(event) => setClassForm({ ...classForm, teacher: event.target.value })} />
                <input placeholder="Day/time" value={classForm.dayTime} onChange={(event) => setClassForm({ ...classForm, dayTime: event.target.value })} />
                <input placeholder="Location" value={classForm.location} onChange={(event) => setClassForm({ ...classForm, location: event.target.value })} />
                <input placeholder="Program image URL" value={classForm.imageUrl} onChange={(event) => setClassForm({ ...classForm, imageUrl: event.target.value })} />
                <input placeholder="Registration link optional" value={classForm.registrationLink} onChange={(event) => setClassForm({ ...classForm, registrationLink: event.target.value })} />
              </div>
              <textarea placeholder="Description" value={classForm.description} onChange={(event) => setClassForm({ ...classForm, description: event.target.value })} />
              <textarea placeholder="Gender, family, or attendance notes optional" value={classForm.notes} onChange={(event) => setClassForm({ ...classForm, notes: event.target.value })} />
              <button className="primary-button">Publish class</button>
            </form>
          </section>}

          {(activeSection === 'jobs' || activeSection === 'volunteers') && <section className="panel">
            <div className="section-title"><h2>{activeSection === 'jobs' ? 'Post Job' : 'Post Volunteer Opportunity'}</h2></div>
            <form className="profile-form" onSubmit={submitOpp}>
              <div className="form-grid">
                <select value={oppForm.organizationId} onChange={(event) => setOppForm({ ...oppForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <select value={oppForm.type} onChange={(event) => setOppForm({ ...oppForm, type: event.target.value })}><option value="VOLUNTEER">Volunteer</option><option value="JOB">Job</option><option value="OPPORTUNITY">Opportunity</option></select>
                <input required placeholder="Title" value={oppForm.title} onChange={(event) => setOppForm({ ...oppForm, title: event.target.value })} />
                <input placeholder="Location" value={oppForm.location} onChange={(event) => setOppForm({ ...oppForm, location: event.target.value })} />
                <input placeholder="Skills, comma separated" value={oppForm.skills} onChange={(event) => setOppForm({ ...oppForm, skills: event.target.value })} />
                <input placeholder="Hours" value={oppForm.hours} onChange={(event) => setOppForm({ ...oppForm, hours: event.target.value })} />
                <select value={oppForm.workType} onChange={(event) => setOppForm({ ...oppForm, workType: event.target.value })}>
                  <option value="volunteer">Volunteer</option>
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                </select>
                <input type="date" value={oppForm.deadline} onChange={(event) => setOppForm({ ...oppForm, deadline: event.target.value })} />
              </div>
              <textarea placeholder="Description" value={oppForm.description} onChange={(event) => setOppForm({ ...oppForm, description: event.target.value })} />
              <textarea placeholder="Requirements" value={oppForm.requirements} onChange={(event) => setOppForm({ ...oppForm, requirements: event.target.value })} />
              <textarea placeholder="Custom application questions, one per line" value={oppForm.applicationQuestions} onChange={(event) => setOppForm({ ...oppForm, applicationQuestions: event.target.value })} />
              <p className="helper-text">Custom questions are stored with the listing and shown in the application modal.</p>
              <button className="primary-button">Post</button>
            </form>
          </section>}

          {(activeSection === 'team' || activeSection === 'committee') && <section className="panel">
            <div className="section-title"><h2>{activeSection === 'committee' ? 'Jamaat / Committee' : 'Masjid Team'}</h2></div>
            <form className="profile-form" onSubmit={submitInvite}>
              <div className="form-grid">
                <select value={inviteForm.organizationId} onChange={(event) => setInviteForm({ ...inviteForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <input placeholder="Name" value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} />
                <input required placeholder="Email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} />
                <select value={inviteForm.accountType} onChange={(event) => setInviteForm({ ...inviteForm, accountType: event.target.value })}>
                  <option value="IMAM">Imam</option>
                  <option value="STUDENT_OF_KNOWLEDGE">Student of Knowledge</option>
                  <option value="USER">User</option>
                  <option value="MASJID">Masjid Staff</option>
                  <option value="MSA">MSA Staff</option>
                </select>
                <input placeholder="Role, e.g. Imam, Volunteer Coordinator" value={inviteForm.roleLabel} onChange={(event) => setInviteForm({ ...inviteForm, roleLabel: event.target.value })} />
              </div>
              <p className="helper-text">Creates a login if the email is new, or attaches the existing account if it already exists.</p>
              <button className="primary-button">Invite or create team login</button>
            </form>
            <form className="profile-form" onSubmit={submitPerson}>
              <div className="form-grid">
                <select value={peopleForm.organizationId} onChange={(event) => setPeopleForm({ ...peopleForm, organizationId: event.target.value })}>
                  <option value="">Select organization</option>
                  {myOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                </select>
                <input placeholder="Search people by name, email, city, skills" value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} />
                <select value={peopleForm.userId} onChange={(event) => setPeopleForm({ ...peopleForm, userId: event.target.value })}>
                  <option value="">Select person</option>
                  {teamCandidates.map((person) => <option key={person.id} value={person.id}>{person.name} - {person.accountType} - {person.email}</option>)}
                </select>
                <input placeholder="Role, e.g. Imam, Khateeb, Coordinator" value={peopleForm.roleLabel} onChange={(event) => setPeopleForm({ ...peopleForm, roleLabel: event.target.value })} />
              </div>
              <p className="helper-text">Showing {teamCandidates.length} matching people. Search first if the network is large.</p>
              <button className="primary-button">Add to masjid profile</button>
            </form>
          </section>}

          {showOrgPanels && scopedOrganizations.map((org) => (
            <section className={showProfileTools ? 'panel org-feature-panel profile-tools-panel' : 'panel org-feature-panel'} key={org.id}>
              {showProfileTools && <div className="section-title"><h2>{org.name}</h2><button onClick={() => startEditPrayers(org)}>Edit prayers</button><span>{org.followerCount || 0} followers</span><span>{org.peopleCount || 0} team</span></div>}
              {showProfileTools && editingOrgId === org.id && (
                <form className="profile-form manager-edit-form" onSubmit={submitEditOrg}>
                  <div className="form-grid">
                    {['name', 'city', 'address', 'website', 'email', 'phone', 'imageUrl', 'heroImageUrl', 'donationUrl', 'instagramUrl', 'facebookUrl', 'latitude', 'longitude'].map((field) => (
                      <input key={field} placeholder={field} value={editOrgForm[field] || ''} onChange={(event) => setEditOrgForm({ ...editOrgForm, [field]: event.target.value })} />
                    ))}
                    <select value={editOrgForm.type || 'MASJID'} onChange={(event) => setEditOrgForm({ ...editOrgForm, type: event.target.value })}><option value="MASJID">Masjid</option><option value="MSA">MSA</option></select>
                  </div>
                  <textarea placeholder="Description" value={editOrgForm.description || ''} onChange={(event) => setEditOrgForm({ ...editOrgForm, description: event.target.value })} />
                  <textarea placeholder="Facilities" value={editOrgForm.facilities || ''} onChange={(event) => setEditOrgForm({ ...editOrgForm, facilities: event.target.value })} />
                  <div className="profile-actions">
                    <button className="primary-button">Save masjid profile</button>
                    <button className="secondary-button" type="button" onClick={() => setEditingOrgId('')}>Cancel</button>
                  </div>
                </form>
              )}
              {showSection('prayerTimes') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Edit Prayers</h3><span>Shown on public profile</span></div>
                  <div className="prayer-grid detailed manager-prayer-grid">
                    {standardPrayerKeys.map((name) => (
                      <div key={name}><span>{name}</span><strong>{org.iqamahTimes?.[name] || org.iqamahTimes?.[name.toLowerCase()] || 'Not set'} / {org.prayerTimes?.[name] || org.prayerTimes?.[name.toLowerCase()] || 'Not set'}</strong><em>Prayer time / jamat time</em></div>
                    ))}
                  </div>
                  {(org.iqamahTimes?.additionalPrayers || []).length > 0 && (
                    <div className="stack-list">
                      {(org.iqamahTimes.additionalPrayers || []).map((prayer, index) => (
                        <article className="mini-row" key={prayer.id || `${prayer.name}-${index}`}>
                          <strong>{prayer.name}</strong>
                          <span>{prayer.time || 'Prayer time not set'} / {prayer.jamatTime || 'Not set'}</span>
                          {prayer.notes && <p>{prayer.notes}</p>}
                        </article>
                      ))}
                    </div>
                  )}
                  {(org.iqamahTimes?.temporaryPrayers || []).length > 0 && (
                    <div className="stack-list">
                      {(org.iqamahTimes.temporaryPrayers || []).map((prayer, index) => (
                        <article className="mini-row" key={prayer.id || `${prayer.name}-${index}`}>
                          <strong>{prayer.name}</strong>
                          <span>{prayer.time || 'Prayer time not set'} / {prayer.jamatTime || 'Not set'}{prayer.startsAt || prayer.endsAt ? ` - ${prayer.startsAt || 'now'} to ${prayer.endsAt || 'until removed'}` : ''}</span>
                          {prayer.notes && <p>{prayer.notes}</p>}
                        </article>
                      ))}
                    </div>
                  )}
                  {org.prayerNotes && <p className="helper-text">{org.prayerNotes}</p>}
                  <div className="manager-row">
                    <span>Update standard prayers, add new prayers, add temporary prayers, and save prayer notes.</span>
                    <button onClick={() => startEditPrayers(org)}>Edit prayers</button>
                  </div>
                  {editingPrayerOrgId === org.id && (
                    <form className="profile-form manager-edit-form" onSubmit={(event) => submitEditPrayers(event, org)}>
                      <div className="section-title compact-title"><h3>Standard prayers</h3><span>Prayer time / Iqamah-Jamat</span></div>
                      <div className="form-grid">
                        {standardPrayerKeys.map((name) => (
                          <React.Fragment key={name}>
                            <input readOnly placeholder={`${name} prayer time from API`} value={editPrayerForm[name] || ''} />
                            <input placeholder={`${name} jamat time, e.g. 4:30 AM`} value={editPrayerForm[`${name}Jamat`] || ''} onChange={(event) => setEditPrayerForm({ ...editPrayerForm, [`${name}Jamat`]: event.target.value })} />
                          </React.Fragment>
                        ))}
                      </div>
                      <textarea placeholder="Prayer notes or announcements" value={editPrayerForm.prayerNotes || ''} onChange={(event) => setEditPrayerForm({ ...editPrayerForm, prayerNotes: event.target.value })} />

                      <div className="section-title compact-title"><h3>Additional prayers</h3><span>Add new prayer</span></div>
                      {(editPrayerForm.additionalPrayers || []).map((row, index) => (
                        <div className="form-grid" key={row.id || index}>
                          <input placeholder="Prayer name" value={row.name || ''} onChange={(event) => updatePrayerRow('additionalPrayers', index, 'name', event.target.value)} />
                          <input placeholder="Prayer time" value={row.time || ''} onChange={(event) => updatePrayerRow('additionalPrayers', index, 'time', event.target.value)} />
                          <input placeholder="Jamat time" value={row.jamatTime || ''} onChange={(event) => updatePrayerRow('additionalPrayers', index, 'jamatTime', event.target.value)} />
                          <input placeholder="Notes" value={row.notes || ''} onChange={(event) => updatePrayerRow('additionalPrayers', index, 'notes', event.target.value)} />
                          <button className="secondary-button danger" type="button" onClick={() => removePrayerRow('additionalPrayers', index)}>Remove</button>
                        </div>
                      ))}
                      <div className="form-grid">
                        <input placeholder="New prayer name, e.g. Taraweeh" value={newPrayerDraft.name} onChange={(event) => setNewPrayerDraft({ ...newPrayerDraft, name: event.target.value })} />
                        <input placeholder="Prayer time, e.g. After Isha" value={newPrayerDraft.time} onChange={(event) => setNewPrayerDraft({ ...newPrayerDraft, time: event.target.value })} />
                        <input placeholder="Jamat time, e.g. 9:45 PM" value={newPrayerDraft.jamatTime} onChange={(event) => setNewPrayerDraft({ ...newPrayerDraft, jamatTime: event.target.value })} />
                        <input placeholder="Notes optional" value={newPrayerDraft.notes} onChange={(event) => setNewPrayerDraft({ ...newPrayerDraft, notes: event.target.value })} />
                        <button className="secondary-button" type="button" onClick={addAdditionalPrayer}>Add new prayer</button>
                      </div>

                      <div className="section-title compact-title"><h3>Temporary prayers</h3><span>Ramadan, Eid, special dates</span></div>
                      {(editPrayerForm.temporaryPrayers || []).map((row, index) => (
                        <div className="form-grid" key={row.id || index}>
                          <input placeholder="Temporary prayer name" value={row.name || ''} onChange={(event) => updatePrayerRow('temporaryPrayers', index, 'name', event.target.value)} />
                          <input placeholder="Prayer time" value={row.time || ''} onChange={(event) => updatePrayerRow('temporaryPrayers', index, 'time', event.target.value)} />
                          <input placeholder="Jamat time" value={row.jamatTime || ''} onChange={(event) => updatePrayerRow('temporaryPrayers', index, 'jamatTime', event.target.value)} />
                          <input type="date" value={row.startsAt || ''} onChange={(event) => updatePrayerRow('temporaryPrayers', index, 'startsAt', event.target.value)} />
                          <input type="date" value={row.endsAt || ''} onChange={(event) => updatePrayerRow('temporaryPrayers', index, 'endsAt', event.target.value)} />
                          <input placeholder="Notes" value={row.notes || ''} onChange={(event) => updatePrayerRow('temporaryPrayers', index, 'notes', event.target.value)} />
                          <button className="secondary-button danger" type="button" onClick={() => removePrayerRow('temporaryPrayers', index)}>Remove</button>
                        </div>
                      ))}
                      <div className="form-grid">
                        <input placeholder="Temporary prayer name, e.g. Eid Salah" value={temporaryPrayerDraft.name} onChange={(event) => setTemporaryPrayerDraft({ ...temporaryPrayerDraft, name: event.target.value })} />
                        <input placeholder="Prayer time" value={temporaryPrayerDraft.time} onChange={(event) => setTemporaryPrayerDraft({ ...temporaryPrayerDraft, time: event.target.value })} />
                        <input placeholder="Jamat time" value={temporaryPrayerDraft.jamatTime} onChange={(event) => setTemporaryPrayerDraft({ ...temporaryPrayerDraft, jamatTime: event.target.value })} />
                        <input type="date" value={temporaryPrayerDraft.startsAt} onChange={(event) => setTemporaryPrayerDraft({ ...temporaryPrayerDraft, startsAt: event.target.value })} />
                        <input type="date" value={temporaryPrayerDraft.endsAt} onChange={(event) => setTemporaryPrayerDraft({ ...temporaryPrayerDraft, endsAt: event.target.value })} />
                        <input placeholder="Notes optional" value={temporaryPrayerDraft.notes} onChange={(event) => setTemporaryPrayerDraft({ ...temporaryPrayerDraft, notes: event.target.value })} />
                        <button className="secondary-button" type="button" onClick={addTemporaryPrayer}>Add temporary prayer</button>
                      </div>

                      <div className="profile-actions">
                        <button className="primary-button">Save prayers</button>
                        <button className="secondary-button" type="button" onClick={() => setEditingPrayerOrgId('')}>Cancel</button>
                      </div>
                    </form>
                  )}
                </div>
              )}
              {showApplications && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>{activeSection === 'jobApplications' ? 'Job Applications' : activeSection === 'volunteerApplications' ? 'Volunteer Applications' : 'Application Portal'}</h3><span>{(org.opportunities || []).filter((opportunity) => !applicationTypeFilter || (applicationTypeFilter === 'JOB' ? opportunity.type === 'JOB' : opportunity.type !== 'JOB')).reduce((sum, opportunity) => sum + (opportunity.applications || []).length, 0)}</span></div>
                  <div className="application-portal">
                    {(org.opportunities || []).filter((opportunity) => !applicationTypeFilter || (applicationTypeFilter === 'JOB' ? opportunity.type === 'JOB' : opportunity.type !== 'JOB')).flatMap((opportunity) => (opportunity.applications || []).map((application) => ({ opportunity, application }))).map(({ opportunity, application }) => (
                      <article className="application-card" key={application.id}>
                        <div>
                          <strong>{application.applicantName || application.applicant?.name || 'Applicant'}</strong>
                          <span>{application.applicantEmail || application.applicant?.email || application.email || 'Email not provided'}</span>
                          <p>{opportunity.title} - {opportunity.type}</p>
                        </div>
                        <TagRow tags={[`Status: ${application.status || 'NEW'}`, application.contactPhone && `Phone: ${application.contactPhone}`, application.resumeUrl && 'Resume/profile link'].filter(Boolean)} />
                        {application.note && <p>{application.note}</p>}
                        {application.answers && <pre>{JSON.stringify(application.answers, null, 2)}</pre>}
                        <div className="manager-row">
                          {application.resumeUrl && <a className="secondary-button" href={application.resumeUrl} target="_blank" rel="noreferrer">View application</a>}
                          {(application.applicantEmail || application.applicant?.email) && <a className="secondary-button" href={`mailto:${application.applicantEmail || application.applicant.email}`}>Email applicant</a>}
                          {application.applicant && <button onClick={() => startMessage(application.applicant)}>Message applicant</button>}
                          <button onClick={() => moveApplication(opportunity.id, application.id, 'REVIEWING')}>Mark reviewing</button>
                          <button onClick={() => moveApplication(opportunity.id, application.id, 'INTERVIEW')}>Move to interview</button>
                          <button onClick={() => moveApplication(opportunity.id, application.id, 'ACCEPTED')}>Accept</button>
                          <button onClick={() => moveApplication(opportunity.id, application.id, 'REJECTED')}>Reject</button>
                        </div>
                      </article>
                    ))}
                    {!(org.opportunities || []).filter((opportunity) => !applicationTypeFilter || (applicationTypeFilter === 'JOB' ? opportunity.type === 'JOB' : opportunity.type !== 'JOB')).some((opportunity) => (opportunity.applications || []).length) && <p className="helper-text">No applications yet.</p>}
                  </div>
                </div>
              )}
              {showSection('programs') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Classes & Programs</h3><span>{(org.classes || []).length}</span></div>
                  <div className="stack-list">
                    {(org.classes || []).length ? (org.classes || []).map((item, index) => (
                      <article className="mini-row" key={item.id || `${item.title}-${index}`}>
                        <strong>{item.title}</strong>
                        <span>{item.teacher || 'Teacher TBD'} - {item.dayTime || 'Schedule TBD'}</span>
                        <p>{item.description || item.location || item.notes || 'No class details yet.'}</p>
                        {item.imageUrl && <img className="post-image" src={item.imageUrl} alt="" />}
                        {editingClassKey === contentEditKey(org.id, item, index) ? (
                          <form className="profile-form manager-edit-form" onSubmit={(event) => submitEditClass(event, org, item, index)}>
                            <div className="form-grid">
                              <input required placeholder="Class title" value={editClassForm.title || ''} onChange={(event) => setEditClassForm({ ...editClassForm, title: event.target.value })} />
                              <input placeholder="Teacher or imam" value={editClassForm.teacher || ''} onChange={(event) => setEditClassForm({ ...editClassForm, teacher: event.target.value })} />
                              <input placeholder="Day/time" value={editClassForm.dayTime || ''} onChange={(event) => setEditClassForm({ ...editClassForm, dayTime: event.target.value })} />
                              <input placeholder="Location" value={editClassForm.location || ''} onChange={(event) => setEditClassForm({ ...editClassForm, location: event.target.value })} />
                              <input placeholder="Program image URL" value={editClassForm.imageUrl || ''} onChange={(event) => setEditClassForm({ ...editClassForm, imageUrl: event.target.value })} />
                              <input placeholder="Registration link optional" value={editClassForm.registrationLink || ''} onChange={(event) => setEditClassForm({ ...editClassForm, registrationLink: event.target.value })} />
                            </div>
                            <textarea placeholder="Description" value={editClassForm.description || ''} onChange={(event) => setEditClassForm({ ...editClassForm, description: event.target.value })} />
                            <textarea placeholder="Gender, family, or attendance notes optional" value={editClassForm.notes || ''} onChange={(event) => setEditClassForm({ ...editClassForm, notes: event.target.value })} />
                            <div className="manager-row">
                              <button className="primary-button">Save program</button>
                              <button className="secondary-button" type="button" onClick={() => { setEditingClassKey(''); setEditClassForm({}); }}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <TagRow tags={[item.location, item.notes, item.registrationLink && 'Registration link'].filter(Boolean)} />
                            <div className="manager-row">
                              <button onClick={() => startEditClass(org, item, index)}>Edit class</button>
                              {item.registrationLink && <a className="secondary-button" href={item.registrationLink} target="_blank" rel="noreferrer">Open registration</a>}
                              <button className="secondary-button danger" onClick={() => deleteClass(org, item, index)}>Delete class</button>
                            </div>
                          </>
                        )}
                      </article>
                    )) : <p className="helper-text">No classes or programs have been added yet.</p>}
                  </div>
                </div>
              )}
              {showSection('team') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Team</h3><span>{(org.people || []).length}</span></div>
                  <div className="stack-list">
                    {(org.people || []).length ? (org.people || []).map((person) => (
                      <article className="mini-row" key={person.id}>
                        <strong>{person.user?.name || 'Person'}</strong>
                        <span>{person.roleLabel}</span>
                        <div className="manager-row">
                          {person.user && <button onClick={() => startMessage(person.user)}>Message</button>}
                          {person.user && <button onClick={() => openProfile(person.user)}>Profile</button>}
                          <button onClick={() => removeOrganizationPerson(org.id, person.userId)}>Remove</button>
                        </div>
                      </article>
                    )) : <p className="helper-text">No imams or team members attached yet.</p>}
                  </div>
                </div>
              )}

              {activeSection === 'announcements' && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Masjid Announcements</h3><span>Simple social feed</span></div>
                  <p className="helper-text">Post quick updates for the community. These appear like social feed posts from the masjid.</p>

                  <form className="profile-form manager-edit-form" onSubmit={submitAnnouncement}>
                    <div className="form-grid">
                      <select value={announcementForm.organizationId || org.id} onChange={(event) => setAnnouncementForm({ ...announcementForm, organizationId: event.target.value })}>
                        <option value={org.id}>{org.name}</option>
                        {myOrganizations.filter((item) => item.id !== org.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                      <select value={announcementForm.category} onChange={(event) => setAnnouncementForm({ ...announcementForm, category: event.target.value })}>
                        {masjidAnnouncementTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                      <input required placeholder="Announcement title" value={announcementForm.title} onChange={(event) => setAnnouncementForm({ ...announcementForm, title: event.target.value })} />
                      <input placeholder="Image URL optional" value={announcementForm.imageUrl} onChange={(event) => setAnnouncementForm({ ...announcementForm, imageUrl: event.target.value })} />
                    </div>
                    <textarea required placeholder="Write the announcement like a social post..." value={announcementForm.content} onChange={(event) => setAnnouncementForm({ ...announcementForm, content: event.target.value })} />
                    <div className="profile-actions">
                      <button className="primary-button">Post announcement</button>
                    </div>
                  </form>

                  <div className="section-title compact-title"><h3>Announcement Feed</h3><span>{(org.posts || []).length}</span></div>
                  <div className="stack-list">
                    {(org.posts || []).length ? (org.posts || []).map((post) => (
                      <article className="mini-row" key={post.id}>
                        <strong>{post.title}</strong>
                        <span>{post.type} - {new Date(post.createdAt).toLocaleString()}</span>
                        <p>{post.content}</p>
                        {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}
                        <div className="manager-row">
                          <button onClick={() => startEditPost(post)}>Edit post</button>
                          <button className="secondary-button danger" onClick={() => deletePost(post.id)}>Delete post</button>
                        </div>
                      </article>
                    )) : <p className="helper-text">No announcements posted yet.</p>}
                  </div>
                </div>
              )}

              {showSection('posts') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Posts</h3><span>{(org.posts || []).length}</span></div>
                  <div className="stack-list">
                    {(org.posts || []).length ? (org.posts || []).map((post) => (
                      <article className="mini-row" key={post.id}>
                        <strong>{post.title}</strong>
                        <span>{post.type} - {new Date(post.createdAt).toLocaleString()}</span>
                        <p>{post.content}</p>
                        {post.imageUrl && <img className="post-image" src={post.imageUrl} alt="" />}
                        {editingPostId === post.id ? (
                          <form className="profile-form manager-edit-form" onSubmit={(event) => submitEditPost(event, post)}>
                            <div className="form-grid">
                              <select value={editPostForm.type || 'ANNOUNCEMENT'} onChange={(event) => setEditPostForm({ ...editPostForm, type: event.target.value })}>
                                {['ANNOUNCEMENT', 'EVENT', 'REMINDER', 'FUNDRAISER', 'CLASS', 'VOLUNTEER', 'JOB'].map((type) => <option key={type} value={type}>{type}</option>)}
                              </select>
                              <input required placeholder="Post title" value={editPostForm.title || ''} onChange={(event) => setEditPostForm({ ...editPostForm, title: event.target.value })} />
                              <input placeholder="Image URL" value={editPostForm.imageUrl || ''} onChange={(event) => setEditPostForm({ ...editPostForm, imageUrl: event.target.value })} />
                              <input placeholder="Location" value={editPostForm.location || ''} onChange={(event) => setEditPostForm({ ...editPostForm, location: event.target.value })} />
                              <input type="datetime-local" value={editPostForm.eventTime || ''} onChange={(event) => setEditPostForm({ ...editPostForm, eventTime: event.target.value })} />
                            </div>
                            <textarea required placeholder="Post content" value={editPostForm.content || ''} onChange={(event) => setEditPostForm({ ...editPostForm, content: event.target.value })} />
                            <div className="manager-row">
                              <button className="primary-button">Save post</button>
                              <button className="secondary-button" type="button" onClick={() => { setEditingPostId(''); setEditPostForm({}); }}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <div className="manager-row">
                            <button onClick={() => startEditPost(post)}>Edit post</button>
                            <button className="secondary-button danger" onClick={() => deletePost(post.id)}>Delete post</button>
                          </div>
                        )}
                      </article>
                    )) : <p className="helper-text">No posts match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}

              {showSection('events') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Events</h3><span>{(org.events || []).length}</span></div>
                  <div className="stack-list">
                    {(org.events || []).length ? (org.events || []).map((event) => {
                      const stats = eventAttendanceStats(event);
                      return (
                      <article className="mini-row event-registration-card" key={event.id}>
                        <strong>{event.title}</strong>
                        <span>{new Date(event.startTime).toLocaleString()}</span>
                        <p>{event.description || event.location || 'No event details yet.'}</p>
                        {event.imageUrl && <img className="post-image" src={event.imageUrl} alt="" />}
                        <div className="event-attendance-grid">
                          <div><strong>{stats.registered}</strong><span>Registered</span></div>
                          <div><strong>{stats.checkedIn}</strong><span>Checked In</span></div>
                          <div><strong>{stats.noShow}</strong><span>No Show</span></div>
                        </div>
                        {editingEventId === event.id ? (
                          <form className="profile-form manager-edit-form" onSubmit={(formEvent) => submitEditEvent(formEvent, event)}>
                            <div className="form-grid">
                              <input required placeholder="Event title" value={editEventForm.title || ''} onChange={(inputEvent) => setEditEventForm({ ...editEventForm, title: inputEvent.target.value })} />
                              <input placeholder="Location" value={editEventForm.location || ''} onChange={(inputEvent) => setEditEventForm({ ...editEventForm, location: inputEvent.target.value })} />
                              <input placeholder="Event image URL" value={editEventForm.imageUrl || ''} onChange={(inputEvent) => setEditEventForm({ ...editEventForm, imageUrl: inputEvent.target.value })} />
                              <input required type="datetime-local" value={editEventForm.startTime || ''} onChange={(inputEvent) => setEditEventForm({ ...editEventForm, startTime: inputEvent.target.value })} />
                              <input type="datetime-local" value={editEventForm.endTime || ''} onChange={(inputEvent) => setEditEventForm({ ...editEventForm, endTime: inputEvent.target.value })} />
                              <input placeholder="Capacity" value={editEventForm.capacity || ''} onChange={(inputEvent) => setEditEventForm({ ...editEventForm, capacity: inputEvent.target.value })} />
                              <label className="check-toggle"><input type="checkbox" checked={Boolean(editEventForm.requiresApproval)} onChange={(inputEvent) => setEditEventForm({ ...editEventForm, requiresApproval: inputEvent.target.checked })} />Requires approval</label>
                            </div>
                            <textarea placeholder="Description" value={editEventForm.description || ''} onChange={(inputEvent) => setEditEventForm({ ...editEventForm, description: inputEvent.target.value })} />
                            <div className="manager-row">
                              <button className="primary-button">Save event</button>
                              <button className="secondary-button" type="button" onClick={() => { setEditingEventId(''); setEditEventForm({}); }}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          <div className="manager-row">
                            <span>{stats.pending} pending, {stats.approved} approved, {stats.denied} denied</span>
                            <button onClick={() => bulkUpdateRegistrations(event.id, { status: 'APPROVED', fromStatus: 'PENDING' })}>Approve pending</button>
                            <button onClick={() => bulkUpdateRegistrations(event.id, { status: 'ATTENDED', fromStatus: 'APPROVED' })}>Check in approved</button>
                            <button onClick={() => bulkUpdateRegistrations(event.id, { status: 'NO_SHOW', fromStatus: 'APPROVED' })}>No-show approved</button>
                            <button onClick={() => startEditEvent(event)}>Edit event</button>
                            <button className="secondary-button danger" onClick={() => deleteEvent(event.id)}>Delete event</button>
                          </div>
                        )}
                        {(event.registrations || []).map((registration) => (
                          <div className="manager-row attendee-row" key={registration.id}>
                            <span>{registration.user?.name || 'User'} - {registration.status}</span>
                            <button onClick={() => updateRegistration(event.id, registration.id, 'APPROVED')}>Approve</button>
                            <button onClick={() => updateRegistration(event.id, registration.id, 'DENIED')}>Deny</button>
                            <button onClick={() => updateRegistration(event.id, registration.id, 'ATTENDED')}>Check in</button>
                            <button onClick={() => updateRegistration(event.id, registration.id, 'NO_SHOW')}>No show</button>
                            {registration.user && <button onClick={() => startMessage(registration.user)}>Message</button>}
                            {registration.user && <button onClick={() => openProfile(registration.user)}>Profile</button>}
                          </div>
                        ))}
                      </article>
                      );
                    }) : <p className="helper-text">No events match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}

              {showSection('volunteers') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Volunteers</h3><span>{(org.opportunities || []).filter((item) => item.type !== 'JOB').length}</span></div>
                  <div className="stack-list">
                    {(org.opportunities || []).filter((item) => item.type !== 'JOB').length ? (org.opportunities || []).filter((item) => item.type !== 'JOB').map((opportunity) => (
                      <article className="mini-row" key={opportunity.id}>
                        <strong>{opportunity.title}</strong>
                        <span>{opportunity.type} - {(opportunity.applications || []).length} applicants</span>
                        <div className="manager-row">
                          <span>{(opportunity.applications || []).filter((application) => application.status === 'PENDING').length} pending, {(opportunity.applications || []).filter((application) => application.status === 'APPROVED').length} approved, {(opportunity.applications || []).filter((application) => application.status === 'COMPLETED').length} completed</span>
                          <button onClick={() => approvePendingApplications(opportunity.id)}>Approve pending</button>
                          <button onClick={() => bulkUpdateApplications(opportunity.id, { status: 'COMPLETED', fromStatus: 'APPROVED', checkedOutAt: true })}>Complete approved</button>
                          <button onClick={() => editOpportunity(opportunity)}>Edit post</button>
                          <button className="secondary-button danger" onClick={() => deleteOpportunity(opportunity.id)}>Delete post</button>
                        </div>
                        {(opportunity.applications || []).map((application) => (
                          <div className="manager-row" key={application.id}>
                            <span>{application.applicant?.name || 'Applicant'} - {application.status} - {application.approvedHours || 0} hrs{application.contactPhone ? ` - ${application.contactPhone}` : ''}</span>
                            {application.note && <p>{application.note}</p>}
                            <button onClick={() => approveApplication(opportunity.id, application.id)}>Approve hours</button>
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'APPROVED', checkedInAt: true })}>Check in</button>
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'COMPLETED', checkedOutAt: true })}>Check out</button>
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'DENIED' })}>Deny</button>
                            {application.resumeUrl && <a className="secondary-button" href={application.resumeUrl} target="_blank" rel="noreferrer">Open link</a>}
                            {application.applicant && <button onClick={() => startMessage(application.applicant)}>Message</button>}
                            {application.applicant && <button onClick={() => openProfile(application.applicant)}>Profile</button>}
                            {application.applicant && <button onClick={() => quickAddTeam(org.id, application.applicant, 'Volunteer')}>Add to team</button>}
                            <small>In: {formatDateTime(application.checkedInAt)} | Out: {formatDateTime(application.checkedOutAt)}</small>
                          </div>
                        ))}
                      </article>
                    )) : <p className="helper-text">No volunteer opportunities match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}

              {showSection('jobs') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Jobs</h3><span>{(org.opportunities || []).filter((item) => item.type === 'JOB').length}</span></div>
                  <div className="stack-list">
                    {(org.opportunities || []).filter((item) => item.type === 'JOB').length ? (org.opportunities || []).filter((item) => item.type === 'JOB').map((opportunity) => (
                      <article className="mini-row" key={opportunity.id}>
                        <strong>{opportunity.title}</strong>
                        <span>{(opportunity.applications || []).length} applicants</span>
                        <div className="manager-row">
                          <span>{(opportunity.applications || []).filter((application) => application.status === 'PENDING').length} pending, {(opportunity.applications || []).filter((application) => application.status === 'APPROVED').length} approved</span>
                          <button onClick={() => bulkUpdateApplications(opportunity.id, { status: 'APPROVED', fromStatus: 'PENDING' })}>Approve pending</button>
                          <button onClick={() => editOpportunity(opportunity)}>Edit job</button>
                          <button className="secondary-button danger" onClick={() => deleteOpportunity(opportunity.id)}>Delete job</button>
                        </div>
                        {(opportunity.applications || []).map((application) => (
                          <div className="manager-row" key={application.id}>
                            <span>{application.applicant?.name || 'Applicant'} - {application.status}{application.contactPhone ? ` - ${application.contactPhone}` : ''}</span>
                            {application.note && <p>{application.note}</p>}
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'APPROVED' })}>Approve</button>
                            <button onClick={() => updateApplication(opportunity.id, application.id, { status: 'DENIED' })}>Deny</button>
                            {application.resumeUrl && <a className="secondary-button" href={application.resumeUrl} target="_blank" rel="noreferrer">Open link</a>}
                            {application.applicant && <button onClick={() => startMessage(application.applicant)}>Message</button>}
                            {application.applicant && <button onClick={() => openProfile(application.applicant)}>Profile</button>}
                            {application.applicant && <button onClick={() => quickAddTeam(org.id, application.applicant, 'Staff')}>Add to team</button>}
                          </div>
                        ))}
                      </article>
                    )) : <p className="helper-text">No jobs match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}

              {showSection('followers') && (
                <div className="manager-section">
                  <div className="section-title compact-title"><h3>Followers</h3><span>{(org.followers || []).length}</span></div>
                  <div className="stack-list">
                    {(org.followers || []).length ? (org.followers || []).map((follow) => (
                      <article className="mini-row" key={follow.id}>
                        <strong>{follow.user?.name || 'Follower'}</strong>
                        <span>{follow.user?.email || org.name}</span>
                        <div className="manager-row">
                          {follow.user && <button onClick={() => startMessage(follow.user)}>Message</button>}
                          {follow.user && <button onClick={() => openProfile(follow.user)}>Profile</button>}
                          {follow.user && <button onClick={() => quickAddTeam(org.id, follow.user, 'Community Liaison')}>Add to team</button>}
                          <button className="secondary-button danger" onClick={() => removeOrganizationFollower(org.id, follow.userId)}>Remove follower</button>
                        </div>
                      </article>
                    )) : <p className="helper-text">No followers match this dashboard filter yet.</p>}
                  </div>
                </div>
              )}
            </section>
          ))}
          {!scopedOrganizations.length && <section className="panel"><p className="helper-text">No managed masjids match this search.</p></section>}
              </div>
            </div>
          )}
        </section>

        <aside className="right-rail">
          <section className="panel">
            <div className="section-title"><h2>Followers</h2><span>{allFollowers.length}</span></div>
            <div className="stack-list">
              {allFollowers.slice(0, 25).map(({ org, follow }) => (
                <article className="mini-row" key={follow.id}>
                  <strong>{follow.user?.name || 'Follower'}</strong>
                  <span>{org.name}</span>
                  <div className="manager-row">
                    {follow.user && <button onClick={() => startMessage(follow.user)}>Message</button>}
                    {follow.user && <button onClick={() => openProfile(follow.user)}>Profile</button>}
                    {follow.user && <button onClick={() => quickAddTeam(org.id, follow.user, 'Community Liaison')}>Add to team</button>}
                    <button className="secondary-button danger" onClick={() => removeOrganizationFollower(org.id, follow.userId)}>Remove</button>
                  </div>
                </article>
              ))}
              {!allFollowers.length && <p className="helper-text">No followers match this dashboard filter yet.</p>}
            </div>
          </section>
          <section className="panel">
            <div className="section-title"><h2>Operator checklist</h2></div>
            <div className="stack-list">
              <article className="mini-row"><strong>1. Keep profile current</strong><span>Logo, address, links, prayer/iqamah times, and contact info.</span></article>
              <article className="mini-row"><strong>2. Review pending requests</strong><span>Approve event entries and volunteer/job applications before they pile up.</span></article>
              <article className="mini-row"><strong>3. Post weekly updates</strong><span>Announcements, classes, fundraisers, reminders, and volunteer calls.</span></article>
              <article className="mini-row"><strong>4. Attach imams and coordinators</strong><span>Add team members so users know who represents the masjid.</span></article>
            </div>
          </section>
          {user.accountType === 'ADMIN' && (
            <>
            <section className="panel">
              <div className="section-title"><h2>Platform Overview</h2><span>Admin</span></div>
              <div className="metric-grid compact">
                <article className="metric-card"><span>Users</span><strong>{adminStats.users}</strong><em>Community members</em></article>
                <article className="metric-card"><span>Masjids/MSAs</span><strong>{adminStats.masjids}</strong><em>Organization profiles</em></article>
                <article className="metric-card"><span>Imams</span><strong>{adminStats.imams}</strong><em>Religious service accounts</em></article>
                <article className="metric-card"><span>Posts</span><strong>{adminStats.posts}</strong><em>Organization content</em></article>
                <article className="metric-card"><span>Opportunities</span><strong>{adminStats.opportunities}</strong><em>Jobs and volunteer listings</em></article>
                <article className="metric-card"><span>Reports</span><strong>{adminStats.reports}</strong><em>Moderation queue</em></article>
              </div>
            </section>
            <section className="panel">
              <div className="section-title"><h2>Reports & Settings</h2><span>Launch</span></div>
              <div className="stack-list">
                <article className="mini-row"><strong>Reports queue</strong><span>No report model yet. Add backend reports before enabling public report actions.</span></article>
                <article className="mini-row"><strong>Role management</strong><span>Use the searchable role table below for admins, masjids, imams, businesses, and users.</span></article>
                <article className="mini-row"><strong>Production readiness</strong><span>Neon migration is committed. Render should run Prisma migrate/deploy before starting the API.</span></article>
                <article className="mini-row"><strong>Content oversight</strong><span>Use search plus dashboard filters to review posts, programs, jobs, volunteers, and applications.</span></article>
              </div>
            </section>
            <section className="panel">
              <div className="section-title"><h2>User Roles</h2></div>
              <div className="stack-list">
                {users.filter((person) => person.id !== user.id).filter((person) => !query || `${person.name} ${person.email} ${person.accountType} ${person.city || ''}`.toLowerCase().includes(query)).map((person) => (
                  <article className="mini-row" key={person.id}>
                    <strong>{person.name}</strong>
                    <span>{person.email}</span>
                    <select value={person.accountType} onChange={(event) => updateRole(person.id, event.target.value)}>
                      {['USER', 'MASJID', 'MSA', 'IMAM', 'STUDENT_OF_KNOWLEDGE', 'BUSINESS', 'ADMIN'].map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                    <button className="secondary-button danger" onClick={() => deleteUser(person.id)}>Delete user</button>
                  </article>
                ))}
              </div>
            </section>
            </>
          )}
        </aside>
      </div>
      )}
    </Page>
  );
}

function Page({ title, subtitle, action, children }) {
  return <section className="page">{title && <div className="page-header"><div><p className="eyebrow">Ummah Connect</p><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action && <button className="primary-button" onClick={action.onClick}><Plus size={18} />{action.label}</button>}</div>}{children}</section>;
}

function BackHeader({ title, subtitle, onBack }) {
  return (
    <div className="back-header">
      <button className="icon-button" onClick={onBack} aria-label="Go back"><ChevronLeft size={22} /></button>
      <div>
        <strong>{title}</strong>
        {subtitle && <span>{subtitle}</span>}
      </div>
    </div>
  );
}

function TagRow({ tags = [] }) {
  if (!tags.length) return null;
  return <div className="tag-row">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>;
}

function AuthenticatedApp() {
  const locationRoute = useLocation();
  const navigate = useNavigate();
  const tab = tabForPath(locationRoute.pathname);
  function setTab(key, id) {
    navigate(pathForTab(key, id));
  }
  const [user, setUser] = useState(() => storedUser());
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [myOrganizations, setMyOrganizations] = useState([]);
  const [connections, setConnections] = useState([]);
  const [messages, setMessages] = useState([]);
  const [threads, setThreads] = useState([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [messagePage, setMessagePage] = useState({ nextCursor: null, hasMore: false, loadingOlder: false });
  const [socket, setSocket] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [typingUserIds, setTypingUserIds] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const selectedUserIdRef = useRef(null);
  const [viewedUser, setViewedUser] = useState(null);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [profileSocial, setProfileSocial] = useState({ connections: [], followingMasjids: [], favoriteMasjids: [], savedEvents: [], affiliatedMasjids: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState(defaultLocation);
  const [locationStatus, setLocationStatus] = useState('Waiting for browser location permission.');
  const [masjids, setMasjids] = useState([]);
  const [prayerTimes, setPrayerTimes] = useState(prayers);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [notificationState, setNotificationState] = useState({ permission: 'default', message: '' });
  const [prayerPreferences, setPrayerPreferences] = useState({ enabled: false, offsetMinutes: 0, prayers: { Fajr: true, Dhuhr: true, Asr: true, Maghrib: true, Isha: true } });
  const [notificationPreferences, setNotificationPreferences] = useState(defaultNotificationPreferences);
  const [whatsappSettings, setWhatsappSettings] = useState({ phone: '', enabled: false, integrationEnabled: false, serviceConfigured: false });
  const [dashboardOrganizationsState, setDashboardOrganizationsState] = useState({ loading: false, error: '' });
  const eventsLoadedRef = useRef(false);
  const organizationsLoadedRef = useRef(false);
  const myOrganizationsLoadedRef = useRef(false);
  const locationDataLoadedRef = useRef(false);

  async function bootstrap() {
    if (!token()) return;
    const me = await api('/api/me');
    persistAuth(me);
    setUser(me);
    const results = await Promise.allSettled([
      loadNetwork(),
      loadOrganizations(),
      loadPosts(),
      loadEvents(),
      loadOpportunities(),
      loadMyOrganizations(me),
      loadProfileSocial(me.id),
      loadThreads(),
      loadNotificationMasjids(),
      loadNotificationPreferences(),
      loadNotificationHistory()
    ]);
    const failed = results.filter((result) => result.status === 'rejected');
    if (failed.length) console.warn('Some startup data failed to load; keeping the signed-in session.', failed.map((result) => result.reason?.message || result.reason));
  }

  async function loadNetwork() {
    if (!token()) return;
    const [loadedUsers, loadedConnections] = await Promise.all([api('/api/users'), api('/api/connections')]);
    setUsers(loadedUsers);
    setConnections(loadedConnections);
  }

  async function loadEvents(options = {}) {
    try {
      const loadedEvents = await api('/api/events');
      if (options.preserveCurrent && eventsLoadedRef.current && events.length && !loadedEvents.length) {
        console.warn('Event refresh returned no events; keeping the current event list.');
        return events;
      }
      eventsLoadedRef.current = true;
      setEvents(loadedEvents);
      return loadedEvents;
    } catch (error) {
      if (!eventsLoadedRef.current) {
        eventsLoadedRef.current = true;
        setEvents(seedEvents);
        return seedEvents;
      }
      console.warn('Event refresh failed; keeping the current event list.', error);
      return events;
    }
  }

  async function loadOrganizations(options = {}) {
    try {
      const loadedOrganizations = await api('/api/organizations');
      if (options.preserveCurrent && organizationsLoadedRef.current && masjids.length && !loadedOrganizations.length) {
        console.warn('Organization refresh returned no masjids; keeping the current masjid list.');
        return masjids;
      }
      organizationsLoadedRef.current = true;
      setMasjids(loadedOrganizations);
      return loadedOrganizations;
    } catch (error) {
      if (!organizationsLoadedRef.current) {
        organizationsLoadedRef.current = true;
        setMasjids(seedOrganizationsWithoutPrograms);
        return seedOrganizationsWithoutPrograms;
      }
      console.warn('Organization refresh failed; keeping the current masjid list.', error);
      return masjids;
    }
  }

  async function loadPosts() {
    const loadedPosts = await api('/api/posts').catch(() => []);
    setPosts(loadedPosts);
  }

  async function toggleSavePost(post) {
    if (!post?.id) return;
    await api(`/api/posts/${post.id}/save`, { method: post.isSaved ? 'DELETE' : 'POST' });
    await loadPosts();
  }

  async function toggleLikePost(post) {
    if (!post?.id) return;
    await api(`/api/posts/${post.id}/like`, { method: post.isLiked ? 'DELETE' : 'POST' });
    await loadPosts();
  }

  async function addPostComment(post, content) {
    if (!post?.id) return;
    await api(`/api/posts/${post.id}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
    await loadPosts();
  }

  async function deletePostComment(post, comment) {
    if (!post?.id || !comment?.id) return;
    await api(`/api/posts/${post.id}/comments/${comment.id}`, { method: 'DELETE' });
    await loadPosts();
  }

  async function loadOpportunities() {
    const loaded = await api('/api/opportunities').catch(() => []);
    setOpportunities(loaded);
  }

  async function loadMyOrganizations(currentUser = user, options = {}) {
    if (!canManageOrgs(currentUser)) {
      setMyOrganizations([]);
      setDashboardOrganizationsState({ loading: false, error: '' });
      return;
    }
    setDashboardOrganizationsState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const loaded = await api('/api/me/organizations');
      if (!Array.isArray(loaded)) throw new Error('The server returned an unexpected dashboard response.');
      if (options.preserveCurrent && myOrganizationsLoadedRef.current && myOrganizations.length && !loaded.length) {
        console.warn('Dashboard organization refresh returned no masjids; keeping the current dashboard list.');
        setDashboardOrganizationsState({ loading: false, error: '' });
        return myOrganizations;
      }
      myOrganizationsLoadedRef.current = true;
      setMyOrganizations(loaded);
      setDashboardOrganizationsState({ loading: false, error: '' });
      return loaded;
    } catch (error) {
      setDashboardOrganizationsState({ loading: false, error: error?.message || 'Please check your connection and try again.' });
      if (!myOrganizationsLoadedRef.current) {
        myOrganizationsLoadedRef.current = true;
        setMyOrganizations([]);
        return [];
      }
      console.warn('Dashboard organization refresh failed; keeping the current dashboard list.', error);
      return myOrganizations;
    }
  }

  async function loadProfileSocial(userId) {
    const loaded = await api(`/api/users/${userId}/social`).catch(() => ({ connections: [], followingMasjids: [], favoriteMasjids: [], savedEvents: [], affiliatedMasjids: [] }));
    setProfileSocial({ connections: loaded.connections || [], followingMasjids: loaded.followingMasjids || [], favoriteMasjids: loaded.favoriteMasjids || [], savedEvents: loaded.savedEvents || [], affiliatedMasjids: loaded.affiliatedMasjids || [] });
  }

  async function loadNotificationMasjids() {
    const orgs = await api('/api/me/notification-masjids').catch(() => []);
    orgs.forEach(schedulePrayerNotification);
  }

  async function loadNotificationPreferences() {
    const loaded = await api('/api/notifications/preferences').catch(() => null);
    if (!loaded) return;
    if (loaded.prayerNotificationPreferences) setPrayerPreferences(loaded.prayerNotificationPreferences);
    if (loaded.notificationPreferences) setNotificationPreferences({ ...defaultNotificationPreferences, ...loaded.notificationPreferences });
    if (loaded.whatsapp) setWhatsappSettings(loaded.whatsapp);
    setNotificationState({
      permission: 'Notification' in window ? Notification.permission : 'unsupported',
      message: loaded.pushConfigured ? `${loaded.subscriptionCount || 0} device subscription${loaded.subscriptionCount === 1 ? '' : 's'} saved.` : 'Push delivery needs VAPID keys on the backend.'
    });
    const saved = loaded.location || {};
    if (saved.latitude && saved.longitude) {
      setLocation({ label: saved.location || saved.city || 'Saved location', latitude: saved.latitude, longitude: saved.longitude });
    }
  }

  async function enablePushNotifications() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotificationState({ permission: 'unsupported', message: 'This browser does not support PWA push notifications.' });
      return;
    }
    if (!isStandalonePwa() && /iphone|ipad|ipod/i.test(navigator.userAgent)) {
      setNotificationState({ permission: Notification.permission, message: 'On iPhone, add Ummah Connect to your Home Screen and open it from the app icon before enabling notifications.' });
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      setNotificationState({ permission, message: 'Notifications were not enabled.' });
      return;
    }
    const { publicKey, enabled } = await api('/api/notifications/vapid-public-key');
    if (!enabled || !publicKey) {
      setNotificationState({ permission, message: 'Backend VAPID keys are not configured yet, but your local permission is enabled.' });
      if (!prayerPreferences.enabled) updatePrayerPreferences({ ...prayerPreferences, enabled: true }).catch(console.error);
      return;
    }
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    await api('/api/notifications/subscriptions', { method: 'POST', body: JSON.stringify({ subscription }) });
    setNotificationState({ permission, message: 'Notifications are enabled for this device.' });
    if (!prayerPreferences.enabled) updatePrayerPreferences({ ...prayerPreferences, enabled: true }).catch(console.error);
    loadNotificationPreferences().catch(console.error);
  }

  async function loadNotificationHistory() {
    const loaded = await api('/api/notifications/history').catch(() => ({ notifications: [], unread: 0 }));
    setNotificationHistory(loaded.notifications || []);
    setNotificationUnread(loaded.unread || 0);
    return loaded;
  }

  async function openNotifications() {
    setShowNotifications(true);
    const loaded = await loadNotificationHistory();
    if ((loaded.unread || 0) > 0) {
      const result = await api('/api/notifications/history/read', { method: 'PUT', body: JSON.stringify({}) }).catch(() => null);
      if (result) setNotificationUnread(result.unread || 0);
      setNotificationHistory((current) => current.map((item) => item.readAt ? item : { ...item, readAt: new Date().toISOString() }));
    }
  }

  async function updatePrayerPreferences(nextPreferences) {
    setPrayerPreferences(nextPreferences);
    const updated = await api('/api/notifications/preferences', { method: 'PUT', body: JSON.stringify({ prayerNotificationPreferences: nextPreferences }) });
    setUser(updated);
    persistAuth(updated);
    if (updated.notificationPreferences) setNotificationPreferences({ ...defaultNotificationPreferences, ...updated.notificationPreferences });
  }

  async function updateNotificationPreferences(nextPreferences) {
    setNotificationPreferences(nextPreferences);
    const updated = await api('/api/notifications/preferences', { method: 'PUT', body: JSON.stringify({ notificationPreferences: nextPreferences }) });
    if (updated.notificationPreferences) setNotificationPreferences({ ...defaultNotificationPreferences, ...updated.notificationPreferences });
  }

  async function updateWhatsAppSettings(nextSettings) {
    const updated = await api('/api/notifications/preferences', { method: 'PUT', body: JSON.stringify({ whatsapp: nextSettings }) });
    if (updated.whatsapp) setWhatsappSettings(updated.whatsapp);
    if (updated.notificationPreferences) setNotificationPreferences({ ...defaultNotificationPreferences, ...updated.notificationPreferences });
    return updated.whatsapp;
  }

  async function saveManualLocation(nextLocation) {
    const label = nextLocation.trim();
    if (!label) return;
    const updated = await api('/api/notifications/preferences', { method: 'PUT', body: JSON.stringify({ location: { city: label, location: label, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }) });
    setUser(updated);
    persistAuth(updated);
    setLocationStatus(`Saved ${label}. Use current location anytime for precise prayer times.`);
  }

  async function loadMessages(userId) {
    if (!userId) return;
    const loaded = await api(`/api/messages/${userId}?limit=30`);
    setMessages(loaded.messages || loaded);
    setMessagePage({ nextCursor: loaded.nextCursor || null, hasMore: Boolean(loaded.hasMore), loadingOlder: false });
  }
  async function loadThreads() {
    const loaded = await api('/api/messages/threads').catch(() => ({ threads: [] }));
    setThreads(Array.isArray(loaded) ? loaded : loaded.threads || []);
    if (!Array.isArray(loaded)) setUnreadTotal(loaded.unreadTotal || 0);
    if (loaded.onlineUserIds) setOnlineUserIds(loaded.onlineUserIds);
  }

  async function loadOlderMessages(userId) {
    if (!userId || !messagePage.hasMore || messagePage.loadingOlder) return;
    setMessagePage((page) => ({ ...page, loadingOlder: true }));
    const loaded = await api(`/api/messages/${userId}?limit=30&before=${encodeURIComponent(messagePage.nextCursor)}`);
    setMessages((current) => [...(loaded.messages || []), ...current]);
    setMessagePage({ nextCursor: loaded.nextCursor || null, hasMore: Boolean(loaded.hasMore), loadingOlder: false });
  }

  function mergeMessage(message) {
    setMessages((current) => {
      const exists = current.some((item) => item.id === message.id);
      if (exists) return current.map((item) => (item.id === message.id ? message : item));
      const inCurrentThread = selectedUserIdRef.current && [message.senderId, message.receiverId].includes(selectedUserIdRef.current);
      return inCurrentThread ? [...current, message] : current;
    });
  }

  async function reactToMessage(messageId, emoji) {
    const updated = await api(`/api/messages/${messageId}/reactions`, { method: 'POST', body: JSON.stringify({ emoji }) });
    mergeMessage(updated);
  }

  async function applyToOpportunity(id, form = {}) {
    await api(`/api/opportunities/${id}/apply`, { method: 'POST', body: JSON.stringify(form) });
    const organizationId = selectedOrganization?.opportunities?.find((item) => item.id === id)?.organizationId || selectedOrganization?.id;
    const refreshedOrganization = organizationId ? await api(`/api/organizations/${organizationId}`).catch(() => null) : null;
    await Promise.all([loadOpportunities(), loadMyOrganizations(), loadNotificationHistory()]);
    if (refreshedOrganization && selectedOrganization?.id === refreshedOrganization.id) setSelectedOrganization(refreshedOrganization);
  }

  async function registerEvent(id) {
    await api(`/api/events/${id}/register`, { method: 'POST' });
    await Promise.all([loadEvents(), loadMyOrganizations()]);
  }

  async function unregisterEvent(id) {
    await api(`/api/events/${id}/register`, { method: 'DELETE' });
    await Promise.all([loadEvents(), loadMyOrganizations()]);
  }

  async function toggleEventSubscription(event, next = {}) {
    if (!user) return alert('Log in to save events and enable reminders.');
    await api(`/api/events/${event.id}/subscribe`, { method: 'POST', body: JSON.stringify({ saved: next.saved ?? !event.isSaved, notify: next.notify ?? !event.notifyMe }) });
    await Promise.all([loadEvents(), loadProfileSocial(user.id)]);
  }

  async function createOpportunity(organizationId, form) {
    await api(`/api/organizations/${organizationId}/opportunities`, { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadMyOrganizations(), loadOpportunities(), loadPosts(), loadLocationData(location), loadNotificationHistory()]);
  }

  async function updateOpportunity(id, form) {
    await api(`/api/opportunities/${id}`, { method: 'PUT', body: JSON.stringify(form) });
    await Promise.all([loadMyOrganizations(), loadOpportunities(), loadLocationData(location)]);
  }

  async function createPost(organizationId, form) {
    await api(`/api/organizations/${organizationId}/posts`, { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadPosts(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function updatePost(id, form) {
    await api(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(form) });
    await Promise.all([loadPosts(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function createEvent(form) {
    await api('/api/events', { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadEvents(), loadPosts(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function updateEvent(id, form) {
    await api(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(form) });
    await Promise.all([loadEvents(), loadPosts(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function deletePost(id) {
    if (!confirm('Delete this post?')) return;
    await api(`/api/posts/${id}`, { method: 'DELETE' });
    await Promise.all([loadPosts(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    await api(`/api/events/${id}`, { method: 'DELETE' });
    await Promise.all([loadEvents(), loadPosts(), loadMyOrganizations(), loadLocationData(location)]);
  }

  async function deleteOpportunity(id) {
    if (!confirm('Delete this job or opportunity?')) return;
    await api(`/api/opportunities/${id}`, { method: 'DELETE' });
    await Promise.all([loadMyOrganizations(), loadOpportunities(), loadLocationData(location)]);
  }

  async function createOrganization(form) {
    const created = await api('/api/organizations', { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadNetwork(), loadMyOrganizations(), loadLocationData(location)]);
    return created;
  }

  async function onboardOrganization(id, form) {
    const onboarded = await api(`/api/organizations/${id}/onboard`, { method: 'POST', body: JSON.stringify(form) });
    await Promise.all([loadNetwork(), loadMyOrganizations(), loadLocationData(location)]);
    if (selectedOrganization?.id === id && onboarded?.organization) setSelectedOrganization(onboarded.organization);
    return onboarded;
  }

  async function updateOrganization(id, form) {
    const updated = await api(`/api/organizations/${id}`, { method: 'PUT', body: JSON.stringify(form) });
    await Promise.all([loadMyOrganizations(), loadOrganizations(), loadLocationData(location)]);
    if (selectedOrganization?.id === id) setSelectedOrganization({ ...selectedOrganization, ...updated });
  }

  async function addOrganizationPerson(id, form) {
    await api(`/api/organizations/${id}/people`, { method: 'POST', body: JSON.stringify(form) });
    const refreshed = await api(`/api/organizations/${id}`);
    await Promise.all([loadMyOrganizations(), loadLocationData(location), loadProfileSocial(user.id)]);
    if (selectedOrganization?.id === id) setSelectedOrganization(refreshed);
  }

  async function inviteOrganizationPerson(id, form) {
    const invited = await api(`/api/organizations/${id}/people/invite`, { method: 'POST', body: JSON.stringify(form) });
    const refreshed = await api(`/api/organizations/${id}`);
    await Promise.all([loadNetwork(), loadMyOrganizations(), loadLocationData(location), loadProfileSocial(user.id)]);
    if (selectedOrganization?.id === id) setSelectedOrganization(refreshed);
    return invited;
  }

  async function removeOrganizationPerson(id, userId) {
    await api(`/api/organizations/${id}/people/${userId}`, { method: 'DELETE' });
    const refreshed = await api(`/api/organizations/${id}`).catch(() => null);
    await Promise.all([loadMyOrganizations(), loadLocationData(location), loadProfileSocial(user.id)]);
    if (selectedOrganization?.id === id && refreshed) setSelectedOrganization(refreshed);
  }

  async function removeOrganizationFollower(id, userId) {
    if (!confirm('Remove this follower from the masjid?')) return;
    await api(`/api/organizations/${id}/followers/${userId}`, { method: 'DELETE' });
    const refreshed = await api(`/api/organizations/${id}`).catch(() => null);
    await Promise.all([loadMyOrganizations(), loadLocationData(location), loadPosts()]);
    if (selectedOrganization?.id === id && refreshed) setSelectedOrganization(refreshed);
  }

  async function updateApplication(opportunityId, applicationId, data) {
    await api(`/api/opportunities/${opportunityId}/applications/${applicationId}`, { method: 'PUT', body: JSON.stringify(data) });
    await Promise.all([loadMyOrganizations(), loadOpportunities()]);
  }

  async function bulkUpdateApplications(opportunityId, data) {
    await api(`/api/opportunities/${opportunityId}/applications`, { method: 'PUT', body: JSON.stringify(data) });
    await Promise.all([loadMyOrganizations(), loadOpportunities()]);
  }

  async function updateRegistration(eventId, registrationId, status) {
    await api(`/api/events/${eventId}/registrations/${registrationId}`, { method: 'PUT', body: JSON.stringify({ status }) });
    await Promise.all([loadEvents(), loadMyOrganizations()]);
  }

  async function bulkUpdateRegistrations(eventId, data) {
    await api(`/api/events/${eventId}/registrations`, { method: 'PUT', body: JSON.stringify(data) });
    await Promise.all([loadEvents(), loadMyOrganizations()]);
  }

  async function unsendMessage(messageId) {
    const updated = await api(`/api/messages/${messageId}`, { method: 'DELETE' });
    mergeMessage(updated);
  }

  function sendTyping(receiverId, isTyping) {
    if (!socket || !receiverId) return;
    socket.emit(isTyping ? 'typing:start' : 'typing:stop', { receiverId });
  }

  async function loadLocationData(nextLocation) {
    const [masjidResult, prayerResult] = await Promise.allSettled([
      api(`/api/location/masjids?lat=${nextLocation.latitude}&lng=${nextLocation.longitude}`),
      api(`/api/prayer-times?lat=${nextLocation.latitude}&lng=${nextLocation.longitude}&city=${encodeURIComponent(nextLocation.label || '')}&date=${Math.floor(Date.now() / 1000)}`)
    ]);
    if (masjidResult.status === 'fulfilled') {
      const masjidData = masjidResult.value;
      setMasjids((current) => {
        const stateById = new Map(current.map((item) => [String(item.id), {
          isFollowing: item.isFollowing,
          isFavorited: item.isFavorited,
          notifyPrayers: item.notifyPrayers,
          followerCount: item.followerCount
        }]));
        return withLocalDistance(masjidData, nextLocation).map((item) => {
          const previous = stateById.get(String(item.id));
          return previous ? { ...item, ...Object.fromEntries(Object.entries(previous).filter(([, value]) => value !== undefined)) } : item;
        });
      });
    } else {
      setMasjids(withLocalDistance(seedOrganizationsWithoutPrograms, nextLocation));
    }
    if (prayerResult.status === 'fulfilled') {
      const timings = prayerResult.value.timings || {};
      setPrayerTimes(prayers.map((item) => ({ ...item, adhan: (timings[item.name] || item.adhan).slice(0, 5) })));
    } else {
      setPrayerTimes(prayers);
    }
  }

  function schedulePrayerNotification(org) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const iqamah = dashboardIqamahTimes(org);
    const now = new Date();
    const candidates = prayers.map((prayer) => {
      const time = iqamah[prayer.name] || prayer.iqamah;
      if (!time) return null;
      const [hour, minute] = String(time).split(':').map(Number);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
      const when = new Date();
      when.setHours(hour, minute - 15, 0, 0);
      return when > now ? { prayer: prayer.name, when } : null;
    }).filter(Boolean);
    const next = candidates.sort((a, b) => a.when - b.when)[0];
    if (!next) return;
    const key = `${org.id}:${next.prayer}:${next.when.toDateString()}`;
    if (notificationTimers.has(key)) clearTimeout(notificationTimers.get(key));
    const timer = setTimeout(() => {
      showPrayerNotification(`${next.prayer} iqamah soon`, `${org.name} congregation starts in 15 minutes.`, key).catch(console.error);
      notificationTimers.delete(key);
    }, next.when.getTime() - now.getTime());
    notificationTimers.set(key, timer);
  }

  function scheduleLocationPrayerNotifications(times = prayerTimes, preferences = prayerPreferences) {
    if (!preferences.enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
    const now = new Date();
    times.forEach((prayer) => {
      if (!['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].includes(prayer.name) || preferences.prayers?.[prayer.name] === false) return;
      const [hour, minute] = String(prayer.adhan || '').split(':').map(Number);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
      const when = new Date();
      when.setHours(hour, minute - Number(preferences.offsetMinutes || 0), 0, 0);
      if (when <= now) return;
      const key = `location:${prayer.name}:${when.toDateString()}:${preferences.offsetMinutes || 0}`;
      if (notificationTimers.has(key)) clearTimeout(notificationTimers.get(key));
      const timer = setTimeout(() => {
        const prefix = preferences.offsetMinutes ? `${preferences.offsetMinutes} minutes until` : '';
        showPrayerNotification(`${prefix} ${prayer.name} time`.trim(), preferences.offsetMinutes ? `${prayer.name} time starts soon.` : `${prayer.name} time has started.`, key).catch(console.error);
        notificationTimers.delete(key);
      }, when.getTime() - now.getTime());
      notificationTimers.set(key, timer);
    });
  }

  async function openOrganization(id) {
    const localOrg = masjids.find((item) => String(item.id) === String(id)) || seedOrganizationsWithoutPrograms.find((item) => String(item.id) === String(id));
    const org = await api(`/api/organizations/${id}`).catch(() => localOrg);
    if (!org) return alert('This masjid profile is not available yet.');
    setSelectedOrganization(org);
    setTab('masjidProfile', id);
  }

  async function followOrganization(id, notifyPrayers = false) {
    if (!user) return alert('Log in to follow masjids and manage notifications.');
    if (notifyPrayers && notificationState.permission !== 'granted') {
      await enablePushNotifications();
      if ('Notification' in window && Notification.permission !== 'granted') return alert('Notifications were not enabled.');
    }
    const result = await api(`/api/organizations/${id}/follow`, { method: 'POST', body: JSON.stringify({ notifyPrayers }) });
    const org = result.organization || await api(`/api/organizations/${id}`);
    setSelectedOrganization(org);
    setMasjids((current) => current.map((item) => String(item.id) === String(id) ? { ...item, ...org } : item));
    if (notifyPrayers) schedulePrayerNotification(org);
    await Promise.all([loadOrganizations({ preserveCurrent: true }), loadPosts(), loadEvents({ preserveCurrent: true }), loadProfileSocial(user.id), loadNotificationMasjids()]);
  }

  async function unfollowOrganization(id) {
    if (!user) return alert('Log in to manage followed masjids.');
    const result = await api(`/api/organizations/${id}/follow`, { method: 'DELETE' });
    const org = result.organization || (selectedOrganization?.id === id ? await api(`/api/organizations/${id}`).catch(() => null) : null);
    if (org) {
      setSelectedOrganization(org);
      setMasjids((current) => current.map((item) => String(item.id) === String(id) ? { ...item, ...org } : item));
    }
    await Promise.all([loadOrganizations({ preserveCurrent: true }), loadPosts(), loadEvents({ preserveCurrent: true }), loadProfileSocial(user.id), loadNotificationMasjids()]);
  }

  async function toggleFavoriteOrganization(id, isFavorited = false) {
    if (!user) return alert('Log in to favorite masjids.');
    await api(`/api/organizations/${id}/favorite`, { method: isFavorited ? 'DELETE' : 'POST' });
    const org = selectedOrganization?.id === id ? await api(`/api/organizations/${id}`).catch(() => null) : null;
    if (org) setSelectedOrganization(org);
    await Promise.all([loadLocationData(location), loadPosts(), loadEvents(), loadProfileSocial(user.id)]);
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
        api('/api/notifications/preferences', {
          method: 'PUT',
          body: JSON.stringify({ location: { location: next.label, latitude: next.latitude, longitude: next.longitude, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } })
        }).then((updated) => {
          setUser(updated);
          persistAuth(updated);
        }).catch(console.error);
        loadLocationData(next);
      },
      () => {
        setLocationStatus('Location permission denied. Showing Milton fallback data.');
        loadLocationData(defaultLocation);
      },
      { enableHighAccuracy: true, timeout: 9000 }
    );
  }

  useEffect(() => {
    bootstrap().catch((error) => {
      if ([401, 403].includes(error?.status)) {
        logout();
        return;
      }
      console.warn('Session restore failed; keeping cached user until the connection recovers.', error);
    });
  }, []);
  useEffect(() => {
    const landingPath = user && (isOrganizationAccount(user) || isImamAccount(user)) ? pathForTab('dashboard') : pathForTab('home');
    if (locationRoute.pathname === '/') navigate(user ? landingPath : '/login', { replace: true });
    if (user && ['/login', '/register'].includes(locationRoute.pathname)) navigate(landingPath, { replace: true });
  }, [locationRoute.pathname, navigate, Boolean(user), user?.accountType]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);
  useEffect(() => {
    if (!user || locationDataLoadedRef.current) return;
    locationDataLoadedRef.current = true;
    setLocationStatus('Showing Milton fallback data. Enable location to find nearby masjids and accurate prayer times.');
    loadLocationData(defaultLocation);
  }, [Boolean(user)]);
  useEffect(() => { scheduleLocationPrayerNotifications(prayerTimes, prayerPreferences); }, [prayerTimes, prayerPreferences, notificationState.permission]);
  useEffect(() => { selectedUserIdRef.current = selectedUser?.id || null; }, [selectedUser?.id]);
  useEffect(() => {
    if (!user || tab !== 'masjidProfile') return;
    const id = routeId(locationRoute.pathname, '/masjids/');
    if (id && String(selectedOrganization?.id) !== String(id)) openOrganization(id).catch(console.error);
  }, [user?.id, tab, locationRoute.pathname, selectedOrganization?.id]);
  useEffect(() => {
    if (!user || tab !== 'messages') return;
    const id = routeId(locationRoute.pathname, '/messages/');
    if (!id) {
      if (selectedUser) {
        setSelectedUser(null);
        setMessages([]);
      }
      return;
    }
    const person = users.find((item) => String(item.id) === String(id));
    if (person && String(selectedUser?.id) !== String(id)) setSelectedUser(person);
    if (String(selectedUser?.id) !== String(id)) loadMessages(id).catch(console.error);
  }, [user?.id, tab, locationRoute.pathname, users, selectedUser?.id]);
  useEffect(() => {
    if (!user || tab !== 'profile') return;
    const id = routeId(locationRoute.pathname, '/profile/');
    if (!id || id === 'me' || id === 'edit') {
      if (viewedUser) {
        setViewedUser(null);
        loadProfileSocial(user.id).catch(console.error);
      }
      return;
    }
    const person = users.find((item) => String(item.id) === String(id));
    if (person && String(viewedUser?.id) !== String(id)) {
      setViewedUser(person);
      loadProfileSocial(person.id).catch(console.error);
    }
  }, [user?.id, tab, locationRoute.pathname, users, viewedUser?.id]);
  useEffect(() => {
    function refreshOnFocus() {
      if (document.visibilityState === 'visible') {
        loadLocationData(location);
        loadOrganizations({ preserveCurrent: true });
        loadPosts();
        loadEvents({ preserveCurrent: true });
        loadMyOrganizations(user, { preserveCurrent: true });
        loadNotificationHistory();
      }
    }
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => document.removeEventListener('visibilitychange', refreshOnFocus);
  }, [location, user?.id]);

  useEffect(() => {
    if (!user) return undefined;
    let inFlight = false;
    async function refreshEventSurfaces() {
      if (document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      try {
        await Promise.all([
          loadEvents({ preserveCurrent: true }),
          loadOrganizations({ preserveCurrent: true }),
          loadPosts(),
          loadMyOrganizations(user, { preserveCurrent: true }),
          loadProfileSocial(user.id)
        ]);
      } catch (error) {
        console.error('Event auto-refresh failed', error);
      } finally {
        inFlight = false;
      }
    }
    const interval = window.setInterval(refreshEventSurfaces, EVENT_AUTO_REFRESH_MS);
    window.addEventListener('focus', refreshEventSurfaces);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshEventSurfaces);
    };
  }, [location, user?.id]);

  useEffect(() => {
    if (!user || !token()) return undefined;
    const nextSocket = io(API, { auth: { token: token() }, transports: ['websocket', 'polling'] });
    setSocket(nextSocket);
    nextSocket.on('message:new', (message) => {
      mergeMessage(message);
      const isIncoming = message.receiverId === user.id && message.senderId !== user.id;
      const viewingThread = selectedUserIdRef.current && String(selectedUserIdRef.current) === String(message.senderId);
      if (isIncoming && !viewingThread && !notifiedMessageIds.has(message.id)) {
        notifiedMessageIds.add(message.id);
        showAppNotification({
          title: `New message from ${message.sender?.name || 'Mujtama'}`,
          body: message.content?.slice(0, 120) || 'Open Mujtama to view this message.',
          tag: `message:${message.id}`,
          url: `/messages/${message.senderId}`
        }).catch(console.error);
      }
      loadThreads().catch(console.error);
      loadNotificationHistory().catch(console.error);
    });
    nextSocket.on('message:update', (message) => {
      mergeMessage(message);
      loadThreads().catch(console.error);
    });
    nextSocket.on('presence:update', ({ onlineUserIds: ids = [] }) => setOnlineUserIds(ids));
    nextSocket.on('messages:unread', ({ unread = 0 }) => setUnreadTotal(unread));
    nextSocket.on('typing:update', ({ userId, isTyping }) => {
      setTypingUserIds((current) => {
        const filtered = current.filter((id) => id !== userId);
        return isTyping ? [...filtered, userId] : filtered;
      });
    });
    return () => nextSocket.disconnect();
  }, [user?.id]);

  useEffect(() => {
    if (!socket || !selectedUser?.id) return undefined;
    socket.emit('thread:join', { otherUserId: selectedUser.id });
    return () => socket.emit('thread:leave', { otherUserId: selectedUser.id });
  }, [socket, selectedUser?.id]);

  function logout() {
    clearAuth();
    setUser(null);
    setUsers([]);
    setPosts([]);
    setConnections([]);
    setMessages([]);
    setThreads([]);
    setUnreadTotal(0);
    locationDataLoadedRef.current = false;
    setSocket((activeSocket) => {
      activeSocket?.disconnect();
      return null;
    });
    setOnlineUserIds([]);
    setTypingUserIds([]);
  }

  function afterLogin(nextUser) {
    persistAuth(nextUser);
    setUser(nextUser);
    const landingTab = isOrganizationAccount(nextUser) || isImamAccount(nextUser) ? 'dashboard' : 'home';
    navigate(pathForTab(landingTab), { replace: true });
    setTimeout(() => bootstrap().catch(console.error), 0);
  }

  function openProfile(person) {
    setViewedUser(person);
    loadProfileSocial(person.id).catch(console.error);
    setTab('profile', person.id);
  }

  function startMessage(person) {
    setSelectedUser(person);
    setTab('messages', person.id);
    loadMessages(person.id).catch(console.error);
  }

  function handleSearchSelect(result) {
    if (result.kind === 'User') {
      const person = users.find((item) => item.id === result.id);
      if (person) return openProfile(person);
    }
    if (result.kind === 'Masjid') return openOrganization(result.id).catch(console.error);
    if (result.kind === 'Event') return setTab('events', result.id);
    if (result.kind === 'Job') setTab('jobs');
    else if (result.kind === 'Volunteer') setTab('volunteers');
    else setTab(result.tab);
  }

  const otherUsers = users.filter((person) => person.id !== user?.id);
  const routeEventId = tab === 'events' ? routeId(locationRoute.pathname, '/events/') : '';
  const routeMessageUserId = tab === 'messages' ? routeId(locationRoute.pathname, '/messages/') : '';
  const isDetailRoute = tab === 'masjidProfile' || Boolean(routeEventId) || Boolean(routeMessageUserId) || (tab === 'profile' && routeId(locationRoute.pathname, '/profile/') && !['me', 'edit'].includes(routeId(locationRoute.pathname, '/profile/')));
  const favoriteMasjids = profileSocial.favoriteMasjids || [];
  const favoriteMasjidIds = new Set(favoriteMasjids.map((org) => org.id));
  const followedMasjidIds = new Set(profileSocial.followingMasjids.map((org) => org.id));
  const favoriteRank = (organizationId) => favoriteMasjidIds.has(organizationId) ? 2 : followedMasjidIds.has(organizationId) ? 1 : 0;
  const prioritizedMasjids = [...masjids].sort((a, b) => favoriteRank(b.id) - favoriteRank(a.id) || Number(b.followerCount || 0) - Number(a.followerCount || 0));
  const prioritizedPosts = [...posts].sort((a, b) => Number(b.isFromFavoriteMasjid || favoriteMasjidIds.has(b.organization?.id)) - Number(a.isFromFavoriteMasjid || favoriteMasjidIds.has(a.organization?.id)) || Number(b.isFromFollowedMasjid || followedMasjidIds.has(b.organization?.id)) - Number(a.isFromFollowedMasjid || followedMasjidIds.has(a.organization?.id)) || new Date(b.createdAt) - new Date(a.createdAt));
  const prioritizedEvents = [...events].sort((a, b) => favoriteRank(b.organizationId || b.organization?.id) - favoriteRank(a.organizationId || a.organization?.id) || new Date(a.startTime || 0) - new Date(b.startTime || 0));
  const prioritizedOpportunities = [...opportunities].sort((a, b) => favoriteRank(b.organizationId || b.organization?.id) - favoriteRank(a.organizationId || a.organization?.id) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const mobileBaseTabs = isOrganizationAccount(user) || isImamAccount(user) ? ['dashboard', 'messages', 'organizations', 'prayer', 'profile'] : mobileNavKeys;
  const visibleMobileTabs = mobileBaseTabs.filter((key) => hasPreference(user, key));
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    const index = [
      ...users.map((person) => ({ id: person.id, kind: 'User', title: person.name, subtitle: `${person.accountType} ${person.city || ''} ${safeList(person.skills).join(' ')}`, tab: 'network' })),
      ...prioritizedPosts.map((post) => ({ id: post.id, kind: 'Post', title: post.title, subtitle: `${post.organization?.name || ''} ${post.type} ${post.content || ''}`, tab: 'home' })),
      ...prioritizedMasjids.map((masjid) => ({ id: masjid.id, kind: 'Masjid', title: masjid.name, subtitle: `${masjid.address || ''} ${masjid.city || ''}`, tab: 'organizations' })),
      ...prioritizedEvents.map((event) => ({ id: event.id, kind: 'Event', title: event.title, subtitle: `${event.description || ''} ${event.location || ''}`, tab: 'events' })),
      ...prioritizedOpportunities.map((item) => ({ id: item.id, kind: item.type === 'JOB' ? 'Job' : 'Volunteer', title: item.title, subtitle: `${item.organization?.name || ''} ${item.description || ''} ${item.location || ''} ${Array.isArray(item.skills) ? item.skills.join(' ') : item.skills || ''}`, tab: item.type === 'JOB' ? 'jobs' : 'volunteers' })),
      ...lectures.map((lecture) => ({ id: lecture.id, kind: 'Lecture', title: lecture.title, subtitle: `${lecture.speaker} ${lecture.category}`, tab: 'library' })),
      ...businesses.map((business) => ({ id: business.id, kind: 'Business', title: business.name, subtitle: `${business.category} ${business.city}`, tab: 'businesses' }))
    ];
    return index.filter((item) => `${item.kind} ${item.title} ${item.subtitle}`.toLowerCase().includes(query)).slice(0, 8);
  }, [searchQuery, users, prioritizedPosts, prioritizedMasjids, prioritizedEvents, prioritizedOpportunities]);

  if (!user) return <div className="app auth-only"><AuthScreen onLogin={afterLogin} initialMode={locationRoute.pathname === '/register' ? 'register' : 'login'} /></div>;

  const screens = {
    home: <HomeScreen user={user} posts={prioritizedPosts} masjids={prioritizedMasjids} favoriteMasjids={favoriteMasjids} locationStatus={locationStatus} requestLocation={requestLocation} prayerTimes={prayerTimes} setTab={setTab} openOrganization={openOrganization} toggleLikePost={toggleLikePost} toggleSavePost={toggleSavePost} addPostComment={addPostComment} deletePostComment={deletePostComment} notificationState={notificationState} enablePushNotifications={enablePushNotifications} prayerPreferences={prayerPreferences} />,
    prayer: <PrayerScreen user={user} prayerTimes={prayerTimes} favoriteMasjids={favoriteMasjids} myOrganizations={myOrganizations} locationStatus={locationStatus} requestLocation={requestLocation} notificationState={notificationState} enablePushNotifications={enablePushNotifications} prayerPreferences={prayerPreferences} updatePrayerPreferences={updatePrayerPreferences} saveManualLocation={saveManualLocation} openOrganization={openOrganization} setTab={setTab} />,
    events: <EventsScreen user={user} events={prioritizedEvents} masjids={prioritizedMasjids} loadEvents={loadEvents} loadPosts={loadPosts} myOrganizations={myOrganizations} registerEvent={registerEvent} unregisterEvent={unregisterEvent} toggleEventSubscription={toggleEventSubscription} detailEventId={routeEventId} openEvent={(id) => setTab('events', id)} openOrganization={openOrganization} onBack={() => navigate(-1)} />,
    post: <PostEventScreen setTab={setTab} createEvent={createEvent} myOrganizations={myOrganizations} />,
    organizations: <OrganizationsScreen masjids={prioritizedMasjids} locationStatus={locationStatus} requestLocation={requestLocation} openOrganization={openOrganization} />,
    masjidProfile: <MasjidProfileScreen organization={selectedOrganization} user={user} onFollow={followOrganization} onUnfollow={unfollowOrganization} onFavorite={toggleFavoriteOrganization} onMessage={startMessage} applyToOpportunity={applyToOpportunity} onBack={() => navigate(-1)} />,
    network: <NetworkScreen user={user} users={users} connections={connections} loadNetwork={loadNetwork} openProfile={openProfile} startMessage={startMessage} />,
    volunteers: <OpportunitiesScreen user={user} opportunities={prioritizedOpportunities} type="VOLUNTEER" applyToOpportunity={applyToOpportunity} updateNotificationPreferences={updateNotificationPreferences} notificationPreferences={notificationPreferences} title="Volunteer Marketplace" subtitle="Apply for masjid-approved service opportunities. Hours only count after masjid approval." />,
    jobs: <OpportunitiesScreen user={user} opportunities={prioritizedOpportunities} type="JOB" applyToOpportunity={applyToOpportunity} updateNotificationPreferences={updateNotificationPreferences} notificationPreferences={notificationPreferences} title="Jobs" subtitle="Separate job category for paid and professional Muslim community opportunities." />,
    library: <LibraryScreen />,
    businesses: <BusinessDirectoryScreen />,
    messages: <MessagesScreen currentUser={user} users={otherUsers} selectedUser={selectedUser} setSelectedUser={setSelectedUser} messages={messages} threads={threads} loadMessages={loadMessages} loadOlderMessages={loadOlderMessages} loadThreads={loadThreads} messagePage={messagePage} sendTyping={sendTyping} onlineUserIds={onlineUserIds} typingUserIds={typingUserIds} reactToMessage={reactToMessage} unsendMessage={unsendMessage} detailMode={Boolean(routeMessageUserId)} onThreadOpen={(person) => setTab('messages', person.id)} onBackToInbox={() => { setSelectedUser(null); setMessages([]); setTab('messages'); }} />,
    profile: <ProfileScreen user={user} viewedUser={viewedUser} onCloseViewed={() => { setViewedUser(null); loadProfileSocial(user.id); navigate('/profile/me'); }} onSave={(updated) => { setUser(updated); persistAuth(updated); loadNetwork(); }} social={profileSocial} onFavorite={toggleFavoriteOrganization} openOrganization={openOrganization} openEvent={(id) => setTab('events', id)} />,
    settings: <SettingsScreen user={user} social={profileSocial} notificationPreferences={notificationPreferences} updateNotificationPreferences={updateNotificationPreferences} whatsappSettings={whatsappSettings} updateWhatsAppSettings={updateWhatsAppSettings} onSave={(updated) => { setUser(updated); persistAuth(updated); loadNetwork(); }} onFavorite={toggleFavoriteOrganization} onUnfollow={unfollowOrganization} openOrganization={openOrganization} openEvent={(id) => setTab('events', id)} logout={logout} theme={theme} setTheme={setTheme} />,
    dashboard: isImamAccount(user) ? <ImamDashboard user={user} social={profileSocial} setTab={setTab} /> : <AdminScreen user={user} users={users} threads={threads} loadNetwork={loadNetwork} loadMyOrganizations={loadMyOrganizations} myOrganizations={myOrganizations} dashboardOrganizationsState={dashboardOrganizationsState} createOrganization={createOrganization} onboardOrganization={onboardOrganization} updateOrganization={updateOrganization} createOpportunity={createOpportunity} updateOpportunity={updateOpportunity} createPost={createPost} updatePost={updatePost} createEvent={createEvent} updateEvent={updateEvent} deletePost={deletePost} deleteEvent={deleteEvent} updateApplication={updateApplication} bulkUpdateApplications={bulkUpdateApplications} updateRegistration={updateRegistration} bulkUpdateRegistrations={bulkUpdateRegistrations} deleteOpportunity={deleteOpportunity} addOrganizationPerson={addOrganizationPerson} inviteOrganizationPerson={inviteOrganizationPerson} removeOrganizationPerson={removeOrganizationPerson} removeOrganizationFollower={removeOrganizationFollower} openProfile={openProfile} openOrganization={openOrganization} startMessage={startMessage} setTab={setTab} />
  };

  return (
    <>
      <Shell
        user={user}
        tab={tab}
        setTab={setTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        onSearchSelect={handleSearchSelect}
        onLogout={logout}
        hasDashboardAccess={myOrganizations.length > 0 || isImamAccount(user)}
        onNotificationsClick={openNotifications}
        notificationUnread={notificationUnread}
        openSettings={() => setTab('settings')}
        detailMode={isDetailRoute}
        mobileTabs={visibleMobileTabs}
      >
        {screens[tab] || screens.home}
      </Shell>
     
      <section className={isDetailRoute ? 'mobile-bottom-nav detail-hidden' : 'mobile-bottom-nav'}>
        {visibleMobileTabs.map((key) => navItems.find((item) => item.key === key)).filter(Boolean).map((item) => {
          const Icon = item.icon;
          const label = item.key === 'profile' && isUserAccount(user) ? 'People' : item.label;
          return <button key={item.key} className={tab === item.key ? 'active' : ''} onClick={() => setTab(item.key)}><Icon size={19} /><span>{label}</span>{item.key === 'messages' && unreadTotal > 0 && <em>{unreadTotal > 9 ? '9+' : unreadTotal}</em>}</button>;
        })}
      </section>
        {showNotifications && (
  <div className="modal-backdrop" onClick={() => setShowNotifications(false)}>
    <div className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
      <div className="sheet-header">
        <h2>Notifications</h2>
        <button onClick={() => setShowNotifications(false)}>×</button>
      </div>

      <div className="people-list">
        {notificationHistory.map((item) => (
          <button className={item.readAt ? 'person-list-row notification-row' : 'person-list-row notification-row unread'} key={item.id} onClick={() => { setShowNotifications(false); if (item.url) navigate(item.url); }}>
            <div>
              <strong>{item.title}</strong>
              {item.body && <p>{item.body}</p>}
              <span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : item.type}</span>
            </div>
          </button>
        ))}
        {!notificationHistory.length && (
          <article className="person-list-row">
            <div>
              <strong>No notifications yet</strong>
              <span>Messages, followed masjid posts, events, and prayer reminders will appear here.</span>
            </div>
          </article>
        )}
      </div>
    </div>
  </div>
)}
      <div className="app-glow" />
    </>
  );
}

export default function App() {
  const displayMatch = window.location.pathname.match(/^\/display\/([^/]+)\/?$/);
  if (displayMatch) {
    return <MasjidTvDisplay masjidId={decodeURIComponent(displayMatch[1])} apiBase={API} />;
  }
  return <AuthenticatedApp />;
}
