// admin.js (ฉบับสมบูรณ์และแก้ไขล่าสุด: FIX ADMIN PERSISTENCE)

// 1. **Firebase Config ที่กรอกแล้ว** 
const firebaseConfig = {
    apiKey: "AIzaSyAXBd2MsgeYbILyGPxdYRPpUkkF-z2EDz0", 
    authDomain: "kc-tobe-friendcorner.firebaseapp.com", 
    databaseURL: "https://kc-tobe-friendcorner-default-rtdb.firebaseio.com", 
    projectId: "kc-tobe-friendcorner", 
    storageBucket: "kc-tobe-friendcorner.firebasestorage.app",
    messagingSenderId: "337157160945",
    appId: "1:337157160945:web:151f4da137b16fe6cb8e50"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database(); 

let activeChatId = null;
let chatListeners = {};
const CHATS_PATH = 'chats'; 
let currentListType = 'active'; 
const TIMESTAMP = firebase.database.ServerValue.TIMESTAMP; 

// ----------------------------------------------------
// Utility Functions 
// ----------------------------------------------------

/**
 * @function playNotifySound
 * ฟังก์ชันจัดการเสียงแจ้งเตือนเมื่อมีข้อความใหม่จากผู้ใช้
 */
function playNotifySound() {
    const soundEl = document.getElementById('notifySound');
    if (soundEl) {
        // ตั้งเวลาเสียงกลับไปที่เริ่มต้นเพื่อเล่นซ้ำได้ทันที
        soundEl.currentTime = 0; 
        soundEl.play().catch(e => {
            console.warn("Sound play error (Must be triggered by user action first):", e);
        });
    }
}

/**
 * @function formatTime
 * แสดงเฉพาะเวลา (ใช้ใน chatBox)
 */
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    if (typeof timestamp === 'object' && timestamp.hasOwnProperty('.sv')) {
        return 'กำลังส่ง...'; 
    }

    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes}`;
}

/**
 * @function formatDateTime
 * แสดงวันที่และเวลา (ใช้ใน Chat List)
 */
function formatDateTime(timestamp) {
    if (!timestamp) return '';
    
    if (typeof timestamp === 'object' && timestamp.hasOwnProperty('.sv')) {
        return 'กำลังอัปเดต...'; 
    }

    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    // รูปแบบ 31/10 17:12
    return `${day}/${month} ${hours}:${minutes}`;
}


// ----------------------------------------------------
// Navigation Handlers 
// ----------------------------------------------------
function hideAllScreens() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('adminPanelContainer').style.display = 'none'; 
}

function showLoginScreen() {
    hideAllScreens();
    // **สำคัญ:** ล้าง Listener ทั้งหมดเมื่อไปหน้า Login
    cancelAllListeners(); 
    document.getElementById('loginScreen').style.display = 'flex';
    // ล้างข้อความ Error เก่าเสมอ
    const errorEl = document.getElementById('loginError');
    if(errorEl) {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
    }
}

function showWelcomeScreen() {
    hideAllScreens();
    // ยกเลิก Listener ทุกอย่างเมื่อกลับหน้าหลัก
    cancelAllListeners(); 
    activeChatId = null;
    document.getElementById('welcomeScreen').style.display = 'flex';
}

/**
 * @function showListScreen
 * แสดงหน้าจอรายการแชท (Active หรือ History) แบบเต็มจอ
 */
function showListScreen(type) {
    hideAllScreens();
    currentListType = type;
    document.getElementById('adminPanelContainer').style.display = 'flex';
    
    // **แสดง List Screen ซ่อน Chat Screen**
    document.getElementById('listScreenContainer').style.display = 'flex';
    document.getElementById('chatScreenContainer').style.display = 'none';

    // กำหนดว่า List Panel ไหนจะถูกแสดง
    const chatListPanel = document.getElementById('chatListPanel');
    const historyListPanel = document.getElementById('historyListPanel');
    
    if (type === 'active') {
        historyListPanel.style.display = 'none';
        chatListPanel.style.display = 'flex';
        loadChatList(); // โหลดรายการ Active
        
        // กำหนดปุ่ม Back ใน Chat View ให้กลับมาที่ Active List
        document.getElementById('backButton').setAttribute('onclick', "showListScreen('active')");
    } else if (type === 'history') {
        chatListPanel.style.display = 'none';
        historyListPanel.style.display = 'flex';
        loadHistoryList(); // โหลดรายการ History
        
        // กำหนดปุ่ม Back ใน Chat View ให้กลับมาที่ History List
        document.getElementById('backButton').setAttribute('onclick', "showListScreen('history')");
    }
}

/**
 * @function showChatViewScreen
 * แสดงหน้าจอแชทที่เลือกแบบเต็มจอ
 */
function showChatViewScreen(chatId, isHistory = false) {
    // ต้องให้ adminPanelContainer แสดงอยู่เสมอ
    document.getElementById('adminPanelContainer').style.display = 'flex';
    
    // **ซ่อน List Screen แสดง Chat Screen**
    document.getElementById('listScreenContainer').style.display = 'none';
    document.getElementById('chatScreenContainer').style.display = 'flex';
    
    // กำหนด Header Title
    document.getElementById('chatTitle').textContent = `${isHistory ? 'ประวัติ' : 'สนทนา'} กับ ID: ${chatId.substring(0, 8)}...`;

    // **การเปลี่ยนแปลงสำคัญ: จัดการปุ่มจบการสนทนา/ลบประวัติถาวร**
    const closeChatBtn = document.getElementById('closeChatBtn');
    
    if (isHistory) {
        // History: แสดงปุ่มลบถาวร
        closeChatBtn.style.display = 'inline-block';
        closeChatBtn.innerHTML = `<i class="fas fa-trash-alt"></i> ลบประวัติถาวร`;
        closeChatBtn.onclick = () => deleteChatPermanently(chatId);
        closeChatBtn.classList.remove('disabled-button');
        closeChatBtn.disabled = false;
        closeChatBtn.title = '';
        
        // ซ่อน Input Area ในกรณี History
        document.getElementById('chatScreenContainer').querySelector('.input-area').style.display = 'none';
        
        document.getElementById('backButton').setAttribute('onclick', "showListScreen('history')");
        loadHistoryMessages(chatId);
    } else {
        // Active: แสดงปุ่มจบการสนทนา (สถานะ Enable/Disable ถูกตั้งค่าใน selectChat)
        closeChatBtn.style.display = 'inline-block'; 
        closeChatBtn.innerHTML = `<i class="fas fa-times-circle"></i> จบการสนทนา`; // ให้แน่ใจว่ากลับเป็น Active Text
        
        // แสดง Input Area 
        document.getElementById('chatScreenContainer').querySelector('.input-area').style.display = 'flex';
        
        document.getElementById('backButton').setAttribute('onclick', "showListScreen('active')");
        activeChatId = chatId;
        // โหลดข้อความ (จะถูกเรียกใน selectChat)
    }
}

function cancelAllListeners() {
    // ยกเลิก Active List Listener
    const chatListRef = database.ref(CHATS_PATH);
    if (chatListeners.active) {
        chatListRef.off('value', chatListeners.active.callback);
        delete chatListeners.active;
    }
    // ยกเลิก History List Listener
    if (chatListeners.history) {
        chatListRef.off('value', chatListeners.history.callback);
        delete chatListeners.history;
    }
    // ยกเลิก Message Listener
    if (chatListeners.messages && chatListeners.messages.chatId) {
        database.ref(`${CHATS_PATH}/${chatListeners.messages.chatId}`).off('child_added', chatListeners.messages.callback);
        delete chatListeners.messages;
    }
}


// ----------------------------------------------------
// Authentication Handlers (แก้ไขแล้ว)
// ----------------------------------------------------

window.adminLogin = function() { 
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorMessageEl = document.getElementById('loginError'); 

    errorMessageEl.style.display = 'none';

    // 🚩 [แก้ไข] ตั้งค่า Persistence เป็น SESSION ก่อนล็อกอิน
    // ทำให้ ID Admin ถูกล้างเมื่อปิดเบราว์เซอร์ ป้องกันการชนกับ Anonymous User
    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(() => {
            // ดำเนินการ Sign-in
            return auth.signInWithEmailAndPassword(email, password);
        })
        .then((userCredential) => {
            // ไม่ต้องทำอะไรตรงนี้ onIdTokenChanged จะทำงานต่อ
        })
        .catch((error) => {
            let message = 'เข้าสู่ระบบล้มเหลว';
            if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-login-credentials' || error.code === 'auth/wrong-password') {
                message = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
            } else if (error.code === 'auth/invalid-email') {
                message = 'รูปแบบอีเมลไม่ถูกต้อง';
            } else {
                 message = `เข้าสู่ระบบล้มเหลว: ${error.message}`;
            }
            
            errorMessageEl.textContent = message;
            errorMessageEl.style.display = 'block';
        });
}

window.adminLogout = function() {
    if (confirm('คุณแน่ใจหรือไม่ที่จะออกจากระบบ Admin?')) {
        auth.signOut().then(() => {
            // Sign Out สำเร็จ onIdTokenChanged จะทำงานต่อ
        }).catch((error) => {
            console.error('Logout error:', error);
            alert('ออกจากระบบไม่สำเร็จ');
        });
    }
}

// **การแก้ไขสำคัญ:** ใช้ onIdTokenChanged แทน onAuthStateChanged เพื่อให้มั่นใจว่าเป็น Admin 
auth.onIdTokenChanged(function(user) {
    if (user) {
        // ตรวจสอบว่าเป็น Admin จริง ๆ (มีอีเมลและไม่เป็น Anonymous)
        if (user.email && !user.isAnonymous) {
            // Admin ล็อกอินอยู่: ไปที่หน้าหลัก
            showWelcomeScreen();
            return;
        }
    } 
    
    // ผู้ใช้ถูกล็อกเอาต์ หรือ User Anonymous เข้ามา
    showLoginScreen();
});


// ----------------------------------------------------
// Active Chat List
// ----------------------------------------------------

function createOrUpdateChatListItem(chatData, chatId) {
    const chatListEl = document.getElementById('chatList');
    
    if (!chatData || chatData.status !== 'active') {
        const itemToRemove = document.getElementById('chat-' + chatId);
        if (itemToRemove) itemToRemove.remove();
        return null; 
    }

    let item = document.getElementById('chat-' + chatId);
    if (!item) {
        item = document.createElement('div');
        item.id = 'chat-' + chatId;
        item.className = 'chat-item';
        // **เรียก selectChat() เพื่อเปิดหน้าจอเต็ม**
        item.onclick = () => selectChat(chatId, chatData); 
        chatListEl.appendChild(item); // เพิ่ม item เข้าไปใน DOM ทันทีเมื่อสร้างใหม่ (สำหรับการเรียงลำดับ)
    }
    
    const lastMessageText = chatData.lastMessage ? (chatData.lastMessage.text || chatData.lastMessage.message || 'เริ่มต้นการสนทนาใหม่') : 'เริ่มต้นการสนทนาใหม่'; 
    
    // **ใช้ formatDateTime เพื่อแสดงวันที่และเวลาล่าสุด**
    const lastActivityTime = chatData.lastActivity ? formatDateTime(chatData.lastActivity) : ''; 
    
    const unreadClass = chatData.unreadByAdmin ? ' unread' : '';
    const unreadDot = chatData.unreadByAdmin ? '<span class="unread-dot"></span>' : '';

    // **แสดงสถานะผู้ใช้ในรายการแชท**
    // ownerUID: มีค่า = ออนไลน์ / ไม่มีค่า (null) = ออฟไลน์/ตัดการเชื่อมต่อ
    const userStatus = chatData.ownerUID ? '<i class="fas fa-plug" style="color:#28a745;"></i> ออนไลน์' : '<i class="fas fa-unlink" style="color:#dc3545;"></i> ออฟไลน์';

    item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
             <p><strong>ผู้ใช้ ID: ${chatId.substring(0, 8)}...</strong></p>
             <span style="font-size:12px;">${userStatus}</span>
        </div>
        <p class="chat-owner" style="font-size:12px; color:#555; margin-top: 5px;">${lastMessageText}</p>
        <span class="chat-time" style="font-size:10px; color:#999;">${lastActivityTime}</span>
        ${unreadDot}
    `;
    item.className = 'chat-item' + unreadClass; 
    
    if (chatId === activeChatId) {
         item.classList.add('active');
    } else {
         item.classList.remove('active');
    }
    
    // **อัปเดตปุ่ม 'จบการสนทนา' หากเป็นแชทที่เปิดอยู่**
    if (chatId === activeChatId) {
        updateCloseChatButtonState(chatData);
    }
    
    return item;
}

