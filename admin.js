// =================================================================
// === 🟢 admin.js - ฉบับรวมสมบูรณ์ (พร้อม LINE Notification Logic) ===
// =================================================================

// 1. **[CONFIG] ข้อมูล Firebase และ LINE API**
const firebaseConfig = {
    apiKey: "AIzaSyCs3_LcJN5RfOIo9jZ4fnz1CBl8hXqfvig",
    authDomain: "kc-tobe-friendcorner-21655.firebaseapp.com",
    databaseURL: "https://kc-tobe-friendcorner-21655-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "kc-tobe-friendcorner-21655",
    storageBucket: "kc-tobe-friendcorner-21655.firebasestorage.app",
    messagingSenderId: "722433178265",
    appId: "1:722433178265:web:f7369aa65b3063a8ab1608"
};

const ADMIN_UID = "o139Nm6N3wSW25fCtAzwf2ymfSm2"; // UID ของผู้ดูแลระบบที่ได้รับอนุญาต
const ADMIN_UID_TO_HIDE = 'o139Nm6N3wSW25fCtAzwf2ymfSm2'; // 🚩 เปลี่ยนเป็น UID ของ Admin จริง

// 🔑 [สำคัญมาก] ส่วนนี้ต้องเปลี่ยน
const ADMIN_LINE_ID = "Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"; // 🚨 CRITICAL: เปลี่ยนเป็น User ID หรือ Group ID ของ Admin ที่รับแจ้งเตือนใน LINE
const LINE_ACCESS_TOKEN = "ECRO36u9CNaNzQZo2rJfzEeSo66rG+lBmApfBToqIKmqaS5fv9sbXf2+y17xGiqJRdXCdEUVJMsKuCayTQaEdV915gPwPEPYEF0+UTTyJiz1iBrLici8N4wMz1J8KqLqTZ9/H749IvzrWcXgi7bu6AdB04t89/1O/w1cDnyilFU="; // 🚨 CRITICAL: ใส่ Channel Access Token จาก LINE Developers Console ที่นี่
// ⚠️ คำเตือน: การใส่ Token ใน Client-Side Code มีความเสี่ยงด้านความปลอดภัย

// 2. **[Declaration] ประกาศตัวแปร Global**
let auth = null;
let database = null;
let TIMESTAMP = null;
let isFirebaseReady = false;

let activeChatId = null;
let chatListeners = {}; // ใช้เก็บ listeners ของ Firebase
const CHATS_PATH = 'chats';
const MESSAGES_SUB_PATH = 'messages';
let currentListType = 'active';
const ERROR_MESSAGE_ELEMENT_ID = 'errorMessage';

