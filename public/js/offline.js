// Trang offline.html: tu tai lai khi co mang tro lai (khong can ai bam).
window.addEventListener('online', () => window.location.replace('index.html'));
setInterval(() => { if (navigator.onLine) fetch('/api/health', { cache: 'no-store' }).then((r) => { if (r.ok) window.location.replace('index.html'); }).catch(() => {}); }, 10000);
