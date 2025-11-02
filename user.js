// user.js (ฉบับแก้ไขรวม: V7.0 - บังคับลบ ID ค้างก่อนสร้างใหม่และ Hard Reload)

// ===============================================
// 1. Firebase Initialization & Config
// ===============================================

const firebaseConfig = {
    // 🚩 ALERT: กรุณาใส่ API Key และข้อมูลโปรเจกต์ของคุณที่นี่
    apiKey: "AIzaSyAXBd2MsgeYbILyGPxdYRPpUkkF-z2EDz0", 
    authDomain: "kc-tobe-friendcorner.firebaseapp.com",
    databaseURL: "https://kc-tobe-friendcorner-default-rtdb.firebaseio.com",
    projectId: "kc-tobe-friendcorner",
    storageBucket: "kc-tobe-friendcorner.firebasestorage.app",
    messagingSenderId: "337157160945",
    appId: "1:337157160945:web:151f4da137b16fe6cb8e50",
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();
const database = db; // Alias 

// ** ใช้งาน Server Value สำหรับ Timestamp **
const TIMESTAMP = firebase.database.ServerValue.TIMESTAMP; 

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
const notifySound = document.getElementById('notifySound'); 
const userIdDisplay = document.getElementById('userIdDisplay');
const chatTitle = document.getElementById('chatTitle');
const userInfoArea = document.getElementById('userInfoArea');

const authButton = document.getElementById('authButton');
const mainActions = document.getElementById('mainActions');
const startChatBtn = document.getElementById("startChat");
const logoutBtn = document.getElementById('logoutBtn'); 

const contextMenu = document.getElementById('contextMenu');
const deleteOption = document.getElementById('deleteOption');

let currentUserId = null;
let currentChatId = null; 
let chatListener = null; 
let chatChangeListener = null; 

const CHATS_PATH = 'chats';
const MESSAGES_PATH = 'messages'; 

let activeMessageIdForContextMenu = null; 
let activeChatIdForContextMenu = null;

// ===============================================
// 3. Context Menu Logic 
// ===============================================
document.addEventListener('click', () => {
    contextMenu.style.display = 'none';
    activeMessageIdForContextMenu = null;
    activeChatIdForContextMenu = null;
});

deleteOption.addEventListener('click', () => {
    if (activeMessageIdForContextMenu && activeChatIdForContextMenu) {
        deleteMessage(activeChatIdForContextMenu, activeMessageIdForContextMenu);
    }
    contextMenu.style.display = 'none';
});

function setupContextMenu(bubbleEl, chatId, messageId) {
    bubbleEl.oncontextmenu = function(e) {
        e.preventDefault();
        activeMessageIdForContextMenu = messageId;
        activeChatIdForContextMenu = chatId;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.display = 'block';
    };
    
    let touchTimeout;
    bubbleEl.ontouchstart = function(e) {
        touchTimeout = setTimeout(() => {
            const touch = e.touches[0];
            activeMessageIdForContextMenu = messageId;
            activeChatIdForContextMenu = chatId;
            contextMenu.style.top = `${touch.clientY}px`;
            contextMenu.style.left = `${touch.clientX}px`;
            contextMenu.style.display = 'block';
        }, 800);
    };
    
    bubbleEl.ontouchend = function() { clearTimeout(touchTimeout); };
    bubbleEl.ontouchmove = function() { clearTimeout(touchTimeout); };
}


// ===============================================
// 4. Page Switching & UI Management 
// ===============================================

function hideAllScreens() {
    welcomeScreen.style.display = 'none'; 
    chatScreen.style.display = 'none';
}

window.showStartScreen = function () {
    console.log("Navigating to Start Screen and performing cleanup...");
    
    hideAllScreens();
    welcomeScreen.style.display = 'flex'; 
    welcomeScreen.style.flexGrow = '1';

    if (currentUserId) {
        authButton.style.display = 'none';
        mainActions.style.display = 'flex'; 
        
        userIdDisplay.style.display = 'block';
        userInfoArea.style.display = 'flex'; 
        userIdDisplay.textContent = `รหัสผู้ใช้: ${currentUserId.substring(0, 7)}...`; 
        
        startChatBtn.onclick = window.loadOrCreateChat; 
        logoutBtn.onclick = window.userLogout; 

    } else {
        authButton.style.display = 'block';
        authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
        authButton.onclick = window.handleAuth;
        
        mainActions.style.display = 'none'; 
        
        userIdDisplay.style.display = 'none';
        userInfoArea.style.display = 'none'; 
    }
}

function showChatScreen() {
    hideAllScreens();
    chatScreen.style.display = 'flex'; 
    chatTitle.textContent = `ห้องสนทนา: ${currentChatId ? currentChatId.substring(0, 8) : 'ใหม่'}...`;
}

function cleanupChatSession() {
    if (chatListener) {
        database.ref(`${CHATS_PATH}/${chatListener.chatId}`).off('child_added', chatListener.callback);
        chatListener = null;
    }
    if (chatChangeListener) {
        database.ref(`${CHATS_PATH}/${chatChangeListener.chatId}`).off('child_changed', chatChangeListener.callback);
        chatChangeListener = null;
    }
    chatBox.innerHTML = ''; 
    currentChatId = null; 
}


// ===============================================
// 5. Authentication Status & Logout (ปรับปรุง handleAuth & performSignOut)
// ===============================================

function checkChatStatusAndHandleInvalidId(user) {
    return database.ref(`${CHATS_PATH}/${user.uid}/status`).once('value')
        .then(snapshot => {
            const status = snapshot.val();
            
            if (status === 'closed') {
                console.warn(`[REVERT FIX] Chat ID ${user.uid.substring(0, 8)}... is CLOSED. Forcing sign out and reload.`);
                
                // ใช้ performSignOut(true) เพื่อล้างทุกอย่างและ Hard Reload
                performSignOut(true); 
                return false; // ป้องกันไม่ให้โค้ดส่วนถัดไปทำงาน
            }
            console.log(`[REVERT FIX] ID ${user.uid.substring(0, 8)}... is valid/active. Continuing.`);
            return true;
        })
        .catch(e => {
            console.error("Error checking chat status:", e);
            return true; 
        });
}


auth.onAuthStateChanged(user => {
    if (user) {
        checkChatStatusAndHandleInvalidId(user)
            .then(isIdValid => {
                if (!isIdValid) {
                    return; 
                }

                currentUserId = user.uid;
                localStorage.setItem('friendCornerUserId', currentUserId); 
                currentChatId = currentUserId; 
                
                setupDisconnectHandler(currentUserId);
                updateChatOwnerUID(currentUserId, currentUserId);
                
                window.showStartScreen();
            });

    } else {
        if (currentUserId) {
            clearDisconnectHandler(currentUserId);
            updateChatOwnerUID(currentUserId, null); 
        }
        
        currentUserId = null;
        cleanupChatSession(); 
        window.showStartScreen();
    }
});

/**
 * @function handleAuth (🔥 การแก้ไขหลัก: บังคับลบ User เก่าที่ค้างในบราวเซอร์)
 */
window.handleAuth = async function () {
    if (currentUserId) {
        window.showStartScreen();
        return;
    }

    authButton.textContent = 'กำลังสร้าง ID...';

    try {
        // 🚩 [NEW] ขั้นตอนที่ 1: ตรวจสอบและพยายามลบ ID เก่าที่ค้างใน Auth Context
        if (auth.currentUser) {
            console.warn(`Found existing user (UID: ${auth.currentUser.uid.substring(0, 7)}...) in memory. Attempting to delete it before new sign-in.`);
            try {
                // พยายามลบ User เก่าที่ Firebase อาจยังจำ Session ไว้ (ใช้ได้กับทั้ง Anonymous และ Admin/Email)
                await auth.currentUser.delete();
                console.log("Successfully deleted old user before new sign-in.");
            } catch (deleteError) {
                // ถ้าลบไม่ได้ (เช่น session หมดอายุ ต้อง Re-Auth) ให้ SignOut ทิ้งแทน
                console.warn("Failed to delete old user, signing out instead:", deleteError.message);
                await auth.signOut();
            }
        }

        // 🚩 ขั้นตอนที่ 2: ตั้งค่า Persistence และสร้าง ID ใหม่
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); 
        await auth.signInAnonymously();
        
        console.log("Anonymous sign-in success. onAuthStateChanged will handle display.");

    } catch (error) {
        console.error("Anonymous sign-in failed:", error);
        alert("เกิดข้อผิดพลาดในการเริ่มต้นใช้งาน: " + error.message);
        authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
        window.showStartScreen(); 
    }
}