function loadChatList() {
    const chatListRef = database.ref(CHATS_PATH);
    const chatListEl = document.getElementById('chatList');
    
    // 1. ยกเลิก Listener เก่า
    if (chatListeners.active) {
        chatListRef.off('value', chatListeners.active.callback);
    }
    
    chatListEl.innerHTML = '<p id="loadingActiveChats" style="padding: 15px; color:#777; text-align:center;">กำลังโหลด...</p>';

    // 2. สร้าง Callback ใหม่ที่ใช้ดึงข้อมูลทั้งหมด
    const callback = (snapshot) => {
        const chats = [];
        snapshot.forEach(childSnapshot => {
            const chatData = childSnapshot.val();
            if (chatData && chatData.status === 'active') {
                chatData.id = childSnapshot.key;
                chats.push(chatData);
            }
        });
        
        // 3. **Logic การเรียงลำดับใหม่ตามลำดับความต้องการ (ออนไลน์ > เวลาล่าสุด > ยังไม่ได้อ่าน)**
        chats.sort((a, b) => {
            
            // A. **ลำดับ 1: เรียงตามสถานะ 'ออนไลน์' (ownerUID)** const aOnline = a.ownerUID ? 1 : 0;
            const bOnline = b.ownerUID ? 1 : 0;
            
            if (bOnline !== aOnline) return bOnline - aOnline; 

            // B. **ลำดับ 2: เรียงตาม 'เวลาล่าสุด' (lastActivity)**
            const aTime = a.lastActivity || 0;
            const bTime = b.lastActivity || 0;
            
            if (bTime !== aTime) return bTime - aTime;

            // C. **ลำดับ 3: เรียงตามสถานะ 'ยังไม่ได้อ่าน' (Unread)**
            const aUnread = a.unreadByAdmin ? 1 : 0;
            const bUnread = b.unreadByAdmin ? 1 : 0;
            
            return bUnread - aUnread; 
        });

        // 4. ล้าง UI และสร้างรายการใหม่
        chatListEl.innerHTML = '';
        if (chats.length === 0) {
            chatListEl.innerHTML = '<p style="padding: 15px; color:#777; text-align:center;">ไม่มีการสนทนาที่กำลังใช้งาน</p>';
        } else {
            chats.forEach(chat => {
                // ใช้ createOrUpdateChatListItem เพื่อสร้าง/อัปเดต และเพิ่มเข้า DOM
                createOrUpdateChatListItem(chat, chat.id); 
            });
        }
    };
    
    // 5. ตั้งค่า Listener ใหม่
    chatListRef.on('value', callback);
    chatListeners.active = { callback: callback };
}


