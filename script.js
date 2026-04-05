import BUILT_IN_TEMPLATES from "./src/constants/templates.js";
import initChatPage from "./src/pages/chatPage.js";
import initTemplateUploadPage from "./src/pages/templateUploadPage.js";
import { askGpt } from "./src/services/exampleGenerator.js";
import { buildExampleMessages } from "./src/services/examplePrompts.js";
import { fetchFirebaseTemplates } from "./src/services/firebaseTemplates.js";
import escapeHtml from "./src/utils/escapeHtml.js";
import lsReadJSON from "./src/utils/lsReadJSON.js";
import lsWriteJSON from "./src/utils/lsWriteJSON.js";
import normalize from "./src/utils/normalize.js";
import shuffle from "./src/utils/shuffle.js";
import uid from "./src/utils/uid.js";

// --------- LocalStorage ---------
const LS = {
  PACKS: "wordTrainer:packs:v1",
  ACTIVE: "wordTrainer:activePackId:v1",
  THEME: "wordTrainer:theme:v1"
};

const THEMES = {
  DARK_BLUE: "quizlet-dark",
  SOFT: "soft"
};

const DEFAULT_THEME = THEMES.DARK_BLUE;
const AUTO_NEXT_DELAY_MS = 1000;
let autoNextTimerId = null;

// --------- DOM ---------
const els = {
  setupPage: document.getElementById("setupPage"),
  lessonPage: document.getElementById("lessonPage"),
  templateUploadPage: document.getElementById("templateUploadPage"),
  chatPage: document.getElementById("chatPage"),

  openChatPageBtn: document.getElementById("openChatPageBtn"),
  openTemplateUploadPageBtn: document.getElementById("openTemplateUploadPageBtn"),
  templateSelect: document.getElementById("templateSelect"),
  addTemplateBtn: document.getElementById("addTemplateBtn"),
  clearPacksBtn: document.getElementById("clearPacksBtn"),
  packList: document.getElementById("packList"),

  taskMode: document.getElementById("taskMode"),
  direction: document.getElementById("direction"),
  themeSelect: document.getElementById("themeSelect"),
  startLessonBtn: document.getElementById("startLessonBtn"),
  backToSetupBtn: document.getElementById("backToSetupBtn"),
  backFromTemplateUploadBtn: document.getElementById("backFromTemplateUploadBtn"),
  backFromChatPageBtn: document.getElementById("backFromChatPageBtn"),
  replayLessonBtn: document.getElementById("replayLessonBtn"),
  goSetupBtn: document.getElementById("goSetupBtn"),

  skipBtn: document.getElementById("skipBtn"),
  revealBtn: document.getElementById("revealBtn"),
  showExamplesBtn: document.getElementById("showExamplesBtn"),
  nextBtn: document.getElementById("nextBtn"),

  statusPill: document.getElementById("statusPill"),
  pagePill: document.getElementById("pagePill"),
  countPill: document.getElementById("countPill"),
  modePill: document.getElementById("modePill"),
  dirPill: document.getElementById("dirPill"),

  lessonPackPill: document.getElementById("lessonPackPill"),
  lessonProgressPill: document.getElementById("lessonProgressPill"),

  progressText: document.getElementById("progressText"),
  idText: document.getElementById("idText"),
  prompt: document.getElementById("prompt"),
  subprompt: document.getElementById("subprompt"),

  testArea: document.getElementById("testArea"),
  options: document.getElementById("options"),

  practiceArea: document.getElementById("practiceArea"),
  answerInput: document.getElementById("answerInput"),
  checkBtn: document.getElementById("checkBtn"),

  setupFeedback: document.getElementById("setupFeedback"),
  lessonFeedback: document.getElementById("lessonFeedback"),
  exampleResponseBox: document.getElementById("exampleResponseBox"),
  exampleResponseText: document.getElementById("exampleResponseText"),
  templateUploadFeedback: document.getElementById("templateUploadFeedback"),
  chatPageFeedback: document.getElementById("chatPageFeedback"),
  note: document.getElementById("note"),
  templateJsonInput: document.getElementById("templateJsonInput"),
  validateTemplateJsonBtn: document.getElementById("validateTemplateJsonBtn"),
  submitTemplateJsonBtn: document.getElementById("submitTemplateJsonBtn"),
  chatApiKeyInput: document.getElementById("chatApiKeyInput"),
  chatModelSelect: document.getElementById("chatModelSelect"),
  chatSystemPromptInput: document.getElementById("chatSystemPromptInput"),
  chatTranscript: document.getElementById("chatTranscript"),
  chatReplyComposer: document.getElementById("chatReplyComposer"),
  chatAssistantReplyInput: document.getElementById("chatAssistantReplyInput"),
  useCustomAssistantReplyBtn: document.getElementById("useCustomAssistantReplyBtn"),
  regenerateChatRepliesBtn: document.getElementById("regenerateChatRepliesBtn"),
  chatMessageInput: document.getElementById("chatMessageInput"),
  sendChatMessageBtn: document.getElementById("sendChatMessageBtn"),
  chatReplyOptions: document.getElementById("chatReplyOptions"),

  chunkCongratsBox: document.getElementById("chunkCongratsBox"),
  chunkCongratsTitle: document.getElementById("chunkCongratsTitle"),
  chunkCongratsText: document.getElementById("chunkCongratsText"),
  continueChunkBtn: document.getElementById("continueChunkBtn"),

  congratsBox: document.getElementById("congratsBox"),
  congratsSummary: document.getElementById("congratsSummary"),

  wordsPreview: document.getElementById("wordsPreview"),

  kAnswered: document.getElementById("kAnswered"),
  kCorrect: document.getElementById("kCorrect"),
  kSkipped: document.getElementById("kSkipped"),
  kAcc: document.getElementById("kAcc")
};