function updateChatOwnerUID(chatId, ownerUID) {
    if (!chatId) return;
    return database.ref(`${CHATS_PATH}/${chatId}`).update({
        ownerUID: ownerUID 
    }).catch(error => {
        console.error("Error updating ownerUID:", error);
    });
}

// --- On Disconnect Handler ---
function setupDisconnectHandler(chatId) {
    if (!chatId) return;
    const chatRef = database.ref(`${CHATS_PATH}/${chatId}/ownerUID`);
    
    chatRef.onDisconnect().set(null)
        .then(() => console.log(`OnDisconnect handler set for chat: ${chatId}.`))
        .catch(error => console.error(`Error setting onDisconnect handler:`, error));
}

function clearDisconnectHandler(chatId) {
    if (!chatId) return;
    const chatRef = database.ref(`${CHATS_PATH}/${chatId}/ownerUID`);
    
    chatRef.onDisconnect().cancel()
        .then(() => console.log(`OnDisconnect handler cleared for chat: ${chatId}.`))
        .catch(error => console.error(`Error clearing onDisconnect handler:`, error));
}
// -----------------------------


window.userLogout = function () {
    const user = auth.currentUser;
    if (!user || !currentUserId) {
        performSignOut(true);
        return;
    }

    const isAnonymous = user.isAnonymous;

    if (!isAnonymous) {
        if (confirm("คุณแน่ใจหรือไม่ที่จะออกจากระบบ? ครั้งต่อไปคุณสามารถเข้าสู่ระบบด้วยอีเมลเดิมได้")) {
            performSignOut(false); 
        }
    } else {
        // Anonymous User
        if (confirm("คุณแน่ใจหรือไม่ที่จะออกจากระบบ? User ID นี้จะถูกลบและคุณจะได้รับ ID ใหม่ในการเข้าครั้งหน้า")) {
            deleteUserAndSignOut(); 
        }
    }
};

