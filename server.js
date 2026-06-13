const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cheerio = require('cheerio');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'store.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/groupcart';

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- MongoDB Schemas & Models ---
const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { id: false });
const User = mongoose.model('User', userSchema);

const appSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  color: { type: String, default: '#888888' },
  icon: { type: String, default: '📦' }
}, { id: false });
const App = mongoose.model('App', appSchema);

const orderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  appId: { type: String, required: true, index: true },
  link: { type: String, default: '' },
  productName: { type: String, required: true },
  qty: { type: Number, default: 1 },
  estimatedPrice: { type: Number, default: 0 },
  status: { type: String, default: 'pending', enum: ['pending', 'confirmed', 'out-of-stock', 'returned', 'not-delivered'] },
  statusNote: { type: String, default: '' },
  statusUpdatedBy: { type: String },
  statusUpdatedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  adminModified: { type: Boolean, default: false },
  adminModifiedBy: { type: String },
  adminModifiedAt: { type: Date },
  isFavorite: { type: Boolean, default: false }
}, { id: false });
const Order = mongoose.model('Order', orderSchema);

const billSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  appId: { type: String, required: true },
  actualAmount: { type: Number, required: true },
  settledAt: { type: Date, default: Date.now }
}, { id: false });
const Bill = mongoose.model('Bill', billSchema);

const sessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  settledAt: { type: Date },
  status: { type: String, default: 'adding', enum: ['adding', 'locked', 'ordered', 'delivered', 'settled'] },
  splitMode: { type: String, default: 'proportional', enum: ['proportional', 'equal', 'custom'] },
  customSplits: { type: Map, of: Number, default: {} },
  freeDeliveryThresholds: { type: Map, of: Number, default: {} }
}, { id: false });
const Session = mongoose.model('Session', sessionSchema);

const settingsSchema = new mongoose.Schema({
  upiId: { type: String, default: '' }
});
const Settings = mongoose.model('Settings', settingsSchema);

const favoriteSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  appId: { type: String, required: true },
  productName: { type: String, required: true },
  estimatedPrice: { type: Number, default: 0 },
  link: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { id: false });
favoriteSchema.index({ userId: 1, appId: 1, productName: 1 }, { unique: true });
const Favorite = mongoose.model('Favorite', favoriteSchema);

const paymentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  sessionId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, required: true },
  amount: { type: Number, required: true },
  markedPaidAt: { type: Date, default: Date.now },
  confirmedByAdmin: { type: Boolean, default: false },
  confirmedAt: { type: Date },
  confirmedBy: { type: String }
}, { id: false });
const Payment = mongoose.model('Payment', paymentSchema);

async function getActiveSession() {
  let session = await Session.findOne({ active: true }).sort({ createdAt: -1 });
  if (!session) {
    session = await Session.create({ id: generateId(), name: 'Current Session', active: true, createdAt: new Date() });
  } else if (!session.id) {
    session.id = generateId();
    await session.save();
  }
  return session;
}

async function getSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({ upiId: '' });
  }
  return settings;
}

