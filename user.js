// user.js (ฉบับแก้ไข: V9.3 - Final Clean Version: Fixed Admin History)

// ===============================================
// 1. Firebase Initialization & Config
// ===============================================

const firebaseConfig = {
    // 🚩 [CONFIG] กรุณาใช้ข้อมูลของ Firebase Project ของคุณ
    apiKey: "AIzaSyCs3_LcJN5RfOIo9jZ4fnz1CBl8hXqfvig",
    authDomain: "kc-tobe-friendcorner-21655.firebaseapp.com",
    databaseURL: "https://kc-tobe-friendcorner-21655-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "kc-tobe-friendcorner-21655",
    storageBucket: "kc-tobe-friendcorner-21655.firebasestorage.app",
    messagingSenderId: "722433178265",
    appId: "1:722433178265:web:f7369aa65b3063a8ab1608"
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
const startChatBtn = document.getElementById("startChat"); // ปุ่ม 'เริ่มแชท/เข้าสู่แชทเดิม'
const logoutBtn = document.getElementById('logoutBtn'); // ปุ่ม 'ออกจากระบบ'

const contextMenu = document.getElementById('contextMenu');
const deleteOption = document.getElementById('deleteOption');
const copyOption = document.getElementById('copyOption'); 

let currentUserId = null;
let currentChatId = null; 
let chatListener = null; 
let chatChangeListener = null; 

const CHATS_PATH = 'chats';
const MESSAGES_PATH = 'messages'; 

let activeMessageIdForContextMenu = null; 
let activeChatIdForContextMenu = null;

// ===============================================
// 3. Utility Functions (Nickname Generator)
// ===============================================

function generateRandomName() {
    const adjectives = ["เพื่อนสนิท", "ผู้แชร์เรื่องราว", "นักฟัง", "มุมมองใหม่", "เพื่อนร่วมทาง", "ผู้เดินทาง", "เงา", "สายลม"];
    const nouns = ["สีฟ้า", "สีเขียว", "สีม่วง", "สีส้ม", "สีดำ", "สีเทา", "สีขาว", "สีเหลือง"];
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(RNG_Function(randomAdj, randomNoun) * nouns.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000); 
    return `${randomAdj} ${randomNoun} #${randomNum}`;
}

// 🚩 [SECURITY] ฟังก์ชัน RNG ปลอมเพื่อหลีกเลี่ยงการทำนาย (สำหรับ Nickname)
function RNG_Function(seed1, seed2) {
    let hash = 0;
    const str = seed1 + seed2 + Date.now().toString().substring(0, 5);
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    let number = Math.sin(hash) * 10000;
    return number - Math.floor(number);
}


// ===============================================
// 4. Context Menu Logic 
// ===============================================

// 🚩 ซ่อน Context Menu เมื่อคลิกที่อื่น
document.addEventListener('click', (e) => {
    if (e.target.closest('#contextMenu') === null) {
        contextMenu.style.display = 'none';
        activeMessageIdForContextMenu = null;
        activeChatIdForContextMenu = null;
    }
});
// ป้องกันการแสดงเมนูเบราว์เซอร์เมื่อคลิกขวา (เพื่อให้ Context Menu ของเราทำงาน)
document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.message-bubble') === null) {
        contextMenu.style.display = 'none';
    }
});


deleteOption.addEventListener('click', () => {
    if (activeMessageIdForContextMenu && activeChatIdForContextMenu) {
        deleteMessage(activeChatIdForContextMenu, activeMessageIdForContextMenu);
    }
    contextMenu.style.display = 'none';
});

// Listener สำหรับ Copy Option
if (copyOption) {
    copyOption.addEventListener('click', () => {
        if (activeMessageIdForContextMenu && activeChatIdForContextMenu) {
             copyMessage(activeChatIdForContextMenu, activeMessageIdForContextMenu);
        }
        contextMenu.style.display = 'none';
    });
}


