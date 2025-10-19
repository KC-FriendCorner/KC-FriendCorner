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


// ===============================================
// 2. Elements & Variables
// ===============================================
const mainContainer = document.getElementById('mainContainer');
const logoArea = document.getElementById('logoArea'); 
const appTitle = document.getElementById('appTitle');

const startScreen = document.getElementById('startScreen');
const chatScreen = document.getElementById('chatScreen');

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const notifySound = document.getElementById("notifySound");
const userIdDisplay = document.getElementById('userIdDisplay'); 
const logoutBtn = document.getElementById('logoutBtn');
const chatTitle = document.getElementById('chatTitle'); 
const userInfoArea = document.getElementById('userInfoArea');

const authButton = document.getElementById('authButton');
const mainActions = document.getElementById('mainActions');
const startChatBtn = document.getElementById("startChat"); // ปุ่ม "เริ่มต้นสนทนาใหม่"

let currentUserId = null;
let currentChatId = null; 
let chatListener = null;


// ===============================================
// 3. Page Switching & UI Management
// ===============================================
function hideAllScreens() {
    startScreen.style.display = 'none';
    chatScreen.style.display = 'none';
}

window.showStartScreen = function() {
    hideAllScreens();
    startScreen.style.display = 'block';
    
    // แสดง Logo, Title และปรับ Container สำหรับหน้า Start
    logoArea.style.display = 'flex'; 
    appTitle.style.display = 'block';
    userInfoArea.style.display = 'flex';
    
    mainContainer.style.maxWidth = '900px'; 
    mainContainer.style.padding = '30px'; 
    mainContainer.style.height = 'auto';
    mainContainer.style.justifyContent = 'flex-start';
    
    if (chatListener) {
        db.ref(`messages/${chatListener.chatId}`).off('child_added', chatListener.callback);
        chatListener = null;
    }
    currentChatId = null; 
    
    if (currentUserId) {
        authButton.style.display = 'none';
        mainActions.style.display = 'flex'; 
        logoutBtn.style.display = 'inline-block';
        userIdDisplay.style.display = 'block';
        
        // ผูกปุ่มให้โหลดหรือสร้างแชทเมื่อกด
        startChatBtn.onclick = window.loadOrCreateChat; 
    } else {
        authButton.style.display = 'block';
        mainActions.style.display = 'none';
        logoutBtn.style.display = 'none';
        userIdDisplay.style.display = 'none';
    }
}

function showChatScreen() {
    hideAllScreens();
    chatScreen.style.display = 'flex'; 
    
    // ซ่อน Logo/Title และปรับ Container สำหรับหน้า Chat
    logoArea.style.display = 'none'; 
    appTitle.style.display = 'none';
    userInfoArea.style.display = 'flex'; 

    mainContainer.style.maxWidth = '600px'; 
    mainContainer.style.padding = '0';      
    mainContainer.style.height = '85vh';    
    mainContainer.style.justifyContent = 'flex-start'; 
    
    chatTitle.textContent = `ห้องสนทนา: ${currentChatId ? currentChatId.substring(0, 8) : 'ใหม่'}...`;
}


// ===============================================
// 4. Authentication Status & Logout
// ===============================================

auth.onAuthStateChanged(user => {
    if (user) {
        currentUserId = user.uid;
        userIdDisplay.textContent = `รหัสผู้ใช้: ${currentUserId.substring(0, 7)}...`;
        
        // เมื่อโหลด ID สำเร็จ (รวมถึงหลังรีเฟรช) จะพาไปหน้า Home Screen ทันที
        window.showStartScreen(); 
        
    } else {
        currentUserId = null;
        currentChatId = null;
        window.showStartScreen(); 
    }
});

window.handleAuth = function() {
    if (!currentUserId) {
        authButton.textContent = 'กำลังสร้าง ID...';
        
        // 💥 การแก้ไขสำคัญ: ตั้งค่า persistence เป็น LOCAL เพื่อบันทึก ID ข้ามการรีเฟรช (F5) 💥
        auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL) 
            .then(() => {
                return auth.signInAnonymously();
            })
            .then(userCredential => {
                console.log("Anonymous sign-in success with persistence: LOCAL");
                // เมื่อสร้าง ID สำเร็จ ให้กลับไปหน้า Start Screen
                window.showStartScreen(); 
            })
            .catch(error => {
                console.error("Anonymous sign-in failed:", error);
                alert("เกิดข้อผิดพลาดในการเริ่มต้นใช้งาน: " + error.message);
                authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
            });
    } else {
        window.showStartScreen(); 
    }
}

window.userLogout = function() {
    if (currentChatId) {
        db.ref(`user_chats/${currentChatId}`).update({
            status: 'ended',
            lastActivity: firebase.database.ServerValue.TIMESTAMP
        }).finally(() => {
            performSignOut();
        });
    } else {
        performSignOut();
    }
};