// --------- State ---------
const state = {
  packs: [], // { id, name, createdAt, templateId?, words: [{id,ru,es}] }
  activePackId: null,

  words: [], // currently selected pack words
  mode: "softLesson", // 'test' | 'typeAnswer' | 'lesson' | 'straightLesson' | 'softLesson'
  dir: "toES", // 'toES' | 'fromES'
  page: "setup", // 'setup' | 'lesson' | 'templateUpload' | 'chat'
  firebaseTemplates: [],
  firebaseTemplatesLoaded: false,
  firebaseTemplatesError: null,

  lesson: {
    queue: [],
    cursor: 0,
    exampleRequestId: 0,
    examplesLoading: false,
    exampleResponse: "",
    answeredCurrent: false,
    manualNextPending: false,
    done: false,
    stats: {
      answered: 0,
      correct: 0,
      skipped: 0
    },
    chunk: {
      chunkSize: 10,
      chunks: [],
      chunkIndex: 0,
      phase: "typeAnswer", // 'test' | 'typeAnswer' (used by softLesson)
      inRetryPass: false,
      errorWords: [],
      awaitingContinue: false
    }
  }
};

// --------- Core UI ---------
function getModeLabel(mode) {
  if (mode === "test") return "Test";
  if (mode === "typeAnswer") return "Type Answer";
  if (mode === "lesson") return "Lesson";
  if (mode === "straightLesson") return "Straight Lesson";
  if (mode === "softLesson") return "Soft lesson";
  return mode;
}

function getCurrentAnswerMode() {
  if (state.mode === "softLesson") return state.lesson.chunk.phase;
  if (state.mode === "lesson" || state.mode === "straightLesson") return "typeAnswer";
  return state.mode;
}

function clearAutoNextTimer() {
  if (autoNextTimerId == null) return;
  clearTimeout(autoNextTimerId);
  autoNextTimerId = null;
}

function scheduleAutoNext() {
  clearAutoNextTimer();
  autoNextTimerId = setTimeout(() => {
    autoNextTimerId = null;
    if (state.page !== "lesson") return;
    if (state.lesson.done || state.lesson.chunk.awaitingContinue) return;
    if (!state.lesson.answeredCurrent) return;
    nextWord();
  }, AUTO_NEXT_DELAY_MS);
}

function setManualNextButtonVisible(visible) {
  els.nextBtn.style.display = visible ? "" : "none";
  els.nextBtn.disabled = !visible;
}

function setAnswerInteractionEnabled(enabled) {
  els.answerInput.disabled = !enabled;
  els.checkBtn.disabled = !enabled;
  [...els.options.querySelectorAll("button")].forEach((b) => {
    b.disabled = !enabled;
  });
}

function updatePills() {
  els.countPill.textContent = `Words: ${state.words.length}`;
  els.modePill.textContent = `Mode: ${getModeLabel(state.mode)}`;
  els.dirPill.textContent = `Direction: ${state.dir === "toES" ? "to ES" : "from ES"}`;
  els.pagePill.textContent = `Page: ${state.page}`;
}

function setStatus(text) {
  els.statusPill.textContent = text;
}

function setSetupFeedback({ type = "neutral", html = "" } = {}) {
  els.setupFeedback.classList.remove("ok", "bad");
  if (type === "ok") els.setupFeedback.classList.add("ok");
  if (type === "bad") els.setupFeedback.classList.add("bad");
  const content = html || '<span class="muted">…</span>';
  els.setupFeedback.innerHTML = `<span class="feedback-line">${content}</span>`;
}

function setLessonFeedback({ type = "neutral", html = "" } = {}) {
  els.lessonFeedback.classList.remove("ok", "bad");
  if (type === "ok") els.lessonFeedback.classList.add("ok");
  if (type === "bad") els.lessonFeedback.classList.add("bad");
  const content = html || '<span class="muted">…</span>';
  els.lessonFeedback.innerHTML = `<span class="feedback-line">${content}</span>`;
}

function showModeAreas() {
  const isTest = getCurrentAnswerMode() === "test";
  els.testArea.style.display = isTest ? "block" : "none";
  els.practiceArea.style.display = isTest ? "none" : "block";
}

function setPage(page) {
  state.page = page;
  els.setupPage.classList.toggle("hidden", page !== "setup");
  els.lessonPage.classList.toggle("hidden", page !== "lesson");
  els.templateUploadPage.classList.toggle("hidden", page !== "templateUpload");
  els.chatPage.classList.toggle("hidden", page !== "chat");
  updatePills();
}

function getActivePack() {
  return state.packs.find((p) => p.id === state.activePackId) || null;
}

function updatePreview() {
  if (!state.words.length) {
    els.wordsPreview.textContent = "(no pack selected)";
    return;
  }

  const pack = getActivePack();
  const header = pack ? `# ${pack.name} (${state.words.length} words)\n\n` : "";
  const lines = state.words.slice(0, 80).map((w) => `${w.id}: ${w.ru}  →  ${w.es}`);
  if (state.words.length > 80) lines.push(`… (${state.words.length - 80} more)`);

  els.wordsPreview.textContent = header + lines.join("\n");
}

function updateSetupActions() {
  els.startLessonBtn.disabled = !state.words.length;
}

