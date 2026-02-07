"use client";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [username, setUsername] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    setData(null);
    
    // 1. Get the Token
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.provider_token;

    if (!token) {
      setError("❌ No Token Found! Please Log In.");
      setLoading(false);
      return;
    }

    // 2. Call the API
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, token }),
      });

      const result = await res.json();
      
      if (!res.ok) throw new Error(result.error || "API Failed");
      
      setData(result); // Success!
    } catch (err: any) {
      setError("❌ Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-10 font-mono">
      {/* 1. The Header */}
      <div className="mb-8 border-b border-gray-800 pb-4">
        <h1 className="text-3xl font-bold text-blue-500">Phase 2: Logic Test</h1>
        <p className="text-gray-400">If this works, your backend is complete.</p>
      </div>

      {/* 2. The Input */}
      <div className="flex gap-4 mb-8">
        <input 
          className="bg-gray-900 border border-gray-700 p-3 rounded text-white w-64 focus:border-blue-500 outline-none"
          placeholder="Enter GitHub Username..." 
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button 
          onClick={handleAnalyze}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded font-bold transition-colors disabled:opacity-50"
        >
          {loading ? "Scanning..." : "Run Analysis"}
        </button>
      </div>

      {/* 3. The Output Area */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 min-h-[300px]">
        {loading && <p className="text-yellow-400 animate-pulse">⚡ Connecting to GitHub API...</p>}
        {error && <p className="text-red-400 font-bold">{error}</p>}
        
        {data && (
          <div>
             <h2 className="text-green-400 font-bold mb-2">✅ SUCCESS! Raw Data Received:</h2>
             <pre className="text-xs text-green-300 overflow-auto max-h-[500px]">
               {JSON.stringify(data, null, 2)}
             </pre>
          </div>
        )}
        
        {!loading && !data && !error && (
          <p className="text-gray-600">Waiting for input...</p>
        )}
      </div>
    </div>
  );
}
