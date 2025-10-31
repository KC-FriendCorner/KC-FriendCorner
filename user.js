// ===============================================
// 1. Firebase Initialization & Config
// ===============================================

const firebaseConfig = {
    apiKey: "AIzaSyAXBd2MsgeYbILyGPxdYRPpUkkF-z2EDz0",
    authDomain: "kc-tobe-friendcorner.firebaseapp.com",
    databaseURL: "https://kc-tobe-friendcorner-default-rtdb.firebaseio.com",
    projectId: "kc-tobe-friendcorner",
    storageBucket: "kc-tobe-friendcorner.firebasestorage.app",
    messagingSenderId: "337157160945",
    appId: "1:337157160945:web:151f4da137b16fe6cb8e50",
};
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.database();
const database = db; // Alias 

// ===============================================
// 2. Elements & Variables
// ===============================================
const mainContainer = document.getElementById('mainContainer');
const logoArea = document.getElementById('logoArea');
const appTitle = document.getElementById('appTitle');

const welcomeScreen = document.getElementById('welcomeScreen'); 
const chatScreen = document.getElementById('chatScreen'); 

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const notifySound = document.getElementById("notifySound");
const userIdDisplay = document.getElementById('userIdDisplay');
const chatTitle = document.getElementById('chatTitle');
const userInfoArea = document.getElementById('userInfoArea');

const authButton = document.getElementById('authButton');
const mainActions = document.getElementById('mainActions');
const startChatBtn = document.getElementById("startChat");
const logoutBtn = document.getElementById('logoutBtn'); 

let currentUserId = null;
let currentChatId = null;
let chatListener = null;

const CHATS_PATH = 'chats';
const MESSAGES_PATH = 'messages';

// ===============================================
// 3. Page Switching & UI Management
// ===============================================

function hideAllScreens() {
    welcomeScreen.style.display = 'none'; 
    chatScreen.style.display = 'none';
}

/**
 * @function showStartScreen
 * จัดการการแสดงผลหน้าเริ่มต้นตามสถานะการล็อกอิน
 */
window.showStartScreen = function () {
    console.log("Navigating to Start Screen and performing cleanup...");
    
    // 1. Chat Cleanup: 
    if (chatListener) {
        database.ref(`${CHATS_PATH}/${chatListener.chatId}`).off('child_added', chatListener.callback);
        chatListener = null;
        chatBox.innerHTML = ''; 
        currentChatId = null; 
    }

    // 2. การเปลี่ยนหน้าจอและการจัด UI
    hideAllScreens();
    welcomeScreen.style.display = 'flex'; 
    welcomeScreen.style.flexGrow = '1';

    // 3. จัดการสถานะปุ่ม
    if (currentUserId) {
        // สถานะ: เข้าสู่ระบบแล้ว (มี ID)
        authButton.style.display = 'none';
        mainActions.style.display = 'flex';
        userIdDisplay.style.display = 'block';
        userInfoArea.style.display = 'block';
        userIdDisplay.textContent = `รหัสผู้ใช้: ${currentUserId.substring(0, 7)}...`; 
        
        startChatBtn.onclick = window.loadOrCreateChat; 
        logoutBtn.style.display = 'block';

    } else {
        // สถานะ: ยังไม่ได้เข้าสู่ระบบ
        authButton.style.display = 'block';
        authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
        mainActions.style.display = 'none';
        userIdDisplay.style.display = 'none';
        userInfoArea.style.display = 'none';
        logoutBtn.style.display = 'none';
    }
}

function showChatScreen() {
    hideAllScreens();
    chatScreen.style.display = 'flex'; 
    chatTitle.textContent = `ห้องสนทนา: ${currentChatId ? currentChatId.substring(0, 8) : 'ใหม่'}...`;
}


// ===============================================
// 4. Authentication Status & Logout
// ===============================================

