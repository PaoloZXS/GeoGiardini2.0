import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import InserisciAttivitaModal from "../components/InserisciAttivitaModal";

interface AdminPageProps {
  onLogout: () => void;
}

// === CRUD Modals ===

function ClientiModal({ onClose }: { onClose: () => void }) {
  const [clientiList, setClientiList] = useState<any[]>([]);
  const [editingClienteId, setEditingClienteId] = useState<string | null>(null);
  const [nomeCliente, setNomeCliente] = useState("");
  const [clienteCodice, setClienteCodice] = useState("");
  const [clienteAttivo, setClienteAttivo] = useState(false);
  const [privato, setPrivato] = useState(false);
  const [ruolo, setRuolo] = useState<"" | "contatto" | "giardiniere" | "admin">(
    ""
  );
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
      const currentUser =
        typeof window !== "undefined"
          ? window.localStorage.getItem("loginUsername") || ""
          : "";
      setClientiList(
        (data || [])
          .filter((cliente: any) => {
            const ruoloCliente = (cliente.ruolo || "contatto").toLowerCase();
            if (
              ruoloCliente === "contatto" &&
              cliente.privato === true &&
              cliente.created_by !== currentUser
            ) {
              return false;
            }
            return true;
          })
          .map((cliente: any) => ({
            ...cliente,
            id: cliente.id?.toString?.() ?? "",
            ruolo: cliente.ruolo || "contatto",
            attivo:
              cliente.attivo === 1 ||
              cliente.attivo === "1" ||
              cliente.attivo === true ||
              cliente.attivo === "true",
            privato:
              cliente.privato === 1 ||
              cliente.privato === "1" ||
              cliente.privato === true ||
              cliente.privato === "true"
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
    if (!nomeCliente.trim() || !clienteCodice.trim()) {
      setStatusType("error");
      setStatusMessage("Nome e codice sono obbligatori.");
      clearStatusAfterDelay();
      return;
    }
    setIsSaving(true);
    setStatusMessage(null);
    setStatusType(null);
    try {
      // Controllo duplicati (tabella clienti + admin fissi)
      const nomeTrim = nomeCliente.trim();
      const codiceTrim = clienteCodice.trim();

      const adminFissi = [
        { nome: "Angelo", codice: "A2026", ruolo: "admin" },
        { nome: "Giulio", codice: "G2026", ruolo: "admin" }
      ];

      let stessoNomeRuolo = false;
      let stessoCodice = false;

      // Controllo admin fissi (solo per ruolo admin)
      if (ruolo === "admin") {
        for (const fisso of adminFissi) {
          if (fisso.nome.toLowerCase() === nomeTrim.toLowerCase()) {
            stessoNomeRuolo = true;
          }
          if (fisso.codice === codiceTrim) {
            stessoCodice = true;
          }
        }
      }

      // Controllo tabella clienti
      const { data: duplicati } = await supabase
        .from("clienti")
        .select("id, nome, codice, ruolo");

      if (duplicati) {
        for (const c of duplicati) {
          if (editingClienteId && c.id === editingClienteId) continue;
          if (
            !stessoNomeRuolo &&
            c.nome?.toLowerCase() === nomeTrim.toLowerCase() &&
            c.ruolo === ruolo
          ) {
            stessoNomeRuolo = true;
          }
          if (!stessoCodice && c.codice === codiceTrim) {
            stessoCodice = true;
          }
        }
      }

      if (stessoNomeRuolo && stessoCodice) {
        setStatusType("error");
        setStatusMessage(
          "Username già esistente per questo ruolo e password inutilizzabile. Cambia entrambi."
        );
        clearStatusAfterDelay();
        setIsSaving(false);
        return;
      }
      if (stessoNomeRuolo) {
        setStatusType("error");
        setStatusMessage(
          "Username già esistente per questo ruolo. Scegli un nome diverso."
        );
        clearStatusAfterDelay();
        setIsSaving(false);
        return;
      }
      if (stessoCodice) {
        setStatusType("error");
        setStatusMessage("Impossibile usare questa password, modificarla.");
        clearStatusAfterDelay();
        setIsSaving(false);
        return;
      }

      const payload: any = {
        nome: nomeTrim,
        codice: codiceTrim,
        attivo: clienteAttivo,
        privato: ruolo === "contatto" ? privato : false,
        ruolo: ruolo
      };
      payload.created_by = window.localStorage.getItem("loginUsername") || null;
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
      setClienteCodice("");
      setClienteAttivo(false);
      setPrivato(false);
      setRuolo("");
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
      handleClearClienteForm();
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
    setClienteCodice(cliente.codice || "");
    setClienteAttivo(
      cliente.attivo === 1 ||
        cliente.attivo === "1" ||
        cliente.attivo === true ||
        cliente.attivo === "true"
    );
    setPrivato(cliente.privato === true);
    setRuolo(cliente.ruolo || "contatto");
  };

  const handleClearClienteForm = () => {
    setEditingClienteId(null);
    setNomeCliente("");
    setClienteCodice("");
    setClienteAttivo(false);
    setPrivato(false);
    setRuolo("");
    setStatusMessage(null);
    setStatusType(null);
    nomeClienteRef.current?.blur();
    if (
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
    )
      document.activeElement.blur();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 backdrop-blur-sm p-0 overflow-auto">
      <section
        className="w-full h-full max-w-none flex flex-col rounded-none border border-[#c2c9bb] bg-[#f2f4f2] shadow-2xl p-2 sm:p-4 overflow-y-auto"
        style={{
          backgroundImage: "url('/images/sfondo1.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      >
        {statusMessage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30">
            <div
              className={`text-center text-base font-bold py-4 px-8 rounded-2xl shadow-2xl max-w-[300px] mx-auto ${
                statusType === "success"
                  ? "bg-emerald-100 text-emerald-950 border-2 border-emerald-400"
                  : "bg-red-100 text-red-700 border-2 border-red-400"
              }`}
            >
              {statusMessage}
            </div>
          </div>
        )}
        <div className="flex items-center justify-center gap-3 mb-3">
          <span
            className="material-symbols-outlined text-3xl text-[#2563eb]"
            data-icon="groups"
          >
            groups
          </span>
          <h3 className="text-xl font-semibold text-[#2563eb]">
            {editingClienteId ? "Modifica Utente" : "Anagrafica Utenti"}
          </h3>
        </div>
        <form
          className="flex flex-col h-full min-h-0 gap-4"
          onSubmit={handleSaveCliente}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="pl-2 text-sm font-bold text-black block">
                Nome
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
                Codice
              </label>
              <input
                className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
                placeholder="Es. CLI-2024"
                type="text"
                value={clienteCodice}
                onChange={(e) => setClienteCodice(e.target.value)}
              />
            </div>
          </div>
          <div className="mb-4 w-full max-w-full">
            <label className="pl-2 text-sm font-bold text-black block">
              Ruolo
            </label>
            <select
              className="w-full max-w-full h-10 px-2 sm:px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              value={ruolo}
              onChange={(e) =>
                setRuolo(e.target.value as "contatto" | "giardiniere" | "admin")
              }
            >
              <option value="" disabled className="text-[#9ca3af]">
                Scegliere un ruolo...
              </option>
              <option value="admin">Admin</option>
              <option value="contatto">Contatto</option>
              <option value="giardiniere">Giardiniere</option>
            </select>
          </div>
          <div className="flex items-center gap-4 text-sm font-bold text-black mt-1 pl-2">
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
                {clienteAttivo
                  ? (ruolo === "giardiniere"
                      ? "Giardiniere"
                      : ruolo === "admin"
                        ? "Admin"
                        : "Contatto") + " Attivo"
                  : (ruolo === "giardiniere"
                      ? "Giardiniere"
                      : ruolo === "admin"
                        ? "Admin"
                        : "Contatto") + " Non attivo"}
              </span>
            </label>
            {ruolo === "contatto" && (
              <label className="inline-flex items-center gap-2 text-black ml-8">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-green-700"
                  checked={privato}
                  onChange={(e) => setPrivato(e.target.checked)}
                />
                <span>Contatto Privato</span>
              </label>
            )}
          </div>

          <div className="min-h-0">
            <div className="flex justify-end pr-2">
              <p className="text-right text-sm italic font-bold text-black">
                Utenti registrati:{" "}
                <span className="font-bold">{clientiList.length}</span>
              </p>
            </div>
            <div
              className="overflow-y-auto border border-black bg-white p-0 mt-[10px] mb-3"
              style={{ maxHeight: "245px" }}
            >
              {clientiList.length === 0 ? (
                <p className="text-sm text-[#42493e] text-center py-6">
                  Nessun utente presente.
                </p>
              ) : (
                (() => {
                  const ordineRuolo: Record<string, number> = {
                    contatto: 0,
                    giardiniere: 1,
                    admin: 2
                  };
                  const sorted = [...clientiList].sort(
                    (a, b) =>
                      (ordineRuolo[a.ruolo] ?? 2) - (ordineRuolo[b.ruolo] ?? 2)
                  );
                  return (
                    <table
                      className="w-full text-sm"
                      style={{ borderCollapse: "collapse" }}
                    >
                      <thead className="sticky top-0 z-10 border-b border-black">
                        <tr className="text-left">
                          <th
                            className="py-2 px-2 font-bold text-black text-xs uppercase w-1/2"
                            style={{ backgroundColor: "#bae6fd" }}
                          >
                            Nome
                          </th>
                          <th
                            className="py-2 px-2 font-bold text-black text-xs uppercase w-1/3"
                            style={{ backgroundColor: "#bae6fd" }}
                          >
                            Ruolo
                          </th>
                          <th
                            className="py-2 px-2 font-bold text-black text-xs uppercase w-1/6 text-center"
                            style={{ backgroundColor: "#bae6fd" }}
                          >
                            Privato
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((cliente) => {
                          const ruoloBadge =
                            cliente.ruolo === "giardiniere"
                              ? {
                                  label: "Giardiniere",
                                  cls: "bg-green-100 text-green-800"
                                }
                              : cliente.ruolo === "admin"
                                ? {
                                    label: "Admin",
                                    cls: "bg-purple-100 text-purple-800"
                                  }
                                : {
                                    label: "Contatto",
                                    cls: "bg-blue-100 text-blue-800"
                                  };
                          return (
                            <tr
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
                              className={`border-b border-black last:border-b-0 cursor-pointer transition ${
                                editingClienteId === cliente.id
                                  ? "bg-emerald-600/20"
                                  : "bg-white hover:bg-[#eceeec]"
                              }`}
                            >
                              <td
                                className={`py-2 px-2 ${cliente.attivo ? "" : "text-red-600 line-through decoration-red-500 decoration-2"}`}
                              >
                                {cliente.nome}
                              </td>
                              <td className="py-2 px-2">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${ruoloBadge.cls}`}
                                >
                                  {ruoloBadge.label}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                {cliente.ruolo === "contatto" &&
                                cliente.ruolo === "contatto" ? (
                                  cliente.privato === true ? (
                                    <span className="text-green-700 font-bold">
                                      SI
                                    </span>
                                  ) : (
                                    <span className="text-red-700 font-bold">
                                      NO
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[#d1d5db]">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  );
                })()
              )}
            </div>
          </div>

          <div className="mt-auto bg-transparent pt-3 pb-3">
            <div
              className="flex items-center justify-end gap-12"
              style={{ marginRight: "20px" }}
            >
              {editingClienteId && (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() =>
                      openDeleteConfirmation(
                        "cliente",
                        editingClienteId,
                        nomeCliente
                      )
                    }
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-700"
                    title="Elimina contatto"
                  >
                    <span className="material-symbols-outlined text-xl">
                      delete
                    </span>
                  </button>
                  <span className="mt-1 text-[0.65rem] font-semibold text-white">
                    Elimina
                  </span>
                </div>
              )}
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
  const [note, setNote] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [privata, setPrivata] = useState(false);
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
    const currentUser =
      typeof window !== "undefined"
        ? window.localStorage.getItem("loginUsername") || ""
        : "";
    const { data } = await supabase
      .from("localita")
      .select("*, clienti(nome, privato, created_by)")
      .order("localita");
    if (data) {
      setList(
        data.filter((item: any) => {
          // Filtro cliente privato
          if (item.cliente_id && item.clienti) {
            const c = item.clienti;
            if (c.privato === true && c.created_by !== currentUser)
              return false;
          }
          // Filtro località privata: se è privata e non appartiene all'utente corrente, nascondila
          const itemPrivata =
            item.privata === 1 ||
            item.privata === "1" ||
            item.privata === true ||
            item.privata === "true";
          if (itemPrivata && item.created_by !== currentUser) return false;
          return true;
        })
      );
    }
    const { data: c } = await supabase
      .from("clienti")
      .select("id, nome, privato, created_by, ruolo")
      .order("nome");
    if (c) {
      setClienti(
        c.filter(
          (cl: any) => !(cl.privato === true && cl.created_by !== currentUser)
        )
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setLocalita("");
    setNote("");
    setClienteId("");
    setPrivata(false);
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
      const currentUser =
        typeof window !== "undefined"
          ? window.localStorage.getItem("loginUsername") || null
          : null;
      const payload: any = {
        localita: localita.trim(),
        note: note.trim(),
        cliente_id: clienteId || null,
        privata: privata,
        created_by: privata ? currentUser : null
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
      const { error } = await supabase.from("localita").delete().eq("id", id);
      if (error) throw new Error(error.message);
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
    setNote(item.note || "");
    setClienteId(item.cliente_id || "");
    setPrivata(
      item.privata === 1 ||
        item.privata === "1" ||
        item.privata === true ||
        item.privata === "true"
    );
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
        {statusMessage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30">
            <div
              className={`text-center text-base font-bold py-4 px-8 rounded-2xl shadow-2xl ${
                statusType === "success"
                  ? "bg-emerald-100 text-emerald-950 border-2 border-emerald-400"
                  : "bg-red-100 text-red-700 border-2 border-red-400"
              }`}
            >
              {statusMessage}
            </div>
          </div>
        )}
        <div className="flex items-center justify-center gap-3 mb-3">
          <span
            className="material-symbols-outlined text-3xl text-[#2563eb]"
            data-icon="location_on"
          >
            location_on
          </span>
          <h3 className="text-xl font-semibold text-[#2563eb]">
            Anagrafica Località
          </h3>
        </div>
        <form
          className="flex flex-col h-full min-h-0 gap-4"
          onSubmit={handleSave}
        >
          <div>
            <label className="pl-2 text-sm font-bold text-black block">
              Località
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
              Contatto
            </label>
            <select
              className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
            >
              <option value="">Nessun contatto</option>
              {clienti
                .filter((c: any) => c.ruolo === "contatto")
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
            </select>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-bold text-black pl-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-violet-600"
              checked={privata}
              onChange={(e) => setPrivata(e.target.checked)}
            />
            <span>Località Privata</span>
          </label>

          <div className="min-h-0">
            <div className="flex justify-end pr-2">
              <p className="text-right text-sm italic font-bold text-black">
                Località registrate:{" "}
                <span className="font-bold">{list.length}</span>
              </p>
            </div>
            <div
              className="overflow-y-auto rounded-none bg-white p-2 space-y-2 mt-[10px] mb-3"
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
                    className={`w-full rounded-none p-0.5 text-left transition cursor-pointer ${editingId === item.id ? "border-emerald-600 bg-emerald-600/20 text-black" : "border-[#c2c9bb] bg-white hover:bg-[#eceeec]"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm truncate text-[#191c1b]">
                          {item.localita} - {item.clienti?.nome || ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-auto bg-transparent pt-3 pb-3">
            <div
              className="flex items-center justify-end gap-12"
              style={{ marginRight: "20px" }}
            >
              {editingId && (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const item = list.find((x: any) => x.id === editingId);
                      if (item) openDeleteConfirm(item.id, item.localita);
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-700"
                    title="Elimina"
                  >
                    <span className="material-symbols-outlined text-xl">
                      delete
                    </span>
                  </button>
                  <span className="mt-1 text-[0.65rem] font-semibold text-white">
                    Elimina
                  </span>
                </div>
              )}
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: "attivita";
    id: string;
    label: string;
    categoriaId?: string;
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
    setSelectedId(null);
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
        const { error } = await supabase.from("attivita").insert({
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

  const handleDelete = async (id: string, categoriaId?: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase.from("attivita").delete().eq("id", id);
      if (error) throw new Error(error.message);

      let catDeleted = false;
      if (categoriaId) {
        const { count, error: countErr } = await supabase
          .from("attivita")
          .select("*", { count: "exact", head: true })
          .eq("categoria_id", categoriaId);
        if (!countErr && count === 0) {
          await supabase.from("categorie").delete().eq("id", categoriaId);
          catDeleted = true;
        }
      }

      setStatusType("success");
      setStatusMessage(
        catDeleted
          ? "Attività e categoria eliminate."
          : "Attività eliminata. La categoria è condivisa con altre attività e non è stata cancellata."
      );
      if (selectedId === id) resetForm();
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

  const openDeleteConfirm = (
    id: string,
    label: string,
    categoriaId?: string
  ) => {
    setDeleteConfirmation({ type: "attivita", id, label, categoriaId });
  };
  const cancelDelete = () => {
    setDeleteConfirmation(null);
  };
  const confirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { id, categoriaId } = deleteConfirmation;
    setDeleteConfirmation(null);
    await handleDelete(id, categoriaId);
  };

  const handleSelectItem = (item: any) => {
    setSelectedId(item.id?.toString() || null);
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
        {statusMessage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30">
            <div
              className={`text-center text-base font-bold py-4 px-8 rounded-2xl shadow-2xl ${
                statusType === "success"
                  ? "bg-emerald-100 text-emerald-950 border-2 border-emerald-400"
                  : "bg-red-100 text-red-700 border-2 border-red-400"
              }`}
            >
              {statusMessage}
            </div>
          </div>
        )}
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
              Soggetto
            </label>
            <input
              className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              placeholder="Digita o seleziona un soggetto..."
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

          {/* Azione - combobox */}
          <div className="relative overflow-visible">
            <label className="pl-2 text-sm font-bold text-black block">
              Azione
            </label>
            <input
              className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] focus:border-[#154212] outline-none text-sm text-black font-bold"
              placeholder="Digita o seleziona azione..."
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
              <div className="absolute z-50 w-full mt-1 rounded-lg border border-[#c2c9bb] bg-white shadow-lg max-h-40 overflow-y-auto">
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
            <p className="text-right text-sm italic font-bold text-black mb-2 pr-5">
              Attività presenti:{" "}
              <span className="font-bold">{list.length}</span>
            </p>
            <div className="border rounded-lg border-[#e2e8f0] overflow-hidden">
              <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
                <table
                  className="w-full text-sm"
                  style={{ borderCollapse: "collapse" }}
                >
                  <thead className="sticky top-0 z-10 bg-white border-b border-[#c2c9bb]">
                    <tr className="text-left">
                      <th className="py-2 px-2 font-bold text-black text-xs uppercase w-[25%] border-r border-[#c2c9bb] bg-transparent">
                        Soggetto
                      </th>
                      <th className="py-2 px-2 font-bold text-black text-xs uppercase w-[35%] border-r border-[#c2c9bb] bg-transparent">
                        Azione
                      </th>
                      <th className="py-2 px-2 font-bold text-black text-xs uppercase w-[30%] bg-transparent">
                        NOTA
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-center text-[#475569] py-6"
                        >
                          Nessuna attività presente.
                        </td>
                      </tr>
                    ) : (
                      list.map((item: any, idx: number) => (
                        <tr
                          key={item.id}
                          className={`border-b border-[#e2e8f0] hover:bg-[#bbf7d0] transition cursor-pointer ${idx % 2 === 1 ? "bg-[#dcfce7]" : "bg-[#bbf7d0]"}`}
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
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="mt-auto bg-transparent pt-3 pb-3">
            <div
              className="flex items-center justify-end gap-12"
              style={{ marginRight: "20px" }}
            >
              {selectedId && (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const item = list.find(
                        (x: any) => x.id?.toString() === selectedId
                      );
                      if (item) {
                        const label = `${item.categorie?.nome || ""} - ${item.descrizione || ""}`;
                        openDeleteConfirm(
                          selectedId,
                          label,
                          item.categoria_id?.toString()
                        );
                      }
                    }}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-700"
                    title="Elimina"
                  >
                    <span className="material-symbols-outlined text-xl">
                      delete
                    </span>
                  </button>
                  <span className="mt-1 text-[0.65rem] font-semibold text-white">
                    Elimina
                  </span>
                </div>
              )}
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
      .select("id, localita, privata, created_by")
      .order("localita")
      .then(({ data }) => {
        if (data) {
          const currentUser =
            typeof window !== "undefined"
              ? window.localStorage.getItem("loginUsername") || ""
              : "";
          setLocalitaList(
            data.filter((item: any) => {
              const itemPrivata =
                item.privata === 1 ||
                item.privata === "1" ||
                item.privata === true ||
                item.privata === "true";
              if (itemPrivata && item.created_by !== currentUser) return false;
              return true;
            })
          );
        }
      });
    supabase
      .from("clienti")
      .select("id, nome, privato, created_by, ruolo")
      .order("nome")
      .then(({ data }) => {
        if (data) {
          const currentUser =
            typeof window !== "undefined"
              ? window.localStorage.getItem("loginUsername") || ""
              : "";
          setClientiList(
            data.filter(
              (c: any) => !(c.privato === true && c.created_by !== currentUser)
            )
          );
        }
      });
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
              Soggetto
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
              Contatto
            </option>
            {clientiList
              .filter((c: any) => c.ruolo === "contatto")
              .map((c) => (
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
              placeholder='Scrivi una frase: es. "ROSE, Villa Cristina, maggio 2026" - il sistema analizza automaticamente Soggetto, Località, Contatto e Date.'
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
              <thead className="sticky top-0 z-10 bg-white border-b border-[#c2c9bb]">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="py-2 px-2 font-bold text-black text-xs uppercase border-r border-[#c2c9bb] last:border-r-0 bg-transparent"
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
                    className={`border-b border-[#e2e8f0] hover:bg-[#bbf7d0] transition cursor-pointer ${idx % 2 === 1 ? "bg-[#dcfce7]" : "bg-[#bbf7d0]"}`}
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
                <span className="font-bold text-[#334155]">Soggetto:</span>{" "}
                <span className="text-[#1e293b]">
                  {selectedItem.attivita?.categorie?.nome || "—"}
                </span>
              </div>
              <div>
                <span className="font-bold text-[#334155]">Azione:</span>{" "}
                <span className="text-[#1e293b]">
                  {selectedItem.attivita?.descrizione || "—"}
                </span>
              </div>
              {selectedItem.clienti && (
                <div>
                  <span className="font-bold text-[#334155]">Contatto:</span>{" "}
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
                  Visibile al Contatto:
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
  const [showNewForm, setShowNewForm] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("inserimenti_attivita")
        .select(
          "*, localita(localita), attivita(descrizione, categoria_id, categorie(id, nome)), clienti!cliente_id(nome)"
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

  // Sub-modal per nuova attività o modifica
  if (showNewForm) {
    return (
      <InserisciAttivitaModal
        onClose={() => {
          setShowNewForm(false);
          fetchList();
        }}
      />
    );
  }
  if (editItem) {
    return (
      <InserisciAttivitaModal
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
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              className="h-11 w-11 rounded-full bg-[#154212] text-white flex items-center justify-center hover:bg-[#154212]/90 transition active:scale-95"
            >
              <span
                className="material-symbols-outlined text-lg"
                data-icon="add"
              >
                add
              </span>
            </button>
            <span className="text-black text-xs">Nuova Attività</span>
          </div>
        </div>

        {/* Search bar */}
        <div className="mb-4">
          <input
            type="text"
            className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-white focus:ring-2 focus:ring-[#154212] outline-none text-sm font-bold"
            placeholder="Cerca per Località, Azione o note..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        {/* Tabella */}
        <div
          className="border border-black rounded-lg overflow-y-auto"
          style={{ maxHeight: "400px" }}
        >
          {loading ? (
            <div className="flex justify-center py-8">
              <svg
                className="animate-spin h-6 w-6 text-[#154212]"
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
                    Azione
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item: any) => (
                  <tr
                    key={item.id}
                    className="border-b border-[#c2c9bb]/50 hover:bg-white/40 cursor-pointer"
                    onClick={() => handleEdit(item)}
                  >
                    <td className="py-2 px-2 text-xs font-semibold text-black whitespace-nowrap">
                      {formatDate(item.data_inizio)}
                      {item.data_fine &&
                        item.data_fine !== item.data_inizio && (
                          <span className="text-black font-semibold">
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer con pulsante Chiudi */}
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
    </div>
  );
}

// === Promemoria Modal ===

function PromemoriaModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<any | null>(null);
  const currentUsername =
    typeof window !== "undefined"
      ? window.localStorage.getItem("loginUsername") || ""
      : "";

  const fetchList = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("inserimenti_attivita")
        .select(
          "*, localita(localita), attivita(descrizione, categoria_id, categorie(id, nome)), clienti!cliente_id(nome)"
        )
        .eq("stato", "promemoria")
        .order("data_inizio", { ascending: false });
      if (data) {
        // Filtra: se privato=true e created_by !== currentUser, non mostrare
        const filtered = data.filter(
          (item: any) => !(item.privato && item.created_by !== currentUsername)
        );
        setList(filtered);
      }
    } catch (err) {
      console.error("Errore caricamento promemoria", err);
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

  if (editItem) {
    return (
      <InserisciAttivitaModal
        onClose={() => {
          setEditItem(null);
          fetchList();
        }}
        editData={editItem}
        onRecordSaved={() => {
          window.dispatchEvent(new CustomEvent("inserimento-salvato"));
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 backdrop-blur-sm p-0 overflow-auto">
      <section
        className="w-full h-full max-w-none flex flex-col border border-[#c2c9bb] bg-[#f2f4f2] shadow-2xl"
        style={{
          backgroundImage: "url('/images/sfondo1.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-2xl text-[#2563eb]">
              notifications
            </span>
            <h2 className="text-lg font-bold text-[#2563eb]">
              Lista Promemoria
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition"
            title="Chiudi"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Contenuto scrollabile */}
        <div
          className="flex-1 px-4 pb-4 overflow-hidden flex flex-col mt-10"
          style={{ maxHeight: "60vh" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg
                className="animate-spin h-8 w-8 text-[#2563eb]"
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
          ) : list.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-gray-500 font-semibold">
              Nessun promemoria presente.
            </div>
          ) : (
            <div className="overflow-y-auto rounded-xl border border-[#c2c9bb] bg-white p-2 space-y-2">
              {list.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setEditItem(item)}
                  className="w-full text-left rounded-xl border border-[#c2c9bb] bg-white p-3 hover:bg-[#eceeec] transition cursor-pointer shadow-sm"
                >
                  <div className="grid grid-cols-2 gap-2">
                    {/* Colonna sinistra */}
                    <div className="text-left">
                      <div className="text-xs font-bold text-gray-500">
                        {formatDate(item.data_inizio)}
                      </div>
                      <div className="mt-0.5 text-sm font-bold text-[#191c1b]">
                        {item.localita?.localita || "—"}
                        {item.attivita?.descrizione ? (
                          <span className="font-normal text-[#42493e]">
                            {" "}
                            — {item.attivita.descrizione}
                            {item.clienti?.nome
                              ? ` — ${item.clienti.nome}`
                              : ""}
                          </span>
                        ) : item.clienti?.nome ? (
                          ` — ${item.clienti.nome}`
                        ) : (
                          ""
                        )}
                      </div>
                    </div>
                    {/* Colonna destra */}
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        <span className="material-symbols-outlined text-xs">
                          schedule
                        </span>
                        Promemoria
                      </div>
                      <div className="mt-0.5">
                        {item.aggiungi_al_planning ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-semibold">
                            <span className="material-symbols-outlined text-xs">
                              calendar_month
                            </span>
                            Visibile in planning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 font-semibold">
                            <span className="material-symbols-outlined text-xs">
                              calendar_month
                            </span>
                            Non in planning
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
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
    | "promemoria"
    | null
  >(null);
  const [now, setNow] = useState(new Date());
  const [notificaCount, setNotificaCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

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

  const fetchNotificaCount = useCallback(async () => {
    const { count } = await supabase
      .from("inserimenti_attivita")
      .select("*", { count: "exact", head: true })
      .eq("stato", "promemoria");
    if (count !== null) {
      setNotificaCount(count);
    }
  }, []);

  useEffect(() => {
    fetchNotificaCount();
    const interval = setInterval(fetchNotificaCount, 30000);
    window.addEventListener("inserimento-salvato", fetchNotificaCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("inserimento-salvato", fetchNotificaCount);
    };
  }, [fetchNotificaCount]);

  useEffect(() => {
    const fetchChatCount = async () => {
      try {
        const { count } = await supabase
          .from("messaggi")
          .select("*", { count: "exact", head: true })
          .eq("letta", false);
        if (count !== null) {
          setChatCount(count);
        }
      } catch {
        // Tabella messaggi non ancora creata
      }
    };
    fetchChatCount();
    const interval = setInterval(fetchChatCount, 30000);
    return () => clearInterval(interval);
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
      <header className="w-full shrink-0 bg-transparent dark:bg-transparent flex flex-col px-edge-margin pt-0 h-touch-target-min z-40">
        <div className="flex items-center justify-between w-full">
          <div className="flex-1" />
          <div className="flex items-center gap-sm">
            <img
              src="/leaf-512.png"
              alt="Logo GeoGiardini"
              className="admin-page__brand-logo"
              style={{
                width: "4.5rem",
                height: "4.5rem",
                objectFit: "contain"
              }}
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
          <div className="flex-1 flex items-center justify-end gap-md">
            <button
              type="button"
              onClick={onLogout}
              className="relative left-[-20px] inline-flex flex-col items-center gap-1 p-0"
              aria-label="Logout"
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface"
                style={{ position: "relative", top: "50px" }}
              >
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
              <span
                className="text-[0.65rem] font-semibold uppercase tracking-[0.02em] text-on-surface-variant"
                style={{ position: "relative", top: "50px" }}
              >
                Logout
              </span>
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6 pt-1">
          <button
            type="button"
            onClick={() => setModal("promemoria")}
            className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-600 text-white"
          >
            <span className="material-symbols-outlined text-lg leading-none">
              notifications
            </span>
            <span
              className="absolute text-[12px] font-bold leading-none"
              style={{ top: "-3px", right: "-3px" }}
            >
              {notificaCount}
            </span>
          </button>
          <div className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white">
            <span className="material-symbols-outlined text-lg leading-none">
              chat
            </span>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              8
            </span>
          </div>
        </div>
      </header>
      <div className="admin-page__divider" />

      <main className="flex-1 flex flex-col max-w-[720px] mx-auto w-full px-edge-margin overflow-hidden py-md">
        <section className="mb-md shrink-0">
          <h2 className="font-headline-md text-headline-md leading-tight admin-page__welcome">
            {localStorage.getItem("loginUsername") || "Admin"} •{" "}
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
              Anagrafica Utenti
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

        <div
          className="fixed bottom-6 right-6 z-50 cursor-pointer"
          onClick={() => navigate("/admin/weather")}
        >
          <span className="material-symbols-outlined text-4xl text-white bg-black/30 rounded-full p-2">
            partly_cloudy_day
          </span>
        </div>
      </main>

      {/* Modali */}
      {modal === "clienti" && <ClientiModal onClose={() => setModal(null)} />}
      {modal === "localita" && <LocalitaModal onClose={() => setModal(null)} />}
      {modal === "inserisci" && (
        <InserisciAttivitaModal
          onClose={() => setModal(null)}
          onRecordSaved={fetchNotificaCount}
        />
      )}
      {modal === "attivita" && <AttivitaModal onClose={() => setModal(null)} />}
      {modal === "report" && <ReportModal onClose={() => setModal(null)} />}
      {modal === "lista-attivita" && (
        <ListaAttivitaModal onClose={() => setModal(null)} />
      )}
      {modal === "promemoria" && (
        <PromemoriaModal onClose={() => setModal(null)} />
      )}
    </div>
  );
}
