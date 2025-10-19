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
const appLogo = document.getElementById('appLogo');
const appTitle = document.getElementById('appTitle');

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
    
    appLogo.style.display = 'block';
    appTitle.style.display = 'block';
    mainContainer.style.maxWidth = '500px'; 
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
        mainActions.style.display = 'block';
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

    appLogo.style.display = 'block';
    appTitle.style.display = 'block';
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
    
    appLogo.style.display = 'none';
    appTitle.style.display = 'none';
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

function performSignOut() {
     auth.signOut().then(() => {
        console.log("User signed out.");
    }).catch((error) => {
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

function startNewChat() {
    if (!currentUserId) {
        alert("กรุณาเริ่มต้นใช้งานก่อน");
        return;
    }
    
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


// ===============================================
// 7. History Functions
// ===============================================

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
        
        chats.sort((a, b) => b.lastActivity - a.lastActivity);

        chats.forEach(chat => {
            const statusText = chat.status === 'active' ? '<span style="color: green;">(กำลังสนทนา)</span>' : '<span style="color: #6c757d;">(จบแล้ว)</span>';
            const timeText = new Date(chat.createdAt).toLocaleString('th-TH');

            const item = document.createElement('div');
            item.className = 'history-item';
            item.setAttribute('onclick', `showHistoryChat('${chat.id}')`);
            item.innerHTML = `
                <strong>รหัสแชท: ${chat.id.substring(0, 8)}...</strong> ${statusText}
                <p style="font-size: 12px; color: #777; margin: 5px 0 0;">เริ่มเมื่อ: ${timeText}</p>
            `;
            historyList.appendChild(item);
        });
    });
}

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

window.startNewChatFromHistory = function() {
    const oldChatId = historyChatBox.dataset.currentId;
    if (!oldChatId) return;

    const newChatRef = db.ref('user_chats').push();
    const newChatId = newChatRef.key;
    
    const chatData = {
        ownerUID: currentUserId,
        status: 'active',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastActivity: firebase.database.ServerValue.TIMESTAMP,
        originChatId: oldChatId 
    };
    
    newChatRef.set(chatData)
        .then(() => {
             db.ref(`messages/${newChatId}`).push({
                sender: "system",
                message: `เริ่มต้นแชทใหม่จากประวัติการสนทนาเก่า ID: ${oldChatId.substring(0, 8)}...`,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            
            startChatSession(newChatId); 
        })
        .catch(error => {
            console.error("Error creating new chat from history:", error);
        });
}