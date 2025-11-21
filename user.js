// user.js (ฉบับสมบูรณ์ แก้ไขปัญหาข้อความถูกยกเลิกการส่งหายไปหลังรีเฟรช และปรับขนาดตัวอักษร)

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
const database = db;

// ** ใช้งาน Server Value สำหรับ Timestamp **
const TIMESTAMP = firebase.database.ServerValue.TIMESTAMP;

// 🔑 กำหนด Admin UID สำหรับตรวจสอบ
const ADMIN_UID = "o139Nm6N3wSW25fCtAzwf2ymfSm2";
const ADMIN_UID_TO_HIDE = 'o139Nm6N3wSW25fCtAzwf2ymfSm2'; // ต้องกำหนดค่าเดียวกัน

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
const copyOption = document.getElementById('copyOption');

let currentUserId = null;
let currentChatId = null;
// 🔑 Listener Variables: เก็บ Callback Function โดยตรง
let chatListener = null; // Listener สำหรับข้อความ
let chatChangeListener = null; // Listener สำหรับการเปลี่ยนแปลงสถานะแชท

const CHATS_PATH = 'chats';
const MESSAGES_PATH = 'messages';

let activeMessageIdForContextMenu = null;
let activeChatIdForContextMenu = null;

// ===============================================
// 3. Utility Functions (Nickname Generator & Time Formatting)
// ===============================================