/**
 * @function deleteUserAndSignOut
 */
async function deleteUserAndSignOut() {
    const user = auth.currentUser;
    if (!user || !currentUserId) {
        await performSignOut(true);
        return;
    }

    const chatId = currentUserId;
    const metadataKeys = ['ownerUID', 'status', 'createdAt', 'lastActivity', 'lastMessage', 'unreadByAdmin', 'unreadByUser', 'closedAt'];
    let shouldDeleteChat = false;

    // --- 1. ตรวจสอบเนื้อหาแชท ---
    try {
        const snapshot = await database.ref(`${CHATS_PATH}/${chatId}`).once('value');
        const chatData = snapshot.val();
        let messageCount = 0;

        if (chatData) {
            for (const key in chatData) {
                if (chatData.hasOwnProperty(key) && !metadataKeys.includes(key)) {
                    messageCount++;
                }
            }
        }

        if (messageCount <= 1) { 
            console.log(`[DELETE CHAT] Chat ${chatId.substring(0, 8)}... has only ${messageCount} message(s). Preparing to delete chat record.`);
            shouldDeleteChat = true;
        } else {
            console.log(`[KEEP CHAT] Chat ${chatId.substring(0, 8)}... has ${messageCount} messages. Keeping chat record.`);
        }

    } catch (error) {
        console.error("Error checking chat content before deletion:", error);
    }

    // --- 2. ลบ Chat ID ตามเงื่อนไข ---
    if (shouldDeleteChat) {
        try {
            await database.ref(`${CHATS_PATH}/${chatId}`).remove();
            console.log("Chat record successfully removed from Realtime DB.");
        } catch (error) {
            console.error("Error deleting chat record:", error);
        }
    }

    // --- 3. ลบ Firebase Auth User และ Sign Out ---
    try {
        // 🔥 ลบ ID จาก Firebase Auth
        await user.delete();
        console.log("Anonymous User ID successfully deleted from Firebase Auth.");
    } catch (error) {
        console.error("Error deleting user (e.g., needs re-auth). Proceeding with sign out):", error);
        alert("ไม่สามารถลบ User ID เดิมได้ (อาจต้องเข้าสู่ระบบใหม่เพื่อยืนยัน) จะดำเนินการออกจากระบบแทน");
    } finally {
        // ล้าง Local Storage และบังคับ Hard Reload
        await performSignOut(true); 
    }
}


