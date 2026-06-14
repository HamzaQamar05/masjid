export const defaultLocation = {
  label: 'Milton, ON',
  latitude: 43.5183,
  longitude: -79.8774
};

export const prayers = [
  { name: 'Fajr', adhan: '4:12', iqamah: '5:00' },
  { name: 'Dhuhr', adhan: '1:18', iqamah: '1:45' },
  { name: 'Asr', adhan: '5:24', iqamah: '6:00' },
  { name: 'Maghrib', adhan: '9:01', iqamah: '9:06' },
  { name: 'Isha', adhan: '10:32', iqamah: '10:50' }
];

export const seedOrganizations = [
  {
    id: 'fallback-masjid-khadijah',
    name: 'Masjid Khadijah',
    type: 'Masjid',
    city: 'Milton',
    address: '100 Nipissing Rd #7, Milton, ON L9T 5B2',
    latitude: 43.5208,
    longitude: -79.8799,
    website: 'https://www.masjidkhadijah.ca/',
    verified: true,
    followers: 0,
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAG1hTGWxftDLG9i0WQ_2uIZJPisi_2wJDOOAspxSGUSwTYWagkU40-aLxAGKguVNGA5fB4xXmItnNNEawW1sK5b3-5waHTelMmYGv0AhYW7WdHxoxWJu5r164GBDHdFJRKo4KJH=s1360-w1360-h1020-rw',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAG1hTGWxftDLG9i0WQ_2uIZJPisi_2wJDOOAspxSGUSwTYWagkU40-aLxAGKguVNGA5fB4xXmItnNNEawW1sK5b3-5waHTelMmYGv0AhYW7WdHxoxWJu5r164GBDHdFJRKo4KJH=s1360-w1360-h1020-rw',
    cover: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAG1hTGWxftDLG9i0WQ_2uIZJPisi_2wJDOOAspxSGUSwTYWagkU40-aLxAGKguVNGA5fB4xXmItnNNEawW1sK5b3-5waHTelMmYGv0AhYW7WdHxoxWJu5r164GBDHdFJRKo4KJH=s1360-w1360-h1020-rw',
    tags: ['Prayer', 'Milton', 'Community'],
    facilities: ['Prayer hall', 'Community programs'],
    description: 'Milton masjid profile placeholder. Prayer preferences, programs, and announcements can be customized after onboarding.'
  },
  {
    id: 'imam-bukhari-centre',
    name: 'Imam Bukhari Centre',
    type: 'Masjid',
    city: 'Milton',
    address: 'Unit 7 and 8, 50 Steeles Avenue East, Milton, ON',
    latitude: 43.5239,
    longitude: -79.8891,
    website: 'https://ahlehadithcanada.org/toronto/',
    email: 'toronto@ahlehadithcanada.org',
    phone: '+1-647-549-7909',
    verified: true,
    followers: 0,
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEp8gOXT75AzDMNd1XH4h5D1rb_90r684Buuhy5zM6LrFMnzhJTMcPf0Phh9GiIvmQCHdchvQZAmX1lTXV-Q2tIIPC2cLXxEMagADr7qfzmA0aqVWruJUAD7T5Pr0YqM7YlP54DDw=s1360-w1360-h1020-rw',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEp8gOXT75AzDMNd1XH4h5D1rb_90r684Buuhy5zM6LrFMnzhJTMcPf0Phh9GiIvmQCHdchvQZAmX1lTXV-Q2tIIPC2cLXxEMagADr7qfzmA0aqVWruJUAD7T5Pr0YqM7YlP54DDw=s1360-w1360-h1020-rw',
    cover: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEp8gOXT75AzDMNd1XH4h5D1rb_90r684Buuhy5zM6LrFMnzhJTMcPf0Phh9GiIvmQCHdchvQZAmX1lTXV-Q2tIIPC2cLXxEMagADr7qfzmA0aqVWruJUAD7T5Pr0YqM7YlP54DDw=s1360-w1360-h1020-rw',
    tags: ['Prayer', 'Education', 'Lectures', 'Programs'],
    facilities: ['Daily prayers', 'Jumuah', 'Current programs', 'Recorded lectures', 'Donation support'],
    iqamah: { Fajr: '4:14 AM', Dhuhr: '2:00 PM', Asr: '5:41 PM', Maghrib: '9:09 PM', Isha: '10:54 PM', Jumuah: '2:00 PM' },
    prayerNotes: 'Prayer timings shown from Ahle Hadith Society of Canada Toronto page for Sunday, Jun 14, 2026. Jumuah is listed at 2:00 PM.',
    classes: [
      { id: 'ibc-ittiba', title: 'Ittiba and rejection of Taqlid', teacher: 'Ahle-Hadith Society of Canada', dayTime: 'Current program', description: 'Series of virtual lectures in English on foundations and distinctive features of the methodology.', registrationLink: 'https://ahlehadithcanada.org/toronto/' },
      { id: 'ibc-ahadith-worship', title: 'Ahadith of Worship', teacher: 'Faculty of Hadith of Toronto', dayTime: 'Current program', description: 'Arabic lecture series with simultaneous translation.', registrationLink: 'https://ahlehadithcanada.org/toronto/' },
      { id: 'ibc-friday-halaqa', title: 'Friday Halaqa Series', teacher: 'Imam Bukhari Centre', dayTime: 'Fridays', description: 'Ongoing Friday halaqa programming listed by the centre.', registrationLink: 'https://ahlehadithcanada.org/toronto/' }
    ],
    campaign: { name: "Support the Da'wah", goal: 190000, raised: 125000 },
    description: "Imam Bukhari Centre is part of the Ahle-Hadith Society of Canada Toronto community, offering daily prayers, Jumu'ah, current programs, lectures, announcements, and donation-supported da'wah work."
  },
  {
    id: 'fallback-hlc',
    name: 'HLC',
    type: 'Masjid',
    city: 'Milton',
    address: 'Derry Rd W, Milton, ON L9E 1G5',
    latitude: 43.4938,
    longitude: -79.8768,
    website: 'https://miltonmasjid.com/',
    verified: true,
    followers: 0,
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAFQhv5kM-N9e90r-azxNOWGwgtbjCX7A7dF1qy3O4weJZ5nObq2ZsTSR7aRyVHCe0CUy2CoUAStxSQZO4nf_rN8RkQFqm0AGeBej0ooE-jHhDprNdi6lGYez8kl407FDxAREaUK=s294-w294-h220-n-k-no',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAFQhv5kM-N9e90r-azxNOWGwgtbjCX7A7dF1qy3O4weJZ5nObq2ZsTSR7aRyVHCe0CUy2CoUAStxSQZO4nf_rN8RkQFqm0AGeBej0ooE-jHhDprNdi6lGYez8kl407FDxAREaUK=s294-w294-h220-n-k-no',
    cover: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAFQhv5kM-N9e90r-azxNOWGwgtbjCX7A7dF1qy3O4weJZ5nObq2ZsTSR7aRyVHCe0CUy2CoUAStxSQZO4nf_rN8RkQFqm0AGeBej0ooE-jHhDprNdi6lGYez8kl407FDxAREaUK=s294-w294-h220-n-k-no',
    tags: ['Prayer', 'Learning', 'Milton'],
    facilities: ['Musalla', 'Learning programs'],
    description: 'Halton Learning Centre musalla profile placeholder. Program details can be completed after onboarding.'
  },
  {
    id: 'hicc',
    name: 'HICC Masjid',
    type: 'Masjid',
    city: 'Milton / Oakville',
    address: '4269 Regional Road 25, Oakville, ON',
    latitude: 43.4818,
    longitude: -79.8141,
    website: 'https://miltonmasjid.com/',
    email: 'info@miltonmasjid.com',
    verified: true,
    followers: 5120,
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAF_9wZlIKxlIt1WnDcHp_emB27qwNp6BZTHp9HNgnC15Y-97Bhl5PkX_cYvrLVKzlV9S8PikDBpmAQ0g_04y2q0sQS9VNssdw4x90j86qHXLhR2gPq_hQpkm4RjVLIWdyJSm3nSUw=s1360-w1360-h1020-rw',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAF_9wZlIKxlIt1WnDcHp_emB27qwNp6BZTHp9HNgnC15Y-97Bhl5PkX_cYvrLVKzlV9S8PikDBpmAQ0g_04y2q0sQS9VNssdw4x90j86qHXLhR2gPq_hQpkm4RjVLIWdyJSm3nSUw=s1360-w1360-h1020-rw',
    cover: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAF_9wZlIKxlIt1WnDcHp_emB27qwNp6BZTHp9HNgnC15Y-97Bhl5PkX_cYvrLVKzlV9S8PikDBpmAQ0g_04y2q0sQS9VNssdw4x90j86qHXLhR2gPq_hQpkm4RjVLIWdyJSm3nSUw=s1360-w1360-h1020-rw',
    tags: ['Quran Classes', 'Hifz', 'Food Bank', 'Youth'],
    facilities: ['Parking', 'Quran classes', 'Hifz', 'Food bank'],
    iqamah: { Fajr: '5:15', Dhuhr: '1:40', Asr: '6:15', Maghrib: '9:08', Isha: '10:45' },
    campaign: { name: 'Food bank operations', goal: 30000, raised: 18420 },
    description: 'Serving Milton, Oakville, Burlington, and surrounding communities through prayer, Quran programs, food bank, and youth work.'
  },
  {
    id: 'fallback-iccm',
    name: 'ICCM',
    type: 'Masjid',
    city: 'Milton',
    address: '8069 Esquesing Line, Milton, ON L9T 7L4',
    latitude: 43.5403,
    longitude: -79.8427,
    website: 'https://icna.ca/iccm/',
    verified: true,
    followers: 0,
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEZPUwRU_97UB1etCJ4ev5ES9XmN4n846cQ6Ih5H0Ffb53Iu6OHYwGWYmSD0b3CEIRKaG2q5-qzi-GEzB9A38NscJgrCghhmkCO0fBKsnkw_1pvECHwQ2ajlB2li8BLmsTSpmU9-w=s1360-w1360-h1020-rw',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEZPUwRU_97UB1etCJ4ev5ES9XmN4n846cQ6Ih5H0Ffb53Iu6OHYwGWYmSD0b3CEIRKaG2q5-qzi-GEzB9A38NscJgrCghhmkCO0fBKsnkw_1pvECHwQ2ajlB2li8BLmsTSpmU9-w=s1360-w1360-h1020-rw',
    cover: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEZPUwRU_97UB1etCJ4ev5ES9XmN4n846cQ6Ih5H0Ffb53Iu6OHYwGWYmSD0b3CEIRKaG2q5-qzi-GEzB9A38NscJgrCghhmkCO0fBKsnkw_1pvECHwQ2ajlB2li8BLmsTSpmU9-w=s1360-w1360-h1020-rw',
    tags: ['Prayer', 'Milton', 'ICNA'],
    facilities: ['Prayer hall', 'Community programs'],
    description: 'Islamic Community Centre of Milton profile placeholder. Details can be completed when the masjid is onboarded.'
  },
  {
    id: 'tmu-msa',
    name: 'TMU MSA',
    type: 'MSA',
    city: 'Toronto',
    address: 'Downtown Toronto',
    latitude: 43.6577,
    longitude: -79.3788,
    website: '#',
    email: 'msa@example.com',
    verified: false,
    followers: 1900,
    cover: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
    tags: ['Students', 'Halaqah', 'Volunteers', 'Mentorship'],
    facilities: ['Student events', 'Speaker invites', 'Volunteer teams'],
    iqamah: { Fajr: 'Campus rooms vary', Dhuhr: '1:30', Asr: '5:45', Maghrib: 'At adhan', Isha: '10:30' },
    campaign: { name: 'Campus iftar fund', goal: 12000, raised: 8300 },
    description: 'Student-led Muslim community for events, halaqahs, networking, and campus support.'
  },
  {
    id: 'mercy-relief',
    name: 'Mercy Relief GTA',
    type: 'Islamic Charity',
    city: 'Greater Toronto Area',
    address: 'Mobile teams across the GTA',
    latitude: 43.589,
    longitude: -79.6441,
    website: '#',
    email: 'volunteer@example.com',
    verified: true,
    followers: 8400,
    cover: 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1200&q=80',
    tags: ['Charity', 'Food Bank', 'Refugee Support', 'Volunteers'],
    facilities: ['Food packing', 'Distribution teams', 'Donation campaigns'],
    campaign: { name: 'Winter relief kits', goal: 45000, raised: 28750 },
    description: 'Volunteer-led relief programs connecting donors and volunteers with local families who need support.'
  }
];

