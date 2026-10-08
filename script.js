const chatPanel = document.querySelector("#chat-panel");
const chatLauncher = document.querySelector("#chat-launcher");
const chatClose = document.querySelector("#chat-close");
const chatForm = document.querySelector("#chat-form");
const chatInput = document.querySelector("#chat-input");
const chatMessages = document.querySelector("#chat-messages");
const toast = document.querySelector("#toast");
const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const chatEndpoint = isLocalDevelopment && window.location.port !== "8000"
  ? "http://127.0.0.1:8000/chat"
  : "/chat";
let toastTimeout;
let previousResponseId = null;

function openChat(message) {
  chatPanel.classList.add("is-open");
  chatPanel.setAttribute("aria-hidden", "false");
  chatLauncher.setAttribute("aria-expanded", "true");
  window.setTimeout(() => chatInput.focus(), 150);
  if (message) {
    chatInput.value = message;
    chatForm.requestSubmit();
  }
}

function closeChat() {
  chatPanel.classList.remove("is-open");
  chatPanel.setAttribute("aria-hidden", "true");
  chatLauncher.setAttribute("aria-expanded", "false");
  chatLauncher.focus();
}

function addMessage(text, sender) {
  const row = document.createElement("div");
  row.className = `message-row ${sender === "user" ? "user-row" : "bot-row"}`;
  if (sender === "bot") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "✳";
    row.append(avatar);
  }

  const message = document.createElement("div");
  message.className = `message ${sender === "user" ? "user-message" : "bot-message"}`;
  message.textContent = text;
  row.append(message);
  chatMessages.append(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

document.querySelectorAll("[data-open-chat]").forEach((button) => {
  button.addEventListener("click", () => openChat());
});

chatLauncher.addEventListener("click", () => {
  if (chatPanel.classList.contains("is-open")) closeChat();
  else openChat();
});
chatClose.addEventListener("click", closeChat);

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) {
    chatInput.focus();
    return;
  }
  addMessage(message, "user");
  chatInput.value = "";
  const suggestions = document.querySelector("#suggestion-list");
  if (suggestions) suggestions.remove();
  const submitButton = chatForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  submitButton.setAttribute("aria-label", "Enviando mensagem");

  fetch(chatEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, previous_response_id: previousResponseId }),
  })
    .then(async (response) => {
      const rawBody = await response.text();
      let data = {};

      try {
        data = rawBody ? JSON.parse(rawBody) : {};
      } catch (parseError) {
        console.error("Resposta inválida do endpoint /chat:", rawBody, parseError);
      }

      if (!response.ok) {
        throw new Error(
          data.error || `O servidor respondeu com erro (${response.status}). Verifique se o backend está ativo.`,
        );
      }
      if (!data.reply) {
        throw new Error("O servidor não enviou uma resposta. Verifique os logs do backend.");
      }
      previousResponseId = data.response_id || previousResponseId;
      addMessage(data.reply, "bot");
    })
    .catch((error) => addMessage(error.message, "bot"))
    .finally(() => {
      submitButton.disabled = false;
      submitButton.setAttribute("aria-label", "Enviar mensagem");
      chatInput.focus();
    });
});

document.querySelectorAll(".suggestion-chip").forEach((button) => {
  button.addEventListener("click", () => {
    chatInput.value = button.textContent;
    chatForm.requestSubmit();
  });
});

document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      const active = chip === button;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll(".destination-card").forEach((card) => {
      card.hidden = filter !== "todos" && card.dataset.category !== filter;
    });
  });
});

document.querySelectorAll(".save-button").forEach((button) => {
  button.addEventListener("click", () => {
    openChat(`Quero saber mais sobre ${button.dataset.destination}`);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && chatPanel.classList.contains("is-open")) closeChat();
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

document.querySelector(".desktop-link").addEventListener("click", (event) => {
  event.preventDefault();
  showToast("Você já está vendo todos os destinos disponíveis ✨");
});