/**
 * @function performSignOut (🔥 บังคับตั้ง Persistence เป็น NONE และ Hard Reload)
 */
async function performSignOut(removeLocalStorage = false) {
    try {
        // บังคับตั้งค่า Persistence เป็น NONE เพื่อเคลียร์การจำ Session ในบราวเซอร์
        if (removeLocalStorage) {
            await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
            console.log("Persistence set to NONE.");
        }
        
        await auth.signOut();
        console.log("User signed out.");

        if (removeLocalStorage) {
            // สำคัญ: ลบ Local Storage เพื่อให้ Firebase ไม่จำ ID เก่าอีก
            localStorage.removeItem('friendCornerUserId'); 
            console.log("Local Storage (friendCornerUserId) cleared.");
            
            // 🚩 [สำคัญ] บังคับรีโหลดแบบไม่ใช้แคช (Hard Reload)
            window.location.reload(true); 
        }

    } catch (error) {
        console.error("Error signing out:", error);
        alert("ออกจากระบบไม่สำเร็จ");
    }
}


// ===============================================
// 6. Chat Control (Strict 1-Session Rule) 
// ===============================================

window.loadOrCreateChat = function () {
    if (!currentUserId) {
        alert("กรุณาเริ่มต้นใช้งานก่อน");
        return;
    }

    const chatId = currentUserId;

    cleanupChatSession(); 

    database.ref(`${CHATS_PATH}/${chatId}`).once('value', snapshot => {
        const chatData = snapshot.val();

        if (chatData && chatData.status === 'active') {
            console.log("Loading existing active chat:", chatId);
            
            updateChatOwnerUID(chatId, currentUserId)
                .then(() => startChatSession(chatId));

        } else if (chatData && chatData.status === 'closed') {
            console.warn("Chat is closed. Forcing new session creation (Overwriting status).");
            
            clearDisconnectHandler(currentUserId);
            updateChatOwnerUID(currentUserId, null);
            
            createNewChatSession(chatId); 
            return;
            
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
    const authUid = firebase.auth().currentUser ? firebase.auth().currentUser.uid : 'N/A';
    console.log(`[CREATE CHAT] Attempting to SET chat at /chats/${chatId}`);
    
    const chatData = {
        ownerUID: currentUserId,
        status: 'active',
        createdAt: TIMESTAMP, 
        lastActivity: TIMESTAMP 
    };

    database.ref(`${CHATS_PATH}/${chatId}`).set(chatData)
        .then(() => {
            console.log("[CREATE CHAT] Success.");
            currentChatId = chatId;
            // ส่งข้อความระบบเริ่มต้น (นับเป็น 1 ข้อความ)
            database.ref(`${CHATS_PATH}/${chatId}`).push({
                sender: 'system',
                text: 'เริ่มต้นเซสชันสนทนาใหม่แล้ว',
                timestamp: TIMESTAMP
            });
            startChatSession(chatId);
        })
        .catch(error => {
            console.error("Error creating new chat:", error);
            alert("เกิดข้อผิดพลาดในการเริ่มต้นแชทใหม่: " + error.message); 
        });
}


// ===============================================
// 7. Messaging Functions 
// ===============================================

function startChatSession(chatId) {
    currentChatId = chatId;
    showChatScreen();
    
    listenToChat(chatId);
    listenToChatChanges(chatId); 

    database.ref(`${CHATS_PATH}/${chatId}`).update({
        lastActivity: TIMESTAMP, 
        status: 'active'
    });
}

function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg || !currentChatId) return;

    const timestamp = TIMESTAMP; 

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
        timestamp: timestamp,
        deleted: false 
    })
        .then(() => {
            chatInput.value = "";
        })
        .catch(error => {
            console.error("Error sending message:", error);
            alert("ส่งข้อความล้มเหลว");
        });
}