function resetLessonState() {
  clearAutoNextTimer();
  state.lesson.queue = [];
  state.lesson.cursor = 0;
  state.lesson.exampleRequestId = 0;
  state.lesson.examplesLoading = false;
  state.lesson.exampleResponse = "";
  state.lesson.answeredCurrent = false;
  state.lesson.manualNextPending = false;
  state.lesson.done = false;
  state.lesson.chunk.chunks = [];
  state.lesson.chunk.chunkIndex = 0;
  state.lesson.chunk.phase = "typeAnswer";
  state.lesson.chunk.inRetryPass = false;
  state.lesson.chunk.errorWords = [];
  state.lesson.chunk.awaitingContinue = false;
  state.lesson.stats.answered = 0;
  state.lesson.stats.correct = 0;
  state.lesson.stats.skipped = 0;

  els.chunkCongratsBox.classList.add("hidden");
  els.congratsBox.classList.add("hidden");
  setManualNextButtonVisible(false);

  updateLessonStatsUI();
  updateLessonTopRow();
  updateShowExamplesButton();
  renderExampleResponse();
}

function updateLessonTopRow() {
  const pack = getActivePack();
  els.lessonPackPill.textContent = `Pack: ${pack ? pack.name : "—"}`;

  if (isChunkLessonMode() && state.lesson.chunk.chunks.length) {
    const chunkNo = Math.min(state.lesson.chunk.chunkIndex + 1, state.lesson.chunk.chunks.length);
    const chunkTotal = state.lesson.chunk.chunks.length;
    const wordNo = Math.min(state.lesson.cursor + 1, Math.max(state.lesson.queue.length, 1));
    const wordTotal = Math.max(state.lesson.queue.length, 1);
    if (state.lesson.done) {
      els.lessonProgressPill.textContent = `Chunks: ${chunkTotal}/${chunkTotal}`;
    } else if (state.lesson.chunk.awaitingContinue) {
      els.lessonProgressPill.textContent = `Chunk ${chunkNo}/${chunkTotal} complete`;
    } else {
      els.lessonProgressPill.textContent = `Chunk ${chunkNo}/${chunkTotal} · ${wordNo}/${wordTotal}`;
    }
    return;
  }

  const total = state.lesson.queue.length;
  const handled = Math.min(state.lesson.cursor, total);
  if (!total) {
    els.lessonProgressPill.textContent = "0 / 0";
  } else if (state.lesson.done) {
    els.lessonProgressPill.textContent = `${total} / ${total}`;
  } else {
    els.lessonProgressPill.textContent = `${handled + 1} / ${total}`;
  }
}

function updateLessonStatsUI() {
  const { answered, correct, skipped } = state.lesson.stats;
  els.kAnswered.textContent = String(answered);
  els.kCorrect.textContent = String(correct);
  els.kSkipped.textContent = String(skipped);

  const acc = answered === 0 ? 0 : Math.round((correct / answered) * 100);
  els.kAcc.textContent = `${acc}%`;
}

function setLessonControlsEnabled({ skip, reveal } = {}) {
  els.skipBtn.disabled = !skip;
  els.revealBtn.disabled = !reveal;
}

function renderExampleResponse() {
  const text = String(state.lesson.exampleResponse || "").trim();
  els.exampleResponseBox.classList.toggle("hidden", !text);
  els.exampleResponseText.textContent = text;
}

function updateShowExamplesButton() {
  const word = getCurrentWord();
  els.showExamplesBtn.textContent = state.lesson.examplesLoading ? "Loading..." : "Show examples";
  els.showExamplesBtn.disabled = !word || state.lesson.done || state.lesson.examplesLoading;
}

function ensureUniquePackName(baseName) {
  const clean = String(baseName || "Pack").trim() || "Pack";
  const existing = new Set(state.packs.map((p) => p.name));
  if (!existing.has(clean)) return clean;
  let n = 2;
  while (existing.has(`${clean} (${n})`)) n++;
  return `${clean} (${n})`;
}

// --------- Packs ---------
function persistPacks() {
  const toStore = state.packs.map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.createdAt,
    templateId: p.templateId ?? null,
    words: p.words
  }));
  lsWriteJSON(LS.PACKS, toStore);

  if (state.activePackId) localStorage.setItem(LS.ACTIVE, state.activePackId);
  else localStorage.removeItem(LS.ACTIVE);
}

function renderPackList() {
  els.packList.innerHTML = "";

  if (!state.packs.length) {
    const empty = document.createElement("div");
    empty.className = "packItem";
    empty.innerHTML =
      '<div class="packLeft"><div class="packName">No packs yet</div><div class="packMeta">Upload a JSON file or add a template above to create your first pack.</div></div>';
    els.packList.appendChild(empty);
    return;
  }

  for (const pack of state.packs) {
    const item = document.createElement("div");
    item.className = "packItem" + (pack.id === state.activePackId ? " active" : "");

    const left = document.createElement("div");
    left.className = "packLeft";

    const titleRow = document.createElement("div");
    titleRow.className = "packTitleRow";

    const name = document.createElement("div");
    name.className = "packName";
    name.textContent = pack.name;

    titleRow.appendChild(name);

    if (pack.id === state.activePackId) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "selected";
      titleRow.appendChild(badge);
    }

    const meta = document.createElement("div");
    meta.className = "packMeta";
    meta.textContent = `${pack.words.length} words`;

    left.appendChild(titleRow);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "packRight";

    const useBtn = document.createElement("button");
    useBtn.className = "btn btn-neutral";
    useBtn.textContent = pack.id === state.activePackId ? "Using" : "Use";
    useBtn.disabled = pack.id === state.activePackId;
    useBtn.addEventListener("click", () => selectPack(pack.id));

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-red";
    delBtn.textContent = "Delete";
    delBtn.addEventListener("click", () => deletePack(pack.id));

    right.appendChild(useBtn);
    right.appendChild(delBtn);

    item.appendChild(left);
    item.appendChild(right);

    els.packList.appendChild(item);
  }
}

