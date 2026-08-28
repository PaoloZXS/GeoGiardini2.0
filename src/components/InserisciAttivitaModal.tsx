import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { sendPushNotification } from "../utils/pushNotifications";

function InserisciAttivitaModal({
  onClose,
  editData,
  onRecordSaved,
  onSaveSuccess
}: {
  onClose: () => void;
  editData?: any;
  onRecordSaved?: () => void;
  onSaveSuccess?: () => void;
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
  const [giardiniereIds, setGiardiniereIds] = useState<string[]>([]);
  const [nuoveFoto, setNuoveFoto] = useState<File[]>([]);
  const [fotoEsistenti, setFotoEsistenti] = useState<any[]>([]);
  const [visibile, setVisibile] = useState(false);
  const [aggiungiPlanning, setAggiungiPlanning] = useState(true);
  const [stato, setStato] = useState<"promemoria" | "confermato" | "eseguito">(
    "promemoria"
  );
  const [privato, setPrivato] = useState(false);
  const [visibileGiardiniere, setVisibileGiardiniere] = useState(true);
  const [visibileContatto, setVisibileContatto] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localitaList, setLocalitaList] = useState<any[]>([]);
  const [categorieList, setCategorieList] = useState<any[]>([]);
  const [attivitaList, setAttivitaList] = useState<any[]>([]);
  const [clientiList, setClientiList] = useState<any[]>([]);
  const [giardinieriOpen, setGiardinieriOpen] = useState(false);
  const giardinieriRef = useRef<HTMLDivElement>(null);
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
      supabase
        .from("localita")
        .select("id, localita, privata, created_by")
        .order("localita"),
      supabase.from("categorie").select("*").order("nome"),
      supabase
        .from("attivita")
        .select("*, categorie(nome)")
        .order("descrizione"),
      supabase
        .from("clienti")
        .select("id, nome, privato, created_by, ruolo")
        .order("nome")
    ]);
    if (loc.data) {
      const currentUser =
        typeof window !== "undefined"
          ? window.localStorage.getItem("loginUsername") || ""
          : "";
      setLocalitaList(
        loc.data.filter((item: any) => {
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
    if (cat.data) setCategorieList(cat.data);
    if (att.data) setAttivitaList(att.data);
    if (cli.data) {
      const currentUser =
        typeof window !== "undefined"
          ? window.localStorage.getItem("loginUsername") || ""
          : "";
      setClientiList(
        cli.data.filter(
          (c: any) => !(c.privato === true && c.created_by !== currentUser)
        )
      );
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Chiudi dropdown giardinieri al click fuori
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        giardinieriRef.current &&
        !giardinieriRef.current.contains(e.target as Node)
      ) {
        setGiardinieriOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Pre-fill form when in edit mode
  useEffect(() => {
    if (editData) {
      // Blocca modifica se privato di un altro admin
      if (
        editData.privato &&
        editData.created_by &&
        editData.created_by !==
          (typeof window !== "undefined"
            ? window.localStorage.getItem("loginUsername")
            : "")
      ) {
        alert("Non puoi modificare un promemoria privato di un altro admin.");
        onClose();
        return;
      }
      setDataInizio(editData.data_inizio || today);
      setDataInizioEdited(true);
      setDataFine(editData.data_fine || today);
      setDataFineEdited(true);
      setLocalitaId(editData.localita_id || "");
      setAttivitaId(editData.attivita_id || "");
      setNote(editData.note || "");
      setClienteId(editData.cliente_id || "");
      setGiardiniereIds(
        editData.giardiniere_ids
          ? Array.isArray(editData.giardiniere_ids)
            ? editData.giardiniere_ids.map((x: any) => String(x))
            : []
          : []
      );
      setVisibile(!!editData.visibile);
      setAggiungiPlanning(editData.aggiungi_al_planning !== false);
      setStato(
        (editData.stato as "promemoria" | "confermato" | "eseguito") ||
          "promemoria"
      );
      setPrivato(!!editData.privato);
      setVisibileGiardiniere(editData.visibile_giardiniere !== false);
      setVisibileContatto(editData.visibile_contatto !== false);
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

  const uniqueFilteredAttivita = (() => {
    const seen = new Set<string>();
    return filteredAttivita.filter((item: any) => {
      const descrizione = item.descrizione?.toString?.()?.trim?.() || "";
      if (!descrizione || seen.has(descrizione)) {
        return false;
      }
      seen.add(descrizione);
      return true;
    });
  })();

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
    setGiardiniereIds([]);
    setNuoveFoto([]);
    setFotoEsistenti([]);
    setVisibile(false);
    setAggiungiPlanning(true);
    setStato("promemoria");
    setPrivato(false);
    setVisibileGiardiniere(true);
    setVisibileContatto(true);
  };

  const uploadFoto = async (
    file: File,
    attivitaId: string
  ): Promise<string> => {
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
      setStatusMessage("Località e Azione sono obbligatorie.");
      clearStatus();
      return;
    }
    if (giardiniereIds.length === 0) {
      setStatusType("error");
      setStatusMessage("Seleziona almeno un giardiniere.");
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
        giardiniere_ids: giardiniereIds,
        visibile,
        aggiungi_al_planning: aggiungiPlanning,
        stato,
        privato,
        visibile_giardiniere: visibileGiardiniere,
        visibile_contatto: visibileContatto
      };
      payload.created_by = window.localStorage.getItem("loginUsername") || null;

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

      // Inserisce notifica per l'altro ruolo (solo se non esiste già non letta)
      const { count: existingNotifica } = await supabase
        .from("notifiche_attivita")
        .select("*", { count: "exact", head: true })
        .eq("attivita_id", recordId)
        .eq("letta", false);
      if (!existingNotifica || existingNotifica === 0) {
        await supabase.from("notifiche_attivita").insert({ attivita_id: recordId });
      }

      // Invia notifica push agli admin (escluso il mittente) e ai giardinieri selezionati
      const adminName = window.localStorage.getItem("loginUsername") || "Admin";
      const localitaNome = localitaList.find((l: any) => l.id === localitaId)?.localita || "";
      const attivitaDesc = attivitaList.find((a: any) => a.id === attivitaId)?.descrizione || "";
      const currentUserId = window.localStorage.getItem("userId") || undefined;
      sendPushNotification({
        title: `📋 Nuova attività da ${adminName}`,
        body: `Località: ${localitaNome} - Azione: ${attivitaDesc}`,
        excludeUserId: currentUserId,
        includeAdmins: true,
        recipientIds: giardiniereIds.length > 0 ? giardiniereIds : undefined
      });

      setStatusType("success");
      setStatusMessage(
        editData?.id
          ? "Attività aggiornata con successo."
          : "Attività inserita con successo."
      );
      resetForm();
      clearStatus();
      // Notifica il padre per aggiornare il badge in tempo reale
      if (onRecordSaved) onRecordSaved();
      if (onSaveSuccess) onSaveSuccess();
      window.dispatchEvent(new CustomEvent("inserimento-salvato"));
      window.dispatchEvent(new CustomEvent("attivita-aggiornata"));
      // Chiudi il modal dopo 2 secondi per far vedere il messaggio
      setTimeout(() => onClose(), 2000);
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

  const handleDeleteAttivita = async () => {
    if (!editData?.id) return;
    setDeleting(true);
    try {
      const { data: foto } = await supabase
        .from("foto_attivita")
        .select("*")
        .eq("attivita_id", editData.id);
      for (const f of foto || []) {
        const path = f.foto_url?.split("/foto/").pop();
        if (path)
          await supabase.storage
            .from("foto")
            .remove([path])
            .catch(() => {});
      }
      await supabase
        .from("foto_attivita")
        .delete()
        .eq("attivita_id", editData.id);
      await supabase
        .from("inserimenti_attivita")
        .delete()
        .eq("id", editData.id);
      setShowDeleteConfirm(false);
      window.dispatchEvent(new CustomEvent("inserimento-salvato"));
      window.dispatchEvent(new CustomEvent("attivita-aggiornata"));
      onClose();
    } catch (err) {
      console.error("Errore eliminazione", err);
    } finally {
      setDeleting(false);
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
                className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold text-black"
                value={dataInizio}
                onFocus={() => setDataInizioEdited(true)}
                onChange={(e) => setDataInizio(e.target.value)}
                onClick={(e) => (e.target as HTMLInputElement).showPicker()}
              />
            </div>
            <div>
              <label className="pl-2 text-sm font-bold text-black block">
                Data fine
              </label>
              <input
                type="date"
                className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] focus:ring-2 focus:ring-[#154212] outline-none text-xs font-bold text-black"
                value={dataFine}
                onFocus={() => setDataFineEdited(true)}
                onChange={(e) => setDataFine(e.target.value)}
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
                {uniqueFilteredAttivita.map((a: any) => (
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

          {/* Cliente + Giardiniere */}
          <div className="grid grid-cols-2 gap-2">
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
                {clientiList
                  .filter((c: any) => c.ruolo === "contatto")
                  .map((c) => (
                    <option key={c.id} value={c.id} className="text-black">
                      {c.nome}
                    </option>
                  ))}
              </select>
            </div>
            <div ref={giardinieriRef} className="relative">
              <label className="pl-2 text-sm font-bold text-black block">
                Giardinieri
              </label>
              <button
                type="button"
                onClick={() => setGiardinieriOpen(!giardinieriOpen)}
                className="w-full h-10 px-4 rounded-lg border border-[#c2c9bb] bg-[#f8faf8] text-xs font-bold text-left truncate flex items-center justify-between gap-2"
                style={{
                  color: giardiniereIds.length > 0 ? "black" : "#9ca3af"
                }}
              >
                <span className="truncate">
                  {(() => {
                    if (giardiniereIds.length === 0)
                      return "Seleziona giardinieri...";
                    const tutti = clientiList.filter(
                      (c: any) => c.ruolo === "giardiniere"
                    );
                    if (
                      tutti.length > 0 &&
                      tutti.every((c: any) => giardiniereIds.includes(c.id))
                    )
                      return "TUTTI";
                    return tutti
                      .filter((c: any) => giardiniereIds.includes(c.id))
                      .map((c: any) => c.nome)
                      .join(", ");
                  })()}
                </span>
                <span className="shrink-0 text-xs">
                  {giardinieriOpen ? "▲" : "▼"}
                </span>
              </button>
              {giardinieriOpen && (
                <div className="absolute z-50 mt-1 w-full rounded-lg border border-[#c2c9bb] bg-[#f8faf8] shadow-lg p-1 max-h-48 overflow-y-auto">
                  {(() => {
                    const giardinieriList = clientiList.filter(
                      (c: any) => c.ruolo === "giardiniere"
                    );
                    const tuttiSelezionati =
                      giardinieriList.length > 0 &&
                      giardinieriList.every((c) =>
                        giardiniereIds.includes(c.id)
                      );
                    return (
                      <>
                        <label className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer bg-[#fef9c3] hover:bg-[#fef08a] text-xs font-bold text-black border-b border-[#c2c9bb] mb-1">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#154212]"
                            checked={tuttiSelezionati}
                            onChange={() => {
                              if (tuttiSelezionati) {
                                setGiardiniereIds([]);
                              } else {
                                setGiardiniereIds(
                                  giardinieriList.map((c) => c.id)
                                );
                              }
                              setGiardinieriOpen(false);
                            }}
                          />
                          TUTTI
                        </label>
                        {giardinieriList.map((c) => {
                          const isChecked = giardiniereIds.includes(c.id);
                          return (
                            <label
                              key={c.id}
                              className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer hover:bg-[#e2e8e2] text-xs font-bold text-black"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-[#154212]"
                                checked={isChecked}
                                onChange={() => {
                                  setGiardiniereIds(
                                    isChecked
                                      ? giardiniereIds.filter(
                                          (id) => id !== c.id
                                        )
                                      : [...giardiniereIds, c.id]
                                  );
                                }}
                              />
                              {c.nome}
                            </label>
                          );
                        })}
                        {giardinieriList.length === 0 && (
                          <div className="px-3 py-2 text-xs text-[#9ca3af]">
                            Nessun giardiniere disponibile
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Griglia foto 3x2 */}
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
                  if (total > 6) {
                    setStatusType("error");
                    setStatusMessage("Massimo 6 foto.");
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
            <div className="flex gap-3 p-2 bg-transparent border border-white shrink-0 overflow-x-auto">
              {/* Foto esistenti */}
              {fotoEsistenti.map((foto, idx) => (
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
                      handleDeleteFoto(foto.id, foto.foto_url);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {/* Nuove foto (anteprima) */}
              {nuoveFoto.map((file, idx) => (
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
                      setNuoveFoto((prev) => prev.filter((_, i) => i !== idx));
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {/* Pulsante aggiungi (se meno di 6 foto) */}
              {fotoEsistenti.length + nuoveFoto.length < 6 && (
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
            <div className="flex gap-8" style={{ marginTop: "20px" }}>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer whitespace-nowrap">
                  <input
                    type="radio"
                    name="stato"
                    value="promemoria"
                    checked={stato === "promemoria"}
                    onChange={() => setStato("promemoria")}
                    className="h-4 w-4 accent-[#154212]"
                  />
                  Promemoria
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer whitespace-nowrap">
                  <input
                    type="radio"
                    name="stato"
                    value="confermato"
                    checked={stato === "confermato"}
                    onChange={() => setStato("confermato")}
                    className="h-4 w-4 accent-[#154212]"
                  />
                  Confermato
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer whitespace-nowrap">
                  <input
                    type="radio"
                    name="stato"
                    value="eseguito"
                    checked={stato === "eseguito"}
                    onChange={() => setStato("eseguito")}
                    className="h-4 w-4 accent-[#154212]"
                  />
                  Eseguito
                </label>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={privato}
                    onChange={(e) => setPrivato(e.target.checked)}
                    className="h-4 w-4 accent-[#154212]"
                  />
                  Privato
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#154212]"
                    checked={visibileGiardiniere}
                    onChange={(e) => setVisibileGiardiniere(e.target.checked)}
                  />
                  {visibileGiardiniere
                    ? "Si Invio ai Giardinieri"
                    : "No Invio ai Giardinieri"}
                </label>
                <label className="flex items-center gap-2 text-sm font-bold text-black cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#154212]"
                    checked={visibileContatto}
                    onChange={(e) => setVisibileContatto(e.target.checked)}
                  />
                  {visibileContatto
                    ? "Si Invio al Contatto"
                    : "No Invio al Contatto"}
                </label>
              </div>
            </div>
          </div>

          {/* Checkbox */}
          <div className="flex flex-row gap-3 items-center whitespace-nowrap text-xs pl-2">
            <label className="flex items-center gap-2 font-bold text-black cursor-pointer" style={{marginLeft:"-8px"}}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#154212]"
                checked={visibile}
                onChange={(e) => setVisibile(e.target.checked)}
              />
              Foto visibili al Contatto
            </label>
            <label className="flex items-center gap-2 font-bold text-black cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#154212]"
                checked={aggiungiPlanning}
                onChange={(e) => setAggiungiPlanning(e.target.checked)}
              />
              Aggiungi al planning
            </label>
          </div>

          <div className="bg-transparent pt-0 pb-0 mt-4">
            <div
              className="flex items-center justify-end gap-8"
              style={{ marginRight: "20px" }}
            >
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
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
        {showDeleteConfirm && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-lg rounded-3xl border border-red-400/40 bg-white p-6 shadow-2xl">
              <p className="text-lg font-semibold text-black mb-2">
                Confermi eliminazione?
              </p>
              <p className="mb-4 text-sm text-gray-600">
                Questa azione eliminerà definitivamente l'attività e tutte le
                foto associate.
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
                  disabled={deleting}
                >
                  {deleting ? "Eliminazione..." : "Elimina"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default InserisciAttivitaModal;