// --- Data Migration from store.json ---
async function migrateData() {
  try {
    const activeSession = await getActiveSession();
    
    // Ensure all existing documents in database have a sessionId assigned
    const ordersUpdated = await Order.updateMany({ sessionId: { $exists: false } }, { $set: { sessionId: activeSession.id } });
    if (ordersUpdated.modifiedCount > 0) {
      console.log(`Updated ${ordersUpdated.modifiedCount} legacy orders with sessionId: ${activeSession.id}`);
    }
    const billsUpdated = await Bill.updateMany({ sessionId: { $exists: false } }, { $set: { sessionId: activeSession.id } });
    if (billsUpdated.modifiedCount > 0) {
      console.log(`Updated ${billsUpdated.modifiedCount} legacy bills with sessionId: ${activeSession.id}`);
    }

    const userCount = await User.countDocuments();
    const appCount = await App.countDocuments();
    if (userCount === 0 && appCount === 0 && fs.existsSync(DATA_FILE)) {
      console.log('Migrating data from store.json to MongoDB...');
      const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

      if (fileData.users && fileData.users.length > 0) {
        await User.insertMany(fileData.users.map(u => ({
          id: u.id,
          name: u.name,
          isAdmin: u.isAdmin,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
        })), { ordered: false });
        console.log(`Migrated ${fileData.users.length} users.`);
      }

      if (fileData.apps && fileData.apps.length > 0) {
        await App.insertMany(fileData.apps.map(a => ({
          id: a.id,
          name: a.name,
          color: a.color,
          icon: a.icon
        })), { ordered: false });
        console.log(`Migrated ${fileData.apps.length} apps.`);
      }

      if (fileData.orders && fileData.orders.length > 0) {
        await Order.insertMany(fileData.orders.map(o => ({
          id: o.id,
          sessionId: activeSession.id,
          userId: o.userId,
          userName: o.userName,
          appId: o.appId,
          link: o.link || '',
          productName: o.productName,
          qty: o.qty || 1,
          estimatedPrice: o.estimatedPrice || 0,
          status: o.status || 'pending',
          statusNote: o.statusNote || '',
          createdAt: o.createdAt ? new Date(o.createdAt) : new Date(),
          adminModified: o.adminModified || false,
          adminModifiedBy: o.adminModifiedBy || undefined,
          adminModifiedAt: o.adminModifiedAt ? new Date(o.adminModifiedAt) : undefined
        })), { ordered: false });
        console.log(`Migrated ${fileData.orders.length} orders.`);
      }

      if (fileData.bills && fileData.bills.length > 0) {
        await Bill.insertMany(fileData.bills.map(b => ({
          id: b.id,
          sessionId: activeSession.id,
          appId: b.appId,
          actualAmount: b.actualAmount,
          settledAt: b.settledAt ? new Date(b.settledAt) : new Date()
        })), { ordered: false });
        console.log(`Migrated ${fileData.bills.length} bills.`);
      }

      if (fileData.session) {
        await Session.findOneAndUpdate({ active: true }, {
          id: activeSession.id,
          name: fileData.session.name || '',
          active: fileData.session.active !== undefined ? fileData.session.active : true,
          createdAt: fileData.session.createdAt ? new Date(fileData.session.createdAt) : new Date()
        }, { upsert: true, new: true });
        console.log('Migrated session.');
      }
      console.log('Migration completed successfully.');
    }
  } catch (err) {
    console.error('Error during data migration:', err);
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// --- SSE (Server-Sent Events) ---
const sseClients = new Set();

function broadcastSSE(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(message);
  }
}

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write(`data: connected\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// --- Auth ---
app.post('/api/auth/login', async (req, res) => {
  try {
    const { name, isAdmin, adminPassword } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    if (isAdmin && adminPassword !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    // Case-insensitive user lookup using collation
    let user = await User.findOne({ name: name.trim() }).collation({ locale: 'en', strength: 2 });

    if (!user) {
      user = new User({
        id: generateId(),
        name: name.trim(),
        isAdmin: !!isAdmin,
        createdAt: new Date()
      });
      await user.save();
      broadcastSSE('user-joined', { user });
    } else {
      user.isAdmin = !!isAdmin;
      await user.save();
    }

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Apps ---
app.get('/api/apps', async (req, res) => {
  try {
    const apps = await App.find();
    res.json({ apps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/apps', async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'App name is required' });

    const id = name.toLowerCase().replace(/\s+/g, '-');

    const existing = await App.findOne({ id });
    if (existing) {
      return res.status(409).json({ error: 'App already exists' });
    }

    const newApp = new App({ id, name, color: color || '#888888', icon: icon || '📦' });
    await newApp.save();
    broadcastSSE('app-added', { app: newApp });
    res.json({ app: newApp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/apps/:id', async (req, res) => {
  try {
    const appItem = await App.findOneAndDelete({ id: req.params.id });
    if (!appItem) return res.status(404).json({ error: 'App not found' });

    broadcastSSE('app-removed', { appId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Orders ---
app.get('/api/orders', async (req, res) => {
  try {
    const activeSession = await getActiveSession();
    const sessionId = req.query.sessionId || activeSession.id;
    let query = { sessionId };
    if (req.query.userId) {
      query.userId = req.query.userId;
    }
    const orders = await Order.find(query);
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { userId, userName, appId, link, productName, qty, estimatedPrice } = req.body;
    if (!userId || !appId || !productName) {
      return res.status(400).json({ error: 'userId, appId, and productName are required' });
    }

    const activeSession = await getActiveSession();

    const order = new Order({
      id: generateId(),
      sessionId: activeSession.id,
      userId,
      userName,
      appId,
      link: link || '',
      productName,
      qty: qty || 1,
      estimatedPrice: parseFloat(estimatedPrice) || 0,
      createdAt: new Date()
    });

    await order.save();
    broadcastSSE('order-added', { order });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const allowed = ['appId', 'link', 'productName', 'qty', 'estimatedPrice'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        order[key] = key === 'estimatedPrice' ? parseFloat(req.body[key]) : (key === 'qty' ? parseInt(req.body[key]) : req.body[key]);
      }
    }

    // Track admin price override
    if (req.body.adminOverride) {
      order.adminModified = true;
      order.adminModifiedBy = req.body.adminName || 'Admin';
      order.adminModifiedAt = new Date();
    }

    await order.save();
    broadcastSSE('order-updated', { order });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOneAndDelete({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    broadcastSSE('order-removed', { orderId: req.params.id });
    res.json({ success: true, order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Order Status (Admin) ---
// IMPORTANT: bulk-status route must come before :id/status to avoid matching 'bulk-status' as :id
app.put('/api/orders/bulk-status', async (req, res) => {
  try {
    const { appId, status, adminName } = req.body;
    const validStatuses = ['pending', 'confirmed', 'out-of-stock', 'returned', 'not-delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (!appId) return res.status(400).json({ error: 'appId is required' });

    const result = await Order.updateMany(
      { appId, status: 'pending' },
      {
        $set: {
          status,
          statusUpdatedBy: adminName || 'Admin',
          statusUpdatedAt: new Date()
        }
      }
    );

    broadcastSSE('order-bulk-status-changed', { appId, status, count: result.modifiedCount });
    res.json({ success: true, updated: result.modifiedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status, statusNote, adminName } = req.body;
    const validStatuses = ['pending', 'confirmed', 'out-of-stock', 'returned', 'not-delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findOne({ id: req.params.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    order.status = status;
    order.statusNote = statusNote || '';
    order.statusUpdatedBy = adminName || 'Admin';
    order.statusUpdatedAt = new Date();
    await order.save();

    broadcastSSE('order-status-changed', { order });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Bills (Admin) ---
app.get('/api/bills', async (req, res) => {
  try {
    const activeSession = await getActiveSession();
    const sessionId = req.query.sessionId || activeSession.id;
    const bills = await Bill.find({ sessionId });
    res.json({ bills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bills', async (req, res) => {
  try {
    const { appId, actualAmount } = req.body;
    if (!appId || actualAmount === undefined) {
      return res.status(400).json({ error: 'appId and actualAmount are required' });
    }

    const activeSession = await getActiveSession();
    const sessionId = req.body.sessionId || activeSession.id;

    let bill = await Bill.findOne({ appId, sessionId });
    if (bill) {
      bill.actualAmount = parseFloat(actualAmount);
      bill.settledAt = new Date();
    } else {
      bill = new Bill({
        id: generateId(),
        sessionId,
        appId,
        actualAmount: parseFloat(actualAmount),
        settledAt: new Date()
      });
    }

    await bill.save();
    broadcastSSE('bill-updated', { bill });
    res.json({ bill });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Settlement ---
app.get('/api/settlement', async (req, res) => {
  try {
    const activeSession = await getActiveSession();
    const sessionId = req.query.sessionId || activeSession.id;
    const currentSession = await Session.findOne({ id: sessionId });
    const settings = await getSettings();

    const [allOrders, bills, apps] = await Promise.all([
      Order.find({ sessionId }).lean(),
      Bill.find({ sessionId }).lean(),
      App.find().lean(),
    ]);

    // Separate active vs excluded orders
    const excludedStatuses = ['out-of-stock', 'returned', 'not-delivered'];
    const orders = allOrders.filter(o => !excludedStatuses.includes(o.status));
    const excludedOrders = allOrders.filter(o => excludedStatuses.includes(o.status));

    // Group active orders by app
    const ordersByApp = {};
    for (const order of orders) {
      if (!ordersByApp[order.appId]) ordersByApp[order.appId] = [];
      ordersByApp[order.appId].push(order);
    }

    // Track excluded totals per app (for bill warning)
    const excludedByApp = {};
    for (const order of excludedOrders) {
      if (!excludedByApp[order.appId]) excludedByApp[order.appId] = { count: 0, total: 0 };
      excludedByApp[order.appId].count++;
      excludedByApp[order.appId].total += order.estimatedPrice * order.qty;
    }

    // Per-app discount info (based on active orders only)
    const appDiscounts = {};
    const billWarnings = {};
    for (const bill of bills) {
      const appOrders = ordersByApp[bill.appId] || [];
      const totalEstimated = appOrders.reduce((sum, o) => sum + (o.estimatedPrice * o.qty), 0);

      if (totalEstimated > 0) {
        const discountPercent = ((totalEstimated - bill.actualAmount) / totalEstimated) * 100;
        appDiscounts[bill.appId] = {
          totalEstimated,
          actualAmount: bill.actualAmount,
          discountPercent,
          discountAmount: totalEstimated - bill.actualAmount,
        };
      }

      // Bill warning if items were excluded after bill was entered
      if (excludedByApp[bill.appId]) {
        billWarnings[bill.appId] = {
          excludedCount: excludedByApp[bill.appId].count,
          excludedTotal: excludedByApp[bill.appId].total,
          message: `${excludedByApp[bill.appId].count} item(s) excluded (₹${Math.round(excludedByApp[bill.appId].total)}) — bill may need re-entering`,
        };
      }
    }

    // Per-user breakdown (active orders only)
    const userTotals = {};
    for (const order of orders) {
      if (!userTotals[order.userId]) {
        userTotals[order.userId] = { userId: order.userId, userName: order.userName, apps: {}, total: 0 };
      }

      const itemTotal = order.estimatedPrice * order.qty;
      const discount = appDiscounts[order.appId];
      let finalAmount = itemTotal;

      if (discount) {
        finalAmount = itemTotal * (1 - discount.discountPercent / 100);
      }

      if (!userTotals[order.userId].apps[order.appId]) {
        userTotals[order.userId].apps[order.appId] = { estimated: 0, final: 0, items: [] };
      }

      userTotals[order.userId].apps[order.appId].estimated += itemTotal;
      userTotals[order.userId].apps[order.appId].final += finalAmount;
      userTotals[order.userId].apps[order.appId].items.push(order);
    }

    const splitMode = currentSession.splitMode || 'proportional';

    if (splitMode === 'proportional') {
      // Smart rounding per app to match actual bill exactly
      for (const appId in appDiscounts) {
        const discount = appDiscounts[appId];
        const usersOnApp = [];

        for (const userId in userTotals) {
          const appData = userTotals[userId].apps[appId];
          if (appData) {
            usersOnApp.push({ userId, appData });
          }
        }

        if (usersOnApp.length === 0) continue;

        let roundedSum = 0;
        let maxFrac = { userId: null, frac: 0 };

        for (const { userId, appData } of usersOnApp) {
          const raw = appData.final;
          const rounded = Math.round(raw);
          const frac = raw - Math.floor(raw);

          appData.final = rounded;
          roundedSum += rounded;

          if (frac > maxFrac.frac) {
            maxFrac = { userId, frac };
          }
        }

        const diff = discount.actualAmount - roundedSum;
        if (diff !== 0 && maxFrac.userId) {
          userTotals[maxFrac.userId].apps[appId].final += diff;
        }
      }

      // Calculate totals
      for (const userId in userTotals) {
        let total = 0;
        for (const appId in userTotals[userId].apps) {
          total += userTotals[userId].apps[appId].final;
        }
        userTotals[userId].total = total;
      }
    } else if (splitMode === 'equal') {
      const totalBillAmount = bills.reduce((sum, b) => sum + b.actualAmount, 0);
      const activeUserIds = Object.keys(userTotals);
      if (activeUserIds.length > 0) {
        const baseShare = Math.floor(totalBillAmount / activeUserIds.length);
        const remainder = totalBillAmount - (baseShare * activeUserIds.length);

        activeUserIds.forEach((userId, index) => {
          const userShare = baseShare + (index < remainder ? 1 : 0);
          userTotals[userId].total = userShare;

          // Redistribute to apps
          const uTotal = userTotals[userId];
          const userEstimatedTotal = Object.values(uTotal.apps).reduce((sum, app) => sum + app.estimated, 0);
          let assignedFinalSum = 0;
          const appKeys = Object.keys(uTotal.apps);
          
          appKeys.forEach((appId, idx) => {
            const appData = uTotal.apps[appId];
            if (idx === appKeys.length - 1) {
              appData.final = uTotal.total - assignedFinalSum;
            } else {
              if (userEstimatedTotal > 0) {
                appData.final = Math.round(uTotal.total * (appData.estimated / userEstimatedTotal));
              } else {
                appData.final = Math.round(uTotal.total / appKeys.length);
              }
              assignedFinalSum += appData.final;
            }
          });
        });
      }
    } else if (splitMode === 'custom') {
      const activeUserIds = Object.keys(userTotals);
      activeUserIds.forEach((userId) => {
        const customAmount = (currentSession.customSplits && currentSession.customSplits.get(userId)) || 0;
        userTotals[userId].total = customAmount;

        // Redistribute to apps
        const uTotal = userTotals[userId];
        const userEstimatedTotal = Object.values(uTotal.apps).reduce((sum, app) => sum + app.estimated, 0);
        let assignedFinalSum = 0;
        const appKeys = Object.keys(uTotal.apps);
        
        appKeys.forEach((appId, idx) => {
          const appData = uTotal.apps[appId];
          if (idx === appKeys.length - 1) {
            appData.final = uTotal.total - assignedFinalSum;
          } else {
            if (userEstimatedTotal > 0) {
              appData.final = Math.round(uTotal.total * (appData.estimated / userEstimatedTotal));
            } else {
              appData.final = Math.round(uTotal.total / appKeys.length);
            }
            assignedFinalSum += appData.final;
          }
        });
      });
    }

    res.json({
      users: Object.values(userTotals),
      appDiscounts,
      billWarnings,
      excludedOrders,
      apps: apps,
      session: currentSession,
      upiId: settings.upiId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Session ---
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = await Session.find().sort({ createdAt: -1 });
    res.json({ sessions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/session/reset', async (req, res) => {
  try {
    const { name } = req.body;
    
    // Deactivate current active session
    const currentActive = await Session.findOne({ active: true }).sort({ createdAt: -1 });
    if (currentActive) {
      currentActive.active = false;
      currentActive.settledAt = new Date();
      if (!currentActive.id) {
        currentActive.id = generateId();
      }
      if (name && name.trim()) {
        currentActive.name = name.trim();
      } else {
        const d = new Date();
        currentActive.name = `Session ${d.toLocaleDateString('en-IN')} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
      }
      await currentActive.save();
    }

    // Create a new active session
    const newSession = await Session.create({
      id: generateId(),
      name: 'Current Session',
      active: true,
      createdAt: new Date()
    });

    broadcastSSE('session-reset', { activeSessionId: newSession.id });
    res.json({ success: true, newSession });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/session', async (req, res) => {
  try {
    const session = await getActiveSession();
    res.json({ session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Web Scraper and Helper Functions ---
function extractFromJSONLD($) {
  let name = '';
  let price = 0;
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const json = JSON.parse($(el).html());
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (item['@type'] === 'Product' || item['@type'] === 'http://schema.org/Product') {
          if (item.name) name = item.name;
          if (item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offer.price) price = parseFloat(offer.price);
          }
          break;
        } else if (item['@graph']) {
          for (const g of item['@graph']) {
            if (g['@type'] === 'Product') {
              if (g.name) name = g.name;
              if (g.offers) {
                const offer = Array.isArray(g.offers) ? g.offers[0] : g.offers;
                if (offer.price) price = parseFloat(offer.price);
              }
              break;
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }
  });
  return { name, price };
}

app.post('/api/scrape-url', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    let platform = '';
    let appId = '';
    const lowercaseUrl = url.toLowerCase();

    if (lowercaseUrl.includes('blinkit.com')) {
      platform = 'Blinkit';
      appId = 'blinkit';
    } else if (lowercaseUrl.includes('swiggy.com')) {
      platform = 'Swiggy';
      appId = 'swiggy';
    } else if (lowercaseUrl.includes('zepto')) {
      platform = 'Zepto';
      appId = 'zepto';
    } else {
      try {
        const parsedUrl = new URL(url);
        const parts = parsedUrl.hostname.split('.');
        platform = parts.length > 2 ? parts[parts.length - 2] : parts[0];
        platform = platform.charAt(0).toUpperCase() + platform.slice(1);
        appId = platform.toLowerCase();
      } catch (e) {
        platform = 'Web';
        appId = 'web';
      }
    }

    let html = '';
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000)
      });
      if (response.ok) {
        html = await response.text();
      }
    } catch (fetchErr) {
      console.error('Error fetching URL:', fetchErr.message);
    }

    let productName = '';
    let estimatedPrice = 0;

    if (html) {
      const $ = cheerio.load(html);
      const ldResult = extractFromJSONLD($);
      if (ldResult.name) productName = ldResult.name;
      if (ldResult.price) estimatedPrice = ldResult.price;

      if (!productName) {
        productName = $('meta[property="og:title"]').attr('content') || 
                      $('meta[name="twitter:title"]').attr('content') || 
                      $('title').text();
        if (productName) {
          productName = productName.replace(/\s*\|\s*Blinkit\s*$/i, '')
                                   .replace(/\s*\|\s*Swiggy\s*$/i, '')
                                   .replace(/\s*-\s*Zepto\s*$/i, '')
                                   .trim();
        }
      }

      if (!estimatedPrice) {
        const priceStr = $('meta[property="product:price:amount"]').attr('content') || 
                         $('meta[property="og:price:amount"]').attr('content') ||
                         $('meta[property="product:sale_price:amount"]').attr('content');
        if (priceStr) {
          estimatedPrice = parseFloat(priceStr);
        }
      }

      if (!estimatedPrice) {
        let foundPrice = 0;
        $('*').each((i, el) => {
          if ($(el).children().length === 0) {
            const text = $(el).text().trim();
            const match = text.match(/^₹\s*(\d+(?:\.\d{1,2})?)$/) || text.match(/^Rs\.?\s*(\d+(?:\.\d{1,2})?)$/);
            if (match) {
              const val = parseFloat(match[1]);
              if (val > 0 && (!foundPrice || val < foundPrice)) {
                foundPrice = val;
              }
            }
          }
        });
        if (foundPrice) estimatedPrice = foundPrice;
      }

      if (!estimatedPrice) {
        const priceMatch = html.match(/["']price["']\s*:\s*["']?(\d+(?:\.\d{1,2})?)["']?/i);
        if (priceMatch) {
          estimatedPrice = parseFloat(priceMatch[1]);
        }
      }
    }

    if (isNaN(estimatedPrice)) estimatedPrice = 0;

    res.json({
      success: true,
      productName: productName.trim() || '',
      estimatedPrice,
      platform,
      appId
    });
  } catch (err) {
    console.error('Scraping error:', err);
    res.status(500).json({ error: 'Failed to scrape URL' });
  }
});