function generateRandomName() {
    const adjectives = ["เพื่อนสนิท", "ผู้แชร์เรื่องราว", "นักฟัง", "มุมมองใหม่", "เพื่อนร่วมทาง", "ผู้เดินทาง", "เงา", "สายลม"];
    const nouns = ["สีฟ้า", "สีเขียว", "สีม่วง", "สีส้ม", "สีดำ", "สีเทา", "สีขาว", "สีเหลือง"];
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${randomAdj} ${randomNoun} #${randomNum}`;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'กำลังส่ง...';
    if (typeof timestamp === 'object' && timestamp.hasOwnProperty('.sv')) return 'กำลังส่ง...';

    const date = new Date(timestamp);
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${hour}:${minute}`;
}


// ===============================================
// 4. Context Menu Logic 
// ===============================================

document.addEventListener('click', (e) => {
    if (e.target.closest('#contextMenu') === null) {
        contextMenu.style.display = 'none';
        activeMessageIdForContextMenu = null;
        activeChatIdForContextMenu = null;
    }
});

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
    bubbleEl.oncontextmenu = function (e) {
        e.preventDefault();

        deleteOption.style.display = isUserMessage ? 'block' : 'none';

        activeMessageIdForContextMenu = messageId;
        activeChatIdForContextMenu = chatId;

        const posX = e.clientX;
        const posY = e.clientY;

        contextMenu.style.top = `${posY}px`;
        contextMenu.style.left = `${posX}px`;
        contextMenu.style.display = 'block';

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
    bubbleEl.ontouchstart = function (e) {

        const touch = e.touches[0];
        const touchY = touch.clientY;

        touchTimeout = setTimeout(() => {
            deleteOption.style.display = isUserMessage ? 'block' : 'none';

            activeMessageIdForContextMenu = messageId;
            activeChatIdForContextMenu = chatId;

            contextMenu.style.top = `${touchY}px`;
            contextMenu.style.left = `${touch.clientX}px`;
            contextMenu.style.display = 'block';

            const rect = contextMenu.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                contextMenu.style.left = `${touch.clientX - rect.width}px`;
            }
            if (rect.bottom > window.innerHeight) {
                contextMenu.style.top = `${touchY - rect.height}px`;
            }

        }, 800);
    };

    bubbleEl.ontouchend = function () { clearTimeout(touchTimeout); };
    bubbleEl.ontouchmove = function () { clearTimeout(touchTimeout); };
}


// ===============================================
// 5. Page Switching & UI Management
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
        startChatBtn.textContent = 'กดเพื่อสนทนา';
        startChatBtn.onclick = window.loadOrCreateChat;
        logoutBtn.onclick = window.userLogout;

        userIdDisplay.style.display = 'block';
        userInfoArea.style.display = 'flex';
        userIdDisplay.textContent = `รหัสผู้ใช้: ${currentUserId.substring(0, 7)}...`;

    } else {

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

/**
 * @function cleanupChatSession
 * ล้าง Listener และ UI ก่อนสร้าง Session ใหม่
 */
function cleanupChatSession() {
    // 🚩 FIX: ต้อง off() ที่ messages sub-collection และตรวจสอบ currentChatId ก่อน
    if (chatListener && currentChatId) {
        database.ref(`${CHATS_PATH}/${currentChatId}/messages`).off('child_added', chatListener);
        chatListener = null;
    }
    if (chatChangeListener && currentChatId) {
        database.ref(`${CHATS_PATH}/${currentChatId}`).off('child_changed', chatChangeListener);
        chatChangeListener = null;
    }
    chatBox.innerHTML = '';
    currentChatId = null;
}


// ===============================================
// 6. Authentication Status & Logout
// ===============================================

function updateChatOwnerUID(chatId, ownerUID) {
    if (!chatId) return;
    return database.ref(`${CHATS_PATH}/${chatId}`).update({
        ownerUID: ownerUID
    }).catch(error => {
        console.error("Error updating ownerUID:", error);
    });
}

function setupDisconnectHandler(chatId) {
    if (!chatId) return;
    const chatRef = database.ref(`${CHATS_PATH}/${chatId}`);

    // 🚩 แก้ไข: ลบ onDisconnect() เพื่อป้องกันไม่ให้แชทปิดอัตโนมัติเมื่อผู้ใช้ปิดเว็บ/ขาดการเชื่อมต่อ
    // chatRef.child('ownerUID').onDisconnect().set(null); 

    console.log(`OnDisconnect handler set for chat: ${chatId}.`);
}

function clearDisconnectHandler(chatId) {
    if (!chatId) return;
    const chatRef = database.ref(`${CHATS_PATH}/${chatId}`);

    chatRef.child('ownerUID').onDisconnect().cancel();

    console.log(`OnDisconnect handler cleared for chat: ${chatId}.`);
}

/**
 * @function checkChatStatusAndHandleInvalidId 
 * ตรวจสอบสถานะของ Chat ID ที่กู้คืนมา (จาก Local Storage) หากถูกลบ/ปิดสถานะ จะบังคับลบ ID นั้นทิ้ง
 */
function checkChatStatusAndHandleInvalidId(user) {
    if (!user.isAnonymous || user.uid === ADMIN_UID) {
        return Promise.resolve(true);
    }

    return database.ref(`${CHATS_PATH}/${user.uid}`).once('value')
        .then(snapshot => {
            const chatData = snapshot.val();

            // 🔥 1. ตรวจสอบว่า Record ถูกลบโดยตรงหรือไม่ (Record หายไป)
            if (!chatData) {
                alert("ID ผู้ใช้นี้ถูกลบออกจากฐานข้อมูลแล้ว ระบบจะทำการสุ่ม ID ใหม่ให้คุณ");
                console.warn(`[FORCE ID DELETION] Chat ID ${user.uid.substring(0, 8)}... is missing/deleted. Forcing new ID.`);

                // ลบ Anonymous User ID ทิ้งถาวรและสั่งรีโหลดหน้า
                return deleteAnonymousUserAndSignOut(user.uid, true)
                    .then(() => false);
            }

            // 2. ตรวจสอบว่า Record ถูกปิดสถานะหรือไม่
            if (chatData.status === 'closed') {

                alert("ห้องสนทนาของคุณถูกปิดหรือถูกลบโดยแอดมินแล้ว ID ผู้ใช้นี้จึงไม่สามารถใช้งานต่อได้ ระบบจะทำการสุ่ม ID ใหม่ให้คุณ");

                console.warn(`[FORCE ID DELETION] Chat ID ${user.uid.substring(0, 8)}... is CLOSED. Deleting Anonymous ID and forcing reload.`);

                return deleteAnonymousUserAndSignOut(user.uid, true)
                    .then(() => false);
            }

            return true;
        })
        .catch(e => {
            console.error("Error checking chat status:", e);
            return true;
        });
}


auth.onAuthStateChanged(user => {
    if (user) {
        currentUserId = user.uid;
        currentChatId = currentUserId;

        setupDisconnectHandler(currentUserId);

        const updateStatusPromise = database.ref(`${CHATS_PATH}/${currentUserId}`).update({
            status: 'active',
            ownerUID: currentUserId,
            closedAt: null,
            isLoggedOut: null
        }).catch(e => {
            console.log("Chat update on login failed, possibly new user or no record yet.", e);
        });

        updateStatusPromise.finally(() => {
            checkChatStatusAndHandleInvalidId(user)
                .then(isIdValid => {
                    if (!isIdValid) {
                        return; // ID ไม่ valid จะถูกลบและรีโหลดหน้าไปแล้ว
                    }
                    window.showStartScreen();
                })
                .catch(e => {
                    console.error("Error during auth state recovery final step:", e);
                    window.showStartScreen();
                });
        });

    } else {
        if (currentUserId) {
            clearDisconnectHandler(currentUserId);
        }

        currentUserId = null;
        cleanupChatSession();
        window.showStartScreen();
    }
});


/**
 * @function handleAuth (สร้าง ID ใหม่และตรวจสอบไม่ให้ซ้ำกับ Admin ID)
 */
window.handleAuth = async function () {
    if (currentUserId) {
        window.loadOrCreateChat();
        return;
    }

    authButton.textContent = 'กำลังสร้าง ID...';

    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        console.log("Persistence set to LOCAL.");

        let attempts = 0;
        let isIdAdmin = true;
        let tempUser;

        // 🔑 Loop จนกว่าจะได้ ID ที่ไม่ใช่ Admin ID
        while (isIdAdmin && attempts < 5) {
            tempUser = await auth.signInAnonymously();

            if (tempUser.user.uid === ADMIN_UID) {
                console.warn("Attempted sign-in resulted in Admin UID. Signing out and retrying...");
                await auth.signOut();
                isIdAdmin = true;
                attempts++;
            } else {
                isIdAdmin = false;
            }
        }

        if (attempts >= 5) {
            throw new Error("Failed to generate non-admin UID after multiple attempts.");
        }

        console.log("Anonymous sign-in success. onAuthStateChanged will handle display.");

    } catch (error) {
        console.error("Anonymous sign-in failed:", error);
        alert("เกิดข้อผิดพลาดในการเริ่มต้นใช้งาน: " + error.message);
        authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
        window.showStartScreen();
    }
}


/**
 * userLogout: ตั้งค่าสถานะเป็น isLoggedOut: true ก่อน Sign Out 
 */
window.userLogout = async function () {
    const user = auth.currentUser;

    if (!user || !currentUserId) {
        await performSignOut(true);
        return;
    }

    const isAnonymous = user.isAnonymous;
    let confirmMessage = isAnonymous
        ? "แน่ใจหรือไม่ที่จะออกจากระบบ? User ID นี้จะถูกลบ **ถาวร** และจะไม่สามารถกู้คืนได้"
        : "คุณจะได้รับ ID ใหม่ในการเริ่มต้นใช้งาน(สุ่มID)ใหม่ครั้งหน้า";

    if (!confirm(confirmMessage)) {
        return;
    }

    const chatId = currentUserId;
    const chatRef = database.ref(`${CHATS_PATH}/${chatId}`);

    try {
        clearDisconnectHandler(chatId);

        await chatRef.update({
            isLoggedOut: true,
            ownerUID: null,
        });
        console.log(`[Logout] Chat ${chatId.substring(0, 8)}... marked as Logged Out.`);

    } catch (error) {
        console.error("Error updating chat status before logout. Proceeding with sign out:", error);
    }

    if (isAnonymous) {
        await deleteAnonymousUserAndSignOut(chatId, true); // ลบ Record ทั้งหมด
    } else {
        await performSignOut(false);
    }
};

/**
 * deleteAnonymousUserAndSignOut: ลบ Anonymous User จาก Firebase Auth และ Chat Record
 */
async function deleteAnonymousUserAndSignOut(chatId, isForced) {
    const user = auth.currentUser;

    if (!user) {
        await performSignOut(true);
        return;
    }

    // --- 1. ลบ Chat Record จาก Realtime DB ตามเงื่อนไข ---
    if (isForced) {
        try {
            // 🔥 ลบทั้ง record ออกเพื่อให้ ID นั้นถูกลืม
            await database.ref(`${CHATS_PATH}/${chatId}`).remove();
            console.log("Chat record successfully removed from Realtime DB (FORCED).");
        } catch (error) {
            console.error("Error deleting chat record:", error);
        }
    }
    // ถ้าไม่บังคับ (User กด Logout เอง และไม่ใช่ Anonymous user)
    else {
        // ลบเฉพาะ message sub-collection
        try {
            await database.ref(`${CHATS_PATH}/${chatId}/messages`).remove();
            console.log("Message sub-collection successfully removed.");
        } catch (error) {
            console.error("Error deleting message sub-collection:", error);
        }
    }


    // --- 2. ลบ Firebase Auth User และ Sign Out ---
    try {
        await user.delete();
        console.log("Anonymous User ID successfully deleted from Firebase Auth.");
    } catch (error) {
        console.error("Error deleting user (e.g., needs re-auth). Proceeding with sign out):", error);
    } finally {
        await performSignOut(true);
    }
}


/**
 * performSignOut (ล้าง Local Storage และ Hard Reload)
 */
async function performSignOut(removeLocalStorage = false) {
    try {
        await auth.signOut();
        console.log("User signed out.");

        if (removeLocalStorage) {
            localStorage.removeItem('friendCornerUserId');
            console.log("Local Storage (friendCornerUserId) cleared.");

            // 🔑 การรีโหลดหน้าจะทำให้โค้ด handleAuth ถูกเรียกและสุ่ม ID ใหม่
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

/**
 * @function loadOrCreateChat 
 * โหลดแชทเดิมหรือสร้างแชทใหม่
 */
window.loadOrCreateChat = function () {
    if (!currentUserId) {
        alert("กรุณาเริ่มต้นใช้งานก่อน");
        return;
    }

    const chatId = currentUserId;

    cleanupChatSession();

    database.ref(`${CHATS_PATH}/${chatId}`).once('value', snapshot => {
        const chatData = snapshot.val();

        // 1. แชท Active และเป็นเจ้าของ (สถานะปกติ)
        if (chatData && chatData.status === 'active' && chatData.ownerUID === currentUserId) {

            updateChatOwnerUID(chatId, currentUserId)
                .then(() => database.ref(`${CHATS_PATH}/${chatId}`).update({
                    status: 'active',
                    closedAt: null,
                    isLoggedOut: null
                }))
                .then(() => startChatSession(chatId));

            // 2. แชท Active แต่ไม่ใช่เจ้าของ (สถานะค้าง, ควรปิด)
        } else if (chatData && chatData.status === 'active' && chatData.ownerUID !== currentUserId) {

            database.ref(`${CHATS_PATH}/${chatId}`).update({
                status: 'closed',
                ownerUID: null,
                closedAt: TIMESTAMP
            }).then(() => {
                alert("พบแชทที่สถานะค้าง ได้ทำการปิดแชทนั้นเรียบร้อยแล้ว กรุณาเริ่มแชทใหม่");
                createNewChatSession(chatId);
            });
            return;

            // 3. แชทเคยมีอยู่ แต่ถูกตั้งค่าเป็น 'closed' แล้ว หรือ Record หายไป (ถูกลบโดยตรง)
        } else if (!chatData || chatData.status === 'closed' || chatData.ownerUID === null || chatData.isLoggedOut === true) {

            // 🚩 ถ้าพบว่า ID นี้ถูกปิดสถานะ (closed) หรือ Record หายไป ให้ถือว่า ID นี้ไม่สามารถใช้ได้แล้ว
            // เราจะบังคับให้ User Logout เพื่อให้ onAuthStateChanged เรียก checkChatStatus และลบ ID ถาวร
            alert("ห้องสนทนานี้ถูกปิดสถานะแล้ว และ ID ผู้ใช้นี้ไม่สามารถใช้งานได้ต่อ ระบบจะทำการสุ่ม ID ใหม่ให้คุณ");

            window.userLogout();

            return; // หยุดการทำงานของ loadOrCreateChat ทันที

            // 4. แชทไม่เคยมีอยู่ (new chat)
        } else {
            createNewChatSession(chatId);
        }
    })
        .catch(error => {
            console.error("Error loading chat history:", error);
            alert("เกิดข้อผิดพลาดในการตรวจสอบสถานะแชท");
        });
}


/**
 * @function createNewChatSession
 * สร้าง Record แชทใหม่ใน DB
 */
function createNewChatSession(chatId) {
    const randomNickname = generateRandomName();

    const welcomeMessageText = `สวัสดีครับ ${randomNickname}! คุณได้เริ่มต้นการสนทนาใหม่แล้ว รหัสผู้ใช้ของคุณคือ: ${chatId.substring(0, 8)}...`;
    const tempTimestamp = TIMESTAMP;

    const chatData = {
        ownerUID: currentUserId,
        status: 'active',
        createdAt: tempTimestamp,
        lastActivity: tempTimestamp,
        userNickname: randomNickname,
        unreadByAdmin: true,
        lastMessage: {
            text: welcomeMessageText,
            timestamp: tempTimestamp
        }
    };

    // 🔑 ใช้ set() เพื่อเขียนทับ Record เดิมที่อาจจะมีสถานะ 'closed' อยู่
    database.ref(`${CHATS_PATH}/${chatId}`).set(chatData)
        .then(() => {
            currentChatId = chatId;

            database.ref(`${CHATS_PATH}/${chatId}/messages`).push({
                sender: 'system',
                text: welcomeMessageText,
                timestamp: tempTimestamp
            });

            startChatSession(chatId);
        })
        .catch(error => {
            console.error("Error creating chat session:", error);
            alert("ไม่สามารถสร้างห้องสนทนาได้");
        });
}


function startChatSession(chatId) {
    currentChatId = chatId;

    showChatScreen();

    database.ref(`${CHATS_PATH}/${chatId}`).update({
        unreadByUser: false,
        status: 'active',
        ownerUID: currentUserId,
        closedAt: null,
        isLoggedOut: null
    });

    attachMessageListener(chatId);
    attachChatChangeListener(chatId);

    setTimeout(() => {
        chatInput.focus();
    }, 100);
}

function attachChatChangeListener(chatId) {
    if (chatChangeListener && currentChatId) {
        database.ref(`${CHATS_PATH}/${currentChatId}`).off('child_changed', chatChangeListener);
    }

    const callback = (snapshot) => {
        if (snapshot.key === 'status' && snapshot.val() === 'closed') {
            alert("ห้องสนทนานี้ถูกปิดโดยแอดมินหรือระบบแล้ว กรุณาออกจากระบบและเริ่มแชทใหม่");
            window.showStartScreen();
        }
    };

    database.ref(`${CHATS_PATH}/${chatId}`).on('child_changed', callback);
    chatChangeListener = callback;
}


/**
 * @function attachMessageListener (FIXED: เพื่อให้ User เห็นข้อความ Admin และข้อความถูกลบ)
 * ผูก Listener กับ messages sub-collection เพื่อรับข้อความทั้งหมด (user, admin, system, deleted)
 */
function attachMessageListener(chatId) {
    // 1. ยกเลิก Listener เดิม (ถ้ามี)
    if (chatListener && currentChatId) {
        // 🚩 FIX: ใช้ Path ที่ถูกต้องในการ off
        database.ref(`${CHATS_PATH}/${currentChatId}/messages`).off('child_added', chatListener);
    }

    const messagesRef = database.ref(`${CHATS_PATH}/${chatId}/messages`);

    // 2. สร้าง Callback ใหม่
    const callback = (snapshot) => {

        const message = snapshot.val();
        const messageId = snapshot.key;

        // ❌ [BUG REMOVED]: ลบโค้ดกรองข้อความที่ถูกลบ เพื่อให้ข้อความที่มี message.deleted: true ถูกส่งต่อไป
        
        // ตรวจสอบว่าข้อความใหม่เป็นข้อความที่เพิ่งเข้ามาหรือไม่ (เพื่อให้เสียงแจ้งเตือนทำงานได้)
        const isNewMessage = chatBox.childElementCount > 0;

        appendMessage(message, messageId, chatId);

        // 3. เมื่อเป็นข้อความของ Admin ให้เล่นเสียงแจ้งเตือน
        if (message.sender === 'admin' && isNewMessage) {
            playNotificationSound();
        }
    };

    // 4. ผูก Listener ใหม่
    messagesRef.on('child_added', callback);
    chatListener = callback;
}


function appendMessage(message, messageId, chatId) {

    // ตรวจสอบ chatBox (สมมติว่ามีการประกาศ chatBox ไว้แล้ว)
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return; 

    // 1. ตัวแปรเริ่มต้น
    const isUser = message.sender === 'user';
    const isAdmin = message.sender === 'admin';
    const isDeleted = message.deleted === true;
    let isSystem = message.sender === 'system';

    // 🔑 [CRITICAL FIX]: กรองข้อความที่ไม่มีเนื้อหา *และ* ไม่ได้ถูกลบ
    const textContent = message.text || message.message || message.content || '';
    if (textContent.trim() === '' && !isDeleted) {
        return; // กรองข้อความว่างเปล่าที่ไม่ใช่ข้อความถูกลบ
    }
    
    // 2. ป้องกันข้อความซ้ำ
    if (document.querySelector(`[data-message-id="${messageId}"]`)) {
        return;
    }

    let bubbleClass;
    let containerClass;
    let senderDisplayName = null;
    let formattedText; 

    // 3. Logic การแสดงชื่อผู้ส่ง (สำหรับ Admin ที่ปลอมเป็น User)
    if (isUser && message.uid === ADMIN_UID_TO_HIDE) {
        senderDisplayName = '<strong style="color: #007bff;">Admin Chat</strong>';
    } else if (isUser) {
        senderDisplayName = message.name || '';
    }

    // 4. Logic การจัดการประเภทข้อความ (รวมถึงการแทนที่ข้อความที่ถูกลบ)
    if (isDeleted) {
        // 🔑 [CRITICAL FIX]: แทนที่ข้อความเดิมด้วยข้อความยกเลิกการส่ง
        isSystem = true; // กำหนดให้เป็น System เพื่อให้ไม่มีเวลาแสดงผลและอยู่ตรงกลาง
        bubbleClass = 'deleted-bubble'; 
        containerClass = 'system-container';
        
        // ** 🚩 แก้ไข: เพิ่ม font-size: 0.8em; เพื่อให้ตัวอักษรเล็กลง **
        formattedText = '<span style="font-style: italic; color: #888; font-size: 0.8em;">[ข้อความถูกยกเลิกการส่ง]</span>'; 

    } else if (isSystem) {
        bubbleClass = 'system-bubble';
        containerClass = 'system-container';

    } else if (isUser) {
        bubbleClass = 'user-bubble';
        containerClass = 'user-container';
        // แปลง \n เป็น <br> สำหรับข้อความจริง
        formattedText = textContent.replace(/\n/g, '<br>');

    } else if (isAdmin) {
        bubbleClass = 'admin-bubble';
        containerClass = 'admin-container';
        // แปลง \n เป็น <br> สำหรับข้อความจริง
        formattedText = textContent.replace(/\n/g, '<br>');
    } else {
        return;
    }
    
    // 5. การสร้าง Element
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-container ${containerClass} new-message`;
    messageContainer.setAttribute('data-message-id', messageId);
    
    // 6. การแสดงชื่อผู้ส่ง (ถ้ามี)
    if (senderDisplayName && isUser && !isDeleted) {
        const nameEl = document.createElement('div');
        nameEl.className = 'sender-display-name';
        nameEl.innerHTML = senderDisplayName;
        messageContainer.appendChild(nameEl);
    }
    
    // 7. สร้าง Bubble และใส่เนื้อหา
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${bubbleClass}`;

    // ใช้ formattedText เป็นหลัก ซึ่งถูกกำหนดไว้แล้วสำหรับทุกกรณี
    if (formattedText) {
        bubble.innerHTML = formattedText;
    } else {
         // Fallback สำหรับข้อความดิบ
         bubble.textContent = textContent; 
    }

    // 8. Event Listener
    if (isUser && !isDeleted) {
        setupContextMenu(bubble, chatId, messageId);
    }

    // 9. การจัดเรียงเวลาและ Bubble
    if (!isSystem) { // เฉพาะข้อความ User หรือ Admin (ไม่รวม System/Deleted)
        const time = document.createElement('span');
        time.className = 'message-time';
        time.textContent = formatTimestamp(message.timestamp);

        // จัดเรียงตาม type ของผู้ส่ง
        if (isUser) { 
            messageContainer.appendChild(bubble);
            messageContainer.appendChild(time);
        } else if (isAdmin) {
            messageContainer.appendChild(time);
            messageContainer.appendChild(bubble);
        }
    } else {
        // ข้อความ System หรือ Deleted จะอยู่ตรงกลางและไม่มีเวลา
        messageContainer.appendChild(bubble); 
    }

    chatBox.appendChild(messageContainer);

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

    // อัปเดตข้อมูลแชทหลัก
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

    // เขียนข้อความลงใน messages sub-collection
    database.ref(`${CHATS_PATH}/${currentChatId}/messages`).push({
        sender: 'user',
        text: msg,
        timestamp: timestamp
    });

    chatInput.value = '';
}

function deleteMessage(chatId, messageId) {
    if (!confirm("คุณต้องการลบข้อความนี้จริงหรือไม่? ข้อความจะถูกซ่อนจากทุกคน")) return;

    // 🚩 FIX: ลบข้อความต้นฉบับทิ้ง (กำหนดเป็น null) เพื่อให้มั่นใจว่าข้อความถูกแทนที่ด้วย deleted: true ในหน้า User
    database.ref(`${CHATS_PATH}/${chatId}/messages/${messageId}`).update({
        deleted: true,
        text: null // ล้างข้อความเดิม
    }).then(() => {

        const oldContainer = document.querySelector(`[data-message-id="${messageId}"]`);
        if (oldContainer) {
            oldContainer.remove();
        }

        alert("ข้อความถูกยกเลิกการส่งแล้ว");

    }).catch(error => {
        console.error("Error deleting message:", error);
        alert("เกิดข้อผิดพลาดในการลบข้อความ");
    });
}

function copyMessage(chatId, messageId) {
    const container = document.querySelector(`[data-message-id="${messageId}"]`);
    let textToCopy = '';

    if (container) {
        const bubble = container.querySelector('.message-bubble');
        if (bubble && bubble.textContent) {
            textToCopy = bubble.textContent;
        }
    }

    if (textToCopy) {
        // ตรวจสอบไม่ให้คัดลอกข้อความถูกลบ
        if (textToCopy.trim() === "[ข้อความถูกยกเลิกการส่ง]") {
             alert("ไม่สามารถคัดลอกข้อความที่ถูกยกเลิกการส่งได้");
             return;
        }

        navigator.clipboard.writeText(textToCopy)
            .then(() => alert("คัดลอกข้อความเรียบร้อย!"))
            .catch(err => {
                console.error('Could not copy text:', err);
                alert("ไม่สามารถคัดลอกข้อความได้");
            });
        return;
    }

    database.ref(`${CHATS_PATH}/${chatId}/messages/${messageId}/text`).once('value', snapshot => {
        const text = snapshot.val();
        if (text && text !== "[ข้อความถูกยกเลิกการส่ง]") {
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
    auth.getRedirectResult().catch(error => {
        if (error.code !== 'auth/no-current-user') {
            console.warn("getRedirectResult completed (ignored error, if any):", error.code);
        }
    });
}

initializeAuth();