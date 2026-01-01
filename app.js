(async function () {
  await window.__editorReady;

  const runBtn = document.getElementById("runBtn");
  const openBtn = document.getElementById("openBtn");
  const saveBtn = document.getElementById("saveBtn");
  const fileInput = document.getElementById("fileInput");
  const clearOutputBtn = document.getElementById("clearOutputBtn");

  const languageSelect = document.getElementById("languageSelect");
  const output = document.getElementById("output");
  const preview = document.getElementById("preview");

  const editorPane = document.getElementById("editorPane");
  const singleEditorEl = document.getElementById("singleEditor");
  const splitWrap = document.getElementById("splitWrap");

  const offlineDot = document.getElementById("offlineDot");
  const offlineText = document.getElementById("offlineText");
  const toastEl = document.getElementById("toast");

  const mainEditor = window.mainEditor;
  const htmlEditor = window.htmlEditor;
  const cssEditor = window.cssEditor;

  // ===== UI helpers =====
  let toastTimer = null;
  function toast(message, sub = "") {
    if (!toastEl) return;
    toastEl.innerHTML = `${message}${sub ? `<small>${sub}</small>` : ""}`;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  // Online/Offline sadece yazsın
  function setOfflineBadge() {
    const online = navigator.onLine;
    if (online) {
      offlineDot.classList.add("good");
      offlineText.textContent = "Online";
    } else {
      offlineDot.classList.remove("good");
      offlineText.textContent = "Offline";
    }
  }
  window.addEventListener("online", setOfflineBadge);
  window.addEventListener("offline", setOfflineBadge);
  setOfflineBadge();

  // Save için baz ad (son açılan dosyaya göre)
  let lastBaseName = "kod";

  // Pyodide (offline)
  const pyodide = await loadPyodide({ indexURL: "libs/pyodide/" });
  pyodide.setStdout({ batched: (s) => (output.textContent += s) });
  pyodide.setStderr({ batched: (s) => (output.textContent += s) });

  function setMode(lang) {
    output.textContent = "";
    preview.classList.add("hidden");
    preview.srcdoc = "";

    editorPane.style.flex = "1 1 auto";
    singleEditorEl.classList.remove("hidden");
    splitWrap.classList.add("hidden");

    if (lang === "htmlcss") {
      editorPane.style.flex = "0 0 60%";
      singleEditorEl.classList.add("hidden");
      splitWrap.classList.remove("hidden");
      preview.classList.remove("hidden");

      requestAnimationFrame(() => {
        htmlEditor.layout();
        cssEditor.layout();
      });
    } else {
      monaco.editor.setModelLanguage(mainEditor.getModel(), lang);
      requestAnimationFrame(() => mainEditor.layout());
    }
  }

  function extToLang(ext) {
    const e = (ext || "").toLowerCase();
    if (e === "js") return "javascript";
    if (e === "ts") return "typescript";
    if (e === "py") return "python";
    if (e === "html" || e === "htm" || e === "css") return "htmlcss";
    return null;
  }

  function getExtension(filename) {
    const i = (filename || "").lastIndexOf(".");
    if (i === -1) return "";
    return filename.slice(i + 1).toLowerCase();
  }

  function baseName(filename) {
    const n = (filename || "").trim();
    if (!n) return "kod";
    const slash = Math.max(n.lastIndexOf("/"), n.lastIndexOf("\\"));
    const just = slash >= 0 ? n.slice(slash + 1) : n;
    const dot = just.lastIndexOf(".");
    const b = dot > 0 ? just.slice(0, dot) : just;
    return (b || "kod").replace(/[\\/:*?"<>|]+/g, "_");
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(r.error || new Error("Dosya okunamadı."));
      r.readAsText(file);
    });
  }

  function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ===== AÇ =====
  async function openFilesFlow() {
    output.textContent = "";
    fileInput.value = "";

    const currentLang = languageSelect.value;

    if (currentLang === "htmlcss") {
      fileInput.multiple = true;
      fileInput.accept = ".html,.htm,.css";
    } else {
      fileInput.multiple = false;
      fileInput.accept = ".js,.ts,.py,.html,.htm,.css,.txt";
    }

    fileInput.click();
  }

  fileInput.addEventListener("change", async () => {
    const files = Array.from(fileInput.files || []);
    if (files.length === 0) return;

    try {
      const exts = files.map((f) => getExtension(f.name));
      const hasHtmlOrCss = exts.some((e) => e === "html" || e === "htm" || e === "css");

      if (files.length > 1 || hasHtmlOrCss) {
        languageSelect.value = "htmlcss";
        setMode("htmlcss");

        const htmlFile = files.find((f) => ["html", "htm"].includes(getExtension(f.name)));
        const cssFile = files.find((f) => getExtension(f.name) === "css");

        if (!htmlFile && !cssFile) {
          output.textContent =
            "❌ HTML/CSS modu için .html/.css dosyası seçmelisin.\n" +
            "İstersen sadece biri de olur (sadece HTML veya sadece CSS).";
          toast("❌ Dosya seçimi geçersiz", "HTML/CSS için .html/.css seç");
          return;
        }

        if (htmlFile) htmlEditor.setValue(await readFileAsText(htmlFile));
        if (cssFile) cssEditor.setValue(await readFileAsText(cssFile));

        lastBaseName = baseName((htmlFile || cssFile).name);

        const label = [
          htmlFile ? htmlFile.name : null,
          cssFile ? cssFile.name : null,
        ].filter(Boolean).join(" + ");

        output.textContent += `✅ Dosya(lar) yüklendi: ${label}\n`;
        toast("✅ Açıldı", label);
        return;
      }

      // Tek dosya
      const f = files[0];
      const ext = getExtension(f.name);
      const lang = extToLang(ext);

      lastBaseName = baseName(f.name);

      if (lang === "htmlcss") {
        languageSelect.value = "htmlcss";
        setMode("htmlcss");
        if (ext === "css") cssEditor.setValue(await readFileAsText(f));
        else htmlEditor.setValue(await readFileAsText(f));
        output.textContent += `✅ Açıldı: ${f.name}\n`;
        toast("✅ Açıldı", f.name);
        return;
      }

      if (!lang) {
        output.textContent += "⚠️ Uzantı tanınmadı. JavaScript'e açıyorum.\n";
        languageSelect.value = "javascript";
        setMode("javascript");
        mainEditor.setValue(await readFileAsText(f));
        toast("⚠️ Tanınmayan uzantı", "JavaScript'e açıldı");
        return;
      }

      languageSelect.value = lang;
      setMode(lang);
      mainEditor.setValue(await readFileAsText(f));
      output.textContent += `✅ Açıldı (${lang}): ${f.name}\n`;
      toast("✅ Açıldı", `${f.name} (${lang})`);
    } catch (e) {
      const msg = e?.message || String(e);
      output.textContent += "❌ Dosya açma hatası:\n" + msg;
      toast("❌ Dosya açma hatası", msg);
    }
  });

  // ===== KAYDET =====
  function saveFlow() {
    output.textContent = "";
    const lang = languageSelect.value;
    const base = lastBaseName || "kod";

    if (lang === "javascript") {
      downloadTextFile(`${base}.js`, mainEditor.getValue());
      output.textContent += `✅ Kaydedildi: ${base}.js\n`;
      toast("✅ Kaydedildi", `${base}.js`);
      return;
    }

    if (lang === "typescript") {
      downloadTextFile(`${base}.ts`, mainEditor.getValue());
      output.textContent += `✅ Kaydedildi: ${base}.ts\n`;
      toast("✅ Kaydedildi", `${base}.ts`);
      return;
    }

    if (lang === "python") {
      downloadTextFile(`${base}.py`, mainEditor.getValue());
      output.textContent += `✅ Kaydedildi: ${base}.py\n`;
      toast("✅ Kaydedildi", `${base}.py`);
      return;
    }

    if (lang === "htmlcss") {
      const html = htmlEditor.getValue().trim();
      const css = cssEditor.getValue().trim();

      if (!html && !css) {
        output.textContent = "⚠️ Kaydedilecek içerik yok (HTML ve CSS boş).";
        toast("⚠️ Kaydedilecek içerik yok");
        return;
      }

      let saved = [];
      if (html) {
        downloadTextFile(`${base}.html`, htmlEditor.getValue());
        output.textContent += `✅ Kaydedildi: ${base}.html\n`;
        saved.push(`${base}.html`);
      }
      if (css) {
        downloadTextFile(`${base}.css`, cssEditor.getValue());
        output.textContent += `✅ Kaydedildi: ${base}.css\n`;
        saved.push(`${base}.css`);
      }

      toast("✅ Kaydedildi", saved.join(" + "));
      return;
    }
  }

  // ===== ÇALIŞTIR =====
  runBtn.addEventListener("click", () => {
    output.textContent = "";
    const lang = languageSelect.value;

    if (lang === "javascript") {
      try {
        const oldLog = console.log;
        console.log = (...a) => (output.textContent += a.join(" ") + "\n");
        new Function(mainEditor.getValue())();
        console.log = oldLog;
        toast("▶ Çalıştırıldı", "JavaScript");
      } catch (e) {
        output.textContent += "❌ JS Hatası:\n" + (e?.message || e);
        toast("❌ JS Hatası", e?.message || String(e));
      }
    } else if (lang === "typescript") {
      try {
        const jsCode = ts.transpile(mainEditor.getValue());
        const oldLog = console.log;
        console.log = (...a) => (output.textContent += a.join(" ") + "\n");
        new Function(jsCode)();
        console.log = oldLog;
        toast("▶ Çalıştırıldı", "TypeScript");
      } catch (e) {
        output.textContent += "❌ TypeScript Hatası:\n" + (e?.message || e);
        toast("❌ TS Hatası", e?.message || String(e));
      }
    } else if (lang === "python") {
      try {
        pyodide.runPython(mainEditor.getValue());
        toast("▶ Çalıştırıldı", "Python");
      } catch (e) {
        output.textContent += "❌ Python Hatası:\n" + e;
        toast("❌ Python Hatası", String(e));
      }
    } else if (lang === "htmlcss") {
      const html = htmlEditor.getValue();
      const css = cssEditor.getValue();
      preview.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>${css}</style>
</head>
<body>${html}</body>
</html>`;
      toast("▶ Önizleme güncellendi", "HTML + CSS");
    }
  });

  // ===== Diğer UI =====
  clearOutputBtn.addEventListener("click", () => {
    output.textContent = "";
    toast("🧹 Output temizlendi");
  });

  languageSelect.addEventListener("change", () => {
    setMode(languageSelect.value);
    toast("🎛 Dil değişti", languageSelect.value);
  });

  openBtn.addEventListener("click", openFilesFlow);
  saveBtn.addEventListener("click", saveFlow);

  // İlk açılış
  setMode(languageSelect.value);
})();
