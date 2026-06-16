// VAPID public key endpoint per notifiche push
export default function handler(req, res) {
  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || "";
  if (!vapidPublicKey) {
    return res.status(500).json({ error: "VAPID public key not configured" });
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ vapidPublicKey });
}
