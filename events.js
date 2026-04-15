/**
 * events.js
 * Giao diện quản lý sự kiện cá nhân (thêm, sửa, xóa)
 * Phụ thuộc: firebase.js, lunar.js
 */

// ============================================================
// MỞ / ĐÓNG MODAL THÊM SỰ KIỆN
// ============================================================

/**
 * Mở modal thêm sự kiện mới.
 */
function openAddEventModal() {
  if (!currentUser) {
    alert("Vui lòng đăng nhập để thêm sự kiện.");
    return;
  }
  document.getElementById("event-modal-title").textContent = "Thêm Sự Kiện";
  document.getElementById("event-form").reset();
  document.getElementById("event-id-hidden").value = "";
  // Mặc định chọn âm lịch
  setDateType("am");
  updateDateTypeUI();
  document.getElementById("event-modal").classList.add("open");
  // Disable scroll body
  document.body.style.overflow = "hidden";
}

/**
 * Mở modal chỉnh sửa sự kiện.
 * @param {string} eventId - ID sự kiện cần sửa
 */
function openEditEventModal(eventId) {
  const event = userEvents.find((e) => e.id === eventId);
  if (!event) return;

  document.getElementById("event-modal-title").textContent = "Sửa Sự Kiện";
  document.getElementById("event-id-hidden").value = eventId;
  document.getElementById("event-name").value = event.tenSuKien || "";
  document.getElementById("event-location").value = event.diaDiem || "";
  document.getElementById("event-note").value = event.ghiChu || "";

  // Loại ngày
  const loaiNgay = event.loaiNgay || "am";
  setDateType(loaiNgay);

  if (event.ngayAm) document.getElementById("event-ngay-am").value = event.ngayAm;
  if (event.thangAm) document.getElementById("event-thang-am").value = event.thangAm;
  if (event.ngayDuong) document.getElementById("event-ngay-duong").value = event.ngayDuong;
  if (event.thangDuong) document.getElementById("event-thang-duong").value = event.thangDuong;

  updateDateTypeUI();
  document.getElementById("event-modal").classList.add("open");
  document.body.style.overflow = "hidden";
}

/**
 * Đóng modal sự kiện.
 */
function closeEventModal() {
  document.getElementById("event-modal").classList.remove("open");
  document.body.style.overflow = "";
}

// ============================================================
// CHỌN LOẠI NGÀY (âm / dương / cả hai)
// ============================================================

let currentDateType = "am"; // 'am' | 'duong' | 'ca_hai'

function setDateType(type) {
  currentDateType = type;
  document.querySelectorAll(".date-type-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  updateDateTypeUI();
}

function updateDateTypeUI() {
  const rowAm = document.getElementById("row-am");
  const rowDuong = document.getElementById("row-duong");

  if (currentDateType === "am") {
    rowAm.style.display = "flex";
    rowDuong.style.display = "none";
  } else if (currentDateType === "duong") {
    rowAm.style.display = "none";
    rowDuong.style.display = "flex";
  } else {
    // ca_hai
    rowAm.style.display = "flex";
    rowDuong.style.display = "flex";
  }
}

// ============================================================
// LƯU SỰ KIỆN (Thêm mới hoặc Cập nhật)
// ============================================================

/**
 * Đọc form và lưu sự kiện.
 */
async function saveEvent() {
  const tenSuKien = document.getElementById("event-name").value.trim();
  if (!tenSuKien) {
    alert("Vui lòng nhập tên sự kiện.");
    return;
  }

  // Validate ngày theo loại
  let ngayAm = null, thangAm = null, ngayDuong = null, thangDuong = null;

  if (currentDateType === "am" || currentDateType === "ca_hai") {
    ngayAm = parseInt(document.getElementById("event-ngay-am").value);
    thangAm = parseInt(document.getElementById("event-thang-am").value);
    if (!ngayAm || !thangAm || ngayAm < 1 || ngayAm > 30 || thangAm < 1 || thangAm > 12) {
      alert("Vui lòng nhập ngày âm lịch hợp lệ (ngày 1-30, tháng 1-12).");
      return;
    }
  }

  if (currentDateType === "duong" || currentDateType === "ca_hai") {
    ngayDuong = parseInt(document.getElementById("event-ngay-duong").value);
    thangDuong = parseInt(document.getElementById("event-thang-duong").value);
    if (!ngayDuong || !thangDuong || ngayDuong < 1 || ngayDuong > 31 || thangDuong < 1 || thangDuong > 12) {
      alert("Vui lòng nhập ngày dương lịch hợp lệ.");
      return;
    }
  }

  const eventData = {
    tenSuKien,
    loaiNgay: currentDateType,
    ngayAm: ngayAm || null,
    thangAm: thangAm || null,
    ngayDuong: ngayDuong || null,
    thangDuong: thangDuong || null,
    diaDiem: document.getElementById("event-location").value.trim() || null,
    ghiChu: document.getElementById("event-note").value.trim() || null,
  };

  const btnSave = document.getElementById("btn-save-event");
  btnSave.disabled = true;
  btnSave.textContent = "Đang lưu...";

  try {
    const eventId = document.getElementById("event-id-hidden").value;
    if (eventId) {
      await updateEvent(eventId, eventData);
    } else {
      await addEvent(eventData);
    }
    closeEventModal();
    renderAll(); // Render lại toàn bộ để cập nhật badge ngày
    renderEventsList(); // Cập nhật danh sách
  } catch (err) {
    console.error("[Events] Lỗi lưu sự kiện:", err);
    alert("Lỗi lưu sự kiện. Vui lòng thử lại.");
  } finally {
    btnSave.disabled = false;
    btnSave.textContent = "Lưu";
  }
}

/**
 * Xóa sự kiện sau khi xác nhận.
 * @param {string} eventId
 */
async function confirmDeleteEvent(eventId) {
  const event = userEvents.find((e) => e.id === eventId);
  if (!event) return;

  if (!confirm(`Xóa sự kiện "${event.tenSuKien}"?`)) return;

  try {
    await deleteEvent(eventId);
    renderAll();
    renderEventsList();
  } catch (err) {
    console.error("[Events] Lỗi xóa sự kiện:", err);
    alert("Lỗi xóa sự kiện. Vui lòng thử lại.");
  }
}

// ============================================================
// RENDER DANH SÁCH SỰ KIỆN (trong trang quản lý)
// ============================================================

/**
 * Render danh sách sự kiện của user trong phần quản lý.
 */
function renderEventsList() {
  const container = document.getElementById("events-list");
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = "";
    return;
  }

  if (!userEvents.length) {
    container.innerHTML = `
      <div class="events-empty">
        <div class="events-empty-icon">📅</div>
        <div class="events-empty-text">Chưa có sự kiện nào.<br>Nhấn <strong>+ Thêm</strong> để bắt đầu.</div>
      </div>`;
    return;
  }

  container.innerHTML = userEvents
    .map((event) => {
      const dateStr = formatEventDateStr(event);
      return `
      <div class="event-item">
        <div class="event-item-left">
          <div class="event-item-icon">${getEventIcon(event.loaiNgay)}</div>
          <div class="event-item-info">
            <div class="event-item-name">${escHtml(event.tenSuKien)}</div>
            <div class="event-item-date">${dateStr}</div>
            ${event.diaDiem ? `<div class="event-item-loc">📍 ${escHtml(event.diaDiem)}</div>` : ""}
          </div>
        </div>
        <div class="event-item-actions">
          <button class="event-btn-edit" onclick="openEditEventModal('${event.id}')" title="Sửa">✏️</button>
          <button class="event-btn-delete" onclick="confirmDeleteEvent('${event.id}')" title="Xóa">🗑️</button>
        </div>
      </div>`;
    })
    .join("");
}