function renderTemplateSelect() {
  const selectedBefore = els.templateSelect.value;
  els.templateSelect.innerHTML = "";
  const templates = getAvailableTemplates();

  if (!state.firebaseTemplatesLoaded && state.firebaseTemplatesError == null) {
    const loading = document.createElement("option");
    loading.value = "";
    loading.textContent = "Loading templates from Firebase…";
    els.templateSelect.appendChild(loading);
    els.templateSelect.disabled = true;
    els.addTemplateBtn.disabled = true;
    return;
  }

  if (!templates.length) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "No templates available";
    els.templateSelect.appendChild(empty);
    els.templateSelect.disabled = true;
    els.addTemplateBtn.disabled = true;
    return;
  }

  for (const tpl of templates) {
    const opt = document.createElement("option");
    opt.value = tpl.templateId;
    opt.textContent = `${tpl.name} (${tpl.words.length} words)`;

    const alreadyAdded = state.packs.some((p) => p.templateId === tpl.templateId);
    if (alreadyAdded) {
      opt.disabled = true;
      opt.textContent += " (already added)";
    }

    els.templateSelect.appendChild(opt);
  }

  if (selectedBefore && els.templateSelect.querySelector(`option[value="${selectedBefore}"]`)) {
    els.templateSelect.value = selectedBefore;
  }

  const firstEnabled = els.templateSelect.querySelector("option:not([disabled])");
  if (!firstEnabled) {
    els.templateSelect.disabled = true;
    els.addTemplateBtn.disabled = true;
    return;
  }

  if (els.templateSelect.selectedOptions[0]?.disabled) {
    els.templateSelect.value = firstEnabled.value;
  }

  els.templateSelect.disabled = false;
  els.addTemplateBtn.disabled = false;
}

function addPackFromWords(words, desiredName, opts = {}) {
  const templateId = opts.templateId ?? null;
  if (templateId && state.packs.some((p) => p.templateId === templateId)) {
    return null;
  }

  const packName = ensureUniquePackName(desiredName || "Pack");
  const newPack = {
    id: uid(),
    name: packName,
    createdAt: Date.now(),
    templateId,
    words
  };

  state.packs.unshift(newPack);
  persistPacks();
  renderPackList();
  renderTemplateSelect();
  selectPack(newPack.id, { silent: true });
  return newPack;
}

function selectPack(packId, opts = { silent: false }) {
  const pack = state.packs.find((p) => p.id === packId);
  if (!pack) return;

  state.activePackId = pack.id;
  state.words = pack.words;

  resetLessonState();
  persistPacks();
  renderPackList();

  setStatus(`Pack: ${pack.name}`);
  updatePills();
  updatePreview();
  updateSetupActions();

  if (!opts.silent) {
    setSetupFeedback({
      type: "neutral",
      html: `<strong>Selected</strong> “${escapeHtml(pack.name)}” (${pack.words.length} words). Press <strong>Start lesson</strong>.`
    });
  }
}

function deletePack(packId) {
  const pack = state.packs.find((p) => p.id === packId);
  if (!pack) return;

  state.packs = state.packs.filter((p) => p.id !== packId);

  if (state.activePackId === packId) {
    state.activePackId = null;
    state.words = [];
    resetLessonState();
  }

  persistPacks();
  renderPackList();
  renderTemplateSelect();

  if (!state.packs.length) {
    setStatus("No pack selected");
    state.words = [];
    updatePills();
    updatePreview();
    updateSetupActions();
    setSetupFeedback({
      type: "neutral",
      html: '<span class="muted">All packs removed. Upload a JSON file to add a pack.</span>'
    });
    return;
  }

  if (!state.activePackId) {
    selectPack(state.packs[0].id, { silent: true });
    setSetupFeedback({
      type: "neutral",
      html: '<span class="muted">Active pack was deleted. Switched to the next available pack.</span>'
    });
  } else {
    updatePills();
    updatePreview();
    updateSetupActions();
  }
}

function clearAllPacks() {
  if (!state.packs.length) {
    setSetupFeedback({ type: "neutral", html: '<span class="muted">No packs to remove.</span>' });
    return;
  }

  const ok = confirm("Remove all packs from localStorage?");
  if (!ok) return;

  state.packs = [];
  state.activePackId = null;
  state.words = [];
  resetLessonState();

  persistPacks();
  renderPackList();
  renderTemplateSelect();
  setStatus("No pack selected");
  updatePills();
  updatePreview();
  updateSetupActions();

  setSetupFeedback({
    type: "neutral",
    html: '<span class="muted">All packs removed.</span>'
  });
}

// --------- Lesson ---------
function getCurrentWord() {
  if (state.lesson.done) return null;
  return state.lesson.queue[state.lesson.cursor] || null;
}

function splitIntoChunks(words, chunkSize) {
  const out = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    out.push(words.slice(i, i + chunkSize));
  }
  return out;
}

function openChunkCongrats(title, text) {
  clearAutoNextTimer();
  state.lesson.manualNextPending = false;
  setManualNextButtonVisible(false);
  state.lesson.chunk.awaitingContinue = true;
  els.chunkCongratsTitle.textContent = title;
  els.chunkCongratsText.textContent = text;
  els.chunkCongratsBox.classList.remove("hidden");
  setLessonControlsEnabled({ skip: false, reveal: false });
  updateLessonTopRow();
}

