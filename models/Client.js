import mongoose from "mongoose";

const clientSchema = new mongoose.Schema({
  name: String,
  website: String,
  whatsapp: String,
  apiKey: String, // clé unique pour le client
});

export default mongoose.model("Client", clientSchema);
