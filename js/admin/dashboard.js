import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { get, onValue, push, ref, remove, set, update } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, database } from "../firebase.js?v=3";
import { adminAuthConfig } from "../firebase-config.js?v=3";

const state = {
  destinations: [],
  stays: [],
  reservations: [],
  members: [],
  filters: { destinations: "", stays: "", reservations: "", members: "" }
};

const guard = document.querySelector("[data-admin-guard]");
const appRoot = document.querySelector("[data-admin-app]");
const editorDialog = document.querySelector("[data-editor-dialog]");
const detailDialog = document.querySelector("[data-detail-dialog]");
const messageDialog = document.querySelector("[data-admin-message-dialog]");
const destinationForm = document.querySelector("[data-destination-form]");
const stayForm = document.querySelector("[data-stay-form]");
let messageCallback = null;

const adminReady = () =>
  Boolean(
    adminAuthConfig.email &&
      !adminAuthConfig.email.startsWith("YOUR_")
  );

const isAdminUser = (user) =>
  Boolean(
    user &&
      adminReady() &&
      user.email?.toLocaleLowerCase() === adminAuthConfig.email.toLocaleLowerCase() &&
      (!adminAuthConfig.uid || user.uid === adminAuthConfig.uid)
  );

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? escapeHtml(value)
    : new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
};

const formatPrice = (value) => `${Number(value || 0).toLocaleString("ko-KR")}원`;

const statusLabels = {
  draft: "작성 중",
  published: "공개",
  hidden: "숨김",
  active: "활성",
  inactive: "비활성",
  suspended: "정지",
  requested: "예약 신청",
  confirmed: "예약 확정",
  cancel_requested: "취소 요청",
  canceled: "취소 완료",
  completed: "이용 완료"
};

const statusBadge = (status) =>
  `<span class="status-badge ${escapeHtml(status)}">${escapeHtml(statusLabels[status] || status || "-")}</span>`;

const showMessage = (message, callback = null) => {
  const text = document.querySelector("[data-admin-message]");
  if (!messageDialog || !text) return;
  text.textContent = message;
  messageCallback = callback;
  if (!messageDialog.open) messageDialog.showModal();
};

const closeMessage = () => {
  if (messageDialog?.open) messageDialog.close();
  const callback = messageCallback;
  messageCallback = null;
  callback?.();
};

const destinationName = (id) => state.destinations.find((item) => item.id === id)?.name || "연결 정보 없음";
const stayName = (id) => state.stays.find((item) => item.id === id)?.name || "연결 정보 없음";
const memberName = (id) => state.members.find((item) => item.id === id)?.name || "회원 정보 없음";

const matchesFilter = (item, type, values) => {
  const keyword = state.filters[type].toLocaleLowerCase("ko-KR");
  if (!keyword) return true;
  return values(item).join(" ").toLocaleLowerCase("ko-KR").includes(keyword);
};

const setEmptyRow = (tbody, columnCount, message) => {
  tbody.innerHTML = `<tr><td class="empty-cell" colspan="${columnCount}">${escapeHtml(message)}</td></tr>`;
};

const renderDestinations = () => {
  const tbody = document.querySelector('[data-table="destinations"]');
  const filtered = state.destinations.filter((item) =>
    matchesFilter(item, "destinations", (row) => [row.name, row.region, row.address, row.status])
  );
  document.querySelector('[data-list-count="destinations"]').textContent = `${filtered.length}개`;
  if (!filtered.length) {
    setEmptyRow(tbody, 6, "등록된 여행지가 없습니다.");
    return;
  }
  tbody.innerHTML = filtered
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.summary)}</small></td>
        <td>${escapeHtml(item.region)}</td><td>${escapeHtml(item.address)}</td><td>${statusBadge(item.status)}</td>
        <td>${formatDate(item.updatedAt)}</td>
        <td><div class="table-actions"><button type="button" data-detail-type="destination" data-id="${escapeHtml(item.id)}">상세</button><button type="button" data-edit-type="destination" data-id="${escapeHtml(item.id)}">수정</button><button class="danger" type="button" data-delete-type="destination" data-id="${escapeHtml(item.id)}">삭제</button></div></td>
      </tr>`
    )
    .join("");
};

const renderStays = () => {
  const tbody = document.querySelector('[data-table="stays"]');
  const filtered = state.stays.filter((item) =>
    matchesFilter(item, "stays", (row) => [row.name, row.address, destinationName(row.destinationId), row.status])
  );
  document.querySelector('[data-list-count="stays"]').textContent = `${filtered.length}개`;
  if (!filtered.length) {
    setEmptyRow(tbody, 6, "등록된 숙소가 없습니다.");
    return;
  }
  tbody.innerHTML = filtered
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.address)}</small></td>
        <td>${escapeHtml(destinationName(item.destinationId))}</td><td>${formatPrice(item.pricePerNight)}</td>
        <td>${Number(item.maxGuests || 0)}명</td><td>${statusBadge(item.status)}</td>
        <td><div class="table-actions"><button type="button" data-detail-type="stay" data-id="${escapeHtml(item.id)}">상세</button><button type="button" data-edit-type="stay" data-id="${escapeHtml(item.id)}">수정</button><button class="danger" type="button" data-delete-type="stay" data-id="${escapeHtml(item.id)}">삭제</button></div></td>
      </tr>`
    )
    .join("");
};