function performSignOut() {
    // ไม่ต้อง setPersistence เป็น NONE ที่นี่แล้ว ปล่อยให้ signOut ทำงานตามปกติ
    auth.signOut()
        .then(() => {
            console.log("User signed out.");
        })
        .catch((error) => {
            console.error("Error signing out:", error);
            alert("ออกจากระบบไม่สำเร็จ");
        });
}


// ===============================================
// 5. Chat Control (Load/Create)
// ===============================================

// ฟังก์ชันโหลดหรือสร้างแชท (เมื่อผู้ใช้กดปุ่ม 'เริ่มต้นสนทนาใหม่')
window.loadOrCreateChat = function() {
    if (!currentUserId) {
        alert("กรุณาเริ่มต้นใช้งานก่อน");
        return;
    }
    
    if (chatListener) {
        db.ref(`messages/${chatListener.chatId}`).off('child_added', chatListener.callback);
        chatListener = null;
    }
    
    // ค้นหาแชทล่าสุดของ User ID นี้
    db.ref('user_chats')
        .orderByChild('ownerUID')
        .equalTo(currentUserId)
        .limitToLast(1) 
        .once('value', snapshot => {
            let latestChatId = null;
            let latestChatStatus = null;

            snapshot.forEach(childSnapshot => {
                latestChatId = childSnapshot.key;
                latestChatStatus = childSnapshot.val().status;
            });
            
            // ตรวจสอบ: หากมีแชทที่ยัง 'active' อยู่ ให้โหลดแชทนั้น
            if (latestChatId && latestChatStatus === 'active') {
                console.log("Loading existing active chat:", latestChatId);
                startChatSession(latestChatId); 
            
            // หากไม่มีแชท หรือแชทล่าสุดถูก 'ended' ไปแล้ว ให้สร้างใหม่
            } else {
                console.log("No active chat found. Creating new chat.");
                createNewChatSession();
            }
        })
        .catch(error => {
            console.error("Error loading chat history:", error);
            createNewChatSession(); 
        });
}


function createNewChatSession() {
    const newChatRef = db.ref('user_chats').push();
    const newChatId = newChatRef.key;
    
    const chatData = {
        ownerUID: currentUserId,
        status: 'active',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastActivity: firebase.database.ServerValue.TIMESTAMP
    };
    
    newChatRef.set(chatData)
        .then(() => {
            currentChatId = newChatId;
            sendSystemMessage(newChatId, `--- เริ่มต้นการสนทนาใหม่ (Chat ID: ${newChatId.substring(0, 8)}...) ---`);
            startChatSession(newChatId); 
        })
        .catch(error => {
            console.error("Error creating new chat:", error);
        });
}


window.endChatSession = function() {
    if (!currentChatId) return;

    db.ref(`user_chats/${currentChatId}`).update({
        status: 'ended',
        lastActivity: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        if (chatListener) {
            db.ref(`messages/${chatListener.chatId}`).off('child_added', chatListener.callback);
            chatListener = null;
        }
        // เมื่อจบแชท ให้กลับไปหน้า StartScreen 
        showStartScreen(); 
    }).catch(error => {
         console.error("Error ending chat session:", error);
         alert("เกิดข้อผิดพลาดในการจบการสนทนา");
         showStartScreen(); 
    });
}


// ===============================================
// 6. Messaging Functions
// ===============================================
function startChatSession(chatId) {
    currentChatId = chatId;
    showChatScreen();
    chatBox.innerHTML = ''; 
    
    listenToChat(chatId);
    
    db.ref(`user_chats/${chatId}`).update({
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
     db.ref(`messages/${chatId}`).push({
        sender: "system",
        message: message,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
}

function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg || !currentChatId) return;
    
    db.ref(`user_chats/${currentChatId}`).update({ lastActivity: firebase.database.ServerValue.TIMESTAMP });

    db.ref(`messages/${currentChatId}`).push({
        sender: "user",
        message: msg,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    chatInput.value = "";
}

function listenToChat(chatId) {
    if (chatListener) {
        db.ref(`messages/${chatListener.chatId}`).off('child_added', chatListener.callback);
    }
    
    const callback = snap => {
        const data = snap.val();
        
        const messageDiv = document.createElement("div");
        messageDiv.className = data.sender === "system" ? "message system-message" : (data.sender === "user" ? "message user-message" : "message friend-message");
        
        const bubbleDiv = document.createElement("div");
        bubbleDiv.className = "bubble";
        bubbleDiv.textContent = data.message;
        
        messageDiv.appendChild(bubbleDiv);
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        
        if (data.sender === "admin" && data.timestamp > (Date.now() - 2000)) { 
             notifySound.play().catch(e => console.log("Sound play error:", e));
        }
    };
    
    db.ref(`messages/${chatId}`).on("child_added", callback);
    
    chatListener = { chatId: chatId, callback: callback };
}