// ----------------------------------------------------
// Chat Panel Interaction & Close Chat Logic
// ----------------------------------------------------

/**
 * @function updateCloseChatButtonState
 * จัดการสถานะปุ่มจบการสนทนา (Active Chat)
 */
function updateCloseChatButtonState(chatData) {
    const closeChatBtn = document.getElementById('closeChatBtn');
    
    if (!closeChatBtn) return;
    
    // ** 1. กำหนดสไตล์และข้อความเริ่มต้น **
    closeChatBtn.style.display = 'inline-block';
    closeChatBtn.classList.remove('disabled-button'); 
    closeChatBtn.title = '';
    
    // ** 2. ตรวจสอบสถานะผู้ใช้ (ownerUID: มีค่า = ออนไลน์ / ไม่มีค่า = ออฟไลน์/ตัดการเชื่อมต่อ) **
    if (chatData && chatData.ownerUID) {
        // ผู้ใช้ยังเชื่อมต่ออยู่: ปิดใช้งานปุ่ม
        closeChatBtn.disabled = true;
        closeChatBtn.innerHTML = `<i class="fas fa-lock"></i> ผู้ใช้ยังเชื่อมต่อ`;
        closeChatBtn.classList.add('disabled-button');
        closeChatBtn.title = 'ไม่สามารถจบการสนทนาได้หากผู้ใช้ยังเชื่อมต่ออยู่';
        closeChatBtn.onclick = null;
    } else {
        // ผู้ใช้ตัดการเชื่อมต่อแล้ว: เปิดใช้งานปุ่ม
        closeChatBtn.disabled = false;
        closeChatBtn.innerHTML = `<i class="fas fa-times-circle"></i> จบการสนทนา`;
        closeChatBtn.onclick = () => closeChat(activeChatId);
    }
}


