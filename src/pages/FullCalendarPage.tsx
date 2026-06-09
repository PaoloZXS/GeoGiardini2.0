import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

interface FullCalendarPageProps {
  onBack: () => void;
}

export default function FullCalendarPage({ onBack }: FullCalendarPageProps) {
  const calendarRef = useRef<HTMLDivElement>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [appointmentNote, setAppointmentNote] = useState("");
  const [clienti, setClienti] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  useEffect(() => {
    // Carica clienti
    supabase.from("clienti").select("id, nome_cliente").order("nome_cliente").then(({ data }) => {
      if (data) setClienti(data);
    });

    // Carica appuntamenti
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    const { data } = await supabase
      .from("appuntamenti")
      .select("*, clienti(nome_cliente)")
      .order("data_ora");

    if (data) {
      setAppointments(data);
      setEvents(
        data.map((a: any) => ({
          id: a.id,
          title: `${a.clienti?.nome_cliente}${a.note ? ` - ${a.note}` : ""}`,
          start: a.data_ora,
          allDay: false,
        }))
      );
    }
  };

  const handleAddAppointment = async () => {
    if (!selectedClient || !selectedDate || !selectedTime) return;

    const dataOra = `${selectedDate}T${selectedTime}:00`;

    const { error } = await supabase.from("appuntamenti").insert({
      id_cliente: selectedClient,
      data_ora: dataOra,
      note: appointmentNote,
    });

    if (!error) {
      setShowModal(false);
      setSelectedClient("");
      setSelectedTime("09:00");
      setAppointmentNote("");
      loadAppointments();
    }
  };

  const handleDeleteAppointment = async (id: number) => {
    if (confirm("Eliminare questo appuntamento?")) {
      await supabase.from("appuntamenti").delete().eq("id", id);
      loadAppointments();
    }
  };

  // Raggruppa appuntamenti per data
  const groupedByDate: Record<string, any[]> = {};
  appointments.forEach((a) => {
    const dateKey = new Date(a.data_ora).toLocaleDateString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(a);
  });

  return (
    <div className="min-h-screen bg-[#f8faf8]">
      {/* Header */}
      <header className="bg-[#154212] text-white px-5 py-4 flex items-center justify-between sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-white/80 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="font-bold text-lg">Planning Appuntamenti</h1>
            <p className="text-[#9dd090] text-xs">Calendario appuntamenti</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors"
        >
          + Nuovo
        </button>
      </header>

      <div className="max-w-lg mx-auto px-5 pt-6 pb-10">
        {/* Calendario della data odierna */}
        <div className="card mb-6">
          <h2 className="font-bold text-[#154212] mb-3">
            {new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </h2>
          <div className="grid grid-cols-7 gap-1 text-center text-sm mb-2">
            {["Lu", "Ma", "Me", "Gi", "Ve", "Sa", "Do"].map((d) => (
              <div key={d} className="text-[#72796e] text-xs font-semibold py-1">{d}</div>
            ))}
            {(() => {
              const now = new Date();
              const year = now.getFullYear();
              const month = now.getMonth();
              const firstDay = new Date(year, month, 1).getDay();
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              const today = now.getDate();
              const cells = [];
              for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
                cells.push(<div key={`empty-${i}`} />);
              }
              for (let d = 1; d <= daysInMonth; d++) {
                const isToday = d === today;
                cells.push(
                  <div
                    key={d}
                    className={`py-1.5 rounded-lg text-sm ${
                      isToday
                        ? "bg-[#154212] text-white font-bold"
                        : "text-[#191c1b] hover:bg-[#eceeec]"
                    }`}
                  >
                    {d}
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </div>

        {/* Lista appuntamenti */}
        <h2 className="font-bold text-lg text-[#154212] mb-3">Appuntamenti</h2>

        {appointments.length === 0 ? (
          <div className="card text-center py-8 text-[#72796e]">
            <svg className="w-12 h-12 mx-auto mb-3 text-[#c2c9bb]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p>Nessun appuntamento pianificato</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByDate).map(([dateKey, apps]) => (
              <div key={dateKey}>
                <p className="text-xs font-semibold text-[#72796e] uppercase tracking-wider mb-2 mt-4 first:mt-0">
                  {dateKey}
                </p>
                {apps.map((a: any) => (
                  <div key={a.id} className="card flex items-center gap-3 mb-2 animate-fade-in">
                    <div className="w-12 h-12 rounded-xl bg-[#ccebc7] flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-[#154212]">
                        {new Date(a.data_ora).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[#154212]">{a.clienti?.nome_cliente}</p>
                      {a.note && <p className="text-xs text-[#72796e] truncate">{a.note}</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteAppointment(a.id)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nuovo appuntamento */}
      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-content max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[#154212]">Nuovo Appuntamento</h2>
              <button onClick={() => setShowModal(false)} className="text-[#72796e] hover:text-[#154212] p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#42493e] mb-1.5">Cliente</label>
                <select className="select-field" value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}>
                  <option value="">Seleziona cliente</option>
                  {clienti.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome_cliente}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#42493e] mb-1.5">Data</label>
                <input type="date" className="input-field" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#42493e] mb-1.5">Ora</label>
                <input type="time" className="input-field" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#42493e] mb-1.5">Note (opzionale)</label>
                <textarea className="input-field min-h-[80px] pt-3" value={appointmentNote} onChange={(e) => setAppointmentNote(e.target.value)} placeholder="Note sull'appuntamento..." />
              </div>
              <button onClick={handleAddAppointment} className="btn-primary w-full">Salva Appuntamento</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
