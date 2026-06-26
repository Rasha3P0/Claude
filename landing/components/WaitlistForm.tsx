"use client";

import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setEmail("");
        setMessage(data.message ?? "You're on the list.");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-md px-6 py-5 text-left">
        <p className="font-medium text-emerald-800">You&apos;re on the list.</p>
        <p className="text-sm text-emerald-700 mt-1">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "loading"}
          className="flex-1 px-4 py-3 border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="px-6 py-3 bg-slate-900 text-white font-medium rounded-md hover:bg-slate-700 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {status === "loading" ? "Registering…" : "Register interest"}
        </button>
      </div>
      {status === "error" && (
        <p className="text-sm text-red-600 mt-3 text-center">{message}</p>
      )}
    </form>
  );
}