/**
 * @function closeChat
 * เปลี่ยนสถานะการสนทนาจาก 'active' เป็น 'closed' และลบ ownerUID
 */
window.closeChat = function(chatId) {
    if (confirm(`คุณแน่ใจหรือไม่ที่จะจบการสนทนา ID: ${chatId.substring(0, 8)}...? การกระทำนี้จะเปลี่ยนสถานะเป็น 'closed'`)) {
        
        // 1. ปิด Listener ข้อความก่อน
        if (chatListeners.messages && chatListeners.messages.chatId === chatId) {
            database.ref(`${CHATS_PATH}/${chatId}`).off('child_added', chatListeners.messages.callback);
            delete chatListeners.messages;
        }

        database.ref(`${CHATS_PATH}/${chatId}`).update({
            status: 'closed',
            closedAt: TIMESTAMP,
            ownerUID: null // ลบ Owner UID เมื่อจบการสนทนา (แก้ไขปัญหาที่ค้าง)
        })
        .then(() => {
            alert('จบการสนทนาเรียบร้อยแล้ว');
            // 2. กลับไปหน้า Active List
            showListScreen('active'); 
            activeChatId = null;
        })
        .catch(error => {
            console.error("Error closing chat:", error);
            alert("เกิดข้อผิดพลาดในการจบการสนทนา");
        });
    }
}


