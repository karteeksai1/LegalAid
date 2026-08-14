import React from "react";
import { createRoot } from "react-dom/client";
import { ShieldCheck, Upload } from "lucide-react";
import { healthPath } from "@legal-aid/shared";
import "./styles.css";

function App() {
  return (
    <main className="shell">
      <section className="workspace">
        <div className="toolbar">
          <div className="brand">
            <ShieldCheck size={24} aria-hidden="true" />
            <span>LegalAid Review</span>
          </div>
          <button type="button" className="iconButton" aria-label="Upload document">
            <Upload size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="panel">
          <h1>Adversarial legal review</h1>
          <p>Backend health route: {healthPath}</p>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);

