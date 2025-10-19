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
const logoArea = document.getElementById('logoArea'); // 👈 ตัวแปรสำหรับ Logo Area ทั้งหมด

const startScreen = document.getElementById('startScreen');
const chatScreen = document.getElementById('chatScreen');
const historyScreen = document.getElementById('historyScreen');
const historyListContainer = document.getElementById('historyListContainer');
const historyList = document.getElementById('historyList');       
const historyChatBox = document.getElementById('historyChatBox'); 
const historyChatContent = document.getElementById('historyChatContent'); 
const historyChatTitle = document.getElementById('historyChatTitle');   

const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const notifySound = document.getElementById("notifySound");
const userIdDisplay = document.getElementById('userIdDisplay'); 
const logoutBtn = document.getElementById('logoutBtn');
const chatTitle = document.getElementById('chatTitle'); 

const authButton = document.getElementById('authButton');
const mainActions = document.getElementById('mainActions');
const startChatBtn = document.getElementById("startChat");

let currentUserId = null;
let currentChatId = null; 
let chatListener = null;


// ===============================================
// 3. Page Switching & UI Management
// ===============================================
function hideAllScreens() {
    startScreen.style.display = 'none';
    chatScreen.style.display = 'none';
    historyScreen.style.display = 'none';
}

window.showStartScreen = function() {
    hideAllScreens();
    startScreen.style.display = 'block';
    
    // แสดง Logo, Title และปรับ Container สำหรับหน้า Start
    logoArea.style.display = 'flex'; 
    appTitle.style.display = 'block';
    
    // 💥 แก้ไข: ให้ userInfoArea จัดการตัวเองตาม CSS ที่เรากำหนด 💥
    userInfoArea.style.display = 'flex'; 
    
    mainContainer.style.maxWidth = '900px'; // ใช้ค่าที่อัพเดตล่าสุด
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
        
        // 💥 NEW: ตรวจสอบการแสดงผลปุ่ม 💥
        mainActions.style.display = 'flex'; // แสดงเป็น flex เพื่อใช้ CSS ใหม่
        logoutBtn.style.display = 'inline-block';
        userIdDisplay.style.display = 'block';
    } else {
        authButton.style.display = 'block';
        mainActions.style.display = 'none';
        logoutBtn.style.display = 'none';
        userIdDisplay.style.display = 'none';
    }
}

window.showHistoryScreen = function() {
    hideAllScreens();
    historyScreen.style.display = 'flex';
    historyScreen.style.flexDirection = 'column';

    logoArea.style.display = 'flex'; // 👈 แสดง Logo Area
    mainContainer.style.maxWidth = '500px'; 
    mainContainer.style.padding = '30px';
    mainContainer.style.height = 'auto';
    mainContainer.style.justifyContent = 'flex-start';
    
    historyListContainer.style.display = 'block';
    historyChatBox.style.display = 'none';
    
    if (currentUserId) {
        loadChatHistoryList();
    }
}

function showChatScreen() {
    hideAllScreens();
    chatScreen.style.display = 'flex'; 
    
    logoArea.style.display = 'none'; // 👈 ซ่อน Logo Area
    mainContainer.style.maxWidth = '600px'; 
    mainContainer.style.padding = '0';      
    mainContainer.style.height = '85vh';    
    mainContainer.style.justifyContent = 'flex-start'; 
    
    chatTitle.textContent = `ห้องสนทนา: ${currentChatId ? currentChatId.substring(0, 8) : 'ใหม่'}...`;
}


// ===============================================
// 4. Authentication Status & Logout
// ===============================================

auth.onAuthStateChanged(function(user) {
    if (user) {
        currentUserId = user.uid;
        userIdDisplay.textContent = `รหัสผู้ใช้: ${user.uid.substring(0, 8)}...`; 
        authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
        showStartScreen(); 
        
    } else {
        currentUserId = null;
        currentChatId = null;
        userIdDisplay.textContent = '';
        authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)'; 
        showStartScreen(); 
    }
});

