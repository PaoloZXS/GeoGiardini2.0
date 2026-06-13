import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

interface LoginPageProps {
  onLoginSuccess: (role: "admin" | "cliente") => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<"admin" | "cliente">(
    "admin"
  );
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (selectedRole === "admin") {
        const trimmedUser = username.trim();
        const trimmedPass = password.trim();
        if (
          (trimmedUser === "Angelo" && trimmedPass === "A2026") ||
          (trimmedUser.toLowerCase() === "giulio" && trimmedPass === "G2026")
        ) {
          window.localStorage.setItem("loginRole", "admin");
          window.localStorage.setItem("loginUsername", trimmedUser);
          window.localStorage.setItem(
            "userId",
            trimmedUser === "Angelo" ? "1" : "2"
          );
          onLoginSuccess("admin");
          navigate("/admin");
          return;
        }
        setError("Credenziali non valide");
        setLoading(false);
        return;
      } else {
        // Cliente: login tramite tabella clienti su Supabase
        const { data, error: queryError } = await supabase
          .from("clienti")
          .select("id, username, nome_cliente")
          .eq("username", username)
          .eq("codice", password)
          .single();

        if (queryError || !data) {
          setError("Credenziali non valide");
          setLoading(false);
          return;
        }

        window.localStorage.setItem("loginRole", "cliente");
        window.localStorage.setItem(
          "loginUsername",
          data.nome_cliente || data.username
        );
        window.localStorage.setItem("userId", String(data.id));
        onLoginSuccess("cliente");
      }
    } catch (err) {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{
        backgroundImage: 'url("/images/sfondo1.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "fixed",
        backgroundColor: "#000000"
      }}
    >
      <div className="w-full max-w-sm">
        {/* Logo e Titolo */}
        <div
          className="text-center mb-8"
          style={{ transform: "translateY(-50px)" }}
        >
          <div className="w-32 h-32 mx-auto -mt-8">
            <img
              src="/leaf-512.png"
              alt="GeoGiardini"
              className="w-32 h-32"
              style={{ position: "relative", top: "20px" }}
            />
          </div>
          <h1 className="text-2xl font-bold italic leading-tight text-[#2563eb]">
            GeoGiardini
          </h1>
          <p className="font-bold text-[#2563eb] mt-1">
            Gestione completa delle aree verdi
          </p>
        </div>

        {/* Selettore ruolo */}
        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => {
              setSelectedRole("admin");
              setError("");
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
              selectedRole === "admin"
                ? "bg-[#154212] text-white shadow-lg"
                : "bg-white text-[#154212] border-2 border-[#c2c9bb]"
            }`}
          >
            Amministratore
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedRole("cliente");
              setError("");
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
              selectedRole === "cliente"
                ? "bg-[#154212] text-white shadow-lg"
                : "bg-white text-[#154212] border-2 border-[#c2c9bb]"
            }`}
          >
            Cliente
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleLogin}
          className="rounded-2xl p-6 shadow-lg border border-[#eceeec] space-y-4"
        >
          <div>
            <label className="block text-sm font-bold text-black mb-1.5 ml-1">
              {selectedRole === "admin" ? "Admin" : "Nome Cliente"}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                selectedRole === "admin"
                  ? "Inserisci Admin"
                  : "Inserisci Nome Cliente"
              }
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-black mb-1.5 ml-1">
              {selectedRole === "admin" ? "Password" : "Codice"}
            </label>
            <div className="relative">
              <input
                type={
                  selectedRole === "admin" && !showPassword
                    ? "password"
                    : "text"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  selectedRole === "admin" ? "••••••••" : "Inserisci il codice"
                }
                className="input-field w-full pr-10"
              />
              {selectedRole === "admin" && (
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-500 hover:text-gray-700"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-xl border border-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full text-base font-bold"
            style={{
              minWidth: "14rem",
              minHeight: "3.25rem",
              boxShadow: "0 25px 80px rgba(20, 64, 18, 0.14)"
            }}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Accesso in corso...
              </span>
            ) : (
              "Accedi"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-[#000080] font-bold mt-6">
          {selectedRole === "admin"
            ? "Accesso riservato all'amministratore."
            : "Accedi per vedere i lavori svolti nel tuo giardino."}
        </p>
      </div>
    </div>
  );
}