export const seedPeople = [
  {
    id: 'imam-omar',
    name: 'Sh. Omar Rahman',
    accountType: 'IMAM',
    role: 'Imam / Khateeb',
    city: 'GTA',
    areas: ['Seerah', 'Identity', 'Family'],
    skills: ['Khutbah', 'Youth', 'Counselling'],
    availability: 'Available weekends',
    headline: 'Helping youth build confident Muslim identity in public life.'
  },
  {
    id: 'mariam-ali',
    name: 'Ust. Mariam Ali',
    accountType: 'STUDENT_OF_KNOWLEDGE',
    role: 'Quran teacher',
    city: 'Mississauga',
    areas: ['Tafsir', 'Sisters Programs', 'MSA Talks'],
    skills: ['Teaching', 'Tafsir', 'Arabic'],
    availability: 'Open to MSA invites',
    headline: 'Weekend tafsir, sisters circles, and student mentorship.'
  },
  {
    id: 'yusuf-khan',
    name: 'Br. Yusuf Khan',
    accountType: 'BUSINESS',
    role: 'Startup founder',
    city: 'Toronto',
    areas: ['Career', 'Business', 'Mentorship'],
    skills: ['Cloud', 'Cybersecurity', 'Startups'],
    availability: 'Coffee chats',
    headline: 'Cloud engineering mentor for students entering tech.'
  },
  {
    id: 'aisha-ahmed',
    name: 'Aisha Ahmed',
    accountType: 'USER',
    role: 'Volunteer coordinator',
    city: 'Milton',
    areas: ['Youth', 'Volunteering', 'Events'],
    skills: ['Operations', 'Registration', 'Youth'],
    availability: 'Open to help',
    headline: 'Coordinating youth nights, registration desks, and food drives.'
  }
];