/**
 * @function selectChat
 * เลือกแชท Active และแสดงหน้าจอแชทแบบเต็มจอ
 * **[แก้ไข]** ใช้ .update() เพื่ออัปเดต unreadByAdmin เท่านั้น ป้องกัน User ถูกล็อกเอาต์
 */
function selectChat(chatId, chatData) {
    // 1. จัดการ Active Class ใน List (ลบจากอันเดิม, เพิ่มในอันใหม่)
    document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
    
    activeChatId = chatId;
    
    // อัปเดตสถานะ Active บนรายการแชทใหม่
    const currentItem = document.getElementById('chat-' + activeChatId);
    if (currentItem) {
        currentItem.classList.add('active'); 
        
        // ลบสถานะ Unread เมื่อคลิก (แค่ UI ก่อน)
        currentItem.classList.remove('unread');
        const dot = currentItem.querySelector('.unread-dot');
        if (dot) dot.remove();
    }
    
    // 2. ลบสถานะ unread ใน Firebase
    // **[สำคัญ] ใช้ .update() เพื่ออัปเดต unreadByAdmin เท่านั้น**
    database.ref(`${CHATS_PATH}/${chatId}`).update({
        unreadByAdmin: false 
    })
    .then(() => {
        // 3. แสดงหน้าจอแชท
        showChatViewScreen(chatId, false); // false = ไม่ใช่ History Chat
        
        // 4. จัดการปุ่มจบการสนทนาตามเงื่อนไข (ใช้ chatData ที่ได้รับมา)
        updateCloseChatButtonState(chatData);

        // 5. โหลดข้อความ
        loadMessages(chatId);
    })
    .catch(error => {
        console.error("Error updating unread status:", error);
    });
}