function closeChunkCongrats() {
  state.lesson.chunk.awaitingContinue = false;
  els.chunkCongratsBox.classList.add("hidden");
}

function isChunkLessonMode() {
  return state.mode === "lesson" || state.mode === "straightLesson" || state.mode === "softLesson";
}

function isSoftLessonMode() {
  return state.mode === "softLesson";
}

function isStraightLessonMode() {
  return state.mode === "straightLesson";
}

function pickDistinct(pool, n, excludeWord) {
  const candidates = pool.filter((w) => w !== excludeWord);
  return shuffle(candidates).slice(0, Math.min(n, candidates.length));
}

function getQA(word) {
  const prompt = state.dir === "toES" ? word.ru : word.es;
  const answer = state.dir === "toES" ? word.es : word.ru;
  const fromLabel = state.dir === "toES" ? "RU" : "ES";
  const toLabel = state.dir === "toES" ? "ES" : "RU";
  return { prompt, answer, fromLabel, toLabel };
}

function renderOptionsForTest(word) {
  els.options.innerHTML = "";
  const { answer: correctAnswer } = getQA(word);

  const distractors = pickDistinct(state.words, 3, word).map((w) => getQA(w).answer);
  const all = [correctAnswer, ...distractors];
  const unique = [...new Set(all)];
  const options = shuffle(unique).slice(0, Math.min(4, unique.length));

  if (options.length < 4) {
    els.note.textContent = "Note: need at least 4 distinct translations to show 4 unique options.";
  }

  for (const opt of options) {
    const btn = document.createElement("button");
    btn.className = "btn btn-neutral";
    btn.textContent = opt;
    btn.addEventListener("click", () => onChooseOption(opt));
    els.options.appendChild(btn);
  }
}

function renderLessonWord() {
  clearAutoNextTimer();
  state.lesson.manualNextPending = false;
  setManualNextButtonVisible(false);
  setAnswerInteractionEnabled(true);
  const word = getCurrentWord();
  if (!word) {
    if (isChunkLessonMode()) {
      handleChunkQueueFinished();
    } else {
      completeLesson();
    }
    return;
  }

  closeChunkCongrats();
  state.lesson.answeredCurrent = false;
  state.lesson.exampleRequestId += 1;
  state.lesson.examplesLoading = false;
  state.lesson.exampleResponse = "";

  const total = state.lesson.queue.length;
  const pos = state.lesson.cursor + 1;
  const qa = getQA(word);
  const answerMode = getCurrentAnswerMode();

  updateLessonTopRow();
  updateShowExamplesButton();
  renderExampleResponse();
  showModeAreas();
  els.congratsBox.classList.add("hidden");

  if (isChunkLessonMode()) {
    const chunkNo = state.lesson.chunk.chunkIndex + 1;
    const chunkTotal = state.lesson.chunk.chunks.length;
    const stagePrefix = isSoftLessonMode() ? `${state.lesson.chunk.phase === "test" ? "Test" : "Type answer"} · ` : "";
    const phase = `${stagePrefix}${state.lesson.chunk.inRetryPass ? "Correction pass" : "Round 1"}`;
    els.progressText.textContent = `Chunk ${chunkNo}/${chunkTotal} · ${phase} · Word ${pos}/${total}`;
  } else {
    els.progressText.textContent = `Word ${pos} of ${total} · Translate ${qa.fromLabel} → ${qa.toLabel}`;
  }
  els.idText.textContent = word.id != null ? `id: ${word.id}` : "";
  els.prompt.textContent = qa.prompt;
  if (answerMode === "test") {
    els.subprompt.textContent = state.lesson.chunk.inRetryPass
      ? "Retry pass: incorrect test answers return until corrected."
      : "Pick the correct translation.";
  } else if (isChunkLessonMode() && state.lesson.chunk.inRetryPass) {
    els.subprompt.textContent = "Retry pass: incorrect words return until corrected.";
  } else {
    els.subprompt.textContent = "Type the exact translation, then press Check.";
  }

  els.note.textContent = "";
  setLessonControlsEnabled({
    skip: true,
    reveal: true
  });

  if (answerMode === "test") {
    renderOptionsForTest(word);
  } else {
    els.answerInput.value = "";
    els.answerInput.focus();
  }

  setLessonFeedback({ type: "neutral", html: '<span class="muted">Answer or skip this word.</span>' });
}

function markAnswered(isCorrect, userAnswer) {
  if (state.lesson.answeredCurrent || state.lesson.done) return;

  const word = getCurrentWord();
  if (!word) return;

  const { answer } = getQA(word);
  state.lesson.stats.answered += 1;
  if (isCorrect) state.lesson.stats.correct += 1;
  updateLessonStatsUI();

  if (!isCorrect && isChunkLessonMode() && !state.lesson.chunk.errorWords.includes(word)) {
    state.lesson.chunk.errorWords.push(word);
  }

  state.lesson.answeredCurrent = true;
  state.lesson.manualNextPending = !isCorrect;
  setAnswerInteractionEnabled(false);

  if (isCorrect) {
    setLessonFeedback({
      type: "ok",
      html: `✅ <strong>Correct</strong> — <span class="muted">${escapeHtml(answer)}</span>`
    });
  } else {
    setLessonFeedback({
      type: "bad",
      html: `❌ <strong>Wrong</strong> — your answer: <span class="muted">${escapeHtml(userAnswer)}</span> · correct: <strong>${escapeHtml(answer)}</strong>`
    });
  }

  setLessonControlsEnabled({ skip: false, reveal: !isCorrect });
  setManualNextButtonVisible(!isCorrect);

  if (isCorrect) {
    scheduleAutoNext();
  } else {
    clearAutoNextTimer();
  }
}

