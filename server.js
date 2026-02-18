import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

/* ================= DATABASE ================= */

const db = await mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  ssl: { rejectUnauthorized: false }
});

/* ================= AUTH MIDDLEWARE ================= */

function auth(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token manquant" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: "Token invalide" });
  }
}

/* ================= ROUTES ================= */

// Test
app.get("/", (req, res) => {
  res.send("SaaS API running ✅");
});

// Register
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const [result] = await db.query(
    "INSERT INTO clients (name, email, password) VALUES (?, ?, ?)",
    [name, email, hashedPassword]
  );

  res.json({ clientId: result.insertId, message: "Client enregistré ✅" });
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await db.query(
    "SELECT * FROM clients WHERE email = ?",
    [email]
  );

  if (rows.length === 0)
    return res.status(404).json({ error: "Client inconnu" });

  const client = rows[0];

  const valid = await bcrypt.compare(password, client.password);

  if (!valid)
    return res.status(401).json({ error: "Mot de passe incorrect" });

  const token = jwt.sign(
    { clientId: client.id, email: client.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

// Messages
app.post("/messages", auth, async (req, res) => {
  const { message } = req.body;

  const [result] = await db.query(
    "INSERT INTO messages (client_id, message) VALUES (?, ?)",
    [req.user.clientId, message]
  );

  res.json({ messageId: result.insertId });
});

app.get("/messages", auth, async (req, res) => {
  const [messages] = await db.query(
    "SELECT * FROM messages WHERE client_id = ? ORDER BY created_at DESC",
    [req.user.clientId]
  );

  res.json(messages);
});

// Paiement Axazara
app.post("/pay-axazara", auth, async (req, res) => {
  const { amount, currency } = req.body;

  try {
    const response = await axios.post(
      "https://api.axazara.com/v1/payments",
      {
        tx_ref: `tx-${Date.now()}`,
        amount,
        currency,
        customer: { email: req.user.email },
        redirect_url: "https://chatbot-saas-lcsl.onrender.com/payment-success"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.AXAZARA_KEY}`
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
