import escapeHtml from "../utils/escapeHtml.js";
import { createFirebaseTemplate } from "../services/firebaseTemplates.js";

function sanitizeWordsArray(words) {
  if (!Array.isArray(words)) return [];

  const cleaned = words
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: item.id ?? index + 1,
      ru: String(item.ru ?? "").trim(),
      es: String(item.es ?? "").trim()
    }))
    .filter((item) => item.ru && item.es);

  const seen = new Set();
  const unique = [];

  for (const word of cleaned) {
    const key = `${word.ru}|||${word.es}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(word);
  }

  return unique;
}

function setFeedback(element, { type = "neutral", html = "" } = {}) {
  element.classList.remove("ok", "bad");
  if (type === "ok") element.classList.add("ok");
  if (type === "bad") element.classList.add("bad");
  const content = html || '<span class="muted">…</span>';
  element.innerHTML = `<span class="feedback-line">${content}</span>`;
}

function parseTemplateJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text ?? ""));
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error('Template JSON must be an object like {"name": "...", "words": [...]}');
  }

  const name = String(parsed.name ?? "").trim();
  if (!name) {
    throw new Error('Template JSON must include a non-empty "name" field.');
  }

  if (!Array.isArray(parsed.words)) {
    throw new Error('Template JSON must include a "words" array.');
  }

  const words = sanitizeWordsArray(parsed.words);
  if (!words.length) {
    throw new Error('Template must include at least one valid word with both "ru" and "es".');
  }

  return { name, words };
}

export default function initTemplateUploadPage({
  elements,
  goToSetupPage,
  goToTemplateUploadPage,
  onTemplateUploaded
}) {
  const {
    openTemplateUploadPageBtn,
    backFromTemplateUploadBtn,
    templateUploadFeedback,
    templateJsonInput,
    validateTemplateJsonBtn,
    submitTemplateJsonBtn
  } = elements;

  function setBusy(isBusy) {
    templateJsonInput.disabled = isBusy;
    validateTemplateJsonBtn.disabled = isBusy;
    submitTemplateJsonBtn.disabled = isBusy;
    backFromTemplateUploadBtn.disabled = isBusy;
    openTemplateUploadPageBtn.disabled = isBusy;
  }

  function validateCurrentJson() {
    const template = parseTemplateJson(templateJsonInput.value);
    setFeedback(templateUploadFeedback, {
      type: "ok",
      html: `✅ <strong>Valid template</strong>: “${escapeHtml(template.name)}” with ${template.words.length} word(s).`
    });
    return template;
  }

  openTemplateUploadPageBtn.addEventListener("click", () => {
    setFeedback(templateUploadFeedback, {
      type: "neutral",
      html: '<span class="muted">Paste template JSON and upload it to Firebase.</span>'
    });
    goToTemplateUploadPage();
  });

  backFromTemplateUploadBtn.addEventListener("click", () => {
    goToSetupPage();
  });

  validateTemplateJsonBtn.addEventListener("click", () => {
    try {
      validateCurrentJson();
    } catch (error) {
      setFeedback(templateUploadFeedback, {
        type: "bad",
        html: `⚠️ <strong>JSON error</strong>: <span class="muted">${escapeHtml(error.message || String(error))}</span>`
      });
    }
  });

  submitTemplateJsonBtn.addEventListener("click", async () => {
    let template;
    try {
      template = validateCurrentJson();
    } catch (error) {
      setFeedback(templateUploadFeedback, {
        type: "bad",
        html: `⚠️ <strong>JSON error</strong>: <span class="muted">${escapeHtml(error.message || String(error))}</span>`
      });
      return;
    }

    setBusy(true);
    setFeedback(templateUploadFeedback, {
      type: "neutral",
      html: `<span class="muted">Uploading template “${escapeHtml(template.name)}” to Firebase…</span>`
    });

    try {
      const createdTemplate = await createFirebaseTemplate(template);
      setFeedback(templateUploadFeedback, {
        type: "ok",
        html: `✅ <strong>Uploaded</strong> “${escapeHtml(createdTemplate.name)}”. It is now stored in Firebase as a shared template.`
      });
      templateJsonInput.value = "";
      if (typeof onTemplateUploaded === "function") onTemplateUploaded(createdTemplate);
    } catch (error) {
      setFeedback(templateUploadFeedback, {
        type: "bad",
        html: `⚠️ <strong>Upload failed</strong>: <span class="muted">${escapeHtml(error.message || String(error))}</span>`
      });
    } finally {
      setBusy(false);
    }
  });
}
