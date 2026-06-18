import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import dotenv from "dotenv";

dotenv.config({ quiet: false });

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Configura Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configura VAPID
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

webpush.setVapidDetails(
  "mailto:admin@geogiardini.it",
  vapidPublicKey,
  vapidPrivateKey
);

// ── Firebase Admin SDK (inizializzazione lazy) ──
let firebaseInitialized = false;
let firebaseAdmin = null;

function getFirebaseAdmin() {
  if (firebaseInitialized) return firebaseAdmin;
  try {
    const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (serviceAccountBase64) {
      const serviceAccount = JSON.parse(
        Buffer.from(serviceAccountBase64, "base64").toString("utf-8")
      );
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

// Endpoint VAPID public key
app.get("/api/vapid-public-key", (req, res) => {
  console.log("📢 Leggo VITE_VAPID_PUBLIC_KEY dal .env");
  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || "";
  console.log("🔑 Chiave:", vapidPublicKey ? "✅ TROVATA" : "❌ VUOTA");
  if (!vapidPublicKey) {
    return res.status(500).json({ error: "VAPID public key not configured" });
  }
  res.json({ vapidPublicKey });
});

// Endpoint per salvare subscription (Web Push + FCM)
app.post("/api/push-subscriptions", async (req, res) => {
  const { user_id, group_name, endpoint, keys, fcm_token, platform } = req.body;
  if (!user_id) {
    return res.status(400).json({ error: "Missing required field: user_id" });
  }

  try {
    // ── Sottoscrizione Web Push (VAPID) ──
    if (endpoint && keys) {
      const { data: existing, error: findError } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("endpoint", endpoint)
        .maybeSingle();

      if (findError) {
        console.error("[Push] Errore ricerca subscription:", findError);
        return res.status(500).json({ error: findError.message });
      }

      const record = {
        user_id,
        endpoint,
        keys,
        platform: "web",
        updated_at: new Date().toISOString()
      };

      let result;
      if (existing) {
        result = await supabase.from("push_subscriptions").update(record).eq("id", existing.id);
      } else {
        result = await supabase.from("push_subscriptions").insert(record);
      }

      if (result.error) {
        console.error("[Push] Errore salvataggio:", result.error);
        return res.status(500).json({ error: result.error.message });
      }

      console.log("[Push] Web subscription salvata per user_id:", user_id);
      return res.json({ success: true, platform: "web" });
    }

    // ── Sottoscrizione Android nativa (FCM) ──
    if (fcm_token) {
      const { data: existing, error: findError } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("fcm_token", fcm_token)
        .maybeSingle();

      if (findError) {
        console.error("[FCM] Errore ricerca token:", findError);
        return res.status(500).json({ error: findError.message });
      }

      const record = {
        user_id,
        fcm_token,
        platform: platform || "android",
        updated_at: new Date().toISOString()
      };

      let result;
      if (existing) {
        result = await supabase.from("push_subscriptions").update(record).eq("id", existing.id);
      } else {
        result = await supabase.from("push_subscriptions").insert(record);
      }

      if (result.error) {
        console.error("[FCM] Errore salvataggio token:", result.error);
        return res.status(500).json({ error: result.error.message });
      }

      console.log("[FCM] Token salvato per user_id:", user_id);
      return res.json({ success: true, platform: "android" });
    }

    return res.status(400).json({ error: "Missing either endpoint+keys or fcm_token" });
  } catch (error) {
    console.error("[Push/FCM] Errore:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint per eliminare subscription (Web Push + FCM)
app.delete("/api/push-subscriptions", async (req, res) => {
  const { endpoint, fcm_token } = req.body;

  try {
    if (fcm_token) {
      await supabase.from("push_subscriptions").delete().eq("fcm_token", fcm_token);
      console.log("[FCM] Token eliminato");
      return res.json({ success: true });
    }

    if (endpoint) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
      return res.json({ success: true });
    }

    return res.status(400).json({ error: "Missing either endpoint or fcm_token" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint per inviare notifiche (Web Push + FCM)
app.post("/api/push-send", async (req, res) => {
  const {
    title,
    body,
    url,
    excludeUserId,
    includeAdmins,
    includeOtherGardeners,
    recipientIds
  } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: "Missing title or body" });
  }

  try {
    const targetUserIds = new Set();

    if (includeAdmins) {
      const { data: admins } = await supabase
        .from("clienti")
        .select("id")
        .eq("ruolo", "admin");
      if (admins) admins.forEach((a) => targetUserIds.add(String(a.id)));
      targetUserIds.add("1");
      targetUserIds.add("2");
    }

    if (includeOtherGardeners) {
      const { data: gardeners } = await supabase
        .from("clienti")
        .select("id")
        .eq("ruolo", "giardiniere");
      if (gardeners) gardeners.forEach((g) => targetUserIds.add(String(g.id)));
    }

    if (recipientIds && recipientIds.length > 0) {
      recipientIds.forEach((id) => targetUserIds.add(String(id)));
    }

    if (excludeUserId) {
      targetUserIds.delete(String(excludeUserId));
    }

    if (targetUserIds.size === 0) {
      console.log("[Push] Nessun destinatario target");
      return res.json({ sent: 0, total: 0 });
    }

    const userIdsArray = Array.from(targetUserIds);

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys, fcm_token, platform")
      .in("user_id", userIdsArray);

    if (subError) {
      console.error("[Push] Errore query subscription:", subError);
      return res.status(500).json({ error: subError.message });
    }

    console.log("[Push] Trovate", subscriptions?.length || 0, "subscription");

    if (!subscriptions || subscriptions.length === 0) {
      return res.json({ sent: 0, total: 0 });
    }

    // Separa web subscription e token FCM
    const webSubs = subscriptions.filter((s) => s.platform === "web" && s.endpoint && s.keys);
    const fcmTokens = subscriptions
      .filter((s) => (s.platform === "android" || s.fcm_token) && s.fcm_token)
      .map((s) => s.fcm_token);

    console.log(`[Push] Web: ${webSubs.length}, FCM: ${fcmTokens.length}`);

    const payload = JSON.stringify({ title, body, url: url || "/" });
    let sent = 0;

    // ── Invia via Web Push ──
    if (webSubs.length > 0) {
      const webResults = await Promise.allSettled(
        webSubs.map((sub) => {
          const pushSub = { endpoint: sub.endpoint, keys: sub.keys };
          return webpush.sendNotification(pushSub, payload).catch(async (err) => {
            if (err.statusCode === 410) {
              await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
            }
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
          }).catch(async (err) => {
            console.error("[FCM] Errore invio a token:", token.substring(0, 30) + "...", err.code);
            if (err.code === "messaging/registration-token-not-registered" || err.code === "messaging/invalid-argument") {
              await supabase.from("push_subscriptions").delete().eq("fcm_token", token);
            }
            throw err;
          });
        })
      );
      sent += fcmResults.filter((r) => r.status === "fulfilled").length;
    }

    res.json({ sent, total: webSubs.length + fcmTokens.length });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://10.0.0.1:${port}`);
});
