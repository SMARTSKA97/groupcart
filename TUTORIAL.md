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
* When you look at the **Home** ("All Orders") screen, you will only see details of **your own orders**.
* Other users' orders are hidden to maintain privacy. However, you will see a summary header at the top of each platform showing the **total cost** of all active orders on that platform. This helps everyone check if the group has reached free-delivery or promo code thresholds.

### 4. Paying Your Share
Once the admin has placed the order and entered the final bills:
1. Navigate to the **Pay** (💰) tab.
2. Review the discount or surcharge applied to each platform, and see your exact calculated share.
3. If the admin has configured their UPI ID:
   * **On Mobile**: Tap the primary **Pay via UPI App** button. This automatically opens Google Pay, PhonePe, Paytm, or your default banking app with the payee, exact amount, and transaction note pre-filled.
   * **On Desktop**: Scan the displayed **UPI QR Code** using any UPI app on your phone.
   * **Alternative**: Click the **Copy** icon next to the UPI ID to copy it to your clipboard and pay manually.

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

### 4. Entering Final Bills
Once you place the order on the delivery app and get the final invoice:
1. Go to the **Admin** tab and look at **Enter Final Bills**.
2. Enter the **Actual amount paid** (including delivery fees, packaging, taxes, and after promo code discounts) for each platform.
3. Click **Save Bills**. The app will automatically calculate the proportional shares and discounts for all users.

### 5. Managing Sessions (Archiving History)
When everyone has paid and you are ready for a new order round:
1. Go to the **Admin** > **Session** section.
2. Click **Reset Session**.
3. You will be prompted to enter a **Session Name** (e.g. "Friday Pizza Night").
4. The system will close the current session, archiving all confirmed orders and bills, and spin up a clean, new active session.
5. Users can view past sessions at any time using the dropdown menu in the top bar.

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