function setupContextMenu(bubbleEl, chatId, messageId) {
    
    const isUserMessage = firebase.auth().currentUser && firebase.auth().currentUser.uid === chatId;

    // 🚩 Desktop (Right-click)
    bubbleEl.oncontextmenu = function(e) {
        e.preventDefault();
        
        // กำหนดปุ่ม Delete (อนุญาตเฉพาะข้อความของตัวเอง)
        deleteOption.style.display = isUserMessage ? 'block' : 'none';
        
        activeMessageIdForContextMenu = messageId;
        activeChatIdForContextMenu = chatId;
        
        const posX = e.clientX;
        const posY = e.clientY;
        
        contextMenu.style.top = `${posY}px`;
        contextMenu.style.left = `${posX}px`;
        contextMenu.style.display = 'block';
        
        // ปรับตำแหน่งไม่ให้เกินขอบ 
        const rect = contextMenu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            contextMenu.style.left = `${posX - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            contextMenu.style.top = `${posY - rect.height}px`;
        }
    };
    
    // 🚩 Mobile (Long-press)
    let touchTimeout;
    bubbleEl.ontouchstart = function(e) {
        
        const touch = e.touches[0];
        const touchY = touch.clientY;
        
        touchTimeout = setTimeout(() => {
            // กำหนดปุ่ม Delete
            deleteOption.style.display = isUserMessage ? 'block' : 'none';
            
            activeMessageIdForContextMenu = messageId;
            activeChatIdForContextMenu = chatId;
            
            contextMenu.style.top = `${touchY}px`;
            contextMenu.style.left = `${touch.clientX}px`;
            contextMenu.style.display = 'block';
            
            // ปรับตำแหน่งไม่ให้เกินขอบ (Mobile)
            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = `${touch.clientX - rect.width}px`;
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = `${touchY - rect.height}px`;
            }

        }, 800);
    };
    
    bubbleEl.ontouchend = function() { clearTimeout(touchTimeout); };
    bubbleEl.ontouchmove = function() { clearTimeout(touchTimeout); };
}


// ===============================================
// 5. Page Switching & UI Management (Fixed Logout Button UI)
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
        // 🚩 [FIXED UI] แสดงปุ่มแยกกัน
        
        // 1. ซ่อนปุ่ม "เริ่มต้นใช้งาน (สุ่ม ID)"
        authButton.style.display = 'none'; 
        
        // 2. แสดงกลุ่มปุ่ม action เดิม (เข้าสู่แชทเดิม และ ออกจากระบบ)
        mainActions.style.display = 'flex'; 
        
        // 3. ตั้งค่าปุ่มใน mainActions
        startChatBtn.textContent = 'กดเพื่อสนทนา'; // เปลี่ยนชื่อปุ่ม
        startChatBtn.onclick = window.loadOrCreateChat; 
        logoutBtn.onclick = window.userLogout; 
        
        // 4. แสดง User ID (userInfoArea)
        userIdDisplay.style.display = 'block';
        userInfoArea.style.display = 'flex'; 
        userIdDisplay.textContent = `รหัสผู้ใช้: ${currentUserId.substring(0, 7)}...`; 

    } else {
        // กรณีไม่มี ID
        authButton.style.display = 'block';
        authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
        authButton.onclick = window.handleAuth;
        authButton.classList.add('primary-button');
        
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
// 6. Authentication Status & Logout (ID Persistence Fix)
// ===============================================

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
    const chatRef = database.ref(`${CHATS_PATH}/${chatId}`);
    
    // 🚩 ลบ ID, ปิดสถานะ, บันทึกเวลาเมื่อ Client ปิด Browser/Tab
    chatRef.child('ownerUID').onDisconnect().set(null); 
    chatRef.child('status').onDisconnect().set('closed'); 
    chatRef.child('closedAt').onDisconnect().set(TIMESTAMP); 
    
    console.log(`OnDisconnect handler set for chat: ${chatId}.`);
}

function clearDisconnectHandler(chatId) {
    if (!chatId) return;
    const chatRef = database.ref(`${CHATS_PATH}/${chatId}`);
    
    chatRef.child('ownerUID').onDisconnect().cancel();
    chatRef.child('status').onDisconnect().cancel();
    chatRef.child('closedAt').onDisconnect().cancel();
    
    console.log(`OnDisconnect handler cleared for chat: ${chatId}.`);
}
// -----------------------------

/**
 * @function checkChatStatusAndHandleInvalidId
 * ตรวจสอบสถานะแชทใน DB. หากพบ 'closed' และเป็น Anonymous User ให้ลบ ID นั้นทิ้งและบังคับรีโหลด
 */
function checkChatStatusAndHandleInvalidId(user) {
    // หาก User ไม่ใช่ Anonymous จะอนุญาตให้ใช้ ID เดิมต่อไป (ไม่บังคับลบ)
    if (!user.isAnonymous) {
        console.log(`[FIXED LOGIC] ID ${user.uid.substring(0, 8)}... is NOT Anonymous. Continuing.`);
        return Promise.resolve(true); 
    }

    // ตรวจสอบสถานะแชทสำหรับ Anonymous User
    return database.ref(`${CHATS_PATH}/${user.uid}/status`).once('value')
        .then(snapshot => {
            const status = snapshot.val();
            
            // 🔥 ถ้าสถานะเป็น 'closed' ให้ถือว่า ID นี้ไม่ต้องการใช้งานแล้ว
            if (status === 'closed') {
                console.warn(`[FORCE ID DELETION] Chat ID ${user.uid.substring(0, 8)}... is CLOSED. Deleting Anonymous ID and forcing reload.`);
                
                // 🚩 [FIX] ลบ Anonymous User ID ทิ้งถาวรจาก Firebase Auth
                // **เราจะทำ Sign Out/Reload ใน finally ของฟังก์ชันนี้**
                return deleteAnonymousUserAndSignOut(user.uid, true)
                    .then(() => false);
            }
            
            console.log(`[FIXED LOGIC] ID ${user.uid.substring(0, 8)}... is valid/active. Continuing.`);
            return true;
        })
        .catch(e => {
            console.error("Error checking chat status:", e);
            return true; 
        });
}


// 🔥 [FIX: ID PERSISTENCE LOGIC]
auth.onAuthStateChanged(user => {
    if (user) {
        currentUserId = user.uid;
        currentChatId = currentUserId; 
        
        // 1. Setup Disconnect Handler
        setupDisconnectHandler(currentUserId);
        
        // 2. บังคับอัปเดตสถานะเป็น active ทันที 
        const updateStatusPromise = database.ref(`${CHATS_PATH}/${currentUserId}`).update({
            status: 'active',
            ownerUID: currentUserId,
            closedAt: null
        }).catch(e => {
            console.log("Chat update on login failed, possibly new user or no record yet.", e);
        });
        
        // 3. รอให้ Update เสร็จ แล้วค่อยตรวจสอบสถานะปิด
        updateStatusPromise.finally(() => {
            checkChatStatusAndHandleInvalidId(user)
                .then(isIdValid => {
                    if (!isIdValid) {
                        return; // ID ถูกลบ, หน้านี้จะ Reload เอง
                    }
                    window.showStartScreen();
                })
                .catch(e => {
                    console.error("Error during auth state recovery final step:", e);
                    window.showStartScreen(); 
                });
        });

    } else {
        // --- Logic เมื่อ User Sign Out ---
        if (currentUserId) {
            clearDisconnectHandler(currentUserId);
        }
        
        currentUserId = null;
        cleanupChatSession(); 
        window.showStartScreen();
    }
});


/**
 * @function handleAuth (ตั้งค่า Persistence เป็น LOCAL และสร้าง ID ใหม่)
 * 🚩 [FIX] มี Guard Clause ป้องกันการสร้าง ID ซ้ำ
 */
window.handleAuth = async function () {
    if (currentUserId) {
        // 🚩 [GUARD CLAUSE] ป้องกันการสร้าง ID ใหม่
        console.warn("Attempted to sign in anonymously but currentUserId already exists. Loading existing chat instead.");
        window.loadOrCreateChat(); // ถ้ามี ID อยู่แล้ว ให้โหลดแชทเดิมทันที
        return;
    }

    authButton.textContent = 'กำลังสร้าง ID...';

    try {
        // ตั้งค่า Persistence เป็น LOCAL
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); 
        console.log("Persistence set to LOCAL.");

        // สร้าง ID ใหม่
        await auth.signInAnonymously();
        
        console.log("Anonymous sign-in success. onAuthStateChanged will handle display.");

    } catch (error) {
        console.error("Anonymous sign-in failed:", error);
        alert("เกิดข้อผิดพลาดในการเริ่มต้นใช้งาน: " + error.message);
        authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
        window.showStartScreen(); 
    }
}


/**
 * userLogout: ปิดแชทและลบ ID ถาวรเมื่อ Logout (ถ้าเป็น Anonymous)
 */
window.userLogout = async function () {
    const user = auth.currentUser;
    
    if (!user || !currentUserId) {
        await performSignOut(true);
        return;
    }

    const isAnonymous = user.isAnonymous;
    let confirmMessage = isAnonymous 
        ? "คุณแน่ใจหรือไม่ที่จะออกจากระบบ? User ID นี้จะถูกลบ **ถาวร** และคุณจะได้รับ ID ใหม่ในการเข้าครั้งหน้า"
        : "คุณแน่ใจหรือไม่ที่จะออกจากระบบ? ครั้งต่อไปคุณสามารถเข้าสู่ระบบด้วยอีเมลเดิมได้";

    if (!confirm(confirmMessage)) {
        return; 
    }
    
    // --- ขั้นตอนที่ 1: ปิดแชทและย้ายไป History ทันที ---
    const chatId = currentUserId;
    const chatRef = database.ref(`${CHATS_PATH}/${chatId}`);

    try {
        clearDisconnectHandler(chatId);

        await chatRef.update({
            status: 'closed', 
            ownerUID: null,   
            closedAt: TIMESTAMP 
        });
        console.log(`[Logout] Chat ${chatId.substring(0, 8)}... closed.`);

    } catch (error) {
        console.error("Error closing chat before logout. Proceeding with sign out:", error);
    }

    // --- ขั้นตอนที่ 2: ลบ User (ถ้าเป็น Anonymous) หรือ Sign Out ---
    if (isAnonymous) {
        // 🚩 [FIX] เรียกฟังก์ชันลบ ID ที่รวมการลบ DB/Auth
        await deleteAnonymousUserAndSignOut(chatId, false); 
    } else {
        await performSignOut(false);
    }
};

/**
 * deleteAnonymousUserAndSignOut: ลบ Anonymous User จาก Firebase Auth และ Chat Record
 * @param {string} chatId - UID ของผู้ใช้
 * @param {boolean} isForced - True หากเป็นการเรียกใช้เพื่อแก้ไข ID ค้าง (บังคับลบและ Reload)
 */
async function deleteAnonymousUserAndSignOut(chatId, isForced) {
    const user = auth.currentUser;
    
    if (!user) {
        await performSignOut(true);
        return;
    }

    const metadataKeys = ['ownerUID', 'status', 'createdAt', 'lastActivity', 'lastMessage', 'unreadByAdmin', 'unreadByUser', 'closedAt', 'userNickname'];
    let shouldDeleteChatRecord = false;

    // --- 1. ตรวจสอบเนื้อหาแชท ---
    try {
        // 🚩 [IMPORTANT FIX] แก้ไข Logic การลบ: เราจะไม่ลบแชทที่ User กด Logout เองแล้ว
        
        if (isForced) { 
            console.log(`[DELETE CHAT RECORD] Chat is FORCED to be deleted (ID closed/invalid).`);
            shouldDeleteChatRecord = true;
        } else {
            console.log(`[KEEP CHAT RECORD] Chat is NOT forced. Keeping in History for Admin.`);
            shouldDeleteChatRecord = false;
        }

    } catch (error) {
        console.error("Error checking chat content before deletion:", error);
    }

    // --- 2. ลบ Chat Record จาก Realtime DB ตามเงื่อนไข ---
    if (shouldDeleteChatRecord) {
        try {
            // 🚩 [FIX] ลบโหนดทั้งหมดออกจาก Realtime DB
            await database.ref(`${CHATS_PATH}/${chatId}`).remove();
            console.log("Chat record successfully removed from Realtime DB.");
        } catch (error) {
            console.error("Error deleting chat record:", error);
        }
    }

    // --- 3. ลบ Firebase Auth User และ Sign Out ---
    try {
        // 🚩 [FIX] ลบบัญชีผู้ใช้ Firebase Auth
        await user.delete();
        console.log("Anonymous User ID successfully deleted from Firebase Auth.");
    } catch (error) {
        console.error("Error deleting user (e.g., needs re-auth). Proceeding with sign out):", error);
    } finally {
        // 🚩 [FIX] บังคับ Sign Out และ Reload (ล้าง Local Storage)
        await performSignOut(true); 
    }
}


/**
 * performSignOut (ล้าง Local Storage และ Hard Reload)
 * @param {boolean} removeLocalStorage - True เพื่อล้าง Local Storage และ Hard Reload
 */
async function performSignOut(removeLocalStorage = false) {
    try {
        await auth.signOut();
        console.log("User signed out.");

        if (removeLocalStorage) {
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
// 7. Chat Control (Strict 1-Session Rule) 
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

        if (chatData && chatData.status === 'active' && chatData.ownerUID === currentUserId) {
            console.log("Loading existing active chat:", chatId);
            
            updateChatOwnerUID(chatId, currentUserId)
                .then(() => database.ref(`${CHATS_PATH}/${chatId}`).update({ status: 'active', closedAt: null }))
                .then(() => startChatSession(chatId));

        } else if (chatData && chatData.status === 'active' && chatData.ownerUID !== currentUserId) { 
            console.warn(`[FORCE CLOSE] Chat has active status but ownerUID mismatch. Forcing close.`);
            database.ref(`${CHATS_PATH}/${chatId}`).update({ 
                status: 'closed', 
                ownerUID: null, 
                closedAt: TIMESTAMP 
            }).then(() => {
                alert("พบแชทที่สถานะค้าง ได้ทำการปิดแชทนั้นเรียบร้อยแล้ว กรุณาเริ่มแชทใหม่");
                createNewChatSession(chatId);
            });
            return;
            
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
    const randomNickname = generateRandomName(); 
    console.log(`[CREATE CHAT] Attempting to SET chat at /chats/${chatId}`);
    
    const chatData = {
        ownerUID: currentUserId,
        status: 'active',
        createdAt: TIMESTAMP, 
        lastActivity: TIMESTAMP,
        userNickname: randomNickname 
    };

    database.ref(`${CHATS_PATH}/${chatId}`).set(chatData)
        .then(() => {
            console.log("[CREATE CHAT] Success.");
            currentChatId = chatId;
            startChatSession(chatId);

            // ส่งข้อความเริ่มต้นอัตโนมัติ (System Message)
            sendSystemMessage(chatId, `สวัสดีครับ ${randomNickname}! คุณได้เริ่มต้นการสนทนาใหม่แล้ว รหัสผู้ใช้ของคุณคือ: ${chatId.substring(0, 8)}...`);
        })
        .catch(error => {
            console.error("Error creating chat session:", error);
            alert("ไม่สามารถสร้างห้องสนทนาได้");
        });
}

function startChatSession(chatId) {
    console.log(`Starting chat session for: ${chatId.substring(0, 8)}...`);
    currentChatId = chatId; 
    
    showChatScreen();
    
    database.ref(`${CHATS_PATH}/${chatId}`).update({ 
        unreadByUser: false, 
        status: 'active',
        ownerUID: currentUserId,
        closedAt: null
    }); 
    
    attachMessageListener(chatId);
    attachChatChangeListener(chatId);

    // Focus input field
    setTimeout(() => {
        chatInput.focus();
    }, 100);
}

function attachChatChangeListener(chatId) {
    if (chatChangeListener) {
        database.ref(`${CHATS_PATH}/${chatChangeListener.chatId}`).off('child_changed', chatChangeListener.callback);
    }

    const callback = (snapshot) => {
        if (snapshot.key === 'status' && snapshot.val() === 'closed') {
            alert("ห้องสนทนานี้ถูกปิดโดยแอดมินหรือระบบแล้ว กรุณาออกจากระบบและเริ่มแชทใหม่");
            window.showStartScreen(); 
        }
    };
    
    database.ref(`${CHATS_PATH}/${chatId}`).on('child_changed', callback);
    chatChangeListener = { chatId, callback };
}


function attachMessageListener(chatId) {
    if (chatListener) {
        database.ref(`${CHATS_PATH}/${chatListener.chatId}`).off('child_added', chatListener.callback);
    }

    const messagesRef = database.ref(`${CHATS_PATH}/${chatId}`).orderByChild('timestamp');
    
    const callback = (snapshot) => {
        // กรองข้อมูล metadata ของแชทออก
        const metadataKeys = ['ownerUID', 'status', 'createdAt', 'lastActivity', 'lastMessage', 'unreadByAdmin', 'unreadByUser', 'closedAt', 'userNickname'];
        if (metadataKeys.includes(snapshot.key)) {
            return;
        }

        const message = snapshot.val();
        
        if (!message || message.deleted) return; 

        const isUser = message.sender === 'user';
        const isNewMessage = chatBox.childElementCount > 0; 

        appendMessage(message, snapshot.key, chatId);
        
        // เล่นเสียงแจ้งเตือนเฉพาะเมื่อข้อความมาจาก admin และไม่ใช่ข้อความแรก
        if (!isUser && !message.isSystem && isNewMessage) { 
            playNotificationSound();
        }
    };

    messagesRef.on('child_added', callback);
    chatListener = { chatId, callback };
}


// 🔥 [IMPORTANT UPDATE] appendMessage Function (พร้อม Animation)
function appendMessage(message, messageId, chatId) {
    
    // 🚩 ตรวจสอบสถานะ deleted และ sender เป็น system
    const isUser = message.sender === 'user';
    const isSystem = message.sender === 'system'; 
    const isDeleted = message.deleted === true; 

    // ป้องกันการ Append ซ้ำ
    if (document.querySelector(`[data-message-id="${messageId}"]`)) {
        return;
    }
    
    let bubbleClass;
    let containerClass;
    let textContent = message.text;
    
    if (isDeleted) {
        // 1. ข้อความที่ถูกลบ
        bubbleClass = 'system-bubble';
        containerClass = 'deleted-system-message'; 
        textContent = `<i class="fas fa-ban"></i> ${textContent}`;

        const messageContainer = document.createElement('div');
        messageContainer.className = `message-container ${containerClass} new-message`;
        messageContainer.setAttribute('data-message-id', messageId);
        
        // 🚩 [ANIMATION] ใช้ innerHTML และเพิ่ม show class เพื่อเรียกใช้ CSS
        messageContainer.innerHTML = `<div class="message-bubble ${bubbleClass}">${textContent}</div>`; 
        
        chatBox.appendChild(messageContainer);
        
        setTimeout(() => { messageContainer.classList.add('show'); }, 10); 

        chatBox.scrollTop = chatBox.scrollHeight;
        return; 
        
    } else if (isSystem) {
        // 2. ข้อความระบบ
        bubbleClass = 'system-bubble';
        containerClass = 'system-container';
        
    } else if (isUser) {
        // 3. ข้อความ User
        bubbleClass = 'user-bubble';
        containerClass = 'user-container';
        
    } else {
        // 4. ข้อความ Admin
        bubbleClass = 'admin-bubble';
        containerClass = 'admin-container';
    }


    const messageContainer = document.createElement('div');
    // 🚩 [ADDITION] เพิ่มคลาส new-message สำหรับ Animation
    messageContainer.className = `message-container ${containerClass} new-message`; 
    messageContainer.setAttribute('data-message-id', messageId);

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${bubbleClass}`;
    bubble.textContent = textContent;
    
    
    // เพิ่ม Context Menu ให้เฉพาะข้อความของ User ที่ยังไม่ถูกลบ
    if (isUser && !isDeleted) {
        setupContextMenu(bubble, chatId, messageId);
    }
    
    // ข้อความ User/Admin จะมี Time Stamp
    if (!isSystem && !isDeleted) {
        const time = document.createElement('span');
        time.className = 'message-time';
        const date = new Date(message.timestamp);
        time.textContent = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        messageContainer.appendChild(bubble);
        messageContainer.appendChild(time);
        
    } else {
        // ข้อความ System จะมีแต่ Bubble 
        messageContainer.appendChild(bubble);
    }
    
    chatBox.appendChild(messageContainer);
    
    // 🔥 [สำคัญ] Animation: เพิ่มคลาส 'show' หลังจากที่ถูก Append เข้า DOM แล้ว
    setTimeout(() => {
        messageContainer.classList.add('show');
    }, 10); 
    
    chatBox.scrollTop = chatBox.scrollHeight;
}


// ===============================================
// 8. Message Sending & Deletion
// ===============================================

sendButton.onclick = sendMessage;
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg || !currentChatId) return;

    const timestamp = TIMESTAMP; 

    // 1. อัปเดต Metadata ของแชท
    database.ref(`${CHATS_PATH}/${currentChatId}`).update({
        lastActivity: timestamp,
        lastMessage: {
            text: msg,
            timestamp: timestamp 
        },
        unreadByAdmin: true,
        ownerUID: currentUserId,
        status: 'active'
    });
    
    // 2. เพิ่มข้อความ
    database.ref(`${CHATS_PATH}/${currentChatId}`).push({
        sender: 'user', 
        text: msg,
        timestamp: timestamp
    });

    chatInput.value = '';
}

