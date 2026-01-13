"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const { data: session } = authClient.useSession();

  const onSubmit = async () => {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      await authClient.signUp.email(
        {
          name,
          email,
          password,
        },
        {
          onSuccess: () => {
            setMessage("User signed up successfully!");
            setName("");
            setEmail("");
            setPassword("");
          },
          onError: (error) => {
            setError(typeof error === 'string' ? error : "Error signing up");
          },
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (session) {
    return (
      <div className="max-w-md mx-auto mt-10">
        <h2 className="text-2xl font-bold mb-4">Welcome, {session.user?.name || session.user?.email}!</h2>
        <p>You are logged in.</p>
        <Button onClick={() => authClient.signOut()}>Sign Out</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-md mx-auto mt-10">
      <Input
        placeholder="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={loading}
      />
      <Input
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />
      <Input
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />
      <Button onClick={onSubmit} disabled={loading}>
        {loading ? "Signing up..." : "Sign Up"}
      </Button>
      {message && <p className="text-green-600">{message}</p>}
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
