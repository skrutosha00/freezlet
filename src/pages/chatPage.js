const CHAT_MODELS = ["gpt-5.4", "gpt-5.4-pro", "gpt-5.1"];

function setFeedback(element, { html = "" } = {}) {
  const content = html || '<span class="muted">…</span>';
  element.classList.remove("ok", "bad");
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

export default function initChatPage({ elements, goToSetupPage, goToChatPage }) {
  const { openChatPageBtn, backFromChatPageBtn, chatPageFeedback, chatModelSelect } = elements;

  renderModelOptions(chatModelSelect);

  openChatPageBtn.addEventListener("click", () => {
    setFeedback(chatPageFeedback, {
      html: '<span class="muted">Connect your ChatGPT API settings here. Message flow will be added later.</span>'
    });
    goToChatPage();
  });

  backFromChatPageBtn.addEventListener("click", () => {
    goToSetupPage();
  });
}
