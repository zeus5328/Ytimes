'use strict';
// 유니 타임즈 — 가족신문 서버
// 실행: node server.js  (Node.js 22.13 이상 필요, 외부 패키지 없음)
// 클라우드(Vercel): DATABASE_URL(Neon Postgres)·BLOB_READ_WRITE_TOKEN(Vercel Blob)이 있으면 lib/cloud.js를 씀

const _emit = process.emitWarning;
process.emitWarning = (w, ...a) => { if (String(w).includes('SQLite')) return; return _emit.call(process, w, ...a); };

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const CLOUD = !!process.env.DATABASE_URL;            // Neon + Vercel 모드
const cloud = CLOUD ? require('./lib/cloud.js') : null;
const KoreanLunarCalendar = require('./lib/korean-lunar-calendar.js');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = path.resolve(process.env.DATA_DIR || (CLOUD ? path.join(require('node:os').tmpdir(), 'ytimes') : path.join(__dirname, 'data')));
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = CLOUD ? new cloud.CloudDatabase() : new (require('node:sqlite').DatabaseSync)(path.join(DATA_DIR, 'ytimes.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
// 사진·소리 파일 저장소 — 집 서버는 data/uploads 폴더, 클라우드는 Vercel Blob
const store = CLOUD ? cloud.makeUploads(db) : {
  cloud: false,
  put(name, buf) { fs.writeFileSync(path.join(UPLOAD_DIR, name), buf); },
  read(name) { try { return fs.readFileSync(path.join(UPLOAD_DIR, name)); } catch { return null; } },
  del(names) { for (const n of names) { try { fs.unlinkSync(path.join(UPLOAD_DIR, n)); } catch {} } },
  url() { return ''; },
};
// 파일 보내기: 집 서버는 직접, 클라우드는 Blob 주소로 넘겨준다 (권한 확인은 부르기 전에 끝남)
function serveUpload(res, name, cache, req) {
  if (!store.cloud) return serveFile(res, path.join(UPLOAD_DIR, name), cache, req);
  const u = store.url(name);
  if (!u) { res.writeHead(404); return res.end(); }
  if (u.startsWith('/__blob/')) return serveFile(res, path.join(process.env.YT_FAKE_BLOB_DIR, name), cache, req); // 시험용
  res.writeHead(302, { Location: u, 'Cache-Control': 'private, max-age=600' }); return res.end();
}
const MAX_UPLOAD = CLOUD ? 3 * 1024 * 1024 : 0; // Vercel은 요청 한 번에 4.5MB까지라 파일 하나를 3MB로
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
  pw_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'subscriber', timetable_access INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, file TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'article',
  owner_id TEXT, width INTEGER, height INTEGER, caption TEXT DEFAULT '', taken TEXT DEFAULT '', created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, blocks TEXT NOT NULL DEFAULT '[]', category TEXT DEFAULT '일상',
  section TEXT DEFAULT '일반 기사', issue_month TEXT, hashtags TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'draft',
  photo TEXT, photo_caption TEXT DEFAULT '', author_id TEXT, author_name TEXT DEFAULT '', revision INTEGER DEFAULT 0,
  review_note TEXT DEFAULT '', created TEXT NOT NULL, updated TEXT NOT NULL, published_at TEXT, deleted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, article_id TEXT NOT NULL, user_id TEXT, name TEXT NOT NULL,
  body TEXT NOT NULL, created TEXT NOT NULL, deleted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS reactions (article_id TEXT NOT NULL, emoji TEXT NOT NULL, actor TEXT NOT NULL,
  PRIMARY KEY (article_id, emoji, actor));
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'event', calendar TEXT DEFAULT 'solar',
  date TEXT DEFAULT '', end_date TEXT DEFAULT '', time TEXT DEFAULT '', end_time TEXT DEFAULT '',
  location TEXT DEFAULT '', notes TEXT DEFAULT '', birth_year INTEGER DEFAULT 0, birth_month INTEGER DEFAULT 0,
  birth_day INTEGER DEFAULT 0, is_leap INTEGER DEFAULT 0, hashtags TEXT DEFAULT '', author_id TEXT,
  created TEXT NOT NULL, deleted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS timetables (id TEXT PRIMARY KEY, student TEXT NOT NULL, school_year INTEGER, term TEXT,
  level TEXT, grade TEXT, class_no TEXT, periods INTEGER DEFAULT 7, start_time TEXT DEFAULT '09:00', items TEXT DEFAULT '[]',
  owner_id TEXT, created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS albums (id TEXT PRIMARY KEY, title TEXT NOT NULL, template TEXT NOT NULL, items TEXT DEFAULT '[]',
  created TEXT NOT NULL, updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS folder_links (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, type TEXT NOT NULL, design INTEGER DEFAULT 0, color TEXT DEFAULT 'ivory',
  to_name TEXT DEFAULT '', from_name TEXT DEFAULT '', card_date TEXT DEFAULT '', title TEXT DEFAULT '', message TEXT DEFAULT '',
  photo TEXT, is_public INTEGER DEFAULT 0, author_id TEXT, created TEXT NOT NULL, updated TEXT NOT NULL, deleted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS people (name TEXT PRIMARY KEY, relation TEXT DEFAULT '', family_group TEXT DEFAULT '',
  bio TEXT DEFAULT '', photo TEXT, emoji TEXT DEFAULT '', updated TEXT);
`);

// ───────────────────────── helpers
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
// 권한 (낮음 → 높음). 로그인하지 않은 방문자 → 구독자 → 수습기자 → 평기자 → 시니어기자 → 편집장 → 관리자
// 계정 7가지: 방문자(로그인 안 함) · 구독자 · 수습기자 · 평기자 · 시니어기자 · 편집장 · 관리자 (예전 '가족독자'는 구독자로 합침)
const ROLE_RANK = { subscriber: 2, reporter: 3, staff: 4, senior: 5, editor: 6, admin: 7 };
const ROLE_LABEL = { subscriber: '구독자', reporter: '수습기자', staff: '평기자', senior: '시니어기자', editor: '편집장', admin: '관리자' };
const SECTIONS = ['헤드라인', '편집장의 말', '일반 기사', '인(人)터뷰', '찰칵! 이 순간', '우리 집 날씨', '그림 일기', '관찰 일기', '우리 집 단신', '칭찬 릴레이'];
const CATEGORIES = ['일상', '여행', '성장', '학교', '친구', '기념일', '명절·행사', '요리', '놀이·취미', '책·영화', '운동', '건강', '반려동물'];
// 예전 분류 이름 → 새 이름 (기사를 저장하거나 백업을 되돌릴 때도 맞춰 줌)
const CATEGORY_RENAME = { 병원: '건강', 동물: '반려동물' };
const SECTION_RENAME = { 포토제닉: '찰칵! 이 순간' };
const EMOJIS = ['❤️', '👏', '😂', '🥹', '🎉'];

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const all = (sql, ...p) => db.prepare(sql).all(...p);
const get = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(h, Buffer.from(hash, 'hex'));
}
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function getSetting(key, def = '') { const r = get('SELECT value FROM settings WHERE key=?', key); return r ? r.value : def; }
function setSetting(key, value) { run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, String(value)); }
const tags = (s) => [...new Set(String(s || '').split(/[\s,]+/).map(t => t.replace(/^#+/, '').trim()).filter(Boolean))].slice(0, 10);
const tagStr = (s) => tags(s).map(t => '#' + t).join(' ');

// ───────────────────────── photos
function savePhoto(dataUrl, kind, ownerId, extra = {}) {
  const m = /^data:image\/(jpeg|png|webp|gif);base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!m) fail(400, '이미지 형식이 올바르지 않습니다.');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > (MAX_UPLOAD || 12 * 1024 * 1024)) fail(413, `사진 한 장은 ${MAX_UPLOAD ? 3 : 12}MB 이하여야 합니다.`);
  const id = uid();
  const file = id + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  store.put(file, buf, 'image/' + m[1]);
  run('INSERT INTO photos(id,file,kind,owner_id,width,height,caption,taken,created) VALUES(?,?,?,?,?,?,?,?,?)',
    id, file, kind, ownerId || null, Number(extra.width) || null, Number(extra.height) || null,
    str(extra.caption, 300), str(extra.taken, 20), now());
  if (extra.thumb) saveThumb(id, extra.thumb);
  return id;
}
// 작은 미리보기 사진 (브라우저가 640px로 줄여 보낸 것) — 목록·카드·앨범 고르기에 쓴다
function saveThumb(id, dataUrl) {
  const m = /^data:image\/jpeg;base64,(.+)$/s.exec(String(dataUrl || ''));
  if (!m) return false;
  const buf = Buffer.from(m[1], 'base64'); if (buf.length > 1024 * 1024) return false;
  store.put(id + '_t.jpg', buf, 'image/jpeg');
  run('UPDATE photos SET thumb=1 WHERE id=?', id);
  return true;
}
function deletePhoto(id) {
  if (!id) return;
  const p = get('SELECT * FROM photos WHERE id=?', id);
  if (!p) return;
  store.del([p.file, p.id + '_t.jpg']);
  run('DELETE FROM photos WHERE id=?', id);
}

// ───────────────────────── lunar / occurrences
const pad = (n) => String(n).padStart(2, '0');
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const isLeapYear = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const lunar = new KoreanLunarCalendar();

function lunarToSolar(ly, lm, ld, leap) {
  const tries = [[lm, ld, !!leap], [lm, ld, false], [lm, ld - 1, false]];
  for (let i = 0; i < tries.length; i++) {
    const [m, d, l] = tries[i];
    if (d < 1) continue;
    try {
      if (lunar.setLunarDate(ly, m, d, l)) {
        const s = lunar.getSolarCalendar();
        if (s && s.year) return { date: ymd(s.year, s.month, s.day), year: s.year, adjusted: i > 0 };
      }
    } catch {}
  }
  return null;
}
function solarToLunar(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  try { if (lunar.setSolarDate(y, m, d)) return lunar.getLunarCalendar(); } catch {}
  return null;
}

// ── 반복 일정 (매주·격주·매월·매월 N번째 요일·매년)
const REPEATS = { weekly: '매주', biweekly: '격주', monthly: '매월', monthly_nth: '매월', yearly: '매년' };
const DOW_KO = '일월화수목금토';
const addDaysStr = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const dowOf = (d) => new Date(d + 'T00:00:00Z').getUTCDay();
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function repeatLabel(e) {
  const s = e.date; const dw = DOW_KO[dowOf(s)]; const nth = Math.ceil(+s.slice(8) / 7);
  const base = e.repeat === 'weekly' ? `매주 ${dw}요일` : e.repeat === 'biweekly' ? `격주 ${dw}요일` : e.repeat === 'monthly' ? `매월 ${+s.slice(8)}일`
    : e.repeat === 'monthly_nth' ? `매월 ${nth === 5 ? '마지막' : ['첫째', '둘째', '셋째', '넷째'][nth - 1]} ${dw}요일` : `매년 ${+s.slice(5, 7)}월 ${+s.slice(8)}일`;
  return base + (e.repeat_until ? ` · ${e.repeat_until}까지` : '');
}
function repeatDates(e, year) {
  const start = e.date, until = e.repeat_until && e.repeat_until >= start ? e.repeat_until : '9999-12-31';
  const from = `${year}-01-01` > start ? `${year}-01-01` : start, to = `${year}-12-31` < until ? `${year}-12-31` : until;
  if (from > to) return [];
  const out = []; const sd = +start.slice(8), sm = +start.slice(5, 7);
  if (e.repeat === 'weekly' || e.repeat === 'biweekly') {
    const step = e.repeat === 'weekly' ? 7 : 14;
    const diff = Math.round((Date.parse(from) - Date.parse(start)) / 864e5);
    let d = addDaysStr(start, Math.ceil(diff / step) * step);
    for (; d <= to; d = addDaysStr(d, step)) out.push(d);
  } else if (e.repeat === 'monthly' || e.repeat === 'monthly_nth') {
    const dw = dowOf(start), nth = Math.ceil(sd / 7);
    for (let m = 1; m <= 12; m++) {
      let d;
      if (e.repeat === 'monthly') d = ymd(year, m, Math.min(sd, daysIn(year, m)));
      else {
        const first = (dw - dowOf(ymd(year, m, 1)) + 7) % 7 + 1; let day = first + (nth - 1) * 7;
        if (nth === 5 || day > daysIn(year, m)) { day = first; while (day + 7 <= daysIn(year, m)) day += 7; }
        d = ymd(year, m, day);
      }
      if (d >= from && d <= to) out.push(d);
    }
  } else if (e.repeat === 'yearly') {
    const d = ymd(year, sm, Math.min(sd, daysIn(year, sm))); if (d >= from && d <= to) out.push(d);
  }
  return out;
}
function occurrencesForYear(year) {
  const events = all('SELECT * FROM events WHERE deleted=0');
  const out = [];
  for (const e of events) {
    const base = publicEvent(e);
    if (e.kind === 'birthday') {
      const label = `${e.calendar === 'lunar' ? '음력' : '양력'} ${e.birth_month}월 ${e.birth_day}일${e.is_leap ? '(윤달)' : ''} · 매년 반복`;
      if (e.calendar === 'lunar') {
        for (const ly of [year - 1, year]) {
          const r = lunarToSolar(ly, e.birth_month, e.birth_day, e.is_leap);
          if (r && r.year === year) out.push({ ...base, date: r.date, birthday_label: label, adjusted: r.adjusted, age: e.birth_year ? year - e.birth_year + 1 : null, full_age: e.birth_year ? ly - e.birth_year : null });
        }
      } else {
        let m = e.birth_month, d = e.birth_day, adjusted = false;
        if (m === 2 && d === 29 && !isLeapYear(year)) { d = 28; adjusted = true; }
        if (m >= 1 && m <= 12 && d >= 1) out.push({ ...base, date: ymd(year, m, d), birthday_label: label, adjusted, age: e.birth_year ? year - e.birth_year + 1 : null, full_age: e.birth_year ? year - e.birth_year : null });
      }
    } else if (e.kind === 'anniversary') {
      if (!e.date) continue;
      const [sy, sm, sd0] = e.date.split('-').map(Number);
      if (year < sy) continue;
      let sd = sd0, adjusted = false;
      if (sm === 2 && sd === 29 && !isLeapYear(year)) { sd = 28; adjusted = true; }
      out.push({ ...base, date: ymd(year, sm, sd), anniversary_years: year - sy, anniversary_label: `${e.date} 시작 · 매년 반복`, adjusted });
    } else {
      if (!e.date) continue;
      const start = e.date, end = e.end_date && e.end_date >= e.date ? e.end_date : e.date;
      if (e.repeat && REPEATS[e.repeat]) {
        const span = Math.round((Date.parse(end) - Date.parse(start)) / 864e5);
        for (const d of repeatDates(e, year)) out.push({ ...base, date: d, end_date: span ? addDaysStr(d, span) : '', repeat_label: repeatLabel(e), series_start: start });
        continue;
      }
      if (end.slice(0, 4) < String(year) || start.slice(0, 4) > String(year)) continue;
      out.push({ ...base });
    }
  }
  out.sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  return out;
}
function publicEvent(e, user) {
  return {
    id: e.id, title: e.title, kind: e.kind, calendar: e.calendar, date: e.date, end_date: e.end_date, time: e.time,
    end_time: e.end_time, location: e.location, notes: e.notes, birth_year: e.birth_year, birth_month: e.birth_month,
    birth_day: e.birth_day, is_leap: e.is_leap, hashtags: e.hashtags, created: e.created, deleted: e.deleted,
    author_id: e.author_id, repeat: e.repeat || '', repeat_until: e.repeat_until || '', remind: e.remind === undefined ? 1 : +e.remind,
  };
}

// ───────────────────────── 알림 (사이트 안 알림함 · 열려 있으면 브라우저 알림)
// to: 사용자 id 배열. ukey가 같으면 한 번만 남는다(생일 알림 중복 방지)
function notify(to, n) {
  for (const id of new Set(to)) {
    if (!id) continue;
    try { run('INSERT OR IGNORE INTO notices(id,user_id,kind,title,body,link,ukey,created) VALUES(?,?,?,?,?,?,?,?)', uid(), id, n.kind, str(n.title, 120), str(n.body, 300), str(n.link, 200), n.ukey ? n.ukey + ':' + id : null, now()); } catch {}
  }
}
const usersWith = (minRole, except) => all('SELECT id, role FROM users').filter((u) => ROLE_RANK[u.role] >= ROLE_RANK[minRole] && u.id !== except).map((u) => u.id);
// 오늘·내일 생일과 기념일 — 알림함을 열 때 그 사람 몫을 만든다
const pointsChecked = new Map(); // user.id → 마지막으로 확인한 날 (한국 시간)
function birthdayNotices(user) {
  // 생일·매달 포인트는 사람마다 하루 한 번만 확인 (알림을 열 때마다 계산하지 않게)
  if (user && pointsChecked.get(user.id) !== kstToday()) {
    try { birthdayPoints(user); } catch (e) { console.error('생일 포인트:', e.message); }
    try { monthlyPoints(user); } catch (e) { console.error('매달 포인트:', e.message); }
    pointsChecked.set(user.id, kstToday());
  }
  deadlineNotices(user);
  capsuleNotices(user);
  if (!isRole(user, 'subscriber')) return;
  choreNotices(user);
  const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const tm = new Date(Date.parse(today + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
  const y = +today.slice(0, 4);
  const occ = [...occurrencesForYear(y), ...(tm.slice(0, 4) !== today.slice(0, 4) ? occurrencesForYear(y + 1) : [])].filter((o) => o.kind !== 'event' && (o.date === today || o.date === tm));
  for (const o of occ) {
    const when = o.date === today ? '오늘' : '내일';
    notify([user.id], { kind: o.kind, title: `${when}은 ${o.title}${o.kind === 'birthday' && o.age ? ` (${o.age}세)` : o.anniversary_years ? ` (${o.anniversary_years}주년)` : ''}`,
      body: o.date === today ? '축하 카드를 보내보세요.' : '미리 축하를 준비해볼까요?', link: o.date === today ? `#/post/write?type=${o.kind === 'birthday' ? 'birthday' : 'anniversary'}` : `#/calendar?date=${o.date}`, ukey: `${o.kind}:${o.id}:${o.date}:${when}` });
  }
  // 일반 일정 — 하루 전 알림 (일정마다 끌 수 있음)
  const evs = [...occurrencesForYear(+tm.slice(0, 4))].filter((o) => o.kind === 'event' && o.date === tm && o.remind !== 0);
  for (const o of evs) {
    const t = o.time ? ` ${+o.time.slice(0, 2) < 12 ? '오전' : '오후'} ${(+o.time.slice(0, 2) % 12) || 12}시${+o.time.slice(3) ? ` ${+o.time.slice(3)}분` : ''}` : '';
    notify([user.id], { kind: 'event', title: `내일${t} · ${o.title}`, body: [o.location && `장소 ${o.location}`, o.repeat_label].filter(Boolean).join(' · ') || '내일 가족 일정이 있어요.', link: `#/calendar?date=${o.date}`, ukey: `event:${o.id}:${o.date}` });
  }
}
// 타임캡슐이 열린 날 (열린 뒤 30일 안에 처음 접속할 때 한 번)
function capsuleNotices(user) {
  const t = kstToday(); const from = new Date(Date.parse(t) - 30 * 864e5).toISOString().slice(0, 10);
  for (const c of all("SELECT * FROM cards WHERE deleted=0 AND open_on<>'' AND open_on<=? AND open_on>=?", t, from)) {
    if (!(c.is_public || c.author_id === user.id || isRole(user, 'admin'))) continue;
    notify([user.id], { kind: 'capsule', title: `타임캡슐이 열렸어요${c.to_name ? ` · ${c.to_name}에게` : ''}`, body: `${c.from_name || '가족'}이(가) ${c.created.slice(0, 10)}에 봉인한 편지예요.`, link: `#/post?card=${c.id}`, ukey: `capsule:${c.id}` });
  }
}
// 이번 주 당번 — 한 주에 한 번
function choreAssignee(d, day) {
  const mem = Array.isArray(d.members) ? d.members.filter(Boolean) : []; if (!mem.length) return '';
  const start = /^\d{4}-\d{2}-\d{2}$/.test(d.start || '') ? d.start : '2026-01-05';
  const weeks = Math.floor((Date.parse(day) - Date.parse(start)) / (7 * 864e5));
  return mem[((weeks % mem.length) + mem.length) % mem.length];
}
function choreNotices(user) {
  const t = kstToday(); const dow = new Date(t + 'T00:00:00Z').getUTCDay(); const monday = new Date(Date.parse(t) - ((dow + 6) % 7) * 864e5).toISOString().slice(0, 10);
  const list = all("SELECT * FROM items WHERE kind='chore' AND deleted=0").map((r) => { try { return JSON.parse(r.data); } catch { return null; } }).filter(Boolean);
  if (!list.length) return;
  const mine = list.filter((d) => choreAssignee(d, t) === user.display_name);
  notify([user.id], { kind: 'chore', title: mine.length ? `이번 주 내 당번 · ${mine.map((d) => d.name).join(', ')}` : '이번 주 집안일 당번이 바뀌었어요',
    body: list.map((d) => `${d.emoji || ''}${d.name} ${choreAssignee(d, t)}`).join(' · ').slice(0, 280), link: '#/todo/chores', ukey: `chore:${monday}` });
}
// 월호 마감 알림 — 매달 마지막 3일 동안 한 번, 기자 이상에게 남은 일을 알려 준다
function deadlineNotices(user) {
  if (!isRole(user, 'reporter')) return;
  const today = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const y = +today.slice(0, 4), m = +today.slice(5, 7), d = +today.slice(8), last = daysIn(y, m), left = last - d;
  if (left > 3) return;
  const ym = today.slice(0, 7);
  const mine = get("SELECT COUNT(*) c FROM articles WHERE deleted=0 AND author_id=? AND status IN ('draft','changes')", user.id).c;
  const waiting = isRole(user, 'senior') ? get("SELECT COUNT(*) c FROM articles WHERE deleted=0 AND status IN ('pending','approved')").c : 0;
  const published = get("SELECT COUNT(*) c FROM articles WHERE deleted=0 AND status='published' AND issue_month=?", ym).c;
  const bits = [mine && `내 초안 ${mine}편`, waiting && `승인·발행 대기 ${waiting}편`, `이번 호 발행 ${published}편`].filter(Boolean);
  notify([user.id], { kind: 'deadline', title: left === 0 ? `오늘이 ${m}월호 마감이에요` : `${m}월호 마감까지 ${left}일`, body: bits.join(' · '), link: '#/newsroom', ukey: `deadline:${ym}` });
}

// ───────────────────────── article helpers
function parseBlocks(a) { try { return JSON.parse(a.blocks || '[]'); } catch { return []; } }
// 함께 쓴 기자 (공동 기자) — 대표 기자와 똑같이 보고 고치고 알림을 받는다
function coIds(a) { try { const v = JSON.parse(a.coauthors || '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } }
const writers = (a) => [a.author_id, ...coIds(a)].filter(Boolean);
const isWriter = (a, user) => !!user && writers(a).includes(user.id);
function articleOut(a, user, full = true) {
  const blocks = parseBlocks(a);
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n\n');
  const o = {
    id: a.id, title: a.title, category: a.category, section: a.section, issue_month: a.issue_month, hashtags: a.hashtags,
    status: a.status, photo: a.photo, photo_caption: a.photo_caption, author_name: a.author_name || '유니 타임즈',
    revision: a.revision, review_note: a.review_note, created: a.created, updated: a.updated, published_at: a.published_at,
    deleted: a.deleted, is_own: isWriter(a, user), is_main_author: !!(user && a.author_id === user.id), excerpt: text.slice(0, 220),
    photo_count: blocks.filter(b => b.type === 'photo').length + (a.photo ? 1 : 0),
    chars: text.replace(/\s/g, '').length, has_audio: blocks.some((b) => b.type === 'audio'),
  };
  if (full) { o.blocks = blocks; o.writers = articleWriters(a); }
  const co = coIds(a).map((id) => ({ id, name: (get('SELECT display_name FROM users WHERE id=?', id) || {}).display_name })).filter((c) => c.name);
  o.coauthors = co; o.lead_author = o.author_name;
  try { const pl = a.place ? JSON.parse(a.place) : null; o.place = pl ? { name: pl.name, lat: pl.lat, lng: pl.lng } : null; o.places = pl ? (Array.isArray(pl.stops) && pl.stops.length ? pl.stops : [o.place]) : []; } catch { o.place = null; o.places = []; }
  if (co.length) o.author_name = [o.author_name, ...co.map((c) => c.name)].join('·');
  const rc = all('SELECT emoji, COUNT(*) c FROM reactions WHERE article_id=? GROUP BY emoji', a.id);
  o.reactions = Object.fromEntries(rc.map(r => [r.emoji, r.c]));
  o.comment_count = get('SELECT COUNT(*) c FROM comments WHERE article_id=? AND deleted=0', a.id).c;
  o.views = a.views || 0;
  return o;
}
// 기사 아래 '기자 소개' — 대표 기자와 함께 쓴 기자, 각자 발행한 기사 수와 최근 기사
function articleWriters(a) {
  const pub = all("SELECT id, title, author_id, coauthors, published_at FROM articles WHERE deleted=0 AND status='published' ORDER BY published_at DESC");
  const ids = [a.author_id, ...coIds(a)].filter(Boolean);
  const out = [];
  for (const id of [...new Set(ids)]) {
    const u = get('SELECT id, display_name, role, created FROM users WHERE id=?', id); if (!u) continue;
    const mine = pub.filter((x) => x.author_id === id || coIds(x).includes(id));
    out.push({ id, name: u.display_name, role_label: ROLE_LABEL[u.role] || '', lead: id === a.author_id, count: mine.length,
      since: u.created, recent: mine.filter((x) => x.id !== a.id).slice(0, 3).map((x) => ({ id: x.id, title: x.title })) });
  }
  if (!out.length) { // 예전 자료처럼 기자 계정이 없는 기사는 편집국 이름으로
    const name = a.author_name || '유니 타임즈';
    const mine = pub.filter((x) => !x.author_id);
    out.push({ id: null, name, role_label: '편집국', lead: true, count: mine.length, since: '', recent: mine.filter((x) => x.id !== a.id).slice(0, 3).map((x) => ({ id: x.id, title: x.title })) });
  }
  return out;
}
function canSeeArticle(a, user) {
  if (a.deleted) return isRole(user, 'editor');
  if (a.status === 'published') return true;
  if (!user) return false;
  if (isRole(user, 'editor') || isWriter(a, user)) return true;
  return isRole(user, 'senior') && a.status !== 'draft'; // 시니어기자: 승인 요청된 다른 기자 기사 검토
}
function articlePhotoIds(a) {
  const ids = parseBlocks(a).filter(b => b.type === 'photo' && b.photo).map(b => b.photo);
  if (a.photo) ids.push(a.photo);
  return ids;
}
function sanitizeBlocks(blocks) {
  if (!Array.isArray(blocks)) fail(400, '본문 형식이 올바르지 않습니다.');
  if (blocks.length > 60) fail(400, '문단·사진은 최대 60개까지 추가할 수 있어요.');
  const out = []; let total = 0, photos = 0, audios = 0;
  for (const b of blocks) {
    if (b && b.type === 'photo') {
      if (!b.photo) continue;
      if (++photos > 10) fail(400, '본문 사진은 최대 10장까지 추가할 수 있어요.');
      out.push({ type: 'photo', photo: str(b.photo, 60), caption: str(b.caption, 300),
        align: ['left', 'center', 'right'].includes(b.align) ? b.align : 'center',
        size: ['small', 'medium', 'full'].includes(b.size) ? b.size : 'medium' });
    } else if (b && b.type === 'audio') {
      if (!b.audio) continue;
      if (++audios > 5) fail(400, '목소리·소리는 기사 한 편에 5개까지 넣을 수 있어요.');
      out.push({ type: 'audio', audio: str(b.audio, 60), caption: str(b.caption, 300), duration: Math.max(0, Math.min(3600, Number(b.duration) || 0)) });
    } else {
      const text = String(b?.text ?? '').slice(0, 50000);
      total += text.length;
      out.push({ type: 'text', text });
    }
  }
  if (total > 50000) fail(400, '본문은 50,000자 이하로 작성해주세요.');
  return out;
}

// ───────────────────────── seed (기존 유니 타임즈 데이터)
function seedIfEmpty() {
  if (get('SELECT COUNT(*) c FROM articles').c || get('SELECT COUNT(*) c FROM events').c) return;
  // data/seed.json(깃에 올라가지 않는 우리 가족 자료)이 있으면 그것을, 없으면 저장소의 예시 자료를 씁니다
  const own = path.join(DATA_DIR, 'seed.json');
  const file = fs.existsSync(own) ? own : path.join(__dirname, 'data-seed.json');
  if (!fs.existsSync(file)) return;
  const seed = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const e of seed.events || []) {
    run(`INSERT INTO events(id,title,kind,calendar,date,end_date,time,location,notes,birth_year,birth_month,birth_day,hashtags,created)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, e.id, e.title, e.kind, e.calendar || 'solar', e.date || '', e.end_date || '',
      e.time || '', e.location || '', e.notes || '', e.by || 0, e.bm || 0, e.bd || 0, e.hashtags || '', e.created || now());
  }
  for (const a of seed.articles || []) {
    const blocks = String(a.body || '').split(/\n{2,}/).map(t => ({ type: 'text', text: t }));
    run(`INSERT INTO articles(id,title,blocks,category,section,issue_month,hashtags,status,photo_caption,author_name,revision,created,updated,published_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, a.id, a.title, JSON.stringify(blocks), a.category, a.section, a.issue_month,
      a.hashtags || '', a.status, a.photo_caption || '', '유니 타임즈', a.revision || 1, a.created, a.updated, a.updated);
  }
  console.log(`[seed] ${path.basename(file)} 불러옴: 기사 ${seed.articles.length}개, 일정 ${seed.events.length}개`);
}
if (!CLOUD || process.env.YT_SEED === '1') seedIfEmpty(); // 클라우드는 빈 신문으로 시작 → 백업 되돌리기로 옮겨 온다

// ── 추가 테이블·컬럼 (기존 데이터베이스도 자동으로 맞춰짐)
db.exec(`
CREATE TABLE IF NOT EXISTS polls (id TEXT PRIMARY KEY, question TEXT NOT NULL, options TEXT NOT NULL, multi INTEGER DEFAULT 0,
  closes TEXT DEFAULT '', closed INTEGER DEFAULT 0, author_id TEXT, author_name TEXT, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS poll_votes (poll_id TEXT NOT NULL, actor TEXT NOT NULL, option_idx INTEGER NOT NULL, name TEXT,
  PRIMARY KEY (poll_id, actor, option_idx));
CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, user_id TEXT, name TEXT NOT NULL, body TEXT NOT NULL, mood TEXT DEFAULT '',
  created TEXT NOT NULL, deleted INTEGER DEFAULT 0);
`);
if (!all('PRAGMA table_info(articles)').some((c) => c.name === 'views')) db.exec('ALTER TABLE articles ADD COLUMN views INTEGER DEFAULT 0');
{ const cols = all('PRAGMA table_info(albums)').map((c) => c.name);
  if (!cols.includes('paper')) db.exec("ALTER TABLE albums ADD COLUMN paper TEXT DEFAULT 'ivory'");
  if (!cols.includes('subtitle')) db.exec("ALTER TABLE albums ADD COLUMN subtitle TEXT DEFAULT ''"); }
db.exec(`CREATE TABLE IF NOT EXISTS notices (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT '',
  link TEXT DEFAULT '', ukey TEXT UNIQUE, created TEXT NOT NULL, read INTEGER DEFAULT 0);
CREATE INDEX IF NOT EXISTS notices_user ON notices(user_id, created);`);
if (!all('PRAGMA table_info(photos)').some((c) => c.name === 'thumb')) db.exec('ALTER TABLE photos ADD COLUMN thumb INTEGER DEFAULT 0');
// 수업 시간표: 이름 · 월 · 주 (0이면 정하지 않음)
{ const tc = all('PRAGMA table_info(timetables)').map((c) => c.name);
  if (!tc.includes('title')) db.exec("ALTER TABLE timetables ADD COLUMN title TEXT DEFAULT ''");
  if (!tc.includes('month')) db.exec('ALTER TABLE timetables ADD COLUMN month INTEGER DEFAULT 0');
  if (!tc.includes('week')) db.exec('ALTER TABLE timetables ADD COLUMN week INTEGER DEFAULT 0'); }
if (!all('PRAGMA table_info(polls)').some((c) => c.name === 'allow_add')) db.exec('ALTER TABLE polls ADD COLUMN allow_add INTEGER DEFAULT 0');
{ const ec = all('PRAGMA table_info(events)').map((c) => c.name);
  if (!ec.includes('repeat')) db.exec("ALTER TABLE events ADD COLUMN repeat TEXT DEFAULT ''");          // '', weekly, biweekly, monthly, monthly_nth, yearly
  if (!ec.includes('repeat_until')) db.exec("ALTER TABLE events ADD COLUMN repeat_until TEXT DEFAULT ''");
  if (!ec.includes('remind')) db.exec('ALTER TABLE events ADD COLUMN remind INTEGER DEFAULT 1'); }      // 하루 전 알림
if (!all('PRAGMA table_info(articles)').some((c) => c.name === 'coauthors')) db.exec("ALTER TABLE articles ADD COLUMN coauthors TEXT DEFAULT '[]'");
if (!all('PRAGMA table_info(comments)').some((c) => c.name === 'parent_id')) db.exec('ALTER TABLE comments ADD COLUMN parent_id TEXT');
if (!all('PRAGMA table_info(articles)').some((c) => c.name === 'place')) db.exec("ALTER TABLE articles ADD COLUMN place TEXT DEFAULT ''");   // 여행 지도 {name,lat,lng}
if (!all('PRAGMA table_info(cards)').some((c) => c.name === 'open_on')) db.exec("ALTER TABLE cards ADD COLUMN open_on TEXT DEFAULT ''");    // 타임캡슐 여는 날
// 우리 집 기록 (연표·성장·버킷리스트·당번·가족회의) — 종류별 자료를 한 표에
db.exec(`CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}', date TEXT DEFAULT '',
  author_id TEXT, author_name TEXT DEFAULT '', created TEXT NOT NULL, updated TEXT NOT NULL, deleted INTEGER DEFAULT 0);
CREATE INDEX IF NOT EXISTS items_kind ON items(kind, date);`);

// ───────────────────────── routing
const routes = [];
const route = (method, pattern, minRole, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, minRole, handler });
};
function requireRole(user, minRole) {
  if (!minRole) return;
  if (!user) fail(401, '로그인이 필요합니다.');
  if (ROLE_RANK[user.role] < ROLE_RANK[minRole]) fail(403, '권한이 없습니다.');
}
const isRole = (user, r) => !!user && ROLE_RANK[user.role] >= ROLE_RANK[r];
const userOut = (u) => u && ({ id: u.id, username: u.username, display_name: u.display_name, role: u.role,
  role_label: ROLE_LABEL[u.role], timetable_access: !!u.timetable_access, created: u.created });

// ── auth / me / setup
function newsroomTodo(user) {
  if (!isRole(user, 'reporter')) return 0;
  let n = get("SELECT COUNT(*) c FROM articles WHERE deleted=0 AND author_id=? AND status IN ('draft','changes')", user.id).c;
  if (isRole(user, 'editor')) n += get("SELECT COUNT(*) c FROM articles WHERE deleted=0 AND status IN ('pending','approved')").c;
  else if (isRole(user, 'senior')) n += get("SELECT COUNT(*) c FROM articles WHERE deleted=0 AND status='pending' AND COALESCE(author_id,'')<>?", user.id).c
    + get("SELECT COUNT(*) c FROM articles WHERE deleted=0 AND status='approved' AND author_id=?", user.id).c;
  return n;
}
route('GET', '/api/calendar-ics', null, () => ({ ics: calendarIcs() }));
route('GET', '/api/newsroom/todo', 'reporter', ({ user }) => ({ todo: newsroomTodo(user) }));
// 알림함
const noticeOut = (n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, created: n.created, read: !!n.read });
route('GET', '/api/notices/count', 'subscriber', ({ user }) => {
  birthdayNotices(user);
  const latest = get('SELECT * FROM notices WHERE user_id=? AND read=0 ORDER BY created DESC LIMIT 1', user.id);
  return { unread: get('SELECT COUNT(*) c FROM notices WHERE user_id=? AND read=0', user.id).c, todo: newsroomTodo(user), latest: latest ? noticeOut(latest) : null };
});
route('GET', '/api/notices', 'subscriber', ({ user }) => {
  birthdayNotices(user);
  return { notices: all('SELECT * FROM notices WHERE user_id=? ORDER BY created DESC LIMIT 60', user.id).map(noticeOut) };
});
route('POST', '/api/notices/read', 'subscriber', ({ user, body }) => {
  if (body.all) run('UPDATE notices SET read=1 WHERE user_id=?', user.id);
  else for (const id of (Array.isArray(body.ids) ? body.ids : []).slice(0, 100)) run('UPDATE notices SET read=1 WHERE id=? AND user_id=?', str(id, 60), user.id);
  run("DELETE FROM notices WHERE user_id=? AND read=1 AND created < ?", user.id, new Date(Date.now() - 60 * 864e5).toISOString());
  return { ok: true };
});
route('GET', '/api/me', null, ({ user }) => ({
  user: userOut(user), todo: user ? newsroomTodo(user) : 0, needsSetup: get('SELECT COUNT(*) c FROM users').c === 0,
  settings: settingsOut(), sections: SECTIONS, categories: CATEGORIES, emojis: EMOJIS,
}));
function settingsOut() {
  return {
    site_name: getSetting('site_name', '유니 타임즈'),
    tagline: getSetting('tagline', '함께한 순간을 오래도록.'),
    kicker: getSetting('kicker', '우리 가족의 기록'),
    founded: getSetting('founded', '2026-10-27'),
    editor_note: getSetting('editor_note', '작은 순간도,\n우리에게는 큰 뉴스.\n\n서로의 하루를 읽고\n가족의 시간을 함께 쌓아갑니다.'),
    logo: getSetting('logo', ''),
    mascot: getSetting('mascot', ''), // 아래쪽 신문 이름 왼쪽의 유니 사진
    members_only: getSetting('members_only', '0') === '1' ? '1' : '0',
    cloud: CLOUD ? '1' : '',
  };
}
route('POST', '/api/setup', null, ({ body, res }) => {
  if (get('SELECT COUNT(*) c FROM users').c) fail(400, '이미 관리자가 있습니다.');
  const u = createUser({ ...body, role: 'admin' });
  startSession(res, u.id);
  return { user: userOut(u) };
});
// 로그인 아이디 = 이메일 주소 (예전에 만든 영문 아이디 계정도 그대로 로그인할 수 있음)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function checkEmail(v, exceptId) {
  const email = str(v, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) fail(400, '아이디로 쓸 이메일 주소를 정확히 적어 주세요. (예: dad@gmail.com)');
  const dup = get('SELECT id FROM users WHERE username=?', email);
  if (dup && dup.id !== exceptId) fail(400, '이미 다른 계정이 쓰고 있는 이메일이에요.');
  return email;
}
function createUser(b) {
  const username = checkEmail(b.username);
  if (String(b.password || '').length < 6) fail(400, '비밀번호는 6자 이상이어야 합니다.');
  const role = ROLE_RANK[b.role] ? b.role : 'subscriber';
  const id = uid();
  run('INSERT INTO users(id,username,display_name,pw_hash,role,timetable_access,created) VALUES(?,?,?,?,?,?,?)',
    id, username, str(b.display_name, 30) || username.split('@')[0], hashPassword(String(b.password)), role, b.timetable_access ? 1 : 0, now());
  const made = get('SELECT * FROM users WHERE id=?', id);
  if (typeof giveBasePoints === 'function') giveBasePoints(made);
  return made;
}
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const days = 60;
  run('INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)', token, userId, Date.now() + days * 864e5);
  res.setHeader('Set-Cookie', `yt_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${res.__secure ? '; Secure' : ''}`);
}
// 로그인 시도 제한: 같은 아이디(또는 같은 접속 주소)로 10분에 5번 틀리면 10분 동안 막는다
const loginFails = new Map();
const failKey = (req, name) => [`u:${name}`, `ip:${(req.socket && req.socket.remoteAddress) || ''}`];
route('POST', '/api/login', null, ({ body, res, req }) => {
  const name = str(body.username, 120).toLowerCase(); const t = Date.now();
  for (const k of failKey(req, name)) { const f = loginFails.get(k); if (f && f.n >= (k.startsWith('ip:') ? 20 : 5) && t - f.t < 10 * 60e3) fail(429, `로그인을 여러 번 틀려서 잠시 막았어요. ${Math.ceil((10 * 60e3 - (t - f.t)) / 60e3)}분 뒤에 다시 시도해주세요.`); }
  const u = get('SELECT * FROM users WHERE username=?', name);
  if (!u || !checkPassword(String(body.password || ''), u.pw_hash)) {
    for (const k of failKey(req, name)) { const f = loginFails.get(k); loginFails.set(k, f && t - f.t < 10 * 60e3 ? { n: f.n + 1, t: f.t } : { n: 1, t }); }
    fail(401, '이메일 또는 비밀번호가 맞지 않습니다.');
  }
  for (const k of failKey(req, name)) loginFails.delete(k);
  startSession(res, u.id);
  return { user: userOut(u) };
});
route('POST', '/api/logout', null, ({ req, res }) => {
  const t = parseCookies(req).yt_session;
  if (t) run('DELETE FROM sessions WHERE token=?', t);
  res.setHeader('Set-Cookie', 'yt_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  return { ok: true };
});
route('POST', '/api/me/password', 'subscriber', ({ user, body }) => {
  if (!checkPassword(String(body.current || ''), user.pw_hash)) fail(400, '현재 비밀번호가 맞지 않습니다.');
  if (String(body.password || '').length < 6) fail(400, '새 비밀번호는 6자 이상이어야 합니다.');
  run('UPDATE users SET pw_hash=? WHERE id=?', hashPassword(String(body.password)), user.id);
  return { ok: true };
});

route('PUT', '/api/me', 'subscriber', ({ user, body }) => {
  const name = str(body.display_name, 30); if (!name) fail(400, '이름을 입력해주세요.');
  run('UPDATE users SET display_name=? WHERE id=?', name, user.id);
  return { user: userOut(get('SELECT * FROM users WHERE id=?', user.id)) };
});

// ── users (admin)
// 공동 기자로 넣을 수 있는 가족 (수습기자 이상)
route('GET', '/api/reporters', 'reporter', () => ({ reporters: all('SELECT id, display_name, role FROM users ORDER BY created').filter((u) => ROLE_RANK[u.role] >= ROLE_RANK.reporter).map((u) => ({ id: u.id, name: u.display_name, role_label: ROLE_LABEL[u.role] })) }));
route('GET', '/api/users', 'admin', () => ({ users: all('SELECT * FROM users ORDER BY created').map(userOut) }));
route('POST', '/api/users', 'admin', ({ body }) => ({ user: userOut(createUser(body)) }));
route('PUT', '/api/users/:id', 'admin', ({ params, body, user }) => {
  const u = get('SELECT * FROM users WHERE id=?', params.id) || fail(404, '사용자를 찾을 수 없습니다.');
  const role = ROLE_RANK[body.role] ? body.role : u.role;
  if (u.id === user.id && role !== 'admin') fail(400, '자기 자신의 관리자 권한은 해제할 수 없습니다.');
  if (body.username != null && String(body.username).trim().toLowerCase() !== u.username) run('UPDATE users SET username=? WHERE id=?', checkEmail(body.username, u.id), u.id);
  run('UPDATE users SET display_name=?, role=?, timetable_access=? WHERE id=?', str(body.display_name, 30) || u.display_name,
    role, body.timetable_access ? 1 : 0, u.id);
  if (body.password) {
    if (String(body.password).length < 6) fail(400, '비밀번호는 6자 이상이어야 합니다.');
    run('UPDATE users SET pw_hash=? WHERE id=?', hashPassword(String(body.password)), u.id);
  }
  return { user: userOut(get('SELECT * FROM users WHERE id=?', u.id)) };
});
route('DELETE', '/api/users/:id', 'admin', ({ params, user }) => {
  if (params.id === user.id) fail(400, '자기 자신은 삭제할 수 없습니다.');
  run('DELETE FROM sessions WHERE user_id=?', params.id); run('DELETE FROM notices WHERE user_id=?', params.id);
  run('DELETE FROM users WHERE id=?', params.id);
  return { ok: true };
});
route('PUT', '/api/settings', 'admin', ({ body }) => {
  for (const k of ['site_name', 'tagline', 'kicker', 'founded', 'editor_note', 'logo', 'mascot']) if (k in body) setSetting(k, str(body[k], 2000));
  if ('members_only' in body) setSetting('members_only', body.members_only === '1' || body.members_only === true ? '1' : '0');
  return { settings: settingsOut() };
});
// 설정 → 자료 관리: 한눈에 보는 숫자
route('GET', '/api/stats', 'admin', () => {
  const c = (sql) => { try { return get(sql).c; } catch { return 0; } };
  let dbKB = 0, upKB = 0, upFiles = 0;
  if (CLOUD) {
    try { dbKB = Math.round(get('SELECT pg_database_size(current_database()) AS s').s / 1024); } catch {}
    upFiles = uploadNames().length; upKB = (get('SELECT COALESCE(SUM(size),0) s FROM audios') || {}).s / 1024 || 0;
  } else {
  try { dbKB = Math.round(fs.statSync(path.join(DATA_DIR, 'ytimes.db')).size / 1024); } catch {}
  try { for (const f of fs.readdirSync(UPLOAD_DIR)) { try { upKB += fs.statSync(path.join(UPLOAD_DIR, f)).size / 1024; upFiles++; } catch {} } } catch {}
  }
  return {
    articles: c("SELECT COUNT(*) c FROM articles WHERE deleted=0 AND status='published'"),
    drafts: c("SELECT COUNT(*) c FROM articles WHERE deleted=0 AND status!='published'"),
    trashed: c('SELECT COUNT(*) c FROM articles WHERE deleted=1') + c('SELECT COUNT(*) c FROM events WHERE deleted=1'),
    events: c('SELECT COUNT(*) c FROM events WHERE deleted=0'),
    cards: c('SELECT COUNT(*) c FROM cards WHERE deleted=0'),
    comments: c('SELECT COUNT(*) c FROM comments WHERE deleted=0'),
    notes: c('SELECT COUNT(*) c FROM notes'),
    photos: c('SELECT COUNT(*) c FROM photos'), no_thumb: c('SELECT COUNT(*) c FROM photos WHERE COALESCE(thumb,0)=0'), albums: c('SELECT COUNT(*) c FROM albums'),
    users: c('SELECT COUNT(*) c FROM users'), people: c('SELECT COUNT(*) c FROM people'),
    timetables: c('SELECT COUNT(*) c FROM timetables'),
    db_kb: dbKB, upload_kb: Math.round(upKB), upload_files: upFiles, cloud: CLOUD,
  };
});
// 백업 되돌리기: 내려받은 JSON으로 글·일정 자료를 통째로 바꾼다 (가족 계정·비밀번호는 그대로)
const RESTORE_TABLES = ['settings', 'articles', 'comments', 'reactions', 'events', 'timetables', 'albums', 'folder_links', 'cards', 'people', 'photos', 'polls', 'poll_votes', 'notes', 'items', 'audios', 'points', 'coupons', 'coupon_issues', 'lotto_tickets', 'lotto_draws', 'scratch_tickets', 'deed_menu', 'good_deeds'];
// 전체 백업에 넣는 사진·소리 파일 이름 (사진 원본·미리보기·소리)
const UPLOAD_NAME = /^[\w-]{6,80}(\.(jpe?g|png|webp|gif|webm|ogg|m4a|aac|mp3|wav)|_t\.jpg)$/i;
function uploadNames() {
  const names = new Set();
  for (const p of all('SELECT id, file, thumb FROM photos')) { if (p.file) names.add(p.file); if (p.thumb || !store.cloud) names.add(p.id + '_t.jpg'); }
  for (const a of all('SELECT file FROM audios')) if (a.file) names.add(a.file);
  return [...names].filter((n) => UPLOAD_NAME.test(n));
}
function uploadFiles(names = uploadNames(), maxBytes = Infinity) {
  const files = {}; let total = 0;
  for (const n of names) {
    if (!UPLOAD_NAME.test(n)) continue;
    const b = store.read(n); if (!b) continue; // 없는 파일(미리보기 없음 등)
    files[n] = b.toString('base64'); total += files[n].length;
    if (total >= maxBytes) break;
  }
  return files;
}
function restoreFiles(files) {
  if (!store.cloud) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  let n = 0;
  for (const [name, b64] of Object.entries(files || {})) {
    if (!UPLOAD_NAME.test(name) || typeof b64 !== 'string') continue;
    const ext = name.split('.').pop().toLowerCase();
    store.put(name, Buffer.from(b64, 'base64'), ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav' })[ext]);
    n++;
  }
  return n;
}
// 클라우드는 한 번에 4.5MB까지만 주고받을 수 있어, 전체 백업의 사진·소리를 나눠서 주고받는다
route('GET', '/api/backup/files', 'admin', ({ query }) => {
  const want = String(query.names || '').split(',').filter(Boolean).slice(0, 200);
  const files = uploadFiles(want, 3 * 1024 * 1024);
  return { files, done: Object.keys(files).length ? want.slice(0, want.indexOf(Object.keys(files).pop()) + 1) : want };
});
route('POST', '/api/restore/files', 'admin', ({ body }) => ({ ok: true, n: restoreFiles(body && body.files) }));
route('POST', '/api/restore', 'admin', ({ body }) => {
  const data = body && body.data;
  if (!data || typeof data !== 'object' || !data.exported || !Array.isArray(data.articles) || !Array.isArray(data.events)) fail(400, '유니 타임즈 백업 파일이 아니에요.');
  if (body.confirm !== '되돌리기') fail(400, '확인 문구가 맞지 않아요.');
  const counts = {};
  db.exec('BEGIN');
  try {
    for (const t of RESTORE_TABLES) {
      if (!Array.isArray(data[t])) continue;
      const cols = all(`PRAGMA table_info(${t})`).map((c) => c.name);
      run(t === 'settings' ? "DELETE FROM settings WHERE key <> 'blob_base'" : `DELETE FROM ${t}`); // 사진 저장소 주소는 이 서버의 것을 그대로
      for (const row of data[t]) {
        if (!row || typeof row !== 'object' || (t === 'settings' && row.key === 'blob_base')) continue;
        const ks = Object.keys(row).filter((k) => cols.includes(k)); if (!ks.length) continue;
        run(`INSERT OR REPLACE INTO ${t}(${ks.join(',')}) VALUES(${ks.map(() => '?').join(',')})`, ...ks.map((k) => (row[k] === undefined ? null : row[k])));
      }
      counts[t] = data[t].length;
    }
    for (const [from, to] of Object.entries(CATEGORY_RENAME)) run('UPDATE articles SET category=? WHERE category=?', to, from); // 예전 분류 이름 맞추기
    for (const [from, to] of Object.entries(SECTION_RENAME)) run('UPDATE articles SET section=? WHERE section=?', to, from);
    db.exec('COMMIT');
    // 전체 백업(사진·소리 포함)이면 파일도 되살린다
    if (data.files && typeof data.files === 'object') counts.files = restoreFiles(data.files);
  } catch (e) { db.exec('ROLLBACK'); fail(400, '백업 파일을 읽는 중 문제가 생겨 아무것도 바꾸지 않았어요: ' + e.message); }
  return { ok: true, counts, settings: settingsOut() };
});
// ── 자동 백업: 매일 한 번 data/backups/에 글·일정(DB) 사본을 만들고 사진도 새로 생긴 것만 복사. 14일치만 남긴다
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const BACKUP_KEEP = 14;
function listBackups() {
  try { return fs.readdirSync(BACKUP_DIR).filter((f) => /^ytimes-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort().reverse()
    .map((f) => { const st = fs.statSync(path.join(BACKUP_DIR, f)); return { file: f, date: f.slice(7, 17), kb: Math.round(st.size / 1024), created: st.mtime.toISOString() }; }); } catch { return []; }
}
function runBackup() {
  if (CLOUD) fail(400, '클라우드(Neon)는 데이터베이스를 자동으로 보관해요. 사진까지 받아 두려면 ‘전체 백업 내려받기’를 쓰세요.');
  fs.mkdirSync(path.join(BACKUP_DIR, 'uploads'), { recursive: true });
  const day = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
  const file = path.join(BACKUP_DIR, `ytimes-${day}.db`);
  try { fs.unlinkSync(file); } catch {}
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  let copied = 0; // 사진은 지워지지 않는 사본 — 기사에서 사진을 지워도 백업에는 남는다
  for (const f of fs.readdirSync(UPLOAD_DIR)) { const to = path.join(BACKUP_DIR, 'uploads', f); if (!fs.existsSync(to)) { try { fs.copyFileSync(path.join(UPLOAD_DIR, f), to); copied++; } catch {} } }
  for (const b of listBackups().slice(BACKUP_KEEP)) { try { fs.unlinkSync(path.join(BACKUP_DIR, b.file)); } catch {} }
  setSetting('last_backup', now());
  return { file: path.basename(file), copied };
}
route('GET', '/api/backups', 'admin', () => ({ backups: listBackups(), keep: BACKUP_KEEP, last: getSetting('last_backup', ''), dir: 'data/backups' }));
route('POST', '/api/backups', 'admin', () => { try { const r = runBackup(); return { ok: true, ...r, message: `백업을 만들었어요 (새 사진 ${r.copied}장 복사).` }; } catch (e) { if (e instanceof HttpError) throw e; fail(500, '백업을 만들지 못했어요: ' + e.message); } });
route('GET', '/api/backup', 'admin', ({ query }) => {
  const out = { exported: now(), version: 2, site: getSetting('site_name', '') };
  for (const t of RESTORE_TABLES) out[t] = all(`SELECT * FROM ${t}`);
  out.users = all('SELECT id,username,display_name,role,timetable_access,created FROM users');
  // ?files=1 — 서버를 옮길 때 쓰는 전체 백업: 사진·소리 파일까지 한 파일에
  if (query.files === '1') { out.files = uploadFiles(); out.full = true; }
  if (query.files === 'list') { out.file_names = uploadNames(); out.full = true; } // 클라우드: 파일은 /api/backup/files로 나눠 받기
  return out;
});

// ── uploads / photos
// 예전 사진에 미리보기 만들기 (자료 관리에서)
route('GET', '/api/photos/no-thumb', 'admin', () => ({ ids: all('SELECT id FROM photos WHERE COALESCE(thumb,0)=0 ORDER BY created').map((r) => r.id) }));
route('POST', '/api/photos/:id/thumb', 'admin', ({ params, body }) => {
  get('SELECT 1 FROM photos WHERE id=?', params.id) || fail(404, '사진을 찾을 수 없습니다.');
  if (!saveThumb(params.id, body.thumb)) fail(400, '미리보기 사진 형식이 올바르지 않습니다.');
  return { ok: true };
});
route('POST', '/api/upload', 'reporter', ({ body, user }) => {
  const kind = ['article', 'card', 'person', 'logo'].includes(body.kind) ? body.kind : 'article';
  return { id: savePhoto(body.data, kind, user.id, body) };
});

// ── articles
route('GET', '/api/articles', null, ({ user, query }) => {
  let rows;
  if (query.scope === 'newsroom') {
    requireRole(user, 'reporter');
    rows = isRole(user, 'editor')
      ? all('SELECT * FROM articles WHERE deleted=0 ORDER BY updated DESC')
      : isRole(user, 'senior') ? all("SELECT * FROM articles WHERE deleted=0 AND (author_id=? OR status!='draft') ORDER BY updated DESC", user.id)
      : all("SELECT * FROM articles WHERE deleted=0 AND (author_id=? OR status='published') ORDER BY updated DESC", user.id);
  } else if (query.scope === 'trash') {
    requireRole(user, 'editor');
    rows = all('SELECT * FROM articles WHERE deleted=1 ORDER BY updated DESC');
  } else {
    rows = all("SELECT * FROM articles WHERE deleted=0 AND status='published' ORDER BY COALESCE(published_at, updated) DESC");
  }
  return { articles: rows.map(a => articleOut(a, user, query.full === '1')) };
});
route('GET', '/api/articles/:id', null, ({ params, user }) => {
  const a = get('SELECT * FROM articles WHERE id=?', params.id);
  if (!a || !canSeeArticle(a, user)) fail(404, '기사를 찾을 수 없습니다.');
  return { article: articleOut(a, user) };
});
// 장소 — 한 곳 또는 여러 곳(다녀온 순서). 첫 장소는 place로도 그대로 (예전 화면과 호환)
function placeOne(pl) {
  if (!pl || typeof pl !== 'object') return null;
  const lat = Number(pl.lat), lng = Number(pl.lng), name = str(pl.name, 60);
  if (!name || !(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) return null;
  return { name, lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
}
function placeStr(pl, places) {
  const list = (Array.isArray(places) ? places : pl ? [pl] : []).map(placeOne).filter(Boolean).slice(0, 10);
  if (!list.length) return '';
  return JSON.stringify(list.length > 1 ? { ...list[0], stops: list } : list[0]);
}
function articleFields(body) {
  const title = str(body.title, 120);
  if (!title) fail(400, '제목을 입력해주세요.');
  const blocks = sanitizeBlocks(body.blocks || []);
  if (!blocks.some(b => b.type === 'text' && b.text.trim()) && !blocks.some(b => b.type === 'photo')) fail(400, '기사 본문에 글을 입력해주세요.');
  return {
    title, blocks: JSON.stringify(blocks),
    category: CATEGORIES.includes(CATEGORY_RENAME[body.category] || body.category) ? (CATEGORY_RENAME[body.category] || body.category) : '일상',
    section: SECTIONS.includes(SECTION_RENAME[body.section] || body.section) ? (SECTION_RENAME[body.section] || body.section) : '일반 기사',
    issue_month: /^\d{4}-\d{2}$/.test(body.issue_month || '') ? body.issue_month : now().slice(0, 7),
    hashtags: tagStr(body.hashtags), photo: body.photo ? str(body.photo, 60) : null, photo_caption: str(body.photo_caption, 300),
    place: placeStr(body.place, body.places),
    coauthors: JSON.stringify([...new Set((Array.isArray(body.coauthors) ? body.coauthors : []).map((x) => str(x, 60)))]
      .filter((id) => { const u = get('SELECT role FROM users WHERE id=?', id); return u && ROLE_RANK[u.role] >= ROLE_RANK.reporter; }).slice(0, 4)),
  };
}
route('POST', '/api/articles', 'reporter', ({ body, user }) => {
  const f = articleFields(body); const id = uid(); const t = now();
  const co = JSON.stringify(JSON.parse(f.coauthors).filter((x) => x !== user.id));
  run(`INSERT INTO articles(id,title,blocks,category,section,issue_month,hashtags,status,photo,photo_caption,author_id,author_name,revision,created,updated,coauthors,place)
    VALUES(?,?,?,?,?,?,?,'draft',?,?,?,?,0,?,?,?,?)`, id, f.title, f.blocks, f.category, f.section, f.issue_month, f.hashtags,
    f.photo, f.photo_caption, user.id, user.display_name, t, t, co, f.place);
  for (const cid of JSON.parse(co)) notify([cid], { kind: 'coauthor', title: `함께 쓰는 기사 · ${f.title}`, body: `${user.display_name}님이 공동 기자로 넣었어요.`, link: `#/write/${id}` });
  return { article: articleOut(get('SELECT * FROM articles WHERE id=?', id), user) };
});
route('PUT', '/api/articles/:id', 'reporter', ({ params, body, user }) => {
  const a = get('SELECT * FROM articles WHERE id=? AND deleted=0', params.id) || fail(404, '기사를 찾을 수 없습니다.');
  const editor = isRole(user, 'editor');
  if (!editor && !isWriter(a, user)) fail(403, '본인이 쓴 기사만 수정할 수 있습니다.');
  // 내가 쓴 기사(대표·함께 쓴 기자)는 발행된 뒤에도 고칠 수 있어요 — 상태는 그대로
  const f = articleFields(body);
  const before = new Set(articlePhotoIds(a));
  const co = JSON.stringify(JSON.parse(f.coauthors).filter((x) => x !== a.author_id));
  const added = JSON.parse(co).filter((x) => !coIds(a).includes(x) && x !== user.id);
  run(`UPDATE articles SET title=?,blocks=?,category=?,section=?,issue_month=?,hashtags=?,photo=?,photo_caption=?,coauthors=?,place=?,revision=revision+1,updated=? WHERE id=?`,
    f.title, f.blocks, f.category, f.section, f.issue_month, f.hashtags, f.photo, f.photo_caption, co, f.place, now(), a.id);
  for (const cid of added) notify([cid], { kind: 'coauthor', title: `함께 쓰는 기사 · ${f.title}`, body: `${user.display_name}님이 공동 기자로 넣었어요.`, link: `#/write/${a.id}` });
  const after = new Set(articlePhotoIds(get('SELECT * FROM articles WHERE id=?', a.id)));
  for (const p of before) if (!after.has(p)) deletePhoto(p);
  return { article: articleOut(get('SELECT * FROM articles WHERE id=?', a.id), user) };
});
route('POST', '/api/articles/:id/action', 'reporter', ({ params, body, user }) => {
  const a = get('SELECT * FROM articles WHERE id=? AND deleted=0', params.id) || fail(404, '기사를 찾을 수 없습니다.');
  const editor = isRole(user, 'editor'); const own = isWriter(a, user);
  const senior = isRole(user, 'senior'); // 시니어기자: 다른 기자 기사 승인·수정 요청, 자기 기사는 바로 발행
  const T = { request: [['draft', 'changes'], 'pending', own || editor], approve: [['pending'], 'approved', editor || (senior && !own)],
    changes: [['pending', 'approved'], 'changes', editor || (senior && !own)],
    publish: [['draft', 'changes', 'pending', 'approved'], 'published', editor || (senior && own)],
    unpublish: [['published', 'approved', 'pending', 'changes'], 'draft', editor || (own && (a.status === 'pending' || senior))] };
  const t = T[body.action] || fail(400, '알 수 없는 요청입니다.');
  if (!t[2]) fail(403, '권한이 없습니다.');
  if (!t[0].includes(a.status)) fail(400, '현재 상태에서는 할 수 없는 작업입니다.');
  run('UPDATE articles SET status=?, review_note=?, updated=?, published_at=? WHERE id=?', t[1],
    body.action === 'changes' ? str(body.note, 500) : (body.action === 'request' ? '' : a.review_note), now(),
    t[1] === 'published' ? now() : a.published_at, a.id);
  const link = `#/article/${a.id}`;
  if (body.action === 'request') notify(usersWith('senior').filter((id) => !writers(a).includes(id)), { kind: 'review', title: `승인 요청 · ${a.title}`, body: `${a.author_name || '기자'}님이 검토를 요청했어요.`, link });
  if (body.action === 'changes') notify(writers(a).filter((id) => id !== user.id), { kind: 'changes', title: `수정 요청 · ${a.title}`, body: str(body.note, 200) || '편집실에서 검토 메모를 확인하세요.', link: '#/newsroom' });
  if (body.action === 'approve') notify(writers(a).filter((id) => id !== user.id), { kind: 'approved', title: `승인됐어요 · ${a.title}`, body: `${user.display_name}님이 승인했어요.`, link });
  if (body.action === 'publish') {
    payManuscript(get('SELECT * FROM articles WHERE id=?', a.id));
    notify(writers(a).filter((id) => id !== user.id), { kind: 'published', title: `신문에 실렸어요 · ${a.title}`, body: '가족들이 읽을 수 있어요.', link });
    notify(usersWith('subscriber', user.id).filter((id) => !writers(a).includes(id)), { kind: 'news', title: `새 기사 · ${a.title}`, body: `${a.section || ''} · ${a.author_name || ''}`, link, ukey: `news:${a.id}` });
  }
  return { article: articleOut(get('SELECT * FROM articles WHERE id=?', a.id), user) };
});
route('DELETE', '/api/articles/:id', 'reporter', ({ params, user, query }) => {
  const a = get('SELECT * FROM articles WHERE id=?', params.id) || fail(404, '기사를 찾을 수 없습니다.');
  if (query.permanent === '1') {
    requireRole(user, 'admin');
    articlePhotoIds(a).forEach(deletePhoto);
    run('DELETE FROM comments WHERE article_id=?', a.id); run('DELETE FROM reactions WHERE article_id=?', a.id);
    run('DELETE FROM articles WHERE id=?', a.id);
    return { ok: true, message: '기사를 영구 삭제했습니다.' };
  }
  if (!isRole(user, 'editor') && !(a.author_id === user.id && a.status !== 'published')) fail(403, '권한이 없습니다.');
  run('UPDATE articles SET deleted=1, updated=? WHERE id=?', now(), a.id);
  return { ok: true, message: '기사를 휴지통으로 이동했습니다.' };
});
route('POST', '/api/articles/:id/restore', 'editor', ({ params }) => {
  run("UPDATE articles SET deleted=0, status='draft', updated=? WHERE id=?", now(), params.id);
  return { ok: true, message: '기사를 초안으로 복원했습니다.' };
});

// ── comments & reactions (신규)
route('GET', '/api/articles/:id/comments', null, ({ params, user }) => {
  const a = get('SELECT * FROM articles WHERE id=?', params.id);
  if (!a || !canSeeArticle(a, user)) fail(404, '기사를 찾을 수 없습니다.');
  const rows = all('SELECT * FROM comments WHERE article_id=? ORDER BY created', a.id);
  const live = rows.filter((c) => !c.deleted); const parents = new Set(live.map((c) => c.parent_id).filter(Boolean));
  // 지운 댓글에 답글이 달려 있으면 자리만 남긴다
  return { comments: rows.filter((c) => !c.deleted || parents.has(c.id)).map(c => c.deleted ? { id: c.id, parent_id: null, deleted: true, name: '', body: '', created: c.created }
    : ({ id: c.id, parent_id: c.parent_id || null, name: c.name, body: c.body, created: c.created,
    can_edit: !!user && c.user_id === user.id, can_delete: !!user && (c.user_id === user.id || isRole(user, 'editor')) })) };
});
route('POST', '/api/articles/:id/comments', 'subscriber', ({ params, user, body }) => {
  const a = get("SELECT * FROM articles WHERE id=? AND deleted=0 AND status='published'", params.id) || fail(404, '기사를 찾을 수 없습니다.');
  const text = str(body.body, 500);
  if (!text) fail(400, '댓글 내용을 입력해주세요.');
  // 답글: 한 단계만 (답글에 단 답글은 같은 원댓글 아래로)
  let parent = body.parent_id ? get('SELECT * FROM comments WHERE id=? AND article_id=?', str(body.parent_id, 60), a.id) : null;
  if (body.parent_id && !parent) fail(400, '답글을 달 댓글을 찾을 수 없어요.');
  if (parent && parent.parent_id) parent = get('SELECT * FROM comments WHERE id=?', parent.parent_id) || parent;
  const cid = uid();
  run('INSERT INTO comments(id,article_id,user_id,name,body,created,parent_id) VALUES(?,?,?,?,?,?,?)', cid, a.id, user.id, user.display_name, text, now(), parent ? parent.id : null);
  const points = talkPoints(user, 'comment', cid, `댓글 · ${a.title}`, TALK_DAILY.comment);
  const link = `#/article/${a.id}`;
  if (parent && parent.user_id && parent.user_id !== user.id) notify([parent.user_id], { kind: 'comment', title: `내 댓글에 답글 · ${a.title}`, body: `${user.display_name}: ${text.slice(0, 80)}`, link });
  notify(writers(a).filter((id) => id !== user.id && !(parent && id === parent.user_id)), { kind: 'comment', title: `새 댓글 · ${a.title}`, body: `${user.display_name}: ${text.slice(0, 80)}`, link });
  return { ok: true, points };
});
route('PUT', '/api/comments/:id', 'subscriber', ({ params, user, body }) => {
  const c = get('SELECT * FROM comments WHERE id=? AND deleted=0', params.id) || fail(404, '댓글을 찾을 수 없습니다.');
  if (c.user_id !== user.id) fail(403, '내가 쓴 댓글만 고칠 수 있어요.');
  const text = str(body.body, 500); if (!text) fail(400, '댓글 내용을 입력해주세요.');
  run('UPDATE comments SET body=? WHERE id=?', text, c.id); return { ok: true };
});
route('DELETE', '/api/comments/:id', 'subscriber', ({ params, user }) => {
  const c = get('SELECT * FROM comments WHERE id=?', params.id) || fail(404, '댓글을 찾을 수 없습니다.');
  if (c.user_id !== user.id && !isRole(user, 'editor')) fail(403, '권한이 없습니다.');
  run('UPDATE comments SET deleted=1 WHERE id=?', c.id);
  return { ok: true };
});
route('POST', '/api/articles/:id/react', null, ({ params, user, body, req, res }) => {
  const a = get("SELECT id FROM articles WHERE id=? AND deleted=0 AND status='published'", params.id) || fail(404, '기사를 찾을 수 없습니다.');
  if (!EMOJIS.includes(body.emoji)) fail(400, '지원하지 않는 반응입니다.');
  let actor = user ? 'u:' + user.id : null;
  if (!actor) {
    let vid = parseCookies(req).yt_vid;
    if (!vid || !/^[a-f0-9]{32}$/.test(vid)) { vid = crypto.randomBytes(16).toString('hex'); res.setHeader('Set-Cookie', `yt_vid=${vid}; Path=/; SameSite=Lax; Max-Age=${86400 * 400}`); }
    actor = 'v:' + vid;
  }
  const exists = get('SELECT 1 FROM reactions WHERE article_id=? AND emoji=? AND actor=?', a.id, body.emoji, actor);
  if (exists) run('DELETE FROM reactions WHERE article_id=? AND emoji=? AND actor=?', a.id, body.emoji, actor);
  else run('INSERT INTO reactions(article_id,emoji,actor) VALUES(?,?,?)', a.id, body.emoji, actor);
  const rc = all('SELECT emoji, COUNT(*) c FROM reactions WHERE article_id=? GROUP BY emoji', a.id);
  const mine = all('SELECT emoji FROM reactions WHERE article_id=? AND actor=?', a.id, actor).map(r => r.emoji);
  return { reactions: Object.fromEntries(rc.map(r => [r.emoji, r.c])), mine };
});
route('GET', '/api/articles/:id/react', null, ({ params, user, req }) => {
  const vid = parseCookies(req).yt_vid;
  const actor = user ? 'u:' + user.id : (vid ? 'v:' + vid : '');
  return { mine: actor ? all('SELECT emoji FROM reactions WHERE article_id=? AND actor=?', params.id, actor).map(r => r.emoji) : [] };
});

// ── events
route('GET', '/api/events', null, ({ query, user }) => {
  const year = Number(query.year) || new Date().getFullYear();
  if (year < 1900 || year > 2100) fail(400, '연도를 확인해주세요.');
  const years = String(query.years || '').split(',').map(Number).filter(y => y >= 1900 && y <= 2100);
  const occ = [...new Set([year, ...years])].flatMap(occurrencesForYear);
  return {
    events: all('SELECT * FROM events WHERE deleted=0 ORDER BY created').map(e => ({ ...publicEvent(e), is_own: !!user && e.author_id === user.id, can_edit: !!user && canEditEvent(e, user) })),
    occurrences: occ.map(o => ({ ...o, is_own: !!user && o.author_id === user.id, can_edit: !!user && canEditEvent(o, user) })),
  };
});
route('GET', '/api/events/deleted', 'editor', () => ({ events: all('SELECT * FROM events WHERE deleted=1 ORDER BY created DESC').map(e => publicEvent(e)) }));
route('GET', '/api/lunar', null, ({ query }) => {
  if (query.solar) return { lunar: solarToLunar(String(query.solar)) };
  const r = lunarToSolar(Number(query.y), Number(query.m), Number(query.d), query.leap === '1');
  return { solar: r };
});
function eventFields(body) {
  const kind = ['event', 'birthday', 'anniversary'].includes(body.kind) ? body.kind : 'event';
  const title = str(body.title, 80); if (!title) fail(400, '제목을 입력해주세요.');
  const f = { kind, title, calendar: 'solar', date: '', end_date: '', time: '', end_time: '', location: str(body.location, 120),
    notes: str(body.notes, 1000), birth_year: 0, birth_month: 0, birth_day: 0, is_leap: 0, hashtags: tagStr(body.hashtags) };
  const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
  const okTime = (t) => /^\d{2}:\d{2}$/.test(t || '') ? t : '';
  if (kind === 'birthday') {
    f.calendar = body.calendar === 'lunar' ? 'lunar' : 'solar';
    f.birth_year = Number(body.birth_year) || 0; f.birth_month = Number(body.birth_month); f.birth_day = Number(body.birth_day);
    f.is_leap = f.calendar === 'lunar' && body.is_leap ? 1 : 0;
    if (!(f.birth_month >= 1 && f.birth_month <= 12 && f.birth_day >= 1 && f.birth_day <= (f.calendar === 'lunar' ? 30 : 31))) fail(400, '태어난 월·일을 확인해주세요.');
  } else {
    if (!okDate(body.date)) fail(400, '날짜를 입력해주세요.');
    f.date = body.date; f.time = okTime(body.time);
    if (kind === 'event') {
      f.end_date = okDate(body.end_date) && body.end_date >= body.date ? body.end_date : '';
      f.end_time = okTime(body.end_time);
      f.repeat = REPEATS[body.repeat] ? body.repeat : '';
      f.repeat_until = f.repeat && okDate(body.repeat_until) && body.repeat_until >= body.date ? body.repeat_until : '';
    }
  }
  f.repeat = f.repeat || ''; f.repeat_until = f.repeat_until || '';
  f.remind = kind === 'event' ? (body.remind === false || body.remind === '0' || body.remind === 0 ? 0 : (body.remind === undefined && f.repeat ? 0 : 1)) : 1;
  return f;
}
// 생일·기념일과 작성자가 없는(처음 옮겨온) 일정은 가족 공용 — 평기자 이상 누구나 고칠 수 있다
const canEditEvent = (e, user) => isRole(user, 'editor') || (isRole(user, 'staff') && (e.author_id === user.id || !e.author_id || e.kind !== 'event'));
// "황윤수 생일 (김신중의 친구)" — 인물 사전에 관계를 이어 준다 (이미 적어 둔 관계는 건드리지 않음)
function linkFriend(body) {
  const name = str(body.friend_name, 30).replace(/^#/, ''), of = str(body.friend_of, 30).replace(/^#/, '');
  const rel = ['친구', '동료', '선생님', '이웃', '지인', '선배', '후배'].includes(body.friend_rel) ? body.friend_rel : '친구';
  if (!name || !of || name === of) return;
  run(`INSERT INTO people(name,relation,family_group,bio,photo,emoji,updated) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET relation=CASE WHEN COALESCE(people.relation,'')='' THEN excluded.relation ELSE people.relation END,
      family_group=CASE WHEN COALESCE(people.family_group,'')='' THEN excluded.family_group ELSE people.family_group END, updated=excluded.updated`,
    name, `${of}의 ${rel}`, '친구·지인', '', null, '', now());
}
route('POST', '/api/events', 'staff', ({ body, user }) => {
  const f = eventFields(body); const id = uid();
  run(`INSERT INTO events(id,title,kind,calendar,date,end_date,time,end_time,location,notes,birth_year,birth_month,birth_day,is_leap,hashtags,author_id,created,repeat,repeat_until,remind)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, id, f.title, f.kind, f.calendar, f.date, f.end_date, f.time, f.end_time, f.location,
    f.notes, f.birth_year, f.birth_month, f.birth_day, f.is_leap, f.hashtags, user.id, now(), f.repeat, f.repeat_until, f.remind);
  if (f.kind === 'birthday') linkFriend(body);
  return { id };
});
route('PUT', '/api/events/:id', 'staff', ({ params, body, user }) => {
  const e = get('SELECT * FROM events WHERE id=? AND deleted=0', params.id) || fail(404, '일정을 찾을 수 없습니다.');
  if (!canEditEvent(e, user)) fail(403, '본인이 등록한 일반 일정만 수정할 수 있어요. 생일·기념일은 평기자 이상 누구나 고칠 수 있어요.');
  const f = eventFields(body);
  run(`UPDATE events SET title=?,kind=?,calendar=?,date=?,end_date=?,time=?,end_time=?,location=?,notes=?,birth_year=?,birth_month=?,birth_day=?,is_leap=?,hashtags=?,repeat=?,repeat_until=?,remind=? WHERE id=?`,
    f.title, f.kind, f.calendar, f.date, f.end_date, f.time, f.end_time, f.location, f.notes, f.birth_year, f.birth_month, f.birth_day, f.is_leap, f.hashtags, f.repeat, f.repeat_until, f.remind, e.id);
  if (f.kind === 'birthday') linkFriend(body);
  return { id: e.id };
});
route('DELETE', '/api/events/:id', 'staff', ({ params, query, user }) => {
  if (query.permanent === '1') { requireRole(user, 'admin'); run('DELETE FROM events WHERE id=?', params.id); return { ok: true, message: '일정을 영구 삭제했습니다.' }; }
  const e = get('SELECT * FROM events WHERE id=?', params.id) || fail(404, '일정을 찾을 수 없습니다.');
  if (!canEditEvent(e, user)) fail(403, '이 일정을 삭제할 권한이 없어요.');
  run('UPDATE events SET deleted=1 WHERE id=?', params.id);
  return { ok: true, message: '일정을 삭제했습니다. 삭제한 일정에서 복원할 수 있습니다.' };
});
route('POST', '/api/events/:id/restore', 'editor', ({ params }) => { run('UPDATE events SET deleted=0 WHERE id=?', params.id); return { ok: true, message: '일정을 복원했습니다.' }; });

// ── timetables
const canTimetable = (u) => !!u && (isRole(u, 'admin') || u.timetable_access);
route('GET', '/api/timetables', null, ({ user }) => {
  if (!canTimetable(user)) return { allowed: false, timetables: [] };
  const rows = isRole(user, 'admin') ? all('SELECT * FROM timetables ORDER BY updated DESC')
    : all('SELECT * FROM timetables WHERE owner_id=? ORDER BY updated DESC', user.id);
  return { allowed: true, timetables: rows.map(t => ({ ...t, items: JSON.parse(t.items || '[]') })) };
});
function ttFields(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length > 120) fail(400, '시간표당 최대 120개 수업까지 저장할 수 있습니다.');
  return {
    student: str(body.student, 30) || fail(400, '학생 이름을 입력해주세요.'), school_year: Number(body.school_year) || new Date().getFullYear(),
    term: str(body.term, 20), level: str(body.level, 10), grade: str(body.grade, 10), class_no: str(body.class_no, 10),
    title: str(body.title, 40), month: Math.min(12, Math.max(0, parseInt(body.month, 10) || 0)), week: Math.min(5, Math.max(0, parseInt(body.week, 10) || 0)),
    periods: Math.min(10, Math.max(4, Number(body.periods) || 7)), start_time: /^\d{2}:\d{2}$/.test(body.start_time) ? body.start_time : '09:00',
    items: JSON.stringify(items.map(i => ({ id: str(i.id, 40) || uid(), day: Math.min(6, Math.max(0, Number(i.day) || 0)),
      type: ['school', 'afterschool', 'academy', 'activity'].includes(i.type) ? i.type : 'school', period: Number(i.period) || 0,
      start: str(i.start, 5), end: str(i.end, 5), subject: str(i.subject, 30), place: str(i.place, 40), teacher: str(i.teacher, 30), memo: str(i.memo, 200) }))),
  };
}
route('POST', '/api/timetables', null, ({ user, body }) => {
  if (!canTimetable(user)) fail(403, '시간표 권한이 없습니다.');
  const f = ttFields(body); const id = uid(); const t = now();
  run('INSERT INTO timetables(id,student,school_year,term,level,grade,class_no,periods,start_time,items,owner_id,created,updated,title,month,week) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    id, f.student, f.school_year, f.term, f.level, f.grade, f.class_no, f.periods, f.start_time, f.items, user.id, t, t, f.title, f.month, f.week);
  return { id };
});
route('PUT', '/api/timetables/:id', null, ({ user, body, params }) => {
  if (!canTimetable(user)) fail(403, '시간표 권한이 없습니다.');
  const tt = get('SELECT * FROM timetables WHERE id=?', params.id) || fail(404, '시간표를 찾을 수 없습니다.');
  if (tt.owner_id !== user.id && !isRole(user, 'admin')) fail(403, '권한이 없습니다.');
  const f = ttFields(body);
  run('UPDATE timetables SET student=?,school_year=?,term=?,level=?,grade=?,class_no=?,periods=?,start_time=?,items=?,updated=?,title=?,month=?,week=? WHERE id=?',
    f.student, f.school_year, f.term, f.level, f.grade, f.class_no, f.periods, f.start_time, f.items, now(), f.title, f.month, f.week, tt.id);
  return { id: tt.id };
});
route('DELETE', '/api/timetables/:id', null, ({ user, params }) => {
  const tt = get('SELECT * FROM timetables WHERE id=?', params.id) || fail(404, '시간표를 찾을 수 없습니다.');
  if (!user || (tt.owner_id !== user.id && !isRole(user, 'admin'))) fail(403, '권한이 없습니다.');
  run('DELETE FROM timetables WHERE id=?', tt.id);
  return { ok: true };
});

// ── studio (사진관, 관리자 전용)
route('GET', '/api/studio', 'admin', () => ({
  photos: all("SELECT id,width,height,caption,taken,created FROM photos WHERE kind='studio' ORDER BY created DESC"),
  albums: all('SELECT * FROM albums ORDER BY updated DESC').map(a => ({ ...a, items: JSON.parse(a.items || '[]') })),
  links: all('SELECT * FROM folder_links ORDER BY created'),
  months: articlePhotoMonths(),
}));
// 사진관 자동 앨범 — 발행된 기사 사진을 발행월별로 모은다
function articlePhotoMonths() {
  const byMonth = {};
  for (const a of all("SELECT * FROM articles WHERE deleted=0 AND status='published' ORDER BY published_at")) {
    const m = a.issue_month || (a.published_at || '').slice(0, 7); if (!m) continue;
    const list = byMonth[m] || (byMonth[m] = []);
    if (a.photo) list.push({ photo: a.photo, caption: a.photo_caption || a.title, title: a.title });
    for (const b of parseBlocks(a)) if (b.type === 'photo' && b.photo) list.push({ photo: b.photo, caption: b.caption || a.title, title: a.title });
  }
  return Object.entries(byMonth).filter(([, l]) => l.length).sort((x, y) => y[0].localeCompare(x[0])).map(([month, photos]) => ({ month, photos: photos.slice(0, 60) }));
}
route('POST', '/api/studio/photos', 'admin', ({ body, user }) => {
  const list = Array.isArray(body.photos) ? body.photos : [];
  if (list.length > 30) fail(400, '한 번에 최대 30장까지 가져올 수 있어요.');
  return { ids: list.map(p => savePhoto(p.data, 'studio', user.id, p)) };
});
route('DELETE', '/api/studio/photos/:id', 'admin', ({ params }) => { deletePhoto(params.id); return { ok: true }; });
route('POST', '/api/albums', 'admin', ({ body }) => {
  const id = body.id && get('SELECT 1 FROM albums WHERE id=?', body.id) ? body.id : null;
  const items = JSON.stringify((Array.isArray(body.items) ? body.items : []).filter((i) => i && typeof i === 'object').slice(0, 60).map(i => ({ photo: str(i.photo, 60), caption: str(i.caption, 300), fit: i.fit === 'contain' ? 'contain' : 'cover' })));
  const title = str(body.title, 60) || '우리 가족의 순간들'; const template = str(body.template, 20) || 'classic';
  const paper = ['ivory', 'white', 'sage', 'charcoal'].includes(body.paper) ? body.paper : 'ivory'; const subtitle = str(body.subtitle, 80);
  if (id) run('UPDATE albums SET title=?,template=?,items=?,paper=?,subtitle=?,updated=? WHERE id=?', title, template, items, paper, subtitle, now(), id);
  else { const nid = uid(); run('INSERT INTO albums(id,title,template,items,paper,subtitle,created,updated) VALUES(?,?,?,?,?,?,?,?)', nid, title, template, items, paper, subtitle, now(), now()); return { id: nid }; }
  return { id };
});
route('DELETE', '/api/albums/:id', 'admin', ({ params }) => { run('DELETE FROM albums WHERE id=?', params.id); return { ok: true }; });
route('POST', '/api/folder-links', 'admin', ({ body }) => {
  if (get('SELECT COUNT(*) c FROM folder_links').c >= 8) fail(400, '폴더 링크는 최대 8개까지 저장할 수 있어요.');
  const url = str(body.url, 500); if (!/^https?:\/\//.test(url)) fail(400, 'http(s):// 로 시작하는 주소를 입력해주세요.');
  run('INSERT INTO folder_links(id,name,url,created) VALUES(?,?,?,?)', uid(), str(body.name, 40) || '가족 공유 폴더', url, now());
  return { ok: true };
});
route('DELETE', '/api/folder-links/:id', 'admin', ({ params }) => { run('DELETE FROM folder_links WHERE id=?', params.id); return { ok: true }; });

// ── cards (우체국)
const kstToday = () => new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
// 타임캡슐: 여는 날 전에는 쓴 사람도 내용을 볼 수 없다 (봉투만 보임)
function cardOut(c, user) {
  const locked = !!c.open_on && c.open_on > kstToday();
  const o = { ...c, is_public: !!c.is_public, is_own: !!user && c.author_id === user.id, locked, open_on: c.open_on || '' };
  if (locked) { o.message = ''; o.photo = null; o.title = ''; o.days_left = Math.round((Date.parse(c.open_on) - Date.parse(kstToday())) / 864e5); }
  return o;
}
route('GET', '/api/cards', null, ({ user }) => {
  const rows = isRole(user, 'admin') ? all('SELECT * FROM cards WHERE deleted=0 ORDER BY updated DESC')
    : user ? all('SELECT * FROM cards WHERE deleted=0 AND (is_public=1 OR author_id=?) ORDER BY updated DESC', user.id)
      : all('SELECT * FROM cards WHERE deleted=0 AND is_public=1 ORDER BY updated DESC');
  return { cards: rows.map(c => cardOut(c, user)) };
});
function cardFields(body) {
  const type = ['letter', 'birthday', 'anniversary', 'christmas', 'newyear'].includes(body.type) ? body.type : 'letter';
  const message = String(body.message || '').slice(0, 6000);
  if (type === 'letter' ? message.length > 5000 : message.length > 1500) fail(400, type === 'letter' ? '편지는 5,000자까지 저장할 수 있어요.' : '카드는 1,500자까지 저장할 수 있어요. 내용을 줄여주세요.');
  return { type, design: Math.min(3, Math.max(0, Number(body.design) || 0)), color: ['ivory', 'rose', 'sage', 'midnight'].includes(body.color) ? body.color : 'ivory',
    to_name: str(body.to_name, 30), from_name: str(body.from_name, 30), card_date: str(body.card_date, 10), title: str(body.title, 60), message,
    photo: body.photo ? str(body.photo, 60) : null,
    open_on: /^\d{4}-\d{2}-\d{2}$/.test(body.open_on || '') && body.open_on > kstToday() ? body.open_on : '' };
}
route('POST', '/api/cards', 'reporter', ({ body, user }) => {
  const f = cardFields(body); const id = uid(); const t = now();
  run('INSERT INTO cards(id,type,design,color,to_name,from_name,card_date,title,message,photo,author_id,created,updated,open_on) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    id, f.type, f.design, f.color, f.to_name, f.from_name, f.card_date, f.title, f.message, f.photo, user.id, t, t, f.open_on);
  // 카드·편지 포인트 — 새로 써서 보낼 때 한 장마다 (하루 CARD_DAILY장까지)
  let points = 0; const amt = pointRate().card;
  if (amt && get("SELECT COUNT(*) c FROM points WHERE user_id=? AND kind='card' AND created>=?", user.id, kstDayStart()).c < CARD_DAILY
    && addPoints(user.id, amt, `${CARD_NAMES[f.type] || '편지'} 보내기${f.to_name ? ' · ' + f.to_name : ''}`, 'card', id)) points = amt;
  return { id, points };
});
route('PUT', '/api/cards/:id', 'reporter', ({ body, user, params }) => {
  const c = get('SELECT * FROM cards WHERE id=? AND deleted=0', params.id) || fail(404, '카드를 찾을 수 없습니다.');
  if (c.author_id !== user.id && !isRole(user, 'admin')) fail(403, '권한이 없습니다.');
  if (c.open_on && c.open_on > kstToday()) fail(400, '봉인한 타임캡슐은 여는 날까지 고칠 수 없어요.');
  const f = cardFields(body);
  if (c.photo && c.photo !== f.photo) deletePhoto(c.photo);
  run('UPDATE cards SET type=?,design=?,color=?,to_name=?,from_name=?,card_date=?,title=?,message=?,photo=?,open_on=?,updated=? WHERE id=?',
    f.type, f.design, f.color, f.to_name, f.from_name, f.card_date, f.title, f.message, f.photo, f.open_on, now(), c.id);
  return { id: c.id };
});
route('POST', '/api/cards/:id/publish', 'reporter', ({ body, user, params }) => {
  const c = get('SELECT * FROM cards WHERE id=? AND deleted=0', params.id) || fail(404, '카드를 찾을 수 없습니다.');
  if (c.author_id !== user.id && !isRole(user, 'admin')) fail(403, '권한이 없습니다.');
  run('UPDATE cards SET is_public=?, updated=? WHERE id=?', body.public ? 1 : 0, now(), c.id);
  return { ok: true };
});
route('DELETE', '/api/cards/:id', 'reporter', ({ user, params }) => {
  const c = get('SELECT * FROM cards WHERE id=?', params.id) || fail(404, '카드를 찾을 수 없습니다.');
  if (c.author_id !== user.id && !isRole(user, 'admin')) fail(403, '권한이 없습니다.');
  run('UPDATE cards SET deleted=1 WHERE id=?', c.id);
  return { ok: true };
});

// ── 우리 집 기록: 연표(milestone)·성장(growth)·버킷리스트(bucket)·당번(chore)·가족회의(meeting)
// 방학계획표 — 하루 생활계획(동그라미), 방학 목표, 날마다 체크하는 습관
const HHMM = (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')) ? String(v) : '');
const YMD = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
function vacationChecks(src, nHabits) {
  const out = {}; if (!src || typeof src !== 'object') return out;
  for (const [k, v] of Object.entries(src).slice(0, 150)) { if (!YMD(k) || !Array.isArray(v)) continue; const xs = [...new Set(v.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < nHabits))].sort((a, b) => a - b); if (xs.length) out[k] = xs; }
  return out;
}
function vacationData(src, d) {
  if (!d.student) fail(400, '누구의 방학계획표인지 적어 주세요.');
  d.start = YMD(d.start); d.end = YMD(d.end);
  if (!d.start || !d.end || d.end < d.start) fail(400, '방학 시작일과 끝나는 날을 확인해 주세요.');
  if ((Date.parse(d.end) - Date.parse(d.start)) / 864e5 > 120) fail(400, '방학 기간은 120일까지 정할 수 있어요.');
  const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  const goals = arr(src.goals, 10).map((x) => ({ text: str(x && x.text, 60), done: !!(x && x.done) })).filter((x) => x.text);
  const routine = arr(src.routine, 16).map((x) => ({ start: HHMM(x && x.start), end: HHMM(x && x.end), label: str(x && x.label, 20) })).filter((x) => x.label && x.start && x.end && x.start !== x.end);
  const habits = arr(src.habits, 8).map((x) => str(x, 30)).filter(Boolean);
  return { goals, routine, habits, checks: vacationChecks(src.checks, habits.length) };
}
const ITEM_KINDS = {
  milestone: { s: { title: 80, note: 400, person: 30, emoji: 8, type: 12 } },
  growth: { s: { person: 30, note: 200 }, n: { height: [20, 230], weight: [1, 200] } },
  bucket: { s: { title: 80, who: 60, note: 300, emoji: 8, article: 60 }, b: ['done'] },
  chore: { s: { name: 40, emoji: 8, start: 10 }, a: { members: [8, 30] } },
  meeting: { s: { title: 80, agenda: 2000, attendees: 120, notes: 2000 }, d: true },
  prep: { s: { title: 80, place: 80, note: 600 }, a: { members: [30, 30] }, p: true },
  address: { s: { name: 40, zip: 10, addr1: 120, addr2: 120, phone: 30, note: 60 }, b: ['send'], role: 'editor' },
  vacation: { s: { student: 30, title: 60, season: 20, start: 10, end: 10, motto: 120 }, v: true }, // 방학계획표
};
const kindOk = (kind, user) => !ITEM_KINDS[kind]?.role || isRole(user, ITEM_KINDS[kind].role);
function itemData(kind, body) {
  const spec = ITEM_KINDS[kind] || fail(400, '알 수 없는 기록 종류예요.'); const src = body.data && typeof body.data === 'object' ? body.data : {}; const d = {};
  for (const [k, max] of Object.entries(spec.s || {})) d[k] = str(src[k], max);
  for (const [k, [lo, hi]] of Object.entries(spec.n || {})) { const v = Number(src[k]); d[k] = src[k] === '' || src[k] == null || !(v >= lo && v <= hi) ? null : Math.round(v * 10) / 10; }
  for (const k of spec.b || []) d[k] = !!src[k];
  for (const [k, [maxN, maxL]] of Object.entries(spec.a || {})) d[k] = (Array.isArray(src[k]) ? src[k] : []).map((x) => str(x, maxL)).filter(Boolean).slice(0, maxN);
  if (spec.d) d.decisions = (Array.isArray(src.decisions) ? src.decisions : []).slice(0, 30).map((x) => ({ text: str(x && x.text, 200), owner: str(x && x.owner, 30), due: /^\d{4}-\d{2}-\d{2}$/.test(x && x.due || '') ? x.due : '', done: !!(x && x.done) })).filter((x) => x.text);
  if (kind === 'growth' && d.height == null && d.weight == null) fail(400, '키나 몸무게 중 하나는 적어주세요.');
  if (kind === 'growth' && !d.person) fail(400, '누구의 기록인지 적어주세요.');
  if ((kind === 'milestone' || kind === 'bucket' || kind === 'meeting') && !d.title) fail(400, '제목을 적어주세요.');
  if (kind === 'chore' && (!d.name || !d.members.length)) fail(400, '집안일 이름과 돌아가며 맡을 사람을 적어주세요.');
  if (spec.p) {
    d.checklist = (Array.isArray(src.checklist) ? src.checklist : []).slice(0, 80).map((x) => ({ text: str(x && x.text, 100), who: str(x && x.who, 30), done: !!(x && x.done) })).filter((x) => x.text);
    d.costs = (Array.isArray(src.costs) ? src.costs : []).slice(0, 100).map((x) => ({ who: str(x && x.who, 30), what: str(x && x.what, 80), amount: Math.max(0, Math.min(1e8, Math.round(Number(x && x.amount) || 0))) })).filter((x) => x.who && x.amount);
    if (!d.title) fail(400, '행사 이름을 적어주세요.');
  }
  if (kind === 'address' && (!d.name || !d.addr1)) fail(400, '받는 분 이름과 주소를 적어주세요.');
  if (spec.v) Object.assign(d, vacationData(src, d));
  return d;
}
const itemOut = (r, user) => { let data = {}; try { data = JSON.parse(r.data); } catch {} return { id: r.id, kind: r.kind, date: r.date, data, author_name: r.author_name, created: r.created, updated: r.updated, can_edit: !!user && (r.author_id === user.id || isRole(user, 'staff')) }; };
route('GET', '/api/items', 'subscriber', ({ query, user }) => {
  const kinds = String(query.kind || '').split(',').filter((k) => ITEM_KINDS[k] && kindOk(k, user));
  if (!kinds.length) fail(400, '기록 종류를 골라주세요.');
  const rows = all(`SELECT * FROM items WHERE deleted=0 AND kind IN (${kinds.map(() => '?').join(',')}) ORDER BY date DESC, created DESC LIMIT 1000`, ...kinds);
  const out = { items: rows.map((r) => itemOut(r, user)) };
  if (kinds.includes('chore')) out.today = kstToday(), out.assign = Object.fromEntries(out.items.filter((i) => i.kind === 'chore').map((i) => [i.id, [0, 1, 2, 3].map((w) => choreAssignee(i.data, new Date(Date.parse(kstToday()) + w * 7 * 864e5).toISOString().slice(0, 10)))]));
  return out;
});
route('POST', '/api/items', 'subscriber', ({ body, user }) => {
  const kind = String(body.kind || ''); if (ITEM_KINDS[kind] && !kindOk(kind, user)) fail(403, '권한이 없습니다.'); const data = itemData(kind, body); const id = uid(); const t = now();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : kstToday();
  run('INSERT INTO items(id,kind,data,date,author_id,author_name,created,updated) VALUES(?,?,?,?,?,?,?,?)', id, kind, JSON.stringify(data), date, user.id, user.display_name, t, t);
  return { id };
});
route('PUT', '/api/items/:id', 'subscriber', ({ params, body, user }) => {
  const r = get('SELECT * FROM items WHERE id=? AND deleted=0', params.id) || fail(404, '기록을 찾을 수 없어요.');
  // 버킷리스트 달성·회의 결정 체크는 가족 누구나, 그 밖의 수정은 쓴 사람 또는 평기자 이상
  if (!kindOk(r.kind, user)) fail(403, '권한이 없습니다.');
  const quick = body.quick === true && (r.kind === 'bucket' || r.kind === 'meeting' || r.kind === 'prep' || r.kind === 'vacation');
  if (!quick && r.author_id !== user.id && !isRole(user, 'staff')) fail(403, '내가 쓴 기록만 고칠 수 있어요.');
  let data;
  if (quick) { // 체크 표시만 바꾼다 (다른 내용은 그대로)
    const old = JSON.parse(r.data || '{}'); const src = body.data && typeof body.data === 'object' ? body.data : {};
    if (r.kind === 'vacation' && r.author_id !== user.id && !isRole(user, 'staff')) fail(403, '내 방학계획표만 체크할 수 있어요.');
    data = r.kind === 'vacation' ? { ...old, checks: vacationChecks(src.checks, (old.habits || []).length), goals: (old.goals || []).map((x, i) => ({ ...x, done: !!(Array.isArray(src.goals) && src.goals[i] && src.goals[i].done) })) }
      : r.kind === 'prep' ? { ...old, checklist: (old.checklist || []).map((x, i) => ({ ...x, done: !!(Array.isArray(src.checklist) && src.checklist[i] && src.checklist[i].done) })) }
      : r.kind === 'bucket' ? { ...old, done: !!src.done } : { ...old, decisions: (old.decisions || []).map((x, i) => ({ ...x, done: !!(Array.isArray(src.decisions) && src.decisions[i] && src.decisions[i].done) })) };
  } else data = itemData(r.kind, body);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : r.date;
  run('UPDATE items SET data=?, date=?, updated=? WHERE id=?', JSON.stringify(data), date, now(), r.id);
  return { ok: true };
});
route('DELETE', '/api/items/:id', 'subscriber', ({ params, user }) => {
  const r = get('SELECT * FROM items WHERE id=?', params.id) || fail(404, '기록을 찾을 수 없어요.');
  if (!kindOk(r.kind, user)) fail(403, '권한이 없습니다.');
  if (r.author_id !== user.id && !isRole(user, 'editor')) fail(403, '내가 쓴 기록만 지울 수 있어요.');
  run('UPDATE items SET deleted=1 WHERE id=?', r.id); return { ok: true };
});

// ── 기자단: 기자별 기록과 배지 (연말 시상식에도 씀)
route('GET', '/api/reporter-stats', null, ({ query }) => {
  const y = /^\d{4}$/.test(query.year || '') ? query.year : '';
  const arts = all("SELECT * FROM articles WHERE deleted=0 AND status='published'").filter((a) => !y || (a.issue_month || '').startsWith(y));
  const users = all('SELECT id, display_name, role FROM users ORDER BY created');
  const stats = users.map((u) => {
    const mine = arts.filter((a) => writers(a).includes(u.id));
    const photos = mine.reduce((n, a) => n + articlePhotoIds(a).length, 0);
    const cm = get(`SELECT COUNT(*) c FROM comments WHERE deleted=0 AND user_id=?${y ? " AND substr(created,1,4)=?" : ''}`, ...(y ? [u.id, y] : [u.id])).c;
    const nt = get(`SELECT COUNT(*) c FROM notes WHERE deleted=0 AND user_id=?${y ? " AND substr(created,1,4)=?" : ''}`, ...(y ? [u.id, y] : [u.id])).c;
    const cards = get(`SELECT COUNT(*) c FROM cards WHERE deleted=0 AND author_id=?${y ? " AND substr(created,1,4)=?" : ''}`, ...(y ? [u.id, y] : [u.id])).c;
    const sections = [...new Set(mine.map((a) => a.section))];
    const views = mine.reduce((n, a) => n + (a.views || 0), 0);
    const rx = mine.reduce((n, a) => n + get('SELECT COUNT(*) c FROM reactions WHERE article_id=?', a.id).c, 0);
    return { id: u.id, name: u.display_name, role_label: ROLE_LABEL[u.role], articles: mine.length, photos, comments: cm, notes: nt, cards, sections, views, reactions: rx,
      first: mine.map((a) => a.published_at).filter(Boolean).sort()[0] || '' };
  }).filter((s) => s.articles || s.comments || s.notes || s.cards);
  const top = arts.map((a) => ({ id: a.id, title: a.title, author_name: a.author_name, section: a.section, score: (a.views || 0) + 3 * get('SELECT COUNT(*) c FROM reactions WHERE article_id=?', a.id).c + 3 * get('SELECT COUNT(*) c FROM comments WHERE article_id=? AND deleted=0', a.id).c }))
    .sort((p, q) => q.score - p.score).slice(0, 8);
  return { year: y, stats, top };
});

// ── people (가족 인물 사전, 신규)
function peopleIndex() {
  const map = new Map();
  const add = (name) => { if (!map.has(name)) map.set(name, { name, event_count: 0, article_count: 0 }); return map.get(name); };
  const groupWords = new Set(['친구']);
  for (const e of all('SELECT hashtags FROM events WHERE deleted=0')) for (const t of tags(e.hashtags)) add(t).event_count++;
  for (const a of all("SELECT hashtags FROM articles WHERE deleted=0 AND status='published'")) for (const t of tags(a.hashtags)) add(t).article_count++;
  for (const p of all('SELECT * FROM people')) Object.assign(add(p.name), { relation: p.relation, family_group: p.family_group, bio: p.bio, photo: p.photo, emoji: p.emoji, father: p.father || '', mother: p.mother || '', spouse: p.spouse || '', has_profile: true });
  // 지역/그룹 태그(이름이 아닌 것) 구분: 프로필이 없고 2글자 이상 지명/그룹처럼 쓰인 태그는 group으로 분류
  const groups = new Set();
  for (const e of all('SELECT hashtags FROM events WHERE deleted=0')) {
    const t = tags(e.hashtags); const last = t[t.length - 1];
    if (last && (/(동|산|구|시|친구)$/.test(last) || groupWords.has(last)) && t.length > 1) groups.add(last);
  }
  return [...map.values()].map(p => ({ ...p, is_group: !p.has_profile && groups.has(p.name) }))
    .sort((a, b) => (a.is_group - b.is_group) || a.name.localeCompare(b.name, 'ko'));
}
route('GET', '/api/people', null, () => ({ people: peopleIndex() }));
route('GET', '/api/people/:name', null, ({ params, user }) => {
  const name = decodeURIComponent(params.name);
  const like = `%#${name}%`;
  const profile = get('SELECT * FROM people WHERE name=?', name) || { name };
  if (!isRole(user, 'subscriber')) delete profile.facetime; // 페이스타임 연락처는 로그인한 가족에게만
  const evs = all('SELECT * FROM events WHERE deleted=0 AND (hashtags LIKE ? OR title LIKE ?)', like, `%${name}%`)
    .filter(e => tags(e.hashtags).includes(name) || e.title.includes(name)).map(e => publicEvent(e));
  const y = new Date().getFullYear();
  const occ = [...occurrencesForYear(y), ...occurrencesForYear(y + 1)].filter(o => evs.some(e => e.id === o.id));
  const arts = all("SELECT * FROM articles WHERE deleted=0 AND status='published' AND (hashtags LIKE ? OR title LIKE ? OR blocks LIKE ?) ORDER BY COALESCE(published_at,updated) DESC", like, `%${name}%`, `%${name}%`)
    .map(a => articleOut(a, user, false));
  const related = new Map();
  for (const e of evs) for (const t of tags(e.hashtags)) if (t !== name) related.set(t, (related.get(t) || 0) + 1);
  const exists = !!profile.updated || evs.length > 0 || arts.length > 0 || all('SELECT name FROM people WHERE father=? OR mother=? OR spouse=?', name, name, name).length > 0;
  return { exists, person: profile, events: evs, occurrences: occ, articles: arts, related: [...related.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n) };
});
route('PUT', '/api/people/:name', 'staff', ({ params, body }) => {
  const name = decodeURIComponent(params.name).slice(0, 30);
  const cur = get('SELECT * FROM people WHERE name=?', name) || {};
  const pick = (k, max) => (k in body ? str(body[k], max) : (cur[k] || ''));
  const rel = (k) => { const v = pick(k, 30); return v === name ? '' : v; };
  const photo = 'photo' in body ? (body.photo ? str(body.photo, 60) : null) : (cur.photo || null);
  const spouse = rel('spouse');
  if ('facetime' in body) { const ft = ftContact(body.facetime); if (ft === null) fail(400, '페이스타임 연락처는 전화번호나 이메일 주소로 적어 주세요.'); }
  run(`INSERT INTO people(name,relation,family_group,bio,photo,emoji,father,mother,spouse,updated) VALUES(?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(name) DO UPDATE SET relation=excluded.relation, family_group=excluded.family_group, bio=excluded.bio, photo=excluded.photo, emoji=excluded.emoji,
    father=excluded.father, mother=excluded.mother, spouse=excluded.spouse, updated=excluded.updated`,
    name, pick('relation', 30), pick('family_group', 30), pick('bio', 1000), photo, pick('emoji', 8), rel('father'), rel('mother'), spouse, now());
  // 배우자는 서로 이어 준다 (예전 배우자 연결은 풀기)
  if ('facetime' in body) run('UPDATE people SET facetime=? WHERE name=?', ftContact(body.facetime) || '', name);
  if ('spouse' in body) {
    if (cur.spouse && cur.spouse !== spouse) run("UPDATE people SET spouse='' WHERE name=? AND spouse=?", cur.spouse, name);
    if (spouse) {
      const other = get('SELECT * FROM people WHERE name=?', spouse);
      if (other && other.spouse && other.spouse !== name) run("UPDATE people SET spouse='' WHERE name=? AND spouse=?", other.spouse, spouse);
      if (other) run('UPDATE people SET spouse=?, updated=? WHERE name=?', name, now(), spouse);
      else run("INSERT INTO people(name,spouse,updated) VALUES(?,?,?)", spouse, name, now());
    }
  }
  return { ok: true };
});

// ── 조회수 (신규)
route('POST', '/api/articles/:id/view', null, ({ params }) => {
  run("UPDATE articles SET views = COALESCE(views,0) + 1 WHERE id=? AND status='published' AND deleted=0", params.id);
  return { ok: true };
});

// ── 가족 투표 (신규)
function actorOf(user, req, res) {
  if (user) return 'u:' + user.id;
  let vid = parseCookies(req).yt_vid;
  if (!vid || !/^[a-f0-9]{32}$/.test(vid)) { vid = crypto.randomBytes(16).toString('hex'); res.setHeader('Set-Cookie', `yt_vid=${vid}; Path=/; SameSite=Lax; Max-Age=${86400 * 400}`); }
  return 'v:' + vid;
}
function pollOut(p, user, actor) {
  const options = JSON.parse(p.options || '[]');
  const votes = all('SELECT option_idx, name, actor FROM poll_votes WHERE poll_id=?', p.id);
  const counts = options.map((_, i) => votes.filter((v) => v.option_idx === i).length);
  const voters = new Set(votes.map((v) => v.actor)).size;
  const expired = p.closes && p.closes < new Date().toISOString().slice(0, 10);
  return { id: p.id, question: p.question, options, multi: !!p.multi, allow_add: !!p.allow_add, closes: p.closes, closed: !!p.closed || !!expired,
    author_name: p.author_name, created: p.created, counts, voters,
    names: options.map((_, i) => votes.filter((v) => v.option_idx === i && v.name).map((v) => v.name)),
    mine: actor ? votes.filter((v) => v.actor === actor).map((v) => v.option_idx) : [],
    can_manage: canManagePoll(p, user), can_add: !!user && isRole(user, 'subscriber') && (!!p.allow_add || canManagePoll(p, user)) };
}
route('GET', '/api/polls', null, ({ user, req }) => {
  const vid = parseCookies(req).yt_vid;
  const actor = user ? 'u:' + user.id : (vid ? 'v:' + vid : '');
  return { polls: all('SELECT * FROM polls ORDER BY created DESC LIMIT 50').map((p) => pollOut(p, user, actor)) };
});
const POLL_MAX = 12;
const pollDate = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');
const canManagePoll = (p, user) => !!user && (p.author_id === user.id || isRole(user, 'editor'));
route('POST', '/api/polls', 'subscriber', ({ user, body }) => {
  const question = str(body.question, 120); if (!question) fail(400, '질문을 입력해주세요.');
  const options = [...new Set((Array.isArray(body.options) ? body.options : []).map((o) => str(typeof o === 'object' && o ? o.text : o, 60)).filter(Boolean))].slice(0, POLL_MAX);
  if (options.length < 2) fail(400, '보기를 두 개 이상 입력해주세요.');
  const id = uid();
  run('INSERT INTO polls(id,question,options,multi,closes,allow_add,author_id,author_name,created) VALUES(?,?,?,?,?,?,?,?,?)',
    id, question, JSON.stringify(options), body.multi ? 1 : 0, pollDate(body.closes), body.allow_add ? 1 : 0, user.id, user.display_name, now());
  notify(usersWith('subscriber', user.id), { kind: 'poll', title: `새 투표 · ${question}`, body: `${user.display_name}님이 물어봤어요.`, link: '#/board' });
  return { id };
});
// 투표 고치기: 보기마다 { text, from: 예전 번호 | null } — 예전 보기에 들어온 표는 그대로 따라가고, 지운 보기의 표만 사라진다
route('PUT', '/api/polls/:id', 'subscriber', ({ user, params, body }) => {
  const p = get('SELECT * FROM polls WHERE id=?', params.id) || fail(404, '투표를 찾을 수 없습니다.');
  if (!canManagePoll(p, user)) fail(403, '투표를 올린 사람이나 편집장만 고칠 수 있어요.');
  const question = str(body.question, 120); if (!question) fail(400, '질문을 입력해주세요.');
  const old = JSON.parse(p.options || '[]');
  const seen = new Set(); const next = [];
  for (const o of Array.isArray(body.options) ? body.options : []) {
    const text = str(o && o.text, 60); if (!text || seen.has(text)) continue; seen.add(text);
    const from = Number.isInteger(o.from) && o.from >= 0 && o.from < old.length ? o.from : null;
    next.push({ text, from }); if (next.length >= POLL_MAX) break;
  }
  if (next.length < 2) fail(400, '보기를 두 개 이상 남겨주세요.');
  const map = new Map(next.map((o, i) => [o.from, i]).filter(([f]) => f !== null));
  const votes = all('SELECT * FROM poll_votes WHERE poll_id=?', p.id);
  run('DELETE FROM poll_votes WHERE poll_id=?', p.id);
  for (const v of votes) if (map.has(v.option_idx)) run('INSERT OR IGNORE INTO poll_votes(poll_id,actor,option_idx,name) VALUES(?,?,?,?)', p.id, v.actor, map.get(v.option_idx), v.name);
  const closes = pollDate(body.closes);
  const stillClosed = p.closed && !(body.reopen);
  run('UPDATE polls SET question=?, options=?, multi=?, closes=?, allow_add=?, closed=? WHERE id=?', question, JSON.stringify(next.map((o) => o.text)),
    body.multi ? 1 : 0, closes, body.allow_add ? 1 : 0, stillClosed ? 1 : 0, p.id);
  return { ok: true };
});
// 참여자가 보기 더하기 (투표를 올린 사람이 허용했을 때)
route('POST', '/api/polls/:id/options', 'subscriber', ({ user, params, body }) => {
  const p = get('SELECT * FROM polls WHERE id=?', params.id) || fail(404, '투표를 찾을 수 없습니다.');
  if (!p.allow_add && !canManagePoll(p, user)) fail(403, '이 투표는 보기를 더할 수 없어요.');
  if (pollOut(p, user, null).closed) fail(400, '마감된 투표입니다.');
  const opts = JSON.parse(p.options || '[]'); const text = str(body.text, 60);
  if (!text) fail(400, '보기 내용을 입력해주세요.');
  if (opts.includes(text)) fail(400, '이미 있는 보기예요.');
  if (opts.length >= POLL_MAX) fail(400, `보기는 ${POLL_MAX}개까지예요.`);
  opts.push(text); run('UPDATE polls SET options=? WHERE id=?', JSON.stringify(opts), p.id);
  return { ok: true };
});
route('POST', '/api/polls/:id/reopen', 'subscriber', ({ user, params, body }) => {
  const p = get('SELECT * FROM polls WHERE id=?', params.id) || fail(404, '투표를 찾을 수 없습니다.');
  if (!canManagePoll(p, user)) fail(403, '권한이 없습니다.');
  const closes = pollDate(body.closes);
  run('UPDATE polls SET closed=0, closes=? WHERE id=?', closes && closes >= now().slice(0, 10) ? closes : '', p.id);
  return { ok: true };
});
route('POST', '/api/polls/:id/vote', null, ({ user, params, body, req, res }) => {
  const p = get('SELECT * FROM polls WHERE id=?', params.id) || fail(404, '투표를 찾을 수 없습니다.');
  const out = pollOut(p, user, null);
  if (out.closed) fail(400, '마감된 투표입니다.');
  let picks = [...new Set((Array.isArray(body.options) ? body.options : []).map(Number))].filter((i) => i >= 0 && i < out.options.length);
  if (!p.multi) picks = picks.slice(0, 1);
  const actor = actorOf(user, req, res);
  run('DELETE FROM poll_votes WHERE poll_id=? AND actor=?', p.id, actor);
  for (const i of picks) run('INSERT INTO poll_votes(poll_id,actor,option_idx,name) VALUES(?,?,?,?)', p.id, actor, i, user ? user.display_name : null);
  return { poll: pollOut(get('SELECT * FROM polls WHERE id=?', p.id), user, actor) };
});
route('POST', '/api/polls/:id/close', 'subscriber', ({ user, params }) => {
  const p = get('SELECT * FROM polls WHERE id=?', params.id) || fail(404, '투표를 찾을 수 없습니다.');
  if (!canManagePoll(p, user)) fail(403, '권한이 없습니다.');
  run('UPDATE polls SET closed=1 WHERE id=?', p.id);
  return { ok: true };
});
route('DELETE', '/api/polls/:id', 'subscriber', ({ user, params }) => {
  const p = get('SELECT * FROM polls WHERE id=?', params.id) || fail(404, '투표를 찾을 수 없습니다.');
  if (!canManagePoll(p, user)) fail(403, '권한이 없습니다.');
  run('DELETE FROM poll_votes WHERE poll_id=?', p.id); run('DELETE FROM polls WHERE id=?', p.id);
  return { ok: true };
});

// ── 오늘의 한마디 (신규)
route('GET', '/api/notes', null, ({ user, query }) => {
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const ym = /^\d{4}-\d{2}$/.test(query.month || '') ? query.month : '';
  // 한 달 치(한국 시간 기준) — 기분 날씨 달력에 쓴다
  const rows = ym ? all('SELECT * FROM notes WHERE deleted=0 AND created >= ? AND created < ? ORDER BY created', new Date(Date.parse(ym + '-01T00:00:00+09:00')).toISOString(),
      new Date(Date.parse((+ym.slice(5) === 12 ? `${+ym.slice(0, 4) + 1}-01` : `${ym.slice(0, 4)}-${String(+ym.slice(5) + 1).padStart(2, '0')}`) + '-01T00:00:00+09:00')).toISOString())
    : all('SELECT * FROM notes WHERE deleted=0 ORDER BY created DESC LIMIT ?', limit);
  return { notes: rows.map((n) => ({
    id: n.id, name: n.name, body: n.body, mood: n.mood, created: n.created,
    can_edit: !!user && n.user_id === user.id, can_delete: !!user && (n.user_id === user.id || isRole(user, 'editor')) })) };
});
route('POST', '/api/notes', 'subscriber', ({ user, body }) => {
  const text = str(body.body, 140); if (!text) fail(400, '한마디를 입력해주세요.');
  const nid = uid();
  run('INSERT INTO notes(id,user_id,name,body,mood,created) VALUES(?,?,?,?,?,?)', nid, user.id, user.display_name, text, str(body.mood, 8), now());
  return { ok: true, points: talkPoints(user, 'note', nid, '오늘의 한마디', TALK_DAILY.note) };
});
route('PUT', '/api/notes/:id', 'subscriber', ({ user, params, body }) => {
  const n = get('SELECT * FROM notes WHERE id=? AND deleted=0', params.id) || fail(404, '한마디를 찾을 수 없습니다.');
  if (n.user_id !== user.id) fail(403, '내가 쓴 한마디만 고칠 수 있어요.');
  const text = str(body.body, 140); if (!text) fail(400, '한마디를 입력해주세요.');
  run('UPDATE notes SET body=?, mood=? WHERE id=?', text, str(body.mood, 8) || n.mood, n.id); return { ok: true };
});
route('DELETE', '/api/notes/:id', 'subscriber', ({ user, params }) => {
  const n = get('SELECT * FROM notes WHERE id=?', params.id) || fail(404, '한마디를 찾을 수 없습니다.');
  if (n.user_id !== user.id && !isRole(user, 'editor')) fail(403, '권한이 없습니다.');
  run('UPDATE notes SET deleted=1 WHERE id=?', n.id);
  return { ok: true };
});

// ───────────────────────── server
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

function currentUser(req) {
  const t = parseCookies(req).yt_session;
  if (!t) return null;
  const s = get('SELECT * FROM sessions WHERE token=?', t);
  if (!s || s.expires < Date.now()) { if (s) run('DELETE FROM sessions WHERE token=?', t); return null; }
  return get('SELECT * FROM users WHERE id=?', s.user_id) || null;
}
function send(res, status, obj) {
  const body = JSON.stringify(obj);
  const head = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  // 1KB가 넘는 응답은 압축해서 보낸다 (보통 1/5~1/8 크기)
  if (res.__enc && body.length > 1024) {
    res.writeHead(status, { ...head, 'Content-Encoding': res.__enc, Vary: 'Accept-Encoding' });
    return res.end(res.__enc === 'br' ? zlib.brotliCompressSync(body, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } }) : zlib.gzipSync(body, { level: 6 }));
  }
  res.writeHead(status, head);
  res.end(body);
}
function readBody(req, max = 80 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > max) { reject(new HttpError(413, '요청이 너무 큽니다.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch { reject(new HttpError(400, '잘못된 요청입니다.')); } });
    req.on('error', reject);
  });
}
function serveFile(res, file, cache, req) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const lm = st.mtime.toUTCString();
    if (req && req.headers['if-modified-since'] === lm) { res.writeHead(304, { 'Cache-Control': cache, 'Last-Modified': lm }); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache, 'Last-Modified': lm });
    fs.createReadStream(file).pipe(res);
  });
}

// 휴대폰·구글 캘린더로 가져가는 .ics 파일 (올해와 내년, 생일·기념일은 해마다 날짜를 계산해 넣는다)
function sharePage(req, res, id) {
  const a = membersOnly() ? null : get("SELECT * FROM articles WHERE id=? AND deleted=0 AND status='published'", id);
  const to0 = `/#/article/${id}`;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
  const base = `${req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${host}`;
  const h = (t) => String(t || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const site = getSetting('site_name', '유니 타임즈');
  const title = a ? a.title : site;
  const text = a ? parseBlocks(a).filter((b) => b.type === 'text').map((b) => b.text).join(' ').replace(/\s+/g, ' ').slice(0, 110) : getSetting('tagline', '');
  const photo = a && (a.photo || (parseBlocks(a).find((b) => b.type === 'photo' && b.photo) || {}).photo);
  const img = photo ? `${base}/api/photo/${photo}` : `${base}/icon-512.png`;
  const to = a ? `/#/article/${a.id}` : membersOnly() ? to0 : '/';
  res.writeHead(a || membersOnly() ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
  res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${h(title)} · ${h(site)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta property="og:type" content="article"><meta property="og:site_name" content="${h(site)}"><meta property="og:title" content="${h(title)}">
<meta property="og:description" content="${h(text)}"><meta property="og:image" content="${h(img)}"><meta property="og:url" content="${h(base + '/a/' + id)}">
<meta name="twitter:card" content="summary_large_image"><meta name="description" content="${h(text)}">
<meta http-equiv="refresh" content="0; url=${h(to)}"></head><body><p><a href="${h(to)}">${h(title)} 읽으러 가기</a></p><script>location.replace(${JSON.stringify(to)})</script></body></html>`);
}
function calendarIcs() {
  const y = new Date().getFullYear();
  const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n');
  const d8 = (d) => d.replace(/-/g, ''); const next = (d) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Uni Times//KO', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(getSetting('site_name', '유니 타임즈'))} 캘린더`, 'X-WR-TIMEZONE:Asia/Seoul'];
  for (const o of [...occurrencesForYear(y), ...occurrencesForYear(y + 1)]) {
    const title = o.kind === 'birthday' && o.age ? `${o.title} (${o.age}세)` : o.kind === 'anniversary' && o.anniversary_years ? `${o.title} (${o.anniversary_years}주년)` : o.title;
    lines.push('BEGIN:VEVENT', `UID:${o.id}-${o.date}@unitimes`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(title)}`);
    if (o.time) {
      lines.push(`DTSTART;TZID=Asia/Seoul:${d8(o.date)}T${o.time.replace(':', '')}00`);
      lines.push(`DTEND;TZID=Asia/Seoul:${d8(o.end_date && o.end_date > o.date ? o.end_date : o.date)}T${(o.end_time || o.time).replace(':', '')}00`);
    } else { lines.push(`DTSTART;VALUE=DATE:${d8(o.date)}`, `DTEND;VALUE=DATE:${d8(next(o.end_date && o.end_date > o.date ? o.end_date : o.date))}`); }
    if (o.location) lines.push(`LOCATION:${esc(o.location)}`);
    if (o.notes) lines.push(`DESCRIPTION:${esc(o.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// 예전 '가족독자' 계정은 구독자로 (구독자가 가족독자의 일을 모두 이어받음)
run("UPDATE users SET role='subscriber' WHERE role='reader' OR role NOT IN ('subscriber','reporter','staff','senior','editor','admin')");
// ───────────────────────── 목소리·소리 파일, 친척용 열람 링크, 가족만 보기
for (const c of ['father', 'mother', 'spouse', 'facetime']) if (!all('PRAGMA table_info(people)').some((x) => x.name === c)) db.exec(`ALTER TABLE people ADD COLUMN ${c} TEXT DEFAULT ''`);
db.exec(`CREATE TABLE IF NOT EXISTS audios (id TEXT PRIMARY KEY, file TEXT NOT NULL, mime TEXT NOT NULL, owner_id TEXT, duration REAL DEFAULT 0, size INTEGER DEFAULT 0, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS share_links (token TEXT PRIMARY KEY, month TEXT NOT NULL, label TEXT DEFAULT '', expires TEXT NOT NULL, created_by TEXT, created_name TEXT DEFAULT '',
  created TEXT NOT NULL, revoked INTEGER DEFAULT 0, views INTEGER DEFAULT 0, last_view TEXT DEFAULT '');`);
const AUDIO_TYPES = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };
route('POST', '/api/audio', 'reporter', ({ body, user }) => {
  const m = /^data:(audio\/[\w.+-]+)(?:;[^,]*)?;base64,(.+)$/s.exec(String(body.data || ''));
  if (!m || !AUDIO_TYPES[m[1]]) fail(400, '소리 파일 형식이 올바르지 않아요. (m4a·mp3·webm·ogg·wav)');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > (MAX_UPLOAD || 25 * 1024 * 1024)) fail(413, MAX_UPLOAD ? '소리 파일은 3MB(약 10분) 이하여야 해요.' : '소리 파일은 25MB(약 20분) 이하여야 해요.');
  const id = uid(); const file = id + '.' + AUDIO_TYPES[m[1]];
  store.put(file, buf, m[1] === 'audio/mp3' ? 'audio/mpeg' : m[1]);
  run('INSERT INTO audios(id,file,mime,owner_id,duration,size,created) VALUES(?,?,?,?,?,?,?)', id, file, m[1] === 'audio/mp3' ? 'audio/mpeg' : m[1], user.id, Math.max(0, Math.min(7200, Number(body.duration) || 0)), buf.length, now());
  return { id };
});
// 소리는 끊어 받기(Range)를 지원해야 아이폰에서 재생·건너뛰기가 된다
function serveAudio(req, res, id) {
  const au = /^[\w-]{8,60}$/.test(id) && get('SELECT * FROM audios WHERE id=?', id);
  if (!au) { res.writeHead(404); return res.end(); }
  if (store.cloud && !store.url(au.file).startsWith('/__blob/')) return serveUpload(res, au.file, 'private, max-age=31536000, immutable', req); // Blob이 끊어 받기를 해 줌
  const file = store.cloud ? path.join(process.env.YT_FAKE_BLOB_DIR, au.file) : path.join(UPLOAD_DIR, au.file);
  fs.stat(file, (err, st) => {
    if (err) { res.writeHead(404); return res.end(); }
    const head = { 'Content-Type': au.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=31536000, immutable' };
    const r = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (r && (r[1] || r[2])) {
      let start = r[1] ? +r[1] : Math.max(0, st.size - +r[2]); let end = r[1] && r[2] ? Math.min(+r[2], st.size - 1) : st.size - 1;
      if (start >= st.size || start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...head, 'Content-Length': st.size }); fs.createReadStream(file).pipe(res);
  });
}
const membersOnly = () => getSetting('members_only', '0') === '1';
// 로그인 없이도 써야 하는 것들 (가족만 보기 모드에서도 열어 둠)
const OPEN_API = new Set(['/api/me', '/api/setup', '/api/login', '/api/logout']);

// 친척용 열람 링크 — 계정 없는 친척에게 한 달 치 지면을 정한 날까지만 보여 준다
const linkOut = (l) => ({ token: l.token, month: l.month, label: l.label, expires: l.expires, created: l.created, created_name: l.created_name, views: l.views, last_view: l.last_view,
  revoked: !!l.revoked, active: !l.revoked && l.expires >= kstToday() });
route('GET', '/api/share-links', 'editor', ({ query }) => ({
  links: all('SELECT * FROM share_links ORDER BY created DESC LIMIT 200').filter((l) => !query.month || l.month === query.month).map(linkOut) }));
route('POST', '/api/share-links', 'editor', ({ body, user }) => {
  const month = /^\d{4}-\d{2}$/.test(body.month || '') ? body.month : fail(400, '몇 월호인지 골라주세요.');
  const days = [3, 7, 14, 30, 90].includes(Number(body.days)) ? Number(body.days) : 14;
  const token = crypto.randomBytes(12).toString('base64url');
  const expires = new Date(Date.parse(kstToday()) + days * 864e5).toISOString().slice(0, 10);
  run('INSERT INTO share_links(token,month,label,expires,created_by,created_name,created) VALUES(?,?,?,?,?,?,?)', token, month, str(body.label, 40), expires, user.id, user.display_name, now());
  return { link: linkOut(get('SELECT * FROM share_links WHERE token=?', token)) };
});
route('DELETE', '/api/share-links/:token', 'editor', ({ params }) => {
  run('UPDATE share_links SET revoked=1 WHERE token=?', params.token); return { ok: true };
});
function issueArticles(month) {
  return all("SELECT * FROM articles WHERE deleted=0 AND status='published' AND issue_month=? ORDER BY CASE section WHEN '헤드라인' THEN 0 ELSE 1 END, COALESCE(published_at,updated)", month);
}
function sharedIssue(req, res, rest) {
  const [token, kind, id] = rest.split('/');
  const l = /^[\w-]{10,40}$/.test(token || '') && get('SELECT * FROM share_links WHERE token=?', token);
  const h = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const site = getSetting('site_name', '유니 타임즈');
  const page = (status, title, body) => {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' });
    res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${h(title)}</title><link rel="stylesheet" href="/fonts/fonts.css"><style>
body{margin:0;background:#F4F1E8;color:#252D28;font-family:Paperlogy,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;line-height:1.75;word-break:keep-all}
.w{max-width:44rem;margin:0 auto;padding:2rem 1.25rem 4rem}.mast{text-align:center;border-bottom:3px double #252D28;padding-bottom:.75rem;margin-bottom:1.5rem}
.mast h1{font-family:PyeongChangPeace,Paperlogy,sans-serif;font-size:2.6rem;line-height:1.1;margin:.25rem 0}.mast small,.meta{color:#7B8077;font-size:.8rem}
article{border-bottom:1px solid #DAD5C6;padding:1.25rem 0 1.5rem}article h2{font-size:1.45rem;line-height:1.35;margin:.15rem 0 .25rem;letter-spacing:-.02em}
.k{color:#315748;font-size:.75rem;font-weight:700}p{margin:.6rem 0}figure{margin:1rem 0}figure img{width:100%;border-radius:8px;display:block}
figcaption{font-size:.8rem;color:#545C55;margin-top:.25rem}audio{width:100%}.au{background:#FBFAF6;border:1px solid #DAD5C6;border-radius:10px;padding:.6rem .75rem;margin:1rem 0}
.au b{font-size:.8rem;display:block;margin-bottom:.25rem}.foot{text-align:center;color:#7B8077;font-size:.8rem;margin-top:2rem}.msg{text-align:center;padding:5rem 1rem}
</style></head><body><div class="w">${body}</div></body></html>`);
  };
  if (!l || l.revoked) return page(404, site, `<div class="msg"><h1>${h(site)}</h1><p>열 수 없는 링크예요. 링크를 보낸 가족에게 새 링크를 부탁해 주세요.</p></div>`);
  if (l.expires < kstToday()) return page(410, site, `<div class="msg"><h1>${h(site)}</h1><p>${h(l.expires)}까지 열려 있던 링크라 이제는 볼 수 없어요.</p></div>`);
  const arts = issueArticles(l.month);
  if (kind === 'p' || kind === 's') { // 이 호에 실린 사진·소리만 내어 준다
    const ok = arts.some((a) => (kind === 'p' ? articlePhotoIds(a) : parseBlocks(a).filter((b) => b.type === 'audio').map((b) => b.audio)).includes(id));
    if (!ok) { res.writeHead(404); return res.end(); }
    if (kind === 's') return serveAudio(req, res, id);
    const ph = get('SELECT * FROM photos WHERE id=?', id); if (!ph) { res.writeHead(404); return res.end(); }
    return serveUpload(res, ph.file, 'private, max-age=86400', req);
  }
  run('UPDATE share_links SET views=views+1, last_view=? WHERE token=?', now(), token);
  const [y, m] = l.month.split('-').map(Number);
  const base = `/i/${token}`;
  const art = (a) => {
    const blocks = parseBlocks(a);
    const lead = a.photo && !blocks.some((b) => b.type === 'photo' && b.photo === a.photo) ? `<figure><img src="${base}/p/${h(a.photo)}" alt="" loading="lazy">${a.photo_caption ? `<figcaption>${h(a.photo_caption)}</figcaption>` : ''}</figure>` : '';
    const body = blocks.map((b) => b.type === 'photo' ? `<figure><img src="${base}/p/${h(b.photo)}" alt="" loading="lazy">${b.caption ? `<figcaption>${h(b.caption)}</figcaption>` : ''}</figure>`
      : b.type === 'audio' ? `<div class="au"><b>${h(b.caption || '목소리 듣기')}</b><audio controls preload="none" src="${base}/s/${h(b.audio)}"></audio></div>`
      : String(b.text || '').split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).map((t) => `<p>${h(t).replace(/\n/g, '<br>')}</p>`).join('')).join('');
    const names = [a.author_name || site, ...coIds(a).map((cid) => (get('SELECT display_name FROM users WHERE id=?', cid) || {}).display_name).filter(Boolean)].join('·');
    return `<article><div class="k">${h(a.section)}${a.category ? ' · ' + h(a.category) : ''}</div><h2>${h(a.title)}</h2><div class="meta">${h(names)} 기자 · ${h((a.published_at || a.updated || '').slice(0, 10))}</div>${lead}${body}</article>`;
  };
  return page(200, `${site} ${y}년 ${m}월호`, `<header class="mast"><small>${h(getSetting('kicker', ''))}</small><h1>${h(site)}</h1><small>${y}년 ${m}월호 · 기사 ${arts.length}편</small></header>
${arts.length ? arts.map(art).join('') : '<p class="msg">이 호에는 아직 실린 기사가 없어요.</p>'}
<p class="foot">${h(l.label ? l.label + '님께 보내 드린 ' : '')}이 링크는 ${h(l.expires)}까지 열려요.<br>${h(site)} — 가족이 함께 만드는 신문</p>`);
}

// ───────────────────────── 원고료 포인트 · 쿠폰
// 기사가 처음 신문에 실리면 기자에게 원고료(포인트)를 준다. 모은 포인트로 가족이 정한 쿠폰을 산다.
db.exec(`CREATE TABLE IF NOT EXISTS points (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'manual',
  ref TEXT DEFAULT '', by_id TEXT DEFAULT '', created TEXT NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS points_once ON points(user_id, kind, ref);
CREATE TABLE IF NOT EXISTS coupons (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', price INTEGER NOT NULL, stock INTEGER DEFAULT -1,
  per_user INTEGER DEFAULT 0, icon TEXT DEFAULT '', active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS coupon_issues (id TEXT PRIMARY KEY, coupon_id TEXT NOT NULL, user_id TEXT NOT NULL, title TEXT NOT NULL, price INTEGER NOT NULL,
  code TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'issued', note TEXT DEFAULT '', created TEXT NOT NULL, used_at TEXT DEFAULT '', used_by TEXT DEFAULT '');`);
if (getSetting('coupons_seeded', '') !== '1') { // 처음 한 번만 예시 쿠폰 몇 장 (관리자가 고치거나 지울 수 있음)
  setSetting('coupons_seeded', '1');
  if (!get('SELECT COUNT(*) c FROM coupons').c)
  [['용돈 1,000원', '부모님께 보여 주면 용돈 1,000원으로 바꿔 줘요.', 3000, '💰'], ['게임 30분 더', '하루 게임(영상) 시간을 30분 늘려요.', 2000, '🎮'],
   ['설거지 면제권', '오늘 설거지 당번을 한 번 쉬어요.', 3000, '🍽️'], ['저녁 메뉴 고르기', '이번 주 저녁 메뉴 하나를 내가 정해요.', 4000, '🍕'],
   ['늦잠 자기', '주말 아침 늦잠을 허락받아요.', 5000, '😴']].forEach(([t, d, p, ic], i) =>
    run('INSERT INTO coupons(id,title,description,price,stock,per_user,icon,active,sort,created) VALUES(?,?,?,?,?,?,?,?,?,?)', uid(), t, d, p, -1, 0, ic, 1, i, now()));
}
const CARD_DAILY = 5;
const BONUS_SECTIONS = ['인(人)터뷰', '찰칵! 이 순간']; // 손이 많이 가는 코너는 원고료를 더
// 댓글·오늘의 한마디 포인트 — 하루에 받을 수 있는 횟수 (댓글 5번, 한마디 1번)
const TALK_DAILY = { comment: 5, note: 1 };
function talkPoints(user, kind, ref, reason, cap) {
  const amt = pointRate().talk; if (!amt) return 0;
  if (get('SELECT COUNT(*) c FROM points WHERE user_id=? AND kind=? AND created>=?', user.id, kind, kstDayStart()).c >= cap) return 0;
  return addPoints(user.id, amt, reason, kind, ref) ? amt : 0;
}
const CARD_NAMES = { letter: '편지', birthday: '생일 카드', anniversary: '기념일 카드', christmas: '크리스마스 카드', newyear: '연하장' };
const pointRate = () => ({ bonus: Math.max(0, parseInt(getSetting('points_corner_bonus', '500'), 10) || 0), talk: Math.max(0, parseInt(getSetting('points_talk', '300'), 10) || 0), card: Math.max(0, parseInt(getSetting('points_card', '1000'), 10) || 0), lead: Math.max(0, parseInt(getSetting('points_article', '2000'), 10) || 0), co: Math.max(0, parseInt(getSetting('points_coauthor', '500'), 10) || 0), bday: Math.max(0, parseInt(getSetting('points_birthday', '20000'), 10) || 0) });
const balance = (userId) => get('SELECT COALESCE(SUM(amount),0) s FROM points WHERE user_id=?', userId).s;
function addPoints(userId, amount, reason, kind = 'manual', ref = '', byId = '') {
  if (!userId || !amount) return false;
  try { run('INSERT INTO points(id,user_id,amount,reason,kind,ref,by_id,created) VALUES(?,?,?,?,?,?,?,?)', uid(), userId, amount, str(reason, 120), kind, ref || uid(), byId || '', now()); return true; }
  catch (e) { if (/UNIQUE|duplicate|unique/i.test(e.message)) return false; throw e; }
}
// 기사가 실릴 때 — 같은 기사로는 한 번만 (내렸다 다시 실어도 다시 주지 않음)
function payManuscript(a) {
  const r = pointRate(); const paid = [];
  const lead = a.author_id; const cos = coIds(a).filter((id) => id !== lead);
  const bonus = BONUS_SECTIONS.includes(a.section) ? r.bonus : 0; const leadAmt = r.lead + bonus;
  if (lead && get('SELECT 1 FROM users WHERE id=?', lead) && leadAmt && addPoints(lead, leadAmt, `원고료${bonus ? ` (${a.section} +${bonus.toLocaleString('ko-KR')})` : ''} · ${a.title}`, 'article', a.id)) paid.push([lead, leadAmt]);
  for (const id of cos) if (get('SELECT 1 FROM users WHERE id=?', id) && r.co && addPoints(id, r.co, `원고료(함께 쓴 기사) · ${a.title}`, 'article', a.id)) paid.push([id, r.co]);
  for (const [id, n] of paid) notify([id], { kind: 'points', title: `원고료 ${n.toLocaleString('ko-KR')}포인트가 들어왔어요`, body: a.title, link: '#/points' });
  return paid;
}
const issueOut = (x) => ({ ...x, user_name: (get('SELECT display_name FROM users WHERE id=?', x.user_id) || {}).display_name || '(없는 계정)' });
const couponCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 8; i++) s += A[crypto.randomBytes(1)[0] % A.length]; return s.slice(0, 4) + '-' + s.slice(4); };

route('GET', '/api/points', 'reporter', ({ user, query }) => {
  const admin = isRole(user, 'admin');
  const target = admin && query.user ? query.user : user.id;
  const coupons = all('SELECT * FROM coupons ORDER BY sort, price').filter((c) => admin || c.active).map((c) => ({ ...c,
    issued: get('SELECT COUNT(*) c FROM coupon_issues WHERE coupon_id=? AND status<>?', c.id, 'cancelled').c,
    mine: get('SELECT COUNT(*) c FROM coupon_issues WHERE coupon_id=? AND user_id=? AND status<>?', c.id, user.id, 'cancelled').c }));
  const out = { balance: balance(target), rate: pointRate(), coupons,
    history: all('SELECT id, amount, reason, kind, ref, created FROM points WHERE user_id=? ORDER BY created DESC LIMIT 100', target),
    issues: all('SELECT * FROM coupon_issues WHERE user_id=? ORDER BY created DESC', target),
    earned: get('SELECT COALESCE(SUM(amount),0) s FROM points WHERE user_id=? AND amount>0', target).s };
  if (admin) {
    out.members = all('SELECT id, display_name, role FROM users ORDER BY created').filter((u) => ROLE_RANK[u.role] >= ROLE_RANK.reporter)
      .map((u) => ({ ...u, balance: balance(u.id), articles: get("SELECT COUNT(*) c FROM points WHERE user_id=? AND kind='article'", u.id).c }));
    out.pending = all("SELECT * FROM coupon_issues WHERE status='issued' ORDER BY created").map(issueOut);
    out.recent = all("SELECT * FROM coupon_issues WHERE status<>'issued' ORDER BY COALESCE(NULLIF(used_at,''), created) DESC LIMIT 30").map(issueOut);
    out.birthdays = all('SELECT id, display_name FROM users ORDER BY created').map((u) => { const b = userBirthday(u); return { id: u.id, display_name: u.display_name, title: b ? b.title : '', next: b ? b.next : '', monthly: Math.max(0, parseInt(monthlyConf()[u.id], 10) || 0) }; });
    out.unpaid = all("SELECT * FROM articles WHERE deleted=0 AND status='published' AND author_id IS NOT NULL AND author_id<>''").filter((a) => !get("SELECT 1 FROM points WHERE kind='article' AND ref=? AND user_id=?", a.id, a.author_id)).length;
  }
  return out;
});
// 쿠폰 사기
route('POST', '/api/coupons/:id/buy', 'reporter', ({ user, params }) => {
  const c = get('SELECT * FROM coupons WHERE id=? AND active=1', params.id) || fail(404, '지금은 살 수 없는 쿠폰이에요.');
  if (c.stock >= 0 && get("SELECT COUNT(*) c FROM coupon_issues WHERE coupon_id=? AND status<>'cancelled'", c.id).c >= c.stock) fail(400, '쿠폰이 모두 팔렸어요.');
  if (c.per_user > 0 && get("SELECT COUNT(*) c FROM coupon_issues WHERE coupon_id=? AND user_id=? AND status<>'cancelled'", c.id, user.id).c >= c.per_user) fail(400, `이 쿠폰은 한 사람이 ${c.per_user}장까지 살 수 있어요.`);
  if (balance(user.id) < c.price) fail(400, `포인트가 모자라요. (${(c.price - balance(user.id)).toLocaleString('ko-KR')}포인트 더 필요해요)`);
  const id = uid(); const code = couponCode();
  run('INSERT INTO coupon_issues(id,coupon_id,user_id,title,price,code,status,created) VALUES(?,?,?,?,?,?,?,?)', id, c.id, user.id, c.title, c.price, code, 'issued', now());
  addPoints(user.id, -c.price, `쿠폰 구입 · ${c.title}`, 'coupon', id);
  notify(usersWith('admin', user.id), { kind: 'coupon', title: `쿠폰 구입 · ${c.title}`, body: `${user.display_name}님이 쿠폰을 샀어요. 사용할 때 ‘사용 완료’를 눌러 주세요.`, link: '#/points/manage' });
  return { ok: true, issue: get('SELECT * FROM coupon_issues WHERE id=?', id), balance: balance(user.id) };
});
// 쿠폰 쓰기(관리자가 확인) · 취소(포인트 돌려줌)
route('POST', '/api/coupon-issues/:id', 'reporter', ({ user, params, body }) => {
  const x = get('SELECT * FROM coupon_issues WHERE id=?', params.id) || fail(404, '쿠폰을 찾을 수 없어요.');
  const admin = isRole(user, 'admin');
  if (x.status !== 'issued') fail(400, '이미 사용했거나 취소한 쿠폰이에요.');
  if (body.action === 'use') {
    if (!admin) fail(403, '쿠폰 사용은 관리자(부모님)가 확인해 줘요.');
    run("UPDATE coupon_issues SET status='used', used_at=?, used_by=?, note=? WHERE id=?", now(), user.id, str(body.note, 200), x.id);
    notify([x.user_id], { kind: 'coupon', title: `쿠폰을 사용했어요 · ${x.title}`, body: `${user.display_name}님이 사용 완료로 표시했어요.`, link: '#/points' });
  } else if (body.action === 'cancel') {
    if (!admin && x.user_id !== user.id) fail(403, '권한이 없어요.');
    run("UPDATE coupon_issues SET status='cancelled', used_at=?, used_by=?, note=? WHERE id=?", now(), user.id, str(body.note, 200), x.id);
    addPoints(x.user_id, x.price, `쿠폰 취소 환불 · ${x.title}`, 'refund', x.id, user.id);
    if (x.user_id !== user.id) notify([x.user_id], { kind: 'coupon', title: `쿠폰이 취소되고 포인트를 돌려받았어요 · ${x.title}`, body: `${x.price.toLocaleString('ko-KR')}포인트`, link: '#/points' });
  } else fail(400, '알 수 없는 요청이에요.');
  return { ok: true };
});
// 관리자: 쿠폰 만들기·고치기·지우기
const couponBody = (b) => [str(b.title, 40) || fail(400, '쿠폰 이름을 적어 주세요.'), str(b.description, 200), Math.max(0, Math.min(1e7, parseInt(b.price, 10) || 0)),
  b.stock === '' || b.stock == null ? -1 : Math.max(-1, parseInt(b.stock, 10)), Math.max(0, parseInt(b.per_user, 10) || 0), str(b.icon, 8), b.active === false || b.active === 0 || b.active === '0' ? 0 : 1];
route('POST', '/api/coupons', 'admin', ({ body }) => {
  const [t, d, p, st, pu, ic, ac] = couponBody(body); if (!p) fail(400, '쿠폰 가격(포인트)을 적어 주세요.');
  const id = uid(); run('INSERT INTO coupons(id,title,description,price,stock,per_user,icon,active,sort,created) VALUES(?,?,?,?,?,?,?,?,?,?)', id, t, d, p, st, pu, ic, ac, get('SELECT COUNT(*) c FROM coupons').c, now());
  return { ok: true, id };
});
route('PUT', '/api/coupons/:id', 'admin', ({ body, params }) => {
  get('SELECT 1 FROM coupons WHERE id=?', params.id) || fail(404, '쿠폰을 찾을 수 없어요.');
  const [t, d, p, st, pu, ic, ac] = couponBody(body); if (!p) fail(400, '쿠폰 가격(포인트)을 적어 주세요.');
  run('UPDATE coupons SET title=?, description=?, price=?, stock=?, per_user=?, icon=?, active=? WHERE id=?', t, d, p, st, pu, ic, ac, params.id);
  return { ok: true };
});
route('DELETE', '/api/coupons/:id', 'admin', ({ params }) => {
  if (get('SELECT 1 FROM coupon_issues WHERE coupon_id=?', params.id)) { run('UPDATE coupons SET active=0 WHERE id=?', params.id); return { ok: true, message: '이미 산 사람이 있어 지우지 않고 판매만 멈췄어요.' }; }
  run('DELETE FROM coupons WHERE id=?', params.id); return { ok: true, message: '쿠폰을 지웠어요.' };
});
// 관리자: 포인트 직접 주기·빼기, 원고료 금액, 지난 기사 원고료 한꺼번에
route('POST', '/api/points/grant', 'admin', ({ body, user }) => {
  const to = get('SELECT id, display_name FROM users WHERE id=?', body.user_id) || fail(404, '가족 계정을 찾을 수 없어요.');
  const n = parseInt(body.amount, 10); if (!n || Math.abs(n) > 1e7) fail(400, '포인트를 적어 주세요. (빼려면 앞에 - 를 붙여요)');
  if (n < 0 && balance(to.id) + n < 0) fail(400, `${to.display_name}님의 포인트(${balance(to.id).toLocaleString('ko-KR')})보다 많이 뺄 수 없어요.`);
  addPoints(to.id, n, str(body.reason, 80) || (n > 0 ? '보너스' : '포인트 조정'), n > 0 ? 'bonus' : 'adjust', '', user.id);
  if (n > 0) notify([to.id], { kind: 'points', title: `${n.toLocaleString('ko-KR')}포인트를 받았어요`, body: str(body.reason, 80) || '보너스', link: '#/points' });
  return { ok: true, balance: balance(to.id) };
});
route('PUT', '/api/points/rate', 'admin', ({ body }) => {
  setSetting('points_article', Math.max(0, Math.min(1e6, parseInt(body.lead, 10) || 0)));
  setSetting('points_coauthor', Math.max(0, Math.min(1e6, parseInt(body.co, 10) || 0)));
  if (body.bday !== undefined) setSetting('points_birthday', Math.max(0, Math.min(1e6, parseInt(body.bday, 10) || 0)));
  if (body.card !== undefined) setSetting('points_card', Math.max(0, Math.min(1e6, parseInt(body.card, 10) || 0)));
  if (body.talk !== undefined) setSetting('points_talk', Math.max(0, Math.min(1e6, parseInt(body.talk, 10) || 0)));
  if (body.bonus !== undefined) setSetting('points_corner_bonus', Math.max(0, Math.min(1e6, parseInt(body.bonus, 10) || 0)));
  return { ok: true, rate: pointRate() };
});
route('POST', '/api/points/backpay', 'admin', () => {
  let n = 0, sum = 0;
  for (const a of all("SELECT * FROM articles WHERE deleted=0 AND status='published' ORDER BY published_at")) for (const [, amt] of payManuscript(a)) { n++; sum += amt; }
  return { ok: true, message: n ? `지난 기사 원고료 ${n}건, 모두 ${sum.toLocaleString('ko-KR')}포인트를 줬어요.` : '줄 원고료가 없어요. (이미 모두 받았어요)' };
});

// 기본 포인트 — 가족 계정마다 2,000P를 한 번만 (김신중 계정은 빼요, 2026-11-06)
const BASE_POINTS = 2000;
const baseSkip = (u) => /김신중/.test(u.display_name || '') || String(u.display_name || '').trim() === '아빠' || /^zeus5328@/i.test(u.username || '');
function giveBasePoints(u) { return !!u && !baseSkip(u) && addPoints(u.id, BASE_POINTS, '기본 포인트', 'base', 'base-2026-11'); }
for (const u of all('SELECT id, username, display_name FROM users')) giveBasePoints(u);

// 생일 포인트 — 가족 계정 이름이 들어간 생일 일정(예: ‘엄마 생일(김은지)’)을 찾아, 그날(한국 시간) 한 번 준다
const BDAY_START = '2026-11-06'; // 이 날부터 돌아오는 생일에만 (지난 생일은 소급하지 않아요)
function userBirthday(u) {
  const name = String(u.display_name || '').replace(/\s+/g, ''); if (name.length < 2) return null;
  const hits = all("SELECT * FROM events WHERE deleted=0 AND kind='birthday'").filter((x) => String(x.title).replace(/\s+/g, '').includes(name));
  const e = hits.find((x) => !/친구/.test(x.title)) || hits[0];
  if (!e) return null;
  const today = kstToday(), y = +today.slice(0, 4);
  const dates = [y - 1, y, y + 1].flatMap((yy) => occurrencesForYear(yy).filter((o) => o.id === e.id).map((o) => o.date));
  return { id: e.id, title: e.title, dates, next: dates.filter((d) => d >= today).sort()[0] || '' };
}
function birthdayPoints(user) {
  const amt = pointRate().bday; if (!amt || !user) return;
  const b = userBirthday(user); if (!b) return;
  const today = kstToday();
  // 오늘이 생일이거나, 생일 뒤 30일 안에 처음 들어왔을 때 (그 해 한 번)
  const d = b.dates.filter((x) => x <= today && x >= BDAY_START && Date.parse(today) - Date.parse(x) <= 30 * 864e5).sort().pop();
  if (!d) return;
  if (addPoints(user.id, amt, `생일 축하 포인트 (${d.slice(0, 4)})`, 'birthday', 'bday-' + d))
    notify([user.id], { kind: 'points', title: `생일 축하해요! +${amt.toLocaleString('ko-KR')}포인트`, body: '유니 타임즈가 드리는 생일 선물이에요. 원고료 · 쿠폰에서 써 보세요.', link: '#/points', ukey: 'bday-points:' + d });
}

// 매달 포인트 — 정해 둔 가족에게 달마다 한 번 (그 달에 처음 들어올 때)
const monthlyConf = () => { try { const o = JSON.parse(getSetting('monthly_points', '{}')); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
if (getSetting('monthly_seeded', '') !== '1') {
  const eun = all('SELECT id, display_name FROM users').find((u) => String(u.display_name).replace(/\s+/g, '') === '김은지');
  if (eun) { setSetting('monthly_points', JSON.stringify({ ...monthlyConf(), [eun.id]: 50000 })); setSetting('monthly_seeded', '1'); }
}
function monthlyPoints(user) {
  const amt = Math.max(0, parseInt(monthlyConf()[user && user.id], 10) || 0); if (!amt) return;
  const ym = kstToday().slice(0, 7);
  if (addPoints(user.id, amt, `${+ym.slice(5)}월 포인트`, 'monthly', 'monthly-' + ym))
    notify([user.id], { kind: 'points', title: `${+ym.slice(5)}월 포인트 +${amt.toLocaleString('ko-KR')}P`, body: '이번 달 포인트가 들어왔어요. 원고료 · 쿠폰에서 써 보세요.', link: '#/points', ukey: 'monthly:' + ym });
}
route('PUT', '/api/points/monthly', 'admin', ({ body }) => {
  const u = get('SELECT id FROM users WHERE id=?', body.user_id) || fail(404, '계정을 찾을 수 없어요.');
  const amt = Math.max(0, Math.min(1e7, parseInt(body.amount, 10) || 0));
  const c = monthlyConf(); if (amt) c[u.id] = amt; else delete c[u.id];
  setSetting('monthly_points', JSON.stringify(c)); setSetting('monthly_seeded', '1');
  pointsChecked.delete(u.id); // 바로 다시 확인하게
  return { ok: true, monthly: c };
});

// 분류 이름 바꾸기 — 한 번만 (병원 → 건강, 동물 → 반려동물)
if (getSetting('sections_v2', '') !== '1') { // 포토제닉 → 찰칵! 이 순간
  for (const [from, to] of Object.entries(SECTION_RENAME)) run('UPDATE articles SET section=? WHERE section=?', to, from);
  setSetting('sections_v2', '1');
}
if (getSetting('categories_v2', '') !== '1') {
  for (const [from, to] of Object.entries(CATEGORY_RENAME)) run('UPDATE articles SET category=? WHERE category=?', to, from);
  setSetting('categories_v2', '1');
}

// 장소 검색 (카카오 로컬) — 키는 secrets 표에만 (백업·화면에 나가지 않음). 키가 없으면 화면이 오픈스트리트맵으로 찾는다
db.exec('CREATE TABLE IF NOT EXISTS secrets (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
const kakaoKey = () => process.env.KAKAO_REST_KEY || (get('SELECT value FROM secrets WHERE key=?', 'kakao_rest_key') || {}).value || '';
route('GET', '/api/places/status', 'reporter', () => ({ kakao: !!kakaoKey(), from_env: !!process.env.KAKAO_REST_KEY }));
route('PUT', '/api/places/key', 'admin', async ({ body }) => {
  const k = String(body.key || '').trim();
  if (!k) { run("DELETE FROM secrets WHERE key='kakao_rest_key'"); return { ok: true, kakao: !!kakaoKey() }; }
  if (!/^[A-Za-z0-9]{20,64}$/.test(k)) fail(400, 'REST API 키 모양이 아니에요. 카카오 개발자 사이트의 [앱 키] › REST API 키를 그대로 붙여 넣어 주세요.');
  const t = await kakaoSearch('서울역', null, k).catch((e) => ({ error: e.message })); // 저장 전에 한 번 써 보기
  if (t.error) fail(400, '카카오에서 키를 받아 주지 않았어요: ' + t.error);
  run('INSERT INTO secrets(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', 'kakao_rest_key', k);
  return { ok: true, kakao: true };
});
async function kakaoSearch(q, near, key = kakaoKey()) {
  const u = new URL('https://dapi.kakao.com/v2/local/search/keyword.json'); u.searchParams.set('query', q); u.searchParams.set('size', '10');
  if (near && isFinite(near.lat) && isFinite(near.lng)) { u.searchParams.set('y', String(near.lat)); u.searchParams.set('x', String(near.lng)); }
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(u, { headers: { Authorization: 'KakaoAK ' + key }, signal: ctl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 401 ? '키가 맞지 않아요' : r.status === 403 ? '앱에서 카카오맵 사용 설정을 켜 주세요' : r.status === 429 ? '오늘 쓸 수 있는 검색 횟수를 다 썼어요' : (j.message || '오류 ' + r.status));
    return { places: (j.documents || []).map((d) => ({ name: d.place_name, address: d.road_address_name || d.address_name || '', category: (d.category_name || '').split('>').pop().trim(), lat: Number(d.y), lng: Number(d.x) })).filter((p) => isFinite(p.lat) && isFinite(p.lng)) };
  } finally { clearTimeout(timer); }
}
route('GET', '/api/places/search', 'reporter', async ({ query }) => {
  const q = str(query.q, 60); if (!q) fail(400, '찾을 장소 이름을 적어 주세요.');
  if (!kakaoKey()) return { provider: 'none', places: [] };
  try { return { provider: 'kakao', ...(await kakaoSearch(q, query.lat ? { lat: Number(query.lat), lng: Number(query.lng) } : null)) }; }
  catch (e) { return { provider: 'kakao', places: [], error: e.name === 'AbortError' ? '카카오 검색이 너무 늦어요' : e.message }; }
});

// 페이스타임 — 가족마다 연락처(전화번호·애플 ID 이메일)와 가족 영상통화방 링크. 로그인한 가족에게만 보여 준다
function ftContact(v) {
  const t = String(v || '').trim(); if (!t) return '';
  if (/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(t)) return t.slice(0, 120);
  const d = t.replace(/[\s\-().]/g, ''); if (/^\+?\d{8,15}$/.test(d)) return d;
  return null;
}
const ftRoom = () => (get('SELECT value FROM secrets WHERE key=?', 'facetime_room') || {}).value || '';
route('GET', '/api/facetime', 'subscriber', () => ({
  room: ftRoom(), room_note: (get('SELECT value FROM secrets WHERE key=?', 'facetime_room_note') || {}).value || '',
  contacts: Object.fromEntries(all("SELECT name, facetime FROM people WHERE facetime IS NOT NULL AND facetime <> ''").map((r) => [r.name, r.facetime])),
}));
route('PUT', '/api/facetime/room', 'editor', ({ body }) => {
  const url = String(body.url || '').trim(); const note = str(body.note, 60);
  if (url && !/^https:\/\/facetime\.apple\.com\/join#\S{5,300}$/.test(url)) fail(400, '페이스타임 앱의 ‘링크 공유’로 만든 https://facetime.apple.com/join#… 주소를 그대로 붙여 넣어 주세요.');
  for (const [k, v] of [['facetime_room', url], ['facetime_room_note', note]]) {
    if (v) run('INSERT INTO secrets(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, v); else run('DELETE FROM secrets WHERE key=?', k);
  }
  return { ok: true, room: ftRoom() };
});

// ───────────────────────── 착한 일 — 아이가 한 일을 올리면 부모님(시니어기자 이상)이 확인하고 포인트를 준다
db.exec(`CREATE TABLE IF NOT EXISTS deed_menu (id TEXT PRIMARY KEY, title TEXT NOT NULL, points INTEGER NOT NULL, icon TEXT DEFAULT '', active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS good_deeds (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, menu_id TEXT DEFAULT '', title TEXT NOT NULL, note TEXT DEFAULT '', photo TEXT DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', created TEXT NOT NULL, reviewed_at TEXT DEFAULT '', reviewed_by TEXT DEFAULT '', review_note TEXT DEFAULT '');
CREATE INDEX IF NOT EXISTS good_deeds_status ON good_deeds(status);`);
if (getSetting('deeds_seeded', '') !== '1') {
  setSetting('deeds_seeded', '1');
  if (!get('SELECT COUNT(*) c FROM deed_menu').c)
    [['🍽️', '설거지 돕기', 500], ['🧹', '내 방 청소', 300], ['👕', '빨래 개기', 300], ['♻️', '분리수거', 300], ['📚', '숙제 먼저 하기', 300],
     ['🛒', '심부름', 500], ['🤝', '동생·친구 돕기', 300], ['💌', '감사 인사 전하기', 200]].forEach(([ic, t, pt], i) =>
      run('INSERT INTO deed_menu(id,title,points,icon,active,sort,created) VALUES(?,?,?,?,?,?,?)', uid(), t, pt, ic, 1, i, now()));
}
const DEED_DAILY = 10; // 하루에 올릴 수 있는 착한 일 수
const deedOut = (x) => ({ ...x, user_name: (get('SELECT display_name FROM users WHERE id=?', x.user_id) || {}).display_name || '(없는 계정)',
  reviewer_name: x.reviewed_by ? (get('SELECT display_name FROM users WHERE id=?', x.reviewed_by) || {}).display_name || '' : '' });
route('GET', '/api/deeds', 'reporter', ({ user }) => {
  const approver = isRole(user, 'senior');
  const out = { menu: all('SELECT * FROM deed_menu ORDER BY sort, created').filter((m) => m.active || isRole(user, 'admin')), approver, admin: isRole(user, 'admin'),
    mine: all('SELECT * FROM good_deeds WHERE user_id=? ORDER BY created DESC LIMIT 60', user.id).map(deedOut),
    today: get('SELECT COUNT(*) c FROM good_deeds WHERE user_id=? AND created>=?', user.id, kstDayStart()).c, daily: DEED_DAILY,
    earned: get("SELECT COALESCE(SUM(points),0) s FROM good_deeds WHERE user_id=? AND status='approved'", user.id).s };
  if (approver) {
    out.pending = all("SELECT * FROM good_deeds WHERE status='pending' ORDER BY created").filter((x) => x.user_id !== user.id || isRole(user, 'admin')).map(deedOut);
    out.recent = all("SELECT * FROM good_deeds WHERE status<>'pending' ORDER BY reviewed_at DESC LIMIT 30").map(deedOut);
  }
  return out;
});
route('POST', '/api/deeds', 'reporter', ({ user, body }) => {
  if (get('SELECT COUNT(*) c FROM good_deeds WHERE user_id=? AND created>=?', user.id, kstDayStart()).c >= DEED_DAILY) fail(400, `착한 일은 하루 ${DEED_DAILY}개까지 올릴 수 있어요.`);
  let title = str(body.title, 40), points = 0, menuId = '';
  if (body.menu_id) { const m = get('SELECT * FROM deed_menu WHERE id=? AND active=1', body.menu_id) || fail(404, '목록에 없는 착한 일이에요.'); title = m.title; points = m.points; menuId = m.id; }
  if (!title) fail(400, '어떤 착한 일을 했는지 적어 주세요.');
  const photo = body.photo && get('SELECT id FROM photos WHERE id=?', body.photo) ? body.photo : '';
  const id = uid();
  run('INSERT INTO good_deeds(id,user_id,menu_id,title,note,photo,points,status,created) VALUES(?,?,?,?,?,?,?,?,?)', id, user.id, menuId, title, str(body.note, 300), photo, points, 'pending', now());
  notify(usersWith('senior', user.id), { kind: 'deed', title: `착한 일 확인 · ${user.display_name}`, body: `${title}${body.note ? ' — ' + str(body.note, 60) : ''}`, link: '#/deeds' });
  return { ok: true, id };
});
route('DELETE', '/api/deeds/:id', 'reporter', ({ user, params }) => {
  const x = get('SELECT * FROM good_deeds WHERE id=?', params.id) || fail(404, '기록을 찾을 수 없어요.');
  if (x.user_id !== user.id || x.status !== 'pending') fail(403, '확인 전인 내 기록만 지울 수 있어요.');
  run('DELETE FROM good_deeds WHERE id=?', x.id); return { ok: true };
});
route('PUT', '/api/deeds/:id', 'reporter', ({ user, params, body }) => {
  const x = get('SELECT * FROM good_deeds WHERE id=?', params.id) || fail(404, '기록을 찾을 수 없어요.');
  if (!(x.user_id === user.id && x.status === 'pending') && !isRole(user, 'admin')) fail(403, '확인 전인 내 착한 일만 고칠 수 있어요.');
  const title = x.menu_id ? x.title : (str(body.title, 40) || fail(400, '어떤 착한 일을 했는지 적어 주세요.'));
  const photo = body.photo === '' ? '' : body.photo && get('SELECT id FROM photos WHERE id=?', body.photo) ? body.photo : x.photo;
  run('UPDATE good_deeds SET title=?, note=?, photo=? WHERE id=?', title, str(body.note, 300), photo, x.id);
  return { ok: true };
});
route('POST', '/api/deeds/:id/review', 'senior', ({ user, params, body }) => {
  const x = get('SELECT * FROM good_deeds WHERE id=?', params.id) || fail(404, '기록을 찾을 수 없어요.');
  if (x.status !== 'pending') fail(400, '이미 확인한 착한 일이에요.');
  if (x.user_id === user.id && !isRole(user, 'admin')) fail(403, '내 착한 일은 다른 가족이 확인해 줘요.');
  if (body.action === 'approve') {
    const pts = Math.max(0, Math.min(100000, parseInt(body.points, 10) || 0));
    if (!pts) fail(400, '줄 포인트를 적어 주세요.');
    if (!run("UPDATE good_deeds SET status='approved', points=?, reviewed_at=?, reviewed_by=?, review_note=? WHERE id=? AND status='pending'", pts, now(), user.id, str(body.note, 200), x.id).changes) fail(400, '이미 확인한 착한 일이에요.');
    addPoints(x.user_id, pts, `착한 일 · ${x.title}`, 'deed', x.id, user.id);
    notify([x.user_id], { kind: 'points', title: `착한 일 확인! +${pts.toLocaleString('ko-KR')}포인트`, body: `${x.title}${body.note ? ' — ' + str(body.note, 80) : ''} (${user.display_name})`, link: '#/deeds' });
  } else if (body.action === 'reject') {
    run("UPDATE good_deeds SET status='rejected', reviewed_at=?, reviewed_by=?, review_note=? WHERE id=? AND status='pending'", now(), user.id, str(body.note, 200), x.id);
    notify([x.user_id], { kind: 'deed', title: `착한 일 다시 확인해요 · ${x.title}`, body: str(body.note, 120) || `${user.display_name}님이 아직 확인해 주지 않았어요.`, link: '#/deeds' });
  } else fail(400, '알 수 없는 요청이에요.');
  return { ok: true };
});
const deedBody = (b) => [str(b.title, 30) || fail(400, '착한 일 이름을 적어 주세요.'), Math.max(1, Math.min(100000, parseInt(b.points, 10) || 0)) || fail(400, '포인트를 적어 주세요.'), str(b.icon, 8), b.active === false || b.active === '0' ? 0 : 1];
route('POST', '/api/deed-menu', 'admin', ({ body }) => { const [t, p, ic, ac] = deedBody(body); run('INSERT INTO deed_menu(id,title,points,icon,active,sort,created) VALUES(?,?,?,?,?,?,?)', uid(), t, p, ic, ac, get('SELECT COUNT(*) c FROM deed_menu').c, now()); return { ok: true }; });
route('PUT', '/api/deed-menu/:id', 'admin', ({ body, params }) => { const [t, p, ic, ac] = deedBody(body); run('UPDATE deed_menu SET title=?, points=?, icon=?, active=? WHERE id=?', t, p, ic, ac, params.id); return { ok: true }; });
route('DELETE', '/api/deed-menu/:id', 'admin', ({ params }) => { run('DELETE FROM deed_menu WHERE id=?', params.id); return { ok: true }; });

// ───────────────────────── 오락실: 주간 로또 · 즉석복권 (원고료 포인트로)
db.exec(`CREATE TABLE IF NOT EXISTS lotto_tickets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, round INTEGER NOT NULL, numbers TEXT NOT NULL, auto INTEGER DEFAULT 0,
  price INTEGER NOT NULL, rank INTEGER DEFAULT 0, prize INTEGER DEFAULT 0, settled INTEGER DEFAULT 0, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS lotto_round ON lotto_tickets(round);
CREATE TABLE IF NOT EXISTS lotto_draws (round INTEGER PRIMARY KEY, numbers TEXT NOT NULL, bonus INTEGER NOT NULL, drawn_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS scratch_tickets (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, price INTEGER NOT NULL, prize INTEGER NOT NULL, symbols TEXT NOT NULL,
  scratched INTEGER DEFAULT 0, created TEXT NOT NULL);`);
// 1회 추첨 = 2026-10-31(토) 저녁 8시(한국 시각). 그 뒤로 매주 토요일 저녁 8시
const LOTTO_BASE = Date.parse('2026-10-31T11:00:00Z'), WEEK = 7 * 864e5;
const drawTime = (r) => LOTTO_BASE + (r - 1) * WEEK;
const openRound = (t = Date.now()) => Math.max(1, Math.floor((t - LOTTO_BASE) / WEEK) + 2);
const gameNum = (k, d) => Math.max(0, parseInt(getSetting(k, String(d)), 10) || 0);
const lottoConf = () => ({ price: gameNum('lotto_price', 500), max: gameNum('lotto_max', 5),
  prizes: [0, gameNum('lotto_p1', 100000), gameNum('lotto_p2', 30000), gameNum('lotto_p3', 10000), gameNum('lotto_p4', 3000), gameNum('lotto_p5', 1000)] });
const SCRATCH = [['💎', 100], ['🍀', 10], ['⭐', 3], ['🍬', 1]]; // 그림, 가격의 몇 배
const scratchConf = () => ({ price: gameNum('scratch_price', 300), daily: gameNum('scratch_daily', 5) });
// 오늘(한국 시각) 0시를 ISO로 — 하루 몇 장 셀 때
const kstDayStart = () => { const d = new Date(Date.now() + 9 * 3600e3); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - 9 * 3600e3).toISOString(); };
const rnd = (n) => crypto.randomBytes(4).readUInt32BE(0) % n;
function pickNumbers() { const s = new Set(); while (s.size < 6) s.add(rnd(45) + 1); return [...s].sort((a, b) => a - b); }
const nums = (t) => String(t || '').split(',').map(Number).filter(Boolean);
// 추첨 시간이 지난 회차를 뽑고 당첨금을 준다 (따로 예약 작업 없이, 누가 열어 볼 때)
function settleLotto() {
  const rounds = all('SELECT DISTINCT round FROM lotto_tickets WHERE settled=0').map((r) => r.round).filter((r) => drawTime(r) <= Date.now());
  const conf = lottoConf();
  for (const r of rounds) {
    let d = get('SELECT * FROM lotto_draws WHERE round=?', r);
    if (!d) {
      const main = pickNumbers(); let bonus; do bonus = rnd(45) + 1; while (main.includes(bonus));
      run('INSERT OR IGNORE INTO lotto_draws(round,numbers,bonus,drawn_at) VALUES(?,?,?,?)', r, main.join(','), bonus, new Date(drawTime(r)).toISOString());
      d = get('SELECT * FROM lotto_draws WHERE round=?', r);
    }
    const win = nums(d.numbers);
    for (const t of all('SELECT * FROM lotto_tickets WHERE round=? AND settled=0', r)) {
      const mine = nums(t.numbers); const hit = mine.filter((n) => win.includes(n)).length; const bonusHit = mine.includes(d.bonus);
      const rank = hit === 6 ? 1 : hit === 5 && bonusHit ? 2 : hit === 5 ? 3 : hit === 4 ? 4 : hit === 3 ? 5 : 0;
      const prize = rank ? conf.prizes[rank] : 0;
      if (run('UPDATE lotto_tickets SET settled=1, rank=?, prize=? WHERE id=? AND settled=0', rank, prize, t.id).changes && prize) {
        addPoints(t.user_id, prize, `로또복권 ${r}회 ${rank}등 당첨`, 'lotto_win', t.id);
        notify([t.user_id], { kind: 'points', title: `로또복권 ${r}회 ${rank}등 당첨! ${prize.toLocaleString('ko-KR')}포인트`, body: `당첨 번호 ${win.join(' ')} + ${d.bonus}`, link: '#/games/lotto' });
      }
    }
  }
}
route('GET', '/api/games/lotto', 'reporter', ({ user }) => {
  settleLotto();
  const r = openRound(); const conf = lottoConf();
  const last = get('SELECT * FROM lotto_draws ORDER BY round DESC LIMIT 1');
  const mine = all('SELECT * FROM lotto_tickets WHERE user_id=? ORDER BY round DESC, created DESC LIMIT 60', user.id);
  const draws = {}; for (const d of all('SELECT * FROM lotto_draws ORDER BY round DESC LIMIT 12')) draws[d.round] = { numbers: nums(d.numbers), bonus: d.bonus };
  return { round: r, draw_at: new Date(drawTime(r)).toISOString(), conf, balance: balance(user.id),
    bought: mine.filter((t) => t.round === r).length, last: last ? { round: last.round, numbers: nums(last.numbers), bonus: last.bonus, drawn_at: last.drawn_at,
      winners: all('SELECT rank, COUNT(*) c FROM lotto_tickets WHERE round=? AND rank>0 GROUP BY rank ORDER BY rank', last.round) } : null,
    tickets: mine.map((t) => ({ ...t, numbers: nums(t.numbers), draw: draws[t.round] || null })), draws };
});
route('POST', '/api/games/lotto', 'reporter', ({ user, body }) => {
  const r = openRound(); const conf = lottoConf();
  if (!conf.price) fail(400, '지금은 로또복권을 팔지 않아요.');
  const sets = (Array.isArray(body.sets) ? body.sets : [body.numbers]).slice(0, 5);
  if (!sets.length) fail(400, '번호를 골라 주세요.');
  const have = get('SELECT COUNT(*) c FROM lotto_tickets WHERE user_id=? AND round=?', user.id, r).c;
  if (conf.max && have + sets.length > conf.max) fail(400, `한 회에 ${conf.max}장까지 살 수 있어요. (이번 회 ${have}장 샀어요)`);
  const cost = conf.price * sets.length;
  if (balance(user.id) < cost) fail(400, `포인트가 모자라요. (${cost.toLocaleString('ko-KR')}포인트 필요)`);
  const out = [];
  for (const raw of sets) {
    const auto = !raw || raw === 'auto';
    const n = auto ? pickNumbers() : [...new Set((Array.isArray(raw) ? raw : []).map(Number))].filter((x) => Number.isInteger(x) && x >= 1 && x <= 45).sort((a, b) => a - b);
    if (n.length !== 6) fail(400, '1부터 45까지 서로 다른 번호 6개를 골라 주세요.');
    const id = uid();
    run('INSERT INTO lotto_tickets(id,user_id,round,numbers,auto,price,created) VALUES(?,?,?,?,?,?,?)', id, user.id, r, n.join(','), auto ? 1 : 0, conf.price, now());
    addPoints(user.id, -conf.price, `로또복권 ${r}회 구입`, 'lotto_buy', id);
    out.push({ id, numbers: n, auto });
  }
  return { ok: true, round: r, tickets: out, balance: balance(user.id) };
});
route('GET', '/api/games/scratch', 'reporter', ({ user }) => {
  const c = scratchConf();
  return { conf: c, table: SCRATCH.map(([s, x]) => ({ symbol: s, prize: x * c.price })), balance: balance(user.id),
    today: all('SELECT COUNT(*) c FROM scratch_tickets WHERE user_id=? AND created>=?', user.id, kstDayStart())[0].c,
    tickets: all('SELECT * FROM scratch_tickets WHERE user_id=? ORDER BY created DESC LIMIT 20', user.id).map((t) => ({ ...t, symbols: t.scratched ? t.symbols.split(',') : null })) };
});
route('POST', '/api/games/scratch', 'reporter', ({ user }) => {
  const c = scratchConf(); if (!c.price) fail(400, '지금은 즉석복권을 팔지 않아요.');
  const n = get('SELECT COUNT(*) c FROM scratch_tickets WHERE user_id=? AND created>=?', user.id, kstDayStart()).c;
  if (c.daily && n >= c.daily) fail(400, `즉석복권은 하루 ${c.daily}장까지예요. 내일 또 해요!`);
  if (balance(user.id) < c.price) fail(400, `포인트가 모자라요. (${c.price.toLocaleString('ko-KR')}포인트 필요)`);
  // 당첨 확률: 💎 1/1000 · 🍀 1/100 · ⭐ 1/20 · 🍬(본전) 1/5
  const roll = rnd(1000); const tier = roll < 1 ? 0 : roll < 11 ? 1 : roll < 61 ? 2 : roll < 261 ? 3 : -1;
  let symbols;
  if (tier >= 0) symbols = [SCRATCH[tier][0], SCRATCH[tier][0], SCRATCH[tier][0]];
  else { do symbols = [0, 1, 2].map(() => SCRATCH[rnd(4)][0]); while (symbols[0] === symbols[1] && symbols[1] === symbols[2]); }
  const prize = tier >= 0 ? SCRATCH[tier][1] * c.price : 0; const id = uid();
  run('INSERT INTO scratch_tickets(id,user_id,price,prize,symbols,created) VALUES(?,?,?,?,?,?)', id, user.id, c.price, prize, symbols.join(','), now());
  addPoints(user.id, -c.price, '즉석복권 구입', 'scratch_buy', id);
  return { ok: true, id, balance: balance(user.id) };
});
// 긁기 끝 — 결과를 보여 주고 당첨금을 준다
route('POST', '/api/games/scratch/:id', 'reporter', ({ user, params }) => {
  const t = get('SELECT * FROM scratch_tickets WHERE id=? AND user_id=?', params.id, user.id) || fail(404, '복권을 찾을 수 없어요.');
  if (run('UPDATE scratch_tickets SET scratched=1 WHERE id=? AND scratched=0', t.id).changes && t.prize) addPoints(user.id, t.prize, '즉석복권 당첨', 'scratch_win', t.id);
  return { symbols: t.symbols.split(','), prize: t.prize, balance: balance(user.id) };
});
route('PUT', '/api/games/conf', 'admin', ({ body }) => {
  for (const k of ['lotto_price', 'lotto_max', 'lotto_p1', 'lotto_p2', 'lotto_p3', 'lotto_p4', 'lotto_p5', 'scratch_price', 'scratch_daily'])
    if (k in body) setSetting(k, Math.max(0, Math.min(1e7, parseInt(body[k], 10) || 0)));
  return { ok: true, lotto: lottoConf(), scratch: scratchConf() };
});

async function handle(req, res) {
  // 기본 보안 헤더 — HTTPS(프록시 뒤 포함)로 접속하면 로그인 쿠키에 Secure도 붙인다
  res.__secure = req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Referrer-Policy', 'same-origin');
  if (res.__secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
  const url = new URL(req.url, 'http://local');
  const ae = String(req.headers['accept-encoding'] || ''); res.__enc = /\bbr\b/.test(ae) ? 'br' : /\bgzip\b/.test(ae) ? 'gzip' : '';
  if (url.pathname === '/api/calendar.ics') {
    if (membersOnly() && !currentUser(req)) { res.writeHead(401, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('가족 계정으로 로그인해야 받을 수 있어요.'); }
    try { const body = calendarIcs(); res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="unitimes.ics"', 'Cache-Control': 'no-store' }); return res.end(body); }
    catch (e) { console.error(e); res.writeHead(500); return res.end(); }
  }
  const p = decodeURI(url.pathname);
  try {
    // 카카오톡·문자 공유용 기사 주소: /a/기사ID → 미리보기 카드(제목·사진) 정보를 담은 뒤 기사로 이동
    if (/^\/i\/[\w-]{10,40}(\/[ps]\/[\w-]{8,60})?$/.test(p)) return sharedIssue(req, res, p.slice(3));
    if (/^\/a\/[\w-]{8,60}$/.test(p)) return sharePage(req, res, p.slice(3));
    if (p.startsWith('/api/audio/')) {
      if (membersOnly() && !currentUser(req)) { res.writeHead(401); return res.end(); }
      return serveAudio(req, res, p.slice('/api/audio/'.length));
    }
    if (p.startsWith('/api/photo/')) {
      const id = p.slice('/api/photo/'.length);
      const ph = get('SELECT * FROM photos WHERE id=?', id);
      if (!ph) { res.writeHead(404); return res.end(); }
      if (ph.kind === 'studio') { const u = currentUser(req); if (!isRole(u, 'admin')) { res.writeHead(403); return res.end(); } }
      if (membersOnly() && ph.kind !== 'logo' && !currentUser(req)) { res.writeHead(401); return res.end(); }
      const small = url.searchParams.get('s') === 't' && ph.thumb;
      if (store.cloud && url.searchParams.get('raw') === '1') { // 같은 주소에서 사진 내용 그대로 (로고 배경 바꾸기 등 화면에서 다시 그릴 때)
        const b = store.read(ph.file); if (!b) { res.writeHead(404); return res.end(); }
        const ext = ph.file.split('.').pop().toLowerCase();
        res.writeHead(200, { 'Content-Type': { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext] || 'application/octet-stream', 'Cache-Control': 'private, no-store', 'Content-Length': b.length });
        return res.end(b);
      }
      return serveUpload(res, small ? ph.id + '_t.jpg' : ph.file, ph.kind === 'studio' ? 'private, max-age=3600' : 'public, max-age=31536000, immutable', req);
    }
    if (p.startsWith('/api/')) {
      const r = routes.find(r => r.method === req.method && r.re.test(p));
      if (!r) return send(res, 404, { error: '요청한 기능을 찾을 수 없습니다.' });
      const m = r.re.exec(p); const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      const user = currentUser(req);
      if (!user && membersOnly() && !OPEN_API.has(p)) fail(401, '가족 계정으로 로그인해야 볼 수 있어요.');
      requireRole(user, r.minRole);
      if (req.method !== 'GET') {
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) fail(403, '허용되지 않은 요청입니다.');
      }
      const body = req.method === 'GET' ? {} : await readBody(req, p === '/api/restore' || p === '/api/restore/files' ? 600 * 1024 * 1024 : undefined);
      const out = await r.handler({ req, res, user, params, body, query: Object.fromEntries(url.searchParams) });
      return send(res, 200, out);
    }
    // static
    if (p === '/app.js') return serveText(req, res, appBundle(), 'text/javascript; charset=utf-8', url.searchParams.has('v'));
    let file = path.normalize(path.join(PUBLIC_DIR, p));
    if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
    if (p === '/' || !path.extname(p)) return serveText(req, res, indexPage(), 'text/html; charset=utf-8', false);
    const ext = path.extname(file).toLowerCase();
    if (TEXT_EXT.has(ext)) { const t = textFile(file); if (!t) { res.writeHead(404); return res.end('Not found'); } return serveText(req, res, t, MIME[ext], url.searchParams.has('v') || p.startsWith('/fonts/')); }
    return serveFile(res, file, p.startsWith('/fonts/') || /\.(png|svg|ico)$/.test(file) ? 'public, max-age=2592000' : 'no-cache', req);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    return send(res, 500, { error: '서버 오류가 발생했습니다.' });
  }
}
const server = http.createServer(handle);
module.exports = { handle, server };
setInterval(() => run('DELETE FROM sessions WHERE expires < ?', Date.now()), 36e5).unref();
// 자동 백업 — 서버가 켜져 있는 동안 매일 새벽 3시(한국 시간) 무렵, 오늘 백업이 없으면 만든다
const backupTick = () => {
  const kst = new Date(Date.now() + 9 * 36e5); const day = kst.toISOString().slice(0, 10);
  if (process.env.YT_NO_BACKUP === '1' || kst.getUTCHours() < 3) return;
  if (listBackups().some((b) => b.date === day)) return;
  try { const r = runBackup(); console.log(`자동 백업 완료: ${r.file} (새 사진 ${r.copied}장)`); } catch (e) { console.error('자동 백업 실패:', e.message); }
};
if (!CLOUD) { setTimeout(backupTick, 60e3).unref(); setInterval(backupTick, 30 * 60e3).unref(); }
else { try { run('DELETE FROM sessions WHERE expires < ?', Date.now()); } catch {} }
// Vercel은 api/index.js가 handle을 불러 쓰고, 그 밖(집 서버·NAS·node server.js)에서는 직접 켠다
if (require.main === module || process.env.YT_LISTEN === '1') server.listen(PORT, HOST, () => {
  console.log(`유니 타임즈 서버가 시작되었습니다 → http://localhost:${PORT}${CLOUD ? ' (클라우드 모드: Neon + Blob)' : ''}`);
  if (!get('SELECT COUNT(*) c FROM users').c) console.log('처음 접속하면 관리자 계정을 만드는 화면이 나옵니다.');
});

// ───────────────────────── 화면 파일 빠르게 보내기
// · 글자 파일(HTML·CSS·JS)은 압축(brotli/gzip)해서 보내고, 압축본은 메모리에 보관
// · 화면 코드 16개는 /app.js 하나로 묶어 한 번에 (요청 수 ↓)
// · 주소에 ?v=버전을 붙여 1년 동안 다시 묻지 않고 쓰게 하고, 파일이 바뀌면 버전이 바뀐다
const TEXT_EXT = new Set(['.css', '.js', '.json', '.svg', '.webmanifest', '.txt', '.html']);
const textCache = new Map();
function textFile(file) {
  let st; try { st = fs.statSync(file); if (!st.isFile()) return null; } catch { return null; }
  const key = file + '|' + st.mtimeMs; const hit = textCache.get(file);
  if (hit && hit.key === key) return hit.t;
  const t = mkText(fs.readFileSync(file)); textCache.set(file, { key, t }); return t;
}
function mkText(buf) {
  buf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return { raw: buf, etag: '"' + crypto.createHash('sha1').update(buf).digest('base64url').slice(0, 16) + '"', z: {} };
}
function serveText(req, res, t, type, immutable) {
  const head = { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache', ETag: t.etag, Vary: 'Accept-Encoding' };
  if (req.headers['if-none-match'] === t.etag) { res.writeHead(304, head); return res.end(); }
  const enc = t.raw.length > 1024 ? res.__enc : '';
  if (enc && !t.z[enc]) t.z[enc] = enc === 'br' ? zlib.brotliCompressSync(t.raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }) : zlib.gzipSync(t.raw, { level: 9 });
  const body = enc ? t.z[enc] : t.raw;
  res.writeHead(200, { ...head, ...(enc ? { 'Content-Encoding': enc } : {}), 'Content-Length': body.length });
  res.end(req.method === 'HEAD' ? undefined : body);
}
const INDEX_FILE = () => path.join(PUBLIC_DIR, 'index.html');
const scriptList = (html) => [...html.matchAll(/<script src="\/js\/([\w-]+)\.js"><\/script>\s*/g)];
let bundleMemo = null;
function appBundle() {
  const html = fs.readFileSync(INDEX_FILE(), 'utf8');
  const files = scriptList(html).map((m) => path.join(PUBLIC_DIR, 'js', m[1] + '.js'));
  const key = files.map((f) => { try { return f + fs.statSync(f).mtimeMs; } catch { return f; } }).join('|');
  if (bundleMemo && bundleMemo.key === key) return bundleMemo.t;
  const src = files.map((f) => `/* ${path.basename(f)} */\n` + fs.readFileSync(f, 'utf8')).join('\n;\n');
  bundleMemo = { key, t: mkText(src) }; return bundleMemo.t;
}
let indexMemo = null;
function indexPage() {
  const html = fs.readFileSync(INDEX_FILE(), 'utf8');
  const b = appBundle(), css = textFile(path.join(PUBLIC_DIR, 'css/app.css')), fc = textFile(path.join(PUBLIC_DIR, 'fonts/fonts.css'));
  const key = html.length + b.etag + (css && css.etag) + (fc && fc.etag) + html;
  if (indexMemo && indexMemo.key === key) return indexMemo.t;
  const v = (t) => (t ? t.etag.slice(1, 11) : '1');
  const scripts = scriptList(html);
  let out = html.replace('href="/css/app.css"', `href="/css/app.css?v=${v(css)}"`).replace('href="/fonts/fonts.css"', `href="/fonts/fonts.css?v=${v(fc)}"`);
  if (scripts.length) {
    out = out.replace(/<script src="\/js\/[\w-]+\.js"><\/script>\s*/g, '');
    out = out.replace('<script>YT.start();</script>', `<script src="/app.js?v=${v(b)}"></script>\n<script>YT.start();</script>`);
    out = out.replace('</head>', `<link rel="preload" href="/app.js?v=${v(b)}" as="script">\n</head>`);
  }
  indexMemo = { key, t: mkText(out) }; return indexMemo.t;
}
