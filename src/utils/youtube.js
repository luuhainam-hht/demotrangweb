// Tach ma video / danh sach phat YouTube tu moi kieu lien ket Admin hay dan vao Cau hinh Tham so
// (IDLE_VIDEO_YOUTUBE) - dung cho "video luc cho" tren Trang chu Kiosk (public/js/idleVideo.js).
// Chap nhan: https://www.youtube.com/watch?v=ID, https://youtu.be/ID, /embed/ID, /shorts/ID,
// /live/ID, ?list=PLAYLIST, ma ID 11 ky tu thuan, hoac nguyen doan <iframe src="...">.
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const LIST_ID = /^[A-Za-z0-9_-]{10,64}$/;

function parseYoutube(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (VIDEO_ID.test(text)) return { videoId: text, playlistId: null };
  const src = /src\s*=\s*["']([^"']+)["']/i.exec(text);
  let url;
  try { url = new URL(src ? src[1] : text); } catch (e) { return null; }
  const host = url.hostname.replace(/^www\.|^m\./, '');
  if (!['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'music.youtube.com'].includes(host)) return null;
  let videoId = null;
  if (host === 'youtu.be') videoId = url.pathname.split('/')[1] || null;
  else if (url.searchParams.get('v')) videoId = url.searchParams.get('v');
  else {
    const m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(url.pathname);
    if (m && m[1] !== 'videoseries') videoId = m[1];
  }
  const list = url.searchParams.get('list');
  const playlistId = list && LIST_ID.test(list) ? list : null;
  if (videoId && !VIDEO_ID.test(videoId)) videoId = null;
  if (!videoId && !playlistId) return null;
  return { videoId, playlistId };
}

module.exports = { parseYoutube };
