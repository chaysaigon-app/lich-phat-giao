/**
 * service-worker.js
 * Service Worker cho Lịch Âm Dương - Phật Giáo Nguyên Thủy
 * Chiến lược: Cache First → Offline-first hoàn toàn
 *
 * Vòng đời SW: Install → Activate → Fetch
 */

// Tên cache và phiên bản. Khi cập nhật app, đổi số phiên bản để xóa cache cũ.
const CACHE_NAME = "lich-am-duong-v1.0.0";

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
  const url = new URL(request.url);

  // ---- Chiến lược 1: CACHE FIRST (cho tài nguyên tĩnh của app) ----
  const isAppShell =
    url.origin === self.location.origin ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com";

  if (isAppShell) {
    // Thử lấy từ cache trước
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Đã có trong cache → trả về ngay (nhanh, offline được)
      return cachedResponse;
    }

    // Chưa có trong cache → tải từ mạng và lưu vào cache
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        // Clone response vì response chỉ đọc được 1 lần
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (err) {
      // Mất mạng và không có cache → trả về trang offline fallback
      console.warn("[SW] Không thể tải:", request.url);
      const fallback = await caches.match("./index.html");
      return (
        fallback ||
        new Response("<h1>Đang offline. Vui lòng thử lại.</h1>", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        })
      );
    }
  }

  // ---- Chiến lược 2: NETWORK FIRST (cho tài nguyên bên ngoài khác) ----
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (err) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    // Không có gì cả
    return new Response("Không có kết nối mạng.", { status: 503 });
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
