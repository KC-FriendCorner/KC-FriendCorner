// =================================================================
// === 🟢 admin.js - ฉบับสมบูรณ์ (แก้ไข: ซ่อนข้อความระบบ & แสดงสถานะ) ===
// =================================================================

// 1. **[CONFIG] ข้อมูล Firebase**
const firebaseConfig = {
    // 🚩 [CONFIG] กรุณาตรวจสอบและใช้ข้อมูลของ Firebase Project ของคุณ
    // ⚠️ ต้องเปลี่ยน apiKey นี้เป็นของจริง มิฉะนั้นจะเกิด "API key not valid" Error ในการ Login
    apiKey: "AIzaSyCs3_LcJN5RfOIo9jZ4fnz1CBl8hXqfvig", 
    authDomain: "kc-tobe-friendcorner-21655.firebaseapp.com",
    databaseURL: "https://kc-tobe-friendcorner-21655-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "kc-tobe-friendcorner-21655",
    storageBucket: "kc-tobe-friendcorner-21655.firebasestorage.app",
    messagingSenderId: "722433178265",
    appId: "1:722433178265:web:f7369aa65b3063a8ab1608"
};
const ADMIN_UID = "o139Nm6N3wSW25fCtAzwf2ymfSm2"; // UID ของผู้ดูแลระบบที่ได้รับอนุญาต

// 2. **[Declaration] ประกาศตัวแปร Global**
let auth = null;
let database = null;
let TIMESTAMP = null;
let isFirebaseReady = false;

let activeChatId = null;
let chatListeners = {};
const CHATS_PATH = 'chats';
const MESSAGES_SUB_PATH = 'messages';
let currentListType = 'active';
const ERROR_MESSAGE_ELEMENT_ID = 'errorMessage';
// 🚩 [FIX]: ลบข้อความต้อนรับอัตโนมัติออก
const FIRST_MESSAGE_AUTO_REPLY_TEXT = ''; 


