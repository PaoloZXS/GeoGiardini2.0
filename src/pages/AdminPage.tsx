import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

interface AdminPageProps {
  onLogout: () => void;
}

// === CRUD Modals ===

function ClientiModal({ onClose }: { onClose: () => void }) {
  const [clientiList, setClientiList] = useState<any[]>([]);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [nomeCliente, setNomeCliente] = useState("");
  const [indirizzoCliente, setIndirizzoCliente] = useState("");
  const [telefonoCliente, setTelefonoCliente] = useState("");
  const [clienteCodice, setClienteCodice] = useState("");
  const [clienteAttivo, setClienteAttivo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | null>(
    null
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: "cliente";
    id: string;
    label: string;
  } | null>(null);
  const nomeClienteRef = useRef<HTMLInputElement | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const clearStatusAfterDelay = () => {
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      setStatusType(null);
      statusTimeoutRef.current = null;
    }, 2000);
  };

  const fetchClienti = async () => {
    try {
      const { data, error } = await supabase
        .from("clienti")
        .select("*")
        .order("nome", { ascending: true });
      if (error) {
        console.error("Caricamento clienti fallito", error);
        return;
      }
      setClientiList(
        (data || []).map((cliente: any) => ({
          ...cliente,
          id: cliente.id?.toString?.() ?? "",
          attivo:
            cliente.attivo === 1 ||
            cliente.attivo === "1" ||
            cliente.attivo === true ||
            cliente.attivo === "true"
        }))
      );
    } catch (error) {
      console.error("Caricamento clienti fallito", error);
    }
  };

  useEffect(() => {
    fetchClienti();
  }, []);

  const handleSaveCliente = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !nomeCliente.trim() ||
      !indirizzoCliente.trim() ||
      !clienteCodice.trim()
    ) {
      setStatusType("error");
      setStatusMessage("Nome, indirizzo e codice sono obbligatori.");
      clearStatusAfterDelay();
      return;
    }
    setIsSaving(true);
    setStatusMessage(null);
    setStatusType(null);
    try {
      const payload = {
        nome: nomeCliente.trim(),
        indirizzo: indirizzoCliente.trim(),
        telefono: telefonoCliente.trim(),
        codice: clienteCodice.trim(),
        attivo: clienteAttivo
      };
      if (editingClienteId) {
        const { error } = await supabase
          .from("clienti")
          .update(payload)
          .eq("id", editingClienteId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("clienti").insert(payload);
        if (error) throw new Error(error.message);
      }
      setStatusType("success");
      setStatusMessage(
        editingClienteId
          ? "Cliente aggiornato con successo."
          : "Cliente salvato con successo."
      );
      await fetchClienti();
      setEditingClienteId(null);
      setNomeCliente("");
      setIndirizzoCliente("");
      setTelefonoCliente("");
      setClienteCodice("");
      setClienteAttivo(false);
      clearStatusAfterDelay();
    } catch (error) {
      console.error(error);
      setStatusType("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Impossibile salvare il cliente. Riprova."
      );
      clearStatusAfterDelay();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCliente = async (id: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("clienti").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setStatusType("success");
      setStatusMessage("Cliente eliminato con successo.");
      await fetchClienti();
      if (editingClienteId === id) {
        setEditingClienteId(null);
        setNomeCliente("");
        setIndirizzoCliente("");
        setTelefonoCliente("");
      }
      clearStatusAfterDelay();
    } catch (error) {
      console.error(error);
      setStatusType("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Impossibile eliminare il cliente. Riprova."
      );
      clearStatusAfterDelay();
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteConfirmation = (
    type: "cliente",
    id: string,
    label: string
  ) => {
    setDeleteConfirmation({ type, id, label });
    setStatusMessage(null);
    setStatusType(null);
  };

  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id } = deleteConfirmation;
    setDeleteConfirmation(null);
    await handleDeleteCliente(id);
  };

  const handleSelectCliente = (cliente: any) => {
    setEditingClienteId(cliente.id);
    setNomeCliente(cliente.nome);
    setIndirizzoCliente(cliente.indirizzo);
    setTelefonoCliente(cliente.telefono);
    setClienteCodice(cliente.codice || "");
    setClienteAttivo(
      cliente.attivo === 1 ||
        cliente.attivo === "1" ||
        cliente.attivo === true ||
        cliente.attivo === "true"
    );
  };

  const handleClearClienteForm = () => {
    setEditingClienteId(null);
    setNomeCliente("");
    setIndirizzoCliente("");
    setTelefonoCliente("");
    setClienteCodice("");
    setClienteAttivo(false);
    setStatusMessage(null);
    setStatusType(null);
    nomeClienteRef.current?.blur();
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    )
      document.activeElement.blur();
  };

  const buildTelUrl = (phone: string) => {
    const cleaned = phone.trim().replace(/[^\d+]/g, "");
    return cleaned ? `tel:${cleaned}` : "";
  };

  const handleTelefonoCall = () => {
    const telUrl = buildTelUrl(telefonoCliente);
    if (telUrl) window.location.href = telUrl;
  };

  return (
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
        <div className="flex items-center justify-center gap-3 mb-3">
          <span
            className="material-symbols-outlined text-3xl text-[#2563eb]"
            data-icon="groups"
          >
            groups
          </span>
          <h3 className="text-xl font-semibold text-[#2563eb]">
            {editingClienteId ? "Modifica Cliente" : "Nuovo Cliente"}
          </h3>
        </div>
        <form
          className="flex flex-col h-full min-h-0 gap-4"
          onSubmit={handleSaveCliente}
        >
          <div>
            <label className="pl-2 text-sm font-bold text-black block">
              Nome contatto
            </label>
            <input
              ref={nomeClienteRef}
              className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              placeholder="Es. Mario Rossi"
              type="text"
              value={nomeCliente}
              onChange={(e) => setNomeCliente(e.target.value)}
            />
          </div>
          <div>
            <label className="pl-2 text-sm font-bold text-black block">
              Indirizzo
            </label>
            <input
              className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              placeholder="Es. Via Roma 1"
              type="text"
              value={indirizzoCliente}
              onChange={(e) => setIndirizzoCliente(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="pl-2 text-xs font-bold text-black block">
                Codice
              </label>
              <input
                className="w-3/4 h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
                placeholder="Es. CLI-2024"
                type="text"
                value={clienteCodice}
                onChange={(e) => setClienteCodice(e.target.value)}
              />
            </div>
            <div>
              <label className="pl-2 text-xs font-bold text-black block">
                Telefono
              </label>
              <div className="relative">
                <input
                  className="w-full h-10 pr-12 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
                  placeholder="Es. 345 123 4567"
                  type="text"
                  value={telefonoCliente}
                  onChange={(e) => setTelefonoCliente(e.target.value)}
                />
                {telefonoCliente.trim() ? (
                  <button
                    type="button"
                    onClick={handleTelefonoCall}
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white hover:bg-[#1DA851]"
                    title="Chiama il cliente"
                  >
                    <span className="material-symbols-outlined text-base text-white">
                      call
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-black mt-1 pl-2">
            <label
              className={`inline-flex items-center gap-2 ${clienteAttivo ? "text-emerald-950" : "text-red-600"}`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#154212]"
                checked={clienteAttivo}
                onChange={(e) => setClienteAttivo(e.target.checked)}
              />
              <span
                className="rounded-full border px-2 py-1 text-white"
                style={
                  clienteAttivo
                    ? { backgroundColor: "#16a34a", borderColor: "#15803d" }
                    : { backgroundColor: "#dc2626", borderColor: "#b91c1c" }
                }
              >
                {clienteAttivo ? "Contatto Attivo" : "Contatto Non attivo"}
              </span>
            </label>
          </div>

          <div className="min-h-0">
            <div className="flex justify-end pr-2">
              <p className="text-right text-sm italic font-bold text-black">
                Clienti registrati:{" "}
                <span className="font-bold">{clientiList.length}</span>
              </p>
            </div>
            <div
              className="overflow-y-auto rounded-2xl border-2 border-black bg-white p-2 space-y-2 mt-[10px] mb-3"
              style={{ maxHeight: "245px" }}
            >
              {clientiList.length === 0 ? (
                <p className="text-sm text-[#42493e] text-center py-6">
                  Nessun cliente presente.
                </p>
              ) : (
                clientiList.map((cliente) => (
                  <div
                    key={cliente.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectCliente(cliente)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectCliente(cliente);
                      }
                    }}
                    className={`w-full rounded-xl border p-0.5 text-left transition cursor-pointer ${
                      editingClienteId === cliente.id
                        ? "border-emerald-600 bg-emerald-600/20 text-black"
                        : "border-[#c2c9bb] bg-white hover:bg-[#eceeec]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={`text-sm truncate ${
                            cliente.attivo
                              ? editingClienteId === cliente.id
                                ? "text-black"
                                : "text-[#191c1b]"
                              : "text-red-600 line-through decoration-red-500 decoration-2"
                          }`}
                        >
                          {cliente.nome}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirmation(
                            "cliente",
                            cliente.id,
                            cliente.nome
                          );
                        }}
                        aria-label={`Elimina ${cliente.nome}`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {statusMessage && (
            <div
              className={`text-center text-sm font-bold py-2 px-4 rounded-xl ${
                statusType === "success"
                  ? "bg-emerald-100 text-emerald-950 border border-emerald-300"
                  : "bg-red-100 text-red-600 border border-red-300"
              }`}
            >
              {statusMessage}
            </div>
          )}

          <div className="mt-auto bg-transparent pt-3 pb-3">
            <div
              className="flex items-center justify-end gap-12"
              style={{ marginRight: "20px" }}
            >
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleClearClienteForm}
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
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition ${isSaving ? "bg-[#154212]/70 cursor-not-allowed" : "bg-[#154212] hover:bg-[#154212]/90"}`}
                  type="submit"
                  disabled={isSaving}
                  title={isSaving ? "Salvataggio..." : "Salva"}
                >
                  {isSaving ? (
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
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                  type="button"
                  onClick={onClose}
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
        </form>

        {/* Delete Confirmation Dialog */}
        {deleteConfirmation && (
          <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-[#c2c9bb] bg-[#f2f4f2] p-5 shadow-2xl">
              <h3 className="text-sm font-semibold mb-3 text-[#191c1b]">
                Conferma cancellazione
              </h3>
              <p className="text-sm text-[#42493e] mb-6">
                Sei sicuro di voler eliminare il cliente{" "}
                <strong>{deleteConfirmation.label}</strong>? Questa operazione
                non è reversibile.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 h-11 rounded-full bg-[#ba1a1a] text-white font-bold transition hover:bg-[#ba1a1a]/90"
                >
                  Elimina
                </button>
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="flex-1 h-11 rounded-full border border-[#c2c9bb] bg-[#f8faf8] text-[#191c1b] font-bold transition hover:bg-[#eceeec]"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function LocalitaModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [clienti, setClienti] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localita, setLocalita] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [note, setNote] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | null>(
    null
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: "localita";
    id: string;
    label: string;
  } | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const clearStatus = () => {
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      setStatusType(null);
      statusTimeoutRef.current = null;
    }, 2000);
  };

  const fetchData = async () => {
    const { data } = await supabase
      .from("localita")
      .select("*, clienti(nome)")
      .order("localita");
    if (data) setList(data);
    const { data: c } = await supabase
      .from("clienti")
      .select("id, nome")
      .order("nome");
    if (c) setClienti(c);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setLocalita("");
    setDescrizione("");
    setNote("");
    setClienteId("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localita.trim()) {
      setStatusType("error");
      setStatusMessage("Il campo Località è obbligatorio.");
      clearStatus();
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        localita: localita.trim(),
        descrizione: descrizione.trim(),
        note: note.trim(),
        cliente_id: clienteId || null
      };
      if (editingId) {
        const { error } = await supabase
          .from("localita")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("localita").insert(payload);
        if (error) throw error;
      }
      setStatusType("success");
      setStatusMessage(
        editingId ? "Località aggiornata." : "Località salvata."
      );
      resetForm();
      await fetchData();
      clearStatus();
    } catch (err: any) {
      setStatusType("error");
      setStatusMessage(err.message || "Errore");
      clearStatus();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    try {
      await supabase.from("localita").delete().eq("id", id);
      setStatusType("success");
      setStatusMessage("Località eliminata.");
      if (editingId === id) resetForm();
      await fetchData();
      clearStatus();
    } catch (err: any) {
      setStatusType("error");
      setStatusMessage(err.message || "Errore");
      clearStatus();
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteConfirm = (id: string, label: string) => {
    setDeleteConfirmation({ type: "localita", id, label });
  };
  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };
  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id } = deleteConfirmation;
    setDeleteConfirmation(null);
    await handleDelete(id);
  };

  const handleSelect = (item: any) => {
    setEditingId(item.id);
    setLocalita(item.localita);
    setDescrizione(item.descrizione || "");
    setNote(item.note || "");
    setClienteId(item.cliente_id || "");
  };

  return (
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
        <div className="flex items-center justify-center gap-3 mb-3">
          <span
            className="material-symbols-outlined text-3xl text-[#2563eb]"
            data-icon="location_on"
          >
            location_on
          </span>
          <h3 className="text-xl font-semibold text-[#2563eb]">
            {editingId ? "Modifica Località" : "Nuova Località"}
          </h3>
        </div>
        <form
          className="flex flex-col h-full min-h-0 gap-4"
          onSubmit={handleSave}
        >
          <div>
            <label className="pl-2 text-sm font-bold text-black block">
              Località *
            </label>
            <input
              className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              placeholder="Es. Villa Ada"
              type="text"
              value={localita}
              onChange={(e) => setLocalita(e.target.value)}
            />
          </div>
          <div>
            <label className="pl-2 text-sm font-bold text-black block">
              Descrizione
            </label>
            <textarea
              className="w-full min-h-[60px] px-4 py-2 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold resize-none"
              placeholder="Descrizione..."
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
            />
          </div>
          <div>
            <label className="pl-2 text-sm font-bold text-black block">
              Note
            </label>
            <textarea
              className="w-full min-h-[60px] px-4 py-2 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold resize-none"
              placeholder="Note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div>
            <label className="pl-2 text-sm font-bold text-black block">
              Cliente
            </label>
            <select
              className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Nessun cliente</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="min-h-0">
            <div className="flex justify-end pr-2">
              <p className="text-right text-sm italic font-bold text-black">
                Località registrate:{" "}
                <span className="font-bold">{list.length}</span>
              </p>
            </div>
            <div
              className="overflow-y-auto rounded-2xl border-2 border-black bg-white p-2 space-y-2 mt-[10px] mb-3"
              style={{ maxHeight: "245px" }}
            >
              {list.length === 0 ? (
                <p className="text-sm text-[#42493e] text-center py-6">
                  Nessuna località presente.
                </p>
              ) : (
                list.map((item: any) => (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelect(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelect(item);
                      }
                    }}
                    className={`w-full rounded-xl border p-0.5 text-left transition cursor-pointer ${editingId === item.id ? "border-emerald-600 bg-emerald-600/20 text-black" : "border-[#c2c9bb] bg-white hover:bg-[#eceeec]"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate text-[#191c1b]">
                          {item.localita}{" "}
                          {item.clienti ? (
                            <span className="text-[#72796e]">
                              - Cliente: {item.clienti.nome}
                            </span>
                          ) : (
                            ""
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirm(item.id, item.localita);
                        }}
                        aria-label={`Elimina ${item.localita}`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          delete
                        </span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {statusMessage && (
            <div
              className={`text-center text-sm font-bold py-2 px-4 rounded-xl ${statusType === "success" ? "bg-emerald-100 text-emerald-950 border border-emerald-300" : "bg-red-100 text-red-600 border border-red-300"}`}
            >
              {statusMessage}
            </div>
          )}

          <div className="mt-auto bg-transparent pt-3 pb-3">
            <div
              className="flex items-center justify-end gap-12"
              style={{ marginRight: "20px" }}
            >
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={resetForm}
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
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition ${isSaving ? "bg-[#154212]/70 cursor-not-allowed" : "bg-[#154212] hover:bg-[#154212]/90"}`}
                  type="submit"
                  disabled={isSaving}
                  title={isSaving ? "Salvataggio..." : "Salva"}
                >
                  {isSaving ? (
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
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                  type="button"
                  onClick={onClose}
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
        </form>

        {deleteConfirmation && (
          <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-[#c2c9bb] bg-[#f2f4f2] p-5 shadow-2xl">
              <h3 className="text-sm font-semibold mb-3 text-[#191c1b]">
                Conferma cancellazione
              </h3>
              <p className="text-sm text-[#42493e] mb-6">
                Sei sicuro di voler eliminare la località{" "}
                <strong>{deleteConfirmation.label}</strong>? Questa operazione
                non è reversibile.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 h-11 rounded-full bg-[#ba1a1a] text-white font-bold transition hover:bg-[#ba1a1a]/90"
                >
                  Elimina
                </button>
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="flex-1 h-11 rounded-full border border-[#c2c9bb] bg-[#f8faf8] text-[#191c1b] font-bold transition hover:bg-[#eceeec]"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function AttivitaModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [categorie, setCategorie] = useState<any[]>([]);
  const [descrizioni, setDescrizioni] = useState<string[]>([]);
  const [categoriaNome, setCategoriaNome] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [nota, setNota] = useState("");
  const [showCatDropdown, setShowCatDropdown] = useState(false);
  const [showDescDropdown, setShowDescDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | null>(
    null
  );
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: "attivita";
    id: string;
    label: string;
  } | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const clearStatus = () => {
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      setStatusType(null);
      statusTimeoutRef.current = null;
    }, 2000);
  };

  const fetchData = async () => {
    const { data: a } = await supabase
      .from("attivita")
      .select("*, categorie(nome)")
      .order("categorie(nome)")
      .order("descrizione");
    if (a) {
      setList(a);
      setDescrizioni([
        ...new Set(a.map((x: any) => x.descrizione).filter(Boolean))
      ]);
    }
    const { data: c } = await supabase
      .from("categorie")
      .select("*")
      .order("nome");
    if (c) setCategorie(c);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setCategoriaNome("");
    setDescrizione("");
    setNota("");
  };

  const filteredCategorie = categorie.filter((c) =>
    c.nome.toLowerCase().includes(categoriaNome.toLowerCase())
  );
  const filteredDescrizioni = descrizioni.filter((d) =>
    d.toLowerCase().includes(descrizione.toLowerCase())
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoriaNome.trim() || !descrizione.trim()) {
      setStatusType("error");
      setStatusMessage("Categoria e Descrizione sono obbligatorie.");
      clearStatus();
      return;
    }
    setIsSaving(true);
    try {
      // Trova o crea categoria
      let catId = categorie.find(
        (c) => c.nome.toLowerCase() === categoriaNome.trim().toLowerCase()
      )?.id;
      if (!catId) {
        const { data: newCat, error: catErr } = await supabase
          .from("categorie")
          .insert({ nome: categoriaNome.trim() })
          .select("id")
          .single();
        if (catErr) throw catErr;
        catId = newCat.id;
      }

      const nomeCat = categoriaNome.trim();
      const descTrim = descrizione.trim();
      const notaTrim = nota.trim() || null;

      // Cerca se esiste già attività con stessa categoria+descrizione
      const esistente = list.find(
        (x: any) =>
          (x.categorie?.nome?.toLowerCase() === nomeCat.toLowerCase() ||
            x.categoria_id === catId) &&
          x.descrizione.toLowerCase() === descTrim.toLowerCase()
      );

      if (esistente) {
        // Aggiorna solo la nota se cambiata
        if (esistente.nota !== notaTrim) {
          const { error } = await supabase
            .from("attivita")
            .update({ nota: notaTrim })
            .eq("id", esistente.id);
          if (error) throw error;
          setStatusType("success");
          setStatusMessage("Nota aggiornata.");
        } else {
          setStatusType("success");
          setStatusMessage("Attività già esistente, nessuna modifica.");
        }
      } else {
        const { error } = await supabase
          .from("attivita")
          .insert({
            categoria_id: catId,
            descrizione: descTrim,
            nota: notaTrim
          });
        if (error) throw error;
        setStatusType("success");
        setStatusMessage("Attività salvata.");
      }
      resetForm();
      await fetchData();
      clearStatus();
    } catch (err: any) {
      setStatusType("error");
      setStatusMessage(err.message || "Errore");
      clearStatus();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    try {
      await supabase.from("attivita").delete().eq("id", id);
      setStatusType("success");
      setStatusMessage("Attività eliminata.");
      await fetchData();
      clearStatus();
    } catch (err: any) {
      setStatusType("error");
      setStatusMessage(err.message || "Errore");
      clearStatus();
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteConfirm = (id: string, label: string) => {
    setDeleteConfirmation({ type: "attivita", id, label });
  };
  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };
  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id } = deleteConfirmation;
    setDeleteConfirmation(null);
    await handleDelete(id);
  };

  const handleSelectItem = (item: any) => {
    setCategoriaNome(item.categorie?.nome || "");
    setDescrizione(item.descrizione || "");
    setNota(item.nota || "");
  };

  return (
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
        <div className="flex items-center justify-center gap-3 mb-3">
          <span
            className="material-symbols-outlined text-3xl text-[#2563eb]"
            data-icon="assignment_turned_in"
          >
            assignment_turned_in
          </span>
          <h3 className="text-xl font-semibold text-[#2563eb]">
            Anagrafica Attività
          </h3>
        </div>
        <form
          className="flex flex-col h-full min-h-0 gap-4"
          onSubmit={handleSave}
        >
          {/* Categoria - combobox */}
          <div className="relative">
            <label className="pl-2 text-sm font-bold text-black block">
              Categoria *
            </label>
            <input
              className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              placeholder="Digita o seleziona categoria..."
              type="text"
              value={categoriaNome}
              onChange={(e) => {
                setCategoriaNome(e.target.value);
                setShowCatDropdown(true);
              }}
              onFocus={() => setShowCatDropdown(true)}
              onBlur={() => setTimeout(() => setShowCatDropdown(false), 200)}
              autoComplete="off"
            />
            {showCatDropdown && filteredCategorie.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-lg border border-[#c2c9bb] bg-white shadow-lg max-h-40 overflow-y-auto">
                {filteredCategorie.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-black font-bold hover:bg-[#eceeec] transition"
                    onMouseDown={() => {
                      setCategoriaNome(c.nome);
                      setShowCatDropdown(false);
                    }}
                  >
                    {c.nome}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Descrizione - combobox */}
          <div className="relative">
            <label className="pl-2 text-sm font-bold text-black block">
              Descrizione *
            </label>
            <input
              className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              placeholder="Digita o seleziona descrizione..."
              type="text"
              value={descrizione}
              onChange={(e) => {
                setDescrizione(e.target.value);
                setShowDescDropdown(true);
              }}
              onFocus={() => setShowDescDropdown(true)}
              onBlur={() => setTimeout(() => setShowDescDropdown(false), 200)}
              autoComplete="off"
            />
            {showDescDropdown && filteredDescrizioni.length > 0 && (
              <div className="absolute z-10 w-full mt-1 rounded-lg border border-[#c2c9bb] bg-white shadow-lg max-h-40 overflow-y-auto">
                {filteredDescrizioni.map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-4 py-2 text-sm text-black font-bold hover:bg-[#eceeec] transition"
                    onMouseDown={() => {
                      setDescrizione(d);
                      setShowDescDropdown(false);
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Nota */}
          <div>
            <label className="pl-2 text-sm font-bold text-black block">
              Note
            </label>
            <textarea
              className="w-full min-h-[60px] px-4 py-2 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold resize-none"
              placeholder="Note opzionali..."
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>

          {/* Lista TUTTE le attività da Supabase - stile tabella */}
          <div className="min-h-0">
            <p className="text-left text-sm italic font-bold text-black mb-2">
              Attività presenti:{" "}
              <span className="font-bold">{list.length}</span>
            </p>
            <div className="border rounded-lg border-[#e2e8f0] overflow-hidden">
              <div className="overflow-y-auto" style={{ maxHeight: "400px" }}>
                <table
                  className="w-full text-sm"
                  style={{ borderCollapse: "collapse" }}
                >
                  <thead className="sticky top-0 bg-white z-10">
                    <tr className="border-b border-[#e2e8f0]">
                      <th className="text-left font-bold text-[#334155] py-2 px-3 w-[25%] border-r border-[#e2e8f0]">
                        CATEGORIA
                      </th>
                      <th className="text-left font-bold text-[#334155] py-2 px-3 w-[35%] border-r border-[#e2e8f0]">
                        DESCRIZIONE
                      </th>
                      <th className="text-left font-bold text-[#334155] py-2 px-3 w-[40%]">
                        NOTA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className="text-center text-[#475569] py-6"
                        >
                          Nessuna attività presente.
                        </td>
                      </tr>
                    ) : (
                      list.map((item: any, idx: number) => (
                        <tr
                          key={item.id}
                          className={`border-b border-[#e2e8f0] hover:bg-[#f1f5f9] transition cursor-pointer ${idx % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"}`}
                          onClick={() => handleSelectItem(item)}
                        >
                          <td className="py-2 px-3 font-bold text-[#1e293b] border-r border-[#e2e8f0]">
                            {item.categorie?.nome}
                          </td>
                          <td className="py-2 px-3 text-[#1e293b] border-r border-[#e2e8f0]">
                            {item.descrizione}
                          </td>
                          <td className="py-2 px-3 text-[#475569]">
                            {item.nota || ""}
                          </td>
                          <td className="py-2 px-1 w-10 border-l border-[#e2e8f0]">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#334155] hover:bg-[#e2e8f0] transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectItem(item);
                              }}
                              title="Modifica"
                            >
                              <span className="material-symbols-outlined text-lg">
                                edit
                              </span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`text-center text-sm font-bold py-2 px-4 rounded-xl ${statusType === "success" ? "bg-emerald-100 text-emerald-950 border border-emerald-300" : "bg-red-100 text-red-600 border border-red-300"}`}
            >
              {statusMessage}
            </div>
          )}

          <div className="mt-auto bg-transparent pt-3 pb-3">
            <div
              className="flex items-center justify-end gap-12"
              style={{ marginRight: "20px" }}
            >
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={resetForm}
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
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition ${isSaving ? "bg-[#154212]/70 cursor-not-allowed" : "bg-[#154212] hover:bg-[#154212]/90"}`}
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? (
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
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                  type="button"
                  onClick={onClose}
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
        </form>

        {deleteConfirmation && (
          <div className="fixed inset-0 z-[10000] grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-[#c2c9bb] bg-[#f2f4f2] p-5 shadow-2xl">
              <h3 className="text-sm font-semibold mb-3 text-[#191c1b]">
                Conferma cancellazione
              </h3>
              <p className="text-sm text-[#42493e] mb-6">
                Sei sicuro di voler eliminare l'attività{" "}
                <strong>{deleteConfirmation.label}</strong>? Questa operazione
                non è reversibile.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 h-11 rounded-full bg-[#ba1a1a] text-white font-bold transition hover:bg-[#ba1a1a]/90"
                >
                  Elimina
                </button>
                <button
                  type="button"
                  onClick={cancelDelete}
                  className="flex-1 h-11 rounded-full border border-[#c2c9bb] bg-[#f8faf8] text-[#191c1b] font-bold transition hover:bg-[#eceeec]"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function InserisciModal({
  onClose,
  editData
}: {
  onClose: () => void;
  editData?: any;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [dataInizio, setDataInizio] = useState(today);
  const [dataInizioEdited, setDataInizioEdited] = useState(false);
  const [dataFine, setDataFine] = useState(today);
  const [dataFineEdited, setDataFineEdited] = useState(false);
  const [localitaId, setLocalitaId] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [attivitaId, setAttivitaId] = useState("");
  const [note, setNote] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [nuoveFoto, setNuoveFoto] = useState<File[]>([]);
  const [fotoEsistenti, setFotoEsistenti] = useState<any[]>([]);
  const [visibile, setVisibile] = useState(false);
  const [aggiungiPlanning, setAggiungiPlanning] = useState(false);
  const [localitaList, setLocalitaList] = useState<any[]>([]);
  const [categorieList, setCategorieList] = useState<any[]>([]);
  const [attivitaList, setAttivitaList] = useState<any[]>([]);
  const [clientiList, setClientiList] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<"success" | "error" | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const clearStatus = () => {
    if (statusTimeoutRef.current) window.clearTimeout(statusTimeoutRef.current);
    statusTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage(null);
      setStatusType(null);
      statusTimeoutRef.current = null;
    }, 2000);
  };

  const fetchAll = async () => {
    const [loc, cat, att, cli] = await Promise.all([
      supabase.from("localita").select("id, localita").order("localita"),
      supabase.from("categorie").select("*").order("nome"),
      supabase
        .from("attivita")
        .select("*, categorie(nome)")
        .order("descrizione"),
      supabase.from("clienti").select("id, nome").order("nome")
    ]);
    if (loc.data) setLocalitaList(loc.data);
    if (cat.data) setCategorieList(cat.data);
    if (att.data) setAttivitaList(att.data);
    if (cli.data) setClientiList(cli.data);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Pre-fill form when in edit mode
  useEffect(() => {
    if (editData) {
      setDataInizio(editData.data_inizio || today);
      setDataInizioEdited(true);
      setDataFine(editData.data_fine || today);
      setDataFineEdited(true);
      setLocalitaId(editData.localita_id || "");
      setAttivitaId(editData.attivita_id || "");
      setNote(editData.note || "");
      setClienteId(editData.cliente_id || "");
      setVisibile(!!editData.visibile);
      setAggiungiPlanning(!!editData.aggiungi_al_planning);
      // Carica categoria dall'attività
      if (editData.attivita?.categorie?.id) {
        setCategoriaId(editData.attivita.categorie.id);
      } else if (editData.attivita?.categoria_id) {
        setCategoriaId(editData.attivita.categoria_id);
      }
      // Carica foto esistenti
      if (editData.id) {
        supabase
          .from("foto_attivita")
          .select("*")
          .eq("attivita_id", editData.id)
          .then(({ data }) => {
            if (data) setFotoEsistenti(data);
          });
      }
    }
  }, [editData]);

  const filteredAttivita = attivitaList.filter(
    (a: any) => !categoriaId || a.categoria_id === categoriaId
  );

  const resetForm = () => {
    setDataInizio(today);
    setDataInizioEdited(false);
    setDataFine(today);
    setDataFineEdited(false);
    setLocalitaId("");
    setCategoriaId("");
    setAttivitaId("");
    setNote("");
    setClienteId("");
    setNuoveFoto([]);
    setFotoEsistenti([]);
    setVisibile(false);
    setAggiungiPlanning(false);
  };

  const uploadFoto = async (
    file: File,
    attivitaId: string
  ): Promise<string> => {
    const ext = file.name.split(".").pop();
    const fileName = `${attivitaId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("foto")
      .upload(fileName, file, { cacheControl: "3600", upsert: false });
    if (uploadError) throw uploadError;
    const { data: urlData } = supabase.storage
      .from("foto")
      .getPublicUrl(fileName);
    return urlData?.publicUrl || "";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localitaId || !attivitaId) {
      setStatusType("error");
      setStatusMessage("Località e Attività sono obbligatorie.");
      clearStatus();
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        data_inizio: dataInizio || null,
        data_fine: dataFine || null,
        localita_id: localitaId,
        attivita_id: attivitaId,
        note: note.trim() || null,
        cliente_id: clienteId || null,
        visibile,
        aggiungi_al_planning: aggiungiPlanning
      };

      let recordId: string;
      if (editData?.id) {
        // EDIT MODE: aggiorna record esistente
        const { error } = await supabase
          .from("inserimenti_attivita")
          .update(payload)
          .eq("id", editData.id);
        if (error) throw error;
        recordId = editData.id;
      } else {
        // INSERT MODE: nuovo record
        const { data: inserted, error } = await supabase
          .from("inserimenti_attivita")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        recordId = inserted.id;
      }

      // Upload nuove foto
      for (const file of nuoveFoto) {
        const fotoUrl = await uploadFoto(file, recordId);
        await supabase
          .from("foto_attivita")
          .insert({ attivita_id: recordId, foto_url: fotoUrl });
      }

      if (!editData && aggiungiPlanning) {
        const att = attivitaList.find((a: any) => a.id === attivitaId);
        const loc = localitaList.find((l: any) => l.id === localitaId);
        await supabase.from("appuntamenti").insert({
          data: dataInizio || today,
          end_date: dataFine || null,
          start_time: "08:00",
          end_time: "17:00",
          cliente_id: clienteId || null,
          note: note.trim() || null,
          location: loc?.localita || null,
          attivita: att?.descrizione || null
        });
      }

      setStatusType("success");
      setStatusMessage(
        editData?.id
          ? "Attività aggiornata con successo."
          : "Attività inserita con successo."
      );
      resetForm();
      clearStatus();
    } catch (err: any) {
      setStatusType("error");
      setStatusMessage(err.message || "Errore durante il salvataggio.");
      clearStatus();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFoto = async (fotoId: string, fotoUrl: string) => {
    try {
      const path = fotoUrl.split("/foto/").pop();
      if (path) await supabase.storage.from("foto").remove([path]);
      await supabase.from("foto_attivita").delete().eq("id", fotoId);
      setFotoEsistenti((prev) => prev.filter((f) => f.id !== fotoId));
    } catch (err) {
      console.error("Errore eliminazione foto", err);
    }
  };

  return (
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
        <div className="flex items-center justify-center gap-3 mb-3">
          <span
            className="material-symbols-outlined text-3xl text-[#2563eb]"
            data-icon="playlist_add"
          >
            playlist_add
          </span>
          <h3 className="text-xl font-semibold text-[#2563eb]">
            {editData?.id ? "Modifica Attività" : "Inserimento Attività"}
          </h3>
        </div>
        <form
          className="flex flex-col h-full min-h-0 gap-4"
          onSubmit={handleSave}
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
                value={dataInizio}
                onFocus={() => setDataInizioEdited(true)}
                onChange={(e) => setDataInizio(e.target.value)}
                style={{ color: dataInizioEdited ? "black" : "#9ca3af" }}
              />
            </div>
            <div>
              <label className="pl-2 text-sm font-bold text-black block">
                Data fine
              </label>
              <input
                type="date"
                className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold"
                value={dataFine}
                onFocus={() => setDataFineEdited(true)}
                onChange={(e) => setDataFine(e.target.value)}
                style={{ color: dataFineEdited ? "black" : "#9ca3af" }}
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
              value={localitaId}
              onChange={(e) => setLocalitaId(e.target.value)}
              style={{ color: localitaId ? "black" : "#9ca3af" }}
            >
              <option value="" className="text-[#9ca3af]">
                Seleziona località...
              </option>
              {localitaList.map((l) => (
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
                value={categoriaId}
                onChange={(e) => {
                  setCategoriaId(e.target.value);
                  setAttivitaId("");
                }}
                style={{ color: categoriaId ? "black" : "#9ca3af" }}
              >
                <option value="" className="text-[#9ca3af]">
                  Seleziona Soggetto
                </option>
                {categorieList.map((c) => (
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
                value={attivitaId}
                onChange={(e) => setAttivitaId(e.target.value)}
                style={{ color: attivitaId ? "black" : "#9ca3af" }}
              >
                <option value="" className="text-[#9ca3af]">
                  Seleziona Azione...
                </option>
                {filteredAttivita.map((a: any) => (
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
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* Cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="pl-2 text-sm font-bold text-black block">
                Contatto
              </label>
              <select
                className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                style={{ color: clienteId ? "black" : "#9ca3af" }}
              >
                <option value="" className="text-[#9ca3af]">
                  Seleziona contatto
                </option>
                {clientiList.map((c) => (
                  <option key={c.id} value={c.id} className="text-black">
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Griglia foto 4x2 */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  const total = nuoveFoto.length + e.target.files.length;
                  if (total > 8) {
                    setStatusType("error");
                    setStatusMessage("Massimo 8 foto.");
                    clearStatus();
                    return;
                  }
                  setNuoveFoto((prev) => [
                    ...prev,
                    ...Array.from(e.target.files!)
                  ]);
                }
              }}
            />
            <div
              className="grid justify-center gap-3 w-full p-2 bg-transparent border border-white"
              style={{ gridTemplateColumns: "repeat(4, 60px)" }}
            >
              {Array.from({ length: 8 }).map((_, idx) => {
                const fotoExistente = fotoEsistenti[idx];
                const nuovaFoto = !fotoExistente
                  ? nuoveFoto[idx - fotoEsistenti.length]
                  : null;
                const hasPhoto = !!fotoExistente || !!nuovaFoto;
                const isLast = idx === 7;
                const showPlus =
                  isLast && nuoveFoto.length + fotoEsistenti.length < 8;
                return (
                  <div
                    key={idx}
                    className="relative group cursor-pointer border border-[#e5e7eb] flex items-center justify-center overflow-hidden"
                    style={{
                      width: "60px",
                      height: "60px",
                      backgroundColor: hasPhoto ? "transparent" : "#f9fafb"
                    }}
                    onClick={() => fileInputRef.current?.click()}
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
                              handleDeleteFoto(
                                fotoExistente.id,
                                fotoExistente.foto_url
                              );
                            else
                              setNuoveFoto((prev) =>
                                prev.filter(
                                  (_, i) => i !== idx - fotoEsistenti.length
                                )
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
                checked={visibile}
                onChange={(e) => setVisibile(e.target.checked)}
              />
              Foto visibile al cliente
            </label>
            <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#154212]"
                checked={aggiungiPlanning}
                onChange={(e) => setAggiungiPlanning(e.target.checked)}
              />
              Aggiungi al planning
            </label>
          </div>

          {statusMessage && (
            <div
              className={`text-center text-sm font-bold py-2 px-4 rounded-xl ${statusType === "success" ? "bg-emerald-100 text-emerald-950 border border-emerald-300" : "bg-red-100 text-red-600 border border-red-300"}`}
            >
              {statusMessage}
            </div>
          )}

          <div className="mt-auto bg-transparent pt-3 pb-3">
            <div
              className="flex items-center justify-end gap-12"
              style={{ marginRight: "20px" }}
            >
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={resetForm}
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
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-white transition ${isSaving ? "bg-[#154212]/70 cursor-not-allowed" : "bg-[#154212] hover:bg-[#154212]/90"}`}
                  type="submit"
                  disabled={isSaving}
                >
                  {isSaving ? (
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
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                  type="button"
                  onClick={onClose}
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
        </form>
      </section>
    </div>
  );
}

function ReportModal({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroLocalita, setFiltroLocalita] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroDataDa, setFiltroDataDa] = useState("");
  const [filtroDataA, setFiltroDataA] = useState("");
  const [filtroTesto, setFiltroTesto] = useState("");
  const [categorieList, setCategorieList] = useState<any[]>([]);
  const [localitaList, setLocalitaList] = useState<any[]>([]);
  const [clientiList, setClientiList] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [ricercaAvanzata, setRicercaAvanzata] = useState("");
  const [showAvanzata, setShowAvanzata] = useState(false);

  const mesi: Record<string, number> = {
    gennaio: 0,
    febbraio: 1,
    marzo: 2,
    aprile: 3,
    maggio: 4,
    giugno: 5,
    luglio: 6,
    agosto: 7,
    settembre: 8,
    ottobre: 9,
    novembre: 10,
    dicembre: 11
  };

  const parseAdvancedSearch = (text: string) => {
    let catId = "",
      locId = "",
      cliId = "",
      dataDa = "",
      dataA = "",
      testoResiduo = text;
    const t = text.toLowerCase();

    // Cerca nome categoria
    for (const c of categorieList) {
      const idx = t.indexOf(c.nome.toLowerCase());
      if (idx !== -1) {
        catId = c.id;
        testoResiduo =
          testoResiduo.slice(0, idx) + testoResiduo.slice(idx + c.nome.length);
        break;
      }
    }
    // Cerca località
    for (const l of localitaList) {
      const idx = t.indexOf(l.localita.toLowerCase());
      if (idx !== -1) {
        locId = l.id;
        testoResiduo =
          testoResiduo.slice(0, idx) +
          testoResiduo.slice(idx + l.localita.length);
        break;
      }
    }
    // Cerca cliente
    for (const cl of clientiList) {
      const idx = t.indexOf(cl.nome.toLowerCase());
      if (idx !== -1) {
        cliId = cl.id;
        testoResiduo =
          testoResiduo.slice(0, idx) + testoResiduo.slice(idx + cl.nome.length);
        break;
      }
    }
    // Cerca tutti i mesi (es. "aprile e maggio" o "maggio 2026")
    // Rimuove prima le parole "e", "di", ",", "del" per uniformare
    const meseRegex =
      /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/gi;
    let dateMin = "",
      dateMax = "";
    const allMonths = [...t.matchAll(meseRegex)];
    for (const match of allMonths) {
      const mese = mesi[match[1].toLowerCase()];
      const anno = new Date().getFullYear();
      const mDa = `${anno}-${String(mese + 1).padStart(2, "0")}-01`;
      const lastDay = new Date(anno, mese + 1, 0).getDate();
      const mA = `${anno}-${String(mese + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      if (!dateMin || mDa < dateMin) dateMin = mDa;
      if (!dateMax || mA > dateMax) dateMax = mA;
      // Rimuovi dal testo residuo (con o senza virgole/punteggiatura)
      testoResiduo = testoResiduo.replace(new RegExp(match[1], "i"), "");
    }
    if (dateMin) dataDa = dateMin;
    if (dateMax) dataA = dateMax;
    return {
      catId,
      locId,
      cliId,
      dataDa,
      dataA,
      testoResiduo: testoResiduo.trim()
    };
  };

  useEffect(() => {
    supabase
      .from("categorie")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => data && setCategorieList(data));
    supabase
      .from("localita")
      .select("id, localita")
      .order("localita")
      .then(({ data }) => data && setLocalitaList(data));
    supabase
      .from("clienti")
      .select("id, nome")
      .order("nome")
      .then(({ data }) => data && setClientiList(data));
  }, []);

  const hasFilters =
    filtroCategoria ||
    filtroLocalita ||
    filtroCliente ||
    filtroDataDa ||
    filtroDataA ||
    filtroTesto.trim();

  const handleSearch = async () => {
    if (!hasFilters && !ricercaAvanzata.trim()) return;
    setLoading(true);
    setSelectedItem(null);

    let advCat = filtroCategoria,
      advLoc = filtroLocalita,
      advCli = filtroCliente,
      advDa = filtroDataDa,
      advA = filtroDataA;
    let testoQuery = filtroTesto;

    if (ricercaAvanzata.trim()) {
      const parsed = parseAdvancedSearch(ricercaAvanzata);
      if (parsed.catId && !advCat) advCat = parsed.catId;
      if (parsed.locId && !advLoc) advLoc = parsed.locId;
      if (parsed.cliId && !advCli) advCli = parsed.cliId;
      if (parsed.dataDa && !advDa) advDa = parsed.dataDa;
      if (parsed.dataA && !advA) advA = parsed.dataA;
      if (parsed.testoResiduo)
        testoQuery = (testoQuery ? testoQuery + " " : "") + parsed.testoResiduo;
    }
    setHasSearched(true);
    try {
      let query = supabase
        .from("inserimenti_attivita")
        .select(
          "*, localita!left(localita), attivita!left(descrizione, categorie!left(nome)), clienti!left(nome)"
        )
        .order("data_inizio", { ascending: false });

      // Filtro categoria: cerca attivita con quella categoria
      if (advCat) {
        const { data: attIds } = await supabase
          .from("attivita")
          .select("id")
          .eq("categoria_id", advCat);
        if (attIds?.length)
          query = query.in(
            "attivita_id",
            attIds.map((a) => a.id)
          );
        else if (!testoQuery.trim()) {
          setResults([]);
          setLoading(false);
          return;
        }
      }
      if (advLoc) query = query.eq("localita_id", advLoc);
      if (advCli) query = query.eq("cliente_id", advCli);
      if (advDa) query = query.gte("data_inizio", advDa);
      if (advA) query = query.lte("data_inizio", advA);

      // Ricerca testo: solo per filtro manuale, non per residuo della ricerca avanzata
      if (testoQuery.trim() && !ricercaAvanzata.trim()) {
        const parole = testoQuery
          .trim()
          .split(/\s+/)
          .filter((w: string) => w.length > 3);
        if (parole.length > 0) {
          const orNote = parole
            .map((p: string) => `note.ilike.%${p}%`)
            .join(",");
          query = query.or(orNote);
        }
      }

      const { data } = await query.limit(200);
      if (data) setResults(data);
      else setResults([]);
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setFiltroCategoria("");
    setFiltroLocalita("");
    setFiltroCliente("");
    setFiltroDataDa("");
    setFiltroDataA("");
    setFiltroTesto("");
    setResults([]);
    setHasSearched(false);
    setSelectedItem(null);
    setRicercaAvanzata("");
    setShowAvanzata(false);
  };

  const isOnlyDateFilter =
    (filtroDataDa || filtroDataA) &&
    !filtroCategoria &&
    !filtroLocalita &&
    !filtroCliente &&
    !filtroTesto.trim();
  const columns: string[] = ["DATA"];
  if (isOnlyDateFilter || filtroCategoria) columns.push("CATEGORIA");
  if (filtroLocalita) columns.push("LOCALITÀ");
  if (filtroCliente) columns.push("CLIENTE");
  columns.push("NOTE");

  const openDetail = async (item: any) => {
    const { data: foto } = await supabase
      .from("foto_attivita")
      .select("*")
      .eq("attivita_id", item.id);
    setSelectedItem({ ...item, foto: foto || [] });
  };

  return (
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
        <div className="flex items-center justify-center gap-3 mb-3">
          <span
            className="material-symbols-outlined text-3xl text-[#2563eb]"
            data-icon="query_stats"
          >
            query_stats
          </span>
          <h3 className="text-xl font-semibold text-[#2563eb]">
            Report Attività
          </h3>
        </div>

        {/* Filtri */}
        <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-[#f2f4f2] rounded-xl items-start">
          <select
            className="w-full h-10 px-3 rounded-lg border border-[#c2c9bb] bg-white text-xs font-bold"
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            style={{ color: filtroCategoria ? "black" : "#9ca3af" }}
          >
            <option value="" className="text-[#9ca3af]">
              Categoria
            </option>
            {categorieList.map((c) => (
              <option key={c.id} value={c.id} className="text-black">
                {c.nome}
              </option>
            ))}
          </select>
          <select
            className="w-full h-10 px-3 rounded-lg border border-[#c2c9bb] bg-white text-xs font-bold"
            value={filtroLocalita}
            onChange={(e) => setFiltroLocalita(e.target.value)}
            style={{ color: filtroLocalita ? "black" : "#9ca3af" }}
          >
            <option value="" className="text-[#9ca3af]">
              Località
            </option>
            {localitaList.map((l) => (
              <option key={l.id} value={l.id} className="text-black">
                {l.localita}
              </option>
            ))}
          </select>
          <select
            className="w-full h-10 px-3 rounded-lg border border-[#c2c9bb] bg-white text-xs font-bold"
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            style={{ color: filtroCliente ? "black" : "#9ca3af" }}
          >
            <option value="" className="text-[#9ca3af]">
              Cliente
            </option>
            {clientiList.map((c) => (
              <option key={c.id} value={c.id} className="text-black">
                {c.nome}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Cerca testo..."
            className="w-full h-10 px-3 rounded-lg border border-[#c2c9bb] bg-white text-xs font-bold placeholder:text-[#9ca3af]"
            value={filtroTesto}
            onChange={(e) => setFiltroTesto(e.target.value)}
          />
          <div>
            <p className="text-[10px] font-bold text-[#6b7280] mb-1">Da</p>
            <input
              type="date"
              className="w-full h-10 px-3 rounded-lg border border-[#c2c9bb] bg-white text-xs font-bold"
              value={filtroDataDa}
              onChange={(e) => setFiltroDataDa(e.target.value)}
              style={{ color: filtroDataDa ? "black" : "#9ca3af" }}
            />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[#6b7280] mb-1">A</p>
            <input
              type="date"
              className="w-full h-10 px-3 rounded-lg border border-[#c2c9bb] bg-white text-xs font-bold"
              value={filtroDataA}
              onChange={(e) => setFiltroDataA(e.target.value)}
              style={{ color: filtroDataA ? "black" : "#9ca3af" }}
            />
          </div>
          <button
            onClick={handleSearch}
            className="h-10 rounded-lg bg-[#154212] text-white text-xs font-bold hover:bg-[#154212]/90 transition"
          >
            Cerca
          </button>
          <button
            onClick={resetFilters}
            className="h-10 rounded-lg border border-[#c2c9bb] bg-white text-xs font-bold text-black hover:bg-[#eceeec] transition"
          >
            Pulisci
          </button>
        </div>

        {/* Ricerca avanzata */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowAvanzata(!showAvanzata)}
            className="text-xs font-bold text-[#2563eb] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-base">
              {showAvanzata ? "expand_less" : "expand_more"}
            </span>
            Ricerca avanzata
          </button>
          {showAvanzata && (
            <textarea
              className="w-full mt-2 p-3 rounded-lg border border-[#c2c9bb] bg-white text-xs font-bold resize-none placeholder:text-[#9ca3af]"
              rows={3}
              placeholder='Scrivi una frase: es. "ROSE, Villa Cristina, maggio 2026" - il sistema analizza automaticamente categoria, località, cliente e date.'
              value={ricercaAvanzata}
              onChange={(e) => setRicercaAvanzata(e.target.value)}
            />
          )}
        </div>

        {/* Risultati */}
        {loading ? (
          <div className="text-center py-8 text-[#72796e]">Caricamento...</div>
        ) : !hasSearched ? (
          <div className="text-center py-8 text-white font-bold">
            Usa i filtri per affinare la ricerca
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-8 text-[#72796e]">
            Nessun risultato trovato
          </div>
        ) : (
          <div
            className="border border-[#d1d5db] overflow-y-auto bg-transparent"
            style={{ maxHeight: "400px" }}
          >
            <table
              className="w-full text-sm"
              style={{ borderCollapse: "collapse" }}
            >
              <thead className="sticky top-0 bg-white z-10">
                <tr className="border-b border-[#e2e8f0]">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="text-left font-bold text-[#334155] py-2 px-3 border-r border-[#e2e8f0] last:border-r-0"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r: any, idx: number) => (
                  <tr
                    key={r.id}
                    className={`border-b border-[#e2e8f0] hover:bg-[#f1f5f9] transition cursor-pointer ${idx % 2 === 1 ? "bg-[#f8fafc]" : "bg-white"}`}
                    onClick={() => openDetail(r)}
                  >
                    <td className="py-2 px-3 text-[#1e293b] border-r border-[#e2e8f0] whitespace-nowrap">
                      {new Date(r.data_inizio).toLocaleDateString("it-IT")}
                    </td>
                    {(isOnlyDateFilter || filtroCategoria) && (
                      <td className="py-2 px-3 text-[#1e293b] border-r border-[#e2e8f0]">
                        {r.attivita?.categorie?.nome || ""}
                      </td>
                    )}
                    {filtroLocalita && (
                      <td className="py-2 px-3 text-[#1e293b] border-r border-[#e2e8f0]">
                        {r.localita?.localita || ""}
                      </td>
                    )}
                    {filtroCliente && (
                      <td className="py-2 px-3 text-[#1e293b] border-r border-[#e2e8f0]">
                        {r.clienti?.nome || ""}
                      </td>
                    )}
                    <td className="py-2 px-3 text-[#475569] max-w-[200px] truncate">
                      {r.note || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottone chiudi */}
        <div className="flex justify-end mt-4 pr-2">
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
              title="Chiudi"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
            <span className="mt-1 text-[0.65rem] font-semibold text-white">
              Chiudi
            </span>
          </div>
        </div>
      </section>

      {/* Modale dettaglio */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-2xl p-5 shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center items-center mb-4 gap-3">
              <h3 className="text-lg font-bold text-[#154212]">
                Dettaglio Attività
              </h3>
            </div>
            <div className="absolute top-3 right-3 flex flex-col items-center">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white transition hover:bg-red-700"
                title="Chiudi"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
              <span className="mt-1 text-[0.65rem] font-semibold text-white">
                Chiudi
              </span>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-bold text-[#334155]">Data:</span>{" "}
                <span className="text-[#1e293b]">
                  {new Date(selectedItem.data_inizio).toLocaleDateString(
                    "it-IT"
                  )}
                </span>
              </div>
              {selectedItem.data_fine && (
                <div>
                  <span className="font-bold text-[#334155]">Data fine:</span>{" "}
                  <span className="text-[#1e293b]">
                    {new Date(selectedItem.data_fine).toLocaleDateString(
                      "it-IT"
                    )}
                  </span>
                </div>
              )}
              <div>
                <span className="font-bold text-[#334155]">Località:</span>{" "}
                <span className="text-[#1e293b]">
                  {selectedItem.localita?.localita || "—"}
                </span>
              </div>
              <div>
                <span className="font-bold text-[#334155]">Categoria:</span>{" "}
                <span className="text-[#1e293b]">
                  {selectedItem.attivita?.categorie?.nome || "—"}
                </span>
              </div>
              <div>
                <span className="font-bold text-[#334155]">Descrizione:</span>{" "}
                <span className="text-[#1e293b]">
                  {selectedItem.attivita?.descrizione || "—"}
                </span>
              </div>
              {selectedItem.clienti && (
                <div>
                  <span className="font-bold text-[#334155]">Cliente:</span>{" "}
                  <span className="text-[#1e293b]">
                    {selectedItem.clienti.nome}
                  </span>
                </div>
              )}
              <div>
                <span className="font-bold text-[#334155]">Note:</span>{" "}
                <span className="text-[#1e293b]">
                  {selectedItem.note || "—"}
                </span>
              </div>
              <div>
                <span className="font-bold text-[#334155]">
                  Visibile al cliente:
                </span>{" "}
                <span
                  className={
                    selectedItem.visibile
                      ? "text-green-600 font-bold"
                      : "text-[#475569]"
                  }
                >
                  {selectedItem.visibile ? "Sì" : "No"}
                </span>
              </div>
              {selectedItem.foto?.length > 0 && (
                <div>
                  <p className="font-bold text-[#334155] mb-2">Foto:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.foto.map((f: any) => (
                      <img
                        key={f.id}
                        src={f.foto_url}
                        alt="Foto"
                        className="w-20 h-20 object-cover cursor-pointer border border-[#e2e8f0]"
                        onClick={() => window.open(f.foto_url, "_blank")}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Lista Attività Modal ===

function ListaAttivitaModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [editItem, setEditItem] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("inserimenti_attivita")
        .select(
          "*, localita!left(localita), attivita!left(descrizione, categoria_id, categorie!left(id, nome)), clienti!left(nome)"
        )
        .order("data_inizio", { ascending: false })
        .limit(200);
      if (data) setList(data);
    } catch (err) {
      console.error("Errore caricamento attività", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const formatDate = (d: string) => {
    if (!d) return "-";
    return new Date(d + "T00:00:00").toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const filtered = list.filter((item) => {
    if (!searchText.trim()) return true;
    const q = searchText.toLowerCase();
    const loc = item.localita?.localita?.toLowerCase() || "";
    const desc = item.attivita?.descrizione?.toLowerCase() || "";
    const note = item.note?.toLowerCase() || "";
    return loc.includes(q) || desc.includes(q) || note.includes(q);
  });

  const handleEdit = (item: any) => {
    setEditItem(item);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      // Elimina foto dallo storage
      const { data: foto } = await supabase
        .from("foto_attivita")
        .select("*")
        .eq("attivita_id", deleteConfirm);
      if (foto) {
        for (const f of foto) {
          const path = f.foto_url?.split("/foto/").pop();
          if (path) await supabase.storage.from("foto").remove([path]);
        }
      }
      // Elimina record foto
      await supabase
        .from("foto_attivita")
        .delete()
        .eq("attivita_id", deleteConfirm);
      // Elimina record attività
      await supabase
        .from("inserimenti_attivita")
        .delete()
        .eq("id", deleteConfirm);
      setDeleteConfirm(null);
      await fetchList();
    } catch (err) {
      console.error("Errore eliminazione", err);
    } finally {
      setDeleting(false);
    }
  };

  // Sub-modal per nuova attività o modifica
  if (showNewForm) {
    return (
      <InserisciModal
        onClose={() => {
          setShowNewForm(false);
          fetchList();
        }}
      />
    );
  }
  if (editItem) {
    return (
      <InserisciModal
        onClose={() => {
          setEditItem(null);
          fetchList();
        }}
        editData={editItem}
      />
    );
  }

  return (
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-3xl text-[#2563eb]"
              data-icon="list_alt"
            >
              list_alt
            </span>
            <h3 className="text-xl font-semibold text-[#2563eb]">
              Gestione Attività
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#154212] text-white text-sm font-bold hover:bg-[#154212]/90 transition"
          >
            <span className="material-symbols-outlined text-lg" data-icon="add">
              add
            </span>
            Nuova Attività
          </button>
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <input
            type="text"
            className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-white focus:ring-2 focus:ring-[#154212] outline-none text-sm font-bold"
            placeholder="Cerca per località, descrizione o note..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        {/* Tabella */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <p className="text-center text-sm text-gray-500 py-8">
              Caricamento...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">
              Nessuna attività trovata.
            </p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#c2c9bb] text-left">
                  <th className="py-2 px-2 font-bold text-black text-xs uppercase">
                    Data
                  </th>
                  <th className="py-2 px-2 font-bold text-black text-xs uppercase">
                    Località
                  </th>
                  <th className="py-2 px-2 font-bold text-black text-xs uppercase">
                    Attività
                  </th>
                  <th className="py-2 px-2 font-bold text-black text-xs uppercase text-center">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#c2c9bb]/50 hover:bg-white/40"
                  >
                    <td className="py-2 px-2 text-xs font-semibold text-black whitespace-nowrap">
                      {formatDate(item.data_inizio)}
                      {item.data_fine &&
                        item.data_fine !== item.data_inizio && (
                          <span className="text-gray-500">
                            {" "}
                            → {formatDate(item.data_fine)}
                          </span>
                        )}
                    </td>
                    <td className="py-2 px-2 text-xs text-black">
                      {item.localita?.localita || "-"}
                    </td>
                    <td className="py-2 px-2 text-xs text-black">
                      {item.attivita?.descrizione || "-"}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition"
                          title="Modifica"
                        >
                          <span
                            className="material-symbols-outlined text-lg"
                            data-icon="edit"
                          >
                            edit
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(item.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition"
                          title="Elimina"
                        >
                          <span
                            className="material-symbols-outlined text-lg"
                            data-icon="delete"
                          >
                            delete
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer con pulsante Chiudi */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 h-10 px-6 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition"
          >
            <span
              className="material-symbols-outlined text-lg"
              data-icon="close"
            >
              close
            </span>
            Chiudi
          </button>
        </div>
      </section>

      {/* Confirm delete modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-[#c2c9bb]">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="material-symbols-outlined text-3xl text-red-600"
                data-icon="warning"
              >
                warning
              </span>
              <h3 className="text-lg font-bold text-black">
                Conferma eliminazione
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Sei sicuro di voler eliminare questa attività? Verranno rimosse
              anche tutte le foto associate.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="h-10 px-4 rounded-lg border border-[#c2c9bb] text-sm font-bold text-black hover:bg-gray-100 transition"
                disabled={deleting}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-10 px-4 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition inline-flex items-center gap-2"
                disabled={deleting}
              >
                {deleting ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
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
                  <span
                    className="material-symbols-outlined text-lg"
                    data-icon="delete"
                  >
                    delete
                  </span>
                )}
                Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// === Admin Page ===

export default function AdminPage({ onLogout }: AdminPageProps) {
  const navigate = useNavigate();
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [modal, setModal] = useState<
    | "clienti"
    | "attivita"
    | "report"
    | "localita"
    | "inserisci"
    | "lista-attivita"
    | null
  >(null);
  const [now, setNow] = useState(new Date());

  const actionButtonClasses = (action: string) =>
    `flex flex-col items-center justify-center text-center min-h-[72px] gap-0 p-md rounded-xl transition-all active:scale-95 w-full ${
      selectedAction === action
        ? "bg-primary text-on-primary border border-primary"
        : "bg-surface-container-low text-primary border border-surface-tint hover:bg-surface-container-high"
    }`;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const handleActionClick = (actionId: string) => {
    setSelectedAction(actionId);
    if (actionId === "clienti") setModal("clienti");
    else if (actionId === "inserisci") setModal("inserisci");
    else if (actionId === "attivita") setModal("attivita");
    else if (actionId === "localita") setModal("localita");
    else if (actionId === "report-attivita") setModal("report");
    else if (actionId === "edit-attivita") setModal("lista-attivita");
    else if (actionId === "planning") {
      setSelectedAction("planning");
      navigate("/admin/calendar");
    }
  };

  return (
    <div className="bg-background text-on-surface h-screen flex flex-col overflow-hidden admin-page-root">
      <header className="w-full shrink-0 bg-transparent dark:bg-transparent flex items-center justify-between px-edge-margin pt-8 h-touch-target-min z-40">
        <div className="flex items-center gap-sm">
          <img
            src="/leaf-512.png"
            alt="Logo GeoGiardini"
            className="admin-page__brand-logo"
            style={{ width: "4.5rem", height: "4.5rem", objectFit: "contain" }}
          />
          <h1
            className="admin-page__title-emphasis"
            style={{
              fontStyle: "italic",
              fontSize: "2rem",
              lineHeight: 1.1,
              color: "#2563eb",
              fontWeight: 700
            }}
          >
            GeoGiardini
          </h1>
        </div>
        <div className="flex items-center gap-md">
          <button
            type="button"
            onClick={onLogout}
            className="relative left-[-20px] inline-flex flex-col items-center gap-1 rounded-full hover:bg-surface-container transition-colors active:scale-95 duration-150 p-0"
            aria-label="Logout"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface">
              <svg
                className="w-6 h-6 text-on-surface-variant"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </span>
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.02em] text-on-surface-variant">
              Logout
            </span>
          </button>
        </div>
      </header>
      <div className="admin-page__divider" />

      <main className="flex-1 flex flex-col max-w-[720px] mx-auto w-full px-edge-margin overflow-hidden py-md">
        <section className="mb-md shrink-0">
          <h2 className="font-headline-md text-headline-md leading-tight admin-page__welcome">
            Angelo •{" "}
            <span className="admin-page__welcome-emphasis">Admin Panel</span>
          </h2>
        </section>

        <div className="grid grid-cols-2 gap-sm shrink-0 mb-lg">
          <button
            type="button"
            className={`${actionButtonClasses("clienti")} bg-transparent admin-page__action-button-garden`}
            onClick={() => handleActionClick("clienti")}
          >
            <span
              className="material-symbols-outlined text-2xl"
              data-icon="groups"
            >
              groups
            </span>
            <span className="font-label-lg text-label-lg">
              Anagrafica Clienti
            </span>
          </button>
          <button
            type="button"
            className={`${actionButtonClasses("localita")} bg-transparent admin-page__action-button-garden`}
            onClick={() => handleActionClick("localita")}
          >
            <span
              className="material-symbols-outlined text-2xl"
              data-icon="location_on"
            >
              location_on
            </span>
            <span className="font-label-lg text-label-lg">
              Anagrafica Località
            </span>
          </button>
          <button
            type="button"
            className={`${actionButtonClasses("attivita")} bg-transparent admin-page__action-button-garden`}
            onClick={() => handleActionClick("attivita")}
          >
            <span
              className="material-symbols-outlined text-2xl"
              data-icon="assignment_turned_in"
            >
              assignment_turned_in
            </span>
            <span className="font-label-lg text-label-lg">
              Anagrafica Attivita'
            </span>
          </button>
          <button
            type="button"
            className={`${actionButtonClasses("edit-attivita")} bg-transparent admin-page__action-button-garden`}
            onClick={() => handleActionClick("edit-attivita")}
          >
            <span
              className="material-symbols-outlined text-2xl"
              data-icon="edit_note"
            >
              edit_note
            </span>
            <span className="font-label-lg text-label-lg">
              Gestione Attività
            </span>
          </button>
          <button
            type="button"
            className={`${actionButtonClasses("report-attivita")} bg-transparent admin-page__action-button-garden`}
            onClick={() => handleActionClick("report-attivita")}
          >
            <span
              className="material-symbols-outlined text-2xl"
              data-icon="query_stats"
            >
              query_stats
            </span>
            <span className="font-label-lg text-label-lg">Report Attività</span>
          </button>
          <button
            type="button"
            className={`${actionButtonClasses("planning")} bg-transparent admin-page__action-button-garden`}
            onClick={() => {
              setSelectedAction("planning");
              navigate("/admin/calendar");
            }}
          >
            <span
              className="material-symbols-outlined text-2xl"
              data-icon="calendar_month"
            >
              calendar_month
            </span>
            <span className="font-label-lg text-label-lg">
              Planning Attività
            </span>
          </button>
        </div>

        <div
          className="flex justify-center mb-lg"
          style={{ marginTop: "-1.5rem" }}
        >
          <img src="/images/Admin.png" alt="Admin" className="w-56 mt-8" />
        </div>
      </main>

      {/* Modali */}
      {modal === "clienti" && <ClientiModal onClose={() => setModal(null)} />}
      {modal === "localita" && <LocalitaModal onClose={() => setModal(null)} />}
      {modal === "inserisci" && (
        <InserisciModal onClose={() => setModal(null)} />
      )}
      {modal === "attivita" && <AttivitaModal onClose={() => setModal(null)} />}
      {modal === "report" && <ReportModal onClose={() => setModal(null)} />}
      {modal === "lista-attivita" && (
        <ListaAttivitaModal onClose={() => setModal(null)} />
      )}
    </div>
  );
}