// --- Session status flow ---
app.put('/api/session/status', async (req, res) => {
  try {
    const { status, adminName, name } = req.body;
    const validStatuses = ['adding', 'locked', 'ordered', 'delivered', 'settled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const session = await getActiveSession();
    session.status = status;
    if (status === 'settled') {
      session.active = false;
      session.settledAt = new Date();
      if (name && name.trim()) {
        session.name = name.trim();
      } else {
        const d = new Date();
        session.name = `Session ${d.toLocaleDateString('en-IN')} ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
      }
    }
    await session.save();
    broadcastSSE('session-status-changed', { status, sessionId: session.id });
    res.json({ success: true, session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Payments ---
app.get('/api/payments', async (req, res) => {
  try {
    const activeSession = await getActiveSession();
    const sessionId = req.query.sessionId || activeSession.id;
    const payments = await Payment.find({ sessionId });
    res.json({ payments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/payments/mark-paid', async (req, res) => {
  try {
    const { userId, userName, amount } = req.body;
    if (!userId || !userName || amount === undefined) {
      return res.status(400).json({ error: 'userId, userName and amount are required' });
    }

    const activeSession = await getActiveSession();
    let payment = await Payment.findOne({ sessionId: activeSession.id, userId });
    if (payment) {
      payment.amount = amount;
      payment.markedPaidAt = new Date();
      payment.confirmedByAdmin = false;
      payment.confirmedAt = undefined;
      payment.confirmedBy = undefined;
    } else {
      payment = new Payment({
        id: generateId(),
        sessionId: activeSession.id,
        userId,
        userName,
        amount,
        markedPaidAt: new Date()
      });
    }

    await payment.save();
    broadcastSSE('payment-updated', { payment });
    res.json({ success: true, payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/payments/:id/confirm', async (req, res) => {
  try {
    const { confirmed, adminName } = req.body;
    const payment = await Payment.findOne({ id: req.params.id });
    if (!payment) return res.status(404).json({ error: 'Payment record not found' });

    payment.confirmedByAdmin = confirmed !== false;
    payment.confirmedAt = confirmed !== false ? new Date() : undefined;
    payment.confirmedBy = confirmed !== false ? (adminName || 'Admin') : undefined;

    await payment.save();
    broadcastSSE('payment-updated', { payment });
    res.json({ success: true, payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Favorites ---
app.get('/api/favorites', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const favorites = await Favorite.find({ userId });
    res.json({ favorites });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/favorites', async (req, res) => {
  try {
    const { userId, appId, productName, estimatedPrice, link } = req.body;
    if (!userId || !appId || !productName) {
      return res.status(400).json({ error: 'userId, appId, and productName are required' });
    }

    let favorite = await Favorite.findOne({ userId, appId, productName });
    if (favorite) {
      favorite.estimatedPrice = estimatedPrice || 0;
      favorite.link = link || '';
    } else {
      favorite = new Favorite({
        id: generateId(),
        userId,
        appId,
        productName,
        estimatedPrice: estimatedPrice || 0,
        link: link || ''
      });
    }

    await favorite.save();
    broadcastSSE('favorite-added', { favorite });
    res.json({ success: true, favorite });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/favorites/:id', async (req, res) => {
  try {
    const favorite = await Favorite.findOneAndDelete({ id: req.params.id });
    if (!favorite) return res.status(404).json({ error: 'Favorite not found' });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Platform Free Delivery Thresholds ---
app.put('/api/session/thresholds', async (req, res) => {
  try {
    const { thresholds } = req.body;
    if (!thresholds || typeof thresholds !== 'object') {
      return res.status(400).json({ error: 'Thresholds object is required' });
    }

    const session = await getActiveSession();
    session.freeDeliveryThresholds = thresholds;
    await session.save();
    broadcastSSE('session-thresholds-updated', { thresholds, sessionId: session.id });
    res.json({ success: true, session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Session Split Mode ---
app.put('/api/session/split-mode', async (req, res) => {
  try {
    const { splitMode, customSplits } = req.body;
    const validModes = ['proportional', 'equal', 'custom'];
    if (!validModes.includes(splitMode)) {
      return res.status(400).json({ error: 'Invalid splitMode' });
    }

    const session = await getActiveSession();
    session.splitMode = splitMode;
    if (customSplits) {
      session.customSplits = customSplits;
    }
    await session.save();
    broadcastSSE('session-split-mode-updated', { splitMode, customSplits, sessionId: session.id });
    res.json({ success: true, session });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Settings (Admin) ---
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { upiId } = req.body;
    const settings = await getSettings();
    settings.upiId = upiId || '';
    await settings.save();
    res.json({ success: true, settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- MongoDB connection and App startup ---
mongoose.connect(MONGO_URI, {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(async () => {
    console.log('Connected to MongoDB successfully');
    
    // Perform data migration (awaited to prevent race condition)
    await migrateData();

    // Start Express app
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n  🛒 GroupCart is running!`);
      console.log(`  Local:   http://localhost:${PORT}`);

      // Get LAN IP
      const nets = require('os').networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          if (net.family === 'IPv4' && !net.internal) {
            console.log(`  Network: http://${net.address}:${PORT}`);
          }
        }
      }
      console.log(`\n  Admin password: ${ADMIN_PASSWORD}\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });
