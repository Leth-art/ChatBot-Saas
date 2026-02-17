import express from "express";
import OpenAI from "openai";
import dotenv from "dotenv";
import Client from "../models/Client.js";

dotenv.config();
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post("/", async (req, res) => {
  try {
    const { message, apiKey } = req.body;

    // Vérifier le client
    const client = await Client.findOne({ apiKey });
    if (!client) return res.status(401).json({ reply: "Clé invalide" });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `Tu es un assistant pour l'entreprise ${client.name}` },
        { role: "user", content: message }
      ],
    });

    res.json({ reply: completion.choices[0].message.content });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "Erreur serveur" });
  }
});

export default router;
