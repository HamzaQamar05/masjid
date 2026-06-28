import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { createServer } from 'http';
import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import webPush from 'web-push';
import { canOperateOrganizationRole, organizationManagerRoleFilters } from './lib/organizationPermissions.js';
import { isAiConfigured, parseAiJson, runAiImageRead, runAiText, runModeration } from './lib/aiService.js';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const app = express();
app.set('trust proxy', 1);
const server = createServer(app);
const prisma = new PrismaClient();
const uploadsDirectory = process.env.UPLOADS_DIR || path.resolve('uploads');
const maxRemoteImageBytes = 8 * 1024 * 1024;

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,
  'https://mujtamaconnect.com',
  'https://www.mujtamaconnect.com',
  ...configuredOrigins
].filter(Boolean);
const allowedOriginSet = new Set(allowedOrigins);
const allowedOriginSuffixes = (process.env.CORS_ALLOWED_SUFFIXES || '')
  .split(',')
  .map((suffix) => suffix.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin || allowedOriginSet.has(origin)) return true;
  return allowedOriginSuffixes.some((suffix) => origin.endsWith(suffix));
}

const io = new Server(server, {
  cors: {
    origin(origin, callback) {
      return callback(null, isAllowedOrigin(origin));
    },
    credentials: true
  }
});
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) : null;
const memoryCache = new Map();
const onlineUsers = new Map();
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || process.env.FRONTEND_URL || 'mailto:admin@ummahconnect.app';
const prayerNotificationJobEnabled = process.env.PRAYER_NOTIFICATION_JOB_ENABLED !== 'false';
const prayerNotificationPollMs = Math.max(30_000, Number(process.env.PRAYER_NOTIFICATION_POLL_MS || 60_000));
const prayerNotificationLookaheadMs = Math.max(prayerNotificationPollMs, Number(process.env.PRAYER_NOTIFICATION_LOOKAHEAD_MS || 90_000));
const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 45,
  standardHeaders: true,
  legacyHeaders: false
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false
});
const notificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false
});
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 35,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.id || 'anonymous'}:${req.params.id || req.body?.organizationId || 'global'}:${req.path}`
});

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'dev_secret')) {
  console.error('SECURITY WARNING: set a strong JWT_SECRET of at least 32 characters before serving production traffic.');
}

if (redis) {
  redis.connect().catch((error) => console.error('Redis unavailable, using memory fallback', error.message));
  redis.on('error', (error) => console.error('Redis error', error.message));
}

if (vapidPublicKey && vapidPrivateKey) {
  webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

const fallbackMasjids = [
  {
    id: 'fallback-masjid-khadijah',
    name: 'Masjid Khadijah',
    type: 'Masjid',
    city: 'Milton',
    address: '100 Nipissing Rd #7, Milton, ON L9T 5B2',
    latitude: 43.5208,
    longitude: -79.8799,
    website: 'https://www.masjidkhadijah.ca/',
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAG1hTGWxftDLG9i0WQ_2uIZJPisi_2wJDOOAspxSGUSwTYWagkU40-aLxAGKguVNGA5fB4xXmItnNNEawW1sK5b3-5waHTelMmYGv0AhYW7WdHxoxWJu5r164GBDHdFJRKo4KJH=s1360-w1360-h1020-rw',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAG1hTGWxftDLG9i0WQ_2uIZJPisi_2wJDOOAspxSGUSwTYWagkU40-aLxAGKguVNGA5fB4xXmItnNNEawW1sK5b3-5waHTelMmYGv0AhYW7WdHxoxWJu5r164GBDHdFJRKo4KJH=s1360-w1360-h1020-rw',
    description: 'Milton masjid profile placeholder. Prayer preferences, programs, and announcements can be customized after onboarding.',
    verified: false,
    aliases: ['masjid khadijah']
  },
  {
    id: 'fallback-milton-islamic-centre',
    name: 'ICCM',
    type: 'Masjid',
    city: 'Milton',
    address: '8069 Esquesing Line, Milton, ON L9T 7L4',
    latitude: 43.5403,
    longitude: -79.8427,
    website: 'https://icna.ca/iccm/',
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEZPUwRU_97UB1etCJ4ev5ES9XmN4n846cQ6Ih5H0Ffb53Iu6OHYwGWYmSD0b3CEIRKaG2q5-qzi-GEzB9A38NscJgrCghhmkCO0fBKsnkw_1pvECHwQ2ajlB2li8BLmsTSpmU9-w=s1360-w1360-h1020-rw',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEZPUwRU_97UB1etCJ4ev5ES9XmN4n846cQ6Ih5H0Ffb53Iu6OHYwGWYmSD0b3CEIRKaG2q5-qzi-GEzB9A38NscJgrCghhmkCO0fBKsnkw_1pvECHwQ2ajlB2li8BLmsTSpmU9-w=s1360-w1360-h1020-rw',
    description: 'Islamic Community Centre of Milton profile placeholder. Details can be completed when the masjid is onboarded.',
    verified: false,
    aliases: ['iccm', 'islamic community centre of milton', 'milton islamic centre']
  },
  {
    id: 'fallback-hicc',
    name: 'HICC',
    type: 'Masjid',
    city: 'Oakville',
    address: '4269 Regional Rd 25, Oakville, ON L9E 0K2',
    latitude: 43.4818,
    longitude: -79.8141,
    website: 'https://miltonmasjid.com/',
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAF_9wZlIKxlIt1WnDcHp_emB27qwNp6BZTHp9HNgnC15Y-97Bhl5PkX_cYvrLVKzlV9S8PikDBpmAQ0g_04y2q0sQS9VNssdw4x90j86qHXLhR2gPq_hQpkm4RjVLIWdyJSm3nSUw=s1360-w1360-h1020-rw',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAF_9wZlIKxlIt1WnDcHp_emB27qwNp6BZTHp9HNgnC15Y-97Bhl5PkX_cYvrLVKzlV9S8PikDBpmAQ0g_04y2q0sQS9VNssdw4x90j86qHXLhR2gPq_hQpkm4RjVLIWdyJSm3nSUw=s1360-w1360-h1020-rw',
    description: 'Halton Islamic Community Centre profile placeholder for prayers, programs, and community services.',
    verified: false,
    aliases: ['hicc', 'hicc masjid', 'muslim association of milton', 'halton islamic community centre']
  },
  {
    id: 'fallback-imam-bukhari-centre',
    name: 'Imam Bukhari Centre',
    type: 'Masjid',
    city: 'Milton',
    address: '50 Steeles Ave E Unit-8, Milton, ON L9T 4W9',
    latitude: 43.5239,
    longitude: -79.8891,
    website: 'https://ahlehadithcanada.org/toronto/',
    email: 'toronto@ahlehadithcanada.org',
    phone: '+1-647-549-7909',
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEp8gOXT75AzDMNd1XH4h5D1rb_90r684Buuhy5zM6LrFMnzhJTMcPf0Phh9GiIvmQCHdchvQZAmX1lTXV-Q2tIIPC2cLXxEMagADr7qfzmA0aqVWruJUAD7T5Pr0YqM7YlP54DDw=s1360-w1360-h1020-rw',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAEp8gOXT75AzDMNd1XH4h5D1rb_90r684Buuhy5zM6LrFMnzhJTMcPf0Phh9GiIvmQCHdchvQZAmX1lTXV-Q2tIIPC2cLXxEMagADr7qfzmA0aqVWruJUAD7T5Pr0YqM7YlP54DDw=s1360-w1360-h1020-rw',
    description: "Imam Bukhari Centre is part of the Ahle-Hadith Society of Canada Toronto community, offering daily prayers, Jumu'ah, current programs, lectures, announcements, and donation-supported da'wah work.",
    iqamahTimes: { Fajr: '4:14 AM', Dhuhr: '2:00 PM', Asr: '5:41 PM', Maghrib: '9:09 PM', Isha: '10:54 PM', Jumuah: '2:00 PM' },
    prayerNotes: 'Prayer timings shown from Ahle Hadith Society of Canada Toronto page for Sunday, Jun 14, 2026. Jumuah is listed at 2:00 PM.',
    classes: [
      { id: 'ibc-ittiba', title: 'Ittiba and rejection of Taqlid', teacher: 'Ahle-Hadith Society of Canada', dayTime: 'Current program', description: 'Series of virtual lectures in English on foundations and distinctive features of the methodology.', registrationLink: 'https://ahlehadithcanada.org/toronto/' },
      { id: 'ibc-friday-halaqa', title: 'Friday Halaqa Series', teacher: 'Imam Bukhari Centre', dayTime: 'Fridays', description: 'Ongoing Friday halaqa programming listed by the centre.', registrationLink: 'https://ahlehadithcanada.org/toronto/' }
    ],
    facilities: 'Daily prayers, Jumuah, current programs, recorded lectures, donation support',
    verified: false,
    aliases: ['imam bukhari centre', 'imam bukhari center']
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
    imageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAFQhv5kM-N9e90r-azxNOWGwgtbjCX7A7dF1qy3O4weJZ5nObq2ZsTSR7aRyVHCe0CUy2CoUAStxSQZO4nf_rN8RkQFqm0AGeBej0ooE-jHhDprNdi6lGYez8kl407FDxAREaUK=s294-w294-h220-n-k-no',
    heroImageUrl: 'https://lh3.googleusercontent.com/gps-cs-s/APNQkAFQhv5kM-N9e90r-azxNOWGwgtbjCX7A7dF1qy3O4weJZ5nObq2ZsTSR7aRyVHCe0CUy2CoUAStxSQZO4nf_rN8RkQFqm0AGeBej0ooE-jHhDprNdi6lGYez8kl407FDxAREaUK=s294-w294-h220-n-k-no',
    description: 'Halton Learning Centre musalla profile placeholder. Program details can be completed after onboarding.',
    verified: false,
    aliases: ['hlc', 'halton learning centre', 'halton learning center']
  }
];


app.disable('x-powered-by');
app.use((_, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '6mb' }));
app.use('/uploads', express.static(uploadsDirectory, {
  fallthrough: false,
  immutable: true,
  maxAge: '30d'
}));

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const normalized = String(address || '').toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

async function archiveRemoteImage(value, req) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^\/(?:uploads|post-images)\//.test(raw)) return raw;
  let source;
  try {
    source = new URL(raw);
  } catch {
    throw new Error('Image URL must be a valid HTTPS address');
  }
  if (source.protocol !== 'https:') throw new Error('Image URL must use HTTPS');
  if (source.pathname.startsWith('/uploads/') && source.host === req.get('host')) return source.toString();
  const addresses = await lookup(source.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('Image URL host is not allowed');

  const response = await fetch(source, {
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
    headers: { 'User-Agent': 'Mujtama image importer/1.0' }
  });
  if (!response.ok) throw new Error(`Image source could not be downloaded (${response.status})`);
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].toLowerCase();
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
  const extension = extensions[contentType];
  if (!extension) throw new Error('Image source must return JPEG, PNG, WebP, or GIF content');
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxRemoteImageBytes) throw new Error('Image must be smaller than 8 MB');

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Image source did not return downloadable content');
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    total += chunk.byteLength;
    if (total > maxRemoteImageBytes) {
      await reader.cancel();
      throw new Error('Image must be smaller than 8 MB');
    }
    chunks.push(Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);
  const fileName = `${createHash('sha256').update(buffer).digest('hex').slice(0, 32)}.${extension}`;
  await fs.mkdir(uploadsDirectory, { recursive: true });
  await fs.writeFile(path.join(uploadsDirectory, fileName), buffer, { flag: 'wx' }).catch((error) => {
    if (error.code !== 'EEXIST') throw error;
  });
  const origin = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  return `${origin.replace(/\/$/, '')}/uploads/${fileName}`;
}

io.use((socket, next) => {
  try {
    const rawToken = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
    if (!rawToken) return next(new Error('Unauthorized'));
    socket.user = jwt.verify(rawToken, process.env.JWT_SECRET || 'dev_secret');
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  onlineUsers.set(userId, (onlineUsers.get(userId) || 0) + 1);
  socket.join(userRoom(userId));
  emitPresence();
  emitUnread(userId).catch(console.error);

  socket.on('thread:join', ({ otherUserId }) => {
    if (otherUserId) socket.join(threadRoom(userId, otherUserId));
  });

  socket.on('thread:leave', ({ otherUserId }) => {
    if (otherUserId) socket.leave(threadRoom(userId, otherUserId));
  });

  socket.on('typing:start', ({ receiverId }) => {
    if (!receiverId) return;
    io.to(threadRoom(userId, receiverId)).except(socket.id).emit('typing:update', { userId, isTyping: true });
  });

  socket.on('typing:stop', ({ receiverId }) => {
    if (!receiverId) return;
    io.to(threadRoom(userId, receiverId)).except(socket.id).emit('typing:update', { userId, isTyping: false });
  });

  socket.on('disconnect', () => {
    const count = (onlineUsers.get(userId) || 1) - 1;
    if (count <= 0) onlineUsers.delete(userId);
    else onlineUsers.set(userId, count);
    emitPresence();
  });
});

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeJsonList(value) {
  const list = normalizeList(value);
  return list.length ? list : null;
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeRequiredDate(value) {
  const date = normalizeDate(value);
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function normalizeLimit(value, fallback = 25, max = 50) {
  const limit = Number(value);
  return Number.isFinite(limit) ? Math.min(max, Math.max(1, Math.floor(limit))) : fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

function normalizeOptionalNumber(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeBirthDate(value) {
  const date = normalizeDate(value);
  if (!date || date > new Date()) return null;
  return date;
}

function calculateAge(dateOfBirth) {
  const birthDate = normalizeBirthDate(dateOfBirth);
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age;
}

function isAdult(user) {
  const age = calculateAge(user?.dateOfBirth);
  return age != null && age >= 18;
}

const applicationStatuses = ['PENDING', 'REVIEWING', 'INTERVIEW', 'ACCEPTED', 'REJECTED', 'APPROVED', 'DENIED', 'COMPLETED'];

function normalizeApplicationStatus(value, fallback = 'APPROVED') {
  const status = String(value || '').toUpperCase();
  return applicationStatuses.includes(status) ? status : fallback;
}

function publicUser(user, options = {}) {
  if (!user) return null;
  const safeUser = {
    id: user.id,
    name: user.name,
    accountType: user.accountType,
    isPrivate: Boolean(user.isPrivate),
    dateOfBirth: user.dateOfBirth,
    age: calculateAge(user.dateOfBirth),
    bio: user.bio,
    headline: user.headline,
    city: user.city,
    location: user.location,
    education: user.education,
    experience: user.experience,
    skills: user.skills || [],
    interests: user.interests || [],
    languages: user.languages || [],
    hobbies: user.hobbies || [],
    availability: user.availability,
    avatarUrl: user.avatarUrl,
    bannerUrl: user.bannerUrl,
    latitude: user.latitude,
    longitude: user.longitude,
    timezone: user.timezone,
    prayerMethod: user.prayerMethod,
    prayerNotificationPreferences: user.prayerNotificationPreferences,
    createdAt: user.createdAt
  };
  if (options.includeEmail) safeUser.email = user.email;
  return safeUser;
}

function publicOrganization(org, viewerId, options = {}) {
  if (!org) return null;
  const followers = org.followers || [];
  const favorites = org.favoritedBy || [];
  const people = org.people || [];
  const viewerCanManage = viewerId && (org.ownerId === viewerId || people.some((person) => person.userId === viewerId && canOperateOrganizationRole(person.roleLabel)));
  const showPrograms = options.includeUnclaimedPrograms || org.claimed || org.verified || org.ownerId || viewerCanManage;
  const events = (org.events || []).map((event) => {
    const visibleRegistrations = (event.registrations || []).filter((registration) => viewerCanManage || registration.userId === viewerId);
    return {
      ...event,
      registrations: visibleRegistrations.map((registration) => ({
        ...registration,
        user: publicUser(registration.user, { includeEmail: viewerCanManage || registration.userId === viewerId })
      }))
    };
  });
  const posts = (org.posts || []).filter((post) => hasMatchingEvent(post, events)).map(publicPost);
  const opportunities = (org.opportunities || []).map((opportunity) => {
    const visibleApplications = (opportunity.applications || []).filter((application) => viewerCanManage || application.applicantId === viewerId);
    return {
      ...opportunity,
      applications: visibleApplications.map((application) => ({
        ...application,
        applicant: publicUser(application.applicant, { includeEmail: viewerCanManage || application.applicantId === viewerId })
      }))
    };
  });
  const { followers: _followers, favoritedBy: _favoritedBy, people: _people, posts: _posts, events: _events, opportunities: _opportunities, ...safeOrg } = org;
  const viewerFollow = viewerId ? followers.find((follow) => follow.userId === viewerId) : null;
  return {
    ...safeOrg,
    classes: showPrograms ? (safeOrg.classes || []) : [],
    programs: showPrograms ? (safeOrg.programs || safeOrg.classes || []) : [],
    posts,
    events,
    opportunities,
    followers: followers.map((follow) => ({ ...follow, user: publicUser(follow.user) })),
    people: people.map((person) => ({ ...person, user: publicUser(person.user, { includeEmail: viewerCanManage }) })),
    followerCount: followers.length,
    favoriteCount: favorites.length,
    peopleCount: people.length,
    isFollowing: Boolean(viewerFollow),
    isFavorited: viewerId ? favorites.some((favorite) => favorite.userId === viewerId) : false,
    notifyPrayers: Boolean(viewerFollow?.notifyPrayers)
  };
}

const defaultUserNotificationPreferences = {
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
  nearbyMasjids: false,
  nearbyEvents: false,
  nearbyVolunteerOpportunities: false,
  jobOpportunitySource: 'followed',
  volunteerOpportunitySource: 'followed'
};

function publicNotificationPreferences(preferences) {
  if (!preferences) return { ...defaultUserNotificationPreferences };
  return Object.fromEntries(Object.keys(defaultUserNotificationPreferences).map((key) => [key, preferences[key] ?? defaultUserNotificationPreferences[key]]));
}

function normalizeNotificationPreferences(input = {}) {
  const data = {};
  Object.entries(defaultUserNotificationPreferences).forEach(([key, defaultValue]) => {
    if (input[key] === undefined) return;
    if (typeof defaultValue === 'boolean') data[key] = Boolean(input[key]);
    if (typeof defaultValue === 'string') data[key] = ['followed', 'favorited', 'nearby'].includes(String(input[key])) ? String(input[key]) : defaultValue;
  });
  return data;
}

function publicNotification(notification) {
  if (!notification) return null;
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    url: notification.url,
    organizationId: notification.organizationId,
    postId: notification.postId,
    eventId: notification.eventId,
    messageId: notification.messageId,
    metadata: notification.metadata || {},
    readAt: notification.readAt,
    createdAt: notification.createdAt
  };
}

function notificationDataForUser(userId, payload = {}) {
  return {
    userId,
    type: String(payload.type || 'GENERAL').toUpperCase(),
    title: String(payload.title || 'Ummah Connect').slice(0, 180),
    body: payload.body ? String(payload.body).slice(0, 500) : null,
    url: payload.url || null,
    organizationId: payload.organizationId || null,
    postId: payload.postId || null,
    eventId: payload.eventId || null,
    messageId: payload.messageId || null,
    metadata: {
      ...(payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}),
      tag: payload.tag || null,
      prayer: payload.prayer || null,
      scheduledAt: payload.scheduledAt || null,
      senderId: payload.senderId || null
    }
  };
}

async function createNotificationHistory(userId, payload) {
  const type = String(payload?.type || 'GENERAL').toUpperCase();
  try {
    const dedupeWhere = { userId, type };
    if (payload?.postId) dedupeWhere.postId = payload.postId;
    else if (payload?.eventId) dedupeWhere.eventId = payload.eventId;
    else if (payload?.messageId) dedupeWhere.messageId = payload.messageId;
    if (payload?.postId || payload?.eventId || payload?.messageId) {
      if (payload?.organizationId) dedupeWhere.organizationId = payload.organizationId;
      const existing = await prisma.notification.findFirst({ where: dedupeWhere, orderBy: { createdAt: 'desc' } });
      if (existing) return existing;
    } else if (payload?.tag) {
      const recent = await prisma.notification.findMany({
        where: { userId, type, createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } },
        orderBy: { createdAt: 'desc' },
        take: 20
      });
      const existing = recent.find((notification) => notification.metadata?.tag === payload.tag);
      if (existing) return existing;
    }
    return await prisma.notification.create({ data: notificationDataForUser(userId, payload) });
  } catch (error) {
    console.error('Notification history write failed', { userId, type: payload?.type, message: error.message });
    return null;
  }
}

async function notifyOrganizationFollowers(organizationId, payload, options = {}) {
  let enrichedPayload = payload;
  if (!payload.organizationName) {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true }
    }).catch((error) => {
      console.error('Notification organization lookup failed', { organizationId, message: error.message });
      return null;
    });
    if (organization?.name) enrichedPayload = { ...payload, organizationName: organization.name };
  }
  const push = await safeNotificationDelivery('push', () => sendPushToOrganizationFollowers(organizationId, enrichedPayload, options));
  return { push };
}

async function safeNotificationDelivery(channel, deliver) {
  try {
    return await deliver();
  } catch (error) {
    console.error(`${channel} notification delivery failed without blocking content creation`, { message: error.message });
    return { sent: 0, failed: 1, skipped: false, error: error.message };
  }
}

async function notifyApplicationStatus(application, opportunity) {
  const preference = await prisma.userNotificationPreference.findUnique({ where: { userId: application.applicantId } });
  if (!publicNotificationPreferences(preference).applicationStatusUpdates) {
    return { push: { sent: 0, skipped: true, reason: 'application status preference disabled' } };
  }
  const status = normalizeApplicationStatus(application.status, application.status);
  const title = `Application ${status.toLowerCase()}: ${opportunity.title}`;
  const body = opportunity.type === 'JOB'
    ? 'Your job application status was updated.'
    : 'Your volunteer application status was updated.';
  const payload = {
    type: 'APPLICATION',
    title,
    body,
    url: opportunity.type === 'JOB' ? '/network/jobs' : '/network/volunteers',
    organizationId: opportunity.organizationId,
    tag: `application-status-${application.id}-${status}`,
    metadata: { opportunityId: opportunity.id, applicationId: application.id, status }
  };
  const push = await sendPushToUser(application.applicantId, payload);
  return { push };
}

function publicPost(post) {
  if (!post) return null;
  const comments = post.comments || [];
  const { comments: _comments, _count, ...safePost } = post;
  return {
    ...safePost,
    author: publicUser(post.author),
    organization: post.organization ? {
      id: post.organization.id,
      name: post.organization.name,
      type: post.organization.type,
      city: post.organization.city,
      address: post.organization.address,
      imageUrl: post.organization.imageUrl,
      verified: post.organization.verified
    } : null,
    comments: comments.map((comment) => ({
      ...comment,
      author: publicUser(comment.author)
    })),
    commentCount: _count?.comments ?? comments.length
  };
}

function sameDateTime(left, right) {
  if (!left || !right) return false;
  const leftTime = new Date(left).getTime();
  const rightTime = new Date(right).getTime();
  return Number.isFinite(leftTime) && leftTime === rightTime;
}

function hasMatchingEvent(post, events = []) {
  if (String(post.type || '').toUpperCase() !== 'EVENT') return true;
  return events.some((event) => {
    if (event.organizationId !== post.organizationId || event.title !== post.title) return false;
    return post.eventTime ? sameDateTime(event.startTime, post.eventTime) : true;
  });
}

function eventPostContent(event) {
  return String(event.description || event.location || 'Event details coming soon.').trim();
}

async function syncEventPost(event, authorId) {
  if (!event.organizationId) return null;
  const where = {
    organizationId: event.organizationId,
    type: 'EVENT',
    title: event.title,
    eventTime: event.startTime
  };
  const existing = await prisma.post.findFirst({ where });
  const data = {
    organizationId: event.organizationId,
    authorId,
    title: event.title,
    content: eventPostContent(event),
    type: 'EVENT',
    imageUrl: event.imageUrl || null,
    location: event.location || null,
    eventTime: event.startTime
  };
  if (existing) return prisma.post.update({ where: { id: existing.id }, data });
  return prisma.post.create({ data });
}

async function updateSyncedEventPost(previousEvent, updatedEvent, authorId) {
  if (!updatedEvent.organizationId) return null;
  const existing = await prisma.post.findFirst({
    where: {
      organizationId: updatedEvent.organizationId,
      type: 'EVENT',
      OR: [
        { title: previousEvent.title, eventTime: previousEvent.startTime },
        { title: updatedEvent.title, eventTime: updatedEvent.startTime }
      ]
    }
  });
  const data = {
    organizationId: updatedEvent.organizationId,
    authorId,
    title: updatedEvent.title,
    content: eventPostContent(updatedEvent),
    type: 'EVENT',
    imageUrl: updatedEvent.imageUrl || null,
    location: updatedEvent.location || null,
    eventTime: updatedEvent.startTime
  };
  if (existing) return prisma.post.update({ where: { id: existing.id }, data });
  return prisma.post.create({ data });
}

async function deleteSyncedEventPosts(event) {
  if (!event.organizationId) return { count: 0 };
  return prisma.post.deleteMany({
    where: {
      organizationId: event.organizationId,
      type: 'EVENT',
      OR: [
        { title: event.title, eventTime: event.startTime },
        { title: event.title, eventTime: null }
      ]
    }
  });
}

function opportunityPostContent(opportunity) {
  return [
    opportunity.description,
    opportunity.location ? `Location: ${opportunity.location}` : null,
    opportunity.requirements ? `Requirements: ${opportunity.requirements}` : null,
    opportunity.deadline ? `Deadline: ${new Date(opportunity.deadline).toLocaleDateString('en-CA')}` : null
  ].filter(Boolean).join('\n\n') || 'Details coming soon.';
}

async function syncOpportunityPost(opportunity, authorId) {
  if (!opportunity.organizationId) return null;
  const type = opportunity.type === 'JOB' ? 'JOB' : 'VOLUNTEER';
  const existing = await prisma.post.findFirst({
    where: {
      organizationId: opportunity.organizationId,
      type,
      title: opportunity.title
    },
    orderBy: { createdAt: 'desc' }
  });
  const data = {
    organizationId: opportunity.organizationId,
    authorId,
    title: opportunity.title,
    content: opportunityPostContent(opportunity),
    type,
    location: opportunity.location || null
  };
  if (existing) return prisma.post.update({ where: { id: existing.id }, data });
  return prisma.post.create({ data });
}

async function updateSyncedOpportunityPost(previousOpportunity, updatedOpportunity, authorId) {
  const type = updatedOpportunity.type === 'JOB' ? 'JOB' : 'VOLUNTEER';
  const previousType = previousOpportunity.type === 'JOB' ? 'JOB' : 'VOLUNTEER';
  const existing = await prisma.post.findFirst({
    where: {
      organizationId: updatedOpportunity.organizationId,
      OR: [
        { type: previousType, title: previousOpportunity.title },
        { type, title: updatedOpportunity.title }
      ]
    },
    orderBy: { createdAt: 'desc' }
  });
  const data = {
    organizationId: updatedOpportunity.organizationId,
    authorId,
    title: updatedOpportunity.title,
    content: opportunityPostContent(updatedOpportunity),
    type,
    location: updatedOpportunity.location || null
  };
  if (existing) return prisma.post.update({ where: { id: existing.id }, data });
  return prisma.post.create({ data });
}

async function deleteSyncedOpportunityPosts(opportunity) {
  return prisma.post.deleteMany({
    where: {
      organizationId: opportunity.organizationId,
      title: opportunity.title,
      type: opportunity.type === 'JOB' ? 'JOB' : 'VOLUNTEER'
    }
  });
}

async function canManageOrganization(user, organizationId) {
  if (!user || !organizationId) return false;
  if (user.accountType === 'ADMIN') return true;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { people: { where: { userId: user.id } } }
  });
  if (!org) return false;
  if (org.ownerId === user.id && ['MASJID', 'MSA', 'ADMIN'].includes(user.accountType)) return true;
  return org.people.some((person) => canOperateOrganizationRole(person.roleLabel));
}

async function ensureFallbackOrganizations() {
  for (const masjid of fallbackMasjids) {
    const existing = await prisma.organization.findFirst({ where: { name: { in: [masjid.name, ...(masjid.aliases || [])] } } });
    if (!existing) {
      await prisma.organization.create({
        data: {
          name: masjid.name,
          type: 'MASJID',
          city: masjid.city,
          address: masjid.address,
          website: masjid.website,
          email: masjid.email,
          phone: masjid.phone,
          latitude: masjid.latitude,
          longitude: masjid.longitude,
          imageUrl: masjid.imageUrl,
          heroImageUrl: masjid.heroImageUrl,
          description: masjid.description || `${masjid.name} community profile. Admins can claim and customize this page during onboarding.`,
          iqamahTimes: masjid.iqamahTimes,
          prayerNotes: masjid.prayerNotes,
          classes: [],
          verified: false,
          facilities: masjid.facilities || 'Prayer hall, community programs, events'
        }
      });
    } else {
      const existingOwner = existing.ownerId ? await prisma.user.findUnique({ where: { id: existing.ownerId } }) : null;
      await prisma.organization.update({
        where: { id: existing.id },
        data: {
          city: existing.city || masjid.city,
          address: existing.address || masjid.address,
          website: existing.website || masjid.website,
          email: existing.email || masjid.email,
          phone: existing.phone || masjid.phone,
          latitude: existing.latitude ?? masjid.latitude,
          longitude: existing.longitude ?? masjid.longitude,
          imageUrl: existing.imageUrl || masjid.imageUrl,
          heroImageUrl: existing.heroImageUrl || masjid.heroImageUrl,
          description: !existing.description || /placeholder/i.test(existing.description) ? masjid.description : existing.description,
          iqamahTimes: existing.iqamahTimes || masjid.iqamahTimes,
          prayerNotes: existing.prayerNotes || masjid.prayerNotes,
          classes: existing.claimed ? existing.classes : [],
          facilities: existing.facilities || masjid.facilities,
          verified: Boolean(existing.verified && existing.claimed && ['MASJID', 'MSA'].includes(existingOwner?.accountType))
        }
      });
    }
  }
}

function normalizedMasjidName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(masjid|mosque|centre|center|islamic|community|the)\b/g, '').replace(/\s+/g, ' ').trim();
}

function matchingFallbackMasjid(item = {}) {
  const normalized = normalizedMasjidName(item.name);
  return fallbackMasjids.find((masjid) => {
    const names = [masjid.name, ...(masjid.aliases || [])];
    return names.some((name) => {
      const candidate = normalizedMasjidName(name);
      return candidate && (candidate === normalized || normalized.includes(candidate) || candidate.includes(normalized));
    });
  });
}

function enrichMasjid(item = {}) {
  const fallback = matchingFallbackMasjid(item);
  if (!fallback) return item;
  const { aliases, ...publicFallback } = fallback;
  return {
    ...publicFallback,
    ...item,
    city: item.city || fallback.city,
    address: item.address || fallback.address,
    latitude: item.latitude ?? fallback.latitude,
    longitude: item.longitude ?? fallback.longitude,
    website: item.website || fallback.website,
    imageUrl: item.imageUrl || fallback.imageUrl,
    heroImageUrl: item.heroImageUrl || fallback.heroImageUrl,
    description: item.description || fallback.description,
    verified: Boolean(item.verified)
  };
}

function createToken(user) {
  return jwt.sign({ id: user.id, accountType: user.accountType }, process.env.JWT_SECRET || 'dev_secret', { expiresIn: process.env.JWT_EXPIRES_IN || '30d' });
}

function publicResetLink(email, rawToken) {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${frontendUrl}/?resetToken=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
}

async function sendPasswordResetEmail(user, rawToken) {
  const resetLink = publicResetLink(user.email, rawToken);
  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'Ummah Connect <no-reply@ummahconnect.app>',
      to: user.email,
      subject: 'Reset your Ummah Connect password',
      text: `Use this link to reset your password: ${resetLink}`,
      html: `<p>Use this link to reset your password:</p><p><a href="${resetLink}">${resetLink}</a></p><p>This link expires in 1 hour.</p>`
    });
  } else {
    console.log(`[password-reset] ${user.email}: Reset your Ummah Connect password: ${resetLink}`);
  }
  return resetLink;
}

function threadIdFor(a, b) {
  return [a, b].sort().join(':');
}

function userRoom(userId) {
  return `user:${userId}`;
}

function threadRoom(a, b) {
  return `thread:${threadIdFor(a, b)}`;
}

function serializeMessage(message) {
  const reactions = message.reactions || [];
  return {
    ...message,
    content: message.deletedAt ? 'This message was unsent' : message.content,
    isDeleted: Boolean(message.deletedAt),
    sender: publicUser(message.sender),
    receiver: publicUser(message.receiver),
    reactions: reactions.map((reaction) => ({
      id: reaction.id,
      emoji: reaction.emoji,
      userId: reaction.userId,
      user: publicUser(reaction.user),
      createdAt: reaction.createdAt
    }))
  };
}


const DIRECT_MESSAGE_FOLDERS = new Set(['GENERAL', 'REQUEST', 'ARCHIVE']);

function normalizeMessageFolder(value, fallback = 'GENERAL') {
  const folder = String(value || '').toUpperCase();
  return DIRECT_MESSAGE_FOLDERS.has(folder) ? folder : fallback;
}

function serializeConnection(connection) {
  return {
    ...connection,
    requester: publicUser(connection.requester),
    receiver: publicUser(connection.receiver),
    isPending: connection.status === 'PENDING',
    isAccepted: connection.status === 'ACCEPTED'
  };
}

function summarizeFollowState(targetUser, outgoing, incoming, followerCount = 0, followingCount = 0) {
  const outgoingStatus = outgoing?.status || 'NONE';
  const incomingStatus = incoming?.status || 'NONE';
  const mutual = outgoingStatus === 'ACCEPTED' && incomingStatus === 'ACCEPTED';
  const followStatus = targetUser?.id ? (mutual ? 'MUTUAL' : outgoingStatus === 'ACCEPTED' ? 'FOLLOWING' : outgoingStatus === 'PENDING' ? 'REQUESTED' : incomingStatus === 'ACCEPTED' ? 'FOLLOWS_YOU' : incomingStatus === 'PENDING' ? 'REQUESTS_YOU' : 'NONE') : 'NONE';
  return {
    followerCount,
    followingCount,
    followStatus,
    outgoingFollowStatus: outgoingStatus,
    incomingFollowStatus: incomingStatus,
    followRequestId: incomingStatus === 'PENDING' ? incoming.id : null,
    isFollowing: outgoingStatus === 'ACCEPTED',
    followsYou: incomingStatus === 'ACCEPTED',
    isMutual: mutual,
    canMessage: mutual || outgoingStatus === 'ACCEPTED' || incomingStatus === 'ACCEPTED' || ['MASJID', 'MSA', 'IMAM', 'STUDENT_OF_KNOWLEDGE', 'ADMIN'].includes(String(targetUser?.accountType || ''))
  };
}

async function getFollowPair(viewerId, otherUserId) {
  if (!viewerId || !otherUserId || viewerId === otherUserId) return { outgoing: null, incoming: null };
  const rows = await prisma.connection.findMany({
    where: {
      OR: [
        { requesterId: viewerId, receiverId: otherUserId },
        { requesterId: otherUserId, receiverId: viewerId }
      ]
    }
  });
  return {
    outgoing: rows.find((row) => row.requesterId === viewerId && row.receiverId === otherUserId) || null,
    incoming: rows.find((row) => row.requesterId === otherUserId && row.receiverId === viewerId) || null
  };
}

async function getFollowCounts(userIds = []) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map();
  const [followers, following] = await Promise.all([
    prisma.connection.groupBy({ by: ['receiverId'], where: { receiverId: { in: ids }, status: 'ACCEPTED' }, _count: { id: true } }),
    prisma.connection.groupBy({ by: ['requesterId'], where: { requesterId: { in: ids }, status: 'ACCEPTED' }, _count: { id: true } })
  ]);
  const map = new Map(ids.map((id) => [id, { followerCount: 0, followingCount: 0 }]));
  followers.forEach((item) => { map.get(item.receiverId).followerCount = item._count.id; });
  following.forEach((item) => { map.get(item.requesterId).followingCount = item._count.id; });
  return map;
}

function isOrganizationLikeUser(user) {
  return ['MASJID', 'MSA', 'IMAM', 'STUDENT_OF_KNOWLEDGE', 'ADMIN'].includes(String(user?.accountType || ''));
}

async function getInstagramConversationFolder(ownerId, otherUserId, existingPreference = null) {
  if (existingPreference?.folder) return existingPreference.folder;
  const { incoming } = await getFollowPair(ownerId, otherUserId);
  return incoming?.status === 'ACCEPTED' ? 'GENERAL' : 'REQUEST';
}

async function cacheGet(key) {
  if (redis?.status === 'ready') {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  }
  const item = memoryCache.get(key);
  if (!item || item.expiresAt < Date.now()) return null;
  return item.value;
}

async function cacheSet(key, value, seconds = 30) {
  if (redis?.status === 'ready') {
    await redis.set(key, JSON.stringify(value), 'EX', seconds);
    return;
  }
  memoryCache.set(key, { value, expiresAt: Date.now() + seconds * 1000 });
}

async function cacheDel(key) {
  if (redis?.status === 'ready') {
    await redis.del(key);
    return;
  }
  memoryCache.delete(key);
}

async function unreadCount(userId) {
  const key = `unread:${userId}`;
  const cached = await cacheGet(key);
  if (cached != null) return cached;
  const [directCount, memberships] = await Promise.all([
    prisma.message.count({ where: { receiverId: userId, readAt: null, deletedAt: null } }),
    prisma.groupChatMember.findMany({
      where: { userId, hidden: false },
      select: { groupId: true, lastReadAt: true }
    })
  ]);
  const groupCounts = await Promise.all(memberships.map((membership) => prisma.groupMessage.count({
    where: {
      groupId: membership.groupId,
      senderId: { not: userId },
      deletedAt: null,
      ...(membership.lastReadAt ? { createdAt: { gt: membership.lastReadAt } } : {})
    }
  })));
  const count = directCount + groupCounts.reduce((sum, value) => sum + value, 0);
  await cacheSet(key, count, 20);
  return count;
}

async function invalidateUnread(userId) {
  await cacheDel(`unread:${userId}`);
}

function emitPresence() {
  io.emit('presence:update', { onlineUserIds: [...onlineUsers.keys()] });
}

async function emitUnread(userId) {
  io.to(userRoom(userId)).emit('messages:unread', { unread: await unreadCount(userId) });
}

function normalizePrayerPreferences(value = {}) {
  const allowedPrayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const prayers = value.prayers && typeof value.prayers === 'object' ? value.prayers : {};
  const offsetMinutes = [0, 5, 10].includes(Number(value.offsetMinutes)) ? Number(value.offsetMinutes) : 0;
  return {
    enabled: Boolean(value.enabled),
    offsetMinutes,
    prayers: Object.fromEntries(allowedPrayers.map((name) => [name, prayers[name] !== false]))
  };
}

async function sendPushToUser(userId, payload) {
  try {
    await createNotificationHistory(userId, payload);
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.warn('Push skipped: VAPID keys are not configured', { userId, type: payload?.type });
      return { sent: 0, failed: 0, stale: 0, disabled: true };
    }
    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
    if (!subscriptions.length) return { sent: 0, failed: 0, stale: 0, disabled: false, noSubscriptions: true };
    let sent = 0;
    let failed = 0;
    let stale = 0;
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification({
          endpoint: subscription.endpoint,
          keys: subscription.keys
        }, JSON.stringify(payload));
        sent += 1;
      } catch (error) {
        if ([404, 410].includes(error.statusCode)) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint } });
          stale += 1;
        } else {
          failed += 1;
          console.error('Push notification failed', {
            userId,
            type: payload?.type,
            endpoint: subscription.endpoint,
            statusCode: error.statusCode,
            message: error.message
          });
        }
      }
    }));
    return { sent, failed, stale, disabled: false };
  } catch (error) {
    console.error('Push delivery failed without blocking the triggering action', { userId, type: payload?.type, message: error.message });
    return { sent: 0, failed: 1, stale: 0, disabled: false, error: error.message };
  }
}

async function sendPushToOrganizationFollowers(organizationId, payload, options = {}) {
  const [follows, favorites] = await Promise.all([
    prisma.organizationFollow.findMany({ where: { organizationId }, select: { userId: true } }),
    prisma.favoriteMasjid.findMany({ where: { organizationId }, select: { userId: true } })
  ]);
  const excludedUserIds = new Set((options.excludeUserIds || []).filter(Boolean));
  const uniqueUserIds = [...new Set([
    ...follows.map((follow) => follow.userId),
    ...favorites.map((favorite) => favorite.userId)
  ])]
    .filter((userId) => !excludedUserIds.has(userId));
  const preferences = await prisma.userNotificationPreference.findMany({ where: { userId: { in: uniqueUserIds } } });
  const preferenceMap = new Map(preferences.map((preference) => [preference.userId, publicNotificationPreferences(preference)]));
  const type = String(payload?.type || '').toUpperCase();
  const allowedUserIds = uniqueUserIds.filter((userId) => {
    const preference = preferenceMap.get(userId) || publicNotificationPreferences(null);
    if (type === 'ANNOUNCEMENT' && !preference.masjidAnnouncements) return false;
    if (type === 'EVENT' && !preference.eventsFromFollowedMasjids) return false;
    if (type === 'CLASS' && !preference.programsFromFollowedMasjids) return false;
    if (type === 'PRAYER_UPDATE' && !preference.jamaatTimeUpdates) return false;
    if (type === 'JOB' && !preference.jobOpportunities) return false;
    if (['VOLUNTEER', 'OPPORTUNITY'].includes(type) && !preference.volunteerOpportunities) return false;
    return true;
  });
  const results = await Promise.all(allowedUserIds.map((userId) => sendPushToUser(userId, payload)));
  return {
    sent: results.reduce((sum, result) => sum + (result.sent || 0), 0),
    failed: results.reduce((sum, result) => sum + (result.failed || 0), 0),
    stale: results.reduce((sum, result) => sum + (result.stale || 0), 0),
    disabled: results.some((result) => result.disabled),
    followers: follows.length,
    favorites: favorites.length,
    recipients: uniqueUserIds.length,
    eligibleRecipients: allowedUserIds.length
  };
}

const sentPrayerNotificationKeys = new Map();
const prayerTimeCache = new Map();

function compactPrayerNotificationKeys(now = Date.now()) {
  const maxAgeMs = 36 * 60 * 60 * 1000;
  for (const [key, timestamp] of sentPrayerNotificationKeys.entries()) {
    if (now - timestamp > maxAgeMs) sentPrayerNotificationKeys.delete(key);
  }
}

function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

function zonedTimeToUtc({ year, month, day, hour, minute }, timeZone) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const localAtGuess = zonedParts(new Date(utcGuess), timeZone);
  const localAsUtc = Date.UTC(localAtGuess.year, localAtGuess.month - 1, localAtGuess.day, localAtGuess.hour, localAtGuess.minute, localAtGuess.second || 0, 0);
  return new Date(utcGuess - (localAsUtc - utcGuess));
}

function parsePrayerClock(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return { hour, minute };
}

async function fetchPrayerTimings({ latitude, longitude, method, dateKey, city, refresh = false }) {
  const cacheKey = `${Number(latitude).toFixed(4)}:${Number(longitude).toFixed(4)}:${method || 3}:${dateKey}:${city || ''}`;
  const cached = prayerTimeCache.get(cacheKey);
  if (!refresh && cached && Date.now() - cached.cachedAt < 30 * 60 * 1000) return cached.timings;
  const date = Math.floor(new Date(`${dateKey}T12:00:00Z`).getTime() / 1000);
  const url = `https://api.aladhan.com/v1/timings/${date}?latitude=${latitude}&longitude=${longitude}&method=${method || 3}&school=1`;
  let timings = {};
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Aladhan failed with ${response.status}`);
    const data = await response.json();
    timings = data.data?.timings || {};
  } catch (primaryError) {
    const backupCity = String(city || '').trim() || await nearestPrayerCity(latitude, longitude);
    if (!backupCity) throw primaryError;
    timings = await fetchMuslimSalatTimings(backupCity);
  }
  prayerTimeCache.set(cacheKey, { cachedAt: Date.now(), timings });
  return timings;
}

async function nearestPrayerCity(latitude, longitude) {
  const origin = { latitude: Number(latitude), longitude: Number(longitude) };
  const databaseLocations = await prisma.organization.findMany({
    where: { city: { not: null }, latitude: { not: null }, longitude: { not: null } },
    select: { city: true, latitude: true, longitude: true }
  }).catch(() => []);
  const candidates = [...databaseLocations, ...fallbackMasjids]
    .filter((item) => item.city && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
    .map((item) => ({ ...item, distance: distanceKm(origin, { latitude: Number(item.latitude), longitude: Number(item.longitude) }) }))
    .sort((left, right) => left.distance - right.distance);
  return candidates[0]?.distance <= 100 ? candidates[0].city : '';
}

async function fetchMuslimSalatTimings(city) {
  const apiKey = process.env.MUSLIM_SALAT_API_KEY || 'API_KEY';
  const response = await fetch(`https://muslimsalat.com/${encodeURIComponent(city)}/daily.json?key=${encodeURIComponent(apiKey)}`, {
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: 'application/json', 'User-Agent': 'Mujtama prayer service/1.0' }
  });
  if (!response.ok) throw new Error(`Backup prayer API failed with ${response.status}`);
  const data = await response.json();
  const item = data.items?.[0];
  if (!data.status_valid || !item) throw new Error(data.status_description || 'Backup prayer API returned no timings');
  return {
    Fajr: toTwentyFourHour(item.fajr),
    Sunrise: toTwentyFourHour(item.shurooq),
    Dhuhr: toTwentyFourHour(item.dhuhr),
    Asr: toTwentyFourHour(item.asr),
    Maghrib: toTwentyFourHour(item.maghrib),
    Isha: toTwentyFourHour(item.isha)
  };
}

