(function () {
  "use strict";

  const STORAGE_KEY = "sessionLinkHelper.settings.v1";

  // The fixed, positional field order any connected Google Form must use.
  const FIELD_DEFS = [
    { key: "date", label: "Therapy Date" },
    { key: "startTime", label: "Start Time" },
    { key: "endTime", label: "End Time" },
    { key: "durationMinutes", label: "Duration in Minutes" },
    { key: "sessionType", label: "Session Type" },
    { key: "numberInSession", label: "Number in Session" },
    { key: "studentName", label: "Student Name" },
  ];

  const DEFAULT_SETTINGS = {
    roster: [],
    sessionTypes: ["Push In", "Pull Out", "Teletherapy", "Consult"],
    formConfig: null, // { baseUrl, entries: { date, startTime, ... } }
    meta: { lastChanged: null, lastExported: null },
  };

  // ---------- storage ----------

  function loadSettings() {
    let raw;
    try {
      raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (e) {
      raw = null;
    }
    if (!raw || typeof raw !== "object") {
      return structuredClone(DEFAULT_SETTINGS);
    }
    return {
      roster: Array.isArray(raw.roster) ? raw.roster : [],
      sessionTypes: Array.isArray(raw.sessionTypes)
        ? raw.sessionTypes
        : structuredClone(DEFAULT_SETTINGS.sessionTypes),
      formConfig: isValidFormConfig(raw.formConfig) ? raw.formConfig : null,
      meta: {
        lastChanged: raw.meta && raw.meta.lastChanged ? raw.meta.lastChanged : null,
        lastExported: raw.meta && raw.meta.lastExported ? raw.meta.lastExported : null,
      },
    };
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function markChanged() {
    settings.meta.lastChanged = new Date().toISOString();
    persist();
  }

  function isValidFormConfig(fc) {
    if (!fc || typeof fc !== "object") return false;
    if (typeof fc.baseUrl !== "string" || !fc.baseUrl) return false;
    if (!fc.entries || typeof fc.entries !== "object") return false;
    return FIELD_DEFS.every((f) => typeof fc.entries[f.key] === "string" && fc.entries[f.key]);
  }

  let settings = loadSettings();

  // ---------- dom refs ----------

  const el = {
    openSettingsBtn: document.getElementById("openSettingsBtn"),
    closeSettingsBtn: document.getElementById("closeSettingsBtn"),
    settingsOverlay: document.getElementById("settingsOverlay"),

    connectionBanner: document.getElementById("connectionBanner"),
    connectionBannerBtn: document.getElementById("connectionBannerBtn"),

    exportReminder: document.getElementById("exportReminder"),
    exportReminderText: document.getElementById("exportReminderText"),
    exportReminderBtn: document.getElementById("exportReminderBtn"),

    fieldDate: document.getElementById("fieldDate"),
    fieldStartTime: document.getElementById("fieldStartTime"),
    fieldEndTime: document.getElementById("fieldEndTime"),
    fieldDuration: document.getElementById("fieldDuration"),
    fieldSessionType: document.getElementById("fieldSessionType"),
    sessionError: document.getElementById("sessionError"),

    rosterEmptyMsg: document.getElementById("rosterEmptyMsg"),
    studentFilter: document.getElementById("studentFilter"),
    studentChecklist: document.getElementById("studentChecklist"),
    selectedCount: document.getElementById("selectedCount"),
    generateBtn: document.getElementById("generateBtn"),

    linksSection: document.getElementById("linksSection"),
    linksList: document.getElementById("linksList"),

    fieldOrderList: document.getElementById("fieldOrderList"),
    connectionStatus: document.getElementById("connectionStatus"),
    prefilledLinkInput: document.getElementById("prefilledLinkInput"),
    parseLinkBtn: document.getElementById("parseLinkBtn"),
    testLinkBtn: document.getElementById("testLinkBtn"),
    disconnectFormBtn: document.getElementById("disconnectFormBtn"),
    parseError: document.getElementById("parseError"),
    parsePreview: document.getElementById("parsePreview"),
    previewTableBody: document.getElementById("previewTableBody"),
    saveConnectionBtn: document.getElementById("saveConnectionBtn"),

    rosterList: document.getElementById("rosterList"),
    newStudentName: document.getElementById("newStudentName"),
    addStudentBtn: document.getElementById("addStudentBtn"),

    sessionTypeList: document.getElementById("sessionTypeList"),
    newSessionType: document.getElementById("newSessionType"),
    addSessionTypeBtn: document.getElementById("addSessionTypeBtn"),

    lastChangedText: document.getElementById("lastChangedText"),
    lastExportedText: document.getElementById("lastExportedText"),
    exportBtn: document.getElementById("exportBtn"),
    importFile: document.getElementById("importFile"),
  };

  let pendingConnection = null; // parsed-but-unsaved form connection

  // ---------- settings modal ----------

  function openSettings(tab) {
    el.settingsOverlay.hidden = false;
    if (tab) switchTab(tab);
  }

  function closeSettings() {
    el.settingsOverlay.hidden = true;
  }

  function switchTab(tab) {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== tab;
    });
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  el.openSettingsBtn.addEventListener("click", () => openSettings());
  el.closeSettingsBtn.addEventListener("click", closeSettings);
  el.connectionBannerBtn.addEventListener("click", () => openSettings("form"));
  el.settingsOverlay.addEventListener("click", (e) => {
    if (e.target === el.settingsOverlay) closeSettings();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el.settingsOverlay.hidden) closeSettings();
  });

  // ---------- rendering ----------

  function formatTimestamp(iso) {
    if (!iso) return "never";
    return new Date(iso).toLocaleString();
  }

  function renderFieldOrderList() {
    el.fieldOrderList.innerHTML = "";
    FIELD_DEFS.forEach((f) => {
      const li = document.createElement("li");
      li.textContent = f.label;
      el.fieldOrderList.appendChild(li);
    });
  }

  function renderConnectionStatus() {
    const connected = !!settings.formConfig;
    el.connectionBanner.hidden = connected;
    el.testLinkBtn.hidden = !connected;
    el.disconnectFormBtn.hidden = !connected;
    el.connectionStatus.textContent = connected
      ? `Connected to: ${settings.formConfig.baseUrl}`
      : "Not connected to a form yet.";
  }

  function renderExportReminder() {
    const changed = settings.meta.lastChanged;
    const exported = settings.meta.lastExported;
    const needsExport = changed && (!exported || new Date(changed) > new Date(exported));
    el.exportReminder.hidden = !needsExport;
    if (needsExport) {
      el.exportReminderText.textContent =
        "Your settings have changed since your last export. Export a backup so you don't lose them.";
    }
    el.lastChangedText.textContent = formatTimestamp(changed);
    el.lastExportedText.textContent = formatTimestamp(exported);
  }

  function renderSessionTypeOptions() {
    const current = el.fieldSessionType.value;
    el.fieldSessionType.innerHTML = "";
    settings.sessionTypes.forEach((type) => {
      const opt = document.createElement("option");
      opt.value = type;
      opt.textContent = type;
      el.fieldSessionType.appendChild(opt);
    });
    if (settings.sessionTypes.includes(current)) {
      el.fieldSessionType.value = current;
    }
  }

  function renderStudentChecklist() {
    el.studentChecklist.innerHTML = "";
    el.rosterEmptyMsg.hidden = settings.roster.length > 0;
    el.studentFilter.hidden = settings.roster.length === 0;
    settings.roster.forEach((name) => {
      const label = document.createElement("label");
      label.dataset.name = name.toLowerCase();
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = name;
      checkbox.className = "student-checkbox";
      checkbox.addEventListener("change", updateSelectedCount);
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(name));
      el.studentChecklist.appendChild(label);
    });
    applyStudentFilter();
    updateSelectedCount();
  }

  function applyStudentFilter() {
    const query = el.studentFilter.value.trim().toLowerCase();
    el.studentChecklist.querySelectorAll("label").forEach((label) => {
      label.hidden = query !== "" && !label.dataset.name.includes(query);
    });
  }

  el.studentFilter.addEventListener("input", applyStudentFilter);

  function getSelectedStudents() {
    return Array.from(document.querySelectorAll(".student-checkbox:checked")).map((cb) => cb.value);
  }

  function updateSelectedCount() {
    el.selectedCount.textContent = String(getSelectedStudents().length);
  }

  function renderManageList(container, items, onRemove, onReorder) {
    container.innerHTML = "";
    let dragSrcIndex = null;

    items.forEach((item, index) => {
      const li = document.createElement("li");
      li.draggable = true;

      const handle = document.createElement("span");
      handle.className = "drag-handle";
      handle.textContent = "⠿"; // ⠿
      handle.setAttribute("aria-hidden", "true");
      handle.title = "Drag to reorder";
      li.appendChild(handle);

      const nameSpan = document.createElement("span");
      nameSpan.className = "item-name";
      nameSpan.textContent = item;
      li.appendChild(nameSpan);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => onRemove(index));
      li.appendChild(removeBtn);

      li.addEventListener("dragstart", (e) => {
        dragSrcIndex = index;
        li.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
      });
      li.addEventListener("dragend", () => {
        container.querySelectorAll("li").forEach((row) => row.classList.remove("dragging", "drag-over"));
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        li.classList.add("drag-over");
      });
      li.addEventListener("dragleave", () => {
        li.classList.remove("drag-over");
      });
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        li.classList.remove("drag-over");
        const fromIndex = dragSrcIndex !== null ? dragSrcIndex : Number(e.dataTransfer.getData("text/plain"));
        if (Number.isNaN(fromIndex) || fromIndex === index) return;
        onReorder(fromIndex, index);
      });

      container.appendChild(li);
    });
  }

  function renderRosterManage() {
    renderManageList(
      el.rosterList,
      settings.roster,
      (index) => {
        settings.roster.splice(index, 1);
        markChanged();
        renderAll();
      },
      (fromIndex, toIndex) => {
        const [item] = settings.roster.splice(fromIndex, 1);
        settings.roster.splice(toIndex, 0, item);
        markChanged();
        renderAll();
      }
    );
  }

  function renderSessionTypeManage() {
    renderManageList(
      el.sessionTypeList,
      settings.sessionTypes,
      (index) => {
        settings.sessionTypes.splice(index, 1);
        markChanged();
        renderAll();
      },
      (fromIndex, toIndex) => {
        const [item] = settings.sessionTypes.splice(fromIndex, 1);
        settings.sessionTypes.splice(toIndex, 0, item);
        markChanged();
        renderAll();
      }
    );
  }

  function renderAll() {
    renderConnectionStatus();
    renderExportReminder();
    renderSessionTypeOptions();
    renderStudentChecklist();
    renderRosterManage();
    renderSessionTypeManage();
  }

  // ---------- duration ----------

  function computeDurationMinutes(start, end) {
    if (!start || !end) return null;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const diff = eh * 60 + em - (sh * 60 + sm);
    return diff > 0 ? diff : null;
  }

  function updateDuration() {
    const minutes = computeDurationMinutes(el.fieldStartTime.value, el.fieldEndTime.value);
    el.fieldDuration.value = minutes === null ? "" : String(minutes);
  }

  // ---------- link generation ----------

  function validateSession() {
    const errors = [];
    if (!settings.formConfig) errors.push("connect a Google Form in Settings");
    if (!el.fieldDate.value) errors.push("pick a therapy date");
    if (!el.fieldStartTime.value) errors.push("pick a start time");
    if (!el.fieldEndTime.value) errors.push("pick an end time");
    if (computeDurationMinutes(el.fieldStartTime.value, el.fieldEndTime.value) === null) {
      errors.push("end time must be after start time");
    }
    if (!el.fieldSessionType.value) errors.push("pick a session type");
    if (getSelectedStudents().length === 0) errors.push("select at least one student");
    return errors;
  }

  function buildFormUrl(values) {
    const params = new URLSearchParams();
    const entries = settings.formConfig.entries;
    FIELD_DEFS.forEach((f) => {
      if (values[f.key] !== undefined) params.set(entries[f.key], values[f.key]);
    });
    return `${settings.formConfig.baseUrl}?usp=pp_url&${params.toString()}`;
  }

  function generateLinks() {
    const errors = validateSession();
    el.sessionError.hidden = errors.length === 0;
    if (errors.length > 0) {
      el.sessionError.textContent = "Please " + errors.join(", ") + ".";
      el.linksSection.hidden = true;
      return;
    }

    const students = getSelectedStudents();
    el.linksList.innerHTML = "";
    students.forEach((name) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = buildFormUrl({
        date: el.fieldDate.value,
        startTime: el.fieldStartTime.value,
        endTime: el.fieldEndTime.value,
        durationMinutes: el.fieldDuration.value,
        sessionType: el.fieldSessionType.value,
        numberInSession: String(students.length),
        studentName: name,
      });
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = `Open form: ${name}`;
      a.addEventListener("click", () => a.classList.add("visited"));
      li.appendChild(a);
      el.linksList.appendChild(li);
    });
    el.linksSection.hidden = false;
  }

  // ---------- form connection parsing ----------

  function parsePrefilledLink(raw) {
    let url;
    try {
      url = new URL(raw.trim());
    } catch (e) {
      return { error: "That doesn't look like a valid URL." };
    }
    const entryPairs = [];
    for (const [key, value] of url.searchParams) {
      if (key.startsWith("entry.")) entryPairs.push([key, value]);
    }
    if (entryPairs.length !== FIELD_DEFS.length) {
      return {
        error:
          `Found ${entryPairs.length} field(s) in that link, but expected ${FIELD_DEFS.length}. ` +
          `Make sure your form has these questions, in this order, then get a fresh pre-filled link:\n` +
          FIELD_DEFS.map((f, i) => `${i + 1}. ${f.label}`).join("\n"),
      };
    }
    const baseUrl = url.origin + url.pathname;
    const entries = {};
    const preview = [];
    FIELD_DEFS.forEach((field, i) => {
      entries[field.key] = entryPairs[i][0];
      preview.push({ label: field.label, entryId: entryPairs[i][0], sampleValue: entryPairs[i][1] });
    });
    return { baseUrl, entries, preview };
  }

  function renderParsePreview(preview) {
    el.previewTableBody.innerHTML = "";
    preview.forEach((row) => {
      const tr = document.createElement("tr");
      [row.label, row.entryId, row.sampleValue].forEach((text) => {
        const td = document.createElement("td");
        td.textContent = text;
        tr.appendChild(td);
      });
      el.previewTableBody.appendChild(tr);
    });
    el.parsePreview.hidden = false;
  }

  el.parseLinkBtn.addEventListener("click", () => {
    const result = parsePrefilledLink(el.prefilledLinkInput.value);
    if (result.error) {
      el.parseError.textContent = result.error;
      el.parseError.hidden = false;
      el.parsePreview.hidden = true;
      pendingConnection = null;
      return;
    }
    el.parseError.hidden = true;
    pendingConnection = { baseUrl: result.baseUrl, entries: result.entries };
    renderParsePreview(result.preview);
  });

  el.saveConnectionBtn.addEventListener("click", () => {
    if (!pendingConnection) return;
    settings.formConfig = pendingConnection;
    pendingConnection = null;
    el.prefilledLinkInput.value = "";
    el.parsePreview.hidden = true;
    markChanged();
    renderAll();
  });

  el.disconnectFormBtn.addEventListener("click", () => {
    const proceed = confirm("Disconnect the current form? You'll need to paste a pre-filled link again to reconnect.");
    if (!proceed) return;
    settings.formConfig = null;
    markChanged();
    renderAll();
  });

  el.testLinkBtn.addEventListener("click", () => {
    if (!settings.formConfig) return;
    const today = new Date().toISOString().slice(0, 10);
    const url = buildFormUrl({
      date: today,
      startTime: "10:00",
      endTime: "10:30",
      durationMinutes: "30",
      sessionType: settings.sessionTypes[0] || "Test",
      numberInSession: "1",
      studentName: "Test Student",
    });
    window.open(url, "_blank", "noopener,noreferrer");
  });

  // ---------- import / export ----------

  function exportSettings() {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      roster: settings.roster,
      sessionTypes: settings.sessionTypes,
      formConfig: settings.formConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `session-helper-settings-${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);

    settings.meta.lastExported = payload.exportedAt;
    persist();
    renderExportReminder();
  }

  function importSettings(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch (e) {
        alert("That file isn't valid JSON.");
        return;
      }
      const rosterOk = Array.isArray(data.roster) && data.roster.every((x) => typeof x === "string");
      const typesOk = Array.isArray(data.sessionTypes) && data.sessionTypes.every((x) => typeof x === "string");
      if (!rosterOk || !typesOk) {
        alert("That file doesn't look like a session helper settings export.");
        return;
      }
      const hasFormConfig = data.formConfig !== undefined && data.formConfig !== null;
      if (hasFormConfig && !isValidFormConfig(data.formConfig)) {
        alert("That file's form connection data looks corrupted, so nothing was imported.");
        return;
      }
      const proceed = confirm(
        "This will replace your current roster, session types, and form connection. Continue?"
      );
      if (!proceed) return;

      settings.roster = data.roster;
      settings.sessionTypes = data.sessionTypes;
      if (hasFormConfig) settings.formConfig = data.formConfig;
      const now = new Date().toISOString();
      settings.meta.lastChanged = now;
      settings.meta.lastExported = now;
      persist();
      renderAll();
    };
    reader.readAsText(file);
  }

  // ---------- events ----------

  el.fieldStartTime.addEventListener("input", updateDuration);
  el.fieldEndTime.addEventListener("input", updateDuration);
  el.generateBtn.addEventListener("click", generateLinks);

  el.addStudentBtn.addEventListener("click", () => {
    const name = el.newStudentName.value.trim();
    if (!name) return;
    settings.roster.push(name);
    el.newStudentName.value = "";
    markChanged();
    renderAll();
  });
  el.newStudentName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") el.addStudentBtn.click();
  });

  el.addSessionTypeBtn.addEventListener("click", () => {
    const type = el.newSessionType.value.trim();
    if (!type) return;
    settings.sessionTypes.push(type);
    el.newSessionType.value = "";
    markChanged();
    renderAll();
  });
  el.newSessionType.addEventListener("keydown", (e) => {
    if (e.key === "Enter") el.addSessionTypeBtn.click();
  });

  el.exportBtn.addEventListener("click", exportSettings);
  el.exportReminderBtn.addEventListener("click", exportSettings);
  el.importFile.addEventListener("change", () => {
    const file = el.importFile.files[0];
    if (file) importSettings(file);
    el.importFile.value = "";
  });

  // ---------- init ----------

  el.fieldDate.value = new Date().toISOString().slice(0, 10);
  renderFieldOrderList();
  renderAll();
})();
