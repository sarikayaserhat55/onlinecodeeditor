(async function () {
  await window.__editorReady;

  const runBtn = document.getElementById("runBtn");
  const languageSelect = document.getElementById("languageSelect");
  const output = document.getElementById("output");
  const preview = document.getElementById("preview");

  const editorPane = document.getElementById("editorPane");
  const singleEditorEl = document.getElementById("singleEditor");
  const splitWrap = document.getElementById("splitWrap");

  const mainEditor = window.mainEditor;
  const htmlEditor = window.htmlEditor;
  const cssEditor = window.cssEditor;

  // Pyodide
  const pyodide = await loadPyodide({ indexURL: "libs/pyodide/" });
  pyodide.setStdout({ batched: s => output.textContent += s });
  pyodide.setStderr({ batched: s => output.textContent += s });

  function setMode(lang) {
    // Reset görünüm
    output.textContent = "";
    preview.classList.add("hidden");
    preview.srcdoc = "";

    // Default: tek editör %100
    editorPane.style.flex = "1 1 auto";
    singleEditorEl.classList.remove("hidden");
    splitWrap.classList.add("hidden");

    if (lang === "htmlcss") {
      // Split %60 + preview %40
      editorPane.style.flex = "0 0 60%";
      singleEditorEl.classList.add("hidden");
      splitWrap.classList.remove("hidden");
      preview.classList.remove("hidden");

      // Layoutları bir frame sonra güncelle (temiz ve stabil)
      requestAnimationFrame(() => {
        htmlEditor.layout();
        cssEditor.layout();
      });
    } else {
      // Tek editör modunda dili değiştir
      monaco.editor.setModelLanguage(mainEditor.getModel(), lang);
      requestAnimationFrame(() => {
        mainEditor.layout();
      });
    }
  }

  languageSelect.addEventListener("change", () => {
    setMode(languageSelect.value);
  });

  runBtn.addEventListener("click", () => {
    output.textContent = "";
    const lang = languageSelect.value;

    // JavaScript
    if (lang === "javascript") {
      try {
        const oldLog = console.log;
        console.log = (...a) => output.textContent += a.join(" ") + "\n";
        new Function(mainEditor.getValue())();
        console.log = oldLog;
      } catch (e) {
        output.textContent += "❌ JS Hatası:\n" + (e?.message || e);
      }
    }

    // TypeScript
    else if (lang === "typescript") {
      try {
        const jsCode = ts.transpile(mainEditor.getValue());
        const oldLog = console.log;
        console.log = (...a) => output.textContent += a.join(" ") + "\n";
        new Function(jsCode)();
        console.log = oldLog;
      } catch (e) {
        output.textContent += "❌ TypeScript Hatası:\n" + (e?.message || e);
      }
    }

    // Python
    else if (lang === "python") {
      try {
        pyodide.runPython(mainEditor.getValue());
      } catch (e) {
        output.textContent += "❌ Python Hatası:\n" + e;
      }
    }

    // HTML + CSS
    else if (lang === "htmlcss") {
      const html = htmlEditor.getValue();
      const css = cssEditor.getValue();

      preview.srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
${css}
</style>
</head>
<body>
${html}
</body>
</html>`;
    }
  });

  // İlk açılış modu
  setMode(languageSelect.value);
})();
