//============ CJ Session ==================
const phrases = {
    emergency : [  // emergency
                    { en: "I need help", es: "Necesito ayuda", fr: "J'ai besoin d'aide", yue: "ngo5 seoi1jiu3 bong1sau2" , pa: "Mainū madada cāhīdī hai", vi:"tôi cần giúp đỡ"},
                    { en: "Call the police", es: "Llame a la policía", fr: "Appelez la police", yue:"daa2bei2 ging2caat3", pa:"Pulasa nū bulā'ō", vi:"Gọi cảnh sát"},
                    { en: "Call an ambulance", es: "Llame una ambulancia", fr: "Appelez une ambulance", yue:"giu3 gau3wu6 ce1", pa:"Aimbūlainsa nū kāla karō", vi:"Gọi xe cấp cứu"}
                ],

    medical: [ // Medical category 
                { en: "I need a docter", es: "Necesito un doctor", fr: "j'ai besoin d'un médecin", yue: "ngo5 seoi1jiu3 jat1go3 ji1sang1" , pa: "Mainū ika ḍākaṭara dī lōṛa hai", vi:"Tôi cần một bác sĩ"},
                { en: "Where is the Hospital?", es: "donde esta el hospital", fr: "Où est l'hôpital", yue:"ji1jyun2 hai2 bin1", pa:"Hasapatāla kithē hai", vi:"Bệnh viện ở đâu"},
                { en: "I am sick", es: "Maiṁ bimāra hāṁ", fr: "je suis malade", yue: "ngo5 beng6 zo2", pa: "Maiṁ bimāra hāṁ", vi: "tôi bị ốm"}
             ],

    transportation: [ // Transportation category
                { en: "Where is the bus stop?", es: "¿Dónde está la parada de autobús?", fr: "Où est l'arrêt de bus ?", yue:"baa1si2 zaam6 hai2 bin1？", pa:"Basa aḍā kithē hai?", vi:"Trạm xe buýt ở đâu?" },
                { en: "I need a taxi", es: "Necesito un taxi", fr: "J'ai besoin d'un taxi", yue:"ngo5 jiu3 gaa3 dik1si2", pa:"Mainū ika ṭaikasī cāhīdī hai", vi:"tôi cần một chiếc taxi" }
            ],

    food: [ // Food and water category
                { en: "I am hungry", es: "Tengo hambre", fr: "J'ai faim", yue:"ngo5 hou2 tou5ngo6", pa: "Maiṁ bhukhā hāṁ ", vi: "tôi đói" },
                { en: "I am thirsty", es: "Tengo sed", fr: "J'ai soif", yue: "ngo5 hou2 hau2hot3", pa: "Mainū pi'āsa lagī hai", vi: "tôi khát" }
            ]
};

 // Category names translated to each language
const categoryNames = {
            emergency: { en: "Emergency", es: "Emergencia", fr: "Urgence", yue: "gan2gap1", pa: "Sakaṭakālīna", vi: "khẩn cấp" },
            medical: { en: "Medical", es: "Médico", fr: "Médical", yue: "ji1hok6", pa: "Maiḍīkala", vi: "Thuộc về y học"  },
            transportation: { en: "Transportation", es: "Transporte", fr: "Transport", yue: "gaau1tung1 gung1geoi6", pa: "Āvājā'ī", vi: "Vận tải"  },
            food: { en: "Food & Water", es: "Comida y Agua", fr: "Nourriture et Eau", yue: "sik6mat6 tung4 seoi2", pa: "Bhōjana atē pāṇī", vi: "Thức ăn và nước"  }
};

 // Emoji icon for each category
const icons = {
        emergency: '‼️',
        medical: '🏥',
        transportation: '🚁',
        food: '🍔'
};

// Browser codes for text-to-speech in each language
const languageCodes = {
     en: 'en-US', // English - United States
     es: 'es-ES', // Spanish - Spain
     fr: 'fr-FR', // French - France
     yue: 'yue-YUE', // Cantonese - cantonese
     pa: 'pa-PA', // Punjuabi - punjabi
     vi: 'vi-VI'  // Vietnamese - vietnamese
};


 let currentLanguage = 'en'; // Track which language is selected (starts with English)

document.addEventListener("DOMContentLoaded", function () { // This code alows me to make sure the page is fully loaded before calling these functions
    showPhrases();  // Display the phrases above
    setupLanguageSelector();  // setsup the language dorpdown

});


function setupLanguageSelector(){
    const languageSelect = document.getElementById('languageSelect') // This goese to the PhraseBook html page and gets the dropped down items
    languageSelect.addEventListener('change', function() {//Llistens for changes to languageSelect
        currentLanguage = this.value; // keeps track of the language we are using switched on
        showPhrases();
    });
}

function showPhrases(){
    const container = document.getElementById('phrasebookContainer') // This get the container 
    container.innerHTML = ' '; // this is to clear anything in the 

   
            for (let category in phrases) {  // Loop through each category (emergency, medical, etc.)
                const section = document.createElement('div'); // Create section element
                section.className = 'category-section'; // Add CSS class for styling

                const header = document.createElement('div'); // Create header element
                header.className = 'category-header'; // Add CSS class
                header.innerHTML = `<h3>${icons[category]} ${categoryNames[category][currentLanguage]}</h3>`; // Add icon and translated category name
                section.appendChild(header); // Add header to section

                const grid = document.createElement('div'); // Create grid for phrase cards
                grid.className = 'phrases-grid'; // Add CSS class for grid layout

                // Loop through each phrase in this category
                phrases[category].forEach(function(phrase) {
                    const card = document.createElement('div'); // Create card element
                    card.className = 'phrase-card'; // Add CSS class for styling

                    const translation = phrase[currentLanguage]; // Get phrase in selected language
                    
                    // Add content to card: English text, translation, and speaker button
                    card.innerHTML = `
                        <div>
                            <div class="phrase-english">${phrase.en}</div>
                            <div class="phrase-translation">${translation}</div>
                        </div>
                        <button class="speak-btn" onclick="speak('${translation.replace(/'/g, "\\'")}')">🔊</button>
                    `;

                    grid.appendChild(card); // Add card to grid
                });

                section.appendChild(grid); // Add grid to section
                container.appendChild(section); // Add section to main container
            }
}


        function speak(text) {// Speak the given text using browser's text-to-speech
            speechSynthesis.cancel(); // Stop any speech currently playing

            // Remove animation from all speaker buttons
            document.querySelectorAll('.speak-btn').forEach(function(btn) {
                btn.classList.remove('playing'); // Remove 'playing' class
            });

            const speech = new SpeechSynthesisUtterance(text); // Create speech object with text
            speech.lang = languageCodes[currentLanguage]; // Set language for speech
            speech.rate = 0.8; // Set speed (0.8 = slightly slower than normal)

            // Find which button was clicked
            const buttons = document.querySelectorAll('.speak-btn'); // Get all speaker buttons
            let clickedButton = null; // Variable to store clicked button
            buttons.forEach(function(btn) {
                if (btn.textContent === '🔊') { // Check if button has speaker emoji
                    clickedButton = btn; // Store reference to button
                }
            });


            if (clickedButton) {// Add animation to button if found
                clickedButton.classList.add('playing'); // Add 'playing' class for animation
            }

            
            speech.onend = function() {// Remove animation when speech finishes
                if (clickedButton) {
                    clickedButton.classList.remove('playing'); // Remove 'playing' class
                }
            };

            speechSynthesis.speak(speech); // Start speaking the text
        }


