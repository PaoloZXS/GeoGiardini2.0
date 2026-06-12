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
    Array<{ id: string; nome: string }>
  >([]);
  const [attivitaList, setAttivitaList] = useState<
    Array<{ id: string; descrizione: string; categoria_id: string }>
  >([]);
  const [localitaList, setLocalitaList] = useState<any[]>([]);
  const [categorieList, setCategorieList] = useState<any[]>([]);
  const [inserimentiAttivita, setInserimentiAttivita] = useState<any[]>([]);
  // Stato form "Inserimento Attività"
  const [showAttivitaForm, setShowAttivitaForm] = useState(false);
  const [attivitaEditId, setAttivitaEditId] = useState<string | null>(null);
  const [linkedAppuntamentoId, setLinkedAppuntamentoId] = useState<string | null>(null);
  const [attivitaDataInizio, setAttivitaDataInizio] = useState("");
  const [attivitaDataFine, setAttivitaDataFine] = useState("");
  const [attivitaLocalitaId, setAttivitaLocalitaId] = useState("");
  const [attivitaCategoriaId, setAttivitaCategoriaId] = useState("");
  const [attivitaAttivitaId, setAttivitaAttivitaId] = useState("");
  const [attivitaNote, setAttivitaNote] = useState("");
  const [attivitaClienteId, setAttivitaClienteId] = useState("");
  const [attivitaVisibile, setAttivitaVisibile] = useState(false);
  const [attivitaNuoveFoto, setAttivitaNuoveFoto] = useState<File[]>([]);
  const [attivitaFotoEsistenti, setAttivitaFotoEsistenti] = useState<any[]>([]);
  const [attivitaSaving, setAttivitaSaving] = useState(false);
  const [attivitaStatus, setAttivitaStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const attivitaFileInputRef = useRef<HTMLInputElement | null>(null);
  const attivitaStatusTimeoutRef = useRef<number | null>(null);
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
      const [giardinieriData, appuntamentiData, clientiData, attivitaData, localitaData, categorieData, inserimentiData] =
        await Promise.all([
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
            .select("id, nome")
            .order("nome", { ascending: true }),
          supabase
            .from("attivita")
            .select("*, categorie(nome)")
            .order("descrizione", { ascending: true }),
          supabase
            .from("localita")
            .select("id, localita")
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

      setGiardinieri(giardinieriData.data || []);
      setAppuntamenti(
        (appuntamentiData.data || []).map((item: any) => ({
          ...item,
          giardinieri: Array.isArray(item.appuntamenti_giardinieri)
            ? item.appuntamenti_giardinieri
                .map((rel: any) => rel.giardinieri)
                .filter(Boolean)
            : Array.isArray(item.giardinieri)
              ? item.giardinieri
              : []
        }))
      );
      await fetchHandledAppointmentIds();

      setClientiList(
        (clientiData.data || [])
          .map((c: any) => ({
            id: c.id?.toString() ?? "",
            nome: c.nome?.toString() ?? ""
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
      setLocalitaList(localitaData.data || []);
      setCategorieList(categorieData.data || []);
      setInserimentiAttivita(inserimentiData.data || []);
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

  useEffect(() => {
    loadData();
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
        return false;
      }
      return true;
    } catch (error) {
      console.error("Errore drag appointment", error);
      return false;
    }
  };

  const handleEventDrop = async (info: any) => {
    setDragWarning(null);
    const rawId = String(info.event.id || "").trim();
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

    const success = await updateAppuntamentoFromDrag(
      appointment,
      info.event.start
    );

    if (!success) {
      setDragWarning(
        "Impossibile aggiornare l'appuntamento. Riprovare più tardi."
      );
      info.revert();
      return;
    }

    await loadData();
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
    setAttivitaDataInizio(today);
    setAttivitaDataFine(today);
    setAttivitaLocalitaId("");
    setAttivitaCategoriaId("");
    setAttivitaAttivitaId("");
    setAttivitaNote("");
    setAttivitaClienteId("");
    setAttivitaVisibile(false);
    setAttivitaNuoveFoto([]);
    setAttivitaFotoEsistenti([]);
    setAttivitaStatus(null);
    setLinkedAppuntamentoId(null);
    setShowAttivitaForm(true);
  };

  const closeAppointmentModal = () => {
    setSelectedAppointmentId(null);
    setShowDeleteConfirm(false);
    setIsNewAppointmentModal(false);
    setShowAttivitaForm(false);
  };

  const dismissModal = () => {
    closeAppointmentModal();
  };

  const filteredAttivitaForm = attivitaList.filter(
    (a: any) => !attivitaCategoriaId || a.categoria_id === attivitaCategoriaId
  );

  const resetAttivitaForm = () => {
    const today = formatLocalDate(new Date());
    setAttivitaDataInizio(today);
    setAttivitaDataFine(today);
    setAttivitaLocalitaId("");
    setAttivitaCategoriaId("");
    setAttivitaAttivitaId("");
    setAttivitaNote("");
    setAttivitaClienteId("");
    setAttivitaVisibile(false);
    setAttivitaNuoveFoto([]);
    setAttivitaFotoEsistenti([]);
    setAttivitaEditId(null);
    setLinkedAppuntamentoId(null);
  };

  const resetAndClose = () => {
    resetAttivitaForm();
    setAttivitaStatus(null);
    setShowDeleteConfirm(false);
    setShowAttivitaForm(false);
  };

  const clearAttivitaStatus = () => {
    if (attivitaStatusTimeoutRef.current) window.clearTimeout(attivitaStatusTimeoutRef.current);
    attivitaStatusTimeoutRef.current = window.setTimeout(() => {
      setAttivitaStatus(null);
      attivitaStatusTimeoutRef.current = null;
    }, 2000);
  };

  const uploadFoto = async (file: File, attivitaId: string): Promise<string> => {
    const fileName = `${attivitaId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("foto")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage.from("foto").getPublicUrl(fileName);
    return urlData?.publicUrl || "";
  };

  const handleDeleteFotoAttivita = async (fotoId: string, fotoUrl: string) => {
    try {
      const path = fotoUrl.split("/foto/").pop();
      if (path) await supabase.storage.from("foto").remove([path]);
      await supabase.from("foto_attivita").delete().eq("id", fotoId);
      setAttivitaFotoEsistenti((prev) => prev.filter((f) => f.id !== fotoId));
    } catch (err) {
      console.error("Errore eliminazione foto", err);
    }
  };

  const handleSaveAttivita = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attivitaLocalitaId || !attivitaAttivitaId) {
      setAttivitaStatus({ type: "error", message: "Località e Attività sono obbligatorie." });
      clearAttivitaStatus();
      return;
    }
    setAttivitaSaving(true);
    try {
      const payload: any = {
        data_inizio: attivitaDataInizio || null,
        data_fine: attivitaDataFine || null,
        localita_id: attivitaLocalitaId,
        attivita_id: attivitaAttivitaId,
        note: attivitaNote.trim() || null,
        cliente_id: attivitaClienteId || null,
        visibile: attivitaVisibile,
        aggiungi_al_planning: true
      };

      let recordId: string;

      if (attivitaEditId) {
        // MODIFICA
        const { error } = await supabase
          .from("inserimenti_attivita")
          .update(payload)
          .eq("id", attivitaEditId);
        if (error) throw new Error(error.message);
        recordId = attivitaEditId;
      } else {
        // NUOVO
        const { data: inserted, error } = await supabase
          .from("inserimenti_attivita")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        recordId = inserted.id;
      }

      // Upload nuove foto
      for (const file of attivitaNuoveFoto) {
        const fotoUrl = await uploadFoto(file, recordId);
        await supabase.from("foto_attivita").insert({ attivita_id: recordId, foto_url: fotoUrl });
      }
      setAttivitaNuoveFoto([]);

      setAttivitaStatus({
        type: "success",
        message: attivitaEditId
          ? "Attività aggiornata con successo."
          : "Attività inserita con successo."
      });
      resetAttivitaForm();
      await loadData();
      clearAttivitaStatus();
      // Chiudi il modal dopo 2 secondi per far vedere il messaggio
      setTimeout(() => resetAndClose(), 2000);
    } catch (err: any) {
      setAttivitaStatus({ type: "error", message: err.message || "Errore durante il salvataggio." });
      clearAttivitaStatus();
    } finally {
      setAttivitaSaving(false);
    }
  };

  const handleDeleteAttivita = async () => {
    if (!attivitaEditId && !linkedAppuntamentoId) return;
    setAttivitaSaving(true);
    try {
      if (attivitaEditId) {
        // Elimina foto collegate
        const { data: fotoList } = await supabase
          .from("foto_attivita")
          .select("*")
          .eq("attivita_id", attivitaEditId);
        for (const foto of fotoList || []) {
          const path = foto.foto_url?.split("/foto/").pop();
          if (path) await supabase.storage.from("foto").remove([path]).catch(() => {});
        }
        await supabase.from("foto_attivita").delete().eq("attivita_id", attivitaEditId);
        await supabase.from("inserimenti_attivita").delete().eq("id", attivitaEditId);
      }

      setShowDeleteConfirm(false);
      resetAndClose();
      await loadData();
    } catch (err: any) {
      setAttivitaStatus({ type: "error", message: err.message || "Errore durante l'eliminazione." });
      clearAttivitaStatus();
    } finally {
      setAttivitaSaving(false);
    }
  };

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
        extendedProps: {
          originalStart: string;
          originalEnd: string;
          originalTimeLabel: string;
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
      for (const item of inserimentiAttivita) {
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

        rawEvents.push({
          id: `ins_${item.id}`,
          title: eventTitle,
          start: buildIsoDateTime(startDate, "08:00"),
          end: buildIsoDateTime(endDate, "17:00"),
          backgroundColor: "#2c3e50",
          borderColor: "#2c3e50",
          textColor: "#ffffff",
          extendedProps: {
            originalStart: startDate,
            originalEnd: endDate,
            activity: attDescr,
            location: locName
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
        padding: "24px",
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxWidth: "900px",
              minHeight: "450px",
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

                // Resetta tutti gli stati prima di caricare i nuovi dati
                resetAttivitaForm();
                setAttivitaEditId(null);

                // Evento da inserimenti_attivita (id prefissato con "ins_")
                if (appId.startsWith("ins_")) {
                  const insId = appId.replace("ins_", "");
                  const item = inserimentiAttivita.find(
                    (i: any) => i.id?.toString() === insId
                  );
                  if (!item) return;

                  setLinkedAppuntamentoId(null);
                  setAttivitaEditId(insId);
                  setAttivitaDataInizio(item.data_inizio || "");
                  setAttivitaDataFine(item.data_fine || "");
                  setAttivitaLocalitaId(item.localita_id?.toString() || "");
                  setAttivitaCategoriaId(
                    item.attivita?.categorie?.id?.toString() ||
                    item.attivita?.categoria_id?.toString() ||
                    ""
                  );
                  setAttivitaAttivitaId(item.attivita_id?.toString() || "");
                  setAttivitaNote(item.note || "");
                  setAttivitaClienteId(item.cliente_id?.toString() || "");
                  setAttivitaVisibile(!!item.visibile);
                  // Carica foto esistenti
                  const { data: foto } = await supabase
                    .from("foto_attivita")
                    .select("*")
                    .eq("attivita_id", insId);
                  setAttivitaFotoEsistenti(foto || []);
                  setShowAttivitaForm(true);
                  return;
                }

                // Evento da appuntamenti
                setLinkedAppuntamentoId(appId);

                // Cerca un inserimenti_attivita collegato per data + località/attività
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
                    localitaList.find(
                      (l: any) => l.id?.toString() === ins.localita_id?.toString()
                    )?.localita?.toString?.()?.trim?.() || "";
                  const insAtt = ins.attivita?.descrizione?.toString?.()?.trim?.() || "";
                  const sameDate = insDate === apptDataNorm;
                  const sameLoc = insLoc === apptLoc && !!apptLoc;
                  const sameAtt = insAtt === apptAtt && !!apptAtt;
                  return (sameDate && sameLoc) || (sameDate && sameAtt);
                });

                if (match) {
                  const matchId = match.id?.toString() || null;
                  setAttivitaEditId(matchId);
                  setAttivitaDataInizio(match.data_inizio || "");
                  setAttivitaDataFine(match.data_fine || "");
                  setAttivitaLocalitaId(match.localita_id || "");
                  setAttivitaCategoriaId(
                    match.attivita?.categorie?.id?.toString() ||
                    match.attivita?.categoria_id?.toString() ||
                    ""
                  );
                  setAttivitaAttivitaId(match.attivita_id?.toString() || "");
                  setAttivitaNote(match.note || "");
                  setAttivitaClienteId(match.cliente_id?.toString() || "");
                  setAttivitaVisibile(!!match.visibile);
                  const { data: foto } = await supabase
                    .from("foto_attivita")
                    .select("*")
                    .eq("attivita_id", matchId);
                  setAttivitaFotoEsistenti(foto || []);
                  setShowAttivitaForm(true);
                } else {
                  // Nessun collegamento: apri con dati precompilati
                  const loc = localitaList.find(
                    (l: any) => l.localita === appt.location
                  );
                  const att = attivitaList.find(
                    (a: any) => a.descrizione === appt.attivita
                  );
                  setAttivitaDataInizio(appt.data || formatLocalDate(new Date()));
                  setAttivitaDataFine(appt.end_date || appt.data || "");
                  setAttivitaLocalitaId(loc?.id?.toString() || "");
                  setAttivitaCategoriaId(att?.categoria_id || "");
                  setAttivitaAttivitaId(att?.id?.toString() || "");
                  setAttivitaNote(appt.note || "");
                  setAttivitaClienteId(appt.cliente_id?.toString() || "");
                  setAttivitaVisibile(false);
                  setShowAttivitaForm(true);
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
                const fmt = (d) =>
                  d?.toLocaleTimeString("it-IT", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false
                  }) || "";
                const timeLabel = `${fmt(arg.event.start)} - ${fmt(arg.event.end)}`;
                const cliente = String(arg.event.title).includes(" - ")
                  ? String(arg.event.title).split(" - ").slice(1).join(" - ")
                  : "";
                const giardiniereName =
                  arg.event.extendedProps.giardiniereName || "";
                const activity = arg.event.extendedProps.activity || "";
                const location = arg.event.extendedProps.location || "";
                const secondaRiga = [location, activity].filter(Boolean).join(" - ");
                return {
                  html:
                    `<div style="font-size:0.75rem;line-height:1.2;display:flex;flex-direction:column;justify-content:center;overflow:hidden;">` +
                    `<span style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${timeLabel}${cliente ? ` ${cliente}` : ""}</span>` +
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
          {showAttivitaForm ? (
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
                {attivitaStatus && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30">
                    <div
                      className={`text-center text-base font-bold py-4 px-8 rounded-2xl shadow-2xl ${
                        attivitaStatus.type === "success"
                          ? "bg-emerald-100 text-emerald-950 border-2 border-emerald-400"
                          : "bg-red-100 text-red-700 border-2 border-red-400"
                      }`}
                    >
                      {attivitaStatus.message}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="material-symbols-outlined text-3xl text-[#2563eb]">
                    playlist_add
                  </span>
                  <h3 className="text-xl font-semibold text-[#2563eb]">
                    {attivitaEditId ? "Modifica Attività" : "Inserimento Attività"}
                  </h3>
                </div>
                <form
                  className="flex flex-col h-full min-h-0 gap-4"
                  onSubmit={handleSaveAttivita}
                >
                  {/* Date */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="pl-2 text-sm font-bold text-black block">
                        Data inizio
                      </label>
                      <input
                        type="date"
                        className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold"
                        value={attivitaDataInizio}
                        onChange={(e) => setAttivitaDataInizio(e.target.value)}
                        onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                      />
                    </div>
                    <div>
                      <label className="pl-2 text-sm font-bold text-black block">
                        Data fine
                      </label>
                      <input
                        type="date"
                        className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold"
                        value={attivitaDataFine}
                        onChange={(e) => setAttivitaDataFine(e.target.value)}
                        onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                      />
                    </div>
                  </div>

                  {/* Località */}
                  <div>
                    <label className="pl-2 text-sm font-bold text-black block">
                      Località
                    </label>
                    <select
                      className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold"
                      value={attivitaLocalitaId}
                      onChange={(e) => setAttivitaLocalitaId(e.target.value)}
                      style={{ color: attivitaLocalitaId ? "black" : "#9ca3af" }}
                    >
                      <option value="" className="text-[#9ca3af]">
                        Seleziona località...
                      </option>
                      {localitaList.map((l: any) => (
                        <option key={l.id} value={l.id} className="text-black">
                          {l.localita}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Categoria + Descrizione */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="pl-2 text-sm font-bold text-black block">
                        Soggetto
                      </label>
                      <select
                        className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold"
                        value={attivitaCategoriaId}
                        onChange={(e) => {
                          setAttivitaCategoriaId(e.target.value);
                          setAttivitaAttivitaId("");
                        }}
                        style={{ color: attivitaCategoriaId ? "black" : "#9ca3af" }}
                      >
                        <option value="" className="text-[#9ca3af]">
                          Seleziona Soggetto
                        </option>
                        {categorieList.map((c: any) => (
                          <option key={c.id} value={c.id} className="text-black">
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="pl-2 text-sm font-bold text-black block">
                        Azione
                      </label>
                      <select
                        className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold"
                        value={attivitaAttivitaId}
                        onChange={(e) => setAttivitaAttivitaId(e.target.value)}
                        style={{ color: attivitaAttivitaId ? "black" : "#9ca3af" }}
                      >
                        <option value="" className="text-[#9ca3af]">
                          Seleziona Azione...
                        </option>
                        {filteredAttivitaForm.map((a: any) => (
                          <option key={a.id} value={a.id} className="text-black">
                            {a.descrizione}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="pl-2 text-sm font-bold text-black block">
                      Note
                    </label>
                    <textarea
                      className="w-full min-h-[60px] px-4 py-2 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs text-black font-bold resize-none placeholder:text-[#9ca3af]"
                      placeholder="Note opzionali..."
                      value={attivitaNote}
                      onChange={(e) => setAttivitaNote(e.target.value)}
                    />
                  </div>

                  {/* Cliente */}
                  <div>
                    <label className="pl-2 text-sm font-bold text-black block">
                      Contatto
                    </label>
                    <select
                      className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold"
                      value={attivitaClienteId}
                      onChange={(e) => setAttivitaClienteId(e.target.value)}
                      style={{ color: attivitaClienteId ? "black" : "#9ca3af" }}
                    >
                      <option value="" className="text-[#9ca3af]">
                        Seleziona contatto
                      </option>
                      {clientiList.map((c: any) => (
                        <option key={c.id} value={c.id} className="text-black">
                          {c.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Griglia foto 4x2 */}
                  <div>
                    <input
                      ref={attivitaFileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          const total = attivitaNuoveFoto.length + e.target.files.length;
                          if (total > 8) {
                            setAttivitaStatus({ type: "error", message: "Massimo 8 foto." });
                            clearAttivitaStatus();
                            return;
                          }
                          setAttivitaNuoveFoto((prev) => [...prev, ...Array.from(e.target.files!)]);
                        }
                      }}
                    />
                    <div
                      className="grid justify-center gap-3 w-full p-2 bg-transparent border border-white"
                      style={{ gridTemplateColumns: "repeat(4, 60px)" }}
                    >
                      {Array.from({ length: 8 }).map((_, idx) => {
                        const fotoExistente = attivitaFotoEsistenti[idx];
                        const nuovaFoto = !fotoExistente
                          ? attivitaNuoveFoto[idx - attivitaFotoEsistenti.length]
                          : null;
                        const hasPhoto = !!fotoExistente || !!nuovaFoto;
                        const isLast = idx === 7;
                        const showPlus = isLast && attivitaNuoveFoto.length + attivitaFotoEsistenti.length < 8;
                        return (
                          <div
                            key={idx}
                            className="relative group cursor-pointer border border-[#e5e7eb] flex items-center justify-center overflow-hidden"
                            style={{
                              width: "60px",
                              height: "60px",
                              backgroundColor: hasPhoto ? "transparent" : "#f9fafb"
                            }}
                            onClick={() => attivitaFileInputRef.current?.click()}
                          >
                            {hasPhoto ? (
                              <>
                                <img
                                  src={
                                    fotoExistente
                                      ? fotoExistente.foto_url
                                      : URL.createObjectURL(nuovaFoto!)
                                  }
                                  alt="Foto"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  className="absolute top-0 right-0 bg-red-600 text-white w-4 h-4 flex items-center justify-center text-[10px] leading-none opacity-0 group-hover:opacity-100 transition"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (fotoExistente)
                                      handleDeleteFotoAttivita(fotoExistente.id, fotoExistente.foto_url);
                                    else
                                      setAttivitaNuoveFoto((prev) =>
                                        prev.filter((_, i) => i !== idx - attivitaFotoEsistenti.length)
                                      );
                                  }}
                                >
                                  ✕
                                </button>
                              </>
                            ) : showPlus ? (
                              <span className="material-symbols-outlined text-2xl text-[#9ca3af]">
                                add
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Checkbox */}
                  <div className="flex items-center gap-6 pl-2">
                    <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#154212]"
                        checked={attivitaVisibile}
                        onChange={(e) => setAttivitaVisibile(e.target.checked)}
                      />
                      Foto visibile al Contatto
                    </label>
                  </div>

                  <div className="mt-auto bg-transparent pt-3 pb-3">
                    <div className="flex items-center justify-end gap-12" style={{ marginRight: "20px" }}>
                      {attivitaEditId || (linkedAppuntamentoId && !attivitaEditId) ? (
                        <div className="flex flex-col items-center">
                          <button
                            type="button"
                            onClick={() => setShowDeleteConfirm(true)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-700"
                            title="Elimina"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                          <span className="mt-1 text-[0.65rem] font-semibold text-white">
                            Elimina
                          </span>
                        </div>
                      ) : null}
                      <div className="flex flex-col items-center">
                        <button
                          type="button"
                          onClick={resetAttivitaForm}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-3xl leading-none transition focus:outline-none focus:ring-2 focus:ring-[#154212]"
                          style={{ backgroundColor: "#f5e0b7" }}
                          title="Pulisci campi"
                        >
                          <span className="material-symbols-outlined text-[22px] leading-none text-black">
                            cleaning_services
                          </span>
                        </button>
                        <span className="mt-1 text-[0.65rem] font-semibold text-white">
                          Pulisci
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <button
                          className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition ${
                            attivitaSaving
                              ? "bg-[#154212]/70 cursor-not-allowed"
                              : "bg-[#154212] hover:bg-[#154212]/90"
                          }`}
                          type="submit"
                          disabled={attivitaSaving}
                        >
                          {attivitaSaving ? (
                            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <span className="material-symbols-outlined text-xl">save</span>
                          )}
                        </button>
                        <span className="mt-1 text-[0.65rem] font-semibold text-white">
                          Salva
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        <button
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                          type="button"
                          onClick={resetAndClose}
                        >
                          <span className="material-symbols-outlined text-xl">close</span>
                        </button>
                        <span className="mt-1 text-[0.65rem] font-semibold text-white">
                          Chiudi
                        </span>
                      </div>
                    </div>
                  </div>
                </form>
                {showDeleteConfirm && (
                  <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
                    <div className="w-full max-w-lg rounded-3xl border border-red-400/40 bg-white p-6 shadow-2xl">
                      <p className="text-lg font-semibold text-black mb-2">
                        Confermi eliminazione?
                      </p>
                      <p className="mb-4 text-sm text-gray-600">
                        Questa azione eliminerà definitivamente l'attività e l'appuntamento collegato.
                      </p>
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          className="w-full sm:w-auto h-10 rounded-full border border-gray-300 bg-white text-black transition-colors hover:bg-gray-100 px-6 text-sm font-semibold"
                          onClick={() => setShowDeleteConfirm(false)}
                        >
                          Annulla
                        </button>
                        <button
                          type="button"
                          className="w-full sm:w-auto h-10 rounded-full bg-red-600 text-white shadow-lg px-6 text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                          onClick={handleDeleteAttivita}
                          disabled={attivitaSaving}
                        >
                          {attivitaSaving ? "Eliminazione..." : "Elimina"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default FullCalendarPage;
