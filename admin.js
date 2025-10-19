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

const adminPanel = document.getElementById('adminPanel'); 
const loginScreen = document.getElementById('loginScreen');
const adminFooter = document.getElementById('adminFooter'); // 👈 เพิ่ม Footer Element

const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const errorMessage = document.getElementById('errorMessage');
const loginBtn = document.getElementById('loginBtn');

const chatList = document.getElementById('chatList');
const chatPanel = document.getElementById('chatPanel');
const chatTitle = document.getElementById('chatTitle');
const chatBox = document.getElementById("chatBox");
const chatInput = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const notifySound = document.getElementById("notifySound");
const adminIdDisplay = document.getElementById('adminIdDisplay');

let currentAdminId = null;
let currentChatId = null; 
let chatListener = null; 
let chatStatusListener = null;
let chatListListener = null; 

const ADMIN_EMAIL = "kcfriendcorner@gmail.com"; 


// ===============================================
// 3. Login & Authentication
// ===============================================

auth.onAuthStateChanged(function(user) {
    if (user && user.email === ADMIN_EMAIL) { 
        currentAdminId = user.uid;
        adminIdDisplay.textContent = `Admin ID: ${user.uid.substring(0, 8)}...`;
        
        loginScreen.style.display = 'none';
        adminPanel.style.display = 'flex'; 
        adminFooter.style.display = 'block'; // 👈 แสดง Admin Footer
        
        listenToChatList(); 
        
    } else {
        currentAdminId = null;
        
        adminPanel.style.display = 'none';
        adminFooter.style.display = 'none'; // 👈 ซ่อน Admin Footer
        loginScreen.style.display = 'block'; 
        
        // ล้าง Listener ทั้งหมด
        if (chatListener) {
            if(currentChatId) db.ref(`messages/${currentChatId}`).off('child_added', chatListener);
            chatListener = null;
        }
        if (chatStatusListener) {
            if(currentChatId) db.ref(`user_chats/${currentChatId}`).off('value', chatStatusListener);
            chatStatusListener = null;
        }
        if (chatListListener) {
            const chatsRef = db.ref('user_chats');
            chatsRef.off('child_changed', chatListListener);
            chatsRef.off('child_added', chatListListener);
            chatListListener = null;
        }
        currentChatId = null; 
        chatList.innerHTML = '<p style="color:#777;">กรุณาเข้าสู่ระบบเพื่อดูห้องสนทนา</p>';
        chatPanel.style.display = 'none';
    }
});

window.adminLogin = function() {
    const email = emailInput.value;
    const password = passwordInput.value;
    errorMessage.style.display = 'none';
    loginBtn.disabled = true;
    loginBtn.textContent = 'กำลังเข้าสู่ระบบ...';

    if (!email || !password) {
        errorMessage.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน';
        errorMessage.style.display = 'block';
        loginBtn.disabled = false;
        loginBtn.textContent = 'เข้าสู่ระบบ';
        return;
    }

    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            if (userCredential.user.email !== ADMIN_EMAIL) {
                auth.signOut();
                errorMessage.textContent = 'ไม่ใช่บัญชีผู้ดูแลระบบ';
                errorMessage.style.display = 'block';
                loginBtn.disabled = false;
                loginBtn.textContent = 'เข้าสู่ระบบ';
            }
        })
        .catch((error) => {
            errorMessage.textContent = 'เข้าสู่ระบบล้มเหลว: ' + error.message;
            errorMessage.style.display = 'block';
            loginBtn.disabled = false;
            loginBtn.textContent = 'เข้าสู่ระบบ';
        });
}


// ===============================================
// 4. Chat List Listener 
// ===============================================

function listenToChatList() {
    const chatsRef = db.ref('user_chats');

    if (chatListListener) {
        chatsRef.off('child_changed', chatListListener);
        chatsRef.off('child_added', chatListListener);
    }

    const updateChatList = () => {
        chatsRef.orderByChild('status').equalTo('active').once('value', snapshot => {
            chatList.innerHTML = '';
            
            if (!snapshot.exists()) {
                chatList.innerHTML = '<p style="color:#777; text-align:center; padding: 20px;">ไม่มีห้องสนทนาที่เปิดอยู่</p>';
                
                // ถ้าห้องที่กำลังเปิดอยู่หายไปจากรายการ active
                if (currentChatId) {
                    // ตรวจสอบว่าแชทที่ถูกเลือกยังอยู่ใน snapshot ไหม (กรณีที่มันถูกจบไปแล้ว)
                    const chatStillExists = snapshot.hasChild(currentChatId);
                    
                    if (!chatStillExists) {
                        chatPanel.style.display = 'none';
                        // ล้าง Listener เก่าทั้งหมด
                        if (chatListener) {
                            db.ref(`messages/${currentChatId}`).off('child_added', chatListener);
                            chatListener = null;
                        }
                        if (chatStatusListener) {
                            db.ref(`user_chats/${currentChatId}`).off('value', chatStatusListener);
                            chatStatusListener = null;
                        }
                        currentChatId = null; 
                    }
                }
                
                return;
            }

            const chats = [];
            snapshot.forEach(snap => {
                chats.push({ id: snap.key, ...snap.val() });
            });
            
            chats.sort((a, b) => b.lastActivity - a.lastActivity);

            chats.forEach(chat => {
                const item = document.createElement('div');
                item.className = 'chat-item';
                if (chat.id === currentChatId) {
                    item.classList.add('active');
                }
                
                const timeText = new Date(chat.lastActivity).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                
                item.innerHTML = `
                    <strong>Chat ID: ${chat.id.substring(0, 8)}...</strong>
                    <p class="chat-time">ล่าสุด: ${timeText}</p>
                    <p class="chat-owner">User ID: ${chat.ownerUID.substring(0, 8)}...</p>
                `;
                item.onclick = () => loadChatSession(chat.id);
                chatList.appendChild(item);
            });
        });
    };
    
    chatListListener = updateChatList;
    chatsRef.on('child_changed', updateChatList);
    chatsRef.on('child_added', updateChatList);
    
    updateChatList();
}


