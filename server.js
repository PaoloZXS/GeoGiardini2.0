import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import dotenv from 'dotenv';

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
  'mailto:admin@geogiardini.it',
  vapidPublicKey,
  vapidPrivateKey
);

// Endpoint VAPID public key
app.get('/api/vapid-public-key', (req, res) => {
  console.log('📢 Leggo VITE_VAPID_PUBLIC_KEY dal .env');
  const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || "";
  console.log('🔑 Chiave:', vapidPublicKey ? '✅ TROVATA' : '❌ VUOTA');
  if (!vapidPublicKey) {
    return res.status(500).json({ error: "VAPID public key not configured" });
  }
  res.json({ vapidPublicKey });
});

// Endpoint per salvare subscription
app.post('/api/push-subscriptions', async (req, res) => {
  const { user_id, endpoint, keys } = req.body;
  if (!user_id || !endpoint || !keys) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('push_subscriptions')
        .update({ endpoint, keys, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('push_subscriptions')
        .insert({ user_id, endpoint, keys });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint per eliminare subscription
app.delete('/api/push-subscriptions', async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint' });
  }

  try {
    await supabase
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint per inviare notifiche
app.post('/api/push-send', async (req, res) => {
  const { title, body, url, excludeUserId, includeAdmins, includeOtherGardeners, recipientIds } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Missing title or body' });
  }

  try {
    const targetUserIds = new Set();

    if (includeAdmins) {
      const { data: admins } = await supabase
        .from('clienti')
        .select('id')
        .eq('ruolo', 'admin');
      if (admins) admins.forEach(a => targetUserIds.add(String(a.id)));
    }

    if (includeOtherGardeners) {
      const { data: gardeners } = await supabase
        .from('clienti')
        .select('id')
        .eq('ruolo', 'giardiniere');
      if (gardeners) gardeners.forEach(g => targetUserIds.add(String(g.id)));
    }

    if (recipientIds && recipientIds.length > 0) {
      recipientIds.forEach(id => targetUserIds.add(String(id)));
    }

    if (excludeUserId) {
      targetUserIds.delete(String(excludeUserId));
    }

    if (targetUserIds.size === 0) {
      return res.json({ sent: 0, total: 0 });
    }

    const userIdsArray = Array.from(targetUserIds);
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('endpoint, keys')
      .in('user_id', userIdsArray);

    if (!subscriptions || subscriptions.length === 0) {
      return res.json({ sent: 0, total: 0 });
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/',
      icon: '/leaf-512.png',
      badge: '/leaf-512.png',
      requireInteraction: true,
      vibrate: [120, 80, 120]
    });

    let sent = 0;
    const results = await Promise.allSettled(
      subscriptions.map(sub => {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: sub.keys
        };
        return webpush.sendNotification(pushSub, payload).catch(async (err) => {
          if (err.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('endpoint', sub.endpoint);
          }
          throw err;
        });
      })
    );

    sent = results.filter(r => r.status === 'fulfilled').length;
    res.json({ sent, total: subscriptions.length });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://10.0.0.1:${port}`);
});
