import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import crypto from "crypto";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


const clients = {};
const FREE_LIMIT = 20;

// Génération ID
function generateId(prefix) {
  return prefix + "_" + crypto.randomBytes(4).toString("hex");
}

// 🔹 REGISTER AVEC CONFIG BOUTIQUE
app.post("/register", (req, res) => {
  const {
    shopName,
    country,
    productType,
    deliveryInfo,
    paymentMethods,
    whatsappNumber,
    tone
  } = req.body;

  const clientId = generateId("client");
  const clientKey = generateId("key");

  clients[clientId] = {
    clientKey,
    usage: 0,
    config: {
      shopName,
      country,
      productType,
      deliveryInfo,
      paymentMethods,
      whatsappNumber,
      tone
    }
  };

  res.json({ clientId, clientKey });
});

// 🔹 CHAT INTELLIGENT
app.post("/chat", async (req, res) => {
  try {
    const { message, clientId, clientKey } = req.body;

    const client = clients[clientId];

    if (!client) {
      return res.status(403).json({ error: "Client inconnu" });
    }

    if (client.clientKey !== clientKey) {
      return res.status(403).json({ error: "Clé invalide" });
    }

    if (client.usage >= FREE_LIMIT) {
      return res.status(403).json({ error: "Limite gratuite atteinte" });
    }

    client.usage++;

    const { shopName, country, productType, deliveryInfo, paymentMethods, whatsappNumber, tone } = client.config;

    const systemPrompt = `
Tu es l’assistant vendeur de ${shopName} au ${country}.
Produits : ${productType}.
Livraison : ${deliveryInfo}.
Paiement : ${paymentMethods}.
Ton : ${tone}.
Ton objectif est d’augmenter les ventes et rassurer le client.

Tu dois répondre en JSON strict avec ce format :
{
  "reply": "...",
  "intent": "buy" ou "info"
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.7
    });

    const rawContent = response.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      parsed = {
        reply: rawContent,
        intent: "info"
      };
    }

    let finalReply = parsed.reply;

    if (parsed.intent === "buy") {
      const encodedMessage = encodeURIComponent(
        `Bonjour, je veux commander chez ${shopName}.`
      );

      const whatsappLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

      finalReply += `\n\n👉 Commander ici : ${whatsappLink}`;
    }

    res.json({
      reply: finalReply,
      usage: client.usage,
      remaining: FREE_LIMIT - client.usage
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SaaS lancé sur port ${PORT}`);
});