const reservationStatusOptions = (current) =>
  ["requested", "confirmed", "cancel_requested", "canceled", "completed"]
    .map((status) => `<option value="${status}" ${status === current ? "selected" : ""}>${statusLabels[status]}</option>`)
    .join("");

const renderReservations = () => {
  const tbody = document.querySelector('[data-table="reservations"]');
  const filtered = state.reservations.filter((item) =>
    matchesFilter(item, "reservations", (row) => [row.id, memberName(row.memberId), stayName(row.stayId), row.status])
  );
  document.querySelector('[data-list-count="reservations"]').textContent = `${filtered.length}개`;
  if (!filtered.length) {
    setEmptyRow(tbody, 8, "예약 신청 내역이 없습니다.");
    return;
  }
  tbody.innerHTML = filtered
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.id)}</strong><small>${formatDate(item.createdAt)}</small></td>
        <td>${escapeHtml(memberName(item.memberId))}</td><td>${escapeHtml(stayName(item.stayId))}</td>
        <td>${escapeHtml(item.checkIn)}<br />${escapeHtml(item.checkOut)}</td><td>${Number(item.guestCount || 0)}명</td>
        <td><strong>${formatPrice(item.totalPrice)}</strong><small>예약 시점 금액</small></td>
        <td><select class="status-select" data-reservation-status data-id="${escapeHtml(item.id)}">${reservationStatusOptions(item.status)}</select></td>
        <td><button class="status-select" type="button" data-detail-type="reservation" data-id="${escapeHtml(item.id)}">상세</button></td>
      </tr>`
    )
    .join("");
};

const renderMembers = () => {
  const tbody = document.querySelector('[data-table="members"]');
  const filtered = state.members.filter((item) =>
    matchesFilter(item, "members", (row) => [row.name, row.email, row.phone, row.status])
  );
  document.querySelector('[data-list-count="members"]').textContent = `${filtered.length}명`;
  if (!filtered.length) {
    setEmptyRow(tbody, 6, "가입한 회원이 없습니다.");
    return;
  }
  tbody.innerHTML = filtered
    .map(
      (item) => `<tr>
        <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.id)}</small></td><td>${escapeHtml(item.email)}</td>
        <td>${escapeHtml(item.phone)}</td><td>${formatDate(item.createdAt)}</td><td>${statusBadge(item.status)}</td>
        <td><div class="table-actions"><button type="button" data-detail-type="member" data-id="${escapeHtml(item.id)}">상세</button><button type="button" data-toggle-member data-id="${escapeHtml(item.id)}" data-status="${escapeHtml(item.status)}">${item.status === "suspended" ? "활성화" : "정지"}</button></div></td>
      </tr>`
    )
    .join("");
};

const renderRecentReservations = () => {
  const tbody = document.querySelector("[data-recent-reservations]");
  const recent = [...state.reservations]
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .slice(0, 5);
  if (!recent.length) {
    setEmptyRow(tbody, 5, "최근 예약이 없습니다.");
    return;
  }
  tbody.innerHTML = recent
    .map(
      (item) => `<tr><td><strong>${escapeHtml(item.id)}</strong></td><td>${escapeHtml(memberName(item.memberId))}</td><td>${escapeHtml(stayName(item.stayId))}</td><td>${escapeHtml(item.checkIn)} ~ ${escapeHtml(item.checkOut)}</td><td>${statusBadge(item.status)}</td></tr>`
    )
    .join("");
};

const renderMetrics = () => {
  const activeMembers = state.members.filter((item) => item.status === "active").length;
  document.querySelector('[data-metric="members"]').textContent = String(state.members.length);
  document.querySelector('[data-metric-sub="members"]').textContent = `활성 회원 ${activeMembers}명`;
  document.querySelector('[data-metric="destinations"]').textContent = String(state.destinations.filter((item) => item.status === "published").length);
  document.querySelector('[data-metric="stays"]').textContent = String(state.stays.filter((item) => item.status === "active").length);
  document.querySelector('[data-metric="reservations"]').textContent = String(
    state.reservations.filter((item) => ["requested", "cancel_requested"].includes(item.status)).length
  );
};

const refreshDestinationOptions = () => {
  const select = document.querySelector("[data-destination-options]");
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = '<option value="">여행지 선택</option>' + state.destinations
    .filter((item) => item.status !== "hidden")
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.region)}</option>`)
    .join("");
  select.value = currentValue;
};

const renderAll = () => {
  renderMetrics();
  renderDestinations();
  renderStays();
  renderReservations();
  renderMembers();
  renderRecentReservations();
  refreshDestinationOptions();
};

const snapshotToArray = (snapshot) => {
  const value = snapshot.val() || {};
  return Object.entries(value).map(([id, item]) => ({ id, ...item }));
};

const startRealtimeData = () => {
  ["destinations", "stays", "reservations", "members"].forEach((path) => {
    onValue(
      ref(database, path),
      (snapshot) => {
        state[path] = snapshotToArray(snapshot);
        renderAll();
      },
      () => showMessage("데이터를 불러오지 못했습니다. Database Rules와 관리자 계정을 확인해 주세요.")
    );
  });
};

const viewMeta = {
  overview: ["OVERVIEW", "운영 현황"],
  destinations: ["DESTINATIONS", "여행지 관리"],
  stays: ["STAYS", "숙소 관리"],
  reservations: ["RESERVATIONS", "예약 확인"],
  members: ["MEMBERS", "회원정보"]
};

const showView = (name) => {
  document.querySelectorAll("[data-view]").forEach((view) => {
    const active = view.dataset.view === name;
    view.classList.toggle("is-active", active);
    view.hidden = !active;
  });
  document.querySelectorAll("[data-admin-view]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminView === name));
  document.querySelector("[data-view-kicker]").textContent = viewMeta[name][0];
  document.querySelector("[data-view-title]").textContent = viewMeta[name][1];
  document.querySelector("[data-sidebar]")?.classList.remove("is-open");
  document.querySelector("[data-sidebar-toggle]")?.setAttribute("aria-expanded", "false");
};

const openEditor = (type, id = "") => {
  const form = type === "destination" ? destinationForm : stayForm;
  const otherForm = type === "destination" ? stayForm : destinationForm;
  const source = id ? state[type === "destination" ? "destinations" : "stays"].find((item) => item.id === id) : null;

  otherForm.hidden = true;
  form.hidden = false;
  form.reset();
  form.elements.id.value = id;
  form.querySelector("h2").textContent = `${type === "destination" ? "여행지" : "숙소"} ${id ? "수정" : "등록"}`;
  form.querySelector("[data-form-error]").textContent = "";

  if (source) {
    [...form.elements].forEach((element) => {
      if (element.name && element.name !== "id" && source[element.name] !== undefined) element.value = source[element.name];
    });
  }
  if (!editorDialog.open) editorDialog.showModal();
  window.setTimeout(() => form.querySelector("input:not([type='hidden'])")?.focus(), 0);
};

const closeEditor = () => {
  if (editorDialog?.open) editorDialog.close();
};

const saveEntity = async (event, type) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const id = String(data.get("id") || "");
  const existing = id ? state[type === "destination" ? "destinations" : "stays"].find((item) => item.id === id) : null;
  const now = new Date().toISOString();
  const targetRef = id ? ref(database, `${type === "destination" ? "destinations" : "stays"}/${id}`) : push(ref(database, type === "destination" ? "destinations" : "stays"));

  const payload =
    type === "destination"
      ? {
          name: String(data.get("name") || "").trim(),
          region: String(data.get("region") || "").trim(),
          address: String(data.get("address") || "").trim(),
          summary: String(data.get("summary") || "").trim(),
          description: String(data.get("description") || "").trim(),
          imageUrl: String(data.get("imageUrl") || "").trim(),
          status: String(data.get("status") || "draft"),
          createdAt: existing?.createdAt || now,
          updatedAt: now
        }
      : {
          destinationId: String(data.get("destinationId") || ""),
          name: String(data.get("name") || "").trim(),
          address: String(data.get("address") || "").trim(),
          description: String(data.get("description") || "").trim(),
          phone: String(data.get("phone") || "").trim(),
          pricePerNight: Number(data.get("pricePerNight")),
          maxGuests: Number(data.get("maxGuests")),
          imageUrl: String(data.get("imageUrl") || "").trim(),
          status: String(data.get("status") || "active"),
          createdAt: existing?.createdAt || now,
          updatedAt: now
        };

  if (Object.values(payload).some((value) => value === "" || value === null || Number.isNaN(value))) {
    form.querySelector("[data-form-error]").textContent = "모든 필수 항목을 올바르게 입력해 주세요.";
    return;
  }

  const button = form.querySelector("button[type='submit']");
  button.disabled = true;
  try {
    await set(targetRef, payload);
    closeEditor();
    showMessage(`${type === "destination" ? "여행지" : "숙소"} 정보가 저장되었습니다.`);
  } catch {
    form.querySelector("[data-form-error]").textContent = "저장에 실패했습니다. 관리자 권한과 입력값을 확인해 주세요.";
  } finally {
    button.disabled = false;
  }
};

const deleteEntity = async (type, id) => {
  try {
    if (type === "destination") {
      const linkedStays = state.stays.filter((item) => item.destinationId === id);
      if (linkedStays.length) {
        await update(ref(database, `destinations/${id}`), { status: "hidden", updatedAt: new Date().toISOString() });
        showMessage("연결된 숙소가 있어 여행지를 영구 삭제하지 않고 숨김 처리했습니다.");
      } else {
        await remove(ref(database, `destinations/${id}`));
        showMessage("여행지가 삭제되었습니다.");
      }
      return;
    }

    const hasReservations = state.reservations.some((item) => item.stayId === id);
    if (hasReservations) {
      await update(ref(database, `stays/${id}`), { status: "inactive", updatedAt: new Date().toISOString() });
      showMessage("예약 기록이 있어 숙소를 영구 삭제하지 않고 비활성화했습니다.");
    } else {
      await remove(ref(database, `stays/${id}`));
      showMessage("숙소가 삭제되었습니다.");
    }
  } catch {
    showMessage("삭제 처리에 실패했습니다. 관리자 권한과 연결 데이터를 확인해 주세요.");
  }
};

const detailFields = {
  destination: [["name", "여행지명"], ["region", "지역"], ["address", "주소"], ["summary", "한 줄 소개"], ["description", "상세 설명"], ["imageUrl", "이미지 URL"], ["status", "상태"], ["createdAt", "등록일"], ["updatedAt", "수정일"]],
  stay: [["name", "숙소명"], ["destinationId", "여행지"], ["address", "주소"], ["description", "설명"], ["phone", "연락처"], ["pricePerNight", "1박 가격"], ["maxGuests", "최대 인원"], ["imageUrl", "이미지 URL"], ["status", "상태"], ["createdAt", "등록일"], ["updatedAt", "수정일"]],
  reservation: [["id", "예약번호"], ["memberId", "회원"], ["stayId", "숙소"], ["checkIn", "체크인"], ["checkOut", "체크아웃"], ["guestCount", "인원"], ["nightlyPriceAtBooking", "예약 시점 1박 가격"], ["totalPrice", "예약 총액"], ["status", "상태"], ["createdAt", "신청일"], ["updatedAt", "수정일"]],
  member: [["id", "회원 UID"], ["name", "이름"], ["email", "이메일"], ["phone", "연락처"], ["status", "상태"], ["createdAt", "가입일"], ["updatedAt", "수정일"]]
};

const openDetail = (type, id) => {
  const plural = { destination: "destinations", stay: "stays", reservation: "reservations", member: "members" }[type];
  const item = state[plural].find((entry) => entry.id === id);
  if (!item) return;
  const titles = { destination: "여행지 상세", stay: "숙소 상세", reservation: "예약 상세", member: "회원 상세" };
  document.querySelector("[data-detail-title]").textContent = titles[type];
  document.querySelector("[data-detail-list]").innerHTML = detailFields[type]
    .map(([key, label]) => {
      let value = item[key] ?? "-";
      if (key === "destinationId") value = `${destinationName(value)} (${value})`;
      if (key === "stayId") value = `${stayName(value)} (${value})`;
      if (key === "memberId") value = `${memberName(value)} (${value})`;
      if (["pricePerNight", "nightlyPriceAtBooking", "totalPrice"].includes(key)) value = formatPrice(value);
      if (key === "guestCount" || key === "maxGuests") value = `${value}명`;
      if (key === "status") value = statusLabels[value] || value;
      if (["createdAt", "updatedAt"].includes(key)) value = formatDate(value);
      return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
    })
    .join("");
  if (!detailDialog.open) detailDialog.showModal();
};

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-admin-view], [data-go-view]");
  if (viewButton) showView(viewButton.dataset.adminView || viewButton.dataset.goView);

  const newButton = event.target.closest("[data-new-item]");
  if (newButton) openEditor(newButton.dataset.newItem);

  const editButton = event.target.closest("[data-edit-type]");
  if (editButton) openEditor(editButton.dataset.editType, editButton.dataset.id);

  const deleteButton = event.target.closest("[data-delete-type]");
  if (deleteButton) await deleteEntity(deleteButton.dataset.deleteType, deleteButton.dataset.id);

  const detailButton = event.target.closest("[data-detail-type]");
  if (detailButton) openDetail(detailButton.dataset.detailType, detailButton.dataset.id);

  const memberButton = event.target.closest("[data-toggle-member]");
  if (memberButton) {
    const nextStatus = memberButton.dataset.status === "suspended" ? "active" : "suspended";
    try {
      await update(ref(database, `members/${memberButton.dataset.id}`), { status: nextStatus, updatedAt: new Date().toISOString() });
      showMessage(`회원 상태가 ${statusLabels[nextStatus]} 상태로 변경되었습니다.`);
    } catch {
      showMessage("회원 상태 변경에 실패했습니다.");
    }
  }
});

document.querySelectorAll("[data-list-search]").forEach((input) => {
  input.addEventListener("input", () => {
    state.filters[input.dataset.listSearch] = input.value.trim();
    renderAll();
  });
});

document.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-reservation-status]");
  if (!select) return;
  try {
    await update(ref(database, `reservations/${select.dataset.id}`), { status: select.value, updatedAt: new Date().toISOString() });
    showMessage("예약 상태가 변경되었습니다.");
  } catch {
    showMessage("예약 상태 변경에 실패했습니다.");
  }
});

destinationForm?.addEventListener("submit", (event) => saveEntity(event, "destination"));
stayForm?.addEventListener("submit", (event) => saveEntity(event, "stay"));
document.querySelector("[data-close-editor]")?.addEventListener("click", closeEditor);
document.querySelectorAll("[data-close-detail]").forEach((button) => button.addEventListener("click", () => detailDialog.close()));
document.querySelector("[data-close-admin-message]")?.addEventListener("click", closeMessage);

document.querySelector("[data-sidebar-toggle]")?.addEventListener("click", (event) => {
  const sidebar = document.querySelector("[data-sidebar]");
  const willOpen = !sidebar.classList.contains("is-open");
  sidebar.classList.toggle("is-open", willOpen);
  event.currentTarget.setAttribute("aria-expanded", String(willOpen));
});

document.querySelector("[data-admin-logout]")?.addEventListener("click", async () => {
  try {
    await signOut(auth);
    showMessage("관리자 로그아웃되었습니다.", () => {
      window.location.href = "../../index.html";
    });
  } catch {
    showMessage("로그아웃 처리에 실패했습니다.");
  }
});

document.querySelector("[data-today]").textContent = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "short"
}).format(new Date());

onAuthStateChanged(auth, (user) => {
  if (!adminReady()) {
    guard.querySelector(".loader")?.remove();
    guard.querySelector("p").textContent = "관리자 설정이 필요합니다. js/firebase-config.js의 관리자 이메일을 입력하세요.";
    return;
  }
  if (!isAdminUser(user)) {
    guard.querySelector(".loader")?.remove();
    guard.querySelector("p").textContent = "관리자 권한이 없습니다. 메인 화면의 관리자 로그인으로 이동합니다.";
    window.setTimeout(() => {
      window.location.href = "../../index.html";
    }, 1400);
    return;
  }

  document.querySelector("[data-admin-email]").textContent = user.email || adminAuthConfig.email;
  guard.hidden = true;
  appRoot.hidden = false;
  startRealtimeData();
});