auth.onAuthStateChanged(user => {
    if (user) {
        const storedUserId = localStorage.getItem('friendCornerUserId');

        if (storedUserId && storedUserId === user.uid) {
            currentUserId = user.uid;
        } else if (storedUserId && storedUserId !== user.uid) {
            // ลบ User ที่ไม่ถูกต้องและเริ่ม Sign In ใหม่
            user.delete().then(() => {
                console.log("Deleted incorrect Firebase user. Re-authenticating.");
                currentUserId = null;
                window.handleAuth();
                return; 
            }).catch(error => {
                console.warn("Could not delete incorrect user. Proceeding with new UID:", error);
                currentUserId = user.uid;
                localStorage.setItem('friendCornerUserId', currentUserId);
            });

        } else if (!storedUserId) {
            currentUserId = user.uid;
            localStorage.setItem('friendCornerUserId', currentUserId);
        }

        if (currentUserId) {
            currentChatId = currentUserId; 
            window.showStartScreen();
        }

    } else {
        currentUserId = null;
        currentChatId = null;
        window.showStartScreen();
    }
});


window.handleAuth = function () {
    if (currentUserId) {
        window.showStartScreen();
        return;
    }

    authButton.textContent = 'กำลังสร้าง ID...';

    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
            return auth.signInAnonymously();
        })
        .then(userCredential => {
            console.log("Anonymous sign-in success.");
            // onAuthStateChanged จะจัดการการแสดงผลต่อ
        })
        .catch(error => {
            console.error("Anonymous sign-in failed:", error);
            alert("เกิดข้อผิดพลาดในการเริ่มต้นใช้งาน: " + error.message);
            // คืนสถานะปุ่มและหน้าจอ
            authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
            window.showStartScreen(); 
        });
}


/**
 * @function closeChatSession
 */
