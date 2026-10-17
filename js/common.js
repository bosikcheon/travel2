(() => {
  const header = document.querySelector("[data-header]");
  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".primary-navigation");
  const backToTopButton = document.querySelector("[data-back-to-top]");
  const toast = document.querySelector("[data-toast]");
  const authDialog = document.querySelector("[data-auth-dialog]");
  const messageDialog = document.querySelector("[data-message-dialog]");
  const messageText = document.querySelector("[data-message-text]");
  let toastTimer;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
  };

  window.showSiteToast = showToast;

  const showBasicMessageDialog = (message) => {
    if (!messageDialog || !messageText) {
      showToast(message);
      return;
    }
    messageText.textContent = message;
    if (!messageDialog.open) messageDialog.showModal();

    if (!messageDialog.dataset.basicEventsBound) {
      messageDialog.dataset.basicEventsBound = "true";
      messageDialog.querySelector("[data-message-confirm]")?.addEventListener("click", () => {
        if (messageDialog.open) messageDialog.close();
      });
      messageDialog.addEventListener("click", (event) => {
        if (event.target === messageDialog && messageDialog.open) messageDialog.close();
      });
    }
  };

  const openBasicAuthDialog = (panelName) => {
    if (!authDialog) return;
    const panels = [...authDialog.querySelectorAll("[data-auth-panel]")];
    const activePanel = panels.find((panel) => panel.dataset.authPanel === panelName);
    if (!activePanel) return;
    panels.forEach((panel) => {
      panel.hidden = panel !== activePanel;
    });
    authDialog.setAttribute("aria-labelledby", `${panelName}-dialog-title`);
    if (!authDialog.open) authDialog.showModal();
  };

  authDialog?.addEventListener("click", (event) => {
    if (window.authUiReady) return;
    if (event.target.closest("[data-close-dialog]") || event.target === authDialog) {
      authDialog.close();
    }
  });

  document
    .querySelectorAll("[data-signup-form], [data-login-form], [data-admin-login-form]")
    .forEach((form) => {
      form.addEventListener("submit", (event) => {
        if (window.authUiReady) return;
        event.preventDefault();
        if (authDialog?.open) authDialog.close();
        showBasicMessageDialog("인증 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.");
      });
    });

  const closeMenu = () => {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.querySelector(".sr-only").textContent = "메뉴 열기";
    navigation.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  };

  menuButton?.addEventListener("click", () => {
    const willOpen = menuButton.getAttribute("aria-expanded") !== "true";
    menuButton.setAttribute("aria-expanded", String(willOpen));
    menuButton.querySelector(".sr-only").textContent = willOpen ? "메뉴 닫기" : "메뉴 열기";
    navigation?.classList.toggle("is-open", willOpen);
    document.body.classList.toggle("menu-open", willOpen);
  });

  navigation?.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) closeMenu();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 820) closeMenu();
  });

  const updateScrollState = () => {
    header?.classList.toggle("is-scrolled", window.scrollY > 24);
    const isAwayFromTop = window.scrollY > 0;
    backToTopButton?.classList.toggle("is-visible", isAwayFromTop);
    backToTopButton?.setAttribute("aria-hidden", String(!isAwayFromTop));
    if (backToTopButton) backToTopButton.tabIndex = isAwayFromTop ? 0 : -1;
  };

  updateScrollState();
  window.addEventListener("scroll", updateScrollState, { passive: true });

  backToTopButton?.addEventListener("click", () => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  });

  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
  });

  document.addEventListener("click", (event) => {
    const pendingControl = event.target.closest("[data-coming-soon]");
    if (pendingControl) {
      event.preventDefault();
      const featureName = pendingControl.dataset.comingSoon || "이 기능";
      const message = `${featureName} 기능은 다음 구현 단계에서 연결됩니다.`;
      if (typeof window.showSiteMessage === "function") window.showSiteMessage(message);
      else showBasicMessageDialog(message);
      return;
    }

    const authControl = event.target.closest("[data-auth-action]");
    if (!authControl || window.authUiReady) return;
    const action = authControl.dataset.authAction;
    if (["signup", "login", "admin-login"].includes(action)) {
      openBasicAuthDialog(action);
    } else if (action === "reserve") {
      showBasicMessageDialog("로그인후 예약하시오");
    }
  });

  const revealItems = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12 }
    );
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }
})();
