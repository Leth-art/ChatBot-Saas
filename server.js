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
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1"
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
  console.log(`Server running on port ${PORT}`);
});

import mysql from 'mysql2/promise';


const db = await mysql.createPool({
  host: process.env.MYSQL_DATABASE,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl: { rejectUnauthorized: true }
});

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const [result] = await db.query(
    'INSERT INTO clients (name, email, password) VALUES (?, ?, ?)',
    [name, email, hashedPassword]
  );
  res.json({ clientId: result.insertId, message: 'Client enregistré ✅' });
});
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query('SELECT * FROM clients WHERE email = ?', [email]);
  if (rows.length === 0) return res.status(404).json({ error: 'Client inconnu' });

  const client = rows[0];
  const valid = await bcrypt.compare(password, client.password);
  if (!valid) return res.status(401).json({ error: 'Mot de passe incorrect' });

  const token = jwt.sign({ clientId: client.id, email: client.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});
// Test serveur
app.get('/', (req, res) => res.send('SaaS API running ✅'));

app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(403).json({ error: 'Token invalide' }); }
}
function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(403).json({ error: 'Token invalide' }); }
}
app.post('/messages', auth, async (req, res) => {
  const { message } = req.body;
  const [result] = await db.query(
    'INSERT INTO messages (client_id, message) VALUES (?, ?)',
    [req.user.clientId, message]
  );
  res.json({ messageId: result.insertId });
});

app.get('/messages', auth, async (req, res) => {
  const [messages] = await db.query(
    'SELECT * FROM messages WHERE client_id = ? ORDER BY created_at DESC',
    [req.user.clientId]
  );
  res.json(messages);
});
app.post('/pay-axazara', auth, async (req, res) => {
  const { amount, currency } = req.body; // ex : XOF, NGN, GHS
  try {
    const response = await axios.post(
      'https://api.axazara.com/v1/payments', // Exemple URL API test
      {
        tx_ref: `tx-${Date.now()}`,
        amount,
        currency,
        customer: { email: req.user.email, name: req.user.name },
        redirect_url: 'https://chatbot-saas-lcsl.onrender.com//payment-success'
      },
      { headers: { Authorization: `Bearer ${process.env.AXAZARA_KEY}` } }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