function closeChatSession(chatId) {
    if (!chatId) return Promise.resolve();
    return database.ref(`${CHATS_PATH}/${chatId}`).once('value').then(snapshot => {
        const chat = snapshot.val();
        if (chat && chat.status === 'active') {
             return database.ref(`${CHATS_PATH}/${chatId}`).update({
                status: 'closed',
                closedAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
        return Promise.resolve();
    });
}


/**
 * @function performPermanentSignOut
 */
function performPermanentSignOut() {
    closeChatSession(currentUserId)
        .catch(error => {
            console.error("Error closing chat session during permanent sign out:", error);
        })
        .finally(() => {
            auth.signOut().then(() => {
                console.log("User signed out (Permanent Account).");
            }).catch((error) => {
                console.error("Error signing out:", error);
                alert("ออกจากระบบไม่สำเร็จ");
            });
        });
}


/**
 * @function deleteUserAndSignOut
 */
function deleteUserAndSignOut() {
    const user = auth.currentUser;
    if (!user || !currentUserId) {
        performSignOut(true); 
        return;
    }

    closeChatSession(currentUserId)
        .catch(error => {
            console.error("Error closing chat session during delete:", error);
        })
        .finally(() => {
            user.delete().then(() => {
                console.log("Anonymous User ID successfully deleted from Firebase Auth.");
            }).catch(error => {
                console.error("Error deleting user. Proceeding with sign out:", error);
            }).finally(() => {
                performSignOut(true);
            });
        });
}


/**
 * @function userLogout
 */
window.userLogout = function () {
    const user = auth.currentUser;
    if (!user || !currentUserId) {
        performSignOut(true);
        return;
    }

    const isPermanent = user.providerData.some(p => p.providerId === 'password');

    if (isPermanent) {
        if (confirm("คุณแน่ใจหรือไม่ที่จะออกจากระบบ? ครั้งต่อไปคุณสามารถเข้าสู่ระบบด้วยอีเมลเดิมได้")) {
            performPermanentSignOut();
        }
    } else {
        if (confirm("คุณแน่ใจหรือไม่ที่จะออกจากระบบ? User ID นี้จะถูกลบและคุณจะได้รับ ID ใหม่ในการเข้าครั้งหน้า")) {
            deleteUserAndSignOut(); 
        }
    }
};


function performSignOut(removeLocalStorage = false) {
    auth.signOut()
        .then(() => {
            console.log("User signed out.");
            if (removeLocalStorage) {
                localStorage.removeItem('friendCornerUserId');
            }
        })
        .catch((error) => {
            console.error("Error signing out:", error);
            alert("ออกจากระบบไม่สำเร็จ");
        });
}


// ===============================================
// 5. Chat Control (Strict 1-Session Rule)
// ===============================================

window.loadOrCreateChat = function () {
    if (!currentUserId) {
        alert("กรุณาเริ่มต้นใช้งานก่อน");
        return;
    }

    const chatId = currentUserId;

    if (chatListener) {
        database.ref(`${CHATS_PATH}/${chatListener.chatId}`).off('child_added', chatListener.callback);
        chatListener = null;
    }

    database.ref(`${CHATS_PATH}/${chatId}`).once('value', snapshot => {
        const chatData = snapshot.val();

        if (chatData && chatData.status === 'active') {
            console.log("Loading existing active chat:", chatId);
            startChatSession(chatId);

        } else if (chatData && chatData.status === 'closed') {
            alert("คุณได้สิ้นสุดการสนทนาสำหรับ User ID นี้แล้ว กรุณากด 'ออกจากระบบ' เพื่อเริ่ม User ID ใหม่");
            window.showStartScreen();

        } else {
            console.log("No chat found. Creating first and only session.");
            createNewChatSession(chatId);
        }
    })
        .catch(error => {
            console.error("Error loading chat history:", error);
            alert("เกิดข้อผิดพลาดในการตรวจสอบสถานะแชท");
        });
}


function createNewChatSession(chatId) {
    const chatData = {
        ownerUID: currentUserId,
        status: 'active',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastActivity: firebase.database.ServerValue.TIMESTAMP
    };

    database.ref(`${CHATS_PATH}/${chatId}`).set(chatData)
        .then(() => {
            currentChatId = chatId;
            sendSystemMessage(chatId, `--- เริ่มต้นการสนทนาใหม่ (UID: ${chatId.substring(0, 8)}...) ---`);
            startChatSession(chatId);
        })
        .catch(error => {
            console.error("Error creating new chat:", error);
            alert("เกิดข้อผิดพลาดในการเริ่มต้นแชทใหม่");
        });
}


// ===============================================
// 6. Messaging Functions
// ===============================================

function startChatSession(chatId) {
    currentChatId = chatId;
    showChatScreen();
    // 🚩 ล้าง Chat Box ก่อนเสมอ
    chatBox.innerHTML = ''; 

    listenToChat(chatId);

    database.ref(`${CHATS_PATH}/${chatId}`).update({
        lastActivity: firebase.database.ServerValue.TIMESTAMP,
        status: 'active'
    });
}

sendButton.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendSystemMessage(chatId, message) {
    database.ref(`${CHATS_PATH}/${chatId}`).push({
        sender: "system",
        message: message,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg || !currentChatId) return;

    const timestamp = firebase.database.ServerValue.TIMESTAMP;

    database.ref(`${CHATS_PATH}/${currentChatId}`).update({
        lastActivity: timestamp,
        lastMessage: {
            text: msg,
            timestamp: timestamp
        },
        unreadByAdmin: true
    });

    database.ref(`${CHATS_PATH}/${currentChatId}`).push({
        sender: "user",
        message: msg, 
        timestamp: timestamp
    })
        .then(() => {
            chatInput.value = "";
        })
        .catch(error => {
            console.error("Error sending message:", error);
            alert("ส่งข้อความล้มเหลว");
        });
}

/**
 * @function listenToChat
 * ใช้ 'child_added' เพื่อโหลดข้อความเก่าและฟังข้อความใหม่พร้อมกัน (แก้ปัญหาข้อความซ้ำ)
 */
function listenToChat(chatId) {
    if (chatListener) {
        // 1. ยกเลิก Listener เดิม
        database.ref(`${CHATS_PATH}/${chatListener.chatId}`).off('child_added', chatListener.callback);
    }

    const chatBoxEl = document.getElementById("chatBox");
    chatBoxEl.innerHTML = ''; // 2. ล้าง Chat Box ก่อนเริ่มใหม่

    // Callback function สำหรับการแสดงผลข้อความ
    const displayMessageCallback = snap => {
        const data = snap.val();
        
        // กรอง metadata
        if (['lastMessage', 'status', 'unreadByAdmin', 'lastActivity', 'ownerUID', 'createdAt', 'closedAt'].includes(snap.key)) {
            return;
        }
        
        // 3. แสดงข้อความ
        displayUserMessage(data, chatBoxEl, chatId, snap.key);
        chatBoxEl.scrollTop = chatBoxEl.scrollHeight;

        // เสียงแจ้งเตือน
        if (data.sender === "admin" && data.timestamp > (Date.now() - 5000)) {
            notifySound.play().catch(e => console.log("Sound play error:", e));
        }
    };

    // 4. ติดตั้ง Listener 'child_added' 
    database.ref(`${CHATS_PATH}/${chatId}`).on("child_added", displayMessageCallback);

    // 5. เก็บ Listener ไว้เพื่อยกเลิก
    chatListener = { chatId: chatId, callback: displayMessageCallback };
}


/**
 * @function displayUserMessage
 */
window.displayUserMessage = function (data, chatBoxEl, chatId, messageId) {
    // 🚩 ป้องกันการแสดงผลซ้ำหาก element ID นั้นมีอยู่แล้ว (ป้องกันกรณีฉุกเฉิน)
    if (document.getElementById(`msg-${messageId}`)) {
        return; 
    }
    
    const messageDiv = document.createElement("div");
    messageDiv.id = `msg-${messageId}`; 
    messageDiv.className = data.sender === "system" ? "message system-message" : (data.sender === "user" ? "message user-message" : "message friend-message");

    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "bubble";
    bubbleDiv.textContent = data.message || data.text;

    messageDiv.appendChild(bubbleDiv);

    if (data.sender === 'user') {
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-message-btn';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.color = '#dc3545';
        deleteBtn.style.opacity = '0.5';
        deleteBtn.style.marginLeft = '10px';
        deleteBtn.style.alignSelf = 'center';
        deleteBtn.innerHTML = '<i class="fas fa-times"></i>';

        deleteBtn.onclick = () => deleteMessage(chatId, messageId);

        messageDiv.appendChild(deleteBtn);
        messageDiv.classList.add('message-with-actions');
    }

    chatBoxEl.appendChild(messageDiv);
};

/**
 * @function deleteMessage
 */
window.deleteMessage = function (chatId, messageId) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบข้อความนี้? การลบข้อความทำได้เฉพาะข้อความที่คุณส่งเองเท่านั้น')) {
        database.ref(`${CHATS_PATH}/${chatId}/${messageId}`).once('value')
            .then(snapshot => {
                const message = snapshot.val();
                if (message && message.sender === 'user') { 
                    return database.ref(`${CHATS_PATH}/${chatId}/${messageId}`).remove();
                } else {
                    alert("ข้อความนี้ไม่ใช่ข้อความของคุณ หรือไม่ได้รับอนุญาตให้ลบ");
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


// ----------------------------------------------------
// Utility Functions
// ----------------------------------------------------

function formatTime(timestamp) {
    if (!timestamp) return '';

    if (typeof timestamp === 'object' && timestamp.hasOwnProperty('.sv')) {
        return 'กำลังส่ง...';
    }

    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    const now = new Date();
    if (date.toDateString() !== now.toDateString()) {
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month} ${hours}:${minutes}`;
    }

    return `${hours}:${minutes}`;
}


// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    if (!auth.currentUser) {
        window.showStartScreen();
    }
});