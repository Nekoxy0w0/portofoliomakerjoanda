(function () {
  "use strict";

  var STORAGE_KEY = "cv-joanda-v1";
  var page = document.getElementById("cv");
  var btnEdit = document.getElementById("btnEdit");
  var btnUndo = document.getElementById("btnUndo");
  var btnRedo = document.getElementById("btnRedo");
  var btnPdf = document.getElementById("btnPdf");
  var btnPrint = document.getElementById("btnPrint");
  var btnReset = document.getElementById("btnReset");
  var hint = document.getElementById("hint");

  /* Format bar elements */
  var formatBar = document.getElementById("formatBar");
  var fmtFont = document.getElementById("fmtFont");
  var fmtSize = document.getElementById("fmtSize");
  var fmtBold = document.getElementById("fmtBold");
  var fmtItalic = document.getElementById("fmtItalic");
  var fmtUnderline = document.getElementById("fmtUnderline");
  var fmtLock = document.getElementById("fmtLock");

  var defaultHTML = page.innerHTML;
  var editing = false;

  /* ========== UNDO / REDO HISTORY ========== */
  var history = [];
  var historyIndex = -1;
  var MAX_HISTORY = 80;
  var snapshotTimer = null;

  function cleanHTMLForSnapshot(html) {
    /* Strip edit-only controls so they don't pollute history */
    var temp = document.createElement("div");
    temp.innerHTML = html;
    temp.querySelectorAll(".ctl-del, .ctl-add").forEach(function (el) { el.remove(); });
    return temp.innerHTML;
  }

  function pushSnapshot() {
    var snap = cleanHTMLForSnapshot(page.innerHTML);
    /* Don't push if identical to current */
    if (historyIndex >= 0 && history[historyIndex] === snap) return;
    /* Truncate redo branch */
    history = history.slice(0, historyIndex + 1);
    history.push(snap);
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
    updateUndoRedoButtons();
  }

  function scheduleSnapshot() {
    clearTimeout(snapshotTimer);
    snapshotTimer = setTimeout(pushSnapshot, 400);
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    restoreSnapshot(history[historyIndex]);
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex++;
    restoreSnapshot(history[historyIndex]);
  }

  function restoreSnapshot(snap) {
    page.innerHTML = snap;
    if (editing) {
      setEditable(true);
      addControls();
      applyLockedState();
    }
    updateUndoRedoButtons();
    save();
  }

  function updateUndoRedoButtons() {
    btnUndo.disabled = historyIndex <= 0;
    btnRedo.disabled = historyIndex >= history.length - 1;
  }

  btnUndo.addEventListener("click", undo);
  btnRedo.addEventListener("click", redo);

  /* ========== SIMPAN / MUAT ========== */
  function load() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved) page.innerHTML = saved;
    } catch (e) { /* localStorage tidak tersedia */ }
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, page.innerHTML); } catch (e) {}
  }

  /* ========== MODE EDIT ========== */
  var EDITABLE = "h1, p, h2, li, span, strong, div.place";

  function setEditable(on) {
    var nodes = page.querySelectorAll(EDITABLE);
    nodes.forEach(function (el) {
      if (on) {
        if (el.closest("svg")) return;
        if (el.querySelector("li, p, div, svg")) return;
        if (el.parentElement && el.parentElement.closest('[contenteditable="true"]')) return;
        /* Skip locked sections */
        if (el.closest("section.locked")) return;
        el.setAttribute("contenteditable", "true");
        el.setAttribute("spellcheck", "false");
      } else {
        el.removeAttribute("contenteditable");
        el.removeAttribute("spellcheck");
      }
    });
  }

  function addControls() {
    page.querySelectorAll("[data-item]").forEach(function (item) {
      /* Skip items inside locked sections */
      if (item.closest("section.locked")) return;
      if (item.querySelector(":scope > .ctl-del")) return;
      var del = document.createElement("button");
      del.type = "button";
      del.className = "ctl-del";
      del.title = "Hapus bagian ini";
      del.textContent = "\u00d7";
      del.setAttribute("contenteditable", "false");
      item.appendChild(del);
    });
    page.querySelectorAll("[data-list]").forEach(function (list) {
      /* Skip lists inside locked sections */
      if (list.closest("section.locked")) return;
      if (list.nextElementSibling && list.nextElementSibling.classList.contains("ctl-add")) return;
      var add = document.createElement("button");
      add.type = "button";
      add.className = "ctl-add";
      add.textContent = "+ Tambah baris";
      list.insertAdjacentElement("afterend", add);
    });
  }

  function removeControls() {
    page.querySelectorAll(".ctl-del, .ctl-add").forEach(function (el) { el.remove(); });
  }

  function enterEdit() {
    editing = true;
    page.classList.add("editing");
    setEditable(true);
    addControls();
    formatBar.classList.add("visible");
    btnEdit.textContent = "Selesai edit";
    btnEdit.classList.add("active");
    hint.textContent = "Mode edit aktif \u2014 Gunakan toolbar untuk format. Klik \uD83D\uDD12 lalu klik section untuk mengunci/membuka.";
    /* Initial history snapshot */
    pushSnapshot();
  }

  function exitEdit() {
    if (!editing) return;
    editing = false;
    removeControls();
    setEditable(false);
    page.classList.remove("editing");
    formatBar.classList.remove("visible");
    btnEdit.textContent = "Edit CV";
    btnEdit.classList.remove("active");
    hint.textContent = "Perubahan tersimpan di browser ini. Klik \"Edit CV\" untuk mengubah lagi.";
    lockMode = false;
    fmtLock.classList.remove("active");
    save();
  }

  btnEdit.addEventListener("click", function () {
    editing ? exitEdit() : enterEdit();
  });

  /* Listen for content changes to record history */
  page.addEventListener("input", function () {
    if (!editing) return;
    scheduleSnapshot();
  });

  /* Hapus & tambah baris (event delegation) */
  page.addEventListener("click", function (e) {
    /* --- Lock mode: intercept clicks on sections --- */
    if (lockMode && editing) {
      var section = e.target.closest("section");
      if (section && page.contains(section)) {
        e.preventDefault();
        e.stopPropagation();
        toggleLockSection(section);
        return;
      }
    }

    var del = e.target.closest(".ctl-del");
    if (del) {
      var item = del.closest("[data-item]");
      if (item && confirm("Hapus bagian ini?")) {
        item.remove();
        pushSnapshot();
      }
      return;
    }
    var add = e.target.closest(".ctl-add");
    if (add) {
      var list = add.previousElementSibling;
      var last = list.querySelector(":scope > [data-item]:last-child");
      if (!last) return;
      var clone = last.cloneNode(true);
      clone.querySelectorAll(".ctl-del").forEach(function (b) { b.remove(); });
      list.appendChild(clone);
      addControls();
      setEditable(true);
      pushSnapshot();
    }
  });

  /* Tempel sebagai teks polos */
  page.addEventListener("paste", function (e) {
    if (!editing) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
  });

  /* Enter tidak membuat baris/div baru, Ctrl+Z/Y intercepted */
  page.addEventListener("keydown", function (e) {
    if (!editing) return;
    if (e.key === "Enter") e.preventDefault();
  });

  /* Global Ctrl+Z / Ctrl+Y for undo/redo */
  document.addEventListener("keydown", function (e) {
    if (!editing) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      redo();
    }
  });

  /* ========== FORMAT BAR: FONT FAMILY ========== */
  fmtFont.addEventListener("change", function () {
    if (!editing) return;
    var fontVal = fmtFont.value;
    if (!fontVal) return;

    var sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;

    var range = sel.getRangeAt(0);
    var span = document.createElement("span");
    span.style.fontFamily = fontVal;
    try {
      range.surroundContents(span);
    } catch (ex) {
      document.execCommand("fontName", false, fontVal.split(",")[0].replace(/'/g, "").trim());
    }
    pushSnapshot();
    save();
  });

  /* ========== FORMAT BAR: FONT SIZE ========== */
  fmtSize.addEventListener("change", function () {
    if (!editing) return;
    var sizeVal = parseInt(fmtSize.value, 10);
    if (!sizeVal || sizeVal < 6 || sizeVal > 72) return;

    var sel = window.getSelection();
    if (!sel.rangeCount || sel.isCollapsed) return;

    var range = sel.getRangeAt(0);
    var span = document.createElement("span");
    span.style.fontSize = sizeVal + "pt";
    try {
      range.surroundContents(span);
    } catch (ex) {
      document.execCommand("fontSize", false, "7");
      var fonts = page.querySelectorAll('font[size="7"]');
      fonts.forEach(function (f) {
        var s = document.createElement("span");
        s.style.fontSize = sizeVal + "pt";
        while (f.firstChild) s.appendChild(f.firstChild);
        f.parentNode.replaceChild(s, f);
      });
    }
    pushSnapshot();
    save();
  });

  /* ========== FORMAT BAR: BOLD / ITALIC / UNDERLINE ========== */
  function execFormat(command) {
    if (!editing) return;
    document.execCommand(command, false, null);
    updateFormatButtons();
    pushSnapshot();
    save();
  }

  fmtBold.addEventListener("click", function (e) {
    e.preventDefault();
    execFormat("bold");
  });

  fmtItalic.addEventListener("click", function (e) {
    e.preventDefault();
    execFormat("italic");
  });

  fmtUnderline.addEventListener("click", function (e) {
    e.preventDefault();
    execFormat("underline");
  });

  /* ========== TRACK FORMAT STATE ========== */
  function updateFormatButtons() {
    if (!editing) return;
    fmtBold.classList.toggle("active", document.queryCommandState("bold"));
    fmtItalic.classList.toggle("active", document.queryCommandState("italic"));
    fmtUnderline.classList.toggle("active", document.queryCommandState("underline"));

    try {
      var fontName = document.queryCommandValue("fontName") || "";
      fontName = fontName.replace(/"/g, "'");
      var matched = false;
      for (var i = 0; i < fmtFont.options.length; i++) {
        var optVal = fmtFont.options[i].value;
        if (optVal && fontName.toLowerCase().indexOf(optVal.split(",")[0].replace(/'/g, "").trim().toLowerCase()) !== -1) {
          fmtFont.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched) fmtFont.selectedIndex = 0;
    } catch (ex) {}

    try {
      var el = getSelectionStartElement();
      if (el) {
        var cs = window.getComputedStyle(el);
        var px = parseFloat(cs.fontSize);
        var pt = Math.round(px * 72 / 96);
        fmtSize.value = pt;
      }
    } catch (ex) {}
  }

  function getSelectionStartElement() {
    var sel = window.getSelection();
    if (!sel.rangeCount) return null;
    var node = sel.getRangeAt(0).startContainer;
    return node.nodeType === 3 ? node.parentElement : node;
  }

  document.addEventListener("selectionchange", updateFormatButtons);

  /* ========== LOCK SECTIONS ========== */
  var lockMode = false;

  fmtLock.addEventListener("click", function (e) {
    e.preventDefault();
    if (!editing) return;
    lockMode = !lockMode;
    fmtLock.classList.toggle("active", lockMode);

    if (lockMode) {
      hint.textContent = "Mode kunci aktif \u2014 klik section di CV untuk mengunci/membukanya. Klik \uD83D\uDD12 lagi untuk keluar dari mode kunci.";
      page.style.cursor = "pointer";
    } else {
      hint.textContent = "Mode edit aktif \u2014 Gunakan toolbar untuk format. Klik \uD83D\uDD12 lalu klik section untuk mengunci/membuka.";
      page.style.cursor = "";
    }
  });

  function toggleLockSection(section) {
    var isLocked = section.classList.toggle("locked");

    /* Remove/restore editability inside the section */
    if (isLocked) {
      section.querySelectorAll("[contenteditable]").forEach(function (el) {
        el.removeAttribute("contenteditable");
        el.removeAttribute("spellcheck");
      });
      /* Remove controls from locked section */
      section.querySelectorAll(".ctl-del, .ctl-add").forEach(function (el) { el.remove(); });
      /* Also remove any ctl-add that follows a [data-list] inside section */
      section.querySelectorAll("[data-list]").forEach(function (list) {
        if (list.nextElementSibling && list.nextElementSibling.classList.contains("ctl-add")) {
          list.nextElementSibling.remove();
        }
      });
    } else {
      /* Restore editable + controls */
      setEditable(true);
      addControls();
    }
    pushSnapshot();
    save();
  }

  function applyLockedState() {
    /* After restoring a snapshot, re-apply lock behavior to sections that have .locked */
    page.querySelectorAll("section.locked").forEach(function (section) {
      section.querySelectorAll("[contenteditable]").forEach(function (el) {
        el.removeAttribute("contenteditable");
        el.removeAttribute("spellcheck");
      });
      section.querySelectorAll(".ctl-del, .ctl-add").forEach(function (el) { el.remove(); });
    });
  }

  /* ========== RESET ========== */
  btnReset.addEventListener("click", function () {
    if (!confirm("Kembalikan CV ke isi awal? Semua perubahan akan hilang.")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    editing = false;
    page.classList.remove("editing");
    page.innerHTML = defaultHTML;
    formatBar.classList.remove("visible");
    btnEdit.textContent = "Edit CV";
    btnEdit.classList.remove("active");
    lockMode = false;
    fmtLock.classList.remove("active");
    page.style.cursor = "";
    history = [];
    historyIndex = -1;
    updateUndoRedoButtons();
  });

  /* ========== DOWNLOAD PDF ========== */
  function fileName() {
    var h1 = page.querySelector("h1");
    var name = h1 ? h1.textContent.trim().replace(/\s+/g, "-") : "CV";
    return "CV-" + name + ".pdf";
  }

  btnPdf.addEventListener("click", function () {
    exitEdit();
    if (typeof html2pdf === "undefined") {
      alert("Library PDF tidak ditemukan. Pastikan folder vendor/ ikut tersalin, atau gunakan tombol Cetak / Simpan PDF.");
      return;
    }
    var label = btnPdf.textContent;
    btnPdf.disabled = true;
    btnPdf.textContent = "Membuat PDF...";
    page.classList.add("exporting");
    window.scrollTo(0, 0);

    var opt = {
      margin: 0,
      filename: fileName(),
      image: { type: "jpeg", quality: 1 },
      html2canvas: { scale: 3, useCORS: true, scrollX: 0, scrollY: 0, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css"] }
    };

    html2pdf().set(opt).from(page).save().then(done, done);

    function done() {
      page.classList.remove("exporting");
      btnPdf.disabled = false;
      btnPdf.textContent = label;
    }
  });

  /* ========== CETAK / SIMPAN PDF ========== */
  btnPrint.addEventListener("click", function () {
    exitEdit();
    window.print();
  });

  load();
})();
