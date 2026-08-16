function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlight(code, lang) {
  const src = escapeHtml(code);
  if (!lang) return src;
  return src
    .replace(/(\/\/[^\n]*|#(?!!).*$)/gm, '<span class="dima-syn-comment">$1</span>')
    .replace(/(&quot;[^&]*&quot;|'[^']*'|`[^`]*`)/g, '<span class="dima-syn-str">$1</span>')
    .replace(/\b(const|let|var|function|return|if|else|for|while|class|import|from|export|async|await|def|True|False|None|and|or|not)\b/g, '<span class="dima-syn-kw">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="dima-syn-num">$1</span>');
}

function inline(text) {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, '<code class="dima-inline-code">$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}

export function renderDimaMarkdown(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const html = [];
  let i = 0;
  let listBuf = [];
  const flushList = () => {
    if (!listBuf.length) return;
    html.push(`<ul>${listBuf.map((item) => `<li>${inline(item)}</li>`).join("")}</ul>`);
    listBuf = [];
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      flushList();
      const lang = line.slice(3).trim().toLowerCase();
      const body = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        body.push(lines[i]);
        i += 1;
      }
      html.push(
        `<pre class="dima-code" data-lang="${escapeHtml(lang || "text")}"><code>${highlight(body.join("\n"), lang)}</code></pre>`,
      );
      i += 1;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ""));
      i += 1;
      continue;
    }
    flushList();
    if (!line.trim()) {
      html.push("");
    } else if (line.startsWith("### ")) {
      html.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else if (line.startsWith("## ")) {
      html.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("# ")) {
      html.push(`<h1>${inline(line.slice(2))}</h1>`);
    } else {
      html.push(`<p>${inline(line)}</p>`);
    }
    i += 1;
  }
  flushList();
  return html.join("\n");
}