function sendSystemMessage(chatId, msg) {
    database.ref(`${CHATS_PATH}/${chatId}`).push({
        sender: 'system', 
        text: msg,
        timestamp: TIMESTAMP
    });
}

function deleteMessage(chatId, messageId) {
    if (!confirm("คุณต้องการลบข้อความนี้จริงหรือไม่? ข้อความจะถูกซ่อนจากทุกคน")) return;

    // 1. อัปเดตสถานะ Deleted และ Text ใน DB
    const deletedText = "[ข้อความนี้ถูกยกเลิกการส่ง]";
    database.ref(`${CHATS_PATH}/${chatId}/${messageId}`).update({
        deleted: true,
        text: deletedText
    }).then(() => {
        console.log(`Message ${messageId.substring(0, 8)}... deleted.`);
        
        // 2. [UI Update] ลบ Element เดิมและเพิ่ม Element ที่ถูกลบใหม่เข้าไปแทน
        const oldContainer = document.querySelector(`[data-message-id="${messageId}"]`);
        if (oldContainer) {
            oldContainer.remove(); 
        }
        
        const deletedMessage = {
            text: deletedText,
            sender: 'system',
            deleted: true, 
            timestamp: Date.now()
        };
        // เรียก appendMessage ใหม่อีกครั้งเพื่อสร้าง Element ของข้อความที่ถูกลบ
        appendMessage(deletedMessage, messageId, chatId); 
        
        alert("ข้อความถูกยกเลิกการส่งแล้ว");

    }).catch(error => {
        console.error("Error deleting message:", error);
        alert("เกิดข้อผิดพลาดในการลบข้อความ");
    });
}