function listenToChat(chatId) {
    if (chatListener) {
        database.ref(`${CHATS_PATH}/${chatListener.chatId}`).off('child_added', chatListener.callback);
    }
    const chatBoxEl = document.getElementById("chatBox");
    chatBoxEl.innerHTML = ''; 
    const displayMessageCallback = snap => {
        const data = snap.val();
        if (data && (!data.sender || typeof data.sender !== 'string')) { return; }
        if (data.sender !== 'system' && !data.message && !data.text && !data.deleted) {
             console.warn("Filtered out incomplete message (no content):", snap.key);
             return; 
        }
        displayUserMessage(data, chatBoxEl, chatId, snap.key);
        chatBoxEl.scrollTop = chatBoxEl.scrollHeight;
        if (data.sender === "admin" && data.timestamp > (Date.now() - 5000)) {
            notifySound.play().catch(e => console.log("Sound play error (Check notify.mp3 path):", e)); 
        }
        database.ref(`${CHATS_PATH}/${chatId}`).update({ unreadByUser: false });
    };
    database.ref(`${CHATS_PATH}/${chatId}`).orderByKey().on("child_added", displayMessageCallback); 
    chatListener = { chatId: chatId, callback: displayMessageCallback };
}

function listenToChatChanges(chatId) {
    if (chatChangeListener) {
        database.ref(`${CHATS_PATH}/${chatChangeListener.chatId}`).off('child_changed', chatChangeListener.callback);
    }
    const updateMessageCallback = snap => {
        const data = snap.val();
        const messageId = snap.key;
        if (data && (!data.sender || typeof data.sender !== 'string')) { return; }
        const existingEl = document.getElementById(`msg-${messageId}`);
        if (existingEl) {
            if (data.deleted === true) {
                existingEl.style.display = 'none';
                let deleteSystemMsg = document.getElementById(`deleted-msg-${messageId}`);
                if (!deleteSystemMsg) {
                    deleteSystemMsg = document.createElement("div");
                    deleteSystemMsg.id = `deleted-msg-${messageId}`; 
                    deleteSystemMsg.className = "message deleted-system-message"; 
                    deleteSystemMsg.innerHTML = `<i class="fas fa-ban" style="margin-right: 5px;"></i> <em>คุณได้ยกเลิกการส่งข้อความ</em>`;
                    const chatBoxEl = document.getElementById("chatBox");
                    const nextSibling = existingEl.nextSibling;
                    if (nextSibling) {
                        chatBoxEl.insertBefore(deleteSystemMsg, nextSibling);
                    } else {
                        chatBoxEl.appendChild(deleteSystemMsg);
                    }
                }
            } 
        }
    };
    database.ref(`${CHATS_PATH}/${chatId}`).on("child_changed", updateMessageCallback);
    chatChangeListener = { chatId: chatId, callback: updateMessageCallback };
}

