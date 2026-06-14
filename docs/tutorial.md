# 📖 GroupCart User & Admin Tutorial

This guide walks you through using GroupCart, from adding items to your cart, managing order sessions as an admin, and paying your share via UPI QR codes or mobile links.

---

## 👥 User Guide (For Group Members)

### 1. Logging In
1. Go to the GroupCart URL (e.g. `http://localhost` or `http://<HOST-IP>`) on your phone or computer.
2. Enter your name in the input box.
3. Click **Let's Go**. 
   *(No password is required for normal users; the app creates/remembers your username on the fly!)*

### 2. Adding Items to the Cart
1. Tap the **+** (floating action button) in the bottom right corner.
2. Select the **Delivery App** (e.g., Zepto, Blinkit, Instamart).
3. Enter the **Product Name** (e.g. "Amul Milk 1L").
4. (Optional) Paste the **Product Link** directly from the delivery app.
5. Set the **Quantity** and enter the **Estimated Price** (standard price shown in the app).
6. Tap **Add to Cart**. Your item will immediately appear in real-time for others.

### 3. Order Privacy
* When you look at the **Home** ("All Orders") tab:
  - If you are a **regular user**, you will see details of **your own orders** in full detail. For **other users' orders**, they are shown as aggregated summary cards (e.g. `Bob's Order`, displaying total items count and estimated price). Individual item names and links are hidden for other users to preserve privacy.
  - If you are an **admin**, you can see **everyone's orders in full detail** (with product names, links, quantities, and prices) to help you verify and coordinate the purchase.

### 4. Paying & Tracking Your Share
Once the admin has placed the order and entered the final bills:
1. Navigate to the **Pay** (💰) tab.
2. Review the discount or surcharge applied to each platform, and check your exact calculated share.
3. If the admin has configured their UPI ID:
   * **On Mobile**: Tap the button corresponding to your preferred payment app (GPay, PhonePe, Paytm, BHIM, Slice, CRED) or the **Pay via Default UPI App** button. This automatically opens the app with the payee UPI ID, exact amount, and formatted transaction remark pre-filled.
   * **On Desktop**: Scan the displayed **UPI QR Code** using any UPI app on your phone.
   * **Alternative**: Click the **Copy** button next to the UPI ID to copy it to your clipboard.
4. **Marking as Paid**: Once you make the payment, click the **"I Have Paid"** button at the bottom. 
   - Your payment status in the **Payment Statuses** table will update to `Paid` (blue badge).
   - Once the admin verifies the transfer, they will mark it as confirmed, updating your status to `Confirmed` (green badge).

### 5. Managing Favorites (Quick-Add Drawer)
You can save items that you order frequently for quick, one-click additions in future rounds:
1. Under the **Mine** tab, look at your order cards.
2. Tap the **Star (⭐)** icon on any card to add it to your favorites. Tap again to remove it.
3. To open your favorites, tap the **⭐ Favorites** toggle button at the top of the **Mine** tab. A drawer will slide open showing all your starred items.
4. Tap any favorite item inside the drawer, and it will immediately be added to the active cart with pre-filled details!

---

## ⚙️ Admin Guide (For Order Organizers)

### 1. Logging In as Admin
1. Open the login screen.
2. Check the **Login as Admin** checkbox.
3. Enter the admin password (default: `admin123`).
4. Click **Let's Go**. You will see the **Admin** tab appear in the navigation bar.

### 2. Configuring Your UPI ID (First-Time Setup)
To receive payments directly from users:
1. Go to the **Admin** tab.
2. Scroll to the **Admin Settings** section.
3. Enter your **UPI ID** (e.g., `yourname@okhdfcbank` or `yourphone@paytm`).
4. Click **Save UPI ID**. Users will now see payment buttons and QR codes.

### 3. Reviewing and Finalizing Orders
1. Go to the **Admin** tab and look at the **Order Board**.
2. As users add items, you can update their statuses:
   * Click the Checkmark (✅) to **Confirm** an item (meaning it's in your checkout cart).
   * Click **Confirm All Pending** to confirm all items on a specific app at once.
   * Click the Block (🚫) symbol to mark an item as **Out of Stock** (you can optionally add a note like "Replaced with 500ml").
3. You can edit the price of any item on the board to reflect the actual cart price before ordering. Click **Save Prices** to apply changes.

### 4. Entering Final Bills & Split Modes
Once you place the order on the delivery app and get the final invoice:
1. Go to the **Admin** tab and look at **Enter Final Bills**.
2. Enter the **Actual amount paid** (including delivery fees, packaging, taxes, and after promo code discounts) for each platform.
3. Click **Save Bills**. The app will automatically calculate the proportional shares and discounts for all users.
4. **Choose Split Mode**: Under the **Split Mode** section, select the desired distribution logic:
   - **Proportional Split** (Default): Splits bills based on the proportion of items ordered by each user.
   - **Equal Split**: Splits the total actual bill equally among all active users.
   - **Custom Split**: Select this to manually charge specific amounts. Input fields will appear for each user; enter the exact rupee amount to charge them and click **Save Custom Splits**.

### 5. Verifying & Confirming Payments
When users make payments, they will mark their bills as paid. You can track this on the Admin Dashboard:
1. Go to the **Admin** tab and locate the **Confirm Payments** panel.
2. Users who have clicked "I Have Paid" will display a blue **Paid** badge next to their calculated total.
3. Verify the transfer in your bank/UPI app.
4. Once verified, click **Confirm** on the dashboard. This updates their status badge to a green **Confirmed** badge in real-time.
5. If there is a dispute or mistake, you can reset their payment status back to **Unpaid**.

### 6. Setting Delivery Thresholds
To encourage group members to hit the free delivery target:
1. Go to the **Admin** tab and find the **Delivery Thresholds** section.
2. Enter the minimum amount required for free delivery (in rupees) for each active platform (e.g., `500` for Blinkit).
3. Click **Save Thresholds**. Real-time progress bars will immediately appear for all users under the Home tab.

### 7. Managing Sessions & Settle Naming
* **Settle Session**: When the ordering round is finished and you advance the session status to **Settled**:
  1. A custom modal will prompt you to enter a **Session Name** (e.g. "Friday Pizza Night").
  2. If left blank, it will automatically save using the current date and time.
  3. The current session will be closed as read-only.
* **Reset Session**: When everyone has paid and you are ready for a new order round:
  1. Go to the **Admin** > **Session** card.
  2. Click **Reset Session**.
  3. Enter a custom session name in the popup modal (or leave blank to auto-timestamp).
  4. The current session is settled and a fresh active session is created.
* **Session Selector**: Users can view past sessions at any time using the dropdown menu in the top bar.

### 8. Modern Dialog Overlays (SweetAlert2)
* Instead of native browser alert boxes, GroupCart now uses customized, theme-matching **SweetAlert2 popups** for all actions, such as confirmation when deleting items, removing platforms, or entering out-of-stock reasons.

---

## 🔧 Troubleshooting

* **My phone cannot load the page**: 
  Make sure your phone and computer are on the same Wi-Fi network. Check that you allowed port 80/3000 in your Windows Firewall, and that your connection profile is set to "Private".
* **Real-time updates stopped working**:
  If your browser goes to sleep, the SSE connection might disconnect. Simply refresh the page to reconnect.
* **The QR code isn't loading**:
  Ensure the host machine and client device have internet access, as the QR code is rendered via the standard public `api.qrserver.com` service.

---

## 📱 Seamless Item Sharing (Android PWA & iOS Shortcuts)

Instead of manually copy-pasting links, product names, and estimated prices, you can share items directly from delivery apps (**Zomato, Swiggy, Blinkit**) into GroupCart. This automatically parses the details (product name, link, platform, and price) and pre-fills the form!

### 🤖 Android Setup (PWA Share Target)

Android Chrome supports native PWA installation and the Web Share Target API. Follow these steps to set it up over your local network:

#### 1. Bypass Insecure Origin Security (Required for LAN testing)
Since you are accessing the app over local network HTTP (e.g., `http://10.176.100.97:3000`), Chrome blocks PWA installation by default. To bypass this check:
1. Open **Chrome** on your Android phone.
2. Navigate to: **`chrome://flags/#unsafely-treat-insecure-origin-as-secure`**
3. Under *“Insecure origins to treat as secure”*, enter your local server URL (e.g., `http://10.176.100.97:3000`).
4. Set the flag status to **Enabled**.
5. Tap **Relaunch** at the bottom of the screen.

