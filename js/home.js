(() => {
  const form = document.querySelector("[data-search-form]");
  const message = document.querySelector("[data-search-message]");
  const cards = [...document.querySelectorAll("[data-destination-grid] .destination-card")];
  const emptyResult = document.querySelector("[data-empty-result]");
  const regionTabs = [...document.querySelectorAll("[data-region]")];

  if (!form || !message) return;

  const checkIn = form.elements.checkIn;
  const checkOut = form.elements.checkOut;
  const today = new Date();
  const todayString = today.toISOString().split("T")[0];
  checkIn.min = todayString;
  checkOut.min = todayString;

  const setMessage = (text, isError = false) => {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
    message.classList.add("is-visible");
  };

  const filterCards = ({ keyword = "", region = "all" } = {}) => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("ko-KR");
    let visibleCount = 0;

    cards.forEach((card) => {
      const matchesKeyword = !normalizedKeyword || card.dataset.keywords.toLocaleLowerCase("ko-KR").includes(normalizedKeyword);
      const matchesRegion = region === "all" || card.dataset.region === region;
      const shouldShow = matchesKeyword && matchesRegion;
      card.hidden = !shouldShow;
      if (shouldShow) visibleCount += 1;
    });

    if (emptyResult) emptyResult.hidden = visibleCount !== 0;
    return visibleCount;
  };

  checkIn.addEventListener("change", () => {
    checkOut.min = checkIn.value || todayString;
    if (checkOut.value && checkOut.value <= checkIn.value) checkOut.value = "";
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const keyword = String(data.get("keyword") || "");
    const start = String(data.get("checkIn") || "");
    const end = String(data.get("checkOut") || "");

    if ((start && !end) || (!start && end)) {
      setMessage("체크인과 체크아웃 날짜를 모두 선택해 주세요.", true);
      return;
    }

    if (start && end && end <= start) {
      setMessage("체크아웃 날짜는 체크인 날짜보다 뒤여야 합니다.", true);
      return;
    }

    const visibleCount = filterCards({ keyword });
    document.querySelector("#destinations")?.scrollIntoView({ behavior: "smooth" });

    if (!keyword.trim()) {
      setMessage("추천 여행지를 보여드릴게요. 날짜별 숙소 검색은 다음 단계에서 연결됩니다.");
    } else if (visibleCount) {
      setMessage(`‘${keyword.trim()}’와(과) 관련된 추천 여행지를 찾았습니다.`);
    } else {
      setMessage(`‘${keyword.trim()}’ 검색 결과가 없습니다. 다른 지역을 입력해 보세요.`, true);
    }
  });

  regionTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      regionTabs.forEach((item) => {
        const isSelected = item === tab;
        item.classList.toggle("is-active", isSelected);
        item.setAttribute("aria-pressed", String(isSelected));
      });
      form.elements.keyword.value = "";
      filterCards({ region: tab.dataset.region });
    });
  });
})();