window.displayUserMessage = function (data, chatBoxEl, chatId, messageId) {
    if (document.getElementById(`msg-${messageId}`) || document.getElementById(`deleted-msg-${messageId}`)) {
        return; 
    }
    const isUserMessage = data.sender === "user";
    const isSystemMessage = data.sender === "system";
    if (data.deleted === true) {
        const deleteSystemMsg = document.createElement("div");
        deleteSystemMsg.id = `deleted-msg-${messageId}`;
        deleteSystemMsg.className = "message deleted-system-message"; 
        deleteSystemMsg.innerHTML = `<i class="fas fa-ban" style="margin-right: 5px;"></i> <em>คุณได้ยกเลิกการส่งข้อความ</em>`;
        chatBoxEl.appendChild(deleteSystemMsg);
        return; 
    }
    let messageContent = data.message || data.text || ''; 
    if (isSystemMessage && messageContent.startsWith('--- เริ่มต้นการสนทนาใหม่')) { return; }
    const messageDiv = document.createElement("div");
    messageDiv.id = `msg-${messageId}`; 
    messageDiv.className = isSystemMessage ? "message system-message" : (isUserMessage ? "message user-message" : "message friend-message"); 
    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "bubble";
    bubbleDiv.innerHTML = messageContent; 
    if (!isSystemMessage) {
        const timeDiv = document.createElement("div");
        timeDiv.className = "message-time-outside small"; 
        timeDiv.textContent = formatTime(data.timestamp);
        if (!isUserMessage) {
            messageDiv.appendChild(timeDiv);
            messageDiv.appendChild(bubbleDiv);
        } else {
            messageDiv.appendChild(bubbleDiv);
            messageDiv.appendChild(timeDiv); 
            setupContextMenu(bubbleDiv, chatId, messageId);
        }
    } else {
        messageDiv.appendChild(bubbleDiv);
    }
    chatBoxEl.appendChild(messageDiv);
};

window.deleteMessage = function (chatId, messageId) {
    if (confirm('คุณแน่ใจหรือไม่ที่จะยกเลิกการส่งข้อความนี้?')) {
        database.ref(`${CHATS_PATH}/${chatId}/${messageId}`).once('value')
            .then(snapshot => {
                const message = snapshot.val();
                if (message && message.sender === 'user' && message.deleted !== true && currentUserId) { 
                    return database.ref(`${CHATS_PATH}/${chatId}/${messageId}`).update({
                        deleted: true,
                        deletedAt: TIMESTAMP 
                    });
                } else if (message && message.deleted === true) {
                    alert("ข้อความนี้ถูกยกเลิกการส่งไปแล้ว");
                    throw new Error("Already deleted.");
                } else {
                    alert("ข้อความนี้ไม่ใช่ข้อความของคุณ หรือไม่ได้รับอนุญาตให้ยกเลิกการส่ง");
                    throw new Error("Permission denied or message not found.");
                }
            })
            .then(() => {
                console.log(`Soft deleted message: ${messageId}`);
            })
            .catch((error) => {
                console.error("Error deleting message:", error);
                if (error.message.includes("Permission denied") || error.message.includes("Already deleted")) return; 
                alert("ไม่สามารถยกเลิกการส่งข้อความได้");
            });
    }
}


// ----------------------------------------------------
// Utility Functions 
// ----------------------------------------------------

function formatTime(timestamp) {
    if (!timestamp) return '';
    if (typeof timestamp === 'object' && timestamp.hasOwnProperty('.sv')) { return 'กำลังส่ง...'; }
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
    sendButton.addEventListener("click", sendMessage);
    chatInput.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    chatBox.oncontextmenu = function(e) { e.preventDefault(); }; 
    document.body.oncontextmenu = function(e) { e.preventDefault(); }; 

    if (!auth.currentUser) {
        window.showStartScreen();
    }
});