window.handleAuth = function() {
    if (!currentUserId) {
        authButton.textContent = 'กำลังสร้าง ID...';
        auth.signInAnonymously().then(userCredential => {
            return auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); 
        }).catch(error => {
            console.error("Anonymous sign-in failed:", error);
            alert("เกิดข้อผิดพลาดในการเริ่มต้นใช้งาน: " + error.message);
            authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
        });
    } else {
        showStartScreen(); 
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

// user.js

function performSignOut() {
    auth.signOut()
        .then(() => {
            // 💥 โค้ดที่แก้ไข: ตั้งค่า Persistence เป็น NONE หลัง SignOut 💥
            // การทำเช่นนี้เป็นการล้างสถานะการคงอยู่ของ Auth ในเบราว์เซอร์อย่างสมบูรณ์
            return auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
        })
        .then(() => {
            console.log("User signed out and persistence cleared.");
        })
        .catch((error) => {
            console.error("Error signing out:", error);
            alert("ออกจากระบบไม่สำเร็จ");
        });
}


// ===============================================
// 5. Event Listeners & Chat Control
// ===============================================

startChatBtn.addEventListener("click", startNewChat);

sendButton.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e => { 
    if (e.key === "Enter" && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
    } 
});

// user.js

// user.js

function startNewChat() {
    if (!currentUserId) {
        alert("กรุณาเริ่มต้นใช้งานก่อน");
        return;
    }
    
    // 💥 โค้ดที่แก้ไข: สร้าง Chat ID ใหม่เสมอ 💥
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
            
            // เพิ่มข้อความระบบแจ้งการเริ่มต้น
            db.ref(`messages/${newChatId}`).push({
                sender: "system",
                message: `--- เริ่มต้นการสนทนาใหม่ (Chat ID: ${newChatId.substring(0, 8)}...) ---`,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

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

// user.js

function reopenExistingChat(chatId) {
    
    // 1. ตั้งค่าสถานะของแชทเดิมให้เป็น 'active' และอัปเดต Activity
    db.ref(`user_chats/${chatId}`).update({
        status: 'active',
        lastActivity: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        
        // 2. ล้างข้อความเก่าทั้งหมดในห้องแชทเดิม (เพื่อเริ่มต้นใหม่)
        return db.ref(`messages/${chatId}`).set(null); 
        
    }).then(() => {
        
        // 3. เพิ่มข้อความระบบแจ้งเตือนการเริ่มต้น
        return db.ref(`messages/${chatId}`).push({
            sender: "system",
            message: `--- เริ่มต้นการสนทนาใหม่ (Chat ID เดิม: ${chatId.substring(0, 8)}...) ---`,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
    }).then(() => {
        // 4. เริ่มเซสชันแชทด้วย ID เดิม
        startChatSession(chatId);
    }).catch(error => {
        console.error("Error reopening chat:", error);
    });
}

// ===============================================
// 7. History Functions
// ===============================================

// user.js

// user.js

window.loadChatHistoryList = function() {
    historyList.innerHTML = 'กำลังโหลดประวัติ...';
    historyChatBox.style.display = 'none'; 
    historyListContainer.style.display = 'block';

    if (!currentUserId) { 
        historyList.innerHTML = 'กรุณาเริ่มต้นใช้งานก่อน';
        return; 
    }
    
    db.ref('user_chats')
        .orderByChild('ownerUID')
        .equalTo(currentUserId)
        .once('value', snapshot => {
        
        historyList.innerHTML = '';
        if (!snapshot.exists()) {
            historyList.innerHTML = 'ไม่มีประวัติการสนทนา';
            return;
        }

        const chats = [];
        snapshot.forEach(snap => {
            chats.push({ id: snap.key, ...snap.val() });
        });
        
        // 💥 โค้ดที่แก้ไข: จัดเรียงตามสถานะ (Active ก่อน Ended) แล้วตามด้วยเวลาล่าสุด 💥
        chats.sort((a, b) => {
            const statusA = a.status === 'active' ? 1 : 0;
            const statusB = b.status === 'active' ? 1 : 0;
            
            // 1. ถ้าสถานะต่างกัน ให้เรียงตามสถานะ (Active (1) มาก่อน Ended (0))
            if (statusA !== statusB) {
                return statusB - statusA;
            }
            
            // 2. ถ้าสถานะเหมือนกัน ให้เรียงตาม lastActivity (ล่าสุดก่อน)
            return b.lastActivity - a.lastActivity;
        });

        chats.forEach(chat => {
            const statusText = chat.status === 'active' ? '<span style="color: green; font-weight: 700;">(กำลังสนทนา)</span>' : '<span style="color: var(--secondary-color);">(จบแล้ว)</span>';
            const createdTime = new Date(chat.createdAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
            const lastActiveTime = new Date(chat.lastActivity).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
            
            // ปรับสีขอบซ้ายตามสถานะเพื่อเน้น
            const itemBorderColor = chat.status === 'active' ? 'var(--accent-color)' : 'var(--primary-color)';

            const item = document.createElement('div');
            item.className = 'history-item';
            item.style.borderLeft = `5px solid ${itemBorderColor}`;
            item.setAttribute('onclick', `showHistoryChat('${chat.id}')`);
            item.innerHTML = `
                <strong>รหัสแชท: ${chat.id.substring(0, 8)}...</strong> ${statusText}
                <div style="font-size: 12px; color: #777; margin-top: 5px;">
                    <p style="margin: 0;">เริ่มเมื่อ: ${createdTime}</p>
                    <p style="margin: 3px 0 0; font-weight: bold; color: var(--text-color);">ล่าสุด: ${lastActiveTime}</p>
                </div>
            `;
            historyList.appendChild(item);
        });
    });
};

window.showHistoryChat = function(chatId) {
    historyListContainer.style.display = 'none'; 
    historyChatBox.style.display = 'flex';       
    historyChatContent.innerHTML = 'กำลังโหลด...';
    historyChatTitle.textContent = `ประวัติแชท: ${chatId.substring(0, 8)}...`;
    
    db.ref(`messages/${chatId}`).once('value', snapshot => {
        historyChatContent.innerHTML = '';
        snapshot.forEach(snap => {
            const data = snap.val();
            
            const messageDiv = document.createElement("div");
            messageDiv.className = data.sender === "user" ? "message user-message" : "message friend-message";
            const bubbleDiv = document.createElement("div");
            bubbleDiv.className = "bubble";
            bubbleDiv.textContent = data.message;
            messageDiv.appendChild(bubbleDiv);
            
            historyChatContent.appendChild(messageDiv);
        });
        historyChatContent.scrollTop = historyChatContent.scrollHeight;
    });
    
    historyChatBox.dataset.currentId = chatId;
}

// user.js

// user.js

window.startNewChatFromHistory = function() {
    const oldChatId = historyChatBox.dataset.currentId;
    if (!oldChatId) return;
    
    // 💥 Chat ID ที่ใช้ในการสนทนาต่อ คือ Chat ID ที่ถูกเลือกจากประวัติ (oldChatId) 💥
    const targetChatId = oldChatId; 

    // 1. ดึงข้อความเก่าจาก Chat ID ที่เลือกมา
    db.ref(`messages/${targetChatId}`).once('value')
        .then(messagesSnapshot => {
            const messages = messagesSnapshot.val();
            const newMessagesRef = db.ref(`messages/${targetChatId}`);
            
            // 2. ตั้งค่าสถานะของ Chat ID เดิมให้เป็น 'active'
            db.ref(`user_chats/${targetChatId}`).update({
                status: 'active',
                lastActivity: firebase.database.ServerValue.TIMESTAMP
            });
            
            // 3. (Optional) ลบข้อความเก่าใน Chat ID นั้นทิ้งก่อน (ถ้าต้องการให้ Chat ID เดิมถูก "รีเซ็ต" ก่อนคัดลอก)
            // ถ้าไม่ต้องการรีเซ็ต ให้ข้ามขั้นตอนนี้ไป แต่ถ้าต้องการให้เป็น Chat ID เดิมแต่เริ่มจากข้อความประวัติที่เลือก
            // ให้ใช้โค้ดที่ผมให้ไปก่อนหน้านี้ได้เลย (ซึ่งเป็นการคัดลอกเข้า Chat ID ใหม่)

            // **** เราจะใช้ตรรกะเดิมคือ สร้าง Chat ID ใหม่แล้วคัดลอกข้อความเก่ามาใส่
            // **** แต่ถ้าคุณต้องการ "ใช้รหัสเดิม" (targetChatId) ให้ทำตามโค้ดด้านล่างนี้:
            
            // 💥 ขั้นตอน A: ล้างข้อความเก่าทั้งหมดของ Chat ID ที่กำลังจะใช้ต่อ (targetChatId) 💥
            return newMessagesRef.set(null) 
                .then(() => messages); // ส่งต่อข้อความที่ดึงมา
        })
        .then(messages => {
            const targetMessagesRef = db.ref(`messages/${targetChatId}`);
            
            // 💥 ขั้นตอน B: คัดลอกข้อความที่ดึงมา ใส่กลับเข้าไปใน Chat ID เดิม 💥
            if (messages) {
                // คัดลอกข้อความเก่าทั้งหมดไปยัง Chat ID เดิม
                return targetMessagesRef.set(messages) 
                    .then(() => {
                        // เพิ่มข้อความระบบแจ้งการคัดลอก
                        return targetMessagesRef.push({
                            sender: "system",
                            message: `--- ดึงประวัติการสนทนาเก่า ID: ${oldChatId.substring(0, 8)}... มาแสดง และสนทนาต่อในรหัสแชทนี้ ---`,
                            timestamp: firebase.database.ServerValue.TIMESTAMP
                        });
                    });
            } else {
                 // เพิ่มข้อความระบบแจ้งว่าไม่มีข้อความเก่า
                 return targetMessagesRef.push({
                    sender: "system",
                    message: `เริ่มต้นแชทต่อจากประวัติ ID: ${oldChatId.substring(0, 8)}... (ไม่มีข้อความเก่า)`,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
            }
        })
        .then(() => {
            // 4. เริ่มต้นเซสชันแชทด้วย Chat ID เดิมที่เลือกมา
            startChatSession(targetChatId); 
        })
        .catch(error => {
            console.error("Error continuing chat from history:", error);
            alert("ไม่สามารถเริ่มต้นสนทนาต่อจากประวัติได้");
        });
}        
// user.js

window.handleAuth = function() {
    if (!currentUserId) {
        authButton.textContent = 'กำลังสร้าง ID...';
        
        // 💥 โค้ดที่แก้ไข: ตั้งค่า Persistence เป็น 'none' ก่อน Sign-in 💥
        auth.setPersistence(firebase.auth.Auth.Persistence.NONE)
            .then(() => {
                return auth.signInAnonymously();
            })
            .then(userCredential => {
                // หากทำสำเร็จ Firebase จะไม่พยายามจำ ID นี้ในเซสชันถัดไป
                console.log("Anonymous sign-in success with persistence: NONE");
            })
            .catch(error => {
                console.error("Anonymous sign-in failed:", error);
                alert("เกิดข้อผิดพลาดในการเริ่มต้นใช้งาน: " + error.message);
                authButton.textContent = 'เริ่มต้นใช้งาน (สุ่ม ID)';
            });
    } else {
        showStartScreen(); 
    }
}