// ===== Elements (already in your HTML) =====
const textArea = document.getElementById("chatDB");
const chatForm = document.getElementById("chatForm");
const chatOutput = document.getElementById("chatOutput");
const imgEmptyChat = chatOutput.querySelector("img");
const emptyTextDiv = chatOutput.querySelector(".emptyText");
const chatlangsBtn = document.getElementById("chatlangs");
const chatlangDisplay = document.getElementById("chatlangDisplay");
const setoptions = document.querySelector(".setTranslateOpt");
const preferredLangDisplay = document.getElementById("setlangDisplay");
const prefferedLangbtn = document.getElementById("language");

// ===== Language selection (uses your existing .option items) =====
// Map display names in your menu to language codes for the API.
const LANG_MAP = {
    "English": "en",
    "Spanish": "es",
    "French": "fr",
    "Cantonese": "yue",  // Some providers may not support 'yue'; see notes below
    "Punjabi": "pa",      
    "Vietnamese": "vi"
};
function buildLanguageOptions(languageMap,exclude,heading,parentElement) {
    parentElement.querySelector(".options").innerHTML = "";
    count = 0;
    for(names in languageMap){
        count++;
        if (heading === "Preferred Language"){
            const divOption = document.createElement("div");
            divOption.className = "option";
            divOption.textContent = names;
            if(count==1){
                divOption.classList.add("active_language");
                prefferedLangName = names;
            }            
            parentElement.querySelector(".options").appendChild(divOption);
            
        } else {
            if(names!=exclude){
                const divOption = document.createElement("div");
                divOption.className = "option";
                divOption.textContent = names;
                
                
                parentElement.querySelector(".options").appendChild(divOption);
            }
            
        }
    }
}
// Default target language (matches your placeholder)
let targetLangName = "French";
let prefferedLangName = "English";
let targetLangCode = LANG_MAP[targetLangName];

document.addEventListener("DOMContentLoaded", function() {

    buildLanguageOptions(LANG_MAP,"","Preferred Language",preferredLangDisplay);
    addclickbehavoir2();
    buildLanguageOptions(LANG_MAP,prefferedLangName,"Translations",chatlangDisplay);
    addclickbehavoir1();
});

function addclickbehavoir1(){
    const chatLangOptions = document.querySelectorAll(
        "#chatlangDisplay > .options .option"
    );
    for (let option of chatLangOptions) {
        option.addEventListener("click", function () {
            const name = option.textContent.trim();
            if (LANG_MAP[name]) {
                targetLangName = name;
                targetLangCode = LANG_MAP[name];
                textArea.placeholder = `${prefferedLangName} to ${targetLangName} translation.`;
                toggleChatLangDisplay();
                textArea.focus();
            }
        });
    }
}

function addclickbehavoir2(){
    const preferredLangOptions = document.querySelectorAll(
        "#setlangDisplay > .options .option"
    );
    for (let option of preferredLangOptions) {
        option.addEventListener("click", function () {
            const name = option.textContent.trim();
            if (LANG_MAP[name]) {
                // Update active class
                preferredLangOptions.forEach(opt => opt.classList.remove("active_language"));
                option.classList.add("active_language");

                // Update preferred language
                prefferedLangName = name;
                textArea.placeholder = `${prefferedLangName} to ${targetLangName} translation.`;
                buildLanguageOptions(LANG_MAP, prefferedLangName, "Translations", chatlangDisplay);
                addclickbehavoir1();
                togglesetlangoptions();
            }
        });
    }
}
// Keep your toggle behavior for the language popup
function toggleChatLangDisplay() {
    chatlangDisplay.style.display =
        chatlangDisplay.style.display === "grid" ? "none" : "grid";
}
chatlangsBtn.addEventListener("click", function (e) {
    e.preventDefault(); // prevent form submit when clicking the 3-dots button
    toggleChatLangDisplay();
});

function togglesetlangoptions(){
    setoptions.style.display = 
    setoptions.style.display === "grid" ? "none" : "grid";
}

prefferedLangbtn.addEventListener("click", function(e){
    e.preventDefault();
    togglesetlangoptions();
});

// ===== Message rendering helpers =====
function removeEmptyState() {
    if (imgEmptyChat) imgEmptyChat.style.display = "none";
    if (emptyTextDiv) emptyTextDiv.style.display = "none";
}

function appendUserBubble(text) {
    const div = document.createElement("div");
    div.className = "userMessage";
    div.textContent = text;
    removeEmptyState();
    chatOutput.appendChild(div);
    chatOutput.scrollTop = chatOutput.scrollHeight;
}

function appendBotBubble(text, { loading = false, error = false, meta } = {}) {
    const wrapper = document.createElement("div");
    const bubble = document.createElement("div");
    bubble.className = "botMessage";
    if (loading) bubble.classList.add("loading");
    if (error) bubble.classList.add("error");
    bubble.textContent = text;

    wrapper.appendChild(bubble);

    if (meta) {
        const metaDiv = document.createElement("div");
        metaDiv.className = "msgMeta";
        metaDiv.textContent = meta;
        wrapper.appendChild(metaDiv);
    }

    removeEmptyState();
    chatOutput.appendChild(wrapper);
    chatOutput.scrollTop = chatOutput.scrollHeight;
    return bubble; // return so we can update it later
}

// ===== Translation backend (pluggable) =====
// Option A: LibreTranslate (default; no key; rate-limited; good for demos)
// You can self-host or swap the base URL if you hit CORS/limits.
// Common public endpoints: https://libretranslate.com / https://libretranslate.de
const API_BASE = "https://api.mymemory.translated.net";

async function translateWithMyMemory({ text, source = "en", target = "fr" }) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.responseData.translatedText;
}

// Wrapper so you can swap providers later (Google, DeepL, Azure, etc.)
async function translateText({ text, targetCode }) {
    // Special note: Some providers don’t support Cantonese ('yue').
    // If your chosen provider fails for 'yue', consider mapping to 'zh' or 'zh-Hant'
    // or switch to a provider that supports it. Here we just try and let errors bubble.
    return translateWithMyMemory({ text, source: LANG_MAP[prefferedLangName], target: targetCode });
}

// ===== Form handling =====
chatForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const userMessage = textArea.value.trim();
    if (!userMessage) return;

    // 1) Render the user's message
    appendUserBubble(userMessage);

    // 2) Show a "Translating…" bubble
    const translatingBubble = appendBotBubble("Translating…", {
        loading: true,
        meta: `${prefferedLangName} → ${targetLangName}`
    });

    // 3) Call the translator
    try {
        const translated = await translateText({
            text: userMessage,
            targetCode: targetLangCode
        });

        // 4) Update the bubble with the final translation
        translatingBubble.classList.remove("loading");
        translatingBubble.textContent = translated || "(No translation returned)";
    } catch (err) {
        // 5) Show a helpful error message in-place
        translatingBubble.classList.remove("loading");
        translatingBubble.classList.add("error");
        translatingBubble.textContent =
            "Sorry—couldn’t translate right now. Please try again or choose a different language.";
        console.error("Translation error:", err);
    }

    // 6) Reset input and keep scroll pinned to bottom
    textArea.value = "";
    chatOutput.scrollTop = chatOutput.scrollHeight;
});

// ===== Keyboard QoL: Enter to send; Shift+Enter for newline =====
textArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        chatForm.requestSubmit();
    }
});