function onChooseOption(optionText) {
  if (getCurrentAnswerMode() !== "test") return;
  const word = getCurrentWord();
  if (!word || state.lesson.answeredCurrent) return;

  const { answer } = getQA(word);
  const isCorrect = normalize(optionText) === normalize(answer);
  markAnswered(isCorrect, optionText);
}

function onTypeAnswerCheck() {
  if (getCurrentAnswerMode() === "test") return;
  const word = getCurrentWord();
  if (!word || state.lesson.done) return;
  if (state.lesson.answeredCurrent) return;

  const user = els.answerInput.value;
  const { answer } = getQA(word);
  const isCorrect = normalize(user) === normalize(answer);
  markAnswered(isCorrect, user);
}

function revealAnswer() {
  const word = getCurrentWord();
  if (!word) return;

  const { answer } = getQA(word);
  setLessonFeedback({ type: "neutral", html: `👀 <strong>Answer</strong>: <strong>${escapeHtml(answer)}</strong>` });
}

async function showExamples() {
  const word = getCurrentWord();
  if (!word || state.lesson.done || state.lesson.examplesLoading) return;

  const requestId = state.lesson.exampleRequestId + 1;
  state.lesson.exampleRequestId = requestId;
  state.lesson.examplesLoading = true;
  state.lesson.exampleResponse = "";
  updateShowExamplesButton();
  renderExampleResponse();

  try {
    const responseText = await askGpt(buildExampleMessages(word));
    if (state.lesson.exampleRequestId !== requestId) return;
    state.lesson.exampleResponse = responseText;
    console.log(responseText);
  } catch (err) {
    if (state.lesson.exampleRequestId !== requestId) return;
    state.lesson.exampleResponse = "Failed to load example.";
    console.error("[examples] Failed to generate example sentence.", err);
  } finally {
    if (state.lesson.exampleRequestId !== requestId) return;
    state.lesson.examplesLoading = false;
    updateShowExamplesButton();
    renderExampleResponse();
  }
}

function nextWord() {
  if (state.lesson.done || state.lesson.chunk.awaitingContinue) return;

  clearAutoNextTimer();
  state.lesson.manualNextPending = false;
  setManualNextButtonVisible(false);

  state.lesson.cursor += 1;
  if (state.lesson.cursor >= state.lesson.queue.length) {
    if (isChunkLessonMode()) {
      handleChunkQueueFinished();
    } else {
      completeLesson();
    }
    return;
  }

  renderLessonWord();
}

function skipWord() {
  clearAutoNextTimer();
  const word = getCurrentWord();
  if (!word || state.lesson.done) return;

  if (isChunkLessonMode() && !state.lesson.chunk.errorWords.includes(word)) {
    state.lesson.chunk.errorWords.push(word);
  }

  state.lesson.stats.skipped += 1;
  updateLessonStatsUI();
  nextWord();
}

function handleChunkQueueFinished() {
  if (!isChunkLessonMode()) {
    completeLesson();
    return;
  }

  if (state.lesson.chunk.errorWords.length) {
    const retryQueue = [...state.lesson.chunk.errorWords];
    state.lesson.chunk.errorWords = [];
    state.lesson.chunk.inRetryPass = true;
    state.lesson.queue = retryQueue;
    state.lesson.cursor = 0;
    state.lesson.answeredCurrent = false;
    setLessonFeedback({
      type: "neutral",
      html: `<strong>Retry</strong> ${retryQueue.length} word(s) with mistakes.`
    });
    renderLessonWord();
    return;
  }

  state.lesson.chunk.inRetryPass = false;

  if (isSoftLessonMode() && state.lesson.chunk.phase === "test") {
    const currentChunk = state.lesson.chunk.chunks[state.lesson.chunk.chunkIndex] || [];
    state.lesson.chunk.phase = "typeAnswer";
    state.lesson.chunk.errorWords = [];
    state.lesson.queue = [...currentChunk];
    state.lesson.cursor = 0;
    state.lesson.answeredCurrent = false;
    setLessonFeedback({
      type: "ok",
      html: "<strong>Chunk test complete!</strong> Now type answers for the same chunk."
    });
    renderLessonWord();
    return;
  }

  const isLastChunk = state.lesson.chunk.chunkIndex >= state.lesson.chunk.chunks.length - 1;
  if (isLastChunk) {
    completeLesson();
    return;
  }

  const chunkNo = state.lesson.chunk.chunkIndex + 1;
  const chunkTotal = state.lesson.chunk.chunks.length;
  openChunkCongrats("Small congrats!", `Chunk ${chunkNo}/${chunkTotal} complete.`);
}

function continueChunkFlow() {
  if (!isChunkLessonMode() || !state.lesson.chunk.awaitingContinue || state.lesson.done) return;

  closeChunkCongrats();
  state.lesson.chunk.chunkIndex += 1;

  if (state.lesson.chunk.chunkIndex >= state.lesson.chunk.chunks.length) {
    completeLesson();
    return;
  }

  const nextChunk = state.lesson.chunk.chunks[state.lesson.chunk.chunkIndex] || [];
  state.lesson.chunk.phase = isSoftLessonMode() ? "test" : "typeAnswer";
  state.lesson.chunk.inRetryPass = false;
  state.lesson.chunk.errorWords = [];
  state.lesson.queue = [...nextChunk];
  state.lesson.cursor = 0;
  state.lesson.answeredCurrent = false;
  setLessonFeedback({ type: "ok", html: "<strong>Small congrats!</strong> Moving to the next chunk." });
  renderLessonWord();
}