export const seedEvents = [
  {
    id: 'local-1',
    type: 'Lecture',
    title: 'Friday Night Reminder',
    host: 'Imam Bukhari Centre',
    organizationId: 'imam-bukhari-centre',
    time: 'Friday, 8:30 PM',
    place: '50 Steeles Ave E, Milton',
    latitude: 43.5239,
    longitude: -79.8891,
    tags: ['Lecture', 'Family', 'Community'],
    capacity: 250,
    going: 242,
    checkedIn: 168,
    waitlist: 0,
    saved: false,
    description: 'A weekly reminder for families with short reflections, Quran recitation, and refreshments.'
  },
  {
    id: 'local-2',
    type: 'Youth',
    title: 'Youth Halaqah and Basketball',
    host: 'HICC Masjid',
    organizationId: 'hicc',
    time: 'Saturday, 7:00 PM',
    place: '4269 Regional Road 25, Oakville',
    latitude: 43.4818,
    longitude: -79.8141,
    tags: ['Youth', 'Halaqah', 'Sports'],
    capacity: 120,
    going: 118,
    checkedIn: 94,
    waitlist: 9,
    saved: true,
    sponsor: 'Sponsored by Crescent Dental',
    description: 'A structured youth night with halaqah, food, and gym time for high school and university students.'
  },
  {
    id: 'local-3',
    type: 'MSA',
    title: 'Campus Iftar Planning',
    host: 'TMU MSA',
    organizationId: 'tmu-msa',
    time: 'Tuesday, 6:00 PM',
    place: 'Downtown Toronto',
    latitude: 43.6577,
    longitude: -79.3788,
    tags: ['MSA', 'Volunteers', 'Students'],
    capacity: 80,
    going: 34,
    checkedIn: 21,
    waitlist: 0,
    saved: false,
    description: 'Planning session for Ramadan iftar logistics, sponsor outreach, and volunteer teams.'
  },
  {
    id: 'local-4',
    type: 'Fundraiser',
    title: 'Winter Relief Packing Night',
    host: 'Mercy Relief GTA',
    organizationId: 'mercy-relief',
    time: 'Sunday, 2:00 PM',
    place: 'Mississauga Warehouse',
    latitude: 43.589,
    longitude: -79.6441,
    tags: ['Charity', 'Family', 'Volunteers'],
    capacity: 300,
    going: 210,
    checkedIn: 132,
    waitlist: 0,
    saved: false,
    description: 'Pack food and hygiene kits for families across the GTA. Student hours can be verified.'
  }
];