#### 2. Install GroupCart
1. Open the app URL in Chrome (`http://10.176.100.97:3000`).
2. Tap the Chrome menu (three vertical dots) in the top-right.
3. Tap **Install App** (or **Install GroupCart**).
4. Wait 1-2 minutes for Google Play Services to compile and install the WebAPK in the background (you will see a notification saying *"GroupCart is ready"*).

#### 3. Share Items
1. Open **Zomato**, **Swiggy**, or **Blinkit** and select a product/dish.
2. Tap the **Share** button on the product page.
3. Select **GroupCart** from the list of apps in the Android Share Sheet.
4. The GroupCart app will open and immediately pop up the "Add Item" modal pre-filled with the parsed item name, price, link, and platform!

---

### 🍏 iOS Setup (Apple Shortcuts Workaround)

Apple's iOS blocks PWAs from receiving shared files/links natively. However, you can achieve the exact same 1-tap checkout experience using the built-in **Apple Shortcuts** app:

#### 1. Create the Shortcut
1. Open the **Shortcuts** app on your iPhone.
2. Tap the **`+`** icon (top right) to create a new shortcut. Name it **"Add to GroupCart"**.
3. Tap the **info icon `(i)`** at the bottom of the screen (or the settings menu) and toggle on **Show in Share Sheet**.
4. Set the input line at the top to:
   > Receive **URLs** and **Text** from **Share Sheet**.
5. Add the first action: **URL**.
   * Set the URL string to: `http://10.176.100.97:3000/?text=`
   * Select the **Shortcut Input** variable to place it right at the end of the URL (e.g., `http://10.176.100.97:3000/?text=Shortcut%20Input`).
6. Add the second action: **Open URLs** (this opens Safari).
7. Tap Done to save the shortcut.

#### 2. Share Items
1. Open **Zomato** or **Swiggy** on your iPhone.
2. Select an item/dish and tap **Share**.
3. Scroll down in the native iOS share sheet and tap **Add to GroupCart**.
4. Safari will launch, open the GroupCart webpage, automatically parse the text, and display the "Add Item" modal pre-filled and ready to submit!

