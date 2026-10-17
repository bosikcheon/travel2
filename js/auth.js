import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { get, ref, set } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { auth, database } from "./firebase.js?v=3";
import { adminAuthConfig } from "./firebase-config.js?v=3";

const authDialog = document.querySelector("[data-auth-dialog]");
const messageDialog = document.querySelector("[data-message-dialog]");
const messageText = document.querySelector("[data-message-text]");
const panels = [...document.querySelectorAll("[data-auth-panel]")];
const actionButtons = [...document.querySelectorAll("[data-auth-action]")];
let messageCloseCallback = null;

const isAdminConfigured = () =>
  Boolean(
    adminAuthConfig.email &&
      !adminAuthConfig.email.startsWith("YOUR_")
  );

const isAdminUser = (user) =>
  Boolean(
    user &&
      isAdminConfigured() &&
      user.email?.toLocaleLowerCase() === adminAuthConfig.email.toLocaleLowerCase() &&
      (!adminAuthConfig.uid || user.uid === adminAuthConfig.uid)
  );

const closeAuthDialog = () => {
  if (authDialog?.open) authDialog.close();
  panels.forEach((panel) => {
    panel.hidden = true;
    const error = panel.querySelector("[data-auth-error]");
    if (error) error.textContent = "";
  });
};

const openAuthDialog = (panelName) => {
  const activePanel = panels.find((panel) => panel.dataset.authPanel === panelName);
  if (!activePanel || !authDialog) return;

  panels.forEach((panel) => {
    panel.hidden = panel !== activePanel;
  });
  authDialog.setAttribute("aria-labelledby", `${panelName}-dialog-title`);
  if (!authDialog.open) authDialog.showModal();
  window.setTimeout(() => activePanel.querySelector("input:not([readonly])")?.focus(), 0);
};

const showMessage = (message, onClose = null) => {
  closeAuthDialog();
  if (!messageDialog || !messageText) return;
  messageText.textContent = message;
  messageCloseCallback = onClose;
  if (!messageDialog.open) messageDialog.showModal();
};

window.showSiteMessage = showMessage;
window.authUiReady = true;

const closeMessage = () => {
  if (messageDialog?.open) messageDialog.close();
  const callback = messageCloseCallback;
  messageCloseCallback = null;
  callback?.();
};

const setSubmitting = (form, isSubmitting) => {
  const button = form.querySelector("button[type='submit']");
  if (!button) return;
  button.disabled = isSubmitting;
  button.dataset.originalText ||= button.textContent;
  button.textContent = isSubmitting ? "처리 중…" : button.dataset.originalText;
};

const setFormError = (form, message) => {
  const error = form.querySelector("[data-auth-error]");
  if (error) error.textContent = message;
};

const updateHeaderForUser = (user) => {
  const admin = isAdminUser(user);
  const member = Boolean(user && !admin);
  const visibility = {
    reserve: !admin,
    signup: !user,
    login: !user,
    logout: member,
    "admin-login": !user,
    "admin-logout": admin
  };

  actionButtons.forEach((button) => {
    button.hidden = !visibility[button.dataset.authAction];
  });
};

document.querySelector("[data-close-dialog]")?.addEventListener("click", closeAuthDialog);
document.querySelector("[data-message-confirm]")?.addEventListener("click", closeMessage);

authDialog?.addEventListener("click", (event) => {
  if (event.target === authDialog) closeAuthDialog();
});

messageDialog?.addEventListener("click", (event) => {
  if (event.target === messageDialog) closeMessage();
});

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-auth-action]");
  if (!button) return;

  const action = button.dataset.authAction;
  if (action === "signup" || action === "login" || action === "admin-login") {
    openAuthDialog(action);
    return;
  }

  if (action === "reserve") {
    if (!auth.currentUser) {
      showMessage("로그인후 예약하시오");
      return;
    }
    showMessage("여행지와 숙소를 선택한 뒤 예약을 신청할 수 있습니다.", () => {
      document.querySelector("#stays")?.scrollIntoView({ behavior: "smooth" });
    });
    return;
  }

  if (action === "logout" || action === "admin-logout") {
    try {
      await signOut(auth);
      showMessage(action === "admin-logout" ? "관리자 로그아웃되었습니다." : "로그아웃되었습니다");
    } catch {
      showMessage("로그아웃 처리에 실패했습니다.");
    }
  }
});

document.querySelector("[data-signup-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const phone = String(data.get("phone") || "").trim();
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  const passwordConfirm = String(data.get("passwordConfirm") || "");

  setFormError(form, "");
  if (!name || !phone || !email || !password || !passwordConfirm) {
    setFormError(form, "모든 필수 항목을 입력해 주세요.");
    return;
  }
  if (password.length < 6) {
    setFormError(form, "비밀번호는 6자 이상이어야 합니다.");
    return;
  }
  if (password !== passwordConfirm) {
    setFormError(form, "비밀번호 확인이 일치하지 않습니다.");
    return;
  }

  setSubmitting(form, true);
  let createdUser = null;
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    createdUser = credential.user;
    const now = new Date().toISOString();
    await set(ref(database, `members/${createdUser.uid}`), {
      uid: createdUser.uid,
      name,
      email,
      phone,
      status: "active",
      createdAt: now,
      updatedAt: now
    });
    await signOut(auth);
    form.reset();
    showMessage("가입 완료되었습니다.");
  } catch (error) {
    if (createdUser) {
      try {
        await deleteUser(createdUser);
      } catch {
        // 계정 롤백 실패는 콘솔에 민감한 정보를 남기지 않고 사용자에게 재시도를 안내한다.
      }
    }
    const knownMessage =
      error?.code === "auth/email-already-in-use"
        ? "이미 가입된 이메일입니다."
        : error?.code === "auth/invalid-email"
          ? "이메일 형식을 확인해 주세요."
          : "회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.";
    setFormError(form, knownMessage);
  } finally {
    setSubmitting(form, false);
  }
});

document.querySelector("[data-login-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");

  setFormError(form, "");
  if (!email || !password) {
    setFormError(form, "이메일과 비밀번호를 입력해 주세요.");
    return;
  }

  setSubmitting(form, true);
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    if (isAdminUser(credential.user)) {
      await signOut(auth);
      showMessage("일반 로그인에서는 관리자 계정을 사용할 수 없습니다.");
      return;
    }

    const profile = await get(ref(database, `members/${credential.user.uid}`));
    if (profile.exists() && profile.val().status === "suspended") {
      await signOut(auth);
      showMessage("로그인 실패되었습니다.");
      return;
    }
    form.reset();
    showMessage("로그인 되었습니다.");
  } catch {
    showMessage("로그인 실패되었습니다.");
  } finally {
    setSubmitting(form, false);
  }
});

document.querySelector("[data-admin-login-form]")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const username = String(data.get("username") || "").trim();
  const password = String(data.get("password") || "");

  setFormError(form, "");
  if (username !== adminAuthConfig.username) {
    showMessage("관리자 로그인 실패되었습니다.");
    return;
  }
  if (!password) {
    setFormError(form, "비밀번호를 입력해 주세요.");
    return;
  }
  if (!isAdminConfigured()) {
    showMessage("관리자 계정 설정이 필요합니다.\njs/firebase-config.js에 관리자 이메일을 입력해 주세요.");
    return;
  }

  setSubmitting(form, true);
  try {
    const credential = await signInWithEmailAndPassword(auth, adminAuthConfig.email, password);
    if (!isAdminUser(credential.user)) {
      await signOut(auth);
      showMessage("관리자 로그인 실패되었습니다.");
      return;
    }
    form.reset();
    showMessage("관리자 로그인 성공", () => {
      window.location.href = "html/admin/admin.html";
    });
  } catch {
    showMessage("관리자 로그인 실패되었습니다.");
  } finally {
    setSubmitting(form, false);
  }
});

onAuthStateChanged(auth, updateHeaderForUser);
