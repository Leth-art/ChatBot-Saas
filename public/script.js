async function sendMessage() {
  const input = document.getElementById("message");
  const chatBox = document.getElementById("chat-box");
  const message = input.value;

  if (!message) return;

  chatBox.innerHTML += `<div class="message user">${message}</div>`;

  const response = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, apiKey: "demo-client-123" })
  });

  const data = await response.json();

  chatBox.innerHTML += `<div class="message bot">${data.reply}</div>`;

  input.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;
}