function toTwentyFourHour(value) {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return String(value || '').trim();
  let hour = Number(match[1]);
  const minute = match[2];
  const period = match[3]?.toLowerCase();
  if (period === 'pm' && hour !== 12) hour += 12;
  if (period === 'am' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

async function runPrayerNotificationJob() {
  if (!prayerNotificationJobEnabled) return;
  const now = new Date();
  compactPrayerNotificationKeys(now.getTime());
  const users = await prisma.user.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      pushSubscriptions: { some: {} }
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true,
      timezone: true,
      city: true,
      prayerMethod: true,
      prayerNotificationPreferences: true,
      notificationPreference: true
    }
  });

  await Promise.all(users.map(async (user) => {
    const notificationPreference = publicNotificationPreferences(user.notificationPreference);
    if (!notificationPreference.prayerTimeReminders) return;
    const preferences = normalizePrayerPreferences(user.prayerNotificationPreferences || {});
    if (!preferences.enabled) return;
    const timeZone = user.timezone || 'UTC';
    const today = zonedParts(now, timeZone);
    const dateKey = `${String(today.year).padStart(4, '0')}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
    let timings = {};
    try {
      timings = await fetchPrayerTimings({
        latitude: user.latitude,
        longitude: user.longitude,
        method: user.prayerMethod,
        dateKey,
        city: user.city
      });
    } catch (error) {
      console.error('Prayer notification timing lookup failed', { userId: user.id, message: error.message });
      return;
    }

    await Promise.all(Object.entries(preferences.prayers || {}).map(async ([prayer, enabled]) => {
      if (!enabled) return;
      const clock = parsePrayerClock(timings[prayer]);
      if (!clock) return;
      const scheduledAt = zonedTimeToUtc({
        year: today.year,
        month: today.month,
        day: today.day,
        hour: clock.hour,
        minute: clock.minute - Number(preferences.offsetMinutes || 0)
      }, timeZone);
      const delta = scheduledAt.getTime() - now.getTime();
      if (delta < 0 || delta > prayerNotificationLookaheadMs) return;
      const key = `${user.id}:${dateKey}:${prayer}:${preferences.offsetMinutes || 0}`;
      if (sentPrayerNotificationKeys.has(key)) return;
      sentPrayerNotificationKeys.set(key, now.getTime());
      const prefix = preferences.offsetMinutes ? `${preferences.offsetMinutes} minutes until` : '';
      const result = await sendPushToUser(user.id, {
        type: 'PRAYER',
        title: `${prefix} ${prayer} time`.trim(),
        body: preferences.offsetMinutes ? `${prayer} time starts soon.` : `${prayer} time has started.`,
        url: '/prayer',
        tag: key,
        prayer,
        scheduledAt: scheduledAt.toISOString()
      });
      console.log('Prayer notification processed', { userId: user.id, prayer, scheduledAt: scheduledAt.toISOString(), ...result });
    }));
  }));
}

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret');
    const currentUser = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!currentUser) return res.status(401).json({ error: 'Invalid token' });
    req.user = { id: currentUser.id, accountType: currentUser.accountType };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user.accountType !== 'ADMIN') return res.status(403).json({ error: 'Admin account required' });
  next();
}

function hashAiInput(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function truncateForAi(value, max = 1800) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function aiJsonResponse(text, fallback = {}) {
  const parsed = parseAiJson(text, fallback);
  return parsed && typeof parsed === 'object' ? parsed : fallback;
}

async function logAiUsage({ feature, userId, organizationId = null, success, usage = {}, error = null, metadata = {} }) {
  try {
    await prisma.aiUsageLog.create({
      data: {
        feature,
        userId,
        organizationId,
        success: Boolean(success),
        promptTokens: usage.promptTokens ?? null,
        completionTokens: usage.completionTokens ?? null,
        totalTokens: usage.totalTokens ?? null,
        error: error ? String(error).slice(0, 500) : null,
        metadata
      }
    });
  } catch (writeError) {
    console.error('AI usage log failed', { feature, message: writeError.message });
  }
}

async function runLoggedAi({ feature, req, organizationId = null, metadata = {}, task }) {
  if (!isAiConfigured()) {
    await logAiUsage({ feature, userId: req.user.id, organizationId, success: false, error: 'OPENAI_API_KEY is not configured.', metadata });
    const error = new Error('AI is not configured yet. Add OPENAI_API_KEY on the backend and restart.');
    error.status = 503;
    throw error;
  }
  try {
    const result = await task();
    await logAiUsage({ feature, userId: req.user.id, organizationId, success: true, usage: result.usage, metadata });
    return result;
  } catch (error) {
    await logAiUsage({ feature, userId: req.user.id, organizationId, success: false, usage: error.usage, error: error.message, metadata });
    throw error;
  }
}

function aiErrorResponse(res, error, fallback = 'AI is temporarily unavailable. Please edit manually and try again later.') {
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
  return res.status(status).json({ error: error.message || fallback, fallback });
}

function safeAiDateInput(value) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function organizationType(value) {
  return ['MASJID', 'MSA'].includes(String(value || '').toUpperCase()) ? String(value).toUpperCase() : 'MASJID';
}

function optionalViewerId(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  try {
    return jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret').id;
  } catch {
    return null;
  }
}

function parsePagination(req, defaultTake = 50, maxTake = 100) {
  const requested = Number(req.query.limit || req.query.take || defaultTake);
  const take = Math.min(maxTake, Math.max(1, Number.isFinite(requested) ? requested : defaultTake));
  const cursor = typeof req.query.cursor === 'string' && req.query.cursor.trim() ? req.query.cursor.trim() : '';
  return cursor ? { take, cursor: { id: cursor }, skip: 1 } : { take };
}

function searchTerm(req) {
  return typeof req.query.q === 'string' ? req.query.q.trim() : '';
}

async function createOrUpdateOrganizationOwner({ organization, ownerEmail, ownerName }) {
  const email = normalizeEmail(ownerEmail);
  if (!email) throw new Error('Masjid admin login email is required');
  if (!isValidEmail(email)) throw new Error('Masjid admin login email must be valid');
  const accountType = organizationType(organization.type) === 'MSA' ? 'MSA' : 'MASJID';
  let temporaryPassword = null;
  let owner = await prisma.user.findUnique({ where: { email } });
  if (owner) {
    owner = await prisma.user.update({
      where: { id: owner.id },
      data: {
        accountType,
        name: ownerName || owner.name || `${organization.name} Admin`,
        city: owner.city || organization.city || null,
        location: owner.location || organization.address || null
      }
    });
  } else {
    temporaryPassword = `Ummah-${randomBytes(4).toString('hex')}`;
    owner = await prisma.user.create({
      data: {
        name: ownerName || `${organization.name} Admin`,
        email,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        accountType,
        city: organization.city,
        location: organization.address
      }
    });
  }
  await prisma.organizationPerson.upsert({
    where: { organizationId_userId: { organizationId: organization.id, userId: owner.id } },
    create: { organizationId: organization.id, userId: owner.id, roleLabel: 'Owner / Masjid Admin' },
    update: { roleLabel: 'Owner / Masjid Admin' }
  });
  return { owner, temporaryPassword };
}

function distanceKm(from, to) {
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function withDistance(items, latitude, longitude) {
  const origin = { latitude: Number(latitude), longitude: Number(longitude) };
  return items
    .map((item) => {
      const km = item.latitude && item.longitude ? distanceKm(origin, item) : null;
      return {
        ...item,
        distanceKm: km == null ? null : Number(km.toFixed(2)),
        walkingMinutes: km == null ? null : Math.max(1, Math.round((km / 5) * 60)),
        drivingMinutes: km == null ? null : Math.max(1, Math.round((km / 35) * 60 + 3))
      };
    })
    .sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
}

function osmAddress(tags = {}) {
  const parts = [
    [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' '),
    tags['addr:city'],
    tags['addr:province'] || tags['addr:state'],
    tags['addr:postcode']
  ].filter(Boolean);
  return parts.join(', ');
}

app.get('/', (_, res) => res.json({ message: 'Ummah Connect API running' }));
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, city, bio } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const dateOfBirth = normalizeBirthDate(req.body.dateOfBirth);
    if (!name || !email || !password || !dateOfBirth) return res.status(400).json({ error: 'Name, email, password, and date of birth are required' });
    if (!isValidEmail(normalizedEmail)) return res.status(400).json({ error: 'A valid email is required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: String(name).trim().slice(0, 120),
        email: normalizedEmail,
        passwordHash,
        dateOfBirth,
        accountType: 'USER',
        isPrivate: Boolean(req.body.isPrivate),
        city,
        headline: req.body.headline ? String(req.body.headline).trim().slice(0, 160) : undefined,
        bio,
        skills: normalizeList(req.body.skills),
        interests: normalizeList(req.body.interests),
        languages: normalizeList(req.body.languages),
        hobbies: normalizeList(req.body.hobbies)
      }
    });
    res.json({ token: createToken(user), user: publicUser(user, { includeEmail: true }) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.code === 'P2002' ? 'Email already exists' : err.message });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  if (!user) return res.status(401).json({ error: 'Invalid login' });
  const valid = await bcrypt.compare(password || '', user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid login' });
  res.json({ token: createToken(user), user: publicUser(user, { includeEmail: true }) });
});

app.post('/api/auth/forgot-password', passwordResetLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (user) {
    const rawToken = randomBytes(32).toString('hex');
    const passwordResetTokenHash = await bcrypt.hash(rawToken, 10);
    const passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { passwordResetTokenHash, passwordResetExpiresAt } });
    const resetLink = await sendPasswordResetEmail(user, rawToken);
    return res.json({ message: 'Password reset email sent if the account exists.', devResetLink: process.env.NODE_ENV === 'production' ? undefined : resetLink });
  }
  res.json({ message: 'Password reset email sent if the account exists.' });
});

app.post('/api/auth/reset-password', passwordResetLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const resetToken = String(req.body.resetToken || '');
  const password = String(req.body.password || '');
  if (!email || !resetToken || password.length < 8) return res.status(400).json({ error: 'Email, reset token, and an 8+ character password are required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordResetTokenHash || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    return res.status(400).json({ error: 'Reset link is invalid or expired' });
  }
  const valid = await bcrypt.compare(resetToken, user.passwordResetTokenHash);
  if (!valid) return res.status(400).json({ error: 'Reset link is invalid or expired' });
  const passwordHash = await bcrypt.hash(password, 10);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null }
  });
  res.json({ token: createToken(updated), user: publicUser(updated, { includeEmail: true }) });
});

app.get('/api/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json(publicUser(user, { includeEmail: true }));
});

app.put('/api/me', auth, async (req, res) => {
  const data = {
    name: req.body.name,
    dateOfBirth: req.body.dateOfBirth !== undefined ? normalizeBirthDate(req.body.dateOfBirth) : undefined,
    bio: req.body.bio,
    headline: req.body.headline === undefined ? undefined : String(req.body.headline || '').trim().slice(0, 160),
    city: req.body.city,
    location: req.body.location,
    education: req.body.education,
    experience: req.body.experience,
    availability: req.body.availability,
    isPrivate: req.body.isPrivate === undefined ? undefined : Boolean(req.body.isPrivate),
    latitude: req.body.latitude === undefined ? undefined : Number(req.body.latitude),
    longitude: req.body.longitude === undefined ? undefined : Number(req.body.longitude),
    timezone: req.body.timezone,
    prayerMethod: req.body.prayerMethod,
    prayerNotificationPreferences: req.body.prayerNotificationPreferences === undefined ? undefined : normalizePrayerPreferences(req.body.prayerNotificationPreferences),
    skills: normalizeList(req.body.skills),
    interests: normalizeList(req.body.interests),
    languages: normalizeList(req.body.languages),
    hobbies: normalizeList(req.body.hobbies),
    avatarUrl: req.body.avatarUrl,
    bannerUrl: req.body.bannerUrl
  };
  Object.keys(data).forEach((key) => data[key] === undefined && delete data[key]);
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json(publicUser(user, { includeEmail: true }));
});

app.get('/api/notifications/vapid-public-key', auth, (_, res) => {
  res.json({ publicKey: vapidPublicKey, enabled: Boolean(vapidPublicKey && vapidPrivateKey) });
});

app.get('/api/notifications/preferences', auth, async (req, res) => {
  const [user, notificationPreferences] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user.id } }),
    prisma.userNotificationPreference.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id },
      update: {}
    })
  ]);
  const subscriptions = await prisma.pushSubscription.count({ where: { userId: req.user.id } });
  res.json({
    pushConfigured: Boolean(vapidPublicKey && vapidPrivateKey),
    subscriptionCount: subscriptions,
    location: {
      city: user.city,
      location: user.location,
      latitude: user.latitude,
      longitude: user.longitude,
      timezone: user.timezone,
      prayerMethod: user.prayerMethod
    },
    prayerNotificationPreferences: normalizePrayerPreferences(user.prayerNotificationPreferences || { enabled: false }),
    notificationPreferences: publicNotificationPreferences(notificationPreferences)
  });
});

app.put('/api/notifications/preferences', auth, notificationLimiter, async (req, res) => {
  const data = {};
  let notificationPreferences = null;
  if (req.body.location) {
    const { city, location, latitude, longitude, timezone, prayerMethod } = req.body.location;
    data.city = city;
    data.location = location;
    data.latitude = latitude == null ? null : Number(latitude);
    data.longitude = longitude == null ? null : Number(longitude);
    data.timezone = timezone || null;
    data.prayerMethod = prayerMethod || null;
  }
  if (req.body.prayerNotificationPreferences) {
    data.prayerNotificationPreferences = normalizePrayerPreferences(req.body.prayerNotificationPreferences);
    notificationPreferences = await prisma.userNotificationPreference.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, prayerTimeReminders: data.prayerNotificationPreferences.enabled },
      update: { prayerTimeReminders: data.prayerNotificationPreferences.enabled }
    });
  }
  if (req.body.notificationPreferences) {
    notificationPreferences = await prisma.userNotificationPreference.upsert({
      where: { userId: req.user.id },
      create: { userId: req.user.id, ...normalizeNotificationPreferences(req.body.notificationPreferences) },
      update: normalizeNotificationPreferences(req.body.notificationPreferences)
    });
  }
  const user = Object.keys(data).length ? await prisma.user.update({ where: { id: req.user.id }, data }) : await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({
    ...publicUser(user, { includeEmail: true }),
    notificationPreferences: publicNotificationPreferences(notificationPreferences)
  });
});

app.post('/api/notifications/subscriptions', auth, notificationLimiter, async (req, res) => {
  const { endpoint, keys } = req.body.subscription || req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Valid push subscription is required' });
  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.user.id, keys, userAgent: req.headers['user-agent'] || null },
    create: { userId: req.user.id, endpoint, keys, userAgent: req.headers['user-agent'] || null }
  });
  res.json({ ok: true, id: subscription.id, pushConfigured: Boolean(vapidPublicKey && vapidPrivateKey) });
});

app.delete('/api/notifications/subscriptions', auth, async (req, res) => {
  if (req.body?.endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: req.body.endpoint, userId: req.user.id } });
  } else {
    await prisma.pushSubscription.deleteMany({ where: { userId: req.user.id } });
  }
  res.json({ ok: true });
});

app.get('/api/notifications/history', auth, async (req, res) => {
  const limit = normalizeLimit(req.query.limit, 25, 50);
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: limit
    }),
    prisma.notification.count({ where: { userId: req.user.id, readAt: null } })
  ]);
  res.json({ notifications: notifications.map(publicNotification), unread });
});

app.put('/api/notifications/history/read', auth, async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean) : [];
  const where = ids.length ? { userId: req.user.id, id: { in: ids } } : { userId: req.user.id, readAt: null };
  const result = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
  const unread = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
  res.json({ ok: true, updated: result.count, unread });
});

app.get('/api/users', auth, async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  const warningCounts = req.user.accountType === 'ADMIN' ? await prisma.userWarning.groupBy({ by: ['userId'], _count: { id: true } }) : [];
  const warningCountMap = new Map(warningCounts.map((item) => [item.userId, item._count.id]));
  const userIds = users.map((user) => user.id);
  const [connections, counts] = await Promise.all([
    prisma.connection.findMany({
      where: { OR: [{ requesterId: req.user.id, receiverId: { in: userIds } }, { requesterId: { in: userIds }, receiverId: req.user.id }] }
    }),
    getFollowCounts(userIds)
  ]);
  const outgoingMap = new Map();
  const incomingMap = new Map();
  connections.forEach((connection) => {
    if (connection.requesterId === req.user.id) outgoingMap.set(connection.receiverId, connection);
    if (connection.receiverId === req.user.id) incomingMap.set(connection.requesterId, connection);
  });
  res.json(users.map((user) => {
    const count = counts.get(user.id) || { followerCount: 0, followingCount: 0 };
    const state = user.id === req.user.id
      ? { followerCount: count.followerCount, followingCount: count.followingCount, followStatus: 'SELF', outgoingFollowStatus: 'SELF', incomingFollowStatus: 'SELF', isFollowing: false, followsYou: false, isMutual: false, canMessage: false }
      : summarizeFollowState(user, outgoingMap.get(user.id), incomingMap.get(user.id), count.followerCount, count.followingCount);
    return {
      ...publicUser(user, { includeEmail: req.user.accountType === 'ADMIN' || user.id === req.user.id }),
      ...state,
      warningCount: warningCountMap.get(user.id) || 0,
      connectionStatus: state.followStatus
    };
  }));
});

app.get('/api/users/:id/social', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const [followers, following, pendingRequests, follows, favorites, eventSubscriptions, affiliations, counts] = await Promise.all([
    prisma.connection.findMany({
      where: { receiverId: req.params.id, status: 'ACCEPTED' },
      include: { requester: true, receiver: true },
      orderBy: { updatedAt: 'desc' }
    }),
    prisma.connection.findMany({
      where: { requesterId: req.params.id, status: 'ACCEPTED' },
      include: { requester: true, receiver: true },
      orderBy: { updatedAt: 'desc' }
    }),
    req.params.id === req.user.id ? prisma.connection.findMany({
      where: { receiverId: req.user.id, status: 'PENDING' },
      include: { requester: true, receiver: true },
      orderBy: { updatedAt: 'desc' }
    }) : Promise.resolve([]),
    prisma.organizationFollow.findMany({
      where: { userId: req.params.id },
      include: { organization: { include: { followers: { include: { user: true } }, favoritedBy: true, people: { include: { user: true } }, posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } }, events: true, opportunities: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.favoriteMasjid.findMany({
      where: { userId: req.params.id },
      include: { organization: { include: { followers: { include: { user: true } }, favoritedBy: true, people: { include: { user: true } }, posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } }, events: true, opportunities: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.eventSubscription.findMany({
      where: { userId: req.params.id, saved: true },
      include: { event: { include: { organization: true, createdBy: { select: { id: true, name: true, accountType: true } } } } },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.organizationPerson.findMany({
      where: { userId: req.params.id },
      include: { organization: { include: { followers: { include: { user: true } }, favoritedBy: true, people: { include: { user: true } }, posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } }, events: true, opportunities: true } } },
      orderBy: { createdAt: 'desc' }
    }),
    getFollowCounts([req.params.id])
  ]);
  const count = counts.get(req.params.id) || { followerCount: followers.length, followingCount: following.length };
  const { outgoing, incoming } = await getFollowPair(req.user.id, req.params.id);
  const state = req.user.id === req.params.id
    ? { followerCount: count.followerCount, followingCount: count.followingCount, followStatus: 'SELF', outgoingFollowStatus: 'SELF', incomingFollowStatus: 'SELF', isFollowing: false, followsYou: false, isMutual: false, canMessage: false }
    : summarizeFollowState(user, outgoing, incoming, count.followerCount, count.followingCount);
  res.json({
    user: { ...publicUser(user), ...state },
    followers: followers.map((connection) => publicUser(connection.requester)),
    following: following.map((connection) => publicUser(connection.receiver)),
    followRequests: pendingRequests.map(serializeConnection),
    connections: followers.map((connection) => publicUser(connection.requester)),
    followingMasjids: follows.map((follow) => publicOrganization(follow.organization, req.user.id)),
    favoriteMasjids: favorites.map((favorite) => publicOrganization(favorite.organization, req.user.id)),
    savedEvents: eventSubscriptions.map((subscription) => ({
      ...subscription.event,
      isSaved: subscription.saved,
      notifyMe: subscription.notify
    })),
    affiliatedMasjids: affiliations.map((affiliation) => ({
      ...affiliation,
      organization: publicOrganization(affiliation.organization, req.user.id)
    }))
  });
});

app.delete('/api/users/:id', auth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Admins cannot delete their own active session account' });
  await prisma.userWarning.deleteMany({ where: { OR: [{ userId: req.params.id }, { issuerId: req.params.id }] } });
  await prisma.eventRegistration.deleteMany({ where: { userId: req.params.id } });
  await prisma.eventSubscription.deleteMany({ where: { userId: req.params.id } });
  await prisma.organizationFollow.deleteMany({ where: { userId: req.params.id } });
  await prisma.favoriteMasjid.deleteMany({ where: { userId: req.params.id } });
  await prisma.userNotificationPreference.deleteMany({ where: { userId: req.params.id } });
  await prisma.organizationPerson.deleteMany({ where: { userId: req.params.id } });
  await prisma.volunteerApplication.deleteMany({ where: { applicantId: req.params.id } });
  await prisma.message.deleteMany({ where: { OR: [{ senderId: req.params.id }, { receiverId: req.params.id }] } });
  await prisma.connection.deleteMany({ where: { OR: [{ requesterId: req.params.id }, { receiverId: req.params.id }] } });
  await prisma.post.deleteMany({ where: { authorId: req.params.id } });
  await prisma.event.deleteMany({ where: { createdById: req.params.id } });
  await prisma.organization.updateMany({ where: { ownerId: req.params.id }, data: { ownerId: null, claimed: false } });
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ message: 'User deleted' });
});

app.put('/api/users/:id/role', auth, requireAdmin, async (req, res) => {
  const allowed = ['USER', 'MASJID', 'MSA', 'IMAM', 'STUDENT_OF_KNOWLEDGE', 'BUSINESS', 'ADMIN'];
  if (!allowed.includes(req.body.accountType)) return res.status(400).json({ error: 'Invalid account type' });
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { accountType: req.body.accountType } });
  res.json(publicUser(user, { includeEmail: true }));
});

app.post('/api/users/:id/password-reset', auth, requireAdmin, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const rawToken = randomBytes(32).toString('hex');
  const passwordResetTokenHash = await bcrypt.hash(rawToken, 10);
  const passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await prisma.user.update({ where: { id: user.id }, data: { passwordResetTokenHash, passwordResetExpiresAt } });
  const resetLink = await sendPasswordResetEmail(user, rawToken);
  res.json({ message: 'Password reset generated.', resetLink });
});

app.get('/api/users/:id/warnings', auth, requireAdmin, async (req, res) => {
  const warnings = await prisma.userWarning.findMany({
    where: { userId: req.params.id },
    include: { issuer: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(warnings.map((warning) => ({ ...warning, issuer: publicUser(warning.issuer) })));
});

app.post('/api/users/:id/warnings', auth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Admins cannot warn their own account' });
  const reason = String(req.body.reason || '').trim();
  const note = String(req.body.note || '').trim();
  if (!reason) return res.status(400).json({ error: 'Warning reason is required' });
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: 'User not found' });
  const warning = await prisma.userWarning.create({
    data: { userId: target.id, issuerId: req.user.id, reason: reason.slice(0, 160), note: note ? note.slice(0, 1000) : null },
    include: { issuer: true }
  });
  res.json({ ...warning, issuer: publicUser(warning.issuer) });
});

app.post('/api/connections/:userId', auth, async (req, res) => {
  const targetId = req.params.userId;
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return res.status(404).json({ error: 'User not found' });
  const status = target.isPrivate && req.user.accountType !== 'ADMIN' ? 'PENDING' : 'ACCEPTED';
  const existing = await prisma.connection.findUnique({ where: { requesterId_receiverId: { requesterId: req.user.id, receiverId: targetId } } });
  const connection = existing
    ? await prisma.connection.update({ where: { id: existing.id }, data: { status: existing.status === 'DECLINED' ? status : existing.status } })
    : await prisma.connection.create({ data: { requesterId: req.user.id, receiverId: targetId, status } });
  const [counts, { incoming }] = await Promise.all([getFollowCounts([targetId]), getFollowPair(req.user.id, targetId)]);
  const count = counts.get(targetId) || { followerCount: 0, followingCount: 0 };
  res.json({
    ...connection,
    followStatus: connection.status === 'PENDING' ? 'REQUESTED' : incoming?.status === 'ACCEPTED' ? 'MUTUAL' : 'FOLLOWING',
    followerCount: count.followerCount,
    followingCount: count.followingCount
  });
});

app.delete('/api/connections/:userId', auth, async (req, res) => {
  const targetId = req.params.userId;
  await prisma.connection.deleteMany({ where: { requesterId: req.user.id, receiverId: targetId } });
  const counts = await getFollowCounts([targetId, req.user.id]);
  res.json({ ok: true, followStatus: 'NONE', followerCount: counts.get(targetId)?.followerCount || 0, followingCount: counts.get(req.user.id)?.followingCount || 0 });
});

app.put('/api/connections/:connectionId', auth, async (req, res) => {
  const connection = await prisma.connection.findUnique({ where: { id: req.params.connectionId }, include: { requester: true, receiver: true } });
  if (!connection || connection.receiverId !== req.user.id) return res.status(404).json({ error: 'Follow request not found' });
  const requestedStatus = String(req.body.status || req.body.action || '').toUpperCase();
  if (['DECLINED', 'DENIED', 'DELETE'].includes(requestedStatus)) {
    const updated = await prisma.connection.update({ where: { id: connection.id }, data: { status: 'DECLINED' }, include: { requester: true, receiver: true } });
    return res.json(serializeConnection(updated));
  }
  const updated = await prisma.connection.update({ where: { id: connection.id }, data: { status: 'ACCEPTED' }, include: { requester: true, receiver: true } });
  res.json(serializeConnection(updated));
});

app.get('/api/connections', auth, async (req, res) => {
  const connections = await prisma.connection.findMany({
    where: { OR: [{ requesterId: req.user.id }, { receiverId: req.user.id }] },
    include: { requester: true, receiver: true },
    orderBy: { updatedAt: 'desc' }
  });
  const serialized = connections.map(serializeConnection);
  res.json({
    connections: serialized,
    following: serialized.filter((connection) => connection.requesterId === req.user.id && connection.status === 'ACCEPTED'),
    followers: serialized.filter((connection) => connection.receiverId === req.user.id && connection.status === 'ACCEPTED'),
    requests: serialized.filter((connection) => connection.receiverId === req.user.id && connection.status === 'PENDING'),
    sentRequests: serialized.filter((connection) => connection.requesterId === req.user.id && connection.status === 'PENDING')
  });
});

app.get('/api/me/organizations', auth, async (req, res) => {
  const operationalRoleFilters = organizationManagerRoleFilters();
  const where = req.user.accountType === 'ADMIN' ? {} : {
    OR: [
      { ownerId: req.user.id },
      { people: { some: { userId: req.user.id, OR: operationalRoleFilters } } }
    ]
  };
  const organizations = await prisma.organization.findMany({
    where,
    include: {
      followers: { include: { user: true } },
      people: { include: { user: true }, orderBy: { createdAt: 'desc' } },
      posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } },
      events: { include: { registrations: { include: { user: true } } }, orderBy: { startTime: 'asc' } },
      opportunities: { include: { applications: { include: { applicant: true } } }, orderBy: { createdAt: 'desc' } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(organizations.map((org) => publicOrganization(org, req.user.id, { includeUnclaimedPrograms: true })));
});

app.get('/api/me/notification-masjids', auth, async (req, res) => {
  const follows = await prisma.organizationFollow.findMany({
    where: { userId: req.user.id, notifyPrayers: true },
    include: { organization: { include: { followers: true, favoritedBy: true, people: { include: { user: true } }, posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } }, events: true, opportunities: true } } }
  });
  res.json(follows.map((follow) => publicOrganization(follow.organization, req.user.id)));
});

app.get('/api/me/favorite-masjids', auth, async (req, res) => {
  const favorites = await prisma.favoriteMasjid.findMany({
    where: { userId: req.user.id },
    include: { organization: { include: { followers: true, favoritedBy: true, people: { include: { user: true } }, posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } }, events: true, opportunities: true } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(favorites.map((favorite) => publicOrganization(favorite.organization, req.user.id)));
});

app.get('/api/me/saved-events', auth, async (req, res) => {
  const subscriptions = await prisma.eventSubscription.findMany({
    where: { userId: req.user.id, saved: true },
    include: { event: { include: { organization: true, createdBy: { select: { id: true, name: true, accountType: true } } } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(subscriptions.map((subscription) => ({ ...subscription.event, isSaved: subscription.saved, notifyMe: subscription.notify })));
});

app.get('/api/organizations', async (req, res) => {
  await ensureFallbackOrganizations();
  const header = req.headers.authorization;
  let viewerId = null;
  if (header) {
    try {
      viewerId = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret').id;
    } catch {
      viewerId = null;
    }
  }
  const q = searchTerm(req);
  const organizationWhere = q ? {
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { city: { contains: q, mode: 'insensitive' } },
      { address: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { facilities: { contains: q, mode: 'insensitive' } }
    ]
  } : {};
  const organizations = await prisma.organization.findMany({
    where: organizationWhere,
    include: {
      events: { orderBy: { startTime: 'asc' } },
      posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } },
      opportunities: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      followers: true,
      favoritedBy: true,
      people: { include: { user: true }, orderBy: { createdAt: 'desc' } }
    },
    orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }],
    ...parsePagination(req, 50, 100)
  });
  res.json(organizations.map((org) => publicOrganization(org, viewerId)));
});

app.get('/api/display/:masjidId', async (req, res) => {
  const organization = await prisma.organization.findUnique({
    where: { id: req.params.masjidId },
    include: {
      events: {
        where: { startTime: { gte: new Date() } },
        orderBy: { startTime: 'asc' },
        take: 8
      },
      posts: {
        orderBy: { createdAt: 'desc' },
        take: 12
      }
    }
  });
  if (!organization) return res.status(404).json({ error: 'Masjid display not found' });

  const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const prayerTime = (source, name) => source?.[name] || source?.[name.toLowerCase()] || '';
  const adhanSchedule = organization.iqamahTimes || {};
  const iqamahSchedule = organization.prayerTimes || {};
  let locationAdhanTimes = {};
  if (Number.isFinite(Number(organization.latitude)) && Number.isFinite(Number(organization.longitude))) {
    try {
      locationAdhanTimes = await fetchPrayerTimings({
        latitude: Number(organization.latitude),
        longitude: Number(organization.longitude),
        method: organization.prayerMethod || undefined,
        dateKey: new Date().toISOString().slice(0, 10),
        city: organization.city
      });
    } catch (error) {
      console.error('Display adhan lookup failed', { organizationId: organization.id, message: error.message });
    }
  }
  const displayPrayerTime = (source, name) => {
    const raw = prayerTime(source, name);
    const match = String(raw || '').match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : raw;
  };
  const additionalPrayers = [
    ...(Array.isArray(adhanSchedule.additionalPrayers) ? adhanSchedule.additionalPrayers : []),
    ...(Array.isArray(iqamahSchedule.additionalPrayers) ? iqamahSchedule.additionalPrayers : [])
  ];
  const jummahTimes = [
    prayerTime(iqamahSchedule, 'Jumuah'),
    prayerTime(adhanSchedule, 'Jumuah'),
    ...additionalPrayers
      .filter((item) => /jum|friday/i.test(item?.name || ''))
      .flatMap((item) => [item.jamatTime, item.iqamahTime, item.time])
  ].filter(Boolean).filter((value, index, values) => values.indexOf(value) === index);
  const announcementPost = organization.posts.find((post) => ['ANNOUNCEMENT', 'REMINDER'].includes(post.type)) || organization.posts[0];
  const announcementText = announcementPost
    ? [announcementPost.title, announcementPost.content].filter(Boolean).join(' — ')
    : organization.prayerNotes || `Welcome to ${organization.name}.`;
  const requestOrigin = req.get('origin');
  const trustedRequestOrigin = requestOrigin && isAllowedOrigin(requestOrigin) ? requestOrigin : '';
  const frontendUrl = (process.env.APP_URL || trustedRequestOrigin || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const postEvents = organization.posts
    .filter((post) => post.eventTime && new Date(post.eventTime) >= new Date())
    .map((post) => ({
      id: `post-${post.id}`,
      kind: 'POST_EVENT',
      typeLabel: 'Coming up',
      imageUrl: post.imageUrl,
      title: post.title,
      description: post.content,
      location: post.location,
      startTime: post.eventTime
    }));
  const programSlides = (Array.isArray(organization.classes) ? organization.classes : [])
    .filter((program) => program && (program.title || program.description || program.imageUrl))
    .map((program, index) => ({
      id: `program-${program.id || index}`,
      kind: 'PROGRAM',
      typeLabel: 'Program',
      imageUrl: program.imageUrl || program.heroImageUrl || organization.heroImageUrl || organization.imageUrl,
      title: program.title || 'Masjid program',
      description: program.description || program.notes || program.teacher || '',
      location: program.location || organization.address || organization.city,
      dayTime: program.dayTime || program.time || 'Schedule to be announced',
      startTime: program.startTime || null
    }));
  const events = [
    ...organization.events.map((event) => ({
      id: event.id,
      kind: 'EVENT',
      typeLabel: 'Coming up',
      imageUrl: event.imageUrl,
      title: event.title,
      description: event.description,
      location: event.location,
      startTime: event.startTime
    })),
    ...postEvents
  ].sort((a, b) => new Date(a.startTime) - new Date(b.startTime)).slice(0, 8);
  const slides = [...events, ...programSlides].slice(0, 12);

  res.set('Cache-Control', 'no-store, max-age=0');
  res.json({
    masjidName: organization.name,
    logoUrl: organization.imageUrl || organization.heroImageUrl || null,
    appUrl: `${frontendUrl}/masjids/${encodeURIComponent(organization.id)}`,
    announcement: announcementText.length > 360 ? `${announcementText.slice(0, 357).trim()}…` : announcementText,
    prayers: prayerNames.map((name) => ({
      name,
      adhan: displayPrayerTime(locationAdhanTimes, name) || displayPrayerTime(adhanSchedule, name) || '--:--',
      iqamah: prayerTime(iqamahSchedule, name) || '--:--'
    })),
    jummahTimes: jummahTimes.length ? jummahTimes : ['Time to be announced'],
    events: slides,
    slides,
    updatedAt: new Date().toISOString()
  });
});

app.post('/api/organizations', auth, async (req, res) => {
  if (req.user.accountType !== 'ADMIN') return res.status(403).json({ error: 'Only platform admins can create masjid or MSA profiles' });
  const { name, type, city, address, website, email, phone, description, facilities, latitude, longitude, imageUrl, heroImageUrl, donationUrl, instagramUrl, facebookUrl, prayerTimes, iqamahTimes, prayerNotes, classes, ownerEmail } = req.body;
  const orgType = organizationType(type);
  let ownerId = null;
  let temporaryPassword = null;
  const loginEmail = normalizeEmail(ownerEmail);
  if (loginEmail && !isValidEmail(loginEmail)) return res.status(400).json({ error: 'Owner email must be valid' });
  if (loginEmail) {
    const accountType = orgType === 'MSA' ? 'MSA' : 'MASJID';
    const existingOwner = await prisma.user.findUnique({ where: { email: loginEmail } });
    if (existingOwner) {
      const updatedOwner = await prisma.user.update({ where: { id: existingOwner.id }, data: { accountType } });
      ownerId = updatedOwner.id;
    } else {
      temporaryPassword = `Ummah-${randomBytes(4).toString('hex')}`;
      const owner = await prisma.user.create({
        data: {
          name: `${name} Admin`,
          email: loginEmail,
          passwordHash: await bcrypt.hash(temporaryPassword, 10),
          accountType,
          city,
          location: address
        }
      });
      ownerId = owner.id;
    }
  }
  const org = await prisma.organization.create({
    data: {
      name,
      type: orgType,
      city,
      address,
      website,
      email,
      phone,
      description,
      facilities: Array.isArray(facilities) ? facilities.join(', ') : facilities,
      latitude: latitude == null ? null : Number(latitude),
      longitude: longitude == null ? null : Number(longitude),
      imageUrl,
      heroImageUrl,
      donationUrl,
      instagramUrl,
      facebookUrl,
      prayerTimes,
      iqamahTimes,
      prayerNotes,
      classes: Array.isArray(classes) ? classes : null,
      ownerId,
      claimed: Boolean(loginEmail),
      verified: Boolean(loginEmail)
    }
  });
  if (ownerId) {
    await prisma.organizationPerson.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: ownerId } },
      create: { organizationId: org.id, userId: ownerId, roleLabel: 'Owner / Masjid Admin' },
      update: { roleLabel: 'Owner / Masjid Admin' }
    });
  }
  res.json({ ...org, temporaryPassword });
});

app.get('/api/organizations/:id', async (req, res) => {
  const header = req.headers.authorization;
  let viewerId = null;
  if (header) {
    try {
      viewerId = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret').id;
    } catch {
      viewerId = null;
    }
  }
  const org = await prisma.organization.findUnique({
    where: { id: req.params.id },
    include: {
      events: { include: { registrations: { include: { user: true } } }, orderBy: { startTime: 'asc' } },
      posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } },
      opportunities: { include: { applications: { include: { applicant: true } } }, orderBy: { createdAt: 'desc' } },
      followers: { include: { user: true } },
      favoritedBy: true,
      people: { include: { user: true }, orderBy: { createdAt: 'desc' } }
    }
  });
  if (!org) return res.status(404).json({ error: 'Organization not found' });
  res.json(publicOrganization(org, viewerId));
});

app.put('/api/organizations/:id', auth, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this organization owner or admin can update it' });
  const existing = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Organization not found' });
  const allowed = ['name', 'type', 'city', 'address', 'website', 'email', 'phone', 'description', 'facilities', 'imageUrl', 'heroImageUrl', 'donationUrl', 'instagramUrl', 'facebookUrl', 'prayerTimes', 'iqamahTimes', 'prayerNotes', 'classes'];
  const data = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) data[key] = key === 'facilities' && Array.isArray(req.body[key]) ? req.body[key].join(', ') : req.body[key];
  });
  if (data.classes !== undefined && !Array.isArray(data.classes)) data.classes = null;
  if (data.classes !== undefined) data.claimed = true;
  if (data.type !== undefined) data.type = organizationType(data.type);
  if (req.body.latitude !== undefined) data.latitude = req.body.latitude === '' ? null : Number(req.body.latitude);
  if (req.body.longitude !== undefined) data.longitude = req.body.longitude === '' ? null : Number(req.body.longitude);
  const org = await prisma.organization.update({ where: { id: req.params.id }, data });
  const notifications = {};
  const prayerScheduleChanged = ['prayerTimes', 'iqamahTimes', 'prayerNotes'].some((key) =>
    data[key] !== undefined && JSON.stringify(data[key] ?? null) !== JSON.stringify(existing[key] ?? null)
  );
  const previousClasses = Array.isArray(existing.classes) ? existing.classes : [];
  const nextClasses = Array.isArray(data.classes) ? data.classes : previousClasses;
  const newPrograms = data.classes !== undefined && nextClasses.length > previousClasses.length
    ? nextClasses.slice(previousClasses.length)
    : [];

  if (prayerScheduleChanged) {
    notifications.prayerTimes = await notifyOrganizationFollowers(req.params.id, {
      title: `${org.name} updated prayer times`,
      body: org.prayerNotes || 'The latest jamaat and prayer schedule is now available.',
      url: `/masjids/${org.id}`,
      tag: `prayer-update-${org.id}-${Date.now()}`,
      type: 'PRAYER_UPDATE',
      organizationId: org.id
    }, { excludeUserIds: [req.user.id] });
  }

  if (newPrograms.length) {
    const program = newPrograms[newPrograms.length - 1];
    notifications.program = await notifyOrganizationFollowers(req.params.id, {
      title: `New program: ${program.title || 'Masjid program'}`,
      body: program.description || program.dayTime || program.location || `${org.name} added a new class or program.`,
      url: `/masjids/${org.id}`,
      tag: `program-${org.id}-${program.id || Date.now()}`,
      type: 'CLASS',
      organizationId: org.id,
      metadata: { programId: program.id || null }
    }, { excludeUserIds: [req.user.id] });
  }

  res.json({ ...org, notifications });
});

app.post('/api/organizations/:id/onboard', auth, requireAdmin, async (req, res) => {
  const organization = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!organization) return res.status(404).json({ error: 'Organization not found' });
  try {
    const { owner, temporaryPassword } = await createOrUpdateOrganizationOwner({
      organization,
      ownerEmail: req.body.ownerEmail,
      ownerName: String(req.body.ownerName || '').trim()
    });
    const updated = await prisma.organization.update({
      where: { id: organization.id },
      data: {
        ownerId: owner.id,
        claimed: true,
        verified: true
      },
      include: {
        followers: { include: { user: true } },
        favoritedBy: true,
        people: { include: { user: true }, orderBy: { createdAt: 'desc' } },
        posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } },
        events: { include: { registrations: { include: { user: true } } }, orderBy: { startTime: 'asc' } },
        opportunities: { include: { applications: { include: { applicant: true } } }, orderBy: { createdAt: 'desc' } }
      }
    });
    res.json({ organization: publicOrganization(updated, req.user.id), owner: publicUser(owner, { includeEmail: true }), temporaryPassword, existingUser: !temporaryPassword });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Could not onboard masjid' });
  }
});

app.post('/api/ai/moderate', auth, aiLimiter, async (req, res) => {
  const text = truncateForAi(req.body.text, 4000);
  if (!text) return res.status(400).json({ error: 'Text is required' });
  try {
    const result = await runLoggedAi({
      feature: 'moderation',
      req,
      metadata: { length: text.length },
      task: () => runModeration(text)
    });
    res.json({ flagged: result.flagged, categories: result.categories, categoryScores: result.categoryScores });
  } catch (error) {
    aiErrorResponse(res, error, 'Moderation is temporarily unavailable.');
  }
});

app.post('/api/ai/masjids/:id/generate-copy', auth, aiLimiter, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this masjid or admin can use AI writing tools' });
  const organization = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!organization) return res.status(404).json({ error: 'Organization not found' });
  const notes = truncateForAi(req.body.notes || req.body.content, 1400);
  const mode = ['announcement', 'improve', 'shorter', 'formal', 'engaging'].includes(String(req.body.mode || '').toLowerCase())
    ? String(req.body.mode).toLowerCase()
    : 'announcement';
  const contentType = String(req.body.contentType || req.body.type || 'ANNOUNCEMENT').toUpperCase();
  if (!notes) return res.status(400).json({ error: 'Add rough notes or draft text first' });
  try {
    const moderation = await runLoggedAi({
      feature: 'moderation',
      req,
      organizationId: organization.id,
      metadata: { sourceFeature: 'generate-copy' },
      task: () => runModeration(notes)
    });
    if (moderation.flagged) return res.status(400).json({ error: 'This draft may violate community safety rules. Please rewrite it before using AI.' });
    const prompt = [
      `Masjid: ${organization.name}`,
      `City/address: ${[organization.city, organization.address].filter(Boolean).join(', ') || 'not provided'}`,
      `Content type: ${contentType}`,
      `Requested action: ${mode}`,
      `Rough notes or existing draft: ${notes}`,
      '',
      'Return only JSON with keys: title, description, shortCaption, suggestedType, fields.',
      'fields can include location, dateText, timeText, audience, registrationLink, speaker, and notes when present.'
    ].join('\n');
    const result = await runLoggedAi({
      feature: 'generate-copy',
      req,
      organizationId: organization.id,
      metadata: { mode, contentType },
      task: () => runAiText({
        maxOutputTokens: 650,
        system: 'You write concise, respectful Muslim community announcements for masjid apps. Preserve facts, never invent dates, prices, speakers, registration links, religious claims, or rulings. Make copy warm, clear, mobile-friendly, and ready for admin review.',
        prompt
      })
    });
    const parsed = aiJsonResponse(result.text, {});
    res.json({
      title: truncateForAi(parsed.title, 140) || organization.name,
      description: truncateForAi(parsed.description || parsed.shortCaption || result.text, 1800),
      shortCaption: truncateForAi(parsed.shortCaption, 280),
      suggestedType: parsed.suggestedType || contentType,
      fields: parsed.fields || {},
      reviewRequired: true
    });
  } catch (error) {
    aiErrorResponse(res, error);
  }
});

app.post('/api/ai/masjids/:id/extract-poster', auth, aiLimiter, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this masjid or admin can read posters with AI' });
  const organization = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!organization) return res.status(404).json({ error: 'Organization not found' });
  const imageUrl = String(req.body.imageUrl || req.body.imageDataUrl || '').trim();
  if (!imageUrl) return res.status(400).json({ error: 'Upload a poster image or provide an image URL' });
  if (imageUrl.startsWith('data:') && imageUrl.length > 5_500_000) return res.status(413).json({ error: 'Poster image is too large. Please use a smaller image.' });
  if (!imageUrl.startsWith('data:image/') && !/^https?:\/\//i.test(imageUrl)) return res.status(400).json({ error: 'Poster must be an image URL or image data URL' });
  try {
    const result = await runLoggedAi({
      feature: 'poster-extract',
      req,
      organizationId: organization.id,
      metadata: { dataUrl: imageUrl.startsWith('data:'), inputBytes: imageUrl.length },
      task: () => runAiImageRead({
        maxOutputTokens: 800,
        system: 'You extract public event information from an existing poster image for a masjid admin. Do not create poster art. Do not invent missing facts. Return concise JSON only.',
        prompt: 'Read this event poster. Return only JSON with: title, date, time, location, speaker, host, audience, registrationLink, shortDescription, confidence, missingFields. Use null for unavailable fields.',
        imageUrl
      })
    });
    const parsed = aiJsonResponse(result.text, {});
    const cacheKey = `poster:${organization.id}:${hashAiInput({ imageUrl: imageUrl.slice(0, 200), text: result.text })}`;
    await prisma.aiCache.upsert({
      where: { cacheKey },
      create: {
        feature: 'poster-extract',
        cacheKey,
        sourceHash: hashAiInput(imageUrl.slice(0, 1200)),
        input: { organizationId: organization.id },
        output: parsed,
        userId: req.user.id,
        organizationId: organization.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      update: { output: parsed, userId: req.user.id, organizationId: organization.id }
    });
    res.json({ ...parsed, reviewRequired: true });
  } catch (error) {
    aiErrorResponse(res, error, 'Poster reading is temporarily unavailable. You can still enter event details manually.');
  }
});

app.post('/api/ai/translate', auth, aiLimiter, async (req, res) => {
  const languageMap = { english: 'English', arabic: 'Arabic', urdu: 'Urdu' };
  const targetLanguage = languageMap[String(req.body.targetLanguage || '').toLowerCase()] || null;
  const text = truncateForAi(req.body.text, 2500);
  const contentId = String(req.body.id || '').slice(0, 120);
  const contentType = String(req.body.contentType || 'post').toLowerCase().slice(0, 40);
  if (!targetLanguage) return res.status(400).json({ error: 'Choose English, Arabic, or Urdu' });
  if (!text) return res.status(400).json({ error: 'Text is required' });
  const cacheKey = `translate:${contentType}:${contentId}:${targetLanguage}:${hashAiInput(text)}`;
  const cached = await prisma.aiCache.findUnique({ where: { cacheKey } });
  if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
    await logAiUsage({ feature: 'translate-cache-hit', userId: req.user.id, success: true, metadata: { contentType, contentId, targetLanguage } });
    return res.json({ translatedText: cached.output.translatedText, targetLanguage, cached: true });
  }
  try {
    const result = await runLoggedAi({
      feature: 'translate',
      req,
      metadata: { contentType, contentId, targetLanguage },
      task: () => runAiText({
        maxOutputTokens: 700,
        system: 'Translate public masjid app content faithfully. Preserve dates, times, names, URLs, and Islamic terms when appropriate. Return only JSON.',
        prompt: `Translate this public ${contentType} into ${targetLanguage}. Return JSON with translatedText only.\n\n${text}`
      })
    });
    const parsed = aiJsonResponse(result.text, {});
    const translatedText = truncateForAi(parsed.translatedText || result.text, 2500);
    await prisma.aiCache.upsert({
      where: { cacheKey },
      create: {
        feature: 'translate',
        cacheKey,
        sourceHash: hashAiInput(text),
        input: { contentType, contentId, targetLanguage },
        output: { translatedText },
        userId: req.user.id,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      },
      update: { output: { translatedText }, userId: req.user.id }
    });
    res.json({ translatedText, targetLanguage, cached: false });
  } catch (error) {
    aiErrorResponse(res, error, 'Translation is temporarily unavailable. The original content is still visible.');
  }
});

app.get('/api/ai/recommendations', auth, aiLimiter, async (req, res) => {
  const currentUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      favoriteMasjids: true,
      organizationFollows: true,
      eventSubscriptions: true
    }
  });
  if (!currentUser) return res.status(404).json({ error: 'User not found' });
  const favoriteIds = new Set(currentUser.favoriteMasjids.map((item) => item.organizationId));
  const followedIds = new Set(currentUser.organizationFollows.map((item) => item.organizationId));
  const interests = new Set([...(currentUser.interests || []), ...(currentUser.skills || [])].map((item) => String(item).toLowerCase()));
  const organizations = await prisma.organization.findMany({
    include: { followers: true, favoritedBy: true },
    orderBy: { createdAt: 'desc' },
    take: 80
  });
  const events = await prisma.event.findMany({
    where: { startTime: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
    include: { organization: true },
    orderBy: { startTime: 'asc' },
    take: 80
  });
  const opportunities = await prisma.opportunity.findMany({
    where: { isActive: true },
    include: { organization: true },
    orderBy: { createdAt: 'desc' },
    take: 80
  });
  const users = await prisma.user.findMany({
    where: { id: { not: req.user.id }, isPrivate: false },
    orderBy: { createdAt: 'desc' },
    take: 80
  });
  function scoreText(text = '') {
    const lower = text.toLowerCase();
    let score = 0;
    interests.forEach((interest) => {
      if (interest && lower.includes(interest)) score += 2;
    });
    if (currentUser.city && lower.includes(String(currentUser.city).toLowerCase())) score += 1;
    return score;
  }
  function reasonForOrg(org) {
    if (favoriteIds.has(org.id)) return 'Recommended because this is one of your favorite masjids.';
    if (followedIds.has(org.id)) return 'Recommended because you follow this masjid.';
    if (currentUser.city && org.city && currentUser.city.toLowerCase() === org.city.toLowerCase()) return 'Recommended because it is in your city.';
    return 'Recommended because it is active in your community.';
  }
  const masjidItems = organizations
    .map((org) => {
      const classes = Array.isArray(org.classes) ? org.classes : [];
      return { kind: 'masjid', item: publicOrganization(org, req.user.id), score: (favoriteIds.has(org.id) ? 8 : 0) + (followedIds.has(org.id) ? 6 : 0) + scoreText(`${org.name} ${org.description || ''} ${org.city || ''} ${classes.map((item) => item.title || '').join(' ')}`), reason: reasonForOrg(org) };
    })
    .sort((a, b) => b.score - a.score || Number(b.item?.followerCount || 0) - Number(a.item?.followerCount || 0))
    .slice(0, 6);
  const eventItems = events
    .map((event) => ({ kind: 'event', item: event, score: (favoriteIds.has(event.organizationId) ? 8 : 0) + (followedIds.has(event.organizationId) ? 6 : 0) + scoreText(`${event.title} ${event.description || ''} ${event.location || ''}`), reason: favoriteIds.has(event.organizationId) ? 'Recommended because it is from a favorite masjid.' : followedIds.has(event.organizationId) ? 'Recommended because you follow the host masjid.' : 'Recommended because it matches your community interests.' }))
    .sort((a, b) => b.score - a.score || new Date(a.item.startTime) - new Date(b.item.startTime))
    .slice(0, 6);
  const opportunityItems = opportunities
    .map((opportunity) => ({ kind: 'opportunity', item: opportunity, score: (favoriteIds.has(opportunity.organizationId) ? 8 : 0) + (followedIds.has(opportunity.organizationId) ? 6 : 0) + scoreText(`${opportunity.title} ${opportunity.description || ''} ${(opportunity.skills || []).join(' ')}`), reason: opportunity.type === 'JOB' ? 'Recommended from Muslim community job listings.' : 'Recommended because it is a community service opportunity.' }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const userItems = users
    .map((person) => ({ kind: 'user', item: publicUser(person), score: scoreText(`${person.name} ${person.headline || ''} ${person.bio || ''} ${person.city || ''} ${(person.skills || []).join(' ')} ${(person.interests || []).join(' ')}`), reason: 'Recommended from public profile interests and community skills.' }))
    .filter((entry) => entry.score > 0 || currentUser.city && entry.item.city === currentUser.city)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  await logAiUsage({ feature: 'recommendations', userId: req.user.id, success: true, metadata: { deterministic: true } });
  res.json({ masjids: masjidItems, events: eventItems, opportunities: opportunityItems, users: userItems });
});

app.post('/api/ai/masjids/:id/newsletter', auth, aiLimiter, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this masjid or admin can generate newsletters' });
  const organization = await prisma.organization.findUnique({
    where: { id: req.params.id },
    include: {
      events: { where: { startTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, orderBy: { startTime: 'asc' }, take: 12 },
      posts: { orderBy: { createdAt: 'desc' }, take: 12 },
      opportunities: { where: { isActive: true }, orderBy: { createdAt: 'desc' }, take: 8 }
    }
  });
  if (!organization) return res.status(404).json({ error: 'Organization not found' });
  const source = {
    masjid: { name: organization.name, city: organization.city },
    events: organization.events.map((event) => ({ title: event.title, startTime: event.startTime, location: event.location, description: truncateForAi(event.description, 320) })),
    posts: organization.posts.map((post) => ({ title: post.title, type: post.type, content: truncateForAi(post.content, 320) })),
    opportunities: organization.opportunities.map((item) => ({ title: item.title, type: item.type, description: truncateForAi(item.description, 260), location: item.location })),
    programs: (Array.isArray(organization.classes) ? organization.classes : []).slice(0, 10).map((item) => ({ title: item.title, teacher: item.teacher, dayTime: item.dayTime, location: item.location }))
  };
  const cacheKey = `newsletter:${organization.id}:${hashAiInput(source)}`;
  const cached = await prisma.aiNewsletterDraft.findFirst({
    where: { organizationId: organization.id, metadata: { path: ['cacheKey'], equals: cacheKey } },
    orderBy: { createdAt: 'desc' }
  });
  if (cached && cached.createdAt > new Date(Date.now() - 12 * 60 * 60 * 1000)) return res.json({ draft: cached, cached: true, reviewRequired: true });
  try {
    const result = await runLoggedAi({
      feature: 'newsletter',
      req,
      organizationId: organization.id,
      metadata: { eventCount: source.events.length, postCount: source.posts.length },
      task: () => runAiText({
        maxOutputTokens: 900,
        system: 'You create clean weekly masjid newsletters for mobile app preview. Be organized, respectful, concise, and community-friendly. Do not invent details. Return only JSON.',
        prompt: `Create a weekly newsletter draft from this source data. Return JSON with title and content. Include sections for upcoming events, announcements, programs/classes, and opportunities only when data exists.\n\n${JSON.stringify(source)}`
      })
    });
    const parsed = aiJsonResponse(result.text, {});
    const draft = await prisma.aiNewsletterDraft.create({
      data: {
        organizationId: organization.id,
        userId: req.user.id,
        title: truncateForAi(parsed.title, 160) || `${organization.name} Weekly Update`,
        content: truncateForAi(parsed.content || result.text, 5000),
        sourceRangeStart: new Date(),
        sourceRangeEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        metadata: { cacheKey, sourceSummary: { events: source.events.length, posts: source.posts.length, opportunities: source.opportunities.length, programs: source.programs.length } }
      }
    });
    res.json({ draft, cached: false, reviewRequired: true });
  } catch (error) {
    aiErrorResponse(res, error, 'Newsletter generation is temporarily unavailable. You can still write one manually.');
  }
});

app.put('/api/ai/newsletters/:draftId', auth, aiLimiter, async (req, res) => {
  const draft = await prisma.aiNewsletterDraft.findUnique({ where: { id: req.params.draftId } });
  if (!draft) return res.status(404).json({ error: 'Newsletter draft not found' });
  if (!(await canManageOrganization(req.user, draft.organizationId))) return res.status(403).json({ error: 'Only this masjid or admin can update this newsletter' });
  const data = {};
  if (req.body.title !== undefined) data.title = truncateForAi(req.body.title, 160) || draft.title;
  if (req.body.content !== undefined) data.content = truncateForAi(req.body.content, 5000) || draft.content;
  if (req.body.status !== undefined) data.status = ['DRAFT', 'APPROVED', 'POSTED'].includes(String(req.body.status).toUpperCase()) ? String(req.body.status).toUpperCase() : draft.status;
  const updated = await prisma.aiNewsletterDraft.update({ where: { id: draft.id }, data });
  res.json(updated);
});

app.get('/api/posts', auth, async (req, res) => {
  const follows = await prisma.organizationFollow.findMany({ where: { userId: req.user.id }, select: { organizationId: true, notifyPrayers: true } });
  const followedIds = new Set(follows.map((follow) => follow.organizationId));
  const favorites = await prisma.favoriteMasjid.findMany({ where: { userId: req.user.id }, select: { organizationId: true } });
  const favoriteIds = new Set(favorites.map((favorite) => favorite.organizationId));
  const saved = await prisma.savedPost.findMany({ where: { userId: req.user.id }, select: { postId: true } });
  const savedIds = new Set(saved.map((item) => item.postId));
  const liked = await prisma.postLike.findMany({ where: { userId: req.user.id }, select: { postId: true } });
  const likedIds = new Set(liked.map((item) => item.postId));
  const q = searchTerm(req);
  const postWhere = {
    ...(req.query.type ? { type: String(req.query.type).toUpperCase() } : {}),
    ...(req.query.organizationId ? { organizationId: String(req.query.organizationId) } : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { organization: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const posts = await prisma.post.findMany({
    where: postWhere,
    include: {
      author: true,
      organization: { include: { followers: true, favoritedBy: true } },
      likedBy: true,
      comments: { include: { author: true }, orderBy: { createdAt: 'desc' }, take: 3 },
      _count: { select: { comments: true } }
    },
    orderBy: { createdAt: 'desc' },
    ...parsePagination(req, 100, 100)
  });
  const eventPosts = posts.filter((post) => String(post.type || '').toUpperCase() === 'EVENT');
  const matchingEvents = eventPosts.length ? await prisma.event.findMany({
    where: { organizationId: { in: [...new Set(eventPosts.map((post) => post.organizationId))] } },
    select: { organizationId: true, title: true, startTime: true }
  }) : [];
  res.json(posts.filter((post) => hasMatchingEvent(post, matchingEvents)).map((post) => {
    const { likedBy, ...postRecord } = post;
    return {
      ...publicPost(postRecord),
      isFromFollowedMasjid: followedIds.has(post.organizationId),
      isFromFavoriteMasjid: favoriteIds.has(post.organizationId),
      isSaved: savedIds.has(post.id),
      isLiked: likedIds.has(post.id),
      likeCount: likedBy.length,
      followerCount: post.organization?.followers?.length || 0
    };
  }).sort((a, b) => Number(b.isFromFavoriteMasjid) - Number(a.isFromFavoriteMasjid) || Number(b.isFromFollowedMasjid) - Number(a.isFromFollowedMasjid) || new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/posts/:id/save', auth, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const saved = await prisma.savedPost.upsert({
    where: { postId_userId: { postId: post.id, userId: req.user.id } },
    create: { postId: post.id, userId: req.user.id },
    update: {}
  });
  res.json({ saved: true, id: saved.id });
});

app.delete('/api/posts/:id/save', auth, async (req, res) => {
  await prisma.savedPost.deleteMany({ where: { postId: req.params.id, userId: req.user.id } });
  res.json({ saved: false });
});

app.post('/api/posts/:id/like', auth, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const liked = await prisma.postLike.upsert({
    where: { postId_userId: { postId: post.id, userId: req.user.id } },
    create: { postId: post.id, userId: req.user.id },
    update: {}
  });
  res.json({ liked: true, id: liked.id });
});

app.delete('/api/posts/:id/like', auth, async (req, res) => {
  await prisma.postLike.deleteMany({ where: { postId: req.params.id, userId: req.user.id } });
  res.json({ liked: false });
});

app.post('/api/posts/:id/comments', auth, async (req, res) => {
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Comment is required' });
  if (content.length > 500) return res.status(400).json({ error: 'Comment must be 500 characters or less' });
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const comment = await prisma.postComment.create({
    data: { postId: post.id, authorId: req.user.id, content },
    include: { author: true }
  });
  res.json({ ...comment, author: publicUser(comment.author) });
});

app.delete('/api/posts/:postId/comments/:commentId', auth, async (req, res) => {
  const comment = await prisma.postComment.findUnique({
    where: { id: req.params.commentId },
    include: { post: true }
  });
  if (!comment || comment.postId !== req.params.postId) return res.status(404).json({ error: 'Comment not found' });
  const canDelete = comment.authorId === req.user.id || req.user.accountType === 'ADMIN' || await canManageOrganization(req.user, comment.post.organizationId);
  if (!canDelete) return res.status(403).json({ error: 'Only the comment author, post masjid, or admin can delete this comment' });
  await prisma.postComment.delete({ where: { id: comment.id } });
  res.json({ deleted: true });
});

app.post('/api/organizations/:id/posts', auth, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this masjid or admin can create posts' });
  if (!req.body.title?.trim() || !req.body.content?.trim()) return res.status(400).json({ error: 'Title and content are required' });
  const type = ['ANNOUNCEMENT', 'EVENT', 'REMINDER', 'FUNDRAISER', 'CLASS', 'VOLUNTEER', 'JOB'].includes(String(req.body.type || '').toUpperCase()) ? String(req.body.type).toUpperCase() : 'ANNOUNCEMENT';
  const eventTime = req.body.eventTime ? normalizeRequiredDate(req.body.eventTime) : null;
  if (req.body.eventTime && !eventTime) return res.status(400).json({ error: 'Event time must be a valid date' });
  let imageUrl = null;
  try {
    imageUrl = await archiveRemoteImage(req.body.imageUrl, req);
  } catch (error) {
    return res.status(400).json({ error: `Post image could not be saved: ${error.message}` });
  }
  const post = await prisma.post.create({
    data: {
      organizationId: req.params.id,
      authorId: req.user.id,
      title: req.body.title.trim(),
      content: req.body.content.trim(),
      type,
      imageUrl,
      location: req.body.location || null,
      eventTime
    },
    include: { author: true, organization: true }
  });
  const { push } = await notifyOrganizationFollowers(req.params.id, {
    title: post.title,
    body: post.content,
    url: `/masjids/${req.params.id}`,
    tag: `${type.toLowerCase()}-${post.id}`,
    type,
    organizationId: req.params.id,
    postId: post.id
  }, { excludeUserIds: [req.user.id] });
  res.json({ ...publicPost(post), push });
});

app.put('/api/posts/:id', auth, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const canUpdate = post.authorId === req.user.id || req.user.accountType === 'ADMIN' || await canManageOrganization(req.user, post.organizationId);
  if (!canUpdate) return res.status(403).json({ error: 'Only post managers can update this post' });
  const data = {};
  if (req.body.title !== undefined) {
    if (!String(req.body.title).trim()) return res.status(400).json({ error: 'Title is required' });
    data.title = String(req.body.title).trim();
  }
  if (req.body.content !== undefined) {
    if (!String(req.body.content).trim()) return res.status(400).json({ error: 'Content is required' });
    data.content = String(req.body.content).trim();
  }
  if (req.body.type !== undefined) data.type = ['ANNOUNCEMENT', 'EVENT', 'REMINDER', 'FUNDRAISER', 'CLASS', 'VOLUNTEER', 'JOB'].includes(String(req.body.type).toUpperCase()) ? String(req.body.type).toUpperCase() : post.type;
  if (req.body.imageUrl !== undefined) {
    try {
      data.imageUrl = await archiveRemoteImage(req.body.imageUrl, req);
    } catch (error) {
      return res.status(400).json({ error: `Post image could not be saved: ${error.message}` });
    }
  }
  if (req.body.location !== undefined) data.location = req.body.location || null;
  if (req.body.eventTime !== undefined) {
    data.eventTime = req.body.eventTime ? normalizeRequiredDate(req.body.eventTime) : null;
    if (req.body.eventTime && !data.eventTime) return res.status(400).json({ error: 'Event time must be a valid date' });
  }
  const updated = await prisma.post.update({ where: { id: post.id }, data, include: { author: true, organization: true } });
  res.json(publicPost(updated));
});

app.delete('/api/posts/:id', auth, async (req, res) => {
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const canDelete = post.authorId === req.user.id || req.user.accountType === 'ADMIN' || await canManageOrganization(req.user, post.organizationId);
  if (!canDelete) return res.status(403).json({ error: 'Only post managers can delete this post' });
  await prisma.post.delete({ where: { id: post.id } });
  res.json({ message: 'Post deleted' });
});

async function hydratedOrganizationForViewer(organizationId, viewerId) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      events: { include: { registrations: { include: { user: true } } }, orderBy: { startTime: 'asc' } },
      posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } },
      opportunities: { include: { applications: { include: { applicant: true } } }, orderBy: { createdAt: 'desc' } },
      followers: { include: { user: true } },
      favoritedBy: true,
      people: { include: { user: true }, orderBy: { createdAt: 'desc' } }
    }
  });
  return org ? publicOrganization(org, viewerId) : null;
}

app.post('/api/organizations/:id/follow', auth, async (req, res) => {
  if (['MASJID', 'MSA', 'ADMIN'].includes(req.user.accountType)) return res.status(403).json({ error: 'Organization and admin accounts manage masjids from the dashboard' });
  const organization = await prisma.organization.findUnique({ where: { id: req.params.id } });
  if (!organization) return res.status(404).json({ error: 'Organization not found' });

  const existingFollow = await prisma.organizationFollow.findUnique({ where: { organizationId_userId: { organizationId: req.params.id, userId: req.user.id } } });
  const notifyPrayers = req.body.notifyPrayers === undefined ? Boolean(existingFollow?.notifyPrayers) : Boolean(req.body.notifyPrayers);
  if (notifyPrayers) {
    const activeNotificationFollows = await prisma.organizationFollow.count({ where: { userId: req.user.id, notifyPrayers: true, organizationId: { not: req.params.id } } });
    if (activeNotificationFollows >= 2) return res.status(400).json({ error: 'You can enable prayer notifications for up to 2 masjids' });
  }

  await prisma.organizationFollow.upsert({
    where: { organizationId_userId: { organizationId: req.params.id, userId: req.user.id } },
    create: { organizationId: req.params.id, userId: req.user.id, notifyPrayers },
    update: { notifyPrayers }
  });

  const hydrated = await hydratedOrganizationForViewer(req.params.id, req.user.id);
  res.json({ following: true, organization: hydrated });
});

app.delete('/api/organizations/:id/follow', auth, async (req, res) => {
  await prisma.organizationFollow.deleteMany({ where: { organizationId: req.params.id, userId: req.user.id } });
  const hydrated = await hydratedOrganizationForViewer(req.params.id, req.user.id);
  res.json({ following: false, organization: hydrated });
});

app.post('/api/organizations/:id/favorite', auth, async (req, res) => {
  if (['MASJID', 'MSA', 'ADMIN'].includes(req.user.accountType)) return res.status(403).json({ error: 'Organization and admin accounts manage masjids from the dashboard' });
  const organization = await prisma.organization.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!organization) return res.status(404).json({ error: 'Organization not found' });
  const favorite = await prisma.favoriteMasjid.upsert({
    where: { organizationId_userId: { organizationId: req.params.id, userId: req.user.id } },
    create: { organizationId: req.params.id, userId: req.user.id },
    update: {}
  });
  res.json({ favorited: true, id: favorite.id });
});

app.delete('/api/organizations/:id/favorite', auth, async (req, res) => {
  await prisma.favoriteMasjid.deleteMany({ where: { organizationId: req.params.id, userId: req.user.id } });
  res.json({ favorited: false });
});

app.delete('/api/organizations/:id/followers/:userId', auth, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this organization owner or admin can manage followers' });
  await prisma.organizationFollow.deleteMany({ where: { organizationId: req.params.id, userId: req.params.userId } });
  res.json({ message: 'Follower removed' });
});

app.post('/api/organizations/:id/people', auth, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this organization owner or admin can manage team members' });
  const userId = String(req.body.userId || '');
  if (!userId) return res.status(400).json({ error: 'User is required' });
  const memberUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!memberUser) return res.status(404).json({ error: 'User not found' });
  const roleLabel = String(req.body.roleLabel || 'Team member').trim().slice(0, 80) || 'Team member';
  const person = await prisma.organizationPerson.upsert({
    where: { organizationId_userId: { organizationId: req.params.id, userId } },
    create: { organizationId: req.params.id, userId, roleLabel },
    update: { roleLabel },
    include: { user: true }
  });
  res.json({ ...person, user: publicUser(person.user, { includeEmail: true }) });
});

app.post('/api/organizations/:id/people/invite', auth, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this organization owner or admin can invite team members' });
  const email = normalizeEmail(req.body.email);
  const name = String(req.body.name || '').trim();
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Email must be valid' });
  const roleLabel = String(req.body.roleLabel || 'Team member').trim().slice(0, 80) || 'Team member';
  const requestedType = String(req.body.accountType || 'USER').toUpperCase();
  const accountType = ['IMAM', 'STUDENT_OF_KNOWLEDGE', 'USER', 'MASJID', 'MSA'].includes(requestedType) ? requestedType : 'USER';
  let temporaryPassword = null;
  let memberUser = await prisma.user.findUnique({ where: { email } });
  if (!memberUser) {
    temporaryPassword = `Ummah-${randomBytes(4).toString('hex')}`;
    memberUser = await prisma.user.create({
      data: {
        name: name || email.split('@')[0],
        email,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        accountType
      }
    });
  } else if (memberUser.accountType === 'USER' && accountType !== 'USER') {
    memberUser = await prisma.user.update({ where: { id: memberUser.id }, data: { accountType } });
  }
  const person = await prisma.organizationPerson.upsert({
    where: { organizationId_userId: { organizationId: req.params.id, userId: memberUser.id } },
    create: { organizationId: req.params.id, userId: memberUser.id, roleLabel },
    update: { roleLabel },
    include: { user: true }
  });
  res.json({ ...person, user: publicUser(person.user, { includeEmail: true }), temporaryPassword, existingUser: !temporaryPassword });
});

app.delete('/api/organizations/:id/people/:userId', auth, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this organization owner or admin can manage team members' });
  await prisma.organizationPerson.deleteMany({ where: { organizationId: req.params.id, userId: req.params.userId } });
  res.json({ message: 'Team member removed' });
});

app.get('/api/events', async (req, res) => {
  let viewerId = null;
  const header = req.headers.authorization;
  if (header) {
    try {
      viewerId = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET || 'dev_secret').id;
    } catch {
      viewerId = null;
    }
  }
  const q = searchTerm(req);
  const eventWhere = {
    ...(req.query.organizationId ? { organizationId: String(req.query.organizationId) } : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { organization: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const events = await prisma.event.findMany({
    where: eventWhere,
    include: { organization: { include: { followers: true, favoritedBy: true } }, createdBy: { select: { id: true, name: true, accountType: true } }, registrations: { include: { user: true } }, subscriptions: viewerId ? { where: { userId: viewerId } } : false },
    orderBy: { startTime: 'asc' },
    ...parsePagination(req, 100, 100)
  });
  res.json(events.map((event) => {
    const viewerFollow = viewerId ? event.organization?.followers?.find((follow) => follow.userId === viewerId) : null;
    const viewerFavorite = viewerId ? event.organization?.favoritedBy?.some((favorite) => favorite.userId === viewerId) : false;
    const subscription = event.subscriptions?.[0];
    const { followers: _followers, favoritedBy: _favoritedBy, ...organization } = event.organization || {};
    const { subscriptions: _subscriptions, ...safeEvent } = event;
    return {
      ...safeEvent,
      organization: event.organization ? organization : null,
      isFromFollowedMasjid: Boolean(viewerFollow),
      isFromFavoriteMasjid: Boolean(viewerFavorite),
      isSaved: Boolean(subscription?.saved),
      notifyMe: Boolean(subscription?.notify),
      registrations: event.registrations
        .filter((registration) => registration.userId === viewerId)
        .map((registration) => ({ ...registration, user: publicUser(registration.user, { includeEmail: true }) }))
    };
  }).sort((a, b) => Number(b.isFromFavoriteMasjid) - Number(a.isFromFavoriteMasjid) || Number(b.isFromFollowedMasjid) - Number(a.isFromFollowedMasjid) || new Date(a.startTime) - new Date(b.startTime)));
});

app.post('/api/events', auth, async (req, res) => {
  const { title, description, location, imageUrl, startTime, endTime, organizationId, capacity, requiresApproval } = req.body;
  if (!title || !startTime) return res.status(400).json({ error: 'Title and start time are required' });
  if (!organizationId && !['MASJID', 'MSA', 'ADMIN'].includes(req.user.accountType)) return res.status(403).json({ error: 'Only masjid, MSA, or admin accounts can post standalone events' });
  if (organizationId && !(await canManageOrganization(req.user, organizationId))) return res.status(403).json({ error: 'You can only post under an organization you manage' });
  const normalizedStartTime = normalizeRequiredDate(startTime);
  if (!normalizedStartTime) return res.status(400).json({ error: 'Start time must be a valid date' });
  const normalizedEndTime = endTime ? normalizeRequiredDate(endTime) : null;
  if (endTime && !normalizedEndTime) return res.status(400).json({ error: 'End time must be a valid date' });
  const normalizedCapacity = normalizeOptionalNumber(capacity);
  if (normalizedCapacity === undefined) return res.status(400).json({ error: 'Capacity must be a valid number' });
  let archivedImageUrl = null;
  try {
    archivedImageUrl = await archiveRemoteImage(imageUrl, req);
  } catch (error) {
    return res.status(400).json({ error: `Event image could not be saved: ${error.message}` });
  }
  const event = await prisma.event.create({
    data: {
      title,
      description,
      location,
      imageUrl: archivedImageUrl,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      capacity: normalizedCapacity,
      requiresApproval: Boolean(requiresApproval),
      organizationId,
      createdById: req.user.id
    }
  });
  await syncEventPost(event, req.user.id);
  let push = null;
  if (organizationId) {
    ({ push } = await notifyOrganizationFollowers(organizationId, {
      title: `New event: ${event.title}`,
      body: event.description || event.location || 'A masjid you follow posted a new event.',
      url: `/events/${event.id}`,
      type: 'EVENT',
      organizationId,
      eventId: event.id
    }, { excludeUserIds: [req.user.id] }));
  }
  res.json({ ...event, push });
});

app.put('/api/events/:eventId', auth, async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const canManage = event.createdById === req.user.id || req.user.accountType === 'ADMIN' || (event.organizationId && await canManageOrganization(req.user, event.organizationId));
  if (!canManage) return res.status(403).json({ error: 'Only event managers can update this event' });
  const data = {};
  if (req.body.title !== undefined) {
    if (!String(req.body.title).trim()) return res.status(400).json({ error: 'Title is required' });
    data.title = String(req.body.title).trim();
  }
  if (req.body.description !== undefined) data.description = req.body.description || null;
  if (req.body.location !== undefined) data.location = req.body.location || null;
  if (req.body.imageUrl !== undefined) {
    try {
      data.imageUrl = await archiveRemoteImage(req.body.imageUrl, req);
    } catch (error) {
      return res.status(400).json({ error: `Event image could not be saved: ${error.message}` });
    }
  }
  if (req.body.startTime !== undefined) {
    if (!req.body.startTime) return res.status(400).json({ error: 'Start time is required' });
    data.startTime = normalizeRequiredDate(req.body.startTime);
    if (!data.startTime) return res.status(400).json({ error: 'Start time must be a valid date' });
  }
  if (req.body.endTime !== undefined) {
    data.endTime = req.body.endTime ? normalizeRequiredDate(req.body.endTime) : null;
    if (req.body.endTime && !data.endTime) return res.status(400).json({ error: 'End time must be a valid date' });
  }
  if (req.body.capacity !== undefined) {
    data.capacity = normalizeOptionalNumber(req.body.capacity);
    if (data.capacity === undefined) return res.status(400).json({ error: 'Capacity must be a valid number' });
  }
  if (req.body.requiresApproval !== undefined) data.requiresApproval = Boolean(req.body.requiresApproval);
  const updated = await prisma.event.update({ where: { id: event.id }, data, include: { organization: true, createdBy: { select: { id: true, name: true, accountType: true } }, registrations: { include: { user: true } } } });
  await updateSyncedEventPost(event, updated, updated.createdById || req.user.id);
  let push = null;
  if (updated.organizationId) {
    ({ push } = await notifyOrganizationFollowers(updated.organizationId, {
      title: `Event updated: ${updated.title}`,
      body: updated.description || updated.location || 'An event from a masjid you follow was updated.',
      url: `/events/${updated.id}`,
      type: 'EVENT',
      organizationId: updated.organizationId,
      eventId: updated.id
    }, { excludeUserIds: [req.user.id] }));
  }
  res.json({ ...updated, push, registrations: updated.registrations.map((registration) => ({ ...registration, user: publicUser(registration.user, { includeEmail: true }) })) });
});

app.delete('/api/events/:eventId', auth, async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const canManage = event.createdById === req.user.id || req.user.accountType === 'ADMIN' || (event.organizationId && await canManageOrganization(req.user, event.organizationId));
  if (!canManage) return res.status(403).json({ error: 'Only event managers can delete this event' });
  await prisma.eventRegistration.deleteMany({ where: { eventId: event.id } });
  await prisma.eventSubscription.deleteMany({ where: { eventId: event.id } });
  await deleteSyncedEventPosts(event);
  await prisma.event.delete({ where: { id: event.id } });
  res.json({ message: 'Event deleted' });
});

app.post('/api/events/:eventId/subscribe', auth, async (req, res) => {
  if (['MASJID', 'MSA'].includes(req.user.accountType)) return res.status(403).json({ error: 'Masjid and MSA accounts manage events from the dashboard' });
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const notify = req.body.notify === undefined ? true : Boolean(req.body.notify);
  const saved = req.body.saved === undefined ? true : Boolean(req.body.saved);
  const subscription = await prisma.eventSubscription.upsert({
    where: { userId_eventId: { userId: req.user.id, eventId: event.id } },
    create: { userId: req.user.id, eventId: event.id, notify, saved },
    update: { notify, saved }
  });
  res.json({ saved: subscription.saved, notifyMe: subscription.notify, id: subscription.id });
});

app.delete('/api/events/:eventId/subscribe', auth, async (req, res) => {
  await prisma.eventSubscription.deleteMany({ where: { userId: req.user.id, eventId: req.params.eventId } });
  res.json({ saved: false, notifyMe: false });
});

app.post('/api/events/:eventId/register', auth, async (req, res) => {
  try {
    if (['MASJID', 'MSA'].includes(req.user.accountType)) return res.status(403).json({ error: 'Masjid and MSA accounts manage events from the dashboard and cannot register as attendees' });
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId }, include: { registrations: true } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const existingRegistration = event.registrations.find((registration) => registration.userId === req.user.id);
    if (existingRegistration) return res.json(existingRegistration);
    if (event.capacity && event.registrations.filter((registration) => registration.status !== 'DENIED').length >= event.capacity) return res.status(400).json({ error: 'Event is full' });
    const registration = await prisma.eventRegistration.upsert({
      where: { userId_eventId: { userId: req.user.id, eventId: req.params.eventId } },
      create: { userId: req.user.id, eventId: req.params.eventId, status: event.requiresApproval ? 'PENDING' : 'APPROVED' },
      update: {}
    });
    res.json(registration);
  } catch {
    res.status(400).json({ error: 'Already registered or event not found' });
  }
});

app.put('/api/events/:eventId/registrations/:registrationId', auth, async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const canManage = event.createdById === req.user.id || req.user.accountType === 'ADMIN' || (event.organizationId && await canManageOrganization(req.user, event.organizationId));
  if (!canManage) return res.status(403).json({ error: 'Only event managers can update attendance' });
  const existingRegistration = await prisma.eventRegistration.findUnique({ where: { id: req.params.registrationId } });
  if (!existingRegistration || existingRegistration.eventId !== event.id) return res.status(404).json({ error: 'Registration not found for this event' });
  const status = ['APPROVED', 'DENIED', 'ATTENDED', 'NO_SHOW'].includes(req.body.status) ? req.body.status : 'APPROVED';
  const registration = await prisma.eventRegistration.update({ where: { id: req.params.registrationId }, data: { status } });
  res.json(registration);
});

app.put('/api/events/:eventId/registrations', auth, async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const canManage = event.createdById === req.user.id || req.user.accountType === 'ADMIN' || (event.organizationId && await canManageOrganization(req.user, event.organizationId));
  if (!canManage) return res.status(403).json({ error: 'Only event managers can update attendance' });
  const status = ['APPROVED', 'DENIED', 'ATTENDED', 'NO_SHOW'].includes(req.body.status) ? req.body.status : 'APPROVED';
  const where = { eventId: event.id };
  if (req.body.fromStatus && ['PENDING', 'APPROVED', 'DENIED', 'ATTENDED', 'NO_SHOW'].includes(req.body.fromStatus)) where.status = req.body.fromStatus;
  const result = await prisma.eventRegistration.updateMany({ where, data: { status } });
  res.json({ updated: result.count, status });
});

app.delete('/api/events/:eventId/register', auth, async (req, res) => {
  if (['MASJID', 'MSA'].includes(req.user.accountType)) return res.status(403).json({ error: 'Masjid and MSA accounts do not manage attendee registrations from the public event view' });
  await prisma.eventRegistration.deleteMany({ where: { userId: req.user.id, eventId: req.params.eventId } });
  res.json({ message: 'Registration removed' });
});

app.get('/api/opportunities', auth, async (req, res) => {
  const q = searchTerm(req);
  const where = {
    isActive: true,
    ...(req.query.type ? { type: String(req.query.type).toUpperCase() } : {}),
    ...(req.query.organizationId ? { organizationId: String(req.query.organizationId) } : {}),
    ...(q ? {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { requirements: { contains: q, mode: 'insensitive' } },
        { location: { contains: q, mode: 'insensitive' } },
        { organization: { name: { contains: q, mode: 'insensitive' } } }
      ]
    } : {})
  };
  const opportunities = await prisma.opportunity.findMany({
    where,
    include: { organization: true, applications: { where: { applicantId: req.user.id } } },
    orderBy: { createdAt: 'desc' },
    ...parsePagination(req, 100, 100)
  });
  res.json(opportunities);
});

app.post('/api/organizations/:id/opportunities', auth, async (req, res) => {
  if (!(await canManageOrganization(req.user, req.params.id))) return res.status(403).json({ error: 'Only this masjid or admin can create opportunities' });
  if (!req.body.title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const type = ['JOB', 'VOLUNTEER', 'OPPORTUNITY'].includes(String(req.body.type || '').toUpperCase()) ? String(req.body.type).toUpperCase() : 'OPPORTUNITY';
  const opportunity = await prisma.opportunity.create({
    data: {
      organizationId: req.params.id,
      title: req.body.title.trim(),
      description: req.body.description,
      type,
      location: req.body.location,
      skills: normalizeList(req.body.skills),
      hours: req.body.hours == null || req.body.hours === '' ? null : Number(req.body.hours),
      requirements: req.body.requirements || null,
      workType: req.body.workType || null,
      deadline: normalizeDate(req.body.deadline),
      applicationQuestions: normalizeJsonList(req.body.applicationQuestions)
    },
    include: { organization: true }
  });
  const notificationType = type === 'JOB' ? 'JOB' : 'VOLUNTEER';
  const syncedPost = await syncOpportunityPost(opportunity, req.user.id);
  const { push } = await notifyOrganizationFollowers(req.params.id, {
    title: `${type === 'JOB' ? 'New job' : 'New volunteer opportunity'}: ${opportunity.title}`,
    body: opportunity.description || opportunity.location || 'A masjid you follow posted a new opportunity.',
    url: type === 'JOB' ? '/network/jobs' : '/network/volunteers',
    type: notificationType,
    organizationId: req.params.id,
    postId: syncedPost?.id,
    tag: `opportunity-${opportunity.id}`,
    metadata: { opportunityId: opportunity.id }
  }, { excludeUserIds: [req.user.id] });
  res.json({ ...opportunity, push });
});

app.put('/api/opportunities/:id', auth, async (req, res) => {
  const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });
  if (!(await canManageOrganization(req.user, opportunity.organizationId))) return res.status(403).json({ error: 'Only this masjid or admin can update opportunities' });
  const data = {};
  if (req.body.title !== undefined) {
    if (!String(req.body.title).trim()) return res.status(400).json({ error: 'Title is required' });
    data.title = String(req.body.title).trim();
  }
  if (req.body.description !== undefined) data.description = req.body.description || null;
  if (req.body.type !== undefined) data.type = ['JOB', 'VOLUNTEER', 'OPPORTUNITY'].includes(String(req.body.type).toUpperCase()) ? String(req.body.type).toUpperCase() : opportunity.type;
  if (req.body.location !== undefined) data.location = req.body.location || null;
  if (req.body.skills !== undefined) data.skills = normalizeList(req.body.skills);
  if (req.body.hours !== undefined) data.hours = req.body.hours == null || req.body.hours === '' ? null : Number(req.body.hours);
  if (req.body.requirements !== undefined) data.requirements = req.body.requirements || null;
  if (req.body.workType !== undefined) data.workType = req.body.workType || null;
  if (req.body.deadline !== undefined) data.deadline = normalizeDate(req.body.deadline);
  if (req.body.applicationQuestions !== undefined) data.applicationQuestions = normalizeJsonList(req.body.applicationQuestions);
  if (req.body.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
  const updated = await prisma.opportunity.update({ where: { id: opportunity.id }, data, include: { applications: { include: { applicant: true } } } });
  if (updated.isActive) await updateSyncedOpportunityPost(opportunity, updated, req.user.id);
  else await deleteSyncedOpportunityPosts(updated);
  res.json({ ...updated, applications: updated.applications.map((application) => ({ ...application, applicant: publicUser(application.applicant, { includeEmail: true }) })) });
});

app.delete('/api/opportunities/:id', auth, async (req, res) => {
  const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });
  if (!(await canManageOrganization(req.user, opportunity.organizationId))) return res.status(403).json({ error: 'Only this masjid or admin can delete opportunities' });
  await prisma.volunteerApplication.deleteMany({ where: { opportunityId: opportunity.id } });
  await deleteSyncedOpportunityPosts(opportunity);
  await prisma.opportunity.delete({ where: { id: opportunity.id } });
  res.json({ message: 'Opportunity deleted' });
});

app.post('/api/opportunities/:id/apply', auth, async (req, res) => {
  if (['MASJID', 'MSA', 'ADMIN'].includes(req.user.accountType)) return res.status(403).json({ error: 'Organization and admin accounts manage listings; only user accounts can apply' });
  const [opportunity, currentUser] = await Promise.all([
    prisma.opportunity.findUnique({ where: { id: req.params.id }, include: { organization: true } }),
    prisma.user.findUnique({ where: { id: req.user.id } })
  ]);
  if (!opportunity || !opportunity.isActive) return res.status(404).json({ error: 'Opportunity not found' });
  if (opportunity.type === 'JOB' && !isAdult(currentUser)) return res.status(403).json({ error: 'Job applications require an account age of 18 or older' });
  const data = {
    applicantName: req.body.name?.trim() || currentUser.name,
    applicantEmail: req.body.email?.trim()?.toLowerCase() || currentUser.email,
    note: req.body.note?.trim() || null,
    contactPhone: req.body.contactPhone?.trim() || null,
    resumeUrl: req.body.resumeUrl?.trim() || null,
    answers: req.body.answers && typeof req.body.answers === 'object' ? req.body.answers : null
  };
  const application = await prisma.volunteerApplication.upsert({
    where: { opportunityId_applicantId: { opportunityId: req.params.id, applicantId: req.user.id } },
    create: { opportunityId: req.params.id, applicantId: req.user.id, ...data },
    update: { ...data, status: 'PENDING' }
  });
  const managerIds = [
    opportunity.organization?.ownerId,
    ...(await prisma.organizationPerson.findMany({ where: { organizationId: opportunity.organizationId }, select: { userId: true, roleLabel: true } }))
      .filter((person) => canOperateOrganizationRole(person.roleLabel))
      .map((person) => person.userId)
  ].filter(Boolean).filter((managerId) => managerId !== req.user.id);
  await Promise.all([...new Set(managerIds)].map((managerId) => sendPushToUser(managerId, {
    type: 'APPLICATION',
    title: `New application: ${opportunity.title}`,
    body: `${data.applicantName} applied to ${opportunity.type === 'JOB' ? 'a job' : 'an opportunity'}.`,
    url: '/dashboard',
    organizationId: opportunity.organizationId,
    tag: `application-${application.id}`,
    metadata: { opportunityId: opportunity.id, applicationId: application.id }
  })));
  res.json(application);
});

app.put('/api/opportunities/:id/applications', auth, async (req, res) => {
  const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });
  if (!(await canManageOrganization(req.user, opportunity.organizationId))) return res.status(403).json({ error: 'Only this masjid or admin can manage applications' });
  const status = normalizeApplicationStatus(req.body.status);
  const where = { opportunityId: opportunity.id };
  if (req.body.fromStatus && applicationStatuses.includes(req.body.fromStatus)) where.status = req.body.fromStatus;
  const affectedApplications = await prisma.volunteerApplication.findMany({ where, select: { id: true, applicantId: true, status: true } });
  const data = { status, approvedById: req.user.id };
  if (req.body.approvedHours != null) data.approvedHours = Number(req.body.approvedHours);
  if (req.body.checkedInAt === true) data.checkedInAt = new Date();
  if (req.body.checkedOutAt === true) data.checkedOutAt = new Date();
  const result = await prisma.volunteerApplication.updateMany({ where, data });
  const notificationResults = await Promise.all(affectedApplications.map((application) => notifyApplicationStatus({ ...application, status }, opportunity)));
  res.json({ updated: result.count, status, notifications: notificationResults.length });
});

app.put('/api/opportunities/:id/applications/:applicationId', auth, async (req, res) => {
  const opportunity = await prisma.opportunity.findUnique({ where: { id: req.params.id } });
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found' });
  if (!(await canManageOrganization(req.user, opportunity.organizationId))) return res.status(403).json({ error: 'Only this masjid or admin can manage applications' });
  const existingApplication = await prisma.volunteerApplication.findUnique({ where: { id: req.params.applicationId } });
  if (!existingApplication || existingApplication.opportunityId !== opportunity.id) return res.status(404).json({ error: 'Application not found for this opportunity' });
  const status = normalizeApplicationStatus(req.body.status);
  const application = await prisma.volunteerApplication.update({
    where: { id: req.params.applicationId },
    data: {
      status,
      approvedHours: req.body.approvedHours == null ? undefined : Number(req.body.approvedHours),
      checkedInAt: req.body.checkedInAt === true ? new Date() : undefined,
      checkedOutAt: req.body.checkedOutAt === true ? new Date() : undefined,
      approvedById: req.user.id
    }
  });
  const notifications = await notifyApplicationStatus(application, opportunity);
  res.json({ ...application, notifications });
});

app.get('/api/messages/threads', auth, async (req, res) => {
  const requestedFolder = normalizeMessageFolder(req.query.folder, 'GENERAL');
  const [messages, preferences] = await Promise.all([
    prisma.message.findMany({
      where: { OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
      include: { sender: true, receiver: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.conversationPreference.findMany({ where: { ownerId: req.user.id } })
  ]);
  const preferenceMap = new Map(preferences.map((preference) => [preference.otherUserId, preference]));
  const threads = new Map();
  for (const message of messages) {
    const other = message.senderId === req.user.id ? message.receiver : message.sender;
    const preference = preferenceMap.get(other.id);
    const folder = normalizeMessageFolder(preference?.folder, message.receiverId === req.user.id ? await getInstagramConversationFolder(req.user.id, other.id, preference) : 'GENERAL');
    if (preference?.hidden && folder !== 'ARCHIVE') continue;
    if (folder !== requestedFolder) continue;
    if (!threads.has(other.id)) {
      threads.set(other.id, {
        user: publicUser(other),
        folder,
        requestStatus: preference?.requestStatus || folder,
        lastMessage: message.deletedAt ? 'This message was unsent' : message.content,
        lastMessageAt: message.createdAt,
        unread: message.receiverId === req.user.id && !message.readAt ? 1 : 0,
        muted: Boolean(preference?.muted)
      });
    } else if (message.receiverId === req.user.id && !message.readAt) {
      const thread = threads.get(other.id);
      thread.unread += 1;
    }
  }
  const folderCounts = { GENERAL: 0, REQUEST: 0, ARCHIVE: 0 };
  const seenCounts = new Set();
  for (const message of messages) {
    const other = message.senderId === req.user.id ? message.receiver : message.sender;
    if (seenCounts.has(other.id)) continue;
    seenCounts.add(other.id);
    const preference = preferenceMap.get(other.id);
    const folder = normalizeMessageFolder(preference?.folder, message.receiverId === req.user.id ? await getInstagramConversationFolder(req.user.id, other.id, preference) : 'GENERAL');
    folderCounts[folder] = (folderCounts[folder] || 0) + 1;
  }
  res.json({ threads: [...threads.values()], folder: requestedFolder, folderCounts, unreadTotal: await unreadCount(req.user.id), onlineUserIds: [...onlineUsers.keys()] });
});

app.get('/api/messages/:userId', auth, async (req, res) => {
  const otherUserId = req.params.userId;
  const limit = normalizeLimit(req.query.limit, 30, 50);
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const filters = [{ OR: [{ senderId: req.user.id, receiverId: otherUserId }, { senderId: otherUserId, receiverId: req.user.id }] }];
  if (before && Number.isFinite(before.getTime())) filters.push({ createdAt: { lt: before } });
  await prisma.message.updateMany({ where: { senderId: otherUserId, receiverId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  await prisma.conversationPreference.upsert({
    where: { ownerId_otherUserId: { ownerId: req.user.id, otherUserId } },
    create: { ownerId: req.user.id, otherUserId, hidden: false, folder: await getInstagramConversationFolder(req.user.id, otherUserId) },
    update: { hidden: false }
  });
  await invalidateUnread(req.user.id);
  const messages = await prisma.message.findMany({
    where: { AND: filters },
    include: { sender: true, receiver: true, reactions: { include: { user: true }, orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1
  });
  const hasMore = messages.length > limit;
  const page = messages.slice(0, limit).reverse();
  const nextCursor = hasMore ? page[0]?.createdAt : null;
  await emitUnread(req.user.id);
  res.json({ messages: page.map(serializeMessage), nextCursor, hasMore });
});

app.post('/api/messages', auth, messageLimiter, async (req, res) => {
  const { receiverId, content } = req.body;
  const normalizedContent = String(content || '').trim();
  if (!receiverId || !normalizedContent) return res.status(400).json({ error: 'Receiver and content are required' });
  if (normalizedContent.length > 2000) return res.status(400).json({ error: 'Message must be 2000 characters or less' });
  if (receiverId === req.user.id) return res.status(400).json({ error: 'Cannot message yourself' });
  const receiver = await prisma.user.findUnique({ where: { id: receiverId } });
  if (!receiver) return res.status(404).json({ error: 'Receiver not found' });
  const { outgoing, incoming } = await getFollowPair(req.user.id, receiverId);
  const receiverFollowsSender = incoming?.status === 'ACCEPTED';
  const senderFollowsReceiver = outgoing?.status === 'ACCEPTED';
  const mutual = receiverFollowsSender && senderFollowsReceiver;
  const senderFolder = 'GENERAL';
  const receiverFolder = mutual || receiverFollowsSender || isOrganizationLikeUser(req.user) ? 'GENERAL' : 'REQUEST';
  const receiverExistingPreference = await prisma.conversationPreference.findUnique({ where: { ownerId_otherUserId: { ownerId: receiverId, otherUserId: req.user.id } } });
  const finalReceiverFolder = receiverExistingPreference?.requestStatus === 'GENERAL' ? 'GENERAL' : receiverFolder;
  if (receiverExistingPreference?.requestStatus === 'DECLINED' || receiverExistingPreference?.requestStatus === 'BLOCKED') {
    return res.status(403).json({ error: 'This conversation cannot receive new messages.' });
  }
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: { senderId: req.user.id, receiverId, content: normalizedContent },
      include: { sender: true, receiver: true, reactions: { include: { user: true } } }
    });
    await tx.conversationPreference.upsert({
      where: { ownerId_otherUserId: { ownerId: req.user.id, otherUserId: receiverId } },
      create: { ownerId: req.user.id, otherUserId: receiverId, hidden: false, folder: senderFolder, requestStatus: 'GENERAL', acceptedAt: new Date() },
      update: { hidden: false, folder: senderFolder }
    });
    await tx.conversationPreference.upsert({
      where: { ownerId_otherUserId: { ownerId: receiverId, otherUserId: req.user.id } },
      create: { ownerId: receiverId, otherUserId: req.user.id, hidden: false, folder: finalReceiverFolder, requestStatus: finalReceiverFolder, acceptedAt: finalReceiverFolder === 'GENERAL' ? new Date() : null },
      update: { hidden: false, folder: finalReceiverFolder, requestStatus: finalReceiverFolder, acceptedAt: finalReceiverFolder === 'GENERAL' ? new Date() : null }
    });
    return created;
  });
  await invalidateUnread(receiverId);
  const serialized = serializeMessage(message);
  io.to(threadRoom(req.user.id, receiverId)).emit('message:new', serialized);
  io.to(userRoom(receiverId)).emit('message:new', serialized);
  const [receiverPreference, conversationPreference] = await Promise.all([
    prisma.userNotificationPreference.findUnique({ where: { userId: receiverId } }),
    prisma.conversationPreference.findUnique({ where: { ownerId_otherUserId: { ownerId: receiverId, otherUserId: req.user.id } } })
  ]);
  const messageNotificationsEnabled = publicNotificationPreferences(receiverPreference).messages && !conversationPreference?.muted;
  const messagePush = messageNotificationsEnabled
    ? await sendPushToUser(receiverId, {
        type: finalReceiverFolder === 'REQUEST' ? 'MESSAGE_REQUEST' : 'MESSAGE',
        title: finalReceiverFolder === 'REQUEST' ? `Message request from ${message.sender.name}` : `New message from ${message.sender.name}`,
        body: normalizedContent.slice(0, 120),
        url: `/messages/${req.user.id}`,
        tag: `message-${message.id}`,
        messageId: message.id,
        senderId: req.user.id
      })
    : { sent: 0, skipped: true, reason: conversationPreference?.muted ? 'conversation muted' : 'messages preference disabled' };
  await emitUnread(receiverId);
  res.json({ ...serialized, folder: finalReceiverFolder, push: messagePush });
});

app.put('/api/messages/threads/:userId', auth, async (req, res) => {
  const otherUserId = req.params.userId;
  if (otherUserId === req.user.id) return res.status(400).json({ error: 'Cannot update a conversation with yourself' });
  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
  if (!otherUser) return res.status(404).json({ error: 'User not found' });
  const action = String(req.body.action || '').toUpperCase();
  const data = {};
  if (req.body.muted !== undefined) data.muted = Boolean(req.body.muted);
  if (req.body.folder !== undefined) data.folder = normalizeMessageFolder(req.body.folder);
  if (action === 'ACCEPT') Object.assign(data, { folder: 'GENERAL', requestStatus: 'GENERAL', hidden: false, acceptedAt: new Date() });
  if (action === 'DECLINE') Object.assign(data, { folder: 'ARCHIVE', requestStatus: 'DECLINED', hidden: true });
  if (action === 'ARCHIVE') Object.assign(data, { folder: 'ARCHIVE', hidden: false });
  if (action === 'UNARCHIVE') Object.assign(data, { folder: 'GENERAL', hidden: false });
  const preference = await prisma.conversationPreference.upsert({
    where: { ownerId_otherUserId: { ownerId: req.user.id, otherUserId } },
    create: { ownerId: req.user.id, otherUserId, muted: Boolean(req.body.muted), hidden: false, folder: data.folder || 'GENERAL', requestStatus: data.requestStatus || 'GENERAL', acceptedAt: data.acceptedAt || null },
    update: Object.keys(data).length ? data : { hidden: false }
  });
  res.json({ muted: preference.muted, hidden: preference.hidden, folder: preference.folder, requestStatus: preference.requestStatus, acceptedAt: preference.acceptedAt });
});

app.delete('/api/messages/threads/:userId', auth, async (req, res) => {
  const otherUserId = req.params.userId;
  await Promise.all([
    prisma.conversationPreference.upsert({
      where: { ownerId_otherUserId: { ownerId: req.user.id, otherUserId } },
      create: { ownerId: req.user.id, otherUserId, hidden: false, folder: 'ARCHIVE' },
      update: { hidden: false, folder: 'ARCHIVE' }
    }),
    prisma.message.updateMany({
      where: { senderId: otherUserId, receiverId: req.user.id, readAt: null },
      data: { readAt: new Date() }
    })
  ]);
  await invalidateUnread(req.user.id);
  await emitUnread(req.user.id);
  res.json({ hidden: false, folder: 'ARCHIVE' });
});

app.delete('/api/messages/:messageId', auth, async (req, res) => {
  const message = await prisma.message.findUnique({
    where: { id: req.params.messageId },
    include: { sender: true, receiver: true, reactions: { include: { user: true } } }
  });
  if (!message) return res.status(404).json({ error: 'Message not found' });
  if (message.senderId !== req.user.id && req.user.accountType !== 'ADMIN') return res.status(403).json({ error: 'Only the sender or an admin can unsend this message' });
  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { deletedAt: new Date(), content: '' },
    include: { sender: true, receiver: true, reactions: { include: { user: true } } }
  });
  const serialized = serializeMessage(updated);
  io.to(threadRoom(updated.senderId, updated.receiverId)).emit('message:update', serialized);
  io.to(userRoom(updated.senderId)).emit('message:update', serialized);
  io.to(userRoom(updated.receiverId)).emit('message:update', serialized);
  res.json(serialized);
});

app.post('/api/messages/:messageId/reactions', auth, async (req, res) => {
  const emoji = String(req.body.emoji || '').trim().slice(0, 8);
  if (!emoji) return res.status(400).json({ error: 'Emoji is required' });
  const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
  if (!message || ![message.senderId, message.receiverId].includes(req.user.id)) return res.status(404).json({ error: 'Message not found' });
  const existing = await prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId: message.id, userId: req.user.id, emoji } }
  });
  if (existing) {
    await prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.messageReaction.create({ data: { messageId: message.id, userId: req.user.id, emoji } });
  }
  const updated = await prisma.message.findUnique({
    where: { id: message.id },
    include: { sender: true, receiver: true, reactions: { include: { user: true }, orderBy: { createdAt: 'asc' } } }
  });
  const serialized = serializeMessage(updated);
  io.to(threadRoom(updated.senderId, updated.receiverId)).emit('message:update', serialized);
  io.to(userRoom(updated.senderId)).emit('message:update', serialized);
  io.to(userRoom(updated.receiverId)).emit('message:update', serialized);
  res.json(serialized);
});

function serializeGroup(group, viewerId) {
  const membership = group.members?.find((member) => member.userId === viewerId);
  const lastMessage = group.messages?.[0];
  return {
    id: group.id,
    name: group.name,
    avatarUrl: group.avatarUrl,
    createdById: group.createdById,
    createdAt: group.createdAt,
    updatedAt: lastMessage?.createdAt || group.updatedAt,
    muted: Boolean(membership?.muted),
    members: (group.members || []).map((member) => ({ ...member, user: publicUser(member.user) })),
    lastMessage: lastMessage ? (lastMessage.deletedAt ? 'This message was unsent' : lastMessage.content) : 'Group created',
    lastMessageAt: lastMessage?.createdAt || group.createdAt,
    unread: membership
      ? (group.messages || []).filter((message) => message.senderId !== viewerId && (!membership.lastReadAt || message.createdAt > membership.lastReadAt)).length
      : 0
  };
}

app.get('/api/groups', auth, async (req, res) => {
  const groups = await prisma.groupChat.findMany({
    where: { members: { some: { userId: req.user.id, hidden: false } } },
    include: {
      members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
      messages: { orderBy: { createdAt: 'desc' }, take: 100 }
    },
    orderBy: { updatedAt: 'desc' }
  });
  res.json({ groups: groups.map((group) => serializeGroup(group, req.user.id)) });
});

app.post('/api/groups', auth, async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 80);
  const memberIds = [...new Set((Array.isArray(req.body.memberIds) ? req.body.memberIds : []).map(String))]
    .filter((id) => id && id !== req.user.id);
  if (!name) return res.status(400).json({ error: 'Group name is required' });
  if (!memberIds.length) return res.status(400).json({ error: 'Select at least one other person' });
  if (memberIds.length > 99) return res.status(400).json({ error: 'Groups can have up to 100 members' });
  const existingUsers = await prisma.user.findMany({ where: { id: { in: memberIds } }, select: { id: true, accountType: true } });
  if (existingUsers.length !== memberIds.length) return res.status(400).json({ error: 'One or more selected users no longer exist' });
  const eligibleConnections = await prisma.connection.findMany({
    where: {
      status: 'ACCEPTED',
      OR: [
        { requesterId: req.user.id, receiverId: { in: memberIds } },
        { requesterId: { in: memberIds }, receiverId: req.user.id }
      ]
    }
  });
  const eligibleIds = new Set(eligibleConnections.flatMap((connection) => [connection.requesterId, connection.receiverId]).filter((id) => id !== req.user.id));
  const ineligible = existingUsers.filter((user) => !eligibleIds.has(user.id) && !isOrganizationLikeUser(user));
  if (ineligible.length) return res.status(403).json({ error: 'Groups can only include accounts you follow, accounts that follow you, or approved organization accounts.' });
  const group = await prisma.groupChat.create({
    data: {
      name,
      avatarUrl: req.body.avatarUrl || null,
      createdById: req.user.id,
      members: {
        create: [
          { userId: req.user.id, role: 'ADMIN', lastReadAt: new Date() },
          ...memberIds.map((userId) => ({ userId, role: 'MEMBER' }))
        ]
      }
    },
    include: { members: { include: { user: true }, orderBy: { joinedAt: 'asc' } }, messages: true }
  });
  memberIds.forEach((userId) => io.to(userRoom(userId)).emit('group:new', { groupId: group.id }));
  res.status(201).json(serializeGroup(group, req.user.id));
});

app.get('/api/groups/:groupId/messages', auth, async (req, res) => {
  const membership = await prisma.groupChatMember.findUnique({
    where: { groupId_userId: { groupId: req.params.groupId, userId: req.user.id } }
  });
  if (!membership) return res.status(404).json({ error: 'Group not found' });
  const limit = normalizeLimit(req.query.limit, 40, 80);
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const where = { groupId: req.params.groupId };
  if (before && Number.isFinite(before.getTime())) where.createdAt = { lt: before };
  const found = await prisma.groupMessage.findMany({
    where,
    include: { sender: true },
    orderBy: { createdAt: 'desc' },
    take: limit + 1
  });
  const hasMore = found.length > limit;
  const page = found.slice(0, limit).reverse();
  await prisma.groupChatMember.update({
    where: { id: membership.id },
    data: { lastReadAt: new Date(), hidden: false }
  });
  await invalidateUnread(req.user.id);
  await emitUnread(req.user.id);
  res.json({
    messages: page.map((message) => ({
      ...message,
      content: message.deletedAt ? 'This message was unsent' : message.content,
      isDeleted: Boolean(message.deletedAt),
      sender: publicUser(message.sender),
      groupId: message.groupId
    })),
    nextCursor: hasMore ? page[0]?.createdAt : null,
    hasMore
  });
});

app.post('/api/groups/:groupId/messages', auth, messageLimiter, async (req, res) => {
  const membership = await prisma.groupChatMember.findUnique({
    where: { groupId_userId: { groupId: req.params.groupId, userId: req.user.id } }
  });
  if (!membership) return res.status(404).json({ error: 'Group not found' });
  const content = String(req.body.content || '').trim();
  if (!content) return res.status(400).json({ error: 'Message is required' });
  if (content.length > 2000) return res.status(400).json({ error: 'Message must be 2000 characters or less' });
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.groupMessage.create({
      data: { groupId: req.params.groupId, senderId: req.user.id, content },
      include: { sender: true }
    });
    await tx.groupChat.update({ where: { id: req.params.groupId }, data: { updatedAt: new Date() } });
    await tx.groupChatMember.update({ where: { id: membership.id }, data: { lastReadAt: new Date(), hidden: false } });
    return created;
  });
  const serialized = { ...message, sender: publicUser(message.sender), groupId: message.groupId, isDeleted: false };
  const members = await prisma.groupChatMember.findMany({ where: { groupId: req.params.groupId }, select: { userId: true } });
  await Promise.all(members.map(({ userId }) => invalidateUnread(userId)));
  members.forEach(({ userId }) => io.to(userRoom(userId)).emit('group:message', serialized));
  await Promise.all(members.filter(({ userId }) => userId !== req.user.id).map(({ userId }) => emitUnread(userId)));
  res.status(201).json(serialized);
});

app.put('/api/groups/:groupId', auth, async (req, res) => {
  const membership = await prisma.groupChatMember.findUnique({
    where: { groupId_userId: { groupId: req.params.groupId, userId: req.user.id } }
  });
  if (!membership) return res.status(404).json({ error: 'Group not found' });
  const updatedMembership = await prisma.groupChatMember.update({
    where: { id: membership.id },
    data: {
      muted: req.body.muted === undefined ? membership.muted : Boolean(req.body.muted),
      hidden: req.body.hidden === undefined ? membership.hidden : Boolean(req.body.hidden)
    }
  });
  res.json({ muted: updatedMembership.muted, hidden: updatedMembership.hidden });
});

app.get('/api/location/masjids', async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lng);
  const radius = normalizeLimit(req.query.radius, 25000, 50000);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.status(400).json({ error: 'lat and lng query parameters are required' });

  try {
    await ensureFallbackOrganizations();
    const sqlMasjids = await prisma.organization.findMany({
      where: { type: { in: ['MASJID', 'MSA'] } },
      include: {
        followers: true,
        favoritedBy: true,
        people: { include: { user: true }, orderBy: { createdAt: 'desc' } },
        posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } },
        events: { orderBy: { startTime: 'asc' } },
        opportunities: { where: { isActive: true }, orderBy: { createdAt: 'desc' } }
      },
      orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }]
    });
    const viewerId = optionalViewerId(req);
    const sqlResults = sqlMasjids.map((org) => enrichMasjid(publicOrganization(org, viewerId)));

    const query = `
      [out:json][timeout:12];
      (
        node["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${latitude},${longitude});
        way["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${latitude},${longitude});
        relation["amenity"="place_of_worship"]["religion"="muslim"](around:${radius},${latitude},${longitude});
      );
      out center tags 25;
    `;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query })
    });
    if (!response.ok) throw new Error('Overpass failed');
    const data = await response.json();
    const masjids = (data.elements || []).map((item) => {
      const tags = item.tags || {};
      return {
        id: `osm-${item.type}-${item.id}`,
        name: tags.name || tags['name:en'] || 'Unnamed masjid',
        type: 'Masjid',
        city: tags['addr:city'] || tags.city || '',
        address: osmAddress(tags) || tags['addr:full'] || tags.description || '',
        latitude: item.lat || item.center?.lat,
        longitude: item.lon || item.center?.lon,
        phone: tags.phone || tags['contact:phone'] || '',
        website: tags.website || tags['contact:website'] || '',
        verified: false,
        source: 'OpenStreetMap'
      };
    }).filter((item) => item.latitude && item.longitude && item.name !== 'Unnamed masjid');
    const seen = new Set(sqlResults.map((item) => normalizedMasjidName(item.name)));
    const supplemental = [...fallbackMasjids, ...masjids.map(enrichMasjid)];
    const finalMasjids = [
      ...sqlResults,
      ...supplemental.filter((item) => !seen.has(normalizedMasjidName(item.name)))
    ];
    res.json(withDistance(finalMasjids, latitude, longitude));
  } catch (err) {
    console.error(err);
    try {
      const sqlMasjids = await prisma.organization.findMany({
        where: { type: { in: ['MASJID', 'MSA'] } },
        include: {
          followers: true,
          favoritedBy: true,
          people: { include: { user: true }, orderBy: { createdAt: 'desc' } },
          posts: { include: { author: true, organization: true }, orderBy: { createdAt: 'desc' } },
          events: { orderBy: { startTime: 'asc' } },
          opportunities: { where: { isActive: true }, orderBy: { createdAt: 'desc' } }
        },
        orderBy: [{ verified: 'desc' }, { createdAt: 'desc' }]
      });
      const viewerId = optionalViewerId(req);
      const sqlResults = sqlMasjids.map((org) => enrichMasjid(publicOrganization(org, viewerId)));
      const seen = new Set(sqlResults.map((item) => normalizedMasjidName(item.name)));
      return res.json(withDistance([...sqlResults, ...fallbackMasjids.filter((item) => !seen.has(normalizedMasjidName(item.name)))], latitude, longitude));
    } catch {
      res.json(withDistance(fallbackMasjids, latitude, longitude));
    }
  }
});

app.get('/api/prayer-times', async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.status(400).json({ error: 'lat and lng query parameters are required' });
  const method = req.query.method || 3;
  const requestedDate = new Date(Number(req.query.date || Math.floor(Date.now() / 1000)) * 1000);
  const dateKey = Number.isFinite(requestedDate.getTime()) ? requestedDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  try {
    const timings = await fetchPrayerTimings({ latitude, longitude, method, dateKey, city: req.query.city, refresh: req.query.refresh === '1' || req.query.refresh === 'true' });
    res.json({ timings, meta: { latitude, longitude, method, date: dateKey } });
  } catch (err) {
    console.error('Prayer time providers failed', { latitude, longitude, message: err.message });
    res.status(502).json({ error: 'Could not fetch prayer times right now' });
  }
});

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
  if (prayerNotificationJobEnabled) {
    console.log('Prayer notification job enabled', {
      pollMs: prayerNotificationPollMs,
      lookaheadMs: prayerNotificationLookaheadMs
    });
    runPrayerNotificationJob().catch((error) => console.error('Prayer notification job failed', error));
    setInterval(() => {
      runPrayerNotificationJob().catch((error) => console.error('Prayer notification job failed', error));
    }, prayerNotificationPollMs);
  } else {
    console.log('Prayer notification job disabled');
  }
});