// ============================================================
// RENDER BADGE SỰ KIỆN TRONG NGÀY (bên dưới lịch)
// ============================================================

/**
 * Render các sự kiện xảy ra vào ngày đang xem trong phần chi tiết ngày.
 * @param {number} dd
 * @param {number} mm
 * @param {number} yy
 */
function renderDayEvents(dd, mm, yy) {
  const container = document.getElementById("day-events-container");
  if (!container) return;

  const events = getEventsForDay(dd, mm, yy);

  if (!events.length) {
    container.innerHTML = "";
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";
  container.innerHTML = events
    .map(
      (event) => `
    <div class="day-event-card">
      <div class="day-event-top">
        <span class="day-event-icon">🗓️</span>
        <span class="day-event-name">${escHtml(event.tenSuKien)}</span>
        <button class="day-event-edit" onclick="openEditEventModal('${event.id}')" title="Sửa">✏️</button>
      </div>
      ${event.diaDiem ? `<div class="day-event-loc">📍 ${escHtml(event.diaDiem)}</div>` : ""}
      ${event.ghiChu ? `<div class="day-event-note">${escHtml(event.ghiChu)}</div>` : ""}
    </div>`
    )
    .join("");
}

// ============================================================
// RENDER DẤU CHẤM SỰ KIỆN TRÊN LỊCH THÁNG
// ============================================================

/**
 * Thêm dấu chấm sự kiện vào ô ngày trong lịch tháng.
 * Được gọi SAU khi renderMonthCalendar() đã render xong lưới.
 * @param {number} year
 * @param {number} month
 */
function addEventDotsToCalendar(year, month) {
  if (!currentUser || !userEvents.length) return;

  const allCells = Array.from(document.querySelectorAll(".cal-day:not(.empty)"));
  allCells.forEach((cell, idx) => {
    const day = idx + 1;
    const events = getEventsForDay(day, month, year);
    if (events.length) {
      // Thêm dấu chấm màu cam
      if (!cell.querySelector(".event-dot")) {
        const dot = document.createElement("span");
        dot.className = "event-dot";
        dot.title = `${events.length} sự kiện`;
        cell.appendChild(dot);
      }
    }
  });
}

// ============================================================
// TIỆN ÍCH
// ============================================================

function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getEventIcon(loaiNgay) {
  if (loaiNgay === "am") return "🌙";
  if (loaiNgay === "duong") return "☀️";
  return "🌓";
}

function formatEventDateStr(event) {
  const parts = [];
  if (event.loaiNgay === "am" || event.loaiNgay === "ca_hai") {
    if (event.ngayAm && event.thangAm) {
      parts.push(`🌙 Ngày ${event.ngayAm} tháng ${event.thangAm} âm lịch`);
    }
  }
  if (event.loaiNgay === "duong" || event.loaiNgay === "ca_hai") {
    if (event.ngayDuong && event.thangDuong) {
      parts.push(`☀️ Ngày ${event.ngayDuong}/${event.thangDuong} dương lịch`);
    }
  }
  return parts.join(" · ") || "Chưa có ngày";
}
