/**
 * firebase.js
 * Khởi tạo Firebase, xử lý Auth (Google Sign-In) và Firestore
 * Phải được load TRƯỚC app.js trong index.html
 */

// ============================================================
// CẤU HÌNH FIREBASE — Thay bằng config của bạn sau khi tạo project
// ============================================================
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBdls4S7ZkJS8yZfilJN4tuS-T1Kp2ip_c",
  authDomain: "lichphatgiao-602e7.firebaseapp.com",
  projectId: "lichphatgiao-602e7",
  storageBucket: "lichphatgiao-602e7.firebasestorage.app",
  messagingSenderId: "604347742027",
  appId: "1:604347742027:web:6d9d66f961ce9672d69ace",
};

// ============================================================
// KHỞI TẠO FIREBASE (dùng CDN compat mode)
// ============================================================
firebase.initializeApp(FIREBASE_CONFIG);

const auth = firebase.auth();
const db = firebase.firestore();

// Bật persistence offline cho Firestore (hoạt động được khi mất mạng)
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === "failed-precondition") {
    console.warn("[Firestore] Nhiều tab mở — offline chỉ hoạt động 1 tab.");
  } else if (err.code === "unimplemented") {
    console.warn("[Firestore] Trình duyệt không hỗ trợ offline persistence.");
  }
});

// ============================================================
// TRẠNG THÁI NGƯỜI DÙNG
// ============================================================

/** User hiện tại (null nếu chưa đăng nhập) */
let currentUser = null;

/**
 * Lắng nghe thay đổi trạng thái đăng nhập.
 * Khi user thay đổi → cập nhật UI và load dữ liệu.
 */
auth.onAuthStateChanged((user) => {
  currentUser = user;
  updateAuthUI(user);
  if (user) {
    // Đã đăng nhập → load sự kiện
    loadUserEvents().then(() => {
      if (typeof renderAll === "function") renderAll();
    });
  } else {
    // Chưa đăng nhập → xóa cache sự kiện
    userEvents = [];
    if (typeof renderAll === "function") renderAll();
  }
});

// ============================================================
// ĐĂNG NHẬP / ĐĂNG XUẤT
// ============================================================

/**
 * Đăng nhập bằng Google.
 */
async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    await auth.signInWithPopup(provider);
  } catch (err) {
    console.error("[Auth] Lỗi đăng nhập:", err);
    alert("Đăng nhập thất bại. Vui lòng thử lại.");
  }
}

/**
 * Đăng xuất.
 */
async function signOut() {
  try {
    await auth.signOut();
  } catch (err) {
    console.error("[Auth] Lỗi đăng xuất:", err);
  }
}

// ============================================================
// CẬP NHẬT UI AUTH
// ============================================================

/**
 * Cập nhật hiển thị nút đăng nhập/đăng xuất và thông tin user.
 * @param {firebase.User|null} user
 */
function updateAuthUI(user) {
  const btnLogin = document.getElementById("btn-login");
  const btnLogout = document.getElementById("btn-logout");
  const userInfo = document.getElementById("user-info");
  const userAvatar = document.getElementById("user-avatar");
  const userName = document.getElementById("user-name");
  const eventsSection = document.getElementById("events-section");

  if (user) {
    if (btnLogin) btnLogin.style.display = "none";
    if (btnLogout) btnLogout.style.display = "inline-flex";
    if (userInfo) userInfo.style.display = "flex";
    if (userAvatar) userAvatar.src = user.photoURL || "";
    if (userName) userName.textContent = user.displayName || user.email;
    if (eventsSection) eventsSection.style.display = "block";
  } else {
    if (btnLogin) btnLogin.style.display = "inline-flex";
    if (btnLogout) btnLogout.style.display = "none";
    if (userInfo) userInfo.style.display = "none";
    if (eventsSection) eventsSection.style.display = "none";
  }
}

// ============================================================
// CRUD SỰ KIỆN (Firestore)
// ============================================================

/** Cache sự kiện của user trong bộ nhớ */
let userEvents = [];

/**
 * Load tất cả sự kiện của user từ Firestore.
 * @returns {Promise<void>}
 */
async function loadUserEvents() {
  if (!currentUser) return;
  try {
    const snapshot = await db
      .collection("users")
      .doc(currentUser.uid)
      .collection("events")
      .orderBy("createdAt", "desc")
      .get();

    userEvents = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (err) {
    console.error("[Firestore] Lỗi load sự kiện:", err);
  }
}

/**
 * Thêm sự kiện mới vào Firestore.
 * @param {object} eventData - Dữ liệu sự kiện
 * @returns {Promise<string>} ID của sự kiện vừa tạo
 */
async function addEvent(eventData) {
  if (!currentUser) throw new Error("Chưa đăng nhập");

  const docRef = await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("events")
    .add({
      ...eventData,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

  // Cập nhật cache
  const newEvent = { id: docRef.id, ...eventData, createdAt: new Date() };
  userEvents.unshift(newEvent);
  return docRef.id;
}

/**
 * Cập nhật sự kiện trong Firestore.
 * @param {string} eventId - ID sự kiện
 * @param {object} eventData - Dữ liệu mới
 */
async function updateEvent(eventId, eventData) {
  if (!currentUser) throw new Error("Chưa đăng nhập");

  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("events")
    .doc(eventId)
    .update({
      ...eventData,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

  // Cập nhật cache
  const idx = userEvents.findIndex((e) => e.id === eventId);
  if (idx !== -1) userEvents[idx] = { id: eventId, ...eventData };
}

/**
 * Xóa sự kiện khỏi Firestore.
 * @param {string} eventId - ID sự kiện
 */
async function deleteEvent(eventId) {
  if (!currentUser) throw new Error("Chưa đăng nhập");

  await db
    .collection("users")
    .doc(currentUser.uid)
    .collection("events")
    .doc(eventId)
    .delete();

  // Cập nhật cache
  userEvents = userEvents.filter((e) => e.id !== eventId);
}

// ============================================================
// TIỆN ÍCH: Lấy sự kiện theo ngày
// ============================================================

/**
 * Lấy danh sách sự kiện xảy ra vào ngày dương lịch cụ thể.
 * So sánh cả dương lịch lẫn âm lịch.
 *
 * @param {number} dd - Ngày dương lịch
 * @param {number} mm - Tháng dương lịch
 * @param {number} yy - Năm dương lịch
 * @returns {Array} Danh sách sự kiện
 */
function getEventsForDay(dd, mm, yy) {
  if (!currentUser || !userEvents.length) return [];

  // Lấy thông tin âm lịch của ngày đang xét
  const lunarInfo = getLunarDate(new Date(yy, mm - 1, dd));

  return userEvents.filter((event) => {
    // Kiểm tra theo dương lịch
    if (event.loaiNgay === "duong" || event.loaiNgay === "ca_hai") {
      if (event.ngayDuong && event.thangDuong) {
        if (event.ngayDuong === dd && event.thangDuong === mm) return true;
      }
    }

    // Kiểm tra theo âm lịch
    if (event.loaiNgay === "am" || event.loaiNgay === "ca_hai") {
      if (event.ngayAm && event.thangAm) {
        if (
          event.ngayAm === lunarInfo.ngayAm &&
          event.thangAm === lunarInfo.thangAm
        )
          return true;
      }
    }

    return false;
  });
}
