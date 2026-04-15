/**
 * app.js
 * Logic chính — đã tích hợp hệ thống sự kiện cá nhân
 */

// ============================================================
// BIẾN TRẠNG THÁI
// ============================================================
let currentViewDate = new Date();
const TODAY = new Date();

// ============================================================
// SERVICE WORKER
// ============================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((reg) => console.log("✅ SW đăng ký:", reg.scope))
      .catch((err) => console.error("❌ SW lỗi:", err));
  });
}

// ============================================================
// PWA INSTALL PROMPT
// ============================================================
let deferredInstallPrompt = null;
const installBanner = document.getElementById("install-banner");
const btnInstall = document.getElementById("btn-install");
const btnDismiss = document.getElementById("btn-dismiss");

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  setTimeout(() => {
    if (installBanner) installBanner.classList.add("visible");
  }, 2000);
});

if (btnInstall) {
  btnInstall.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
    }
    installBanner.classList.remove("visible");
  });
}

if (btnDismiss) {
  btnDismiss.addEventListener("click", () => installBanner.classList.remove("visible"));
}

// ============================================================
// RENDER LỊCH THÁNG
// ============================================================
function renderMonthCalendar() {
  const year = currentViewDate.getFullYear();
  const month = currentViewDate.getMonth() + 1;

  document.getElementById("month-title").textContent = `${TEN_THANG_DL[month - 1]} · ${year}`;

  const monthData = getMonthData(year, month);
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const offset = (firstDayOfWeek + 6) % 7;

  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";

  for (let i = 0; i < offset; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day empty";
    grid.appendChild(empty);
  }

  monthData.forEach((day) => {
    const cell = document.createElement("div");
    cell.className = "cal-day";

    const isToday =
      day.duongLich === TODAY.getDate() &&
      month === TODAY.getMonth() + 1 &&
      year === TODAY.getFullYear();
    const isWeekend = day.thu === 0 || day.thu === 6;

    if (isToday) cell.classList.add("today");
    if (isWeekend) cell.classList.add("weekend");
    if (day.laThapTrai) cell.classList.add("thap-trai");

    cell.innerHTML = `
      <span class="solar-day">${day.duongLich}</span>
      <span class="lunar-day">${day.ngayAm}${day.ngayAm === 1 ? "/" + day.thangAm : ""}</span>
      ${day.laThapTrai ? '<span class="lotus-dot" title="Ngày Thập Trai">●</span>' : ""}
    `;

    cell.addEventListener("click", () => {
      currentViewDate = new Date(year, month - 1, day.duongLich);
      renderDayDetail();
      highlightSelectedDay(day.duongLich);
    });

    grid.appendChild(cell);
  });

  // Thêm dấu chấm sự kiện sau khi render xong lưới
  addEventDotsToCalendar(year, month);
}

function highlightSelectedDay(selectedDay) {
  const allCells = Array.from(document.querySelectorAll(".cal-day"));
  const dayCells = allCells.filter((c) => !c.classList.contains("empty"));
  dayCells.forEach((c) => c.classList.remove("selected"));
  if (dayCells[selectedDay - 1]) dayCells[selectedDay - 1].classList.add("selected");
}

// ============================================================
// RENDER CHI TIẾT NGÀY
// ============================================================
function renderDayDetail() {
  const d = currentViewDate.getDate();
  const m = currentViewDate.getMonth() + 1;
  const y = currentViewDate.getFullYear();
  const lunar = getLunarDate(currentViewDate);

  const tenThuDayDu = ["Chủ Nhật","Thứ Hai","Thứ Ba","Thứ Tư","Thứ Năm","Thứ Sáu","Thứ Bảy"];

  document.getElementById("detail-thu").textContent = tenThuDayDu[currentViewDate.getDay()];
  document.getElementById("detail-solar-day").textContent = d;
  document.getElementById("detail-solar-month-year").textContent = `Tháng ${m} · ${y}`;
  document.getElementById("detail-lunar-day").textContent = `Ngày ${lunar.ngayAm}`;
  document.getElementById("detail-lunar-month").textContent =
    `Tháng ${TEN_THANG_AM[lunar.thangAm]}${lunar.thangNhuan ? " (Nhuận)" : ""} · Năm ${lunar.canChi}`;

  // Thập Trai badge
  const thapTraiBadge = document.getElementById("thap-trai-badge");
  if (lunar.soNgayTrongThang > 0 && isThapTrai(lunar.ngayAm, lunar.soNgayTrongThang)) {
    thapTraiBadge.style.display = "flex";
  } else {
    thapTraiBadge.style.display = "none";
  }

  // Sự kiện ngày này
  renderDayEvents(d, m, y);

  // Nút thêm sự kiện nhanh
  const addQuick = document.getElementById("add-event-quick");
  if (addQuick) {
    addQuick.style.display = currentUser ? "block" : "none";
  }

  // Kệ Pháp Cú
  renderPhapCu(currentViewDate);

  // Danh sách sự kiện tổng
  renderEventsList();
}

// ============================================================
// KINH PHÁP CÚ
// ============================================================
function renderPhapCu(date) {
  const dayOfYear = getDayOfYear(date);
  const index = (dayOfYear - 1) % PHAP_CU.length;
  const ke = PHAP_CU[index];

  document.getElementById("phapcu-pham").textContent = ke.pham;
  document.getElementById("phapcu-ke-ngon").innerHTML = ke.ke_ngon
    .split("\n")
    .map((line) => `<span>${line}</span>`)
    .join("<br>");
  document.getElementById("phapcu-y-nghia").textContent = ke.y_nghia;
}

// ============================================================
// ĐIỀU HƯỚNG THÁNG
// ============================================================
function prevMonth() {
  currentViewDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() - 1, 1);
  renderAll();
}

function nextMonth() {
  currentViewDate = new Date(currentViewDate.getFullYear(), currentViewDate.getMonth() + 1, 1);
  renderAll();
}

function goToday() {
  currentViewDate = new Date(TODAY);
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// SWIPE
// ============================================================
let touchStartX = 0;
document.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].screenX; });
document.addEventListener("touchend", (e) => {
  const delta = touchStartX - e.changedTouches[0].screenX;
  if (Math.abs(delta) > 60) {
    delta > 0 ? nextMonth() : prevMonth();
  }
});

// ============================================================
// MODAL: click ngoài để đóng
// ============================================================
function handleModalOverlayClick(e) {
  if (e.target.id === "event-modal") closeEventModal();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeEventModal();
});

// ============================================================
// NÚT BẤM
// ============================================================
document.getElementById("btn-prev-month").addEventListener("click", prevMonth);
document.getElementById("btn-next-month").addEventListener("click", nextMonth);
document.getElementById("btn-today").addEventListener("click", goToday);

// ============================================================
// RENDER TỔNG HỢP
// ============================================================
function renderAll() {
  renderMonthCalendar();
  renderDayDetail();

  const isCurrentMonth =
    currentViewDate.getMonth() === TODAY.getMonth() &&
    currentViewDate.getFullYear() === TODAY.getFullYear();

  if (isCurrentMonth) highlightSelectedDay(TODAY.getDate());
}

// ============================================================
// KHỞI ĐỘNG
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  renderAll();
});