function completeLesson() {
  clearAutoNextTimer();
  state.lesson.manualNextPending = false;
  setManualNextButtonVisible(false);
  state.lesson.done = true;
  state.lesson.exampleRequestId += 1;
  state.lesson.examplesLoading = false;
  state.lesson.exampleResponse = "";
  closeChunkCongrats();

  const total = state.words.length;
  const answered = state.lesson.stats.answered;
  const correct = state.lesson.stats.correct;
  const skipped = state.lesson.stats.skipped;

  updateLessonTopRow();
  setLessonControlsEnabled({ skip: false, reveal: false });
  updateShowExamplesButton();
  renderExampleResponse();

  els.progressText.textContent = `Completed all ${total} words.`;
  els.idText.textContent = "";
  els.prompt.textContent = "Congrats!";
  els.subprompt.textContent = "You can go to setup or run the lesson again.";
  els.note.textContent = "";

  els.testArea.style.display = "none";
  els.practiceArea.style.display = "none";

  const acc = answered === 0 ? 0 : Math.round((correct / answered) * 100);
  els.congratsSummary.textContent = `Answered: ${answered}, Correct: ${correct}, Skipped: ${skipped}, Accuracy: ${acc}%`;
  els.congratsBox.classList.remove("hidden");

  setLessonFeedback({
    type: "ok",
    html: `🎉 <strong>Lesson complete</strong> — all words are finished.`
  });
}

function startLesson() {
  if (!state.words.length) {
    setSetupFeedback({
      type: "bad",
      html: "⚠️ <strong>No pack selected</strong>. Please add/select a pack first."
    });
    return;
  }

  resetLessonState();

  if (isChunkLessonMode()) {
    const orderedWords = isStraightLessonMode() ? [...state.words] : shuffle(state.words);
    state.lesson.chunk.chunks = splitIntoChunks(orderedWords, state.lesson.chunk.chunkSize);
    state.lesson.chunk.chunkIndex = 0;
    state.lesson.chunk.phase = isSoftLessonMode() ? "test" : "typeAnswer";
    state.lesson.chunk.inRetryPass = false;
    state.lesson.chunk.errorWords = [];
    state.lesson.chunk.awaitingContinue = false;
    state.lesson.queue = [...(state.lesson.chunk.chunks[0] || [])];
  } else {
    state.lesson.queue = shuffle(state.words);
  }

  updateLessonTopRow();

  setPage("lesson");
  renderLessonWord();
}

function backToSetup() {
  resetLessonState();
  setPage("setup");
  showModeAreas();
  setSetupFeedback({
    type: "neutral",
    html: '<span class="muted">Returned to setup. Lesson progress was not saved.</span>'
  });
}

function goToSetupPage() {
  setPage("setup");
  showModeAreas();
}

function openTemplateUploadPage() {
  setPage("templateUpload");
}

function openChatPage() {
  setPage("chat");
}

