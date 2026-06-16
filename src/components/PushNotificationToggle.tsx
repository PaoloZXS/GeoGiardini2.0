import { usePushNotifications } from "../hooks/usePushNotifications";

export default function PushNotificationToggle() {
  const { isSubscribed, isLoading, permission, subscribe, unsubscribe, error } =
    usePushNotifications();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          disabled
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-gray-400 text-white shadow-lg"
          style={{ border: "none", cursor: "not-allowed" }}
        >
          <span className="material-symbols-outlined text-xl">
            notifications
          </span>
        </button>
        <span
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "#9ca3af",
            textTransform: "uppercase",
            letterSpacing: "0.02em"
          }}
        >
          ...
        </span>
      </div>
    );
  }

  const isDisabled = permission === "denied";

  const handleToggle = async () => {
    if (permission === "denied") {
      alert(
        "Per attivare le notifiche, apri il sito nel browser Chrome e clicca sulla campanella, poi torna nella PWA."
      );
      return;
    }

    if (isSubscribed) {
      await unsubscribe();
    } else {
      // Il permesso viene richiesto DENTRO subscribe(), come in CosaDaFare
      await subscribe();
    }
  };

  // Messaggio di stato (ispirato a CosaDaFare che mostra testo sotto il pulsante)
  const statusText = error
    ? error
    : isSubscribed
      ? "Notifiche attive"
      : isDisabled
        ? "Notifiche bloccate"
        : "Clicca per attivare le notifiche";

  return (
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
        aria-label={isSubscribed ? "Disattiva notifiche" : "Attiva notifiche"}
        onClick={handleToggle}
        disabled={isDisabled}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition ${
          isDisabled
            ? "bg-gray-400 cursor-not-allowed"
            : isSubscribed
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-500 hover:bg-gray-600"
        }`}
        style={{
          border: "none",
          boxShadow: "0 16px 28px rgba(0, 0, 0, 0.18)",
          cursor: isDisabled ? "not-allowed" : "pointer"
        }}
        title={
          isDisabled
            ? "Notifiche bloccate - abilita nelle impostazioni del browser"
            : isSubscribed
              ? "Notifiche attive - clicca per disattivare"
              : "Notifiche disattive - clicca per attivare"
        }
      >
        <span className="material-symbols-outlined text-xl text-white">
          {isSubscribed ? "notifications_active" : "notifications_off"}
        </span>
      </button>
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          color: error ? "#dc2626" : "#000080",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          whiteSpace: "nowrap"
        }}
      >
        {isSubscribed ? "Notifiche ON" : isDisabled ? "Bloccate" : "Notifiche"}
      </span>
      {/* Status text sotto il label, come in CosaDaFare push.js updatePushButtonState */}
      {statusText && (
        <span
          style={{
            fontSize: "0.6rem",
            color: error ? "#dc2626" : "#4b5563",
            textAlign: "center",
            maxWidth: "120px",
            lineHeight: "1.2"
          }}
        >
          {statusText}
        </span>
      )}
    </div>
  );
}