export const feedPosts = [
  {
    id: 'post-1',
    org: 'HICC Masjid',
    role: 'Masjid',
    time: '18m',
    type: 'Announcement',
    title: 'Volunteer teams needed for the food bank this weekend',
    body: 'We need help with intake, packing, delivery routing, and setup. Students can receive verified volunteer hours.',
    tags: ['Volunteer', 'Food Bank', 'Students'],
    reactions: 92,
    comments: 14
  },
  {
    id: 'post-2',
    org: 'Sh. Omar Rahman',
    role: 'Imam / Speaker',
    time: '1h',
    type: 'Lecture',
    title: 'New khutbah uploaded: building trust inside the community',
    body: 'Audio and notes are available now. Masjid admins can pin this lecture to their organization page.',
    tags: ['Lecture', 'Khutbah', 'Audio'],
    reactions: 184,
    comments: 26
  },
  {
    id: 'post-3',
    org: 'TMU MSA',
    role: 'MSA',
    time: '3h',
    type: 'Event',
    title: 'Career night: Muslim professionals in cybersecurity',
    body: 'Students can meet mentors, ask questions, and find internship leads. Registration opens tonight.',
    tags: ['MSA', 'Career', 'Mentorship'],
    reactions: 231,
    comments: 37
  }
];

export const volunteerRoles = [
  {
    id: 'vol-1',
    title: 'Food bank intake lead',
    org: 'HICC Masjid',
    organizationId: 'hicc',
    shift: 'Saturday, 10:00 AM',
    hours: 4,
    applicants: 18,
    approved: 12,
    skill: 'Operations',
    status: 'Approved',
    checkIn: '10:00 AM',
    checkOut: '2:00 PM',
    verifiedHours: 4
  },
  {
    id: 'vol-2',
    title: 'Youth night setup crew',
    org: 'Imam Bukhari Centre',
    organizationId: 'imam-bukhari-centre',
    shift: 'Friday, 7:00 PM',
    hours: 3,
    applicants: 11,
    approved: 8,
    skill: 'Events',
    status: 'Pending approval',
    checkIn: null,
    checkOut: null,
    verifiedHours: 0
  },
  {
    id: 'vol-3',
    title: 'Social media editor',
    org: 'TMU MSA',
    organizationId: 'tmu-msa',
    shift: 'Remote',
    hours: 2,
    applicants: 7,
    approved: 3,
    skill: 'Design',
    status: 'Open',
    checkIn: null,
    checkOut: null,
    verifiedHours: 0
  },
  {
    id: 'vol-4',
    title: 'Donation desk support',
    org: 'Mercy Relief GTA',
    organizationId: 'mercy-relief',
    shift: 'Sunday, 1:30 PM',
    hours: 2,
    applicants: 23,
    approved: 16,
    skill: 'Fundraising',
    status: 'Approved',
    checkIn: '1:30 PM',
    checkOut: '3:30 PM',
    verifiedHours: 2
  }
];

