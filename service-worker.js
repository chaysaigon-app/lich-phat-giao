/**
 * service-worker.js
 * Service Worker cho Lịch Âm Dương - Phật Giáo Nguyên Thủy
 * Chiến lược: Cache First → Offline-first hoàn toàn
 *
 * Vòng đời SW: Install → Activate → Fetch
 */

// Tên cache và phiên bản. Khi cập nhật app, đổi số phiên bản để xóa cache cũ.
const CACHE_NAME = "lich-am-duong-v2.0.3";

/**
 * Danh sách tài nguyên cần cache khi cài đặt lần đầu (App Shell).
 * Bao gồm toàn bộ file cần thiết để app chạy offline.
 */
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./data.js",
  "./lunar.js",
  "./app.js",
  "./manifest.json",
  // Google Fonts sẽ được cache tự động khi user truy cập lần đầu có mạng
];

// ============================================================
// SỰ KIỆN INSTALL: Cache tất cả tài nguyên cần thiết
// ============================================================
self.addEventListener("install", (event) => {
  console.log("[SW] Đang cài đặt Service Worker...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Đang cache App Shell...");
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        // Kích hoạt ngay mà không cần đợi trang reload
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error("[SW] Lỗi khi cache tài nguyên:", err);
      })
  );
});

// ============================================================
// SỰ KIỆN ACTIVATE: Xóa cache cũ khi có phiên bản mới
// ============================================================
self.addEventListener("activate", (event) => {
  console.log("[SW] Service Worker đã kích hoạt.");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME) // Chỉ giữ cache hiện tại
            .map((oldCache) => {
              console.log("[SW] Đang xóa cache cũ:", oldCache);
              return caches.delete(oldCache);
            })
        );
      })
      .then(() => {
        // Kiểm soát tất cả tab/client ngay lập tức (không cần reload)
        return self.clients.claim();
      })
  );
});

// ============================================================
// SỰ KIỆN FETCH: Xử lý mọi request theo chiến lược Cache First
// ============================================================
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Chỉ xử lý request GET
  if (event.request.method !== "GET") return;

  // Bỏ qua các request không phải http/https (VD: chrome-extension://)
  if (!url.protocol.startsWith("http")) return;

  event.respondWith(handleFetch(event.request));
});

/**
 * Xử lý fetch theo chiến lược tùy loại tài nguyên:
 * - Tài nguyên App Shell: Cache First (ưu tiên cache)
 * - Google Fonts: Cache First với fallback (tải về nếu chưa có)
 * - Tài nguyên khác: Network First với fallback cache
 *
 * @param {Request} request - Request cần xử lý
 * @returns {Promise<Response>}
 */
async function handleFetch(request) {
  // Chỉ xử lý các request hợp lệ (http/https)
  if (!request.url.startsWith('http')) return;

  try {
    // 1. NETWORK FIRST: Luôn thử tải bản mới nhất từ mạng trước
    const networkResponse = await fetch(request);

    // 2. Nếu có mạng và tải thành công, lưu ngay bản mới này vào cache
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (err) {
    // 3. CACHE FALLBACK: Nếu mất mạng (fetch thất bại), lúc này mới tìm trong Cache
    console.warn("[SW] Mất mạng, đang tải từ cache:", request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }

    // 4. Nếu mất mạng và file cũng chưa từng được cache
    // Nếu là request lấy trang web (HTML), trả về trang index dự phòng
    if (request.mode === 'navigate') {
      const fallback = await caches.match("./index.html");
      if (fallback) return fallback;
    }

    // Trả về thông báo lỗi cơ bản
    return new Response("<h1>Đang offline và không có dữ liệu lưu trữ. Vui lòng thử lại sau.</h1>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

// ============================================================
// XỬ LÝ THÔNG BÁO TỪ APP (Postmessage)
// ============================================================
self.addEventListener("message", (event) => {
  // Khi app gửi lệnh "SKIP_WAITING", kích hoạt SW mới ngay
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ============================================================
// [THÊM MỚI] LẮNG NGHE THÔNG BÁO ĐẨY TỪ MÁY CHỦ (PUSH NOTIFICATION)
// ============================================================
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || "Bạn có sự kiện quan trọng hôm nay.",
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-72.png',
      data: { url: data.url || './index.html' }
    };
    event.waitUntil(
      self.registration.showNotification(data.title || "🪷 Lịch Phật Giáo", options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