function sanitizeWordsArray(words) {
  if (!Array.isArray(words)) return [];
  const cleaned = words
    .filter((x) => x && typeof x === "object")
    .map((x, idx) => ({
      id: x.id ?? idx + 1,
      ru: String(x.ru ?? "").trim(),
      es: String(x.es ?? "").trim()
    }))
    .filter((x) => x.ru && x.es);

  const seen = new Set();
  const unique = [];
  for (const w of cleaned) {
    const key = `${w.ru}|||${w.es}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(w);
  }
  return unique;
}

function getSelectedTemplate() {
  const selectedId = els.templateSelect.value;
  return getAvailableTemplates().find((tpl) => tpl.templateId === selectedId) || null;
}

function getAvailableTemplates() {
  if (state.firebaseTemplatesError != null) return BUILT_IN_TEMPLATES;
  if (state.firebaseTemplatesLoaded) return state.firebaseTemplates;
  return [];
}

async function loadFirebaseTemplates() {
  try {
    const templates = await fetchFirebaseTemplates();
    state.firebaseTemplates = templates;
    state.firebaseTemplatesLoaded = true;
    state.firebaseTemplatesError = null;
    console.info("[firebase] Templates from /templates:", templates);
    renderTemplateSelect();
  } catch (err) {
    const firebaseError = err instanceof Error ? err : new Error(String(err ?? "Unknown Firebase templates error"));
    state.firebaseTemplates = [];
    state.firebaseTemplatesLoaded = true;
    state.firebaseTemplatesError = firebaseError;
    console.error("[firebase] Failed to load templates from /templates.", firebaseError);
    console.info("[firebase] Falling back to local templates:", BUILT_IN_TEMPLATES);
    renderTemplateSelect();
  }
}

// --------- Init / Restore ---------
function restoreFromStorage() {
  const stored = lsReadJSON(LS.PACKS, []);
  const packs = Array.isArray(stored) ? stored : [];

  state.packs = packs
    .filter((p) => p && typeof p === "object")
    .map((p) => ({
      id: String(p.id ?? uid()),
      name: String(p.name ?? "Pack").trim() || "Pack",
      createdAt: Number(p.createdAt ?? Date.now()),
      templateId: typeof p.templateId === "string" && p.templateId ? p.templateId : null,
      words: sanitizeWordsArray(p.words)
    }))
    .filter((p) => p.words.length > 0);

  const seenNames = new Set();
  for (const p of state.packs) {
    if (!seenNames.has(p.name)) {
      seenNames.add(p.name);
      continue;
    }
    p.name = ensureUniquePackName(p.name);
    seenNames.add(p.name);
  }

  const storedActive = localStorage.getItem(LS.ACTIVE);
  const activeCandidate = storedActive && state.packs.find((p) => p.id === storedActive) ? storedActive : null;

  renderPackList();
  renderTemplateSelect();

  if (activeCandidate) {
    selectPack(activeCandidate, { silent: true });
    setSetupFeedback({
      type: "neutral",
      html: "<strong>Restored</strong>. Start lesson when ready."
    });
  } else if (state.packs.length) {
    selectPack(state.packs[0].id, { silent: true });
    setSetupFeedback({
      type: "neutral",
      html: `<strong>Restored</strong> ${state.packs.length} pack(s). Start lesson when ready.`
    });
  } else {
    state.activePackId = null;
    state.words = [];
    setStatus("No pack selected");
    updatePills();
    updatePreview();
    updateSetupActions();
  }

  persistPacks();
}

function normalizeTheme(themeValue) {
  return themeValue === THEMES.SOFT ? THEMES.SOFT : DEFAULT_THEME;
}

function applyTheme(themeValue, opts = { persist: true }) {
  const theme = normalizeTheme(themeValue);
  document.documentElement.dataset.theme = theme;

  if (els.themeSelect) {
    els.themeSelect.value = theme;
  }

  if (opts.persist) {
    localStorage.setItem(LS.THEME, theme);
  }
}

function restoreTheme() {
  const savedTheme = localStorage.getItem(LS.THEME);
  applyTheme(savedTheme, { persist: false });
}

// --------- Events ---------
els.addTemplateBtn.addEventListener("click", () => {
  const tpl = getSelectedTemplate();
  if (!tpl) {
    setSetupFeedback({ type: "bad", html: "⚠️ <strong>No template selected</strong>." });
    return;
  }

  if (state.packs.some((p) => p.templateId === tpl.templateId)) {
    setSetupFeedback({
      type: "bad",
      html: `⚠️ <strong>Already added</strong>: "${escapeHtml(tpl.name)}" is already in your packs.`
    });
    renderTemplateSelect();
    return;
  }

  const words = sanitizeWordsArray(tpl.words);
  if (!words.length) {
    setSetupFeedback({
      type: "bad",
      html: `⚠️ <strong>Template error</strong>: "${escapeHtml(tpl.name)}" has no valid words.`
    });
    return;
  }

  const newPack = addPackFromWords(words, tpl.name, { templateId: tpl.templateId });
  if (!newPack) {
    setSetupFeedback({
      type: "bad",
      html: `⚠️ <strong>Already added</strong>: "${escapeHtml(tpl.name)}" is already in your packs.`
    });
    return;
  }

  setSetupFeedback({
    type: "ok",
    html: `✅ <strong>Added template</strong> “${escapeHtml(newPack.name)}” (${newPack.words.length} words). Start lesson when ready.`
  });
});

els.clearPacksBtn.addEventListener("click", clearAllPacks);

els.taskMode.addEventListener("change", () => {
  state.mode = els.taskMode.value;
  updatePills();
  showModeAreas();
});

els.direction.addEventListener("change", () => {
  state.dir = els.direction.value;
  updatePills();
});

if (els.themeSelect) {
  els.themeSelect.addEventListener("change", () => {
    applyTheme(els.themeSelect.value);
  });
}

els.backToSetupBtn.addEventListener("click", backToSetup);
els.goSetupBtn.addEventListener("click", backToSetup);
els.startLessonBtn.addEventListener("click", startLesson);
els.replayLessonBtn.addEventListener("click", startLesson);

els.skipBtn.addEventListener("click", skipWord);
els.revealBtn.addEventListener("click", revealAnswer);
els.showExamplesBtn.addEventListener("click", () => {
  void showExamples();
});
els.nextBtn.addEventListener("click", () => {
  if (!state.lesson.manualNextPending) return;
  nextWord();
});
els.checkBtn.addEventListener("click", onTypeAnswerCheck);
els.continueChunkBtn.addEventListener("click", continueChunkFlow);

// Hotkeys
window.addEventListener("keydown", (e) => {
  if (state.page !== "lesson" || state.lesson.done) return;

  if (e.key === "Enter") {
    if (state.lesson.chunk.awaitingContinue && isChunkLessonMode()) {
      continueChunkFlow();
      return;
    }

    if (state.lesson.manualNextPending) {
      e.preventDefault();
      nextWord();
      return;
    }

    if (getCurrentAnswerMode() !== "test") {
      if (!state.lesson.answeredCurrent) {
        onTypeAnswerCheck();
      }
      return;
    }
  }
});

// Initial
initChatPage({
  elements: els,
  goToSetupPage,
  goToChatPage: openChatPage
});

initTemplateUploadPage({
  elements: els,
  goToSetupPage,
  goToTemplateUploadPage: openTemplateUploadPage,
  onTemplateUploaded: (template) => {
    state.firebaseTemplatesError = null;
    state.firebaseTemplatesLoaded = true;
    state.firebaseTemplates = [
      ...state.firebaseTemplates.filter((item) => item.templateId !== template.templateId),
      template
    ];
    renderTemplateSelect();
    void loadFirebaseTemplates();
  }
});

renderTemplateSelect();
restoreTheme();
updatePills();
updateLessonStatsUI();
showModeAreas();
setPage("setup");
updateSetupActions();
resetLessonState();
restoreFromStorage();
void loadFirebaseTemplates();
