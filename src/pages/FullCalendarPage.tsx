import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type TouchEvent,
  type MouseEvent
} from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import FullCalendar from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import itLocale from "@fullcalendar/core/locales/it";
import InserisciAttivitaModal from "../components/InserisciAttivitaModal";

const COLOR_PALETTE = [
  "#0b79d0",
  "#27ae60",
  "#f39c12",
  "#8e44ad",
  "#c0392b",
  "#16a085",
  "#d35400",
  "#2c3e50"
];

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDate = (value: unknown): Date | null => {
  if (!value && value !== 0) {
    return null;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value;
  }
  const raw = value.toString().trim();
  if (!raw) {
    return null;
  }
  if (raw.includes("T")) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed;
  }
  const [year, month, day] = raw.split("-").map((segment) => Number(segment));
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return new Date(year, month - 1, day);
};

const normalizeTime = (time: string | undefined, fallback = "08:00") => {
  const trimmed = time?.toString().trim() || fallback;
  if (/^\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}:00`;
};

const buildIsoDateTime = (
  dateValue: unknown,
  timeValue?: string,
  fallbackTime = "08:00"
): string | null => {
  const date = parseDate(dateValue);
  if (!date) {
    return null;
  }
  const time = normalizeTime(timeValue, fallbackTime);
  return `${formatLocalDate(date)}T${time}`;
};

const getColorFromKey = (key: string, index: number) => {
  if (!key) {
    return COLOR_PALETTE[index % COLOR_PALETTE.length];
  }
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length];
};

const buildResourceId = (item: any, index: number) => {
  const rawId =
    item?.id?.toString?.()?.trim?.() ||
    item?.giardiniere_id?.toString?.()?.trim?.() ||
    item?.id_giardiniere?.toString?.()?.trim?.() ||
    `giardiniere-${index}`;
  return rawId;
};

const parseHexColor = (color: string) => {
  const raw = color.trim();
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (!/^[0-9a-fA-F]{3,6}$/.test(hex)) {
    return null;
  }
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
};

const getContrastColor = (color: string) => {
  const rgb = parseHexColor(color);
  if (!rgb) {
    return "#000000";
  }
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
};

const buildResourceTitle = (item: any, index: number) => {
  return (
    item?.username?.toString?.()?.trim?.() ||
    item?.nome?.toString?.()?.trim?.() ||
    item?.name?.toString?.()?.trim?.() ||
    `Giardiniere ${index + 1}`
  );
};

const extractAppointmentResources = (appointment: any) => {
  // Usa la proprietà giardinieri già mappata, o fallback alla struttura raw
  const rawGiardinieri = Array.isArray(appointment.giardinieri)
    ? appointment.giardinieri
    : Array.isArray(appointment.appuntamenti_giardinieri)
      ? appointment.appuntamenti_giardinieri
          .map((rel: any) => rel.giardinieri)
          .filter(Boolean)
      : [];

  return rawGiardinieri
    .map((item: any, index: number) => {
      const id =
        item?.id?.toString?.()?.trim?.() ||
        item?.giardiniere_id?.toString?.()?.trim?.() ||
        item?.id_giardiniere?.toString?.()?.trim?.() ||
        item?.giardiniereId?.toString?.()?.trim?.() ||
        "";
      const title =
        typeof item === "string"
          ? item.trim()
          : item?.username?.toString?.()?.trim?.() ||
            item?.nome?.toString?.()?.trim?.() ||
            item?.name?.toString?.()?.trim?.() ||
            item?.giardiniere_username?.toString?.()?.trim?.() ||
            item?.nome_giardiniere?.toString?.()?.trim?.() ||
            "";
      const colore = item?.colore?.toString?.()?.trim?.() || "";
      return id ? { resourceId: id, title, colore } : null;
    })
    .filter(Boolean) as Array<{
    resourceId: string;
    title: string;
    colore: string;
  }>;
};

const buildEventTitle = (appointment: any) => {
  const activity = Array.isArray(appointment.attivita)
    ? appointment.attivita.join(", ")
    : appointment.attivita || appointment.title || "Appuntamento";
  const client =
    appointment.clienteNome || appointment.cliente || appointment.clienteId;
  return client ? `${activity} • ${client}` : activity;
};

const formatDayHeader = (date: Date) => {
  const day = date.getDate();
  const weekday = date
    .toLocaleDateString("it-IT", { weekday: "short" })
    .replace("sab", "Sab")
    .replace("dom", "Dom")
    .replace("lun", "Lun")
    .replace("mar", "Mar")
    .replace("mer", "Mer")
    .replace("gio", "Gio")
    .replace("ven", "Ven");
  return `${day} ${weekday}`;
};

const getWeekMonday = (date: Date) => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

const getLocalToday = () => {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
};

function TimePicker({
  value,
  onChange,
  label
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [hour, minute] = (value || "08:00").split(":");

  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside as EventListener);
    return () =>
      document.removeEventListener(
        "mousedown",
        handleClickOutside as EventListener
      );
  }, []);

  const hours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0")
  );
  const minutes = Array.from({ length: 12 }, (_, i) =>
    String(i * 5).padStart(2, "0")
  );

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          height: "32px",
          background: "#ffffff",
          border: "1px solid rgba(15, 23, 42, 0.24)",
          borderRadius: "8px",
          padding: "0 12px",
          fontFamily: "inherit",
          fontSize: "0.875rem",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          color: "#1e293b",
          outline: "none"
        }}
      >
        <span style={{ fontWeight: 600 }}>{hour}</span>
        <span style={{ color: "#94a3b8" }}>:</span>
        <span style={{ fontWeight: 600 }}>{minute}</span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            background: "#ffffff",
            border: "1px solid rgba(15, 23, 42, 0.15)",
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 99999,
            display: "flex",
            gap: "4px",
            padding: "8px",
            maxHeight: "200px"
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "2px"
            }}
          >
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  onChange(`${h}:${minute}`);
                  setOpen(false);
                }}
                style={{
                  padding: "6px 0",
                  border: "none",
                  borderRadius: "6px",
                  background: h === hour ? "#000080" : "transparent",
                  color: h === hour ? "#ffffff" : "#1e293b",
                  fontWeight: h === hour ? 700 : 400,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textAlign: "center"
                }}
              >
                {h}
              </button>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "2px"
            }}
          >
            {minutes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  onChange(`${hour}:${m}`);
                  setOpen(false);
                }}
                style={{
                  padding: "6px 0",
                  border: "none",
                  borderRadius: "6px",
                  background: m === minute ? "#000080" : "transparent",
                  color: m === minute ? "#ffffff" : "#1e293b",
                  fontWeight: m === minute ? 700 : 400,
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  textAlign: "center"
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const formatCalendarRange = (start: Date, end: Date) => {
  const actualEnd = new Date(end);
  actualEnd.setDate(actualEnd.getDate() - 1);

  const startDay = start.getDate();
  const endDay = actualEnd.getDate();
  const startMonth = start.toLocaleDateString("it-IT", {
    month: "long"
  });
  const endMonth = actualEnd.toLocaleDateString("it-IT", {
    month: "long"
  });
  const startYear = start.getFullYear();
  const endYear = actualEnd.getFullYear();

  if (startYear === endYear && startMonth === endMonth) {
    return `${startDay} – ${endDay} ${startMonth}\n${startYear}`;
  }

  if (startYear === endYear) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}\n${startYear}`;
  }

  return `${startDay} ${startMonth} ${startYear}\n– ${endDay} ${endMonth} ${endYear}`;
};

