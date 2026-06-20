export const standardPrayerKeys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Jumuah'];

export const masjidAnnouncementTypes = [
  { value: 'GENERAL', label: 'General announcement', postType: 'ANNOUNCEMENT' },
  { value: 'EVENT_UPDATE', label: 'Event update', postType: 'EVENT' },
  { value: 'CLASS_REMINDER', label: 'Class reminder', postType: 'CLASS' },
  { value: 'JUMUAH_UPDATE', label: 'Jumuah update', postType: 'REMINDER' },
  { value: 'FUNDRAISER_NOTICE', label: 'Fundraiser notice', postType: 'FUNDRAISER' },
  { value: 'RAMADAN_EID_NOTICE', label: 'Ramadan/Eid notice', postType: 'ANNOUNCEMENT' },
  { value: 'CANCELLATION_NOTICE', label: 'Cancellation notice', postType: 'REMINDER' },
  { value: 'VOLUNTEER_REQUEST', label: 'Volunteer request', postType: 'VOLUNTEER' }
];

export const emptyAdditionalPrayer = { name: '', time: '', jamatTime: '', notes: '' };
export const emptyTemporaryPrayer = { name: '', time: '', jamatTime: '', startsAt: '', endsAt: '', notes: '' };

export function dashboardIqamahTimes(organization = {}) {
  const standard = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Jumuah'];
  const current = organization.prayerTimes || {};
  if (standard.some((name) => current[name] || current[name.toLowerCase()])) return current;
  return organization.iqamahTimes || organization.iqamah || {};
}

export function cleanPrayerRows(rows = [], temporary = false) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      id: row.id || `${temporary ? 'temp' : 'custom'}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: (row.name || '').trim(),
      time: (row.time || '').trim(),
      jamatTime: (row.jamatTime || row.iqamahTime || '').trim(),
      notes: (row.notes || '').trim(),
      ...(temporary ? { startsAt: row.startsAt || '', endsAt: row.endsAt || '' } : {})
    }))
    .filter((row) => row.name || row.time || row.jamatTime || row.notes || row.startsAt || row.endsAt);
}

export function buildPrayerEditForm(org = {}) {
  const apiPrayer = org.iqamahTimes || {};
  const jamat = org.prayerTimes || {};
  return {
    Fajr: apiPrayer.Fajr || apiPrayer.fajr || '',
    FajrJamat: jamat.Fajr || jamat.fajr || '',
    Dhuhr: apiPrayer.Dhuhr || apiPrayer.dhuhr || '',
    DhuhrJamat: jamat.Dhuhr || jamat.dhuhr || '',
    Asr: apiPrayer.Asr || apiPrayer.asr || '',
    AsrJamat: jamat.Asr || jamat.asr || '',
    Maghrib: apiPrayer.Maghrib || apiPrayer.maghrib || '',
    MaghribJamat: jamat.Maghrib || jamat.maghrib || '',
    Isha: apiPrayer.Isha || apiPrayer.isha || '',
    IshaJamat: jamat.Isha || jamat.isha || '',
    Jumuah: apiPrayer.Jumuah || apiPrayer.jumuah || '',
    JumuahJamat: jamat.Jumuah || jamat.jumuah || '',
    prayerNotes: org.prayerNotes || apiPrayer.notes || '',
    additionalPrayers: cleanPrayerRows(apiPrayer.additionalPrayers || []),
    temporaryPrayers: cleanPrayerRows(apiPrayer.temporaryPrayers || [], true)
  };
}

export function directionsUrl(item) {
  const query = item.latitude && item.longitude ? `${item.latitude},${item.longitude}` : encodeURIComponent(item.address || item.location || item.name);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