// 🚩 [NEW FUNCTION] คัดลอกข้อความ
function copyMessage(chatId, messageId) {
    const container = document.querySelector(`[data-message-id="${messageId}"]`);
    let textToCopy = '';
    
    // พยายามคัดลอกจาก DOM ก่อน
    if (container) {
        const bubble = container.querySelector('.message-bubble');
        if (bubble && bubble.textContent) {
            textToCopy = bubble.textContent;
        }
    }
    
    // ถ้าคัดลอกจาก DOM ได้ ให้ดำเนินการคัดลอกทันที
    if (textToCopy) {
        navigator.clipboard.writeText(textToCopy)
        .then(() => alert("คัดลอกข้อความเรียบร้อย!"))
        .catch(err => {
            console.error('Could not copy text:', err);
            alert("ไม่สามารถคัดลอกข้อความได้");
        });
        return;
    }
    
    // ถ้าคัดลอกจาก DOM ไม่ได้ (เช่น ถูกลบไปแล้ว) ให้พยายามดึงจาก DB
    database.ref(`${CHATS_PATH}/${chatId}/${messageId}/text`).once('value', snapshot => {
        const text = snapshot.val();
        if (text && text !== "[ข้อความนี้ถูกยกเลิกการส่ง]") {
             navigator.clipboard.writeText(text)
            .then(() => alert("คัดลอกข้อความเรียบร้อย!"))
            .catch(err => {
                console.error('Could not copy text:', err);
                alert("ไม่สามารถคัดลอกข้อความได้");
            });
        } else {
             alert("ไม่สามารถคัดลอกข้อความได้ (อาจถูกลบไปแล้ว)");
        }
    }).catch(err => alert("ไม่สามารถคัดลอกข้อความได้"));
}


// ===============================================
// 9. Utility & Initial Load
// ===============================================

function playNotificationSound() {
    if (notifySound) {
        notifySound.play().catch(e => console.warn("Audio play blocked by browser:", e));
    }
}


function initializeAuth() {
    console.log("Initializing Firebase Auth state check...");

    // 1. เรียก getRedirectResult เพื่อกระตุ้นให้ Firebase Auth โหลด Token จาก Local Storage (ถ้ามี)
    auth.getRedirectResult().catch(error => {
        if (error.code !== 'auth/no-current-user') {
             console.warn("getRedirectResult completed (ignored error, if any):", error.code);
        }
    });

    // window.showStartScreen() ถูกเรียกโดย onAuthStateChanged
}

initializeAuth();