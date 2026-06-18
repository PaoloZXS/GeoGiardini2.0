import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  "mailto:admin@geogiardini.it",
  vapidPublicKey,
  vapidPrivateKey
);

// ── Firebase Admin SDK (inizializzazione lazy) ──
let firebaseInitialized = false;
let firebaseAdmin: any = null;

function getFirebaseAdmin() {
  if (firebaseInitialized) return firebaseAdmin;
  try {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (serviceAccountBase64) {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountBase64, "base64").toString("utf-8")
      );
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      firebaseAdmin = require("firebase-admin");
      if (!firebaseAdmin.apps.length) {
        firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert(serviceAccount)
        });
      }
      firebaseInitialized = true;
      console.log("[FCM] Firebase Admin inizializzato");
    } else {
      console.log("[FCM] FIREBASE_SERVICE_ACCOUNT_B64 non configurato, FCM disabilitato");
    }
  } catch (err) {
    console.error("[FCM] Errore inizializzazione Firebase:", err);
  }
  return firebaseAdmin;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Supabase not configured" });
  }

  try {
    const {
      title,
      body,
      url,
      excludeUserId,
      includeAdmins = false,
      includeOtherGardeners = false,
      recipientIds = []
    } = req.body;

    if (!title || !body) {
      return res
        .status(400)
        .json({ error: "Missing required fields: title, body" });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Costruisci lista destinatari (user_id)
    const targetUserIds = new Set();

    // 1) Se includeAdmins, recupera tutti gli admin (clienti + hardcoded)
    if (includeAdmins) {
      const { data: admins } = await supabase
        .from("clienti")
        .select("id")
        .eq("ruolo", "admin");
      if (admins) {
        admins.forEach((a) => targetUserIds.add(String(a.id)));
      }
      targetUserIds.add("1");
      targetUserIds.add("2");
    }

    // 2) Se includeOtherGardeners, recupera tutti i giardinieri
    if (includeOtherGardeners) {
      const { data: gardeners } = await supabase
        .from("clienti")
        .select("id")
        .eq("ruolo", "giardiniere");
      if (gardeners) {
        gardeners.forEach((g) => targetUserIds.add(String(g.id)));
      }
    }

    // 3) Aggiungi eventuali recipientIds espliciti
    if (Array.isArray(recipientIds) && recipientIds.length > 0) {
      recipientIds.forEach((id) => targetUserIds.add(String(id)));
    }

    // 4) Rimuovi il mittente dalla lista
    if (excludeUserId) {
      targetUserIds.delete(String(excludeUserId));
    }

    if (targetUserIds.size === 0) {
      return res
        .status(200)
        .json({ sent: 0, total: 0, message: "No recipients" });
    }

    // Recupera TUTTE le subscription (sia web che android) per i destinatari
    const userIdsArray = Array.from(targetUserIds);
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys, fcm_token, platform")
      .in("user_id", userIdsArray);

    if (error) throw error;
    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ sent: 0, total: 0 });
    }

    // Separa web subscription e token FCM
    const webSubs = subscriptions.filter((s) => s.platform === "web" && s.endpoint && s.keys);
    const fcmTokens = subscriptions
      .filter((s) => (s.platform === "android" || s.fcm_token) && s.fcm_token)
      .map((s) => s.fcm_token);

    console.log(`[Push] Web: ${webSubs.length}, FCM: ${fcmTokens.length}`);

    const payload = JSON.stringify({ title, body, url: url || "/" });
    let sent = 0;
    const errors: any[] = [];

    // ── Invia via Web Push ──
    if (webSubs.length > 0 && vapidPublicKey && vapidPrivateKey) {
      const webResults = await Promise.allSettled(
        webSubs.map((sub) => {
          const pushSub = { endpoint: sub.endpoint, keys: sub.keys };
          return webpush.sendNotification(pushSub, payload).catch(async (err) => {
            console.error("[Push] Errore invio web a", sub.endpoint?.substring(0, 60) + "...", ":", err.statusCode, err.message);
            if (err.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
            errors.push({ endpoint: sub.endpoint?.substring(0, 60) + "...", type: "web", statusCode: err.statusCode, message: err.message });
            throw err;
          });
        })
      );
      sent += webResults.filter((r) => r.status === "fulfilled").length;
    }

    // ── Invia via FCM ──
    const admin = getFirebaseAdmin();
    if (fcmTokens.length > 0 && admin) {
      const fcmResults = await Promise.allSettled(
        fcmTokens.map((token) => {
          return admin.messaging().send({
            token,
            notification: { title, body },
            data: { url: url || "/", click_action: "FLUTTER_NOTIFICATION_CLICK" }
          }).catch((err) => {
            console.error("[FCM] Errore invio a token:", token.substring(0, 30) + "...", ":", err.code, err.message);
            // Se token non valido, elimina
            if (err.code === "messaging/registration-token-not-registered" || err.code === "messaging/invalid-argument") {
              supabase.from("push_subscriptions").delete().eq("fcm_token", token);
            }
            errors.push({ token: token.substring(0, 30) + "...", type: "fcm", code: err.code, message: err.message });
            throw err;
          });
        })
      );
      sent += fcmResults.filter((r) => r.status === "fulfilled").length;
    }

    const total = webSubs.length + fcmTokens.length;
    console.log("[Push] Risultato:", { sent, total, errors: errors.length });

    return res.status(200).json({ sent, total, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error("Push send error:", error);
    return res.status(500).json({ error: error.message });
  }
}
