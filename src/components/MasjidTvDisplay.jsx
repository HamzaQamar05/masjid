// frontend/src/pages/MasjidTvDisplay.jsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import './MasjidTvDisplay.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

function formatTime(value) {
  if (!value) return '--:--';
  return value;
}

function getNextPrayer(prayers) {
  const now = new Date();
  const today = now.toDateString();

  return prayers
    .map((p) => {
      const [rawTime, period] = String(p.athan || p.time || '').split(' ');
      if (!rawTime) return null;

      let [hours, minutes] = rawTime.split(':').map(Number);
      if (period?.toLowerCase() === 'pm' && hours !== 12) hours += 12;
      if (period?.toLowerCase() === 'am' && hours === 12) hours = 0;

      const date = new Date(today);
      date.setHours(hours, minutes || 0, 0, 0);

      return { ...p, date };
    })
    .filter(Boolean)
    .find((p) => p.date > now);
}

export default function MasjidTvDisplay() {
  const { masjidId } = useParams();
  const [data, setData] = useState(null);
  const [activeEvent, setActiveEvent] = useState(0);
  const [now, setNow] = useState(new Date());

  async function loadDisplay() {
    const res = await fetch(`${API_BASE}/api/display/${masjidId}`);
    if (!res.ok) throw new Error('Failed to load display');
    setData(await res.json());
  }

  useEffect(() => {
    loadDisplay().catch(console.error);
    const refresh = setInterval(() => loadDisplay().catch(console.error), 60_000);
    return () => clearInterval(refresh);
  }, [masjidId]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const slider = setInterval(() => {
      setActiveEvent((current) => {
        const total = data?.events?.length || 1;
        return (current + 1) % total;
      });
    }, 9000);

    return () => clearInterval(slider);
  }, [data?.events?.length]);

  const prayers = data?.prayers || [];
  const events = data?.events || [];
  const currentEvent = events[activeEvent];
  const nextPrayer = useMemo(() => getNextPrayer(prayers), [prayers, now]);

  if (!data) {
    return (
      <main className="tv-display loading">
        <h1>Loading Masjid Display...</h1>
      </main>
    );
  }

  return (
    <main className="tv-display">
      <section className="tv-header">
        <div className="brand">
          <img src={data.logoUrl || '/logo.png'} alt="Masjid logo" />
          <div>
            <h1>{data.masjidName}</h1>
            <p>Prayer Times • Events • Announcements</p>
          </div>
        </div>

        <div className="clock">
          <strong>
            {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          </strong>
          <span>
            {now.toLocaleDateString([], {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </span>
        </div>
      </section>

      <section className="tv-grid">
        <aside className="prayer-panel">
          <div className="next-prayer">
            <span>Next Prayer</span>
            <strong>{nextPrayer?.name || '—'}</strong>
          </div>

          <div className="prayer-table">
            <div className="table-head">
              <span>Salah</span>
              <span>Athan</span>
              <span>Iqamah</span>
            </div>

            {prayers.map((prayer) => (
              <div
                className={`prayer-row ${nextPrayer?.name === prayer.name ? 'active' : ''}`}
                key={prayer.name}
              >
                <span>{prayer.name}</span>
                <strong>{formatTime(prayer.athan || prayer.time)}</strong>
                <strong>{formatTime(prayer.iqamah)}</strong>
              </div>
            ))}
          </div>

          <div className="jummah-card">
            <span>Jummah</span>
            <strong>{data.jummahTimes?.join(' • ') || 'Ask masjid admin'}</strong>
          </div>
        </aside>

        <section className="event-stage">
          {currentEvent ? (
            <>
              <div className="event-image-wrap">
                <img
                  src={currentEvent.imageUrl || currentEvent.coverImageUrl}
                  alt={currentEvent.title}
                  className="event-image"
                />
              </div>

              <div className="event-footer">
                <div>
                  <span>Upcoming Event</span>
                  <h2>{currentEvent.title}</h2>
                  <p>{currentEvent.dateLabel || currentEvent.startTime || ''}</p>
                </div>

                <div className="event-count">
                  {activeEvent + 1}/{events.length}
                </div>
              </div>
            </>
          ) : (
            <div className="no-events">
              <h2>No upcoming events</h2>
              <p>Follow this masjid on Ummah Connect for updates.</p>
            </div>
          )}
        </section>

        <aside className="qr-panel">
          <div>
            <span>Scan to Follow</span>
            <h2>{data.masjidName}</h2>
          </div>

          <img
            src={data.qrCodeUrl || `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(data.appUrl)}`}
            alt="QR code"
            className="qr"
          />

          <p>Open Ummah Connect on your phone</p>
        </aside>
      </section>

      <section className="ticker">
        <span>Announcements</span>
        <p>{data.announcement || 'Welcome to the masjid. Please keep your phones silent during salah.'}</p>
      </section>
    </main>
  );
}
