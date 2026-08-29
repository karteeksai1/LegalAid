import cors from "cors";
import express from "express";
import helmet from "helmet";
import multer from "multer";
import axios from "axios";
import { config } from "./config.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({ storage: multer.memoryStorage() });

app.get("/health", (_req, res) => {
  res.json({ status: "ok", aiService: config.FASTAPI_BASE_URL });
});

// 1. Upload legal document to backend and analyze
app.post("/api/documents/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
    formData.append("file", blob, req.file.originalname);

    const response = await axios.post(`${config.FASTAPI_BASE_URL}/documents/upload`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });

    return res.status(201).json(response.data);
  } catch (error: any) {
    console.error("Upload error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.message;
    return res.status(status).json({ error: detail });
  }
});

// 2. Fetch list of analyzed documents
app.get("/api/documents", async (_req, res) => {
  try {
    const response = await axios.get(`${config.FASTAPI_BASE_URL}/documents`);
    return res.json(response.data);
  } catch (error: any) {
    console.error("List documents error:", error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.message;
    return res.status(status).json({ error: detail });
  }
});

// 3. Fetch single document status
app.get("/api/documents/:id", async (req, res) => {
  try {
    const response = await axios.get(`${config.FASTAPI_BASE_URL}/documents/${req.params.id}`);
    return res.json(response.data);
  } catch (error: any) {
    console.error("Get document error:", error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.message;
    return res.status(status).json({ error: detail });
  }
});

// 4. Fetch document analysis findings and consensus report
app.get("/api/documents/:id/analysis", async (req, res) => {
  try {
    const response = await axios.get(`${config.FASTAPI_BASE_URL}/documents/${req.params.id}/analysis`);
    return res.json(response.data);
  } catch (error: any) {
    console.error("Get analysis error:", error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.message;
    return res.status(status).json({ error: detail });
  }
});

// 5. Get Q&A Chat History for document
app.get("/api/documents/:id/chat", async (req, res) => {
  try {
    const response = await axios.get(`${config.FASTAPI_BASE_URL}/documents/${req.params.id}/chat`);
    return res.json(response.data);
  } catch (error: any) {
    console.error("Get chat history error:", error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.message;
    return res.status(status).json({ error: detail });
  }
});

// 6. Post question to Q&A Chat for document
app.post("/api/documents/:id/chat", async (req, res) => {
  try {
    const response = await axios.post(`${config.FASTAPI_BASE_URL}/documents/${req.params.id}/chat`, req.body);
    return res.json(response.data);
  } catch (error: any) {
    console.error("Post chat message error:", error.message);
    const status = error.response?.status || 500;
    const detail = error.response?.data?.detail || error.message;
    return res.status(status).json({ error: detail });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(config.GATEWAY_PORT, () => {
    console.log(`gateway listening on ${config.GATEWAY_PORT}`);
  });
}

