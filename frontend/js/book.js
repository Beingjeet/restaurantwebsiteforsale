// Consolidated booking script
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#bookingForm, #diningForm");
  const msgEl =
    document.getElementById("msg") || document.getElementById("diningMsg");
  const googleWrap = document.getElementById("googleFormWrap");
  if (!form) return;

  const submitBtn = form.querySelector(
    'button[type="submit"], input[type="submit"]'
  );

  const cfg = {
    api: (form.dataset.api || "").trim(),
    sheetdb: (form.dataset.sheetdb || "").trim(),
    maxTables: parseInt(form.dataset.max || form.dataset.maxtables || "12", 10),
    openHour: parseInt(form.dataset.open || "18", 10),
    closeHour: parseInt(form.dataset.close || "23", 10),
  };

  function showMessage(text, type = "info") {
    if (!msgEl) return;
    msgEl.style.display = "block";
    msgEl.textContent = text;
    msgEl.className = "";
    if (type === "success") msgEl.classList.add("success");
    if (type === "error") msgEl.classList.add("error");
  }

  function gather() {
    const data = {};
    const fields = [
      "name",
      "phone",
      "email",
      "date",
      "time",
      "guests",
      "notes",
    ];
    fields.forEach((n) => {
      const el = form.querySelector(`[name="${n}"]`);
      if (el) data[n] = (el.value || "").trim();
    });
    // fallback: include any other named elements
    Array.from(form.elements).forEach((el) => {
      if (!el.name) return;
      if (data[el.name] !== undefined) return;
      if (el.type === "checkbox") data[el.name] = el.checked;
      else data[el.name] = (el.value || "").trim();
    });
    return data;
  }

  async function postJson(url, payload) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res;
  }

  async function sheetSearch(sheetdbUrl, q) {
    // sheetdb.io search endpoint (if using SheetDB)
    try {
      const qs = Object.keys(q)
        .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(q[k])}`)
        .join("&");
      const res = await fetch(`${sheetdbUrl}/search?${qs}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function tryAvailabilityCheck(payload) {
    // Only attempt if sheetdb URL is provided or data-api contains sheetdb
    const sheetdbUrl =
      cfg.sheetdb ||
      (cfg.api && cfg.api.includes("sheetdb.io") ? cfg.api : null);
    if (!sheetdbUrl) return { checked: false };
    const { date, time } = payload;
    if (!date || !time) return { checked: false };
    const rows = await sheetSearch(sheetdbUrl, {
      date,
      time,
      status: "CONFIRMED",
    });
    if (!rows) return { checked: false };
    return { checked: true, confirmed: rows.length };
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.setAttribute("aria-busy", "true");
    }
    showMessage("Sending booking...");

    const payload = gather();

    // time window check
    if (payload.time) {
      const [h] = payload.time.split(":").map(Number);
      if (Number.isFinite(cfg.openHour) && Number.isFinite(cfg.closeHour)) {
        if (h < cfg.openHour || h >= cfg.closeHour) {
          showMessage(
            `Bookings allowed between ${cfg.openHour}:00 and ${cfg.closeHour}:00.`,
            "error"
          );
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute("aria-busy");
          }
          return;
        }
      }
    }

    // availability check (optional)
    const avail = await tryAvailabilityCheck(payload);
    if (avail.checked && avail.confirmed !== undefined) {
      if (avail.confirmed >= cfg.maxTables) {
        showMessage(
          "All tables are full at this time. Please try another slot.",
          "error"
        );
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.removeAttribute("aria-busy");
        }
        return;
      }
    }

    // build candidates
    const candidates = [];
    if (cfg.api) candidates.push(cfg.api);
    const action = form.getAttribute("action");
    if (action) candidates.push(action);
    if (!candidates.includes("/api/bookings")) candidates.push("/api/bookings");

    let success = false;
    let lastError = null;
    for (const url of candidates) {
      try {
        const res = await postJson(url, payload);
        if (res.ok) {
          showMessage(
            "Booking received. We will contact you shortly.",
            "success"
          );
          form.reset();
          if (googleWrap) googleWrap.style.display = "none";
          success = true;
          break;
        } else {
          lastError = `Server returned ${res.status} for ${url}`;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!success) {
      console.warn(
        "Booking failed for candidates",
        candidates,
        "lastError",
        lastError
      );
      showMessage(
        "Automatic submission failed — please use the fallback form below or contact us.",
        "error"
      );
      if (googleWrap) {
        googleWrap.style.display = "block";
        googleWrap.scrollIntoView({ behavior: "smooth" });
      }
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.removeAttribute("aria-busy");
    }
  });
});