// ** โค้ดทั้งหมดจะอยู่ใน DOMContentLoaded เพื่อความปลอดภัยในการโหลด Firebase SDK **
document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // === 1. FIREBASE INITIALIZATION & AUTH ===
    // =================================================================

    // 3. **[FUNCTION] ฟังก์ชันเริ่มต้น Firebase (หัวใจสำคัญ)**
    function initializeFirebase() {
        if (typeof firebase === 'undefined' || typeof firebase.initializeApp === 'undefined') {
            console.error("CRITICAL: 'firebase' SDKs are not fully loaded.");
            const errorEl = document.getElementById(ERROR_MESSAGE_ELEMENT_ID);
            if (errorEl) {
                errorEl.textContent = 'ข้อผิดพลาด: ไม่พบ Firebase SDKs (โปรดตรวจสอบ admin.html)';
                errorEl.style.display = 'block';
            }
            return;
        }

        try {
            // 🚩 [FIX] ตรวจสอบว่า Firebase ถูก Initialized แล้วหรือไม่ (ป้องกันการ Initialize ซ้ำ)
            if (firebase.apps.length === 0) {
                firebase.initializeApp(firebaseConfig);
            }
            const app = firebase.app();

            auth = app.auth();
            database = app.database();

            if (database) {
                try {
                    // ใช้ .ServerValue.TIMESTAMP เพื่อให้ Firebase กำหนดเวลาจาก Server
                    TIMESTAMP = database.ServerValue.TIMESTAMP;
                    console.log("Firebase initialized successfully. TIMESTAMP is ready.");
                } catch (timestampError) {
                    console.warn("Firebase Initialization Warning: database.ServerValue is not immediately ready. Proceeding with Auth setup.");
                }

                isFirebaseReady = true;
                setupAuthStateListener();
                document.getElementById('errorMessage').style.display = 'none';

            } else {
                throw new Error("Database service is null.");
            }
        } catch (e) {
            console.error("Firebase Initialization Error:", e.message);
            const errorEl = document.getElementById(ERROR_MESSAGE_ELEMENT_ID);
            if (errorEl) {
                errorEl.textContent = `ระบบ Firebase ไม่พร้อม (โปรดตรวจสอบ Console)`;
                errorEl.style.display = 'block';
            }
        }
    }

    // 4. **[EXECUTION] เรียกใช้ฟังก์ชัน Initialization**
    initializeFirebase();

    // =================================================================
    // === 2. UTILITY & FORMATTING FUNCTIONS ===
    // =================================================================

    // 🚩 [NEW] ฟังก์ชันสำหรับส่งแจ้งเตือนไปยัง LINE Official Account (ใช้ Messaging API)
    async function sendLineNotification(messageText) {
        if (!LINE_ACCESS_TOKEN || !ADMIN_LINE_ID || LINE_ACCESS_TOKEN === "YOUR_LINE_CHANNEL_ACCESS_TOKEN") {
            console.error("LINE Notification failed: LINE_ACCESS_TOKEN or ADMIN_LINE_ID is not configured.");
            return;
        }

        const apiEndpoint = "https://api.line.me/v2/bot/message/push";

        const payload = {
            to: ADMIN_LINE_ID,
            messages: [{
                type: "text",
                text: messageText,
            }],
        };

        try {
            // ใช้ fetch API ในการส่งข้อมูลไปยัง LINE API
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                console.log("LINE notification sent successfully.");
            } else {
                // ดึง Error จาก LINE API
                const errorData = await response.json();
                console.error("Failed to send LINE notification:", response.status, errorData);
            }
        } catch (error) {
            console.error("Error connecting to LINE API:", error);
        }
    }

    function playNotifySound() {
        const soundEl = document.getElementById('notifySound');
        if (soundEl && soundEl.getAttribute('src')) {
            soundEl.currentTime = 0;
            soundEl.play().catch(e => {
                console.warn("Sound play error (Autoplay blocked/Check notify.mp3 path):", e);
            });
        } else {
            console.warn("Notification sound element or path not set.");
        }
    }

    function requestNotificationPermission() {
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') {
                        console.log("Notification permission granted.");
                    }
                });
            }
        }
    }

    function showWebNotification(title, body, tag) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const options = {
                body: body,
                icon: 'KC.png',
                tag: tag || 'new-chat-message',
                renotify: true
            };

            const notification = new Notification(title, options);

            notification.onclick = function () {
                window.focus();
            };
        }
    }

    // ฟังก์ชันสำหรับจัดรูปแบบเวลาสั้น ๆ (HH:MM)
    function formatTime(timestamp) {
        if (!timestamp) return 'เวลาไม่ระบุ';
        const date = new Date(timestamp);
        // [FIX]: ป้องกัน Error ถ้า timestamp เป็น String
        if (isNaN(date.getTime())) return 'เวลาไม่ถูกต้อง';
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // ฟังก์ชันสำหรับจัดรูปแบบ วันที่/เวลา เต็มรูปแบบ (HH:MM DD/MM/YYYY)
    function formatDateTime(timestamp) {
        if (!timestamp) return 'วันที่ไม่ระบุ';
        const date = new Date(timestamp);
        // [FIX]: ป้องกัน Error ถ้า timestamp เป็น String
        if (isNaN(date.getTime())) return 'วันที่ไม่ถูกต้อง';

        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        // รูปแบบ: HH:MM DD/MM/YYYY (ใช้ปีคริสต์ศักราช หรือปีที่เหมาะสมกับความต้องการ)
        return `${hours}:${minutes} ${day}/${month}/${year}`;
    }

    function showTemporaryMessage(message, isError = false) {
        let messageEl = document.getElementById('temporaryMessage');
        // ลองใช้ element อื่นถ้า #temporaryMessage ไม่มี
        if (!messageEl) {
            messageEl = document.getElementById('adminPanelMessage');
            if (!messageEl) return;
        }

        messageEl.textContent = message;
        messageEl.style.display = 'block';

        // 🚩 ปรับสีให้เห็นชัดเจนขึ้น
        if (isError) {
            messageEl.style.backgroundColor = '#dc3545';
            messageEl.style.color = '#fff';
        } else {
            messageEl.style.backgroundColor = 'var(--primary-color)';
            messageEl.style.color = '#fff';
        }

        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 4000);
    }

    // =================================================================
    // === 3. CONTEXT MENU & MESSAGE DELETION LOGIC (แก้ไข) ===
    // =================================================================

    // ฟังก์ชันสำหรับซ่อนเมนูที่แสดงอยู่ (อัปเดต logic การล้าง position)
    function hideContextMenu() {
        const existingMenu = document.querySelector('.temp-context-menu');
        if (existingMenu) {
            // 🔑 [FIX]: ค้นหา Element แม่ที่ทำหน้าที่เป็นตัวอ้างอิงตำแหน่ง (คือ bubble)
            const referenceElement = existingMenu.parentElement;

            // 1. ลบ Event Listeners ออกก่อน
            document.removeEventListener('click', hideContextMenu);
            document.removeEventListener('contextmenu', hideContextMenu);
            const chatBox = document.getElementById('chatBox');
            if (chatBox) {
                chatBox.removeEventListener('scroll', hideContextMenu);
            }

            // 2. ลบเมนูออก และล้าง style position: relative ที่เคยใส่ไว้ใน Bubble ออก
            if (referenceElement) {
                // ล้าง style position: relative ที่เราใส่ใน Bubble
                referenceElement.style.position = '';
                referenceElement.removeChild(existingMenu);
            }
        }
    }

    // ฟังก์ชันสำหรับแสดงเมนู (อัปเดต Signature เพื่อรับ bubbleElement)
    function showContextMenu(e, chatId, messageId, messageSender, bubbleElement) {
        // เราจะอนุญาตให้ Admin ลบข้อความของตัวเองเท่านั้น
        if (messageSender !== 'admin' || currentListType === 'history') {
            return;
        }

        // 1. ป้องกันการแสดงผล Context Menu ดั้งเดิมของเบราว์เซอร์
        e.preventDefault();
        // 🔑 [NEW] หยุด Propagation เพื่อป้องกันปัญหา Event ที่ container
        e.stopPropagation();

        // 2. ซ่อนเมนูที่เปิดอยู่ก่อน (ถ้ามี)
        hideContextMenu();

        // 3. 🔑 [FIX]: ใช้ bubbleElement เป็นตัวอ้างอิงตำแหน่ง (ถ้ามีการส่งมา)
        const referenceElement = bubbleElement || e.currentTarget.querySelector('.message-bubble');

        // ถ้าหา bubble ไม่เจอ (ไม่ควรเกิด) ให้ใช้ messageContainer ไปก่อน
        if (!referenceElement) return;

        // 4. บังคับให้ Bubble แม่มี position: relative
        // **เนื่องจากเราจะใช้ position: absolute บนเมนู contextMenu จะลอยไปตาม Bubble นี้**
        referenceElement.style.position = 'relative';

        // 5. สร้าง Context Menu Element ใหม่
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu temp-context-menu';
        contextMenu.setAttribute('data-message-id', messageId);
        contextMenu.setAttribute('data-chat-id', chatId);
        contextMenu.setAttribute('data-sender', messageSender); // ค่าจะเป็น 'admin' หรือ 'user'
        // 🔑 [NEW]: ไม่จำเป็นต้องตั้งค่า top/left/right/bottom ใน JS ถ้าใช้ CSS ที่ถูกต้อง
        // โดยจะใช้ CSS กำหนดตำแหน่ง top: 0; left: 0; เพื่อให้ไปอยู่มุมซ้ายบนของ Bubble

        // 6. สร้างตัวเลือก 'ยกเลิกข้อความ'
        const deleteOption = document.createElement('div');
        deleteOption.className = 'context-menu-item delete';
        deleteOption.innerHTML = `<i class="fas fa-trash-alt"></i> ยกเลิกข้อความ`;

        deleteOption.onclick = (event) => {
            event.stopPropagation();
            hideContextMenu();

            if (window.confirm('ยืนยันการยกเลิกข้อความนี้? ผู้ใช้จะเห็นเป็น "ข้อความถูกยกเลิกการส่ง"')) {
                window.deleteMessage(chatId, messageId);
            }
        };

        contextMenu.appendChild(deleteOption);
        contextMenu.onclick = (event) => event.stopPropagation(); // หยุดการ Propagation เมื่อคลิกบน Menu

        // 7. เพิ่ม Context Menu เข้าไปเป็น Child ของ Bubble ข้อความ
        referenceElement.appendChild(contextMenu);

        // 8. เพิ่ม Event Listener เพื่อซ่อนเมนูเมื่อคลิกนอกพื้นที่หรือ Scroll
        const chatBox = document.getElementById('chatBox');
        if (chatBox) {
            chatBox.addEventListener('scroll', hideContextMenu);
        }

        // 9. แสดงเมนู
        setTimeout(() => {
            contextMenu.classList.add('show');
            document.addEventListener('click', hideContextMenu, { once: true });
            document.addEventListener('contextmenu', hideContextMenu, { once: true });
        }, 10);
    }

    // 🚩 [IMPORTANT]: ผูกฟังก์ชันเข้ากับ Global Scope เพื่อให้ HTML ใน appendMessage เรียกได้
    window.showContextMenu = showContextMenu;
    window.hideContextMenu = hideContextMenu;

    // ฟังก์ชันยกเลิกการส่งข้อความโดย Admin
    window.deleteMessage = function (chatId, messageId) {
        if (!isFirebaseReady || !database) {
            showTemporaryMessage("Firebase Database ไม่พร้อมใช้งาน", true);
            return;
        }

        // อัปเดต node ข้อความให้มี property 'deleted: true' และลบ 'text' ออก
        database.ref(`${CHATS_PATH}/${chatId}/${MESSAGES_SUB_PATH}/${messageId}`).update({
            text: null,     // ลบข้อความจริงออกจากฐานข้อมูล
            deleted: true,  // ตั้งค่าสถานะว่าถูกลบแล้ว
            deletedAt: Date.now() // บันทึกเวลาที่ลบ
        })
            .then(() => {
                showTemporaryMessage("ยกเลิกการส่งข้อความสำเร็จ");
            })
            .catch(error => {
                console.error("Error deleting message:", error);
                showTemporaryMessage("เกิดข้อผิดพลาดในการยกเลิกการส่งข้อความ", true);
            });
    };

    // =================================================================
    // === 4. NAVIGATION & SCREEN MANAGEMENT ===
    // =================================================================

    function setupAuthStateListener() {
        if (!auth) return;

        auth.onIdTokenChanged(function (user) {
            if (user) {
                if (user.uid === ADMIN_UID) {
                    console.log("ADMIN: Authenticated and authorized.");
                    showWelcomeScreen();
                    requestNotificationPermission();
                } else {
                    console.warn("ADMIN: User is logged in but not the authorized ADMIN_UID.");
                    auth.signOut();
                    showLoginScreen();
                }
            } else {
                showLoginScreen();
            }
        });
    }

    function cancelAllListeners() {
        if (!database) return;
        // ยกเลิก Listener ข้อความของแชทที่เคยเปิดอยู่
        if (chatListeners.messages) {
            const messagesRef = database.ref(`${CHATS_PATH}/${chatListeners.messages.chatId}/${MESSAGES_SUB_PATH}`);
            // ยกเลิกทั้ง child_added และ child_changed
            messagesRef.off('child_added', chatListeners.messages.callback);
            messagesRef.off('child_changed', chatListeners.messages.callback);
            delete chatListeners.messages;
            console.log(`Unsubscribed from old chat.`);
        }
        // ยกเลิก Listener ของ Active Chat List
        if (chatListeners.active && chatListeners.active.ref) {
            chatListeners.active.ref.off('value', chatListeners.active.callback);
            delete chatListeners.active; // ลบออกจาก chatListeners
            console.log('Unsubscribed from active chat list.');
        }
        // ยกเลิก Listener ของ History Chat List
        if (chatListeners.history && chatListeners.history.ref) {
            chatListeners.history.ref.off('value', chatListeners.history.callback);
            delete chatListeners.history;
            console.log('Unsubscribed from history chat list.');
        }
        activeChatId = null;
    }


    function hideAllScreens() {
        const loginScreen = document.getElementById('loginScreen');
        const welcomeScreen = document.getElementById('welcomeScreen');
        const adminPanelContainer = document.getElementById('adminPanelContainer');
        const listScreen = document.getElementById('listScreen');
        const historyScreen = document.getElementById('historyScreen');
        const chatScreenContainer = document.getElementById('chatScreenContainer');


        if (loginScreen) loginScreen.style.display = 'none';
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (adminPanelContainer) adminPanelContainer.style.display = 'none';
        if (listScreen) listScreen.style.display = 'none';
        if (historyScreen) historyScreen.style.display = 'none';
        if (chatScreenContainer) chatScreenContainer.style.display = 'none';

        hideContextMenu();
    }

    function showLoginScreen() {
        hideAllScreens();
        cancelAllListeners();
        const loginScreenEl = document.getElementById('loginScreen');
        const errorEl = document.getElementById(ERROR_MESSAGE_ELEMENT_ID);
        if (loginScreenEl) {
            loginScreenEl.style.display = 'flex';
            if (errorEl) {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
        }
    }

    window.showWelcomeScreen = function () {
        hideAllScreens();
        cancelAllListeners();
        activeChatId = null;
        const welcomeScreenEl = document.getElementById('welcomeScreen');
        if (welcomeScreenEl) {
            welcomeScreenEl.style.display = 'flex';
        }
    }

    window.showListScreen = function (type) {
        hideAllScreens();
        cancelAllListeners(); // 🔑 ยกเลิก Listener เก่าทั้งหมดก่อนเริ่ม Listener ใหม่
        currentListType = type;

        const adminPanelContainer = document.getElementById('adminPanelContainer');
        const listScreenEl = document.getElementById('listScreen');
        const historyScreenEl = document.getElementById('historyScreen');
        const chatScreenContainer = document.getElementById('chatScreenContainer');

        // 🔑 Clear list content before loading
        const chatListEl = document.getElementById('chatList');
        const historyListEl = document.getElementById('historyList');
        if (chatListEl) chatListEl.innerHTML = '';
        if (historyListEl) historyListEl.innerHTML = '';

        if (adminPanelContainer) adminPanelContainer.style.display = 'flex';
        if (chatScreenContainer) chatScreenContainer.style.display = 'none';

        if (type === 'active') {
            if (historyScreenEl) historyScreenEl.style.display = 'none';
            if (listScreenEl) {
                listScreenEl.style.display = 'flex'; // แสดง Active List Screen
                const titleEl = listScreenEl.querySelector('.panel-title');
                if (titleEl) titleEl.textContent = '🟢 ห้องสนทนาที่เปิดอยู่';
            }
            loadChatList();
        } else if (type === 'history') {
            if (listScreenEl) listScreenEl.style.display = 'none';
            if (historyScreenEl) {
                historyScreenEl.style.display = 'flex'; // แสดง History List Screen
                const titleEl = historyScreenEl.querySelector('.panel-title');
                if (titleEl) titleEl.textContent = '🔴 ประวัติแชทที่สิ้นสุดแล้ว';
            }
            loadHistoryList();
        }
    }

    function showChatViewScreen(chatId, isHistory = false) {
        // 🔑 [CRITICAL FIX]: ยกเลิก Listener ข้อความทั้งหมดของแชทเดิมก่อน
        cancelAllListeners();

        activeChatId = chatId; // 🚩 [FIXED] ต้องกำหนด activeChatId ด้วย
        currentListType = isHistory ? 'history' : 'active'; // อัปเดตประเภทรายการปัจจุบัน

        const adminPanelContainer = document.getElementById('adminPanelContainer');
        const listScreen = document.getElementById('listScreen');
        const historyScreen = document.getElementById('historyScreen');
        const chatScreenContainer = document.getElementById('chatScreenContainer');
        const currentUserIDSpan = document.getElementById('currentUserID');
        const endChatButton = document.getElementById('endChatButton');
        const deleteChatButton = document.getElementById('deleteChatButton');
        const inputArea = chatScreenContainer ? chatScreenContainer.querySelector('.input-area') : null;
        const backButton = document.getElementById('backButton');
        const chatBox = document.getElementById('chatBox');

        hideAllScreens(); // ปิดหน้าจออื่นๆ ก่อน

        if (adminPanelContainer) adminPanelContainer.style.display = 'flex';
        if (listScreen) listScreen.style.display = 'none';
        if (historyScreen) historyScreen.style.display = 'none';
        if (chatScreenContainer) chatScreenContainer.style.display = 'flex';

        // Clear old messages and title
        if (chatBox) chatBox.innerHTML = '';
        if (currentUserIDSpan) currentUserIDSpan.textContent = `${chatId.substring(0, 8)}...`;

        // Setup Chat Header and Input Area
        if (endChatButton) {
            if (isHistory) {
                endChatButton.style.display = 'none';
            } else {
                // 🚩 [ACTIVE MODE]: แสดงปุ่ม 'จบการสนทนา'
                endChatButton.style.display = 'block';
                endChatButton.innerHTML = '<i class="fas fa-power-off"></i> จบการสนทนา';
                endChatButton.classList.remove('danger-button');
                endChatButton.classList.add('primary-button');
            }
        }

        if (deleteChatButton) {
            if (isHistory) {
                // 🚩 [HISTORY MODE]: แสดงปุ่ม 'ลบการสนทนาถาวร'
                deleteChatButton.style.display = 'block';
                deleteChatButton.innerHTML = '<i class="fas fa-trash-alt"></i> ลบแชทถาวร';
                deleteChatButton.classList.remove('primary-button');
                deleteChatButton.classList.add('danger-button');
                deleteChatButton.title = 'คำเตือน: การลบนี้ไม่สามารถย้อนกลับได้';
            } else {
                deleteChatButton.style.display = 'none';
            }
        }

        if (inputArea) {
            inputArea.style.display = isHistory ? 'none' : 'flex';
        }
        if (backButton) {
            backButton.textContent = 'รายการแชท';
        }

        // 🚩 Start listening for messages (พร้อมส่ง isHistory ไปด้วย)
        listenForMessages(chatId, isHistory);

        // Scroll to bottom after a slight delay for rendering
        setTimeout(() => {
            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }, 100);
    }

    // 🚩 [IMPORTANT]: กำหนดให้เป็น window/global function
    window.selectChat = function (chatId) {
        if (!isFirebaseReady || !database) {
            showTemporaryMessage("Firebase Database ไม่พร้อมใช้งาน", true);
            return;
        }

        // Remove active class from all items
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));

        activeChatId = chatId;
        const currentItem = document.getElementById('chat-' + activeChatId);
        if (currentItem) {
            currentItem.classList.add('active');
            currentItem.classList.remove('unread');
            const dot = currentItem.querySelector('.unread-dot');
            if (dot) dot.remove();
        }

        database.ref(`${CHATS_PATH}/${chatId}`).update({
            unreadByAdmin: false
        })
            .then(() => {
                showChatViewScreen(chatId, false);
            })
            .catch(error => {
                console.error("Error updating unread status:", error);
                showChatViewScreen(chatId, false); // ยังคงเปิดหน้าแชทได้
            });
    }

    window.selectHistoryChat = function (chatId) {
        if (!isFirebaseReady) return;

        // Remove active class from all items
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));

        activeChatId = null; // ไม่ต้องเซ็ต activeChatId ใน History Mode

        const currentItem = document.getElementById('history-' + chatId);
        if (currentItem) {
            currentItem.classList.add('active');
        }
        // 🚩 ส่ง true (isHistory) เข้าไป
        showChatViewScreen(chatId, true);
    }

    // =================================================================
    // === 5. CHAT LIST HANDLERS (ACTIVE & HISTORY) ===
    // =================================================================

    // 🔑 [MODIFIED]: แก้ไขโครงสร้าง HTML เพื่อให้รองรับการเรียงแนวตั้ง
    function renderChatItem(chatData, chatId, activeChatId) {
        const chatListEl = document.getElementById('chatList');
        if (!chatListEl) return null;

        let item = document.getElementById('chat-' + chatId);
        if (!item) {
            item = document.createElement('div');
            item.id = 'chat-' + chatId;
            item.className = 'chat-item';
            item.onclick = () => selectChat(chatId);
            chatListEl.appendChild(item);
        }

        const lastMessageText = chatData.lastMessage ? (chatData.lastMessage.text || chatData.lastMessage.message || 'ไม่มีข้อความล่าสุด') : 'ไม่มีข้อความล่าสุด';

        // 🟢 [ปรับปรุง]: ใช้ formatDateTime
        const lastActivityTime = chatData.lastActivity ? formatDateTime(chatData.lastActivity) : '';

        const unreadDot = chatData.unreadByAdmin ? '<span class="unread-dot"></span>' : '';

        // 🚩 [STATUS]: แสดงสถานะ [Active]
        const statusDisplay = '<span class="status-active" style="color: #28a745; font-size: 10px; font-weight: 500;">[Active]</span>';

        // 🔑 โครงสร้างใหม่: ใช้ .chat-info-container เพื่อจัด ID/Message/Time เป็นแนวตั้ง
        // *คุณต้องเพิ่ม CSS สำหรับ .chat-info-container เพื่อใช้ display: flex และ flex-direction: column
        item.innerHTML = `
            <div class="chat-info-container"> 
                <p style="margin-bottom: 2px;">
                    <strong>ID: <span class="chat-id">${chatId.substring(0, 8)}...</span></strong>
                    ${statusDisplay} ${unreadDot}
                </p>
                <p class="chat-owner" style="font-size:12px; color:#555; margin-bottom: 2px;">
                    ${lastMessageText}
                </p>
                <p class="chat-time" style="font-size:10px; color:#999; margin: 0;">
                    ล่าสุด: ${lastActivityTime}
                </p>
            </div>
        `;

        item.className = 'chat-item';
        if (chatData.unreadByAdmin && activeChatId !== chatId) {
            item.classList.add('unread');
        } else {
            item.classList.remove('unread');
        }
        if (activeChatId === chatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }

        return item;
    }

    function loadChatList() {
        if (!isFirebaseReady || !auth || !database || !auth.currentUser) {
            const chatListEl = document.getElementById('chatList');
            if (chatListEl) {
                chatListEl.innerHTML = '<p style="padding: 15px; color:#dc3545; text-align:center;">ไม่ได้รับอนุญาตให้โหลดรายการ (กรุณาล็อกอิน Admin)</p>';
            }
            return;
        }

        const chatListRef = database.ref(CHATS_PATH);
        const chatListEl = document.getElementById('chatList');
        if (!chatListEl) return;

        // ยกเลิก Listener เดิมถ้ามี
        if (chatListeners.active) {
            chatListRef.off('value', chatListeners.active.callback);
            delete chatListeners.active;
        }

        chatListEl.innerHTML = '<p id="loadingActiveChats" style="padding: 15px; color:#777; text-align:center;">กำลังโหลด...</p>';

        const callback = (snapshot) => {
            const chats = [];
            let newUnreadCount = 0;

            snapshot.forEach(childSnapshot => {
                const chatData = childSnapshot.val();

                // 1. ตรวจสอบ User Logged Out เพื่อปิดแชทอัตโนมัติ (หลังผ่านไป 10 นาที)
                if (chatData && chatData.status === 'active' && chatData.isLoggedOut === true) {
                    if (Date.now() - (chatData.lastActivity || 0) > 600000) { // 10 minutes (600,000 ms)
                        window.closeChat(childSnapshot.key, false);
                    }
                    return;
                }

                // 🚩 เงื่อนไข: ต้องเป็น 'active' และไม่มี closedAt
                if (chatData && chatData.status === 'active' && !chatData.closedAt) {
                    chatData.id = childSnapshot.key;
                    chats.push(chatData);

                    if (chatData.unreadByAdmin && childSnapshot.key !== activeChatId) {
                        newUnreadCount++;
                    }
                } else if (chatData && childSnapshot.key === activeChatId && chatData.status !== 'active') {
                    // แชทที่กำลังดูอยู่ถูกปิดไปแล้ว
                    showTemporaryMessage(`แชท ID: ${activeChatId.substring(0, 8)}... ถูกปิดแล้ว`, true);
                    activeChatId = null;
                    showListScreen('active');
                }
            });

            // เรียงลำดับ: Unread ก่อน, ตามด้วย Last Activity ล่าสุด
            chats.sort((a, b) => {
                if (a.unreadByAdmin && !b.unreadByAdmin) return -1;
                if (!a.unreadByAdmin && b.unreadByAdmin) return 1;
                return (b.lastActivity || 0) - (a.lastActivity || 0);
            });

            chatListEl.innerHTML = '';
            if (chats.length === 0) {
                chatListEl.innerHTML = '<p style="padding: 15px; color:#777; text-align:center;">ไม่มีห้องสนทนาที่เปิดอยู่</p>';
            } else {
                chats.forEach(chat => renderChatItem(chat, chat.id, activeChatId));
            }

            // Notification Logic
            if (newUnreadCount > 0) {
                playNotifySound();
                showWebNotification(`ข้อความใหม่ (${newUnreadCount} แชท)`, `มี ${newUnreadCount} แชทที่รอการตอบกลับ`, 'new-chat-list-update');
            }
        };

        // กำหนด Listener ใหม่
        chatListeners.active = { ref: chatListRef, callback: callback };
        chatListRef.on('value', callback);
    }


    // 1. ฟังก์ชันแสดงรายการแชทที่สิ้นสุดแล้ว (History)
    // 🔑 [MODIFIED]: แก้ไขโครงสร้าง HTML เพื่อให้รองรับการเรียงแนวตั้ง
    function renderHistoryItem(chatData, chatId, activeChatId) {
        const historyListEl = document.getElementById('historyList');
        if (!historyListEl) return null;

        let item = document.getElementById('history-' + chatId);
        let deleteBtn;

        // 🔑 ถ้า item ยังไม่มี
        if (!item) {
            item = document.createElement('div');
            item.id = 'history-' + chatId;
            item.className = 'chat-item history-item';
            item.onclick = () => selectHistoryChat(chatId);
            historyListEl.appendChild(item);

            deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-chat-history-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';

            // 🔑 [IMPORTANT]: ผูก Event ลบแชท
            deleteBtn.onclick = (e) => {
                e.stopPropagation(); // 🔑 หยุดไม่ให้ Event เปิดแชททำงาน
                if (window.confirm(`ยืนยันการลบประวัติแชท ID: ${chatId.substring(0, 8)}... อย่างถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
                    window.deleteChatPermanently(chatId);
                }
            };
        } else {
            // ถ้า Item มีอยู่แล้ว ให้หาปุ่มลบเดิม
            deleteBtn = item.querySelector('.delete-chat-history-btn');
            if (!deleteBtn) {
                // สร้างใหม่ถ้าหายไป (กรณีมีการ InnerHTML ใหม่)
                deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-chat-history-btn';
                deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (window.confirm(`ยืนยันการลบประวัติแชท ID: ${chatId.substring(0, 8)}... อย่างถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้`)) {
                        window.deleteChatPermanently(chatId);
                    }
                };
            }
        }

        const lastMessageText = chatData.lastMessage ? (chatData.lastMessage.text || chatData.lastMessage.message || 'สิ้นสุดการสนทนา') : 'สิ้นสุดการสนทนา';
        const lastActivityTime = chatData.closedAt ? formatDateTime(chatData.closedAt) : (chatData.lastActivity ? formatDateTime(chatData.lastActivity) : '');
        const statusDisplay = '<span class="status-closed" style="color: #dc3545; font-size: 10px; font-weight: 500;">[Closed]</span>';

        // 🔑 โครงสร้างใหม่: ใช้ .chat-info-container เพื่อจัด ID/Message/Time เป็นแนวตั้ง
        item.innerHTML = `
            <div class="chat-info-container chat-item-content">
                <p style="margin-bottom: 2px;">
                    <strong>ID: <span class="chat-id">${chatId.substring(0, 8)}...</span></strong>
                    ${statusDisplay}
                </p>
                <p class="chat-owner" style="font-size:12px; color:#555; margin-bottom: 2px;">
                    ${lastMessageText}
                </p>
                <p class="chat-time" style="font-size:10px; color:#999; margin: 0;">
                    ปิดเมื่อ: ${lastActivityTime}
                </p>
            </div>
        `;

        // 🔑 [RE-APPEND]: นำปุ่มที่สร้างไว้กลับมาใส่ใน item
        item.appendChild(deleteBtn);

        item.className = 'chat-item history-item';
        if (activeChatId === chatId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }

        return item;
    }

    function loadHistoryList() {
        if (!isFirebaseReady || !auth || !database || !auth.currentUser) {
            const historyListEl = document.getElementById('historyList');
            if (historyListEl) {
                historyListEl.innerHTML = '<p style="padding: 15px; color:#dc3545; text-align:center;">ไม่ได้รับอนุญาตให้โหลดรายการ (กรุณาล็อกอิน Admin)</p>';
            }
            return;
        }

        const historyListRef = database.ref(CHATS_PATH);
        const historyListEl = document.getElementById('historyList');
        if (!historyListEl) return;

        // ยกเลิก Listener เดิมถ้ามี
        if (chatListeners.history) {
            historyListRef.off('value', chatListeners.history.callback);
            delete chatListeners.history;
        }

        historyListEl.innerHTML = '<p id="loadingHistoryChats" style="padding: 15px; color:#777; text-align:center;">กำลังโหลด...</p>';

        const callback = (snapshot) => {
            const historyChats = [];
            snapshot.forEach(childSnapshot => {
                const chatData = childSnapshot.val();
                // 🚩 เงื่อนไข: ต้องเป็น 'closed' และมี closedAt
                if (chatData && chatData.status === 'closed' && chatData.closedAt) {
                    chatData.id = childSnapshot.key;
                    historyChats.push(chatData);
                }
            });

            // เรียงลำดับ: Closed At ล่าสุด
            historyChats.sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));

            historyListEl.innerHTML = '';
            if (historyChats.length === 0) {
                historyListEl.innerHTML = '<p style="padding: 15px; color:#777; text-align:center;">ไม่มีประวัติแชท</p>';
            } else {
                historyChats.forEach(chat => renderHistoryItem(chat, chat.id, activeChatId));
            }
        };

        // กำหนด Listener ใหม่
        chatListeners.history = { ref: historyListRef, callback: callback };
        historyListRef.on('value', callback);
    }

    // =================================================================
    // === 6. CHAT INTERACTION & CORE MESSAGE HANDLERS ===
    // =================================================================

    // 🚩 [NEW FUNCTION] ฟังก์ชันลบแชทออกจากฐานข้อมูลอย่างถาวร (ใช้ใน History Mode)
    window.deleteChatPermanently = function (chatId) {
        if (!isFirebaseReady || !database) {
            showTemporaryMessage("Firebase Database ไม่พร้อมใช้งาน", true);
            return;
        }

        if (!window.confirm(`⚠️ คำเตือน: ยืนยันการลบแชท ID: ${chatId.substring(0, 8)}... อย่างถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้!`)) {
            return;
        }

        // 1. ยกเลิก Listener ของแชทนั้น
        cancelAllListeners();

        // 2. ลบ Chat node ทั้งหมดออกจาก Firebase
        database.ref(`${CHATS_PATH}/${chatId}`).remove()
            .then(() => {
                showTemporaryMessage(`แชท ID: ${chatId.substring(0, 8)}... ถูกลบออกจากฐานข้อมูลถาวรแล้ว`);
                // ย้ายกลับไปหน้า History List
                showListScreen('history');
                activeChatId = null;
            })
            .catch(error => {
                console.error("Error deleting chat permanently:", error);
                showTemporaryMessage("เกิดข้อผิดพลาดในการลบการสนทนาถาวร", true);
            });
    }

    window.closeChat = function (chatId, isForceClose = true) {
        if (!isFirebaseReady || !database) {
            showTemporaryMessage("Firebase Database ไม่พร้อมใช้งาน", true);
            return;
        }

        const timestampToClose = TIMESTAMP || Date.now();
        if (!timestampToClose) {
            console.warn("Timestamp not available. Proceeding with Date.now().");
        }

        database.ref(`${CHATS_PATH}/${chatId}`).update({
            status: 'closed',
            closedAt: timestampToClose,
            ownerUID: null,
            isLoggedOut: null
        })
            .then(() => {
                const messageText = isForceClose ? "แชทถูกปิดด้วยมือโดย Admin แล้ว" : "แชทถูกปิดอัตโนมัติแล้ว";
                showTemporaryMessage(`แชท ID: ${chatId.substring(0, 8)}... ${messageText}`);
                if (isForceClose) {
                    showListScreen('active');
                    activeChatId = null;
                }
            })
            .catch(error => {
                console.error("Error closing chat:", error);
                showTemporaryMessage("เกิดข้อผิดพลาดในการจบการสนทนา", true);
            });
    }


    function sendMessage() {
        if (!activeChatId) {
            showTemporaryMessage("กรุณาเลือกห้องสนทนา", true);
            return;
        }
        if (!isFirebaseReady || !database) {
            showTemporaryMessage("Firebase Database ไม่พร้อมใช้งาน", true);
            return;
        }

        const inputEl = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendButton');
        const text = inputEl.value.trim();

        if (text === '') {
            showTemporaryMessage("กรุณาพิมพ์ข้อความก่อนส่ง", true);
            return;
        }

        // UI Feedback: Disable input and change button state
        inputEl.disabled = true;
        sendBtn.disabled = true;
        sendBtn.classList.add('disabled-button');
        const originalBtnContent = sendBtn.innerHTML;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

        const timestamp = TIMESTAMP || Date.now();
        if (!timestamp) {
            showTemporaryMessage("ไม่สามารถรับเวลาจาก Server ได้", true);
            inputEl.disabled = false;
            sendBtn.disabled = false;
            sendBtn.classList.remove('disabled-button');
            sendBtn.innerHTML = originalBtnContent;
            return;
        }

        const messageData = {
            text: text,
            sender: 'admin',
            timestamp: timestamp
        };

        database.ref(`${CHATS_PATH}/${activeChatId}/${MESSAGES_SUB_PATH}`).push(messageData)
            .then(() => {
                inputEl.value = '';
                inputEl.style.height = 'auto'; // Reset textarea height

                return database.ref(`${CHATS_PATH}/${activeChatId}`).update({
                    lastMessage: {
                        text: text,
                        timestamp: Date.now()
                    },
                    lastActivity: Date.now(),
                    unreadByUser: true
                });
            })
            .catch((error) => {
                console.error("Error sending message: ", error);
                showTemporaryMessage("ส่งข้อความล้มเหลว", true);
            })
            .finally(() => {
                inputEl.disabled = false;
                sendBtn.disabled = false;
                sendBtn.classList.remove('disabled-button');
                sendBtn.innerHTML = originalBtnContent;
                inputEl.focus();
            });
    }

    // 🔑 [MODIFIED]: เพิ่ม Logic การตรวจสอบและส่ง LINE Notification ที่นี่
    let lastMessageTimestamp = 0; // เพื่อติดตามข้อความล่าสุดที่ส่งแจ้งเตือนไปแล้ว

    function listenForMessages(chatId, isHistory = false) {
        if (!isFirebaseReady || !database) return;

        // ยกเลิก Listener ข้อความเดิม
        if (chatListeners.messages) {
            const oldMessagesRef = database.ref(`${CHATS_PATH}/${chatListeners.messages.chatId}/${MESSAGES_SUB_PATH}`);
            oldMessagesRef.off('child_added', chatListeners.messages.callback);
            oldMessagesRef.off('child_changed', chatListeners.messages.callback);
            delete chatListeners.messages;
        }

        const chatBox = document.getElementById('chatBox');
        if (chatBox) chatBox.innerHTML = '';

        const messagesRef = database.ref(`${CHATS_PATH}/${chatId}/${MESSAGES_SUB_PATH}`).orderByKey();

        const callback = (snapshot) => {
            const messageId = snapshot.key;
            const message = snapshot.val();

            // 🔑 [FIX]: ตรวจสอบและลบข้อความเดิมออกจาก DOM ก่อนเสมอ (สำหรับ child_changed)
            const existingElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (existingElement) {
                existingElement.remove();
            }

            // ถ้าเป็นข้อความใหม่หรือมีการอัปเดต (เช่น ถูกลบ)
            if (message && (message.text || message.deleted)) { // ตรวจสอบ deleted ด้วย
                // 🔑 [CRITICAL]: ส่ง isHistory ไปด้วย
                appendMessage(message, messageId, chatId, isHistory);

                // -----------------------------------------------------------
                // 🟢 LINE NOTIFICATION LOGIC (NEW/MODIFIED)
                // -----------------------------------------------------------
                const isNewMessage = existingElement === null;

                if (!isHistory && isNewMessage) {

                    // 1. ตรวจสอบว่าเป็นข้อความจาก 'user' (ลูกค้า) เท่านั้น
                    if (message.sender === 'user') {

                        // 2. ตรวจสอบว่าเป็นข้อความใหม่จริง ๆ และไม่ใช่ข้อความซ้ำจากการโหลดครั้งแรก
                        if (message.timestamp > lastMessageTimestamp) {

                            const notificationText = `[📢 แชทใหม่] ID: ${chatId.substring(0, 8)}... ข้อความ: ${message.text || 'ข้อความรูปภาพ/ไฟล์'}`;

                            // 3. เรียกใช้ฟังก์ชันส่งแจ้งเตือน LINE
                            sendLineNotification(notificationText);

                            // 4. อัปเดตเวลาล่าสุดที่ส่งแจ้งเตือนไปแล้ว
                            lastMessageTimestamp = message.timestamp;
                        }
                    }
                }
                // -----------------------------------------------------------

            }
        };

        // กำหนด Listener ใหม่
        chatListeners.messages = { chatId: chatId, callback: callback };

        // ใช้ Listener ทั้ง child_added (ข้อความใหม่) และ child_changed (ข้อความที่ถูกแก้ไข/ลบ)
        messagesRef.on('child_added', callback, (error) => {
            console.error("Error listening for new messages:", error);
            if (chatBox) chatBox.innerHTML = '<div style="padding: 15px; color:#dc3545; text-align:center;">ไม่สามารถโหลดข้อความได้</div>';
        });
        messagesRef.on('child_changed', callback, (error) => {
            console.error("Error listening for message changes:", error);
        });
    }

    function appendMessage(message, messageId, chatId, isHistory = false) {
        const chatBox = document.getElementById('chatBox');
        if (!chatBox) {
            console.error("#chatBox element not found.");
            return;
        }

        const isUser = message.sender === 'user';
        const isAdmin = message.sender === 'admin';
        const isSystem = message.sender === 'system';
        const isDeleted = message.deleted === true;

        // 🚩 [FIXED: HIDE SYSTEM ONLY]: ไม่แสดงข้อความจาก system (ถ้าไม่ได้ใช้)
        if (isSystem) {
            return;
        }

        let bubbleClass;
        let containerClass;
        let textContent = message.text || message.message || message.content || '';

        // 🔑 [FIXED 1]: การจัดการข้อความขึ้นบรรทัดใหม่
        // เปลี่ยน \n (New Line character) ในข้อความดิบให้เป็นแท็ก <br>
        let formattedText = textContent.replace(/\n/g, '<br>');

        // ถ้าเป็นข้อความว่างเปล่า ก็ไม่แสดงผล
        if (textContent.trim() === '' && !isDeleted) {
            return;
        }

        // 🔑 [NEW LOGIC START]: กำหนดชื่อผู้ส่ง
        let senderDisplayName = '';

        if (isUser) {
            containerClass = 'user-container';
            bubbleClass = 'message-bubble user-bubble';

            // 🔑 ตรวจสอบ UID ของผู้ส่งข้อความ (ownerUID ควรถูกส่งมาพร้อมกับ message จาก Firebase)
            const ownerUID = message.ownerUID;

            if (ownerUID === ADMIN_UID_TO_HIDE) {
                // ถ้าเป็น Admin ที่ปลอมเป็น User
                senderDisplayName = '<strong style="color: #007bff;">Admin Chat</strong>';
            } else {
                // ถ้าเป็น User ทั่วไป
                senderDisplayName = message.name || '';
            }

        } else if (isAdmin) {
            containerClass = 'admin-container';
            bubbleClass = 'message-bubble admin-bubble';
        } else {
            return;
        }
        // 🔑 [NEW LOGIC END]

        // 🚩 [FIXED]: ถ้าถูกลบ ให้เพิ่ม class พิเศษและเปลี่ยนข้อความแสดงผล
        if (isDeleted) {
            bubbleClass += ' deleted-bubble';
            formattedText = '<span style="font-style: italic; color: #888;">[ข้อความถูกยกเลิกการส่ง]</span>';
        }

        const messageContainer = document.createElement('div');
        messageContainer.className = `message-container ${containerClass}`;
        messageContainer.setAttribute('data-message-id', messageId);

        const bubble = document.createElement('div');
        bubble.className = bubbleClass;

        // 🔑 [FIXED 2]: ใช้ innerHTML และใส่ข้อความที่ถูกแปลงแล้ว
        bubble.innerHTML = formattedText;

        // เพิ่ม Event Listener สำหรับ Context Menu (Delete Message)
        // 🚩 เงื่อนไข: ต้องเป็นข้อความ Admin และไม่ได้อยู่ในโหมด History และยังไม่ถูกลบ
        if (isAdmin && !isHistory && !isDeleted) {
            // 🔑 [CRITICAL FIX]: ผูก contextmenu กับ bubble โดยตรง และส่ง bubble element ไปด้วย
            bubble.addEventListener('contextmenu', (e) => {
                // ส่ง bubble element ไปเป็นตัวอ้างอิงตำแหน่ง
                window.showContextMenu(e, chatId, messageId, message.sender, bubble);
            });
        }

        // เวลาข้อความ
        const timeEl = document.createElement('span');
        timeEl.className = 'message-time';
        timeEl.textContent = formatTime(message.timestamp);

        if (isAdmin) {
            // สำหรับ Admin (ข้อความสีเขียว/น้ำเงิน): เวลา -> Bubble
            messageContainer.appendChild(timeEl);
            messageContainer.appendChild(bubble);
        } else { // User (ข้อความสีเทา/ขาว)

            // 🔑 [NEW LOGIC]: แสดงชื่อผู้ส่งด้านบน Bubble ของ User
            if (senderDisplayName) {
                const nameEl = document.createElement('div');
                nameEl.className = 'sender-display-name';
                nameEl.innerHTML = senderDisplayName;
                messageContainer.appendChild(nameEl);
            }

            // สำหรับ User: Bubble -> เวลา
            messageContainer.appendChild(bubble);
            messageContainer.appendChild(timeEl);
        }

        chatBox.appendChild(messageContainer);

        // 🚩 เพิ่ม Class 'show' หลัง append เพื่อให้เกิด Animation
        setTimeout(() => {
            messageContainer.classList.add('show');
        }, 10);


        // Scroll to the bottom (ทำเมื่อผู้ใช้ไม่ได้เลื่อนดูข้อความเก่า)
        if (!isHistory && chatBox.scrollHeight - chatBox.scrollTop < chatBox.clientHeight + 200) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }


    // =================================================================
    // === 7. AUTHENTICATION FUNCTIONS (Login/Logout) ===
    // =================================================================

    // =================================================================
    // === 7. AUTHENTICATION FUNCTIONS (Login/Logout) ===
    // =================================================================

    // ในไฟล์ admin.js (หรือไฟล์ที่ควบคุมหน้าล็อกอินของแอดมิน)
    window.adminLogin = function () {
        if (!auth || !isFirebaseReady) {
            const errorEl = document.getElementById(ERROR_MESSAGE_ELEMENT_ID);
            if (errorEl) errorEl.textContent = 'ระบบ Firebase ยังไม่พร้อม (โปรดตรวจสอบ Console)';
            if (errorEl) errorEl.style.display = 'block';
            return;
        }

        const email = document.getElementById('emailInput').value.trim();
        const password = document.getElementById('passwordInput').value.trim();
        const errorEl = document.getElementById(ERROR_MESSAGE_ELEMENT_ID);
        if (errorEl) errorEl.style.display = 'none';

        if (email === '' || password === '') {
            if (errorEl) {
                errorEl.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน';
                errorEl.style.display = 'block';
            }
            return;
        }

        // 🔑 [การแก้ไขสำคัญ]: ใช้ Persistence.LOCAL สำหรับ Admin 
        // เพื่อให้ Admin ล็อกอินค้างไว้ได้ (Remember Me)
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                // เมื่อตั้งค่า Persistence สำเร็จ จึงทำการล็อกอิน
                return auth.signInWithEmailAndPassword(email, password);
            })
            .then((userCredential) => {
                console.log("Admin logged in successfully:", userCredential.user.uid);
                // *** เพิ่มโค้ด redirect ไปหน้า Admin Dashboard ที่นี่ ***
            })
            .catch((error) => {
                let message = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        message = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
                        break;
                    case 'auth/invalid-email':
                        message = 'รูปแบบอีเมลไม่ถูกต้อง';
                        break;
                    case 'auth/invalid-api-key':
                        message = 'API Key ของ Firebase ไม่ถูกต้อง (โปรดตรวจสอบ admin.js)';
                        break;
                    case 'auth/web-storage-unsupported':
                        message = 'ข้อผิดพลาด: เบราว์เซอร์บล็อกการจัดเก็บข้อมูล (Storage) กรุณาลองใหม่หรือปิดโหมดส่วนตัว';
                        break;
                    default:
                        message = 'เข้าสู่ระบบล้มเหลว: ' + error.message;
                }
                if (errorEl) {
                    errorEl.textContent = message;
                    errorEl.style.display = 'block';
                }
                console.error("Login error:", error.message);
            });
    }

    window.adminLogout = function () {
        if (!auth) return;
        auth.signOut().then(() => {
            console.log("Admin logged out.");
        }).catch((error) => {
            console.error("Logout error:", error);
        });
    }

    // =================================================================
    // === 8. INITIAL SETUP & DOM LISTENERS ===
    // =================================================================

    // Auto-resize textarea
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            chatInput.style.height = (chatInput.scrollHeight) + 'px';
        });
        // Event Listener สำหรับส่งข้อความ (Enter Key)
        chatInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // ผูก Event Listener ของปุ่ม Login
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.onclick = window.adminLogin;
    }

    // ผูก Event Listener ของปุ่ม Send
    const sendBtn = document.getElementById('sendButton');
    if (sendBtn) {
        sendBtn.onclick = sendMessage;
    }

    // ผูก Event Listener ของปุ่ม Home ใน List Panel
    const goHomeBtn = document.getElementById('goHomeBtn');
    if (goHomeBtn) goHomeBtn.onclick = showWelcomeScreen;
    const backToWelcomeBtn = document.getElementById('backToWelcomeBtn');
    if (backToWelcomeBtn) backToWelcomeBtn.onclick = showWelcomeScreen;

    // ผูก Event Listener ของปุ่ม Back ใน Chat Panel
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.onclick = () => window.showListScreen(currentListType);
    }

    // ผูก Event Listener ของปุ่ม End Chat (สำหรับ Active Mode)
    const endChatButton = document.getElementById('endChatButton');
    if (endChatButton) {
        endChatButton.onclick = () => {
            if (!activeChatId) {
                showTemporaryMessage("ไม่พบ Chat ID", true);
                return;
            }
            if (window.confirm(`ยืนยันการจบการสนทนาของ ID: ${activeChatId.substring(0, 8)}...?`)) {
                window.closeChat(activeChatId, true);
            }
        };
    }

    // ผูก Event Listener ของปุ่ม Delete Chat Permanently (สำหรับ History Mode)
    const deleteChatButton = document.getElementById('deleteChatButton');
    if (deleteChatButton) {
        deleteChatButton.onclick = () => {
            if (!activeChatId) {
                showTemporaryMessage("ไม่พบ Chat ID", true);
                return;
            }
            // window.deleteChatPermanently จะมีการยืนยันซ้ำอยู่แล้ว
            window.deleteChatPermanently(activeChatId);
        };
    }

    // 🚩 [REMOVED/DELETED] โค้ด handleNewMessage ที่ไม่สมบูรณ์ถูกลบออกแล้ว

});
