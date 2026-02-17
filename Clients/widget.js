async function sendMessage(message) {
  const response = await fetch("http://localhost:3000/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, apiKey: "clientXYZ" })
  });
  const data = await response.json();
  return data.reply;
}

// Exemple simple d’affichage
function initChat() {
  const chatBox = document.createElement("div");
  chatBox.id = "chat-widget";
  document.body.appendChild(chatBox);
}
initChat();