// ** โค้ดทั้งหมดจะอยู่ใน DOMContentLoaded เพื่อความปลอดภัยในการโหลด Firebase SDK **
document.addEventListener('DOMContentLoaded', () => {

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
            const app = firebase.initializeApp(firebaseConfig);

            auth = app.auth();
            database = app.database();

            // 🟢 [แก้ไขปัญหา Database not ready]: เปลี่ยนการตรวจสอบ TIMESTAMP ให้นุ่มนวลขึ้น
            if (database) {
                try {
                    // พยายามกำหนด TIMESTAMP แต่ถ้าเกิด Error ก็แค่ Log Warning
                    TIMESTAMP = database.ServerValue.TIMESTAMP;
                    console.log("Firebase initialized successfully. TIMESTAMP is ready.");
                } catch (timestampError) {
                    console.warn("Firebase Initialization Warning: database.ServerValue is not immediately ready. Proceeding with Auth setup.");
                    // TIMESTAMP จะยังคงเป็น null
                }
                
                isFirebaseReady = true; // Auth และ Database พร้อมแล้ว
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
    // === Utility & Formatting Functions ===
    // =================================================================

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

    function formatTime(timestamp) {
        // 🟢 [ปรับปรุง]: ใช้ Date.now() แทน TIMESTAMP หาก TIMESTAMP ยังไม่พร้อม
        const timeToFormat = TIMESTAMP && isFirebaseReady && typeof timestamp === 'number' ? timestamp : (typeof timestamp === 'number' ? timestamp : Date.now());
        const date = new Date(timeToFormat);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    function formatDateTime(timestamp) {
        // 🟢 [ปรับปรุง]: ใช้ Date.now() แทน TIMESTAMP หาก TIMESTAMP ยังไม่พร้อม
        const timeToFormat = TIMESTAMP && isFirebaseReady && typeof timestamp === 'number' ? timestamp : (typeof timestamp === 'number' ? timestamp : Date.now());
        const date = new Date(timeToFormat);
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month} ${hours}:${minutes}`;
    }

    function showTemporaryMessage(message, isError = false) {
        let messageEl = document.getElementById('adminPanelMessage');
        if (!messageEl) {
            messageEl = document.createElement('div');
            messageEl.id = 'adminPanelMessage';
            messageEl.style.cssText = `
                 position: fixed; top: 0; left: 50%; transform: translateX(-50%); 
                 padding: 10px 20px; color: white; border-radius: 0 0 8px 8px; 
                 font-weight: bold; z-index: 1000; transition: all 0.5s; display: none;
             `;
            document.body.appendChild(messageEl);
        }
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        messageEl.style.backgroundColor = isError ? '#dc3545' : 'var(--primary-color)';

        setTimeout(() => {
            messageEl.style.display = 'none';
        }, 4000);
    }

    // =================================================================
    // === Auto-Reply Logic (ถูกลบ/ยกเลิกใช้งานตามคำขอ) ===
    // =================================================================
    // 🚩 [FIX]: ลบฟังก์ชัน sendFirstMessageAutoReply ออกทั้งหมด
    /* function sendFirstMessageAutoReply(chatId) {
        if (!isFirebaseReady || !database) return;

        // 🟢 [ปรับปรุง]: ใช้ Date.now() แทน TIMESTAMP หาก TIMESTAMP ยังไม่พร้อม
        const timestampToSend = TIMESTAMP || Date.now();
        if (!timestampToSend) return; 

        database.ref(`${CHATS_PATH}/${chatId}/${MESSAGES_SUB_PATH}`).once('value').then(snapshot => {
            let adminReplied = false;
            let userMessageFound = false;

            snapshot.forEach(childSnapshot => {
                const message = childSnapshot.val();

                if (message) {
                    if (message.sender === 'user' && !message.deleted) {
                        userMessageFound = true;
                    }
                    if (message.sender === 'admin' && !message.deleted) {
                        adminReplied = true;
                    }
                }
            });

            if (userMessageFound && !adminReplied) {
                console.log(`[Auto-Reply] Sending automatic response to chat: ${chatId.substring(0, 8)}...`);

                const dataToSend = {
                    sender: 'admin',
                    text: FIRST_MESSAGE_AUTO_REPLY_TEXT,
                    timestamp: timestampToSend 
                };

                database.ref(`${CHATS_PATH}/${chatId}/${MESSAGES_SUB_PATH}`).push(dataToSend)
                    .then(() => {
                        database.ref(`${CHATS_PATH}/${chatId}`).update({
                            lastMessage: {
                                text: FIRST_MESSAGE_AUTO_REPLY_TEXT,
                                timestamp: Date.now()
                            },
                            lastActivity: Date.now(),
                            unreadByUser: true
                        });
                    })
                    .catch(error => {
                        console.error("[Auto-Reply] Error sending automatic message:", error);
                    });
            }
        }).catch(error => {
            console.error("[Auto-Reply] Error checking chat history for auto-reply:", error);
        });
    }
    */

    // =================================================================
    // === Context Menu & Message Deletion Logic ===
    // =================================================================

    function showContextMenu(e, chatId, messageId) {
        hideContextMenu();

        const messageContainer = e.currentTarget;
        messageContainer.style.position = 'relative';

        const contextMenu = document.createElement('div');
        contextMenu.id = 'chatContextMenu';
        contextMenu.className = 'context-menu';

        contextMenu.style.position = 'absolute';
        contextMenu.style.bottom = 'calc(100% + 5px)';

        if (messageContainer.classList.contains('admin-container')) {
            contextMenu.style.right = '100%';
            contextMenu.style.left = 'auto';
            contextMenu.style.marginRight = '6px';
            contextMenu.style.top = '0';
        } else { // user-container
            contextMenu.style.left = '100%';
            contextMenu.style.right = 'auto';
            contextMenu.style.marginLeft = '6px';
            contextMenu.style.top = '0';
        }


        messageContainer.appendChild(contextMenu);

        const deleteOption = document.createElement('div');
        deleteOption.className = 'context-menu-item delete';
        deleteOption.innerHTML = `<i class="fas fa-trash-alt"></i> ยกเลิกการส่ง`;

        deleteOption.onclick = (e) => {
            e.stopPropagation();
            hideContextMenu();

            if (window.confirm('ยืนยันการยกเลิกข้อความนี้? ผู้ใช้จะเห็นเป็น "ข้อความถูกยกเลิกการส่ง"')) {
                window.deleteMessage(chatId, messageId);
            }
        };

        contextMenu.appendChild(deleteOption);
        contextMenu.onclick = (e) => e.stopPropagation();

        setTimeout(() => {
            document.addEventListener('click', hideContextMenu, { once: true });
            document.addEventListener('contextmenu', hideContextMenu, { once: true });
        }, 10);
    }

    function hideContextMenu() {
        const existingMenu = document.getElementById('chatContextMenu');
        if (existingMenu) {
            if (existingMenu.parentElement) {
                existingMenu.parentElement.style.position = '';
                existingMenu.parentElement.removeChild(existingMenu);
            }
            document.removeEventListener('click', hideContextMenu);
            document.removeEventListener('contextmenu', hideContextMenu);
        }
    }

    window.deleteMessage = function (chatId, messageId) {
        if (!isFirebaseReady || !database) {
            showTemporaryMessage("Firebase Database ไม่พร้อมใช้งาน", true);
            return;
        }

        const oldContainer = document.querySelector(`[data-message-id="${messageId}"]`);
        if (oldContainer) {
            oldContainer.remove();
        }

        const deletedText = "[ข้อความนี้ถูกยกเลิกการส่ง]";
        database.ref(`${CHATS_PATH}/${chatId}/${MESSAGES_SUB_PATH}/${messageId}`).update({
            deleted: true,
            text: deletedText,
        }).then(() => {
            console.log(`Message ${messageId.substring(0, 8)}... marked as deleted.`);
            showTemporaryMessage("ข้อความถูกยกเลิกการส่งแล้ว");
        }).catch(error => {
            console.error("Error deleting message:", error);
            showTemporaryMessage("เกิดข้อผิดพลาดในการยกเลิกการส่งข้อความ", true);
        });
    }
    
    // =================================================================
    // === Authentication & Navigation Handlers ===
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

    function hideAllScreens() {
        const loginScreen = document.getElementById('loginScreen');
        const welcomeScreen = document.getElementById('welcomeScreen');
        const adminPanelContainer = document.getElementById('adminPanelContainer');

        if (loginScreen) loginScreen.style.display = 'none';
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (adminPanelContainer) adminPanelContainer.style.display = 'none';
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

    function showWelcomeScreen() {
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
        currentListType = type;

        const adminPanelContainer = document.getElementById('adminPanelContainer');
        const listScreenContainer = document.getElementById('listScreenContainer');
        const chatListPanel = document.getElementById('chatListPanel');
        const historyListPanel = document.getElementById('historyListPanel');
        const chatScreenContainer = document.getElementById('chatScreenContainer');

        if (adminPanelContainer) adminPanelContainer.style.display = 'flex';
        if (listScreenContainer) listScreenContainer.style.display = 'flex';
        if (chatScreenContainer) chatScreenContainer.style.display = 'none';

        if (type === 'active') {
            if (historyListPanel) historyListPanel.style.display = 'none';
            if (chatListPanel) {
                const titleEl = chatListPanel.querySelector('.panel-title');
                if (titleEl) titleEl.textContent = 'ห้องสนทนาที่เปิดอยู่';
                chatListPanel.style.display = 'flex';
            }
            loadChatList();
        } else if (type === 'history') {
            if (chatListPanel) chatListPanel.style.display = 'none';
            if (historyListPanel) {
                const titleEl = historyListPanel.querySelector('.panel-title');
                if (titleEl) titleEl.textContent = 'ประวัติแชทที่สิ้นสุด';
                historyListPanel.style.display = 'flex';
            }
            loadHistoryList();
        }
    }

    function showChatViewScreen(chatId, isHistory = false) {
        // 🔑 [CRITICAL FIX]: ยกเลิก Listener ข้อความทั้งหมดของแชทเดิมก่อน
        cancelAllListeners(); 

        const adminPanelContainer = document.getElementById('adminPanelContainer');
        const listScreenContainer = document.getElementById('listScreenContainer');
        const chatScreenContainer = document.getElementById('chatScreenContainer');
        const chatTitle = document.getElementById('chatTitle');
        const closeChatBtn = document.getElementById('closeChatBtn');
        const inputArea = chatScreenContainer ? chatScreenContainer.querySelector('.input-area') : null;
        const backButton = document.getElementById('backButton');
        const chatBox = document.getElementById('chatBox');
        
        hideAllScreens(); // ปิดหน้าจออื่นๆ ก่อน
        
        if (adminPanelContainer) adminPanelContainer.style.display = 'flex';
        if (listScreenContainer) listScreenContainer.style.display = 'none';
        if (chatScreenContainer) chatScreenContainer.style.display = 'flex';
        
        // Clear old messages and title
        if (chatBox) chatBox.innerHTML = '';
        if (chatTitle) chatTitle.textContent = `สนทนากับ ID: ${chatId.substring(0, 8)}...`;
        
        // Setup Chat Header and Input Area
        if (closeChatBtn) {
            // 🔑 [FIXED]: ล้าง Class เก่าออกก่อน
            closeChatBtn.classList.remove('primary-button', 'danger-button', 'success-button'); 

            if (isHistory) {
                // 🚩 [HISTORY MODE - NEW]: แสดงปุ่ม "ลบถาวร"
                closeChatBtn.style.display = 'block'; 
                closeChatBtn.classList.add('danger-button'); // ใช้ปุ่มสีแดง
                closeChatBtn.innerHTML = '<i class="fas fa-trash-alt"></i> ลบการสนทนาถาวร';
                
                // ให้ปุ่มทำงาน: เรียกฟังก์ชัน Delete Permanently
                closeChatBtn.onclick = () => window.deleteChatPermanently(chatId);
                closeChatBtn.title = 'คำเตือน: การลบนี้ไม่สามารถย้อนกลับได้';
                closeChatBtn.style.opacity = 1.0; 
                closeChatBtn.style.cursor = 'pointer';
            } else {
                // 🚩 [ACTIVE MODE - FIXED]: ซ่อนปุ่ม "จบการสนทนา"
                closeChatBtn.style.display = 'none'; 
                closeChatBtn.onclick = null;
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

    // =================================================================
    // === Chat List Handlers (Active Chats) ===
    // =================================================================

    function renderChatItem(chatData, chatId, activeChatId) {
        const chatListEl = document.getElementById('chatList');
        if (!chatListEl) return null;
        
        let item = document.getElementById('chat-' + chatId);
        if (!item) {
            item = document.createElement('div');
            item.id = 'chat-' + chatId;
            item.className = 'chat-item';
            item.onclick = () => selectChat(chatId, chatData);
            chatListEl.appendChild(item);
        }

        const lastMessageText = chatData.lastMessage ? (chatData.lastMessage.text || chatData.lastMessage.message || 'ไม่มีข้อความล่าสุด') : 'ไม่มีข้อความล่าสุด';
        const lastActivityTime = chatData.lastActivity ? formatTime(chatData.lastActivity) : '';
        const unreadDot = chatData.unreadByAdmin ? '<span class="unread-dot"></span>' : '';
        
        // 🚩 [STATUS]: แสดงสถานะ [Active]
        const statusDisplay = '<span class="status-active" style="color: #28a745; font-size: 10px; font-weight: 500;">[Active]</span>';
        
        item.innerHTML = `
            <p>
                <strong>ID: <span class="chat-id">${chatId.substring(0, 8)}...</span></strong> 
                ${statusDisplay} ${unreadDot}
            </p>
            <p class="chat-owner" style="font-size:12px; color:#555;">${lastMessageText}</p>
            <span class="chat-time" style="font-size:10px; color:#999;">ล่าสุด: ${lastActivityTime}</span>
        `;
        
        item.className = 'chat-item';
        if (chatData.unreadByAdmin && activeChatId !== chatId) {
            item.classList.add('unread');
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

                    // 🚩 [FIX]: ลบการเรียกใช้ฟังก์ชัน Auto-Reply ออก
                    /* if (!chatData.closedAt) {
                        sendFirstMessageAutoReply(childSnapshot.key);
                    }
                    */

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
    
    // =================================================================
    // === History List Handlers ===
    // =================================================================

    function renderHistoryItem(chatData, chatId, activeChatId) {
        const historyListEl = document.getElementById('historyList');
        if (!historyListEl) return null;

        let item = document.getElementById('history-' + chatId);
        if (!item) {
            item = document.createElement('div');
            item.id = 'history-' + chatId;
            item.className = 'chat-item history-item';
            item.onclick = () => selectHistoryChat(chatId, chatData);
            historyListEl.appendChild(item);
        }

        const lastMessageText = chatData.lastMessage ? (chatData.lastMessage.text || chatData.lastMessage.message || 'สิ้นสุดการสนทนา') : 'สิ้นสุดการสนทนา';
        const lastActivityTime = chatData.closedAt ? formatDateTime(chatData.closedAt) : (chatData.lastActivity ? formatDateTime(chatData.lastActivity) : '');
        
        // 🚩 [STATUS]: แสดงสถานะ [Closed]
        const statusDisplay = '<span class="status-closed" style="color: #dc3545; font-size: 10px; font-weight: 500;">[Closed]</span>';

        item.innerHTML = `
            <p>
                <strong>ID: <span class="chat-id">${chatId.substring(0, 8)}...</span></strong>
                ${statusDisplay}
            </p>
            <p class="chat-owner" style="font-size:12px; color:#555;">${lastMessageText}</p>
            <span class="chat-time" style="font-size:10px; color:#999;">ปิดเมื่อ: ${lastActivityTime}</span>
        `;
        
        item.className = 'chat-item history-item';
        // 🚩 [FIXED]: เนื่องจากเรายกเลิก activeChatId ใน History Mode การตรวจสอบจึงเป็นเช่นเดิม
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
    
    function cancelAllListeners() {
        if (database) {
            if (chatListeners.active) {
                chatListeners.active.ref.off('value', chatListeners.active.callback);
                delete chatListeners.active;
            }
            if (chatListeners.history) {
                chatListeners.history.ref.off('value', chatListeners.history.callback);
                delete chatListeners.history;
            }
            if (chatListeners.messages) {
                const messagesRef = database.ref(`${CHATS_PATH}/${chatListeners.messages.chatId}/${MESSAGES_SUB_PATH}`);
                // ยกเลิกทั้ง child_added และ child_changed
                messagesRef.off('child_added', chatListeners.messages.callback);
                messagesRef.off('child_changed', chatListeners.messages.callback);
                delete chatListeners.messages;
            }
        }
    }

    // =================================================================
    // === Chat Interaction Handlers ===
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
            console.warn("Auto-close attempted. Proceeding with update.");
        }

        // ยกเลิก Listener ข้อความ
        if (chatListeners.messages && chatListeners.messages.chatId === chatId) {
            const messagesRef = database.ref(`${CHATS_PATH}/${chatId}/${MESSAGES_SUB_PATH}`);
            messagesRef.off('child_added', chatListeners.messages.callback);
            messagesRef.off('child_changed', chatListeners.messages.callback);
            delete chatListeners.messages;
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

    function selectChat(chatId, chatData) {
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

    // ** History View Logic **
    function selectHistoryChat(chatId, chatData) {
        if (!isFirebaseReady) return;
        
        // Remove active class from all items
        document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
        
        // 🔑 [CRITICAL FIX]: ตั้งค่า activeChatId เป็น null เพื่อป้องกันการสับสนกับ Active Chat
        activeChatId = null; 
        
        const currentItem = document.getElementById('history-' + chatId);
        if (currentItem) {
            currentItem.classList.add('active');
        }
        // 🚩 ส่ง true (isHistory) เข้าไป
        showChatViewScreen(chatId, true); 
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

        // 🟢 [ปรับปรุง]: ใช้ Date.now() แทน TIMESTAMP หาก TIMESTAMP ยังไม่พร้อม
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
        
        // 🚩 สั่งให้ Firebase โหลดข้อความทั้งหมดเรียงตาม Key (ซึ่งคือ Timestamp ใน Firebase)
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
            if (message && message.text) {
                // 🔑 [CRITICAL]: ส่ง isHistory ไปด้วย
                appendMessage(message, messageId, chatId, isHistory); 
            }
        };

        // กำหนด Listener ใหม่
        chatListeners.messages = { chatId: chatId, callback: callback };
        // ใช้ Listener ทั้ง child_added และ child_changed
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
        
        // 🚩 [FIX: HIDE SYSTEM/DELETED] ถ้าเป็นข้อความระบบ หรือ ข้อความที่ถูกลบ ให้ยกเลิกการแสดงผลทันที
        if (isSystem || isDeleted) {
             return; 
        }

        let bubbleClass;
        let containerClass;
        let textContent = message.text || message.message || message.content || '';

        // 🔑 [FIXED 1]: การจัดการข้อความขึ้นบรรทัดใหม่
        // เปลี่ยน \n (New Line character) ในข้อความดิบให้เป็นแท็ก <br>
        const formattedText = textContent.replace(/\n/g, '<br>');
        
        // ถ้าเป็นข้อความว่างเปล่า ก็ไม่แสดงผล
        if (textContent.trim() === '') {
             return;
        }

        if (isUser) {
            containerClass = 'user-container';
            bubbleClass = 'message-bubble';
        } else if (isAdmin) {
            containerClass = 'admin-container';
            bubbleClass = 'message-bubble';
        } else {
            return;
        }

        const messageContainer = document.createElement('div');
        messageContainer.className = `message-container ${containerClass}`; 
        messageContainer.setAttribute('data-message-id', messageId);

        const bubble = document.createElement('div');
        bubble.className = bubbleClass;

        // 🔑 [FIXED 2]: ใช้ innerHTML และใส่ข้อความที่ถูกแปลงแล้ว
        bubble.innerHTML = formattedText;
            
        // เพิ่ม Event Listener สำหรับ Context Menu (Delete Message)
        if (isAdmin && !isHistory) {
             messageContainer.addEventListener('contextmenu', (e) => {
                 e.preventDefault();
                 showContextMenu(e, chatId, messageId);
             });
        }
        
        // เวลาข้อความ
        const timeEl = document.createElement('span');
        timeEl.className = 'message-time';
        timeEl.textContent = formatTime(message.timestamp);
        
        if (isAdmin) {
            messageContainer.appendChild(timeEl);
            messageContainer.appendChild(bubble);
        } else { // User
            messageContainer.appendChild(bubble);
            messageContainer.appendChild(timeEl);
        }

        chatBox.appendChild(messageContainer);
        
        // 🚩 เพิ่ม Class 'show' หลัง append เพื่อให้เกิด Animation
        setTimeout(() => {
            messageContainer.classList.add('show');
        }, 10);


        // Scroll to the bottom 
        if (!isHistory) { // ทำเฉพาะใน Active Chat เท่านั้น
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }


    // =================================================================
    // === Authentication Functions ===
    // =================================================================

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

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                console.log("Admin logged in successfully:", userCredential.user.uid);
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
    // === Initial Setup & DOM Listeners ===
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
});