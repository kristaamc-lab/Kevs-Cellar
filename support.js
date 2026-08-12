let winesData = [];
let historyData = [];
let mediaStream = null;
let currentLoggingWine = null;
let currentViewTab = 'active';
const CURRENT_YEAR = new Date().getFullYear();

document.addEventListener('DOMContentLoaded', async () => {
  await loadWinesData();
  setupEventListeners();
  renderCellar();
});

async function loadWinesData() {
  const localWines = localStorage.getItem('kevs_cellar_inventory');
  const localHistory = localStorage.getItem('kevs_cellar_history');

  if (localWines) {
    winesData = JSON.parse(localWines);
  } else {
    try {
      const res = await fetch('wines.json');
      winesData = await res.json();
      saveToStorage();
    } catch (e) {
      console.error('Error loading default dataset:', e);
      winesData = [];
    }
  }

  if (localHistory) {
    historyData = JSON.parse(localHistory);
  } else {
    historyData = [];
  }
}

function saveToStorage() {
  localStorage.setItem('kevs_cellar_inventory', JSON.stringify(winesData));
  localStorage.setItem('kevs_cellar_history', JSON.stringify(historyData));
}

function getReadinessStatus(drinkingWindow) {
  if (!drinkingWindow) return { label: 'Unknown', color: 'bg-slate-700 text-slate-300', code: 'UNKNOWN' };
  if (CURRENT_YEAR < drinkingWindow.start) {
    return { label: 'Hold / Aging', color: 'bg-amber-950/80 text-amber-400 border-amber-800/50', code: 'HOLD' };
  } else if (CURRENT_YEAR <= drinkingWindow.end) {
    return { label: 'Ready to Drink', color: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/50', code: 'PEAK' };
  } else {
    return { label: 'Past Peak', color: 'bg-rose-950/80 text-rose-400 border-rose-800/50', code: 'PAST' };
  }
}

function updateAnalytics() {
  const totalBottles = winesData.reduce((acc, w) => acc + (w.quantity || 0), 0);
  const totalValue = winesData.reduce((acc, w) => acc + ((w.purchasePrice || 0) * (w.quantity || 0)), 0);
  const readyCount = winesData.filter(w => getReadinessStatus(w.drinkingWindow).code === 'PEAK' && w.quantity > 0).length;

  document.getElementById('statTotalBottles').textContent = totalBottles;
  document.getElementById('statTotalValue').textContent = `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('statReadyToDrink').textContent = readyCount;
  document.getElementById('statConsumedCount').textContent = historyData.length;

  document.getElementById('activeTabCount').textContent = winesData.filter(w => w.quantity > 0).length;
  document.getElementById('historyTabCount').textContent = historyData.length;
}

function renderCellar() {
  updateAnalytics();

  const searchVal = document.getElementById('searchInput').value.toLowerCase();
  const typeVal = document.getElementById('filterType').value;
  const statusVal = document.getElementById('filterStatus').value;
  const sortBy = document.getElementById('sortBy').value;

  const activeGrid = document.getElementById('wineGrid');
  const historyGrid = document.getElementById('historyGrid');

  if (currentViewTab === 'active') {
    activeGrid.classList.remove('hidden');
    historyGrid.classList.add('hidden');
    renderActiveGrid(searchVal, typeVal, statusVal, sortBy);
  } else {
    activeGrid.classList.add('hidden');
    historyGrid.classList.remove('hidden');
    renderHistoryGrid(searchVal, typeVal);
  }
}

function renderActiveGrid(searchVal, typeVal, statusVal, sortBy) {
  const grid = document.getElementById('wineGrid');
  grid.innerHTML = '';

  let filtered = winesData.filter(w => {
    if (w.quantity === 0) return false;
    const matchesSearch = w.name.toLowerCase().includes(searchVal) ||
                          (w.producer && w.producer.toLowerCase().includes(searchVal)) ||
                          (w.region && w.region.toLowerCase().includes(searchVal)) ||
                          (w.varietal && w.varietal.toLowerCase().includes(searchVal));
    const matchesType = typeVal === 'ALL' || w.type === typeVal;
    const status = getReadinessStatus(w.drinkingWindow).code;
    const matchesStatus = statusVal === 'ALL' || status === statusVal;

    return matchesSearch && matchesType && matchesStatus;
  });

  filtered.sort((a, b) => {
    if (sortBy === 'vintage-desc') return b.vintage - a.vintage;
    if (sortBy === 'vintage-asc') return a.vintage - b.vintage;
    if (sortBy === 'value-desc') return (b.purchasePrice || 0) - (a.purchasePrice || 0);
    if (sortBy === 'qty-desc') return b.quantity - a.quantity;
    return 0;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500 bg-slate-900/30 border border-slate-800 rounded-2xl">
        <i class="fa-solid fa-wine-bottle text-4xl mb-3 block"></i>
        <p class="text-sm">No active bottles matching filter criteria.</p>
      </div>`;
    return;
  }

  filtered.forEach(wine => {
    const status = getReadinessStatus(wine.drinkingWindow);
    const card = document.createElement('div');
    card.className = 'bg-slate-900 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition shadow-lg relative group';

    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-2">
          <span class="text-xs font-semibold px-2.5 py-1 rounded-full border ${status.color}">
            ${status.label}
          </span>
          <span class="text-xs text-slate-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md font-mono">
            Rack ${wine.location?.rack || 'A'} • Shelf ${wine.location?.shelf || '1'}
          </span>
        </div>

        <div>
          <div class="text-xs font-medium text-rose-400 uppercase tracking-wider">${wine.vintage} • ${wine.type}</div>
          <h2 class="text-base font-bold text-white leading-tight mt-0.5">${wine.name}</h2>
          <p class="text-xs text-slate-400 mt-1">${wine.region || 'Unknown Region'}, ${wine.country || 'Unknown'}</p>
        </div>

        <div class="text-xs space-y-1 text-slate-300 pt-2 border-t border-slate-800/80">
          <div><strong class="text-slate-400">Varietal:</strong> ${wine.varietal || 'N/A'}</div>
          <div><strong class="text-slate-400">Window:</strong> ${wine.drinkingWindow?.start || wine.vintage} – ${wine.drinkingWindow?.end || (wine.vintage + 10)}</div>
        </div>
      </div>

      <div class="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between">
        <div>
          <span class="text-[10px] text-slate-500 uppercase tracking-wider block">Price / Bottle</span>
          <span class="text-sm font-semibold text-slate-200">$${(wine.purchasePrice || 0).toFixed(2)}</span>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="promptLogTasting('${wine.id}')" title="Log Consumption Note" class="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-xs text-slate-300 rounded border border-slate-700 transition flex items-center gap-1">
            <i class="fa-solid fa-wine-glass"></i> Drink
          </button>
          
          <div class="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button onclick="updateQuantity('${wine.id}', -1)" class="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition">
              <i class="fa-solid fa-minus text-[10px]"></i>
            </button>
            <span class="w-5 text-center text-xs font-bold text-slate-100 font-mono">${wine.quantity}</span>
            <button onclick="updateQuantity('${wine.id}', 1)" class="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition">
              <i class="fa-solid fa-plus text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderHistoryGrid(searchVal, typeVal) {
  const grid = document.getElementById('historyGrid');
  grid.innerHTML = '';

  let filtered = historyData.filter(h => {
    const matchesSearch = h.name.toLowerCase().includes(searchVal) ||
                          (h.varietal && h.varietal.toLowerCase().includes(searchVal)) ||
                          (h.notes && h.notes.toLowerCase().includes(searchVal));
    const matchesType = typeVal === 'ALL' || h.type === typeVal;
    return matchesSearch && matchesType;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500 bg-slate-900/30 border border-slate-800 rounded-2xl">
        <i class="fa-solid fa-clock-rotate-left text-4xl mb-3 block"></i>
        <p class="text-sm">No consumed bottle history recorded yet.</p>
      </div>`;
    return;
  }

  filtered.forEach(item => {
    const stars = '⭐'.repeat(item.rating || 5);
    const card = document.createElement('div');
    card.className = 'bg-slate-900 border border-slate-800/90 rounded-2xl p-5 flex flex-col justify-between shadow-lg relative';

    card.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-start justify-between gap-2">
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-400 border border-indigo-800/50">
            Consumed: ${item.dateConsumed || 'N/A'}
          </span>
          <span class="text-xs text-amber-400 font-bold">${stars}</span>
        </div>

        <div>
          <div class="text-xs font-medium text-rose-400 uppercase tracking-wider">${item.vintage} • ${item.type}</div>
          <h2 class="text-base font-bold text-white leading-tight mt-0.5">${item.name}</h2>
          <p class="text-xs text-slate-400 mt-0.5">${item.region || 'Region Unspecified'}</p>
        </div>

        <div class="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 italic">
          "${item.notes || 'No tasting notes logged.'}"
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function updateQuantity(id, delta) {
  const wine = winesData.find(w => w.id === id);
  if (wine) {
    if (delta < 0 && wine.quantity === 1) {
      promptLogTasting(id);
    } else {
      wine.quantity = Math.max(0, wine.quantity + delta);
      saveToStorage();
      renderCellar();
    }
  }
}

function promptLogTasting(id) {
  const wine = winesData.find(w => w.id === id);
  if (!wine) return;

  currentLoggingWine = wine;
  document.getElementById('logWineTitle').textContent = `${wine.vintage} ${wine.name}`;
  document.getElementById('logDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('logNotes').value = '';
  document.getElementById('logTastingModal').classList.remove('hidden');
}

async function startCamera() {
  const video = document.getElementById('cameraFeed');
  const statusEl = document.getElementById('scanStatus');
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = mediaStream;
    statusEl.classList.add('hidden');
  } catch (err) {
    console.error("Camera access failed:", err);
    statusEl.classList.remove('hidden');
    statusEl.textContent = "Camera permission denied or unsupported context (HTTPS required).";
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
}

async function runTesseractOCR(canvas) {
  const statusEl = document.getElementById('scanStatus');
  statusEl.classList.remove('hidden');
  statusEl.textContent = 'Initializing in-browser OCR engine...';

  try {
    const worker = await Tesseract.createWorker('eng');
    statusEl.textContent = 'Scanning label text...';
    
    const ret = await worker.recognize(canvas);
    await worker.terminate();

    const rawText = ret.data.text;
    statusEl.textContent = 'OCR complete. Review extracted details below:';
    parseTextToForm(rawText);
  } catch (err) {
    console.error('Tesseract error:', err);
    statusEl.textContent = 'OCR failed to process frame. Please enter details manually below.';
    parseTextToForm('');
  }
}

function parseTextToForm(rawText) {
  const vintageMatch = rawText.match(/\b(19[8-9]\d|20[0-2]\d)\b/);
  const vintage = vintageMatch ? parseInt(vintageMatch[0]) : CURRENT_YEAR;

  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  const guessedName = lines.length > 0 ? lines.slice(0, 2).join(' ') : 'Scanned Wine Entry';

  document.getElementById('scanName').value = guessedName;
  document.getElementById('scanVintage').value = vintage;
  document.getElementById('scanReviewForm').classList.remove('hidden');
}

function exportDataJSON() {
  const payload = {
    inventory: winesData,
    history: historyData,
    exportDate: new Date().toISOString()
  };
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
  const anchor = document.createElement('a');
  anchor.setAttribute("href", dataStr);
  anchor.setAttribute("download", `kevs_cellar_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function importDataJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed.inventory && Array.isArray(parsed.inventory)) {
        winesData = parsed.inventory;
      }
      if (parsed.history && Array.isArray(parsed.history)) {
        historyData = parsed.history;
      }
      saveToStorage();
      renderCellar();
      alert('Cellar backup imported successfully!');
    } catch (err) {
      alert('Invalid JSON file format.');
    }
  };
  reader.readAsText(file);
}

function setupEventListeners() {
  document.getElementById('searchInput').addEventListener('input', renderCellar);
  document.getElementById('filterType').addEventListener('change', renderCellar);
  document.getElementById('filterStatus').addEventListener('change', renderCellar);
  document.getElementById('sortBy').addEventListener('change', renderCellar);

  const tabActive = document.getElementById('tabActive');
  const tabHistory = document.getElementById('tabHistory');

  tabActive.onclick = () => {
    currentViewTab = 'active';
    tabActive.className = "pb-3 text-sm font-bold border-b-2 border-rose-500 text-rose-400 flex items-center gap-2";
    tabHistory.className = "pb-3 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2";
    renderCellar();
  };

  tabHistory.onclick = () => {
    currentViewTab = 'history';
    tabHistory.className = "pb-3 text-sm font-bold border-b-2 border-rose-500 text-rose-400 flex items-center gap-2";
    tabActive.className = "pb-3 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2";
    renderCellar();
  };

  document.getElementById('exportDataBtn').onclick = exportDataJSON;
  document.getElementById('importFileInput').onchange = importDataJSON;

  document.getElementById('closeLogModal').onclick = () => {
    document.getElementById('logTastingModal').classList.add('hidden');
  };

  document.getElementById('saveLogBtn').onclick = () => {
    if (!currentLoggingWine) return;

    const entry = {
      id: `log-${Date.now()}`,
      wineId: currentLoggingWine.id,
      name: currentLoggingWine.name,
      vintage: currentLoggingWine.vintage,
      type: currentLoggingWine.type,
      varietal: currentLoggingWine.varietal,
      region: currentLoggingWine.region,
      rating: parseInt(document.getElementById('logRating').value) || 5,
      dateConsumed: document.getElementById('logDate').value,
      notes: document.getElementById('logNotes').value || 'No notes provided.'
    };

    historyData.unshift(entry);
    currentLoggingWine.quantity = Math.max(0, currentLoggingWine.quantity - 1);

    saveToStorage();
    renderCellar();
    document.getElementById('logTastingModal').classList.add('hidden');
  };

  const aiModal = document.getElementById('aiModal');
  document.getElementById('openAiModal').onclick = () => aiModal.classList.remove('hidden');
  document.getElementById('closeAiModal').onclick = () => aiModal.classList.add('hidden');

  document.getElementById('submitAiPrompt').onclick = () => {
    const prompt = document.getElementById('aiPrompt').value.toLowerCase();
    const resultBox = document.getElementById('aiResult');
    resultBox.classList.remove('hidden');

    if (!prompt.trim()) {
      resultBox.textContent = 'Please enter a prompt.';
      return;
    }

    const matches = winesData.filter(w => {
      if (w.quantity === 0) return false;
      const text = `${w.name} ${w.type} ${w.varietal} ${w.region} ${w.foodPairings ? w.foodPairings.join(' ') : ''}`.toLowerCase();
      return prompt.split(' ').some(term => term.length > 2 && text.includes(term));
    });

    if (matches.length > 0) {
      const best = matches[0];
      resultBox.innerHTML = `
        <div class="font-bold text-rose-400 text-xs uppercase">Recommended Bottle</div>
        <div class="text-base text-white font-semibold">${best.vintage} ${best.name}</div>
        <div class="text-xs text-emerald-400 mt-2"><i class="fa-solid fa-location-dot"></i> Located in Rack ${best.location?.rack || 'A'}, Shelf ${best.location?.shelf || '1'} (${best.quantity} remaining)</div>
      `;
    } else {
      resultBox.textContent = 'No exact pairing match found in your active inventory.';
    }
  };

  const scanModal = document.getElementById('scanModal');
  document.getElementById('openScanModal').onclick = () => {
    scanModal.classList.remove('hidden');
    document.getElementById('scanReviewForm').classList.add('hidden');
    startCamera();
  };

  document.getElementById('closeScanModal').onclick = () => {
    scanModal.classList.add('hidden');
    stopCamera();
  };

  document.getElementById('captureBtn').onclick = () => {
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('captureCanvas');

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    runTesseractOCR(canvas);
  };

  document.getElementById('scanReviewForm').onsubmit = (e) => {
    e.preventDefault();

    const vintageVal = parseInt(document.getElementById('scanVintage').value) || CURRENT_YEAR;
    const newWine = {
      id: `wine-${Date.now()}`,
      name: document.getElementById('scanName').value,
      producer: document.getElementById('scanName').value.split(' ')[0] || 'Unknown',
      vintage: vintageVal,
      type: document.getElementById('scanType').value,
      varietal: document.getElementById('scanVarietal').value || 'Varietal Blend',
      region: document.getElementById('scanRegion').value || 'Unspecified Region',
      country: 'International',
      coordinates: { lat: 46.2276, lng: 2.2137 },
      quantity: parseInt(document.getElementById('scanQuantity').value) || 1,
      purchasePrice: parseFloat(document.getElementById('scanPrice').value) || 0.00,
      drinkingWindow: { start: vintageVal, end: vintageVal + 10 },
      location: { rack: document.getElementById('scanRack').value || 'A', shelf: 1 }
    };

    winesData.unshift(newWine);
    saveToStorage();
    renderCellar();

    stopCamera();
    scanModal.classList.add('hidden');
  };
}