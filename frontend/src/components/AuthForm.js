import React, { useEffect, useState } from "react";
import { apiClient, AUTH_TOKEN_KEY } from "./api";

function AuthForm({ onAuthSuccess, initialError = "" }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const res = await apiClient.post(endpoint, { email, password });
      const accessToken = res.data.access_token;
      localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
      onAuthSuccess(accessToken);
    } catch (err) {
      setError(err?.response?.data?.detail || "Authentication failed");
    }
  };

  return (
    <div className="card auth-card">
      <h2>{isLogin ? "Welcome Back" : "Create Account"}</h2>
      <p className="muted">Access your personalized screening dashboard.</p>
      <form onSubmit={handleSubmit} className="stack">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">{isLogin ? "Login" : "Create Account"}</button>
      </form>
      {error && <p className="error">{error}</p>}
      <p className="toggle-auth">
        {isLogin ? "No account?" : "Already registered?"}
        <button type="button" onClick={() => setIsLogin((prev) => !prev)}>
          {isLogin ? " Register" : " Login"}
        </button>
      </p>
    </div>
  );
}

export default AuthForm;
