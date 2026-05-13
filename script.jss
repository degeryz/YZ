const API_KEY = "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";
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

const chatFlow = document.getElementById('chat-flow');
const queryInput = document.getElementById('query-input');
const sendTrigger = document.getElementById('send-trigger');
const sidebar = document.getElementById('sidebar');
const sidebarBlur = document.getElementById('sidebar-blur');
const historyBox = document.getElementById('history-box');

// UI Kontrolleri
document.getElementById('menu-toggle').onclick = () => { sidebar.classList.add('active'); sidebarBlur.classList.add('active'); };
document.getElementById('close-menu').onclick = () => { sidebar.classList.remove('active'); sidebarBlur.classList.remove('active'); };
sidebarBlur.onclick = () => { sidebar.classList.remove('active'); sidebarBlur.classList.remove('active'); };

function setTheme(t) {
    document.body.className = 'theme-' + t;
    localStorage.setItem('yz_theme_v3', t);
}

function appendMessage(text, isBot = true, sources = []) {
    const intro = document.querySelector('.intro-box');
    if (intro) intro.remove();

    const d = document.createElement('div');
    d.className = `message ${isBot ? 'msg-bot' : 'msg-user'}`;
    let html = `<div>${text}</div>`;
    if (sources.length > 0) {
        html += `<div class="sources">KAYNAK DOSYALAR: ${sources.join(', ')}</div>`;
    }
    d.innerHTML = html;
    chatFlow.appendChild(d);
    chatFlow.scrollTop = chatFlow.scrollHeight;
}

// GROQ API Entegrasyonu (Llama 3.1)
async function callAnalyst(question, dataSet) {
    const systemInstruction = `
    Senin adın Değer YZ. Yapımcıların: Ozan Nigar ve Hasan Eymen Kartal.
    KESİN KURALLAR:
    1. Sadece sana verilen "METİNLER" üzerinden cevap ver. Kendi bilgilerini asla kullanma.
    2. Metinlerde cevap yoksa tam olarak şunu söyle: "Bu bilgiye kütüphanemdeki değerlendirmelerden ulaşamadım, kitap veya film hakkında başka bir şey sorabilirsin."
    3. Sadece kitap/film analizi yap. Metinlerde ne geçiyorsa onu aktar.
    METİNLER:
    ${dataSet.map(d => `[Yazar: ${d.author}]: ${d.content}`).join("\n\n")}
    `;

    try {
        const r = await fetch(API_URL, {
            method: "POST",
            headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [{ role: "system", content: systemInstruction }, { role: "user", content: question }],
                temperature: 0.0
            })
        });
        const d = await r.json();
        return d.choices[0].message.content;
    } catch (e) { return "HATA: Analiz motoru bağlantısı koptu."; }
}

async function processSearch(q) {
    const lowQ = q.toLocaleLowerCase('tr-TR');
    
    if (lowQ.includes("kimsin") || lowQ.includes("adın ne")) return appendMessage("Ben <b>Değer YZ</b>. Ozan Nigar ve Hasan Eymen Kartal'ın özel kütüphane analiz asistanıyım.");
    if (lowQ.includes("kim yaptı") || lowQ.includes("sahibin")) return appendMessage("Ben <b>Ozan Nigar</b> ve <b>Hasan Eymen Kartal</b> tarafından kodlandım.");

    try {
        const res = await fetch('index.json');
        const data = await res.json();
        
        const book = data.kütüphane.find(k => lowQ.includes(k.ad.toLocaleLowerCase('tr-TR')));
        if (!book) return appendMessage("Bu eser kütüphanemde kayıtlı değil veya henüz dosyası eklenmemiş.");

        let sortedList = [
            ...book.yazarlar.filter(a => a.toLocaleLowerCase('tr-TR').includes("(ö)")),
            ...book.yazarlar.filter(a => !a.toLocaleLowerCase('tr-TR').includes("(ö)"))
        ];

        let docs = [];
        let authNames = [];

        for (const auth of sortedList) {
            try {
                const folder = book.ad.toLocaleLowerCase('tr-TR');
                const file = auth.toLocaleLowerCase('tr-TR');
                const url = `değerlendirmeler/${folder}/${file}.txt`;
                
                const fRes = await fetch(encodeURI(url));
                if (fRes.ok) {
                    docs.push({ author: auth, content: await fRes.text() });
                    authNames.push(auth);
                }
            } catch (e) {}
        }

        if (authNames.length > 0) {
            appendMessage("<i>Analiz motoru dosyaları tarıyor...</i>");
            const result = await callAnalyst(q, docs);
            appendMessage(result, true, authNames);
            saveToHistory(q);
        } else {
            appendMessage("Üzgünüm okunacak bir değerlendirme bulamadım.");
        }
    } catch (e) { appendMessage("KRİTİK HATA: index.json dosyasına erişilemiyor."); }
}

function saveToHistory(q) {
    let hist = JSON.parse(localStorage.getItem('yz_history_v3')) || [];
    if (!hist.includes(q)) {
        hist.unshift(q);
        if (hist.length > 12) hist.pop();
        localStorage.setItem('yz_history_v3', JSON.stringify(hist));
        renderHistory();
    }
}

function renderHistory() {
    let hist = JSON.parse(localStorage.getItem('yz_history_v3')) || [];
    historyBox.innerHTML = hist.map(i => `<div class="hist-item" onclick="useHist('${i}')">${i.substring(0, 28)}...</div>`).join('');
}

function useHist(i) {
    queryInput.value = i;
    sidebar.classList.remove('active');
    sidebarBlur.classList.remove('active');
}

document.getElementById('clear-history').onclick = () => {
    localStorage.removeItem('yz_history_v3');
    renderHistory();
};

sendTrigger.onclick = () => {
    const val = queryInput.value.trim();
    if (val) { appendMessage(val, false); processSearch(val); queryInput.value = ''; }
};

queryInput.onkeypress = (e) => { if (e.key === 'Enter') sendTrigger.click(); };
window.onload = () => { setTheme(localStorage.getItem('yz_theme_v3') || 'standard'); renderHistory(); };