function FullCalendarPage() {
  const [giardinieri, setGiardinieri] = useState<any[]>([]);
  const [appuntamenti, setAppuntamenti] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handledAppointmentIds, setHandledAppointmentIds] = useState<
    Set<string>
  >(new Set());
  const [dragWarning, setDragWarning] = useState<string | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<
    string | null
  >(null);
  const [appuntamentoData, setAppuntamentoData] = useState("");
  const [appuntamentoEndDate, setAppuntamentoEndDate] = useState("");
  const [appuntamentoStartTime, setAppuntamentoStartTime] = useState("08:00");
  const [appuntamentoEndTime, setAppuntamentoEndTime] = useState("09:00");
  const [appuntamentoClienteId, setAppuntamentoClienteId] =
    useState<string>("");
  const [appuntamentoGiardinieriIds, setAppuntamentoGiardinieriIds] = useState<
    string[]
  >([]);
  const [appuntamentoAttivita, setAppuntamentoAttivita] = useState<string[]>(
    []
  );
  const [appuntamentoNote, setAppuntamentoNote] = useState("");
  const [isSavingAppuntamento, setIsSavingAppuntamento] = useState(false);
  const [saveAppuntamentoError, setSaveAppuntamentoError] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isNewAppointmentModal, setIsNewAppointmentModal] = useState(false);
  const [clientiList, setClientiList] = useState<
    Array<{ id: string; nome: string; ruolo: string }>
  >([]);
  const [attivitaList, setAttivitaList] = useState<
    Array<{ id: string; descrizione: string; categoria_id: string }>
  >([]);
  const [localitaList, setLocalitaList] = useState<any[]>([]);
  const [categorieList, setCategorieList] = useState<any[]>([]);
  const [inserimentiAttivita, setInserimentiAttivita] = useState<any[]>([]);
  const [attivitaModalEditData, setAttivitaModalEditData] = useState<any>(null);
  const [linkedAppuntamentoId, setLinkedAppuntamentoId] = useState<
    string | null
  >(null);
  const navigate = useNavigate();
  const calendarRef = useRef<any>(null);
  const pointerStartX = useRef<number | null>(null);
  const pointerStartY = useRef<number | null>(null);
  const pointerActive = useRef(false);
  const SWIPE_THRESHOLD = 60;

  const [calendarTitle, setCalendarTitle] = useState<string>("");
  const isTouchDevice = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0
    );
  }, []);

  const goToPreviousWeek = () => {
    const calendarApi = calendarRef.current?.getApi?.();
    if (calendarApi?.prev) {
      calendarApi.prev();
    }
  };

  const goToNextWeek = () => {
    const calendarApi = calendarRef.current?.getApi?.();
    if (calendarApi?.next) {
      calendarApi.next();
    }
  };

  const goToToday = () => {
    const calendarApi = calendarRef.current?.getApi?.();
    if (calendarApi?.today) {
      calendarApi.today();
    }
  };

  const changeViewToOneDay = () => {
    const calendarApi = calendarRef.current?.getApi?.();
    if (calendarApi?.changeView) {
      calendarApi.changeView("dayGridDay");
    }
  };

  const changeViewToThreeDays = () => {
    const calendarApi = calendarRef.current?.getApi?.();
    if (calendarApi?.changeView) {
      calendarApi.changeView("dayGridThreeDays");
    }
  };

  const handleDatesSet = (info: any) => {
    setCalendarTitle(formatCalendarRange(info.start, info.end));
  };

  type InteractionEvent =
    | PointerEvent<HTMLDivElement>
    | TouchEvent<HTMLDivElement>
    | MouseEvent<HTMLDivElement>;

  const isFullCalendarEventTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    return Boolean(target.closest(".fc-event"));
  };

  const getClientPoint = (event: InteractionEvent) => {
    if ("clientX" in event && "clientY" in event) {
      return { clientX: event.clientX, clientY: event.clientY };
    }
    const touch = event.touches[0] || event.changedTouches[0];
    return {
      clientX: touch?.clientX ?? 0,
      clientY: touch?.clientY ?? 0
    };
  };

  const handlePointerDown = (event: InteractionEvent) => {
    if (isFullCalendarEventTarget(event.target)) {
      return;
    }
    const { clientX, clientY } = getClientPoint(event);
    pointerStartX.current = clientX;
    pointerStartY.current = clientY;
    pointerActive.current = true;
  };

  const handlePointerMove = (event: InteractionEvent) => {
    if (
      !pointerActive.current ||
      pointerStartX.current === null ||
      pointerStartY.current === null
    ) {
      return;
    }

    const { clientX, clientY } = getClientPoint(event);
    const dx = clientX - pointerStartX.current;
    const dy = clientY - pointerStartY.current;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) {
      return;
    }

    event.preventDefault?.();
  };

  const handlePointerUp = (event: InteractionEvent) => {
    if (
      pointerStartX.current === null ||
      pointerStartY.current === null ||
      !pointerActive.current
    ) {
      pointerActive.current = false;
      pointerStartX.current = null;
      pointerStartY.current = null;
      return;
    }

    const { clientX, clientY } = getClientPoint(event);
    const dx = clientX - pointerStartX.current;
    const dy = clientY - pointerStartY.current;

    pointerActive.current = false;
    pointerStartX.current = null;
    pointerStartY.current = null;

    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) {
      return;
    }

    if (dx > 0) {
      goToPreviousWeek();
    } else {
      goToNextWeek();
    }
  };

  const handlePointerCancel = () => {
    pointerActive.current = false;
    pointerStartX.current = null;
    pointerStartY.current = null;
  };

  const fetchHandledAppointmentIds = async () => {
    try {
      const notificheData = await supabase
        .from("notifiche")
        .select("appuntamento_id")
        .eq("read", 1);

      const handledIds = new Set<string>();

      if (!notificheData.error && notificheData.data) {
        notificheData.data.forEach((item: any) => {
          const appointmentId = item.appuntamento_id?.toString?.().trim() || "";
          if (appointmentId) {
            handledIds.add(appointmentId);
          }
        });
      }

      setHandledAppointmentIds(handledIds);
    } catch (error) {
      console.error("Errore caricando gli appuntamenti gestiti", error);
      setHandledAppointmentIds(new Set());
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    setDragWarning(null);
    try {
      const [
        giardinieriData,
        appuntamentiData,
        clientiData,
        attivitaData,
        localitaData,
        categorieData,
        inserimentiData
      ] = await Promise.all([
        supabase
          .from("giardinieri")
          .select("*")
          .order("username", { ascending: true }),
        supabase
          .from("appuntamenti")
          .select(
            "*, clienti(*), appuntamenti_giardinieri(*, giardinieri(*)), appuntamenti_attivita(*, attivita(*))"
          )
          .order("data", { ascending: true }),
        supabase
          .from("clienti")
          .select("id, nome, privato, created_by, ruolo")
          .order("nome", { ascending: true }),
        supabase
          .from("attivita")
          .select("*, categorie(nome)")
          .order("descrizione", { ascending: true }),
        supabase
          .from("localita")
          .select("id, localita, privata, created_by")
          .order("localita", { ascending: true }),
        supabase
          .from("categorie")
          .select("*")
          .order("nome", { ascending: true }),
        supabase
          .from("inserimenti_attivita")
          .select("*, attivita(*, categorie(*)), localita(*)")
          .eq("aggiungi_al_planning", true)
          .order("data_inizio", { ascending: false })
      ]);

      if (giardinieriData.error) throw new Error(giardinieriData.error.message);
      if (appuntamentiData.error)
        throw new Error(appuntamentiData.error.message);

      // Confronto globale: se tutti i dati sono identici, salta l'aggiornamento
      const tuttoJson = JSON.stringify([
        giardinieriData.data,
        appuntamentiData.data,
        clientiData.data,
        attivitaData.data,
        localitaData.data,
        categorieData.data,
        inserimentiData.data
      ]);
      if (tuttoJson === prevFullDataRef.current) {
        setIsLoading(false);
        return;
      }
      prevFullDataRef.current = tuttoJson;

      setGiardinieri(giardinieriData.data || []);
      const nuoviApp = (appuntamentiData.data || []).map((item: any) => ({
        ...item,
        giardinieri: Array.isArray(item.appuntamenti_giardinieri)
          ? item.appuntamenti_giardinieri
              .map((rel: any) => rel.giardinieri)
              .filter(Boolean)
          : Array.isArray(item.giardinieri)
            ? item.giardinieri
            : []
      }));
      setAppuntamenti(nuoviApp);
      await fetchHandledAppointmentIds();

      const currentUserCli =
        typeof window !== "undefined"
          ? window.localStorage.getItem("loginUsername") || ""
          : "";
      setClientiList(
        (clientiData.data || [])
          .filter(
            (c: any) => !(c.privato === true && c.created_by !== currentUserCli)
          )
          .map((c: any) => ({
            id: c.id?.toString() ?? "",
            nome: c.nome?.toString() ?? "",
            ruolo: c.ruolo ?? "contatto"
          }))
          .filter((c: any) => c.id && c.nome)
      );

      setAttivitaList(
        (attivitaData.data || [])
          .map((a: any) => ({
            id: a.id?.toString() ?? "",
            descrizione: a.descrizione?.toString() ?? "",
            categoria_id: a.categoria_id?.toString() ?? ""
          }))
          .filter((a: any) => a.descrizione)
      );
      const currentUser =
        typeof window !== "undefined"
          ? window.localStorage.getItem("loginUsername") || ""
          : "";
      setLocalitaList(
        (localitaData.data || []).filter((item: any) => {
          const itemPrivata =
            item.privata === 1 ||
            item.privata === "1" ||
            item.privata === true ||
            item.privata === "true";
          if (itemPrivata && item.created_by !== currentUser) return false;
          return true;
        })
      );
      setCategorieList(categorieData.data || []);
      setInserimentiAttivita(inserimentiData.data || []);
      console.log(
        "inserimentiAttivita caricati:",
        inserimentiData.data?.length,
        "record"
      );
      if (inserimentiData.data) {
        const filt = inserimentiData.data.filter(
          (i: any) => i.data_inizio === "2026-06-16" && i.stato === "promemoria"
        );
        if (filt.length > 0) {
          console.log("Record 2026-06-16 trovato:", filt[0]);
        } else {
          console.log(
            "NESSUN record con data_inizio=2026-06-16 e stato=promemoria"
          );
        }
      }
    } catch (err) {
      console.error("Errore caricamento dati calendario", err);
      setError(
        err instanceof Error
          ? err.message
          : "Errore caricando i dati del calendario."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const loadingRef = useRef(false);
  const prevFullDataRef = useRef<string>("");

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      if (!loadingRef.current) {
        loadingRef.current = true;
        loadData().finally(() => {
          loadingRef.current = false;
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!dragWarning) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setDragWarning(null);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dragWarning]);

  const getAppointmentIdFromEvent = (eventId: string) => {
    // Remove the __resourceId suffix to get the original appointment id
    const separatorIndex = eventId.lastIndexOf("__");
    return separatorIndex >= 0 ? eventId.slice(0, separatorIndex) : eventId;
  };

  const getAppointmentSpanDays = (appointment: any) => {
    const start = parseDate(
      appointment.start_date ?? appointment.startDate ?? appointment.data
    );
    const end = parseDate(
      appointment.end_date ?? appointment.endDate ?? appointment.data
    );
    if (!start || !end) {
      return 1;
    }
    const msPerDay = 1000 * 60 * 60 * 24;
    const startUtc = Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate()
    );
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.max(1, Math.round(Math.abs(endUtc - startUtc) / msPerDay) + 1);
  };

  const updateAppuntamentoFromDrag = async (
    appointment: any,
    newStart: Date
  ) => {
    const spanDays = getAppointmentSpanDays(appointment);
    const startDate = new Date(newStart);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + spanDays - 1);

    const appointmentId = appointment.id?.toString?.()?.trim?.();
    if (!appointmentId) {
      return false;
    }

    const requestBody: any = {
      appointmentId,
      data: formatLocalDate(startDate),
      endDate: formatLocalDate(endDate),
      startTime: appointment.startTime?.toString?.()?.trim?.() || "08:00",
      endTime: appointment.endTime?.toString?.()?.trim?.() || "09:00",
      attivita: Array.isArray(appointment.attivita)
        ? appointment.attivita.filter(Boolean)
        : appointment.attivita
          ? [appointment.attivita]
          : []
    };

    try {
      const { error } = await supabase
        .from("appuntamenti")
        .update({
          data: requestBody.data,
          end_date: requestBody.endDate,
          start_time: requestBody.startTime,
          end_time: requestBody.endTime
        })
        .eq("id", requestBody.appointmentId);

      if (error) {
        console.error("Errore drag appointment", error);
        return null;
      }
      return { data: requestBody.data, endDate: requestBody.endDate };
    } catch (error) {
      console.error("Errore drag appointment", error);
      return null;
    }
  };

  const handleEventDrop = async (info: any) => {
    setDragWarning(null);
    const rawId = String(info.event.id || "").trim();

    // --- Eventi da inserimenti_attivita (id con prefisso "ins_") ---
    if (rawId.startsWith("ins_")) {
      const insId = rawId.replace("ins_", "");
      const item = inserimentiAttivita.find(
        (i: any) => i.id?.toString?.()?.trim?.() === insId
      );
      if (!item || !info.event.start) {
        info.revert();
        return;
      }
      const spanDays = getAppointmentSpanDays({
        data: item.data_inizio,
        end_date: item.data_fine || item.data_inizio
      });
      const startDate = new Date(info.event.start);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + spanDays - 1);

      const { error } = await supabase
        .from("inserimenti_attivita")
        .update({
          data_inizio: formatLocalDate(startDate),
          data_fine: formatLocalDate(endDate)
        })
        .eq("id", insId);
      if (error) {
        console.error("Errore drag attività", error);
        setDragWarning("Impossibile aggiornare l'attività. Riprovare.");
        info.revert();
        return;
      }
      // Aggiorna SOLO lo stato locale dell'evento spostato (niente reload completo)
      setInserimentiAttivita((prev) =>
        prev.map((it: any) =>
          it.id?.toString?.()?.trim?.() === insId
            ? {
                ...it,
                data_inizio: formatLocalDate(startDate),
                data_fine: formatLocalDate(endDate)
              }
            : it
        )
      );
      return;
    }

    // --- Eventi da appuntamenti ---
    const appointmentId = getAppointmentIdFromEvent(rawId);
    if (!appointmentId) {
      info.revert();
      return;
    }

    if (handledAppointmentIds.has(appointmentId)) {
      setDragWarning("Non è possibile spostare un appuntamento già gestito.");
      info.revert();
      return;
    }

    const appointment = appuntamenti.find(
      (item) => item.id?.toString?.()?.trim?.() === appointmentId
    );
    if (!appointment || !info.event.start) {
      info.revert();
      return;
    }

    const result = await updateAppuntamentoFromDrag(
      appointment,
      info.event.start
    );

    if (!result) {
      setDragWarning(
        "Impossibile aggiornare l'appuntamento. Riprovare più tardi."
      );
      info.revert();
      return;
    }

    // Aggiorna SOLO lo stato locale dell'evento spostato (niente reload completo)
    setAppuntamenti((prev) =>
      prev.map((a: any) =>
        a.id?.toString?.()?.trim?.() === appointmentId
          ? { ...a, data: result.data, end_date: result.endDate }
          : a
      )
    );
    return;
  };

  const resourceColorById = useMemo(
    () =>
      new Map(
        giardinieri.map((item, index) => {
          const id = buildResourceId(item, index);
          return [id, getColorFromKey(id, index)] as const;
        })
      ),
    [giardinieri]
  );

  const activeGiardinieriList = useMemo(
    () =>
      giardinieri.map((item, index) => ({
        id: buildResourceId(item, index),
        username: buildResourceTitle(item, index)
      })),
    [giardinieri]
  );

  const activeClientiList = useMemo(() => {
    const map = new Map<string, { id: string; nome: string }>();
    appuntamenti.forEach((appointment) => {
      const clienteId =
        appointment.clienteId?.toString?.()?.trim?.() ||
        appointment.cliente?.toString?.()?.trim?.() ||
        appointment.clienteNome?.toString?.()?.trim?.() ||
        "";
      const nome =
        appointment.clienteNome?.toString?.()?.trim?.() ||
        appointment.cliente?.toString?.()?.trim?.() ||
        clienteId;
      if (clienteId && nome) {
        map.set(clienteId, { id: clienteId, nome });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.nome.localeCompare(b.nome, "it", { sensitivity: "base" })
    );
  }, [appuntamenti]);

  const activityOptions = useMemo(() => {
    const uniqueActivities = new Set<string>();
    appuntamenti.forEach((appointment) => {
      if (Array.isArray(appointment.attivita)) {
        appointment.attivita.forEach((activity: any) => {
          const value = activity?.toString?.()?.trim?.();
          if (value) uniqueActivities.add(value);
        });
      } else {
        const value = appointment.attivita?.toString?.()?.trim?.();
        if (value) uniqueActivities.add(value);
      }
    });
    return Array.from(uniqueActivities).sort((a, b) =>
      a.localeCompare(b, "it", { sensitivity: "base" })
    );
  }, [appuntamenti]);

  const selectedAppointment = useMemo(
    () =>
      selectedAppointmentId
        ? appuntamenti.find(
            (appointment) =>
              appointment.id?.toString?.()?.trim?.() ===
              selectedAppointmentId?.toString?.()?.trim?.()
          ) || null
        : null,
    [appuntamenti, selectedAppointmentId]
  );

  const isSelectedAppointmentHandled = false;

  useEffect(() => {
    if (!selectedAppointment) {
      return;
    }

    const a = selectedAppointment;

    setAppuntamentoData(a.start_date ?? a.startDate ?? a.data ?? "");
    setAppuntamentoEndDate(
      a.end_date ?? a.endDate ?? a.start_date ?? a.startDate ?? a.data ?? ""
    );
    setAppuntamentoStartTime(a.start_time ?? a.startTime ?? "08:00");
    setAppuntamentoEndTime(a.end_time ?? a.endTime ?? "09:00");

    // Cliente: supporta sia Supabase (clienti annidato) che legacy
    setAppuntamentoClienteId(
      a.cliente_id?.toString?.()?.trim?.() ||
        a.clienti?.id?.toString?.()?.trim?.() ||
        a.clienteId?.toString?.()?.trim?.() ||
        ""
    );

    // Giardinieri: usa la proprietà giardinieri mappata (o fallback)
    setAppuntamentoGiardinieriIds(
      Array.isArray(a.giardinieri)
        ? a.giardinieri
            .map(
              (item: any) =>
                item?.id?.toString?.()?.trim?.() ||
                item?.giardiniere_id?.toString?.()?.trim?.() ||
                ""
            )
            .filter(Boolean)
        : Array.isArray(a.appuntamenti_giardinieri)
          ? a.appuntamenti_giardinieri
              .map(
                (rel: any) =>
                  rel.giardinieri?.id?.toString?.()?.trim?.() ||
                  rel.giardiniere_id?.toString?.()?.trim?.() ||
                  ""
              )
              .filter(Boolean)
          : []
    );

    // Attivita: supporta sia Supabase (appuntamenti_attivita) che legacy
    setAppuntamentoAttivita(
      Array.isArray(a.appuntamenti_attivita)
        ? a.appuntamenti_attivita
            .map(
              (rel: any) =>
                rel.attivita?.descrizione?.toString?.()?.trim?.() || ""
            )
            .filter(Boolean)
        : Array.isArray(a.attivita)
          ? a.attivita
              .map((item: any) => item?.toString?.()?.trim?.())
              .filter(Boolean)
          : a.attivita?.toString?.()?.trim?.()
            ? [a.attivita.toString().trim()]
            : []
    );

    setAppuntamentoNote(a.note || a.notes || a.note_servizio || "");
  }, [selectedAppointment]);

  const openNewAppointmentModal = () => {
    const today = formatLocalDate(new Date());
    setLinkedAppuntamentoId(null);
    setAttivitaModalEditData({
      data_inizio: today,
      data_fine: today,
      stato: "promemoria"
    });
  };

  const closeAppointmentModal = () => {
    setSelectedAppointmentId(null);
    setShowDeleteConfirm(false);
    setIsNewAppointmentModal(false);
    setAttivitaModalEditData(null);
    setLinkedAppuntamentoId(null);
  };

  const dismissModal = () => {
    closeAppointmentModal();
  };

  const resetAttivitaForm = () => {
    setAttivitaModalEditData(null);
    setLinkedAppuntamentoId(null);
  };

  const resetAndClose = () => {
    setSelectedAppointmentId(null);
    setShowDeleteConfirm(false);
    setIsNewAppointmentModal(false);
    setAttivitaModalEditData(null);
    setLinkedAppuntamentoId(null);
  };

  // Ricarica dati quando un giardiniere salva modifiche
  useEffect(() => {
    const handleInserimentoSalvato = () => {
      loadData();
    };
    window.addEventListener("inserimento-salvato", handleInserimentoSalvato);
    return () =>
      window.removeEventListener(
        "inserimento-salvato",
        handleInserimentoSalvato
      );
  }, []);

  const handleSaveAppuntamento = async () => {
    const isCreating = isNewAppointmentModal && !selectedAppointmentId;

    if (!isCreating && !selectedAppointmentId) {
      return;
    }

    setIsSavingAppuntamento(true);
    setSaveAppuntamentoError("");

    try {
      let appointmentId = selectedAppointmentId;

      if (isCreating) {
        const { data, error } = await supabase
          .from("appuntamenti")
          .insert({
            data: appuntamentoData,
            end_date: appuntamentoEndDate,
            start_time: appuntamentoStartTime,
            end_time: appuntamentoEndTime,
            cliente_id: appuntamentoClienteId || null,
            note: appuntamentoNote
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);
        appointmentId = data.id;
      } else {
        const { error } = await supabase
          .from("appuntamenti")
          .update({
            data: appuntamentoData,
            end_date: appuntamentoEndDate,
            start_time: appuntamentoStartTime,
            end_time: appuntamentoEndTime,
            cliente_id: appuntamentoClienteId || null,
            note: appuntamentoNote
          })
          .eq("id", selectedAppointmentId);

        if (error) throw new Error(error.message);

        // Delete old junction records before re-inserting
        await Promise.all([
          supabase
            .from("appuntamenti_giardinieri")
            .delete()
            .eq("appuntamento_id", appointmentId),
          supabase
            .from("appuntamenti_attivita")
            .delete()
            .eq("appuntamento_id", appointmentId)
        ]);
      }

      // Save giardinieri junction
      if (appuntamentoGiardinieriIds.length > 0) {
        const { error: relError } = await supabase
          .from("appuntamenti_giardinieri")
          .insert(
            appuntamentoGiardinieriIds.map((giardiniereId) => ({
              appuntamento_id: appointmentId,
              giardiniere_id: giardiniereId
            }))
          );
        if (relError)
          console.error("Errore salvataggio giardinieri:", relError);
      }

      // Save attivita junction
      if (appuntamentoAttivita.length > 0) {
        // Need to get attivita IDs from names
        const { data: attivitaData } = await supabase
          .from("attivita")
          .select("id, descrizione");

        const attivitaMap = new Map(
          (attivitaData || []).map((a: any) => [
            a.descrizione.toLowerCase(),
            a.id
          ])
        );

        const attivitaInserts = appuntamentoAttivita
          .map((name: string) => ({
            appuntamento_id: appointmentId,
            attivita_id: attivitaMap.get(name.trim().toLowerCase())
          }))
          .filter((item: any) => item.attivita_id);

        if (attivitaInserts.length > 0) {
          const { error: actError } = await supabase
            .from("appuntamenti_attivita")
            .insert(attivitaInserts);
          if (actError) console.error("Errore salvataggio attivita:", actError);
        }
      }

      await loadData();
      window.dispatchEvent(new CustomEvent("attivita-aggiornata"));
      window.dispatchEvent(new CustomEvent("inserimento-salvato"));
      closeAppointmentModal();
    } catch (error) {
      setSaveAppuntamentoError(
        error instanceof Error
          ? error.message
          : "Errore salvataggio appuntamento."
      );
    } finally {
      setIsSavingAppuntamento(false);
    }
  };

  const handleDeleteAppuntamento = async () => {
    if (!selectedAppointmentId) {
      return;
    }

    setIsSavingAppuntamento(true);
    try {
      const { error } = await supabase
        .from("appuntamenti")
        .delete()
        .eq("id", selectedAppointmentId);

      if (error) throw new Error(error.message);

      await loadData();
      setShowDeleteConfirm(false);
      closeAppointmentModal();
    } catch (error) {
      setSaveAppuntamentoError(
        error instanceof Error
          ? error.message
          : "Errore eliminazione appuntamento."
      );
    } finally {
      setIsSavingAppuntamento(false);
    }
  };

  const events = useMemo(() => {
    try {
      const rawEvents: Array<{
        id: string;
        title: string;
        start: string;
        end: string;
        backgroundColor: string;
        borderColor: string;
        textColor?: string;
        extendedProps: {
          originalStart: string;
          originalEnd: string;
          originalTimeLabel?: string;
          activity?: string;
          giardiniereName?: string;
          location?: string;
          stato?: string;
          privato?: boolean;
          categoria?: string;
        };
      }> = [];

      for (const appointment of appuntamenti) {
        const appointmentResources = extractAppointmentResources(appointment);

        // Supporto sia snake_case (Supabase) che camelCase
        const start = buildIsoDateTime(
          appointment.start_date ?? appointment.startDate ?? appointment.data,
          appointment.start_time ?? appointment.startTime,
          "08:00"
        );
        const end = buildIsoDateTime(
          appointment.end_date ?? appointment.endDate ?? appointment.data,
          appointment.end_time ?? appointment.endTime,
          appointment.start_time ?? appointment.startTime ?? "09:00"
        );
        if (!start || !end) continue;

        // Estrai attività da appuntamenti_attivita (Supabase) o attivita (legacy)
        let activity: string;
        if (Array.isArray(appointment.appuntamenti_attivita)) {
          activity = appointment.appuntamenti_attivita
            .map((rel: any) => rel.attivita?.descrizione)
            .filter(Boolean)
            .join(", ");
        } else if (Array.isArray(appointment.attivita)) {
          activity = appointment.attivita.join(", ");
        } else {
          activity =
            appointment.attivita || appointment.title || "Appuntamento";
        }
        if (!activity) activity = "Appuntamento";

        // Estrai nome cliente da clienti annidato (Supabase) o flat (legacy)
        const client =
          appointment.clienti?.nome ||
          appointment.clienteNome ||
          appointment.cliente ||
          "";

        // Estrai località
        const locationLabel =
          appointment.location?.toString?.()?.trim?.() || "";

        // Se non ci sono giardinieri, crea un unico evento senza risorsa
        if (!appointmentResources.length) {
          const eventTitle = `${activity}${client ? ` - ${client}` : ""}`;

          rawEvents.push({
            id: appointment.id?.toString?.()?.trim?.() || `app-${start}`,
            title: eventTitle,
            start,
            end,
            backgroundColor: "#0b79d0",
            borderColor: "#0b79d0",
            textColor: "#ffffff",
            extendedProps: {
              originalStart: start,
              originalEnd: end,
              activity,
              location: locationLabel
            }
          });
          continue;
        }

        for (let i = 0; i < appointmentResources.length; i++) {
          const entry = appointmentResources[i];
          const giardiniereName = entry.title || "Giardiniere";
          const eventTitle = `${giardiniereName} ${activity}${client ? ` - ${client}` : ""}`;
          const color =
            entry.colore ||
            resourceColorById.get(entry.resourceId) ||
            "#0b79d0";
          const textColor = getContrastColor(color);
          rawEvents.push({
            id:
              (appointment.id?.toString?.()?.trim?.() ||
                `${entry.resourceId}-${start}-${i}`) + `__${entry.resourceId}`,
            title: eventTitle,
            start,
            end,
            backgroundColor: color,
            borderColor: color,
            ...(textColor ? { textColor } : {}),
            extendedProps: {
              originalStart: start,
              originalEnd: end,
              giardiniereName,
              activity,
              location: locationLabel
            }
          });
        }
      }

      // Eventi da inserimenti_attivita (aggiungi_al_planning = true)
      const currentUsername =
        typeof window !== "undefined"
          ? window.localStorage.getItem("loginUsername") || ""
          : "";

      for (const item of inserimentiAttivita) {
        if (item.privato && item.created_by !== currentUsername) {
          continue;
        }
        const startDate = item.data_inizio || "";
        const endDate = item.data_fine || item.data_inizio || "";
        if (!startDate) continue;

        const attDescr = item.attivita?.descrizione || "Attività";
        const locName = item.localita?.localita || "";

        // Cerca il cliente nella lista
        const clienteItem = clientiList.find(
          (c: any) => c.id === item.cliente_id?.toString()
        );
        const clientName = clienteItem?.nome || "";

        const eventTitle = `${attDescr}${clientName ? ` - ${clientName}` : ""}`;

        // Mappa colori in base a stato
        let eventBgColor: string;
        const stato = (item.stato || "").toLowerCase();
        switch (stato) {
          case "promemoria":
            eventBgColor = "#f59e0b"; // ambra/giallo
            break;
          case "confermato":
            eventBgColor = "#3b82f6"; // blu
            break;
          case "eseguito":
            eventBgColor = "#10b981"; // verde
            break;
          default:
            eventBgColor = "#2c3e50"; // default
        }

        rawEvents.push({
          id: `ins_${item.id}`,
          title: eventTitle,
          start: buildIsoDateTime(startDate, "08:00")!,
          end: buildIsoDateTime(endDate, "17:00")!,
          backgroundColor: eventBgColor,
          borderColor: eventBgColor,
          textColor: "#ffffff",
          extendedProps: {
            originalStart: startDate,
            originalEnd: endDate,
            activity: attDescr,
            location: locName,
            stato: item.stato,
            privato: item.privato,
            categoria: item.attivita?.categorie?.nome || ""
          }
        });
      }

      return rawEvents;
    } catch (error) {
      console.error("Errore costruzione eventi planning:", error);
      return [];
    }
  }, [appuntamenti, resourceColorById, inserimentiAttivita, clientiList]);

  return (
    <div
      className="fullcalendar-page"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerCancel}
      onMouseLeave={handlePointerCancel}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        height: "100%",
        margin: 0,
        padding: "8px 12px",
        boxSizing: "border-box",
        overflow: "visible",
        backgroundColor: "#cbe1f0",
        backgroundImage: "url('/images/sfondo1.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        touchAction: "pan-y"
      }}
    >
      {error ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            textAlign: "center"
          }}
        >
          <div>
            <p className="font-headline-sm text-headline-sm text-on-surface">
              {error}
            </p>
          </div>
        </div>
      ) : (
        <>
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
            .fc .fc-event { touch-action: none !important; }
            .fc .fc-event * { touch-action: none !important; }
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
          `}</style>
          {dragWarning ? (
            <div
              style={{
                position: "fixed",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 2000,
                pointerEvents: "none"
              }}
            >
              <div
                style={{
                  width: "min(calc(100vw - 32px), 520px)",
                  padding: "14px 22px",
                  borderRadius: "20px",
                  background: "rgba(220, 38, 38, 0.96)",
                  color: "#ffffff",
                  fontWeight: 700,
                  textAlign: "center",
                  boxShadow: "0 18px 40px rgba(0,0,0,0.22)"
                }}
              >
                {dragWarning}
              </div>
            </div>
          ) : null}
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
              {localStorage.getItem("loginUsername") || "Admin"} — Administrator
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxWidth: "900px",
              minHeight: "280px",
              maxHeight: "340px",
              margin: "8px auto 8px",
              padding: 0,
              border: "1px solid rgba(15, 23, 42, 0.18)",
              overflow: "hidden",
              background: "transparent",
              boxShadow: "0 18px 40px rgba(13, 45, 82, 0.08)"
            }}
          >
            <FullCalendar
              key={calendarKey}
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
              buttonText={{
                today: "Oggi"
              }}
              titleFormat={{
                year: "numeric",
                month: "long",
                day: "numeric"
              }}
              editable={true}
              eventStartEditable={true}
              eventDurationEditable={false}
              eventDragMinDistance={1}
              eventLongPressDelay={isTouchDevice ? 250 : 0}
              eventAllow={() => true}
              eventDrop={handleEventDrop}
              now={getLocalToday()}
              dayHeaderClassNames={(arg) =>
                arg.date.toDateString() === getLocalToday().toDateString()
                  ? ["fc-custom-today"]
                  : []
              }
              dayCellClassNames={() => []}
              dayHeaderContent={(arg) => {
                const weekday = arg.date
                  .toLocaleDateString("it-IT", { weekday: "long" })
                  .replace(/^./, (c) => c.toUpperCase());
                return {
                  html: `<div style="display:flex;flex-direction:column;align-items:center;font-size:0.85rem;"><span>${weekday}</span><span style="font-weight:700;margin-top:4px;">${arg.date.getDate()}</span></div>`
                };
              }}
              events={events}
              eventClick={async (info) => {
                const rawId = String(info.event.id || "").trim();
                const appId = getAppointmentIdFromEvent(rawId);
                if (!appId) return;

                // Evento da inserimenti_attivita (id prefissato con "ins_")
                if (appId.startsWith("ins_")) {
                  const insId = appId.replace("ins_", "");
                  const item = inserimentiAttivita.find(
                    (i: any) => i.id?.toString() === insId
                  );
                  if (!item) return;

                  const editData = {
                    id: item.id?.toString(),
                    data_inizio: item.data_inizio || "",
                    data_fine: item.data_fine || "",
                    localita_id: item.localita_id?.toString() || "",
                    attivita_id: item.attivita_id?.toString() || "",
                    note: item.note || "",
                    cliente_id: item.cliente_id?.toString() || "",
                    giardiniere_ids: item.giardiniere_ids || [],
                    visibile: !!item.visibile,
                    stato: item.stato || "promemoria",
                    privato: !!item.privato,
                    visibile_giardiniere: item.visibile_giardiniere !== false,
                    visibile_contatto: item.visibile_contatto !== false,
                    attivita: item.attivita || null,
                    aggiungi_al_planning: true,
                    created_by: item.created_by || null
                  };
                  setLinkedAppuntamentoId(null);
                  setAttivitaModalEditData(editData);
                  return;
                }

                // Evento da appuntamenti
                const appt = appuntamenti.find(
                  (a) => a.id?.toString?.()?.trim?.() === appId
                );
                if (!appt) return;

                const apptDataNorm = appt.data?.toString?.()?.trim?.() || "";
                const apptLoc = appt.location?.toString?.()?.trim?.() || "";
                const apptAtt = appt.attivita?.toString?.()?.trim?.() || "";

                const { data: linked } = await supabase
                  .from("inserimenti_attivita")
                  .select("*, attivita(*, categorie(*))")
                  .order("data_inizio", { ascending: false })
                  .limit(20);

                const match = (linked || []).find((ins: any) => {
                  const insDate = ins.data_inizio?.toString?.()?.trim?.() || "";
                  const insLoc =
                    localitaList
                      .find(
                        (l: any) =>
                          l.id?.toString() === ins.localita_id?.toString()
                      )
                      ?.localita?.toString?.()
                      ?.trim?.() || "";
                  const insAtt =
                    ins.attivita?.descrizione?.toString?.()?.trim?.() || "";
                  const sameDate = insDate === apptDataNorm;
                  const sameLoc = insLoc === apptLoc && !!apptLoc;
                  const sameAtt = insAtt === apptAtt && !!apptAtt;
                  return (sameDate && sameLoc) || (sameDate && sameAtt);
                });

                if (match) {
                  const editData = {
                    id: match.id?.toString(),
                    data_inizio: match.data_inizio || "",
                    data_fine: match.data_fine || "",
                    localita_id: match.localita_id?.toString() || "",
                    attivita_id: match.attivita_id?.toString() || "",
                    note: match.note || "",
                    cliente_id: match.cliente_id?.toString() || "",
                    giardiniere_ids: match.giardiniere_ids || [],
                    visibile: !!match.visibile,
                    stato: match.stato || "promemoria",
                    privato: !!match.privato,
                    visibile_giardiniere: match.visibile_giardiniere !== false,
                    visibile_contatto: match.visibile_contatto !== false,
                    attivita: match.attivita || null,
                    aggiungi_al_planning: true,
                    created_by: match.created_by || null
                  };
                  setLinkedAppuntamentoId(appId);
                  setAttivitaModalEditData(editData);
                } else {
                  // Nessun collegamento: apri con dati precompilati
                  const loc = localitaList.find(
                    (l: any) => l.localita === appt.location
                  );
                  const att = attivitaList.find(
                    (a: any) => a.descrizione === appt.attivita
                  );
                  const appointmentDate =
                    appt.data || formatLocalDate(new Date());
                  const appointmentEndDate = appt.end_date || appt.data || "";
                  const locId = loc?.id?.toString() || "";
                  const attId = att?.id?.toString() || "";
                  const giardiniereIds = appt.giardiniere_ids
                    ? Array.isArray(appt.giardiniere_ids)
                      ? appt.giardiniere_ids.map((x: any) => String(x))
                      : []
                    : [];
                  const editData = {
                    data_inizio: appointmentDate,
                    data_fine: appointmentEndDate || appointmentDate,
                    localita_id: locId,
                    attivita_id: attId,
                    note: appt.note || "",
                    cliente_id: appt.cliente_id?.toString() || "",
                    giardiniere_ids: giardiniereIds,
                    aggiungi_al_planning: true,
                    stato: "promemoria"
                  };
                  setLinkedAppuntamentoId(appId);
                  setAttivitaModalEditData(editData);
                }
              }}
              eventDidMount={(info) => {
                const element = info.el as HTMLElement;
                element.style.touchAction = "none";
                const eventColor = info.event.backgroundColor as
                  | string
                  | undefined;
                const borderColor =
                  (info.event.borderColor as string | undefined) || eventColor;
                const textColor = info.event.textColor as string | undefined;
                if (eventColor) {
                  element.style.backgroundColor = eventColor;
                }
                if (borderColor) {
                  element.style.borderColor = borderColor;
                }
                if (textColor) {
                  element.style.color = textColor;
                }
                element.addEventListener("click", () => {
                  const appId = getAppointmentIdFromEvent(
                    String(info.event.id || "").trim()
                  );
                  if (appId) {
                    setSelectedAppointmentId(appId);
                  }
                });
              }}
              eventContent={(arg) => {
                const fmtDate = (d: Date | null) =>
                  d
                    ? d.toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "2-digit"
                      })
                    : "";
                const startStr = fmtDate(arg.event.start);
                const endStr = fmtDate(arg.event.end);
                const dateLabel =
                  startStr === endStr ? startStr : `${startStr} - ${endStr}`;
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
              height={450}
              dayMaxEvents={true}
              dayMaxEventRows={true}
              eventOrder="title"
            />
          </div>
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
              {(calendarTitle || "Caricamento...")
                .replace(/\s*\n\s*/g, " ")
                .trim()}
            </h2>
          </div>
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

          {/* Legenda colori stato attività */}
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
                aria-label="Aggiungi appuntamento"
                onClick={openNewAppointmentModal}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-primary shadow-lg transition hover:bg-primary/90"
                style={{
                  border: "none",
                  boxShadow: "0 16px 28px rgba(0, 0, 0, 0.18)",
                  cursor: "pointer"
                }}
              >
                <span className="material-symbols-outlined text-xl leading-none text-white">
                  add
                </span>
              </button>
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em"
                }}
              >
                Aggiungi
              </span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <button
                type="button"
                aria-label="Chiudi"
                onClick={() => navigate("/admin")}
                className="material-symbols-outlined inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                style={{
                  border: "none",
                  boxShadow: "0 16px 28px rgba(0, 0, 0, 0.18)",
                  cursor: "pointer"
                }}
              >
                close
              </button>
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em"
                }}
              >
                Chiudi
              </span>
            </div>
          </div>
          {/* Modale Inserimento/Modifica Attività */}
          {attivitaModalEditData !== null && (
            <InserisciAttivitaModal
              editData={attivitaModalEditData}
              onClose={() => {
                setAttivitaModalEditData(null);
                setLinkedAppuntamentoId(null);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

export default FullCalendarPage;
