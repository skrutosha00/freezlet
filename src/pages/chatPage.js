import { WORKER_URL } from "../services/exampleGenerator.js";

const CHAT_MODELS = ["gpt-5.4", "gpt-5.1"];
const CHAT_MESSAGES = [];

function setFeedback(element, { type = "neutral", html = "" } = {}) {
  element.classList.remove("ok", "bad");
  if (type === "ok") element.classList.add("ok");
  if (type === "bad") element.classList.add("bad");
  const content = html || '<span class="muted">…</span>';
  element.innerHTML = `<span class="feedback-line">${content}</span>`;
}

function renderModelOptions(selectElement) {
  selectElement.innerHTML = "";

  for (const model of CHAT_MODELS) {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    selectElement.appendChild(option);
  }
}

function buildChatEndpoint(apiKey) {
  const safeBase = WORKER_URL.endsWith("/") ? WORKER_URL : `${WORKER_URL}/`;
  return new URL(`nice/${encodeURIComponent(apiKey)}`, safeBase).toString();
}

async function readResponsePayload(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function autoResizeTextarea(textarea) {
  const minHeight = Number.parseFloat(window.getComputedStyle(textarea).minHeight) || 0;
  textarea.style.height = "0px";
  textarea.style.height = `${Math.max(textarea.scrollHeight + 2, minHeight)}px`;
}

function buildRequestMessages(systemPrompt) {
  const messages = [];
  const trimmedSystemPrompt = String(systemPrompt || "").trim();

  if (trimmedSystemPrompt) {
    messages.push({ role: "system", content: trimmedSystemPrompt });
  }

  for (const message of CHAT_MESSAGES) {
    if (message.role === "user" || message.role === "assistant") {
      messages.push({ role: message.role, content: message.content });
    }
  }

  return messages;
}

function getPendingAssistantChoicesEntry() {
  for (let index = CHAT_MESSAGES.length - 1; index >= 0; index -= 1) {
    if (CHAT_MESSAGES[index]?.role === "assistant-options") {
      return { index, message: CHAT_MESSAGES[index] };
    }
  }

  return null;
}

export default function initChatPage({ elements, goToSetupPage, goToChatPage }) {
  const {
    openChatPageBtn,
    backFromChatPageBtn,
    chatPageFeedback,
    chatApiKeyInput,
    chatModelSelect,
    chatSystemPromptInput,
    chatTranscript,
    chatReplyComposer,
    chatAssistantReplyInput,
    useCustomAssistantReplyBtn,
    regenerateChatRepliesBtn,
    chatMessageInput,
    sendChatMessageBtn,
    chatReplyOptions
  } = elements;

  let isBusy = false;
  let editingUserIndex = null;

  renderModelOptions(chatModelSelect);

  function getVisibleMessages() {
    return CHAT_MESSAGES
      .map((message, index) => ({ message, index }))
      .filter((entry) => entry.message.role === "user" || entry.message.role === "assistant");
  }

  function setBusy(nextBusy) {
    isBusy = nextBusy;
    sendChatMessageBtn.disabled = isBusy;
    chatApiKeyInput.disabled = isBusy;
    chatModelSelect.disabled = isBusy;
    chatSystemPromptInput.disabled = isBusy;
    chatMessageInput.disabled = isBusy;
    chatAssistantReplyInput.disabled = isBusy;
    useCustomAssistantReplyBtn.disabled = isBusy || !getPendingAssistantChoicesEntry();
    regenerateChatRepliesBtn.disabled = isBusy || !getPendingAssistantChoicesEntry();
    renderTranscript();
  }

  function renderReplyOptions(choices) {
    chatReplyOptions.innerHTML = "";
    chatReplyOptions.classList.toggle("hidden", !choices.length);

    for (const choice of choices) {
      const button = document.createElement("button");
      button.className = "btn btn-neutral chatReplyOptionBtn";
      button.type = "button";
      button.textContent = choice;
      button.disabled = isBusy;
      button.addEventListener("click", () => {
        selectAssistantReply(choice);
      });
      chatReplyOptions.appendChild(button);
    }
  }

  function renderReplyArea() {
    const pendingEntry = getPendingAssistantChoicesEntry();
    const choices = pendingEntry?.message?.contents || [];

    renderReplyOptions(choices);
    chatReplyComposer.classList.toggle("hidden", !choices.length);

    if (!choices.length) {
      chatAssistantReplyInput.value = "";
      autoResizeTextarea(chatAssistantReplyInput);
    }

    chatAssistantReplyInput.disabled = isBusy || !choices.length;
    useCustomAssistantReplyBtn.disabled = isBusy || !choices.length;
    regenerateChatRepliesBtn.disabled = isBusy || !choices.length;
  }

  function truncateConversationAfter(index) {
    CHAT_MESSAGES.splice(index + 1);
  }

  function renderTranscript() {
    chatTranscript.innerHTML = "";

    for (const { message, index } of getVisibleMessages()) {
      const bubble = document.createElement("div");
      bubble.className = `chatBubble ${message.role}`;

      const role = document.createElement("div");
      role.className = "chatBubbleRole";
      role.textContent = message.role === "user" ? "You" : "GPT";
      bubble.appendChild(role);

      if (message.role === "user" && editingUserIndex === index) {
        const editor = document.createElement("textarea");
        editor.className = "chatInlineEditor";
        editor.rows = 3;
        editor.value = message.content;
        editor.disabled = isBusy;
        bubble.appendChild(editor);
        autoResizeTextarea(editor);

        editor.addEventListener("input", () => {
          autoResizeTextarea(editor);
        });

        const actions = document.createElement("div");
        actions.className = "chatBubbleActions";

        const saveBtn = document.createElement("button");
        saveBtn.className = "btn btn-green";
        saveBtn.type = "button";
        saveBtn.textContent = "Save";
        saveBtn.disabled = isBusy;
        saveBtn.addEventListener("click", () => {
          const nextContent = String(editor.value || "").trim();
          if (!nextContent) {
            setFeedback(chatPageFeedback, {
              type: "bad",
              html: '<span class="muted">Edited user message cannot be empty.</span>'
            });
            return;
          }

          CHAT_MESSAGES[index].content = nextContent;
          truncateConversationAfter(index);
          editingUserIndex = null;
          renderTranscript();
          renderReplyArea();
          void requestRepliesForCurrentTurn({ mode: "edit" });
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.className = "btn btn-neutral";
        cancelBtn.type = "button";
        cancelBtn.textContent = "Cancel";
        cancelBtn.disabled = isBusy;
        cancelBtn.addEventListener("click", () => {
          editingUserIndex = null;
          renderTranscript();
        });

        actions.appendChild(saveBtn);
        actions.appendChild(cancelBtn);
        bubble.appendChild(actions);
      } else {
        const text = document.createElement("div");
        text.className = "chatBubbleText";
        text.textContent = message.content;
        bubble.appendChild(text);

        if (message.role === "user") {
          const actions = document.createElement("div");
          actions.className = "chatBubbleActions";

          const editBtn = document.createElement("button");
          editBtn.className = "btn btn-neutral";
          editBtn.type = "button";
          editBtn.textContent = "Edit";
          editBtn.disabled = isBusy;
          editBtn.addEventListener("click", () => {
            editingUserIndex = index;
            renderTranscript();
          });

          actions.appendChild(editBtn);
          bubble.appendChild(actions);
        }
      }

      chatTranscript.appendChild(bubble);
    }

    chatTranscript.scrollTop = chatTranscript.scrollHeight;
  }

  function ensureReadyForChatAction() {
    if (editingUserIndex != null) {
      setFeedback(chatPageFeedback, {
        type: "bad",
        html: '<span class="muted">Finish editing the current user message first.</span>'
      });
      return false;
    }

    const apiKey = String(chatApiKeyInput.value || "").trim();
    if (!apiKey) {
      setFeedback(chatPageFeedback, {
        type: "bad",
        html: '<span class="muted">Add an API key before sending a message.</span>'
      });
      return false;
    }

    return true;
  }

  async function fetchReplyOptions() {
    const response = await fetch(buildChatEndpoint(String(chatApiKeyInput.value || "").trim()), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: String(chatModelSelect.value || CHAT_MODELS[0]),
        n: 3,
        messages: buildRequestMessages(chatSystemPromptInput.value)
      })
    });

    const payload = await readResponsePayload(response);

    if (!response.ok) {
      throw payload;
    }

    const contents = Array.isArray(payload?.contents)
      ? payload.contents.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    if (!contents.length) {
      throw new Error("The worker returned no reply options.");
    }

    return contents;
  }

  function selectAssistantReply(choice) {
    if (isBusy) return;
    const pendingEntry = getPendingAssistantChoicesEntry();
    if (!pendingEntry || !pendingEntry.message.contents.includes(choice)) return;

    CHAT_MESSAGES.splice(pendingEntry.index, 1, { role: "assistant", content: choice });
    renderTranscript();
    renderReplyArea();
    console.log("[chat] Selected reply", choice);
    console.log("[chat] Messages", buildRequestMessages(chatSystemPromptInput.value));
    setFeedback(chatPageFeedback, {
      type: "ok",
      html: '<span class="muted">Reply selected and added to the dialogue.</span>'
    });
  }

  function useCustomAssistantReply() {
    if (isBusy) return;
    const pendingEntry = getPendingAssistantChoicesEntry();
    const customReply = String(chatAssistantReplyInput.value || "").trim();

    if (!pendingEntry) {
      setFeedback(chatPageFeedback, {
        type: "bad",
        html: '<span class="muted">Generate reply options before adding a custom assistant reply.</span>'
      });
      return;
    }

    if (!customReply) {
      setFeedback(chatPageFeedback, {
        type: "bad",
        html: '<span class="muted">Type your custom assistant reply first.</span>'
      });
      return;
    }

    CHAT_MESSAGES.splice(pendingEntry.index, 1, { role: "assistant", content: customReply });
    chatAssistantReplyInput.value = "";
    autoResizeTextarea(chatAssistantReplyInput);
    renderTranscript();
    renderReplyArea();
    console.log("[chat] Custom assistant reply", customReply);
    console.log("[chat] Messages", buildRequestMessages(chatSystemPromptInput.value));
    setFeedback(chatPageFeedback, {
      type: "ok",
      html: '<span class="muted">Custom assistant reply added to the dialogue.</span>'
    });
  }

  async function requestRepliesForCurrentTurn({ mode }) {
    if (!ensureReadyForChatAction()) return;

    const pendingEntry = getPendingAssistantChoicesEntry();
    if (mode === "regenerate" && !pendingEntry) {
      setFeedback(chatPageFeedback, {
        type: "bad",
        html: '<span class="muted">There are no reply options to regenerate.</span>'
      });
      return;
    }

    setBusy(true);
    setFeedback(chatPageFeedback, {
      html: `<span class="muted">${mode === "regenerate" ? "Regenerating" : "Sending"} request with model <strong>${chatModelSelect.value}</strong>…</span>`
    });

    try {
      const contents = await fetchReplyOptions();

      if (mode === "regenerate") {
        const latestPendingEntry = getPendingAssistantChoicesEntry();
        if (latestPendingEntry) {
          CHAT_MESSAGES[latestPendingEntry.index] = { role: "assistant-options", contents };
        }
      } else {
        CHAT_MESSAGES.push({ role: "assistant-options", contents });
      }

      setBusy(false);
      renderReplyArea();
      console.log("[chat] Reply options", contents);
      console.log("[chat] Messages", buildRequestMessages(chatSystemPromptInput.value));
      setFeedback(chatPageFeedback, {
        type: "ok",
        html: '<span class="muted">Choose the best reply option for this dialogue, use your own reply, or regenerate.</span>'
      });
    } catch (error) {
      if (mode === "send") {
        CHAT_MESSAGES.pop();
      }

      setBusy(false);
      renderTranscript();
      renderReplyArea();
      console.error(mode === "regenerate" ? "[chat] Regenerate error" : "[chat] Request error", error);
      setFeedback(chatPageFeedback, {
        type: "bad",
        html: `<span class="muted">${mode === "regenerate" ? "Regeneration failed" : "Request failed"}. Check the console for details.</span>`
      });
    } finally {
      chatMessageInput.focus();
    }
  }

  function sendMessage() {
    const message = String(chatMessageInput.value || "").trim();
    const pendingEntry = getPendingAssistantChoicesEntry();

    if (!ensureReadyForChatAction()) return;

    if (!message) {
      setFeedback(chatPageFeedback, {
        type: "bad",
        html: '<span class="muted">Type a message before sending.</span>'
      });
      return;
    }

    if (pendingEntry) {
      setFeedback(chatPageFeedback, {
        type: "bad",
        html: '<span class="muted">Resolve the current assistant turn before sending the next user message.</span>'
      });
      return;
    }

    CHAT_MESSAGES.push({ role: "user", content: message });
    chatMessageInput.value = "";
    autoResizeTextarea(chatMessageInput);
    renderTranscript();
    void requestRepliesForCurrentTurn({ mode: "send" });
  }

  renderTranscript();
  renderReplyArea();
  autoResizeTextarea(chatSystemPromptInput);
  autoResizeTextarea(chatAssistantReplyInput);
  autoResizeTextarea(chatMessageInput);

  openChatPageBtn.addEventListener("click", () => {
    renderTranscript();
    renderReplyArea();
    autoResizeTextarea(chatSystemPromptInput);
    autoResizeTextarea(chatAssistantReplyInput);
    autoResizeTextarea(chatMessageInput);
    setFeedback(chatPageFeedback, {
      html: '<span class="muted">Build the dialogue step by step: send a message, choose a reply, write your own reply, or regenerate.</span>'
    });
    goToChatPage();
  });

  backFromChatPageBtn.addEventListener("click", () => {
    goToSetupPage();
  });

  sendChatMessageBtn.addEventListener("click", () => {
    sendMessage();
  });

  useCustomAssistantReplyBtn.addEventListener("click", () => {
    useCustomAssistantReply();
  });

  regenerateChatRepliesBtn.addEventListener("click", () => {
    void requestRepliesForCurrentTurn({ mode: "regenerate" });
  });

  chatSystemPromptInput.addEventListener("input", () => {
    autoResizeTextarea(chatSystemPromptInput);
  });

  chatAssistantReplyInput.addEventListener("input", () => {
    autoResizeTextarea(chatAssistantReplyInput);
  });

  chatMessageInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    sendMessage();
  });

  chatMessageInput.addEventListener("input", () => {
    autoResizeTextarea(chatMessageInput);
  });
}
