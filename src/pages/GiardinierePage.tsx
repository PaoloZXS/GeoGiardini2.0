import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import itLocale from "@fullcalendar/core/locales/it";

interface GiardinierePageProps {
  onLogout: () => void;
}

const formatCalendarRange = (start: Date, end: Date) => {
  const startDay = start.getDate();
  const startMonth = start.toLocaleDateString("it-IT", { month: "long" });
  const startYear = start.getFullYear();
  const endDay = end.getDate();
  const endMonth = end.toLocaleDateString("it-IT", { month: "long" });
  const endYear = end.getFullYear();
  if (startYear === endYear) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}\n${startYear}`;
  }
  return `${startDay} ${startMonth} ${startYear}\n– ${endDay} ${endMonth} ${endYear}`;
};

const getLocalToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const isTouchDevice =
  typeof window !== "undefined" &&
  ("ontouchstart" in window || navigator.maxTouchPoints > 0);

export default function GiardinierePage({ onLogout }: GiardinierePageProps) {
  console.log("✅ GiardinierePage MOUNTED");
  const userId = window.localStorage.getItem("userId");
  const calendarRef = useRef<FullCalendar>(null);
  const [eventi, setEventi] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarTitle, setCalendarTitle] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [detailNote, setDetailNote] = useState("");
  const [detailEseguito, setDetailEseguito] = useState(false);
  const [statoOriginale, setStatoOriginale] = useState("");
  const [detailNuoveFoto, setDetailNuoveFoto] = useState<File[]>([]);
  const [detailFotoEsistenti, setDetailFotoEsistenti] = useState<any[]>([]);
  const [detailSaving, setDetailSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadEventi = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    console.log("DEBUG - userId del giardiniere loggato:", userId);
    try {
      const { data } = await supabase
        .from("inserimenti_attivita")
        .select(
          "*, localita(localita), attivita(descrizione, categoria_id, categorie(id, nome))"
        )
        .order("data_inizio", { ascending: false });

      console.log("DEBUG - tutti i record ricevuti:", data?.length);
      if (data) {
        const data16 = data.filter(
          (i: any) => i.data_inizio && i.data_inizio.startsWith("2026-06-16")
        );
        console.log("DEBUG - record 2026-06-16:", data16.length);
        data16.forEach((r: any) => {
          console.log(
            "  → id:",
            r.id,
            "| giardiniere_ids:",
            JSON.stringify(r.giardiniere_ids),
            "| visibile_giardiniere:",
            r.visibile_giardiniere,
            "| aggiungi_al_planning:",
            r.aggiungi_al_planning,
            "| stato:",
            r.stato
          );
        });

        const filtered = data.filter((item: any) => {
          if (item.aggiungi_al_planning !== true) return false;
          const ids = item.giardiniere_ids;
          if (!ids || (Array.isArray(ids) && ids.length === 0)) return true;
          if (Array.isArray(ids) && ids.includes(userId)) return true;
          return false;
        });
        console.log(
          "DEBUG - dopo filtro (aggiungi_al_planning=true + giardiniere_ids):",
          filtered.length
        );
        setEventi(filtered);
      }
    } catch (err) {
      console.error("Errore caricamento eventi", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadingRef = useRef(false);
  const prevDataRef = useRef<string>("");

  useEffect(() => {
    loadEventi();
    const interval = setInterval(async () => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      try {
        const { data } = await supabase
          .from("inserimenti_attivita")
          .select(
            "id, data_inizio, data_fine, stato, eseguito, visibile_giardiniere, giardiniere_ids, aggiungi_al_planning"
          )
          .order("data_inizio", { ascending: false });

        const nuovoJson = JSON.stringify(data);
        if (nuovoJson !== prevDataRef.current) {
          prevDataRef.current = nuovoJson;
          loadEventi();
        }
      } catch {
        // silent
      } finally {
        loadingRef.current = false;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loadEventi]);

  // Ricarica eventi quando l'admin o altri salvano modifiche
  useEffect(() => {
    const ricarica = () => loadEventi();
    window.addEventListener("attivita-aggiornata", ricarica);
    window.addEventListener("inserimento-salvato", ricarica);
    return () => {
      window.removeEventListener("attivita-aggiornata", ricarica);
      window.removeEventListener("inserimento-salvato", ricarica);
    };
  }, [loadEventi]);

  const events = useMemo(() => {
    return eventi.map((item: any) => {
      const start = item.data_inizio || item.data;
      const end = item.data_fine || start;
      const localitaNome = item.localita?.localita || "";
      const attivitaDesc = item.attivita?.descrizione || "";
      const title = [localitaNome, attivitaDesc].filter(Boolean).join(" — ");
      const stato = item.stato || "promemoria";
      let bgColor: string;
      if (item.stato === "eseguito") {
        bgColor = "#10b981";
      } else {
        const colorMap: Record<string, string> = {
          promemoria: "#f59e0b",
          confermato: "#3b82f6"
        };
        bgColor = colorMap[stato] || "#6b7280";
      }
      return {
        id: String(item.id),
        title: title || "Attività",
        start,
        end,
        allDay: true,
        backgroundColor: bgColor,
        borderColor: "transparent",
        textColor: "#ffffff",
        extendedProps: {
          stato,
          note: item.note || "",
          activity: attivitaDesc,
          location: localitaNome,
          categoria: item.attivita?.categorie?.nome || ""
        }
      };
    });
  }, [eventi]);

  const goToPreviousWeek = () => {
    const api = calendarRef.current?.getApi?.();
    api?.prev?.();
  };

  const goToNextWeek = () => {
    const api = calendarRef.current?.getApi?.();
    api?.next?.();
  };

  const goToToday = () => {
    const api = calendarRef.current?.getApi?.();
    api?.today?.();
  };

  const changeViewToOneDay = () => {
    const api = calendarRef.current?.getApi?.();
    api?.changeView?.("dayGridDay");
  };

  const changeViewToThreeDays = () => {
    const api = calendarRef.current?.getApi?.();
    api?.changeView?.("dayGridThreeDays");
  };

  const handleDatesSet = (info: any) => {
    setCalendarTitle(formatCalendarRange(info.start, info.end));
  };

  const handleEventClick = async (info: any) => {
    const eventId = String(info.event.id || "").trim();
    if (!eventId) return;

    try {
      const { data } = await supabase
        .from("inserimenti_attivita")
        .select(
          "*, localita(localita), attivita(descrizione, categoria_id, categorie(id, nome)), clienti!cliente_id(nome)"
        )
        .eq("id", eventId)
        .single();

      if (data) {
        setSelectedEvent(data);
        setDetailNote(data.note || "");
        setDetailEseguito(data.stato === "eseguito");
        setStatoOriginale(data.stato || "promemoria");
        setDetailNuoveFoto([]);
        // Carica foto esistenti
        const { data: foto } = await supabase
          .from("foto_attivita")
          .select("*")
          .eq("attivita_id", eventId);
        setDetailFotoEsistenti(foto || []);
      }
    } catch (err) {
      console.error("Errore caricamento dettaglio evento", err);
    }
  };

  const handleDetailSave = async () => {
    if (!selectedEvent?.id) return;
    setDetailSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("inserimenti_attivita")
        .update({
          note: detailNote.trim() || null,
          stato: detailEseguito ? "eseguito" : "confermato"
        })
        .eq("id", selectedEvent.id);

      if (updateError) {
        console.error("Errore aggiornamento:", updateError);
        alert(
          "Errore salvataggio: " +
            (updateError.message || JSON.stringify(updateError))
        );
        throw updateError;
      }

      // Upload nuove foto
      for (const file of detailNuoveFoto) {
        const ext = file.name.split(".").pop();
        const fileName = `${selectedEvent.id}/${Date.now()}_${file.name}`;
        await supabase.storage
          .from("foto")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });
        const { data: urlData } = supabase.storage
          .from("foto")
          .getPublicUrl(fileName);
        const fotoUrl = urlData?.publicUrl || fileName;
        await supabase
          .from("foto_attivita")
          .insert({ attivita_id: selectedEvent.id, foto_url: fotoUrl });
      }

      // Inserisce notifica per l'admin (solo se non esiste già una notifica non letta)
      const { count: notificaCount } = await supabase
        .from("notifiche_attivita")
        .select("*", { count: "exact", head: true })
        .eq("attivita_id", selectedEvent.id)
        .eq("letta", false);
      if (!notificaCount || notificaCount === 0) {
        await supabase
          .from("notifiche_attivita")
          .insert({ attivita_id: selectedEvent.id });
      }

      setSelectedEvent(null);
      loadEventi();
      // Notifica le altre pagine (admin, planning) per aggiornare i dati
      window.dispatchEvent(new CustomEvent("inserimento-salvato"));

      // Invia messaggio al service worker per notifica push
      if ("Notification" in window) {
        const perm = await Notification.requestPermission();
        if (perm === "granted" && "serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.ready;
          registration.active?.postMessage({
            type: "PUSH_RECEIVED",
            title: "Nuova attività eseguita",
            body: "Un giardiniere ha completato un'attività"
          });
        } else if (perm !== "granted") {
          alert(
            "Abilita le notifiche nelle impostazioni del browser per ricevere aggiornamenti."
          );
        }
      }

      // Broadcast su tutti i tab aperti (admin, giardiniere)
      try {
        const channel = new BroadcastChannel("geogiardini");
        channel.postMessage({ type: "attivita-aggiornata" });
        channel.close();
      } catch {
        // BroadcastChannel non supportato
      }
    } catch (err) {
      console.error("Errore salvataggio", err);
    } finally {
      setDetailSaving(false);
    }
  };

  const uploadDetailFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setDetailNuoveFoto((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeDetailNuovaFoto = (index: number) => {
    setDetailNuoveFoto((prev) => prev.filter((_, i) => i !== index));
  };

  const removeDetailFotoEsistente = async (foto: any) => {
    try {
      const path = foto.foto_url?.split("/foto/").pop();
      if (path)
        await supabase.storage
          .from("foto")
          .remove([path])
          .catch(() => {});
      await supabase.from("foto_attivita").delete().eq("id", foto.id);
      setDetailFotoEsistenti((prev) => prev.filter((f) => f.id !== foto.id));
    } catch (err) {
      console.error("Errore eliminazione foto", err);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#cbe1f0",
          backgroundImage: "url('/images/sfondo1.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      >
        <svg
          className="animate-spin h-10 w-10 text-[#2563eb]"
          viewBox="0 0 24 24"
        >
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
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        height: "100%",
        margin: 0,
        padding: "24px",
        boxSizing: "border-box",
        overflow: "visible",
        backgroundColor: "#cbe1f0",
        backgroundImage: "url('/images/sfondo1.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      <style>{`
        .fc .fc-scrollgrid { border: none !important; width: 100% !important; overflow-x: auto !important; background: transparent !important; }
        .fc { background: transparent !important; }
        .fc-theme-standard .fc-day { background: transparent !important; }
        .fc .fc-daygrid-day-frame { background: transparent !important; }
        .fc .fc-daygrid-body { background: transparent !important; }
        .fc .fc-view { background: transparent !important; }
        .fc .fc-daygrid-day-frame:hover,
        .fc .fc-daygrid-day-frame:focus,
        .fc .fc-daygrid-day-frame:active { background: transparent !important; }
        .fc .fc-daygrid-more-link { background: transparent !important; }
        .fc .fc-daygrid-day-events { background: transparent !important; }
        .fc .fc-daygrid-bg-harness { background: transparent !important; }
        .fc .fc-daygrid-event-harness { background: transparent !important; }
        .fc .fc-daygrid-day-top { background: transparent !important; }
        .fc-theme-standard .fc-scrollgrid-section > td { background: transparent !important; }
        .fc .fc-col-header-cell { background: transparent !important; border: 0 !important; padding: 0 !important; }
        .fc .fc-col-header-cell-cushion {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          min-height: 50px !important;
          padding: 10px 6px !important;
          box-sizing: border-box !important;
          background: #ddebf9 !important;
          border: 1px solid rgba(15, 23, 42, 0.24) !important;
          border-bottom-width: 2px !important;
          box-shadow:
            inset 1px 0 0 rgba(15, 23, 42, 0.22),
            inset -1px 0 0 rgba(15, 23, 42, 0.22),
            inset 0 1px 0 rgba(15, 23, 42, 0.22),
            inset 0 -2px 0 rgba(15, 23, 42, 0.26) !important;
          outline: 1px solid rgba(15, 23, 42, 0.1) !important;
          outline-offset: -1px !important;
        }
        .fc .fc-col-header, .fc .fc-daygrid-body table { table-layout: fixed !important; width: 100% !important; }
        .fc .fc-daygrid-body table { width: 100% !important; background: transparent !important; }
        .fc .fc-daygrid-day-frame { background: transparent !important; }
        .fc .fc-event-main { line-height: 1.2 !important; padding: 4px 6px !important; font-size: 0.8rem !important; }
        .fc .fc-day-today { background: transparent !important; }
        .fc .fc-custom-today .fc-col-header-cell-cushion {
          background: rgba(255, 244, 179, 0.85) !important;
          border-color: rgba(180, 140, 0, 0.45) !important;
        }
        .fc .fc-custom-today .fc-col-header-cell-cushion span:last-child {
          color: #7a5600 !important;
        }
        .planning-next-button {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
        }
        .planning-today-button {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          text-align: center !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        .fc .fc-event { cursor: pointer !important; }
      `}</style>

      {/* Titolo Planning */}
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          margin: "0 auto 12px",
          padding: "8px 4px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px"
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: "2rem",
              lineHeight: 1,
              color: "#1976d2",
              fontStyle: "normal"
            }}
          >
            calendar_month
          </span>
          <h1
            style={{
              margin: 0,
              color: "#1976d2",
              fontSize: "1.8rem",
              fontWeight: 800,
              fontStyle: "italic",
              lineHeight: 1.1
            }}
          >
            Planning Interventi
          </h1>
        </div>
        <p
          style={{
            margin: 0,
            color: "#1976d2",
            fontSize: "0.85rem",
            fontWeight: 600,
            fontStyle: "italic",
            alignSelf: "flex-start",
            paddingLeft: "90px"
          }}
        >
          {localStorage.getItem("loginUsername") || "Giardiniere"} — Operatore
        </p>
      </div>

      {/* Calendario */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "900px",
          minHeight: "420px",
          maxHeight: "520px",
          margin: "40px auto 12px",
          padding: 0,
          border: "1px solid rgba(15, 23, 42, 0.18)",
          overflow: "hidden",
          background: "transparent",
          boxShadow: "0 18px 40px rgba(13, 45, 82, 0.08)"
        }}
      >
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridThreeDays"
          views={{
            dayGridThreeDays: {
              type: "dayGrid",
              duration: { days: 3 },
              buttonText: "3 giorni"
            },
            dayGridDay: {
              type: "dayGrid",
              duration: { days: 1 },
              buttonText: "1 giorno"
            }
          }}
          locale={itLocale}
          firstDay={1}
          initialDate={new Date()}
          dateIncrement={{ days: 1 }}
          headerToolbar={false}
          datesSet={handleDatesSet}
          buttonText={{ today: "Oggi" }}
          titleFormat={{ year: "numeric", month: "long", day: "numeric" }}
          events={events}
          now={getLocalToday()}
          dayHeaderClassNames={(arg) =>
            arg.date.toDateString() === getLocalToday().toDateString()
              ? ["fc-custom-today"]
              : []
          }
          dayHeaderContent={(arg) => {
            const weekday = arg.date
              .toLocaleDateString("it-IT", { weekday: "long" })
              .replace(/^./, (c) => c.toUpperCase());
            return {
              html: `<div style="display:flex;flex-direction:column;align-items:center;font-size:0.85rem;"><span>${weekday}</span><span style="font-weight:700;margin-top:4px;">${arg.date.getDate()}</span></div>`
            };
          }}
          dayMaxEvents={true}
          dayMaxEventRows={true}
          eventOrder="title"
          height={420}
          eventClick={handleEventClick}
          eventContent={(arg) => {
            const fmtDate = (d) =>
              d
                ? d.toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "2-digit"
                  })
                : "";
            const startStr = fmtDate(arg.event.start);
            const endStr = fmtDate(arg.event.end);
            const dateLabel =
              startStr === endStr ? startStr : `${startStr} ${endStr}`;
            const location = arg.event.extendedProps.location || "";
            const categoria = arg.event.extendedProps.categoria || "";
            const activity = arg.event.extendedProps.activity || "";
            const primaRiga = `${dateLabel}${location ? ` - ${location}` : ""}`;
            const secondaRiga = [categoria, activity]
              .filter(Boolean)
              .join(" - ");
            return {
              html:
                `<div style="font-size:0.75rem;line-height:1.2;display:flex;flex-direction:column;justify-content:center;overflow:hidden;">` +
                `<span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${primaRiga}</span>` +
                `<span style="font-size:0.7rem;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${secondaRiga}</span>` +
                `</div>`
            };
          }}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          }}
        />
      </div>

      {/* Titolo data */}
      <div
        style={{
          width: "100%",
          maxWidth: "900px",
          margin: "0 auto 8px",
          textAlign: "center"
        }}
      >
        <h2
          className="fc-toolbar-title"
          style={{
            margin: 0,
            fontWeight: 700,
            fontStyle: "italic",
            color: "#000000",
            whiteSpace: "nowrap",
            lineHeight: 1.2
          }}
        >
          {(calendarTitle || "Caricamento...").replace(/\s*\n\s*/g, " ").trim()}
        </h2>
      </div>

      {/* Barra navigazione */}
      <div
        className="fc-header-toolbar fc-toolbar fc-toolbar-ltr"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          width: "100%",
          maxWidth: "900px",
          margin: "0 auto 12px",
          padding: "12px 20px",
          border: "1px solid rgba(15, 23, 42, 0.18)",
          borderRadius: "24px",
          background: "#ddebf9",
          boxShadow: "0 12px 24px rgba(13, 45, 82, 0.08)"
        }}
      >
        <div
          className="fc-toolbar-chunk"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "nowrap",
            width: "100%",
            position: "relative"
          }}
        >
          <button
            type="button"
            onClick={goToPreviousWeek}
            className="fc-button"
            style={{
              width: "40px",
              height: "40px",
              minWidth: "40px",
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "#164e2a",
              border: "1px solid rgba(15, 23, 42, 0.15)",
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
              cursor: "pointer",
              color: "#ffffff"
            }}
          >
            &lt;
          </button>
          <button
            type="button"
            onClick={goToNextWeek}
            className="fc-button planning-next-button"
            style={{
              width: "40px",
              height: "40px",
              minWidth: "40px",
              borderRadius: "50%",
              marginLeft: "auto",
              background: "#164e2a",
              border: "1px solid rgba(15, 23, 42, 0.15)",
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
              cursor: "pointer",
              color: "#ffffff"
            }}
          >
            &gt;
          </button>
          <div
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <button
              type="button"
              onClick={goToToday}
              className="fc-today-button fc-button fc-button-primary planning-today-button"
              style={{
                marginLeft: 0,
                minWidth: "86px",
                fontWeight: 700,
                textDecoration: "underline",
                borderRadius: "40px",
                background: "#000080",
                color: "#ffffff",
                height: "40px",
                lineHeight: 1
              }}
            >
              Oggi
            </button>
            <button
              type="button"
              onClick={changeViewToOneDay}
              className="fc-button fc-button-primary"
              style={{
                minWidth: "40px",
                height: "40px",
                borderRadius: "50%",
                fontWeight: 700,
                background: "#000080",
                border: "1px solid rgba(15, 23, 42, 0.15)",
                boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
                cursor: "pointer",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1
              }}
            >
              1
            </button>
            <button
              type="button"
              onClick={changeViewToThreeDays}
              className="fc-button fc-button-primary"
              style={{
                minWidth: "40px",
                height: "40px",
                borderRadius: "50%",
                fontWeight: 700,
                background: "#000080",
                border: "1px solid rgba(15, 23, 42, 0.15)",
                boxShadow: "0 4px 10px rgba(0, 0, 0, 0.08)",
                cursor: "pointer",
                color: "#ffffff",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1
              }}
            >
              3
            </button>
          </div>
        </div>
      </div>

      {/* Legenda colori */}
      <div
        style={{
          position: "fixed",
          bottom: "44px",
          left: "36px",
          zIndex: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          columnGap: "12px",
          rowGap: "4px",
          background: "rgba(255,255,255,0.9)",
          backdropFilter: "blur(4px)",
          borderRadius: "12px",
          padding: "6px 8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          fontSize: "10px"
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: "#f59e0b",
              display: "inline-block"
            }}
          />
          Promemoria
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: "#3b82f6",
              display: "inline-block"
            }}
          />
          Confermato
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: "#10b981",
              display: "inline-block"
            }}
          />
          Eseguito
        </span>
      </div>

      {/* Pulsante Logout */}
      <div
        style={{
          position: "fixed",
          right: "34px",
          bottom: "24px",
          zIndex: 30,
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          gap: "16px"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "4px",
            transform: "translateX(-20px)"
          }}
        >
          <button
            type="button"
            aria-label="Logout"
            onClick={onLogout}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 shadow-lg transition hover:bg-red-700"
            style={{
              border: "none",
              boxShadow: "0 16px 28px rgba(0, 0, 0, 0.18)",
              cursor: "pointer"
            }}
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
          <span
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              color: "#000080",
              textTransform: "uppercase",
              letterSpacing: "0.02em"
            }}
          >
            Logout
          </span>
        </div>
      </div>

      {/* Modal dettaglio evento */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 backdrop-blur-sm p-0 overflow-auto">
          <section
            className="w-full h-full max-w-none flex flex-col rounded-none border border-[#c2c9bb] bg-[#f2f4f2] shadow-2xl p-4 overflow-y-auto"
            style={{
              backgroundImage: "url('/images/sfondo1.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat"
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-[#2563eb]">
                  description
                </span>
                <h2 className="text-lg font-bold text-[#2563eb]">
                  Dettaglio Attività
                </h2>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Campi informativi (readonly) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="pl-2 text-sm font-bold text-black block">
                    Data Inizio
                  </label>
                  <input
                    className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-gray-100 text-xs font-bold text-gray-500"
                    value={
                      selectedEvent.data_inizio
                        ? new Date(
                            selectedEvent.data_inizio + "T00:00:00"
                          ).toLocaleDateString("it-IT")
                        : ""
                    }
                    readOnly
                  />
                </div>
                <div>
                  <label className="pl-2 text-sm font-bold text-black block">
                    Data Fine
                  </label>
                  <input
                    className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-gray-100 text-xs font-bold text-gray-500"
                    value={
                      selectedEvent.data_fine
                        ? new Date(
                            selectedEvent.data_fine + "T00:00:00"
                          ).toLocaleDateString("it-IT")
                        : ""
                    }
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="pl-2 text-sm font-bold text-black block">
                  Località
                </label>
                <input
                  className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-gray-100 text-xs font-bold text-gray-500"
                  value={selectedEvent.localita?.localita || ""}
                  readOnly
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="pl-2 text-sm font-bold text-black block">
                    Soggetto
                  </label>
                  <input
                    className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-gray-100 text-xs font-bold text-gray-500"
                    value={selectedEvent.attivita?.categorie?.nome || ""}
                    readOnly
                  />
                </div>
                <div>
                  <label className="pl-2 text-sm font-bold text-black block">
                    Azione
                  </label>
                  <input
                    className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-gray-100 text-xs font-bold text-gray-500"
                    value={selectedEvent.attivita?.descrizione || ""}
                    readOnly
                  />
                </div>
              </div>

              <div>
                <label className="pl-2 text-sm font-bold text-black block">
                  Contatto
                </label>
                <input
                  className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-gray-100 text-xs font-bold text-gray-500"
                  value={selectedEvent.clienti?.nome || ""}
                  readOnly
                />
              </div>

              {/* Note (editabile) */}
              <div>
                <label className="pl-2 text-sm font-bold text-black block">
                  Note
                </label>
                <textarea
                  className="w-full min-h-[80px] px-4 py-2 rounded-lg border border-[#c2c9bb] bg-white focus:ring-2 focus:ring-[#154212] outline-none text-xs text-black font-bold resize-none placeholder:text-[#9ca3af]"
                  value={detailNote}
                  onChange={(e) => setDetailNote(e.target.value)}
                  placeholder="Aggiungi note..."
                />
              </div>

              {/* Radio Eseguito (editabile) */}
              <div
                className="flex justify-end"
                style={{ position: "relative", left: "-20px" }}
              >
                <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-[#2563eb] border-2 border-[#2563eb]"
                    checked={detailEseguito}
                    onChange={() => setDetailEseguito(!detailEseguito)}
                  />
                  <span className="font-bold text-lg">Attività Eseguita</span>
                </label>
              </div>

              {/* Sezione foto */}
              <div>
                <label className="pl-2 text-sm font-bold text-black block mb-2">
                  Foto attività
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      const total =
                        detailNuoveFoto.length + e.target.files.length;
                      if (total > 6) {
                        alert("Massimo 6 foto.");
                        return;
                      }
                      setDetailNuoveFoto((prev) => [
                        ...prev,
                        ...Array.from(e.target.files!)
                      ]);
                    }
                  }}
                />
                <div className="flex gap-3 p-2 bg-transparent border border-white shrink-0 overflow-x-auto">
                  {/* Foto esistenti */}
                  {detailFotoEsistenti.map((foto, idx) => (
                    <div
                      key={`existing-${foto.id}`}
                      className="relative group shrink-0 border border-[#e5e7eb] overflow-hidden"
                      style={{ width: "60px", height: "60px" }}
                    >
                      <img
                        src={foto.foto_url}
                        alt="Foto"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          console.log("Foto URL errato:", img.src);
                          img.style.display = "none";
                        }}
                      />
                      <button
                        type="button"
                        className="absolute top-0 right-0 bg-red-600 text-white w-4 h-4 flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDetailFotoEsistente(foto);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {/* Nuove foto (anteprima) */}
                  {detailNuoveFoto.map((file, idx) => (
                    <div
                      key={`new-${idx}`}
                      className="relative group shrink-0 border border-[#e5e7eb] overflow-hidden"
                      style={{ width: "60px", height: "60px" }}
                    >
                      <img
                        src={URL.createObjectURL(file)}
                        alt="Nuova foto"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        className="absolute top-0 right-0 bg-red-600 text-white w-4 h-4 flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeDetailNuovaFoto(idx);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {/* Pulsante aggiungi (se meno di 6 foto) */}
                  {detailFotoEsistenti.length + detailNuoveFoto.length < 6 && (
                    <div
                      className="relative shrink-0 border border-[#e5e7eb] flex items-center justify-center cursor-pointer bg-[#f9fafb] hover:bg-[#eceeec] transition"
                      style={{ width: "60px", height: "60px" }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="material-symbols-outlined text-2xl text-[#9ca3af]">
                        add
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Pulsanti azione */}
              <div
                className="flex items-center justify-end gap-8 pt-2 pb-4"
                style={{ marginRight: "20px" }}
              >
                <div className="flex flex-col items-center">
                  <button
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition ${detailSaving ? "bg-[#154212]/70 cursor-not-allowed" : "bg-[#154212] hover:bg-[#154212]/90"}`}
                    type="button"
                    onClick={handleDetailSave}
                    disabled={detailSaving}
                  >
                    {detailSaving ? (
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        viewBox="0 0 24 24"
                      >
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
                    ) : (
                      <span className="material-symbols-outlined text-xl">
                        save
                      </span>
                    )}
                  </button>
                  <span className="mt-1 text-[0.65rem] font-semibold text-white">
                    Salva
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setSelectedEvent(null)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                    title="Chiudi"
                  >
                    <span className="material-symbols-outlined text-xl">
                      close
                    </span>
                  </button>
                  <span className="mt-1 text-[0.65rem] font-semibold text-white">
                    Chiudi
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
