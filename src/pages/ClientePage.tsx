import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

interface ClientePageProps {
  onLogout: () => void;
}

export default function ClientePage({ onLogout }: ClientePageProps) {
  const userId = window.localStorage.getItem("userId");
  const userName = window.localStorage.getItem("loginUsername") || "Cliente";
  const [lavori, setLavori] = useState<any[]>([]);
  const [lavoriMese, setLavoriMese] = useState(0);
  const [ultimoLavoro, setUltimoLavoro] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      setLoading(true);

      // Lavori totali del cliente
      const { data: allLavori } = await supabase
        .from("lavori")
        .select("*, descrizioni_lavoro(descrizione)")
        .eq("id_cliente", userId)
        .order("data", { ascending: false })
        .limit(20);

      if (allLavori) {
        setLavori(allLavori);
        if (allLavori.length > 0) {
          setUltimoLavoro(new Date(allLavori[0].data).toLocaleDateString("it-IT"));
        }
      }

      // Lavori del mese
      const startMese = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { count } = await supabase
        .from("lavori")
        .select("id", { count: "exact", head: true })
        .eq("id_cliente", userId)
        .gte("data", startMese);

      setLavoriMese(count || 0);
      setLoading(false);
    };

    loadData();
  }, [userId]);

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      {/* Header */}
      <header className="bg-[#154212] text-white px-5 py-4 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2C7 5 4 10 4 14c0 4 3 7 8 7s8-3 8-7c0-4-3-9-8-12z" />
            <path d="M12 9v12" />
          </svg>
          <div>
            <h1 className="font-bold text-lg">GeoGiardini</h1>
            <p className="text-[#9dd090] text-xs">{userName}</p>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white bg-white/10 px-4 py-2 rounded-full transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Esci
        </button>
      </header>

      <div className="max-w-lg mx-auto px-5 pt-6 pb-10">
        {/* Statistiche */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card text-center animate-fade-in">
            <p className="text-3xl font-bold text-[#154212]">{lavoriMese}</p>
            <p className="text-sm text-[#72796e] mt-1">Lavori questo mese</p>
          </div>
          <div className="card text-center animate-fade-in">
            <p className="text-lg font-bold text-[#154212]">{ultimoLavoro || "—"}</p>
            <p className="text-sm text-[#72796e] mt-1">Ultimo lavoro</p>
          </div>
        </div>

        {/* Lista lavori */}
        <h2 className="font-bold text-lg text-[#154212] mb-3">Lavori svolti</h2>

        {loading ? (
          <div className="text-center py-8 text-[#72796e]">Caricamento...</div>
        ) : lavori.length === 0 ? (
          <div className="card text-center py-8 text-[#72796e]">
            <svg className="w-12 h-12 mx-auto mb-3 text-[#c2c9bb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>Nessun lavoro ancora registrato</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lavori.map((l: any, i: number) => (
              <div key={l.id} className="card animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-[#72796e]">{new Date(l.data).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}</p>
                    <p className="font-semibold text-[#154212] mt-1">{l.descrizioni_lavoro?.descrizione}</p>
                    {l.note && <p className="text-sm text-[#72796e] mt-1">{l.note}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