export const lectures = [
  { id: 'lec-1', title: 'Tafsir of Surah Al-Kahf', speaker: 'Ust. Mariam Ali', format: 'Audio + notes', category: 'Tafsir', saved: true },
  { id: 'lec-2', title: 'The Seerah for High School Students', speaker: 'Sh. Omar Rahman', format: 'Video', category: 'Seerah', saved: false },
  { id: 'lec-3', title: 'Muslim Identity at Work', speaker: 'Br. Yusuf Khan', format: 'Article', category: 'Career', saved: false }
];

export const businesses = [
  { id: 'biz-1', name: 'Crescent Dental', category: 'Dentist', city: 'Milton', rating: '4.9', sponsor: 'Youth Basketball Night' },
  { id: 'biz-2', name: 'Halal Homes Realty', category: 'Realtor', city: 'GTA', rating: '4.8', sponsor: 'Family Halaqah' },
  { id: 'biz-3', name: 'Noor Tutors', category: 'Tutoring', city: 'Online', rating: '5.0', sponsor: 'Quran Competition' }
];

export const conversations = [
  { id: 'msg-1', name: 'Sh. Omar Rahman', role: 'Imam', preview: 'Wa alaikum assalam, send me the details.', unread: 1, read: true },
  { id: 'msg-2', name: 'HICC Volunteer Team', role: 'Organization', preview: 'Can you help this Saturday from 2pm to 5pm?', unread: 0, read: true },
  { id: 'msg-3', name: 'TMU MSA', role: 'MSA', preview: 'We still need two check-in volunteers.', unread: 3, read: false }
];

export const dashboardMetrics = [
  { label: 'Event registrations', value: '1,248', change: '+18%' },
  { label: 'Volunteer hours', value: '642', change: '+31%' },
  { label: 'Campaign donations', value: '$24.6k', change: '+12%' },
  { label: 'Follower growth', value: '3.2k', change: '+9%' },
  { label: 'Unread messages', value: '14', change: '+6' },
  { label: 'QR check-ins', value: '415', change: '+22%' }
];
