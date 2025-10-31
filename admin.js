// admin.js (ฉบับเต็ม - Logic ถูกต้องตามที่คุณต้องการ)

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

// ----------------------------------------------------
// Navigation Handlers
// ----------------------------------------------------
function hideAllScreens() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('chatHistoryPanel').style.display = 'none';
}

function showLoginScreen() {
    hideAllScreens();
    document.getElementById('loginScreen').style.display = 'flex';
}

function showWelcomeScreen() {
    hideAllScreens();
    document.getElementById('welcomeScreen').style.display = 'flex';
}

function showChatListScreen() {
    hideAllScreens();
    document.getElementById('adminPanel').style.display = 'flex';
    
    document.getElementById('chatListPanel').style.display = 'flex';
    document.getElementById('chatPanel').style.display = 'none'; 
    loadChatList(); 
}

function showHistoryScreen() {
    hideAllScreens();
    document.getElementById('chatHistoryPanel').style.display = 'flex';
    
    document.getElementById('historyListPanel').style.display = 'flex';
    document.getElementById('historyViewPanel').style.display = 'none'; 
    document.getElementById('historyChatView').style.display = 'flex'; 
    loadHistoryList(); 
}


// ----------------------------------------------------
// Authentication Handlers (Persistence: LOCAL)
// ----------------------------------------------------
function adminLogin() {
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    const errorMessageEl = document.getElementById('errorMessage');

    errorMessageEl.style.display = 'none';

    // **ตั้งค่า Persistence เป็น LOCAL เพื่อให้ล็อกอินค้าง**
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            // ดำเนินการ Sign-in
            return auth.signInWithEmailAndPassword(email, password);
        })
        .then((userCredential) => {
            showWelcomeScreen();
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

function adminLogout() {
    auth.signOut().then(() => {
        showLoginScreen();
    }).catch((error) => {
        console.error('Logout error:', error);
    });
}

auth.onAuthStateChanged(function(user) {
    if (user) {
        showWelcomeScreen();
    } else {
        showLoginScreen();
    }
});


// ----------------------------------------------------
// Active Chat List (มีการแสดงวันที่และเวลา)
// ----------------------------------------------------

/**
 * ฟังก์ชันสร้างและอัปเดตรายการแชทใน UI
 * @param {Object} chatData - ข้อมูลแชทจาก Firebase
 * @param {string} chatId - ID ของแชท
 */
function createOrUpdateChatListItem(chatData, chatId) {
    const chatListEl = document.getElementById('chatList');
    
    if (!chatData || chatData.status !== 'active') {
        const itemToRemove = document.getElementById('chat-' + chatId);
        if (itemToRemove) itemToRemove.remove();
        return;
    }

    let item = document.getElementById('chat-' + chatId);
    if (!item) {
        item = document.createElement('div');
        item.id = 'chat-' + chatId;
        item.className = 'chat-item';
        item.onclick = () => selectChat(chatId, chatData);
    }
    
    const lastMessageText = chatData.lastMessage ? (chatData.lastMessage.text || chatData.lastMessage.message || 'เริ่มต้นการสนทนาใหม่') : 'เริ่มต้นการสนทนาใหม่'; 
    
    // **ใช้ formatDateTime เพื่อแสดงวันที่และเวลาล่าสุด**
    const lastActivityTime = chatData.lastActivity ? formatDateTime(chatData.lastActivity) : ''; 
    
    const unreadClass = chatData.unreadByAdmin ? ' unread' : '';
    const unreadDot = chatData.unreadByAdmin ? '<span class="unread-dot"></span>' : '';

    item.innerHTML = `
        <p><strong>ผู้ใช้ ID: ${chatId.substring(0, 8)}...</strong></p>
        <p class="chat-owner" style="font-size:12px; color:#555;">${lastMessageText}</p>
        <span class="chat-time" style="font-size:10px; color:#999;">${lastActivityTime}</span>
        ${unreadDot}
    `;
    item.className = 'chat-item' + unreadClass; 
    
    if (chatId === activeChatId) {
         item.classList.add('active');
    } else {
         item.classList.remove('active');
    }
    
    return item;
}

/**
 * @function loadChatList
 * **MODIFIED**: ใช้ on('value') และเรียงลำดับใน JS เพื่อให้ล่าสุดอยู่บนสุด
 */
function loadChatList() {
    const chatListRef = database.ref(CHATS_PATH);
    const chatListEl = document.getElementById('chatList');
    
    // 1. ยกเลิก Listener เก่า
    if (chatListeners.active) {
        chatListRef.off('value', chatListeners.active.callback);
    }
    
    chatListEl.innerHTML = '<p id="loadingActiveChats" style="padding: 15px; color:#777; text-align:center;">กำลังโหลด...</p>';

    // 2. สร้าง Callback ใหม่ที่ใช้ดึงข้อมูลทั้งหมดและเรียงลำดับ
    const callback = (snapshot) => {
        const chats = [];
        snapshot.forEach(childSnapshot => {
            const chatData = childSnapshot.val();
            if (chatData && chatData.status === 'active') {
                chatData.id = childSnapshot.key;
                chats.push(chatData);
            }
        });
        
        // 3. เรียงลำดับแชท: ล่าสุด (lastActivity มากสุด) ไว้บนสุด (b - a)
        chats.sort((a, b) => {
            const aTime = a.lastActivity || 0;
            const bTime = b.lastActivity || 0;
            return bTime - aTime;
        });

        // 4. ล้าง UI และสร้างรายการใหม่
        chatListEl.innerHTML = '';
        if (chats.length === 0) {
            chatListEl.innerHTML = '<p style="padding: 15px; color:#777; text-align:center;">ไม่มีการสนทนาที่กำลังใช้งาน</p>';
        } else {
            chats.forEach(chat => {
                const item = createOrUpdateChatListItem(chat, chat.id);
                if (item) {
                    chatListEl.appendChild(item);
                }
            });
        }
    };
    
    // 5. ตั้งค่า Listener ใหม่
    chatListRef.on('value', callback);
    chatListeners.active = { callback: callback };
}


// ----------------------------------------------------
// Chat Panel Interaction
// ----------------------------------------------------

function selectChat(chatId, chatData) {
    if (activeChatId) {
        const prevItem = document.getElementById('chat-' + activeChatId);
        if (prevItem) {
            prevItem.classList.remove('active');
        }
    }

    activeChatId = chatId;
    
    // อัปเดตสถานะ Active บนรายการแชทใหม่
    const currentItem = document.getElementById('chat-' + activeChatId);
    if (currentItem) {
        currentItem.classList.add('active'); 
        
        // ลบสถานะ Unread เมื่อคลิก
        currentItem.classList.remove('unread');
        const dot = currentItem.querySelector('.unread-dot');
        if (dot) dot.remove();

        database.ref(`${CHATS_PATH}/${chatId}/unreadByAdmin`).set(false);
    }
    
    document.getElementById('adminPanel').style.display = 'flex';
    document.getElementById('chatPanel').style.display = 'flex';
    
    document.getElementById('chatTitle').textContent = `สนทนากับ ID: ${chatId.substring(0, 8)}...`;

    loadMessages(chatId);
}

function loadMessages(chatId) {
    const chatBoxEl = document.getElementById('chatBox');
    
    const messagesRef = database.ref(`${CHATS_PATH}/${chatId}`).orderByKey(); 

    if (chatListeners.messages) {
        database.ref(`${CHATS_PATH}/${chatListeners.messages.chatId}`).off('child_added', chatListeners.messages.callback);
    }
    chatBoxEl.innerHTML = ''; 
    
    const callback = (snapshot) => {
        if (snapshot.key === 'lastMessage' || snapshot.key === 'status' || snapshot.key === 'unreadByAdmin' || snapshot.key === 'lastActivity' || snapshot.key === 'ownerUID' || snapshot.key === 'createdAt') {
            return;
        }
        
        const message = snapshot.val();
        if (message && (message.message || message.text) && message.sender) {
            displayMessage(message, chatBoxEl, chatId, snapshot.key);
            chatBoxEl.scrollTop = chatBoxEl.scrollHeight; 
        }
    };

    messagesRef.on('child_added', callback);
    chatListeners.messages = { chatId: chatId, callback: callback };
}

function displayMessage(message, chatBoxEl, chatId, messageId) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${message.sender === 'user' ? 'user-message' : 'admin-message'}`; 
    messageEl.id = `msg-${messageId}`;
    
    const displayText = message.message || message.text || 'ข้อความว่างเปล่า'; 
    
    // **ใช้ formatTime แสดงเฉพาะเวลาในหน้าแชท**
    let timeText = formatTime(message.timestamp); 
    
    // **HTML ข้อความ**
    let messageHTML = `
        <div class="bubble">
            <span class="message-text">${displayText}</span>
            <span class="message-time">${timeText}</span>
        </div>
    `;

    // เงื่อนไขการแสดงปุ่มลบ: แสดงเมื่อ sender เป็น 'admin' เท่านั้น
    if (message.sender === 'admin') {
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

    const timestamp = firebase.database.ServerValue.TIMESTAMP;
    
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
                unreadByUser: true 
            });
        })
        .catch((error) => {
            console.error("Error sending message: ", error);
        });
}


// ----------------------------------------------------
// History List & View (มีการแสดงวันที่และเวลา)
// ----------------------------------------------------

/**
 * ฟังก์ชันสร้างและอัปเดตรายการประวัติแชทใน UI
 * @param {Object} chatData - ข้อมูลแชทจาก Firebase
 * @param {string} chatId - ID ของแชท
 */
function createOrUpdateHistoryListItem(chatData, chatId) {
    const historyListEl = document.getElementById('historyList');

    if (!chatData || chatData.status !== 'closed') {
        const itemToRemove = document.getElementById('history-' + chatId);
        if (itemToRemove) itemToRemove.remove();
        return;
    }

    let item = document.getElementById('history-' + chatId);
    if (!item) {
        item = document.createElement('div');
        item.id = 'history-' + chatId;
        item.className = 'chat-item history-item';
        item.onclick = () => selectHistoryChat(chatId, chatData);
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
    
    return item;
}

/**
 * @function loadHistoryList
 * **MODIFIED**: ใช้ on('value') และเรียงลำดับใน JS เพื่อให้ล่าสุดอยู่บนสุด
 */
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
                const item = createOrUpdateHistoryListItem(chat, chat.id);
                if (item) {
                    historyListEl.appendChild(item);
                }
            });
        }
    };

    // 5. ตั้งค่า Listener ใหม่
    historyListRef.on('value', callback);
    chatListeners.history = { callback: callback };
}

function selectHistoryChat(chatId, chatData) {
    document.querySelectorAll('.history-item').forEach(item => item.classList.remove('active'));
    
    const selectedItem = document.getElementById('history-' + chatId);
    if (selectedItem) {
        selectedItem.classList.add('active');
    }

    document.getElementById('historyChatTitle').textContent = `ประวัติ ID: ${chatId.substring(0, 8)}...`;
    
    // **ตั้งค่าปุ่มลบประวัติถาวร**
    const deleteHistoryBtn = document.getElementById('deleteHistoryBtn'); 
    if (deleteHistoryBtn) {
        deleteHistoryBtn.style.display = 'inline-block';
        deleteHistoryBtn.onclick = () => deleteChatPermanently(chatId);
    }
    
    document.getElementById('historyViewPanel').style.display = 'flex';
    document.getElementById('historyChatView').style.display = 'none'; 
    
    loadHistoryMessages(chatId);
}

function loadHistoryMessages(chatId) {
    const historyChatBoxEl = document.getElementById('historyChatBox');
    
    const messagesRef = database.ref(`${CHATS_PATH}/${chatId}`).orderByKey();

    historyChatBoxEl.innerHTML = ''; 
    historyChatBoxEl.innerHTML = '<div style="padding: 15px; color:#777; text-align:center;">กำลังโหลดข้อความ...</div>';

    messagesRef.once('value', (snapshot) => {
        historyChatBoxEl.innerHTML = ''; 
        
        let foundMessages = false;
        
        snapshot.forEach((childSnapshot) => {
            if (childSnapshot.key === 'lastMessage' || childSnapshot.key === 'status' || childSnapshot.key === 'unreadByAdmin' || childSnapshot.key === 'lastActivity' || childSnapshot.key === 'ownerUID' || childSnapshot.key === 'createdAt' || childSnapshot.key === 'closedAt') {
                 return;
            }
            
            const message = childSnapshot.val();
            if (message && message.sender && (message.message || message.text)) {
                 displayHistoryMessage(message, historyChatBoxEl); 
                 foundMessages = true;
            }
        });
        
        if (!foundMessages) {
            historyChatBoxEl.innerHTML = '<div style="padding: 15px; color:#777; text-align:center;">ไม่มีข้อความในประวัตินี้</div>';
        }

        historyChatBoxEl.scrollTop = historyChatBoxEl.scrollHeight;
    }).catch(error => {
        console.error("Error loading history messages:", error);
        historyChatBoxEl.innerHTML = '<div style="padding: 15px; color:#dc3545; text-align:center;">ไม่สามารถโหลดข้อความได้</div>';
    });
}

function displayHistoryMessage(message, chatBoxEl) {
    const messageEl = document.createElement('div');
    const senderClass = message.sender === 'user' ? 'user-message' : 'admin-message';
    messageEl.className = `message ${senderClass}`;
    
    const displayText = message.message || message.text || 'ข้อความว่างเปล่า'; 

    // **ใช้ formatTime แสดงเฉพาะเวลาในหน้าประวัติแชท**
    let timeText = formatTime(message.timestamp);

    messageEl.innerHTML = `
        <div class="bubble">
            <span class="message-text">${displayText}</span>
            <span class="message-time">${timeText}</span>
        </div>
    `;

    chatBoxEl.appendChild(messageEl);
}

/**
 * ลบประวัติแชทและข้อความทั้งหมดถาวร
 */
window.deleteChatPermanently = function(chatId) {
    if (confirm(`**คำเตือน!** คุณแน่ใจหรือไม่ที่จะลบประวัติแชท ID: ${chatId.substring(0, 8)}... นี้อย่างถาวร? ข้อมูลข้อความทั้งหมดจะหายไป!`)) {
        
        database.ref(`${CHATS_PATH}/${chatId}`).remove()
            .then(() => {
                alert(`ประวัติแชท ID: ${chatId.substring(0, 8)}... ถูกลบอย่างถาวรแล้ว`);
                
                document.getElementById('historyViewPanel').style.display = 'none';
                document.getElementById('historyChatView').style.display = 'flex'; 
            })
            .catch(error => {
                console.error("Error deleting chat permanently:", error);
                alert("เกิดข้อผิดพลาดในการลบประวัติถาวร");
            });
    }
}


// ----------------------------------------------------
// Utility Functions (แก้ไขการแสดงผลวันที่และเวลา)
// ----------------------------------------------------

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
 * **NEW**: แสดงวันที่และเวลา (ใช้ใน Chat List)
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


// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) loginBtn.onclick = adminLogin;
    
    if (!auth.currentUser) {
        showLoginScreen();
    }
});