// ===============================================
// 5. Chat Session Management
// ===============================================

function loadChatSession(chatId) {
    if (currentChatId === chatId) return;
    
    if (chatListener) {
        if(currentChatId) db.ref(`messages/${currentChatId}`).off('child_added', chatListener);
        chatListener = null;
    }
    if (chatStatusListener) {
        if(currentChatId) db.ref(`user_chats/${currentChatId}`).off('value', chatStatusListener);
        chatStatusListener = null;
    }

    currentChatId = chatId;
    chatTitle.textContent = `สนทนากับ ID: ${chatId.substring(0, 8)}...`;
    chatBox.innerHTML = '';
    chatPanel.style.display = 'flex'; 

    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeItem = document.querySelector(`.chat-item[onclick*='${chatId}']`);
    if (activeItem) {
        activeItem.classList.add('active');
    }

    db.ref(`messages/${chatId}`).once('value', snapshot => {
        snapshot.forEach(snap => {
            appendMessage(snap.val());
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });

    listenToCurrentChat(chatId);
    listenToChatStatus(chatId); 
    listenToChatList(); 
}

function listenToCurrentChat(chatId) {
    
    chatListener = db.ref(`messages/${chatId}`).on("child_added", snap => {
        const messageData = snap.val();
        
        if (messageData.timestamp > (Date.now() - 2000)) { 
            if (messageData.sender === "user") {
                notifySound.play().catch(e => console.log("Sound play error:", e));
                listenToChatList(); 
            }
        }
        
        appendMessage(messageData);
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

function listenToChatStatus(chatId) {
    
    chatStatusListener = db.ref(`user_chats/${chatId}`).on("value", snap => {
        const chatData = snap.val();
        
        if (chatData && chatData.status === 'ended') {
            
            // 1. ปิดช่องพิมพ์ของ Admin
            chatInput.disabled = true;
            sendButton.disabled = true;
            chatInput.placeholder = "การสนทนาได้สิ้นสุดลงแล้ว ไม่สามารถพิมพ์ต่อได้";

            // 2. แสดงข้อความแจ้งเตือนในแชทบ็อกซ์ (ถ้ายังไม่มี)
            const systemMessageCheck = document.querySelector('.message.system-message .bubble');
            if (!systemMessageCheck || !systemMessageCheck.textContent.includes('User ได้จบการสนทนาแล้ว')) {
                 const systemMessage = document.createElement("div");
                 systemMessage.className = "message system-message";
                 systemMessage.innerHTML = '<div class="bubble">❌ User ได้จบการสนทนาแล้ว ไม่สามารถพิมพ์ตอบได้</div>';
                 chatBox.appendChild(systemMessage);
                 chatBox.scrollTop = chatBox.scrollHeight;
            }
            
            // 3. ลบ Listener ข้อความออก เพื่อหยุดรับข้อความใหม่
            if (chatListener) {
                db.ref(`messages/${chatId}`).off('child_added', chatListener);
                chatListener = null;
            }
            
            // 4. อัปเดตรายการแชท (เพื่อลบแชทนี้ออกจากรายการ active)
            listenToChatList();
            
        } else {
            // แชทยัง Active อยู่
            chatInput.disabled = false;
            sendButton.disabled = false;
            chatInput.placeholder = "พิมพ์ข้อความ...";
        }
    });
}


// ===============================================
// 6. Messaging & UI Rendering
// ===============================================

sendButton.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e => { 
    if (e.key === "Enter" && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
    } 
});

function sendMessage() {
    const msg = chatInput.value.trim();
    if (!msg || !currentChatId || chatInput.disabled) return; 

    db.ref(`user_chats/${currentChatId}`).update({ lastActivity: firebase.database.ServerValue.TIMESTAMP });

    db.ref(`messages/${currentChatId}`).push({
        sender: "admin", 
        message: msg,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    });
    chatInput.value = "";
}

function appendMessage(data) {
    const messageDiv = document.createElement("div");
    messageDiv.className = data.sender === "admin" ? "message admin-message" : (data.sender === "system" ? "message system-message" : "message user-message");
    
    const bubbleDiv = document.createElement("div");
    bubbleDiv.className = "bubble";
    bubbleDiv.textContent = data.message;
    messageDiv.appendChild(bubbleDiv);
    
    chatBox.appendChild(messageDiv);
}