function loadMessages(chatId) {
    const chatBoxEl = document.getElementById('chatBox');
    
    // โครงสร้างข้อความที่เป็น child ตรงของ /chats/{chatId}
    const messagesRef = database.ref(`${CHATS_PATH}/${chatId}`).orderByKey(); 

    // ยกเลิก Listener ข้อความเก่า
    if (chatListeners.messages) {
        database.ref(`${CHATS_PATH}/${chatListeners.messages.chatId}`).off('child_added', chatListeners.messages.callback);
        delete chatListeners.messages;
    }
    chatBoxEl.innerHTML = ''; 
    
    const callback = (snapshot) => {
        // กรอง metadata
        if (snapshot.key === 'lastMessage' || snapshot.key === 'status' || snapshot.key === 'unreadByAdmin' || snapshot.key === 'lastActivity' || snapshot.key === 'ownerUID' || snapshot.key === 'createdAt' || snapshot.key === 'closedAt') {
             return;
        }
        
        const message = snapshot.val();
        // ตรวจสอบให้แน่ใจว่าเป็นข้อความจริง ๆ โดยต้องมี sender
        if (message && message.sender && (message.message || message.text)) { 
            displayMessage(message, chatBoxEl, chatId, snapshot.key);
            chatBoxEl.scrollTop = chatBoxEl.scrollHeight; 
            
            // ใช้ฟังก์ชัน playNotifySound() 
            if (message.sender === 'user' && activeChatId === chatId) {
                 playNotifySound();
            }
        }
    };

    messagesRef.on('child_added', callback);
    chatListeners.messages = { chatId: chatId, callback: callback };
}

