import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Megaphone, MoonStar } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const REFRESH_INTERVAL_MS = 60_000;
const SLIDE_INTERVAL_MS = 10_000;
const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

function fallbackDisplay(masjidId) {
  return {
    masjidName: 'Mujtama Masjid Display',
    logoUrl: '/icons/mujtama-icon-192.png',
    appUrl: window.location.origin,
    announcement: 'Welcome. Live masjid information will appear here when the display connects.',
    prayers: prayerNames.map((name) => ({ name, adhan: '--:--', iqamah: '--:--' })),
    jummahTimes: ['Time to be announced'],
    events: [
      {
        id: `fallback-${masjidId}`,
        title: 'Upcoming community events',
        description: 'Event posters and details will rotate here.',
        startTime: null,
        imageUrl: ''
      }
    ]
  };
}

function resolveMediaUrl(value, apiBase, appUrl) {
  if (!value) return '';
  try {
    return new URL(value).toString();
  } catch {
    const base = value.startsWith('/uploads') ? apiBase : (appUrl || window.location.origin);
    return new URL(value, `${String(base).replace(/\/$/, '')}/`).toString();
  }
}

function eventDate(value) {
  if (!value) return 'Coming soon';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Coming soon';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export default function MasjidTvDisplay({ masjidId, apiBase }) {
  const [display, setDisplay] = useState(() => fallbackDisplay(masjidId));
  const [clock, setClock] = useState(() => new Date());
  const [slideIndex, setSlideIndex] = useState(0);
  const [usingFallback, setUsingFallback] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const response = await fetch(`${apiBase}/api/display/${encodeURIComponent(masjidId)}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Display request failed (${response.status})`);
        const data = await response.json();
        if (!active) return;
        setDisplay({ ...fallbackDisplay(masjidId), ...data });
        setUsingFallback(false);
      } catch (error) {
        console.warn('TV display is using fallback data.', error);
        if (active) setUsingFallback(true);
      }
    }
    refresh();
    const timer = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [apiBase, masjidId]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const events = display.events?.length ? display.events : fallbackDisplay(masjidId).events;
  useEffect(() => {
    setSlideIndex(0);
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % Math.max(events.length, 1));
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [events.length]);

  const activeEvent = events[slideIndex % events.length];
  const appUrl = display.appUrl || window.location.origin;
  const logoUrl = resolveMediaUrl(display.logoUrl, apiBase, appUrl);
  const eventImage = resolveMediaUrl(activeEvent?.imageUrl, apiBase, appUrl);
  const prayers = useMemo(() => {
    const source = Array.isArray(display.prayers) ? display.prayers : [];
    return prayerNames.map((name) => source.find((item) => item.name?.toLowerCase() === name.toLowerCase()) || { name, adhan: '--:--', iqamah: '--:--' });
  }, [display.prayers]);

  return (
    <main className="tv-display">
      <header className="tv-display-header">
        <div className="tv-display-masjid">
          <div className="tv-display-logo">
            {logoUrl ? <img src={logoUrl} alt="" /> : <MoonStar size={42} />}
          </div>
          <div>
            <p>Welcome to</p>
            <h1>{display.masjidName}</h1>
          </div>
        </div>
        <div className="tv-display-clock" aria-label="Current time and date">
          <strong>{clock.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>
          <span>{clock.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </header>

      <section className="tv-display-grid">
        <div className="tv-display-prayer-panel">
          <div className="tv-display-section-title"><Clock3 size={25} /><span>Today&apos;s prayer times</span></div>
          <div className="tv-display-prayer-head"><span>Prayer</span><span>Adhan</span><span>Iqamah</span></div>
          <div className="tv-display-prayer-list">
            {prayers.map((prayer) => (
              <div className="tv-display-prayer-row" key={prayer.name}>
                <strong>{prayer.name}</strong>
                <span>{prayer.adhan || '--:--'}</span>
                <em>{prayer.iqamah || '--:--'}</em>
              </div>
            ))}
          </div>
          <div className="tv-display-jummah">
            <div><MoonStar size={24} /><strong>Jumu&apos;ah</strong></div>
            <div>{(display.jummahTimes?.length ? display.jummahTimes : ['Time to be announced']).map((time, index) => <span key={`${time}-${index}`}>{time}</span>)}</div>
          </div>
        </div>

        <article className="tv-display-event-panel">
          {eventImage ? (
            <img className="tv-display-event-image" src={eventImage} alt="" />
          ) : (
            <div className="tv-display-event-placeholder"><CalendarDays size={76} /><span>Upcoming event</span></div>
          )}
          <div className="tv-display-event-shade" />
          <div className="tv-display-event-copy">
            <p>Coming up</p>
            <h2>{activeEvent?.title || 'Community event'}</h2>
            <div><CalendarDays size={21} />{eventDate(activeEvent?.startTime)}</div>
            {activeEvent?.location && <div><MapPin size={21} />{activeEvent.location}</div>}
          </div>
          {events.length > 1 && (
            <div className="tv-display-slide-dots">
              {events.map((event, index) => <span className={index === slideIndex ? 'active' : ''} key={event.id || `${event.title}-${index}`} />)}
            </div>
          )}
        </article>
      </section>

      <footer className="tv-display-footer">
        <div className="tv-display-announcement">
          <Megaphone size={28} />
          <strong>Announcement</strong>
          <div className="tv-display-ticker"><span>{display.announcement || 'Welcome to our masjid.'}</span></div>
        </div>
        <div className="tv-display-qr">
          <QRCodeSVG value={appUrl} size={118} bgColor="#ffffff" fgColor="#102b27" level="M" marginSize={1} />
          <div><strong>Join Mujtama</strong><span>Scan for the app</span></div>
        </div>
      </footer>

      {usingFallback && <div className="tv-display-sync-status">Live data reconnecting</div>}
    </main>
  );
}