function displayMessage(message, chatBoxEl, chatId, messageId) {
    // ป้องกันการแสดงผลซ้ำหาก element ID นั้นมีอยู่แล้ว
    if (document.getElementById(`msg-${messageId}`)) {
         return; 
    }
    
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.sender === 'user' ? 'user-message' : 'admin-message'}`; 
    messageEl.id = `msg-${messageId}`;
    
    const displayText = message.message || message.text || 'ข้อความว่างเปล่า'; 
    
    // ใช้ formatTime แสดงเฉพาะเวลาในหน้าแชท
    let timeText = formatTime(message.timestamp); 
    
    // HTML ข้อความ
    let messageHTML = `
        <div class="bubble">
            <span class="message-text">${displayText}</span>
            <span class="message-time">${timeText}</span>
        </div>
    `;

    // เงื่อนไขการแสดงปุ่มลบ: แสดงเมื่อ sender เป็น 'admin' และอยู่ในโหมด Active Chat เท่านั้น
    if (message.sender === 'admin' && currentListType === 'active') { 
        messageHTML += `
            <div class="delete-message-btn" onclick="deleteMessage('${chatId}', '${messageId}')" style="margin-left: 10px; align-self: center; cursor: pointer; color: #dc3545; opacity: 0.5; transition: opacity 0.2s;">
                <i class="fas fa-times"></i>
            </div>
        `;
    } 

    messageEl.innerHTML = messageHTML;
    chatBoxEl.appendChild(messageEl);
}

window.deleteMessage = function(chatId, messageId) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบข้อความนี้? การลบข้อความทำได้เฉพาะข้อความที่คุณส่งเองเท่านั้น')) {
          database.ref(`${CHATS_PATH}/${chatId}/${messageId}`).once('value')
                 .then(snapshot => {
                     const message = snapshot.val();
                     if (message && message.sender === 'admin') { // ตรวจสอบสิทธิ์ Admin
                         return database.ref(`${CHATS_PATH}/${chatId}/${messageId}`).remove();
                     } else {
                         alert("ข้อความนี้ไม่ใช่ข้อความของคุณ (Admin) หรือไม่ได้รับอนุญาตให้ลบ");
                         throw new Error("Permission denied or message not found.");
                     }
                 })
                 .then(() => {
                     const el = document.getElementById(`msg-${messageId}`);
                     if (el) el.remove();
                 })
                 .catch((error) => {
                     console.error("Error deleting message:", error);
                     if (error.message.includes("Permission denied")) return; 
                     alert("ไม่สามารถลบข้อความได้");
                 });
    }
}

document.getElementById('sendButton').onclick = sendMessage;
document.getElementById('chatInput').addEventListener('keypress', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); 
        sendMessage();
    }
});

function sendMessage() {
    const inputEl = document.getElementById('chatInput');
    const text = inputEl.value.trim(); 

    if (!activeChatId || text === '') return;

    const timestamp = TIMESTAMP;
    
    const messageData = {
        text: text, 
        sender: 'admin',
        timestamp: timestamp
    };

    database.ref(`${CHATS_PATH}/${activeChatId}`).push(messageData)
        .then(() => {
            inputEl.value = ''; 
            
            database.ref(`${CHATS_PATH}/${activeChatId}`).update({
                lastMessage: {
                    text: text, 
                    timestamp: timestamp
                },
                lastActivity: timestamp, // อัปเดต lastActivity
                unreadByUser: true 
            });
        })
        .catch((error) => {
            console.error("Error sending message: ", error);
        });
}


// ----------------------------------------------------
// History List & View (มีปุ่มลบประวัติถาวร)
// ----------------------------------------------------

function createOrUpdateHistoryListItem(chatData, chatId) {
    const historyListEl = document.getElementById('historyList');

    if (!chatData || chatData.status !== 'closed') {
        const itemToRemove = document.getElementById('history-' + chatId);
        if (itemToRemove) itemToRemove.remove();
        return null;
    }

    let item = document.getElementById('history-' + chatId);
    if (!item) {
        item = document.createElement('div');
        item.id = 'history-' + chatId;
        item.className = 'chat-item history-item';
        // **เรียก selectHistoryChat() เพื่อเปิดหน้าจอเต็ม**
        item.onclick = () => selectHistoryChat(chatId, chatData); 
        historyListEl.appendChild(item); // เพิ่ม item เข้าไปใน DOM ทันทีเมื่อสร้างใหม่
    }

    const lastMessageText = chatData.lastMessage ? (chatData.lastMessage.text || chatData.lastMessage.message || 'สิ้นสุดการสนทนา') : 'สิ้นสุดการสนทนา';
    
    // **ใช้ closedAt เป็นหลัก และ formatDateTime เพื่อแสดงวันที่และเวลาเต็ม**
    const lastActivityTime = chatData.closedAt ? formatDateTime(chatData.closedAt) : (chatData.lastActivity ? formatDateTime(chatData.lastActivity) : '');
    
    item.innerHTML = `
        <p><strong>ID: ${chatId.substring(0, 8)}...</strong></p>
        <p class="chat-owner" style="font-size:12px; color:#555;">${lastMessageText}</p>
        <span class="chat-time" style="font-size:10px; color:#999;">${lastActivityTime}</span>
    `;
    item.className = 'chat-item history-item';
    
    // ถ้ากำลังดูประวัติแชทนี้อยู่ ให้ทำ active
    if (activeChatId === chatId) {
        item.classList.add('active');
    } else {
        item.classList.remove('active');
    }
    
    return item;
}

function loadHistoryList() {
    const historyListRef = database.ref(CHATS_PATH);
    const historyListEl = document.getElementById('historyList');
    
    // 1. ยกเลิก Listener เก่า
    if (chatListeners.history) {
        historyListRef.off('value', chatListeners.history.callback);
    }
    
    historyListEl.innerHTML = '<p id="loadingHistoryChats" style="padding: 15px; color:#777; text-align:center;">กำลังโหลดประวัติการสนทนา...</p>';
    
    // 2. สร้าง Callback ใหม่ที่ใช้ดึงข้อมูลทั้งหมดและเรียงลำดับ
    const callback = (snapshot) => {
        const history = [];
        snapshot.forEach(childSnapshot => {
            const chatData = childSnapshot.val();
            if (chatData && chatData.status === 'closed') {
                chatData.id = childSnapshot.key;
                history.push(chatData);
            }
        });
        
        // 3. เรียงลำดับประวัติ: ล่าสุด (closedAt/lastActivity มากสุด) ไว้บนสุด (b - a)
        history.sort((a, b) => {
            // ใช้ closedAt เป็นหลัก และ lastActivity เป็นสำรอง
            const aTime = a.closedAt || a.lastActivity || 0; 
            const bTime = b.closedAt || b.lastActivity || 0;
            return bTime - aTime;
        });

        // 4. ล้าง UI และสร้างรายการใหม่
        historyListEl.innerHTML = '';
        if (history.length === 0) {
            historyListEl.innerHTML = '<p style="padding: 15px; color:#777; text-align:center;">ไม่มีประวัติการสนทนาที่สิ้นสุดแล้ว</p>';
        } else {
            history.forEach(chat => {
                createOrUpdateHistoryListItem(chat, chat.id);
            });
        }
    };

    // 5. ตั้งค่า Listener ใหม่
    historyListRef.on('value', callback);
    chatListeners.history = { callback: callback };
}

/**
 * @function selectHistoryChat
 * เลือกประวัติแชทและแสดงหน้าจอประวัติแชทแบบเต็มจอ
 */
function selectHistoryChat(chatId, chatData) {
    activeChatId = chatId; // ตั้งค่า activeChatId เพื่อให้รายการ active ถูกต้อง
    
    // ลบ active class จากรายการประวัติแชทเดิม
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    
    // ตั้ง active class ให้รายการที่เลือกใหม่
    const selectedItem = document.getElementById('history-' + chatId);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    // **เรียก showChatViewScreen() เพื่อสลับไปยังหน้าจอแชทเต็ม**
    showChatViewScreen(chatId, true); // true = เป็น History Chat
}

/**
 * @function loadHistoryMessages
 * โหลดข้อความประวัติแบบ once 
 */
function loadHistoryMessages(chatId) {
    const chatBoxEl = document.getElementById('chatBox'); // ใช้ chatBox เดิม
    
    const messagesRef = database.ref(`${CHATS_PATH}/${chatId}`).orderByKey();

    // ต้องยกเลิก Message Listener ของ Active Chat ก่อน
    if (chatListeners.messages) {
        database.ref(`${CHATS_PATH}/${chatListeners.messages.chatId}`).off('child_added', chatListeners.messages.callback);
        delete chatListeners.messages;
    }

    chatBoxEl.innerHTML = ''; 
    chatBoxEl.innerHTML = '<div style="padding: 15px; color:#777; text-align:center;">กำลังโหลดข้อความ...</div>';

    messagesRef.once('value', (snapshot) => {
        chatBoxEl.innerHTML = ''; 
        
        let foundMessages = false;
        
        snapshot.forEach((childSnapshot) => {
            // กรอง metadata
            if (childSnapshot.key === 'lastMessage' || childSnapshot.key === 'status' || childSnapshot.key === 'unreadByAdmin' || childSnapshot.key === 'lastActivity' || childSnapshot.key === 'ownerUID' || childSnapshot.key === 'createdAt' || childSnapshot.key === 'closedAt') {
                 return;
            }
            
            const message = childSnapshot.val();
            if (message && message.sender && (message.message || message.text)) {
                 displayMessage(message, chatBoxEl, chatId, childSnapshot.key); // ใช้ displayMessage เดียวกัน
                 foundMessages = true;
            }
        });
        
        if (!foundMessages) {
            chatBoxEl.innerHTML = '<div style="padding: 15px; color:#777; text-align:center;">ไม่มีข้อความในประวัตินี้</div>';
        }

        chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
    }).catch(error => {
        console.error("Error loading history messages:", error);
        chatBoxEl.innerHTML = '<div style="padding: 15px; color:#dc3545; text-align:center;">ไม่สามารถโหลดข้อความได้</div>';
    });
}


/**
 * ลบประวัติแชทและข้อความทั้งหมดถาวร (ถูกเรียกเมื่อกดปุ่มในโหมด History)
 */
window.deleteChatPermanently = function(chatId) {
    if (confirm(`**คำเตือน!** คุณแน่ใจหรือไม่ที่จะลบประวัติแชท ID: ${chatId.substring(0, 8)}... นี้อย่างถาวร? ข้อมูลข้อความทั้งหมดจะหายไป!`)) {
        
        database.ref(`${CHATS_PATH}/${chatId}`).remove()
             .then(() => {
                 alert(`ประวัติแชท ID: ${chatId.substring(0, 8)}... ถูกลบอย่างถาวรแล้ว`);
                 
                 // กลับไปที่หน้า History List
                 showListScreen('history');
                 activeChatId = null; 
             })
             .catch(error => {
                 console.error("Error deleting chat permanently:", error);
                 alert("เกิดข้อผิดพลาดในการลบประวัติถาวร");
             });
    }
}


// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    // ให้ auth.onIdTokenChanged จัดการการแสดงผลเริ่มต้น
    if (!auth.currentUser) {
          showLoginScreen();
    }
});