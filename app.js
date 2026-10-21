const elements = {
  loginScreen: document.getElementById("loginScreen"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),
  loginBtn: document.getElementById("loginBtn"),
  appLayout: document.getElementById("appLayout"),
  logoutBtn: document.getElementById("logoutBtn"),
  quoteNumber: document.getElementById("quoteNumber"),
  quoteDate: document.getElementById("quoteDate"),
  issuerName: document.getElementById("issuerName"),
  issuerRut: document.getElementById("issuerRut"),
  issuerAddress: document.getElementById("issuerAddress"),
  issuerPhone: document.getElementById("issuerPhone"),
  issuerEmail: document.getElementById("issuerEmail"),
  clientName: document.getElementById("clientName"),
  clientNameSuggestions: document.getElementById("clientNameSuggestions"),
  attentionName: document.getElementById("attentionName"),
  attentionNameSuggestions: document.getElementById("attentionNameSuggestions"),
  attentionNameError: document.getElementById("attentionNameError"),
  clientCompany: document.getElementById("clientCompany"),
  clientEmail: document.getElementById("clientEmail"),
  clientPhone: document.getElementById("clientPhone"),
  openClientModalBtn: document.getElementById("openClientModalBtn"),
  clearClientBtn: document.getElementById("clearClientBtn"),
  sellerName: document.getElementById("sellerName"),
  issuerFields: document.getElementById("issuerFields"),
  toggleIssuerBtn: document.getElementById("toggleIssuerBtn"),
  discountRate: document.getElementById("discountRate"),
  validity: document.getElementById("validity"),
  salesTerms: document.getElementById("salesTerms"),
  salesTermsError: document.getElementById("salesTermsError"),
  notes: document.getElementById("notes"),
  tbody: document.querySelector("#itemsTable tbody"),
  rowTemplate: document.getElementById("rowTemplate"),
  addItemBtn: document.getElementById("addItemBtn"),
  itemsError: document.getElementById("itemsError"),
  saveBtn: document.getElementById("saveBtn"),
  newQuoteBtn: document.getElementById("newQuoteBtn"),
  clientModal: document.getElementById("clientModal"),
  clientModalForm: document.getElementById("clientModalForm"),
  closeClientModalBtn: document.getElementById("closeClientModalBtn"),
  saveClientModalBtn: document.getElementById("saveClientModalBtn"),
  modalClientName: document.getElementById("modalClientName"),
  modalAttentionName: document.getElementById("modalAttentionName"),
  modalClientCompany: document.getElementById("modalClientCompany"),
  modalClientEmail: document.getElementById("modalClientEmail"),
  modalClientPhone: document.getElementById("modalClientPhone"),
  subtotal: document.getElementById("subtotal"),
  discountRow: document.getElementById("discountRow"),
  discount: document.getElementById("discount"),
  tax: document.getElementById("tax"),
  total: document.getElementById("total"),
  historyClientFilter: document.getElementById("historyClientFilter"),
  historyList: document.getElementById("historyList"),
};

const STORAGE_KEY = "gestor-cotizaciones-v1";
const SEQUENCE_KEY = "gestor-cotizaciones-seq-v1";
const ISSUER_PROFILE_KEY = "gestor-cotizaciones-issuer-v1";
const CLIENT_DIRECTORY_KEY = "gestor-cotizaciones-clients-v1";
const FIXED_DOCUMENT_TYPE = "PRESUPUESTO";
const FIXED_CURRENCY = "CLP";
const FIXED_TAX_RATE = 19;
const DEFAULT_VALIDITY = "10 dias";

// Configura estas variables para activar sincronizacion en Supabase.
const SUPABASE_URL = window.GESTOR_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = window.GESTOR_SUPABASE_ANON_KEY || "";
const SUPABASE_TABLES = {
  quotes: "gc_quotes",
  clients: "gc_clients",
  issuer: "gc_issuer_profile",
};
const SUPABASE_PDF_BUCKET = "gc-pdfs";

const ISSUER_DEFAULTS = {
  issuerName: "GlassCode spa",
  issuerRut: "78.370.223-1",
  issuerAddress: "Providencia 1017 OF 41",
  issuerPhone: "+56 9 790 54 756",
  issuerEmail: "Juan.Castro.Film@gmail.com",
  sellerName: "Juan Castro",
};

const state = {
  items: [],
  quoteSequence: null,
  issuerLocked: true,
  issuerEditorOpen: false,
  clientNameIndex: [],
  attentionNameIndex: [],
  cloudSyncAvailable: false,
  cloudSyncWarned: false,
  history: [],
};

const supabaseClient =
  window.supabase?.createClient && SUPABASE_URL && SUPABASE_ANON_KEY
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

state.cloudSyncAvailable = Boolean(supabaseClient);

const setAuthView = (isLoggedIn) => {
  elements.loginScreen.hidden = isLoggedIn;
  elements.appLayout.hidden = !isLoggedIn;
  elements.logoutBtn.hidden = !isLoggedIn;
};

const handleLogin = async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    return;
  }

  elements.loginBtn.disabled = true;
  elements.loginError.hidden = true;

  const { error } = await supabaseClient.auth.signInWithPassword({
    email: elements.loginEmail.value.trim(),
    password: elements.loginPassword.value,
  });

  elements.loginBtn.disabled = false;

  if (error) {
    console.warn("Login error:", error.message);
    elements.loginError.hidden = false;
    return;
  }

  elements.loginPassword.value = "";
};

const handleLogout = async () => {
  if (!supabaseClient) {
    return;
  }

  await supabaseClient.auth.signOut();
};

const initAuth = async () => {
  if (!supabaseClient) {
    alert("No se pudo configurar la conexion con Supabase. Revisa las credenciales.");
    return null;
  }

  const { data } = await supabaseClient.auth.getSession();

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    const isLoggedIn = Boolean(session);
    setAuthView(isLoggedIn);

    if (isLoggedIn) {
      void initApp();
    }
  });

  return data?.session || null;
};

const warnCloudSyncError = (context, error) => {
  console.warn(`Supabase sync warning (${context}):`, error?.message || error || "unknown error");

  if (state.cloudSyncWarned) {
    return;
  }

  state.cloudSyncWarned = true;
  alert(
    "No se pudo sincronizar con Supabase. La app seguira funcionando en modo local en este equipo.",
  );
};

const QUOTE_PREFIX = "COT-";
const CLIENT_FIELDS = [
  "clientName",
  "attentionName",
  "clientCompany",
  "clientEmail",
  "clientPhone",
];

const formatQuoteNumber = (sequence) => `${QUOTE_PREFIX}${String(sequence).padStart(4, "0")}`;

const parseQuoteSequence = (quoteNumber) => {
  const match = /^COT-(\d+)$/.exec((quoteNumber || "").trim());

  return match ? Number(match[1]) : null;
};

const getStoredSequence = () => {
  const storedValue = Number(localStorage.getItem(SEQUENCE_KEY));

  return Number.isInteger(storedValue) && storedValue > 0 ? storedValue : 1;
};

const setStoredSequence = (sequence) => {
  localStorage.setItem(SEQUENCE_KEY, String(sequence));
};

const assignQuoteSequence = (sequence = getStoredSequence()) => {
  state.quoteSequence = sequence;
  elements.quoteNumber.value = formatQuoteNumber(sequence);
};

const getIssuerProfile = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(ISSUER_PROFILE_KEY) || "null");

    return {
      ...ISSUER_DEFAULTS,
      ...(stored || {}),
    };
  } catch {
    return { ...ISSUER_DEFAULTS };
  }
};

const applyIssuerProfile = (profile) => {
  Object.entries(profile).forEach(([key, value]) => {
    if (elements[key]) {
      elements[key].value = value;
    }
  });
};

const normalizeLookupValue = (value) => (value || "").trim().toLowerCase();

const getClientDirectory = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(CLIENT_DIRECTORY_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
};

const setClientDirectory = (clients) => {
  localStorage.setItem(CLIENT_DIRECTORY_KEY, JSON.stringify(clients));
};

const mapClientToCloudRecord = (client) => ({
  client_key: normalizeLookupValue(client.clientName || client.attentionName || crypto.randomUUID()),
  client_name: client.clientName || "",
  attention_name: client.attentionName || "",
  client_company: client.clientCompany || "",
  client_email: client.clientEmail || "",
  client_phone: client.clientPhone || "",
  updated_at: new Date().toISOString(),
});

const mapCloudRecordToClient = (record) => ({
  clientName: record.client_name || "",
  attentionName: record.attention_name || "",
  clientCompany: record.client_company || "",
  clientEmail: record.client_email || "",
  clientPhone: record.client_phone || "",
});

const pushIssuerProfileToCloud = async () => {
  if (!supabaseClient) {
    return;
  }

  const profile = {
    issuerName: elements.issuerName.value,
    issuerRut: elements.issuerRut.value,
    issuerAddress: elements.issuerAddress.value,
    issuerPhone: elements.issuerPhone.value,
    issuerEmail: elements.issuerEmail.value,
    sellerName: elements.sellerName.value,
  };

  const { error } = await supabaseClient.from(SUPABASE_TABLES.issuer).upsert(
    {
      id: "default",
      data: profile,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    warnCloudSyncError("issuer-upsert", error);
  }
};

const pullIssuerProfileFromCloud = async () => {
  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.issuer)
    .select("data")
    .eq("id", "default")
    .maybeSingle();

  if (error) {
    warnCloudSyncError("issuer-select", error);
    return null;
  }

  return data?.data || null;
};

const pushClientToCloud = async (client) => {
  if (!supabaseClient) {
    return;
  }

  const { error } = await supabaseClient
    .from(SUPABASE_TABLES.clients)
    .upsert(mapClientToCloudRecord(client), { onConflict: "client_key" });

  if (error) {
    warnCloudSyncError("client-upsert", error);
  }
};

const pullClientsFromCloud = async () => {
  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.clients)
    .select("client_name, attention_name, client_company, client_email, client_phone")
    .order("updated_at", { ascending: false });

  if (error) {
    warnCloudSyncError("clients-select", error);
    return null;
  }

  return (data || []).map(mapCloudRecordToClient);
};

const pushQuoteToCloud = async (payload) => {
  if (!supabaseClient) {
    return;
  }

  const { error } = await supabaseClient.from(SUPABASE_TABLES.quotes).upsert(
    {
      quote_number: payload.meta.quoteNumber,
      quote_sequence: payload.meta.quoteSequence,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "quote_number" },
  );

  if (error) {
    warnCloudSyncError("quote-upsert", error);
  }
};

const pullLatestQuoteFromCloud = async () => {
  if (!supabaseClient) {
    return null;
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.quotes)
    .select("payload")
    .order("quote_sequence", { ascending: false })
    .limit(1);

  if (error) {
    warnCloudSyncError("quote-select", error);
    return null;
  }

  return data?.[0]?.payload || null;
};

const sanitizeFileSegment = (value) =>
  (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-nombre";

const buildPdfStoragePath = (payload) => {
  const clientSegment = sanitizeFileSegment(payload?.meta?.clientName);
  const quoteSegment = sanitizeFileSegment(payload?.meta?.quoteNumber);
  return `${clientSegment}/${quoteSegment}.pdf`;
};

const uploadPdfToCloud = async (pdfBlob, payload) => {
  if (!supabaseClient) {
    return;
  }

  const path = buildPdfStoragePath(payload);

  const { error } = await supabaseClient.storage
    .from(SUPABASE_PDF_BUCKET)
    .upload(path, pdfBlob, { contentType: "application/pdf", upsert: true });

  if (error) {
    warnCloudSyncError("pdf-upload", error);
  }
};

const pullQuoteHistoryFromCloud = async () => {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_TABLES.quotes)
    .select("quote_number, quote_sequence, payload, updated_at")
    .order("quote_sequence", { ascending: false });

  if (error) {
    warnCloudSyncError("history-select", error);
    return;
  }

  state.history = (data || []).map((row) => ({
    quoteNumber: row.quote_number,
    clientName: row.payload?.meta?.clientName || "Sin cliente",
    quoteDate: row.payload?.meta?.quoteDate || "",
    total: row.payload?.meta?.total,
    storagePath: buildPdfStoragePath(row.payload),
  }));

  renderQuoteHistory();
};

const renderQuoteHistory = () => {
  const filterValue = normalizeLookupValue(elements.historyClientFilter.value);

  const clientNames = [
    ...new Set(state.history.map((entry) => entry.clientName).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const currentFilter = elements.historyClientFilter.value;
  elements.historyClientFilter.innerHTML = '<option value="">Todos los clientes</option>';
  clientNames.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    elements.historyClientFilter.appendChild(option);
  });
  elements.historyClientFilter.value = clientNames.includes(currentFilter) ? currentFilter : "";

  const visibleEntries = filterValue
    ? state.history.filter(
        (entry) => normalizeLookupValue(entry.clientName) === normalizeLookupValue(elements.historyClientFilter.value),
      )
    : state.history;

  elements.historyList.innerHTML = "";

  if (!visibleEntries.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = state.history.length
      ? "No hay cotizaciones para este cliente."
      : "No hay cotizaciones guardadas todavia.";
    elements.historyList.appendChild(empty);
    return;
  }

  visibleEntries.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "history-item";

    const info = document.createElement("div");
    info.className = "history-item-info";

    const title = document.createElement("span");
    title.className = "history-item-title";
    title.textContent = `${entry.quoteNumber} — ${entry.clientName}`;

    const meta = document.createElement("span");
    meta.className = "history-item-meta";
    meta.textContent = formatDateForDisplay(entry.quoteDate);

    info.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "history-item-actions";

    const viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "ghost";
    viewBtn.textContent = "Ver";
    viewBtn.addEventListener("click", () => void openHistoryPdf(entry, { download: false }));

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "solid";
    downloadBtn.textContent = "Descargar";
    downloadBtn.addEventListener("click", () => void openHistoryPdf(entry, { download: true }));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "ghost";
    deleteBtn.textContent = "Eliminar";
    deleteBtn.addEventListener("click", () => void deleteHistoryEntry(entry));

    actions.append(viewBtn, downloadBtn, deleteBtn);
    item.append(info, actions);
    elements.historyList.appendChild(item);
  });
};

const openHistoryPdf = async (entry, { download }) => {
  if (!supabaseClient) {
    return;
  }

  const { data, error } = await supabaseClient.storage
    .from(SUPABASE_PDF_BUCKET)
    .createSignedUrl(entry.storagePath, 120);

  if (error) {
    warnCloudSyncError("pdf-signed-url", error);
    return;
  }

  if (download) {
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.download = `${entry.quoteNumber}-${sanitizeFileSegment(entry.clientName)}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  window.open(data.signedUrl, "_blank");
};

const deleteHistoryEntry = async (entry) => {
  if (!supabaseClient) {
    return;
  }

  const confirmed = confirm(
    `¿Eliminar la cotizacion ${entry.quoteNumber} de ${entry.clientName}?\n\nSe borrara el registro y el PDF de la nube. Esta accion no se puede deshacer.`,
  );

  if (!confirmed) {
    return;
  }

  const [pdfResult, quoteResult] = await Promise.all([
    supabaseClient.storage.from(SUPABASE_PDF_BUCKET).remove([entry.storagePath]),
    supabaseClient.from(SUPABASE_TABLES.quotes).delete().eq("quote_number", entry.quoteNumber),
  ]);

  if (quoteResult.error) {
    warnCloudSyncError("history-delete", quoteResult.error);
    return;
  }

  if (pdfResult.error) {
    console.warn("No se pudo borrar el PDF:", pdfResult.error.message);
  }

  state.history = state.history.filter((item) => item.quoteNumber !== entry.quoteNumber);
  renderQuoteHistory();
};

const renderClientDirectory = () => {
  const clients = getClientDirectory();
  state.clientNameIndex = [...new Set(clients.map((client) => client.clientName).filter(Boolean))].sort();
  state.attentionNameIndex = [...new Set(clients.map((client) => client.attentionName).filter(Boolean))].sort();
};

const getClientFormData = () => ({
  clientName: elements.clientName.value.trim(),
  attentionName: elements.attentionName.value.trim(),
  clientCompany: elements.clientCompany.value.trim(),
  clientEmail: elements.clientEmail.value.trim(),
  clientPhone: elements.clientPhone.value.trim(),
});

const getModalClientFormData = () => ({
  clientName: elements.modalClientName.value.trim(),
  attentionName: elements.modalAttentionName.value.trim(),
  clientCompany: elements.modalClientCompany.value.trim(),
  clientEmail: elements.modalClientEmail.value.trim(),
  clientPhone: elements.modalClientPhone.value.trim(),
});

const applyClientProfile = (client) => {
  if (!client) {
    return;
  }

  CLIENT_FIELDS.forEach((key) => {
    elements[key].value = client[key] || "";
  });
};

const clearClientSelection = () => {
  CLIENT_FIELDS.forEach((key) => {
    elements[key].value = "";
  });

  hideSuggestions(elements.clientNameSuggestions);
  hideSuggestions(elements.attentionNameSuggestions);
  recalculate();
  elements.clientName.focus();
};

const fillClientModalForm = (client = getClientFormData()) => {
  elements.modalClientName.value = client.clientName || "";
  elements.modalAttentionName.value = client.attentionName || "";
  elements.modalClientCompany.value = client.clientCompany || "";
  elements.modalClientEmail.value = client.clientEmail || "";
  elements.modalClientPhone.value = client.clientPhone || "";
};

const findClientProfile = ({ clientName, attentionName }) => {
  const clients = getClientDirectory();
  const normalizedClientName = normalizeLookupValue(clientName);
  const normalizedAttentionName = normalizeLookupValue(attentionName);

  return (
    clients.find(
      (client) =>
        normalizedClientName && normalizeLookupValue(client.clientName) === normalizedClientName,
    ) ||
    clients.find(
      (client) =>
        normalizedAttentionName && normalizeLookupValue(client.attentionName) === normalizedAttentionName,
    ) ||
    null
  );
};

const saveClientProfile = (client = getClientFormData(), { notify } = { notify: true }) => {

  if (!client.clientName && !client.attentionName) {
    if (notify) {
      alert("Ingresa una razon social o un nombre de contacto para guardar el cliente.");
    }
    return false;
  }

  const clients = getClientDirectory();
  const existingIndex = clients.findIndex((entry) => {
    const sameClient = client.clientName && normalizeLookupValue(entry.clientName) === normalizeLookupValue(client.clientName);
    const sameContact = client.attentionName && normalizeLookupValue(entry.attentionName) === normalizeLookupValue(client.attentionName);
    return sameClient || sameContact;
  });

  if (existingIndex >= 0) {
    clients[existingIndex] = { ...clients[existingIndex], ...client };
  } else {
    clients.push(client);
  }

  setClientDirectory(clients);
  renderClientDirectory();
  void pushClientToCloud(client);

  if (notify) {
    alert("Cliente guardado para futuras cotizaciones.");
  }

  return true;
};

const openClientModal = () => {
  fillClientModalForm();

  if (typeof elements.clientModal.showModal === "function") {
    elements.clientModal.showModal();
  } else {
    elements.clientModal.setAttribute("open", "open");
  }
};

const closeClientModal = () => {
  if (typeof elements.clientModal.close === "function") {
    elements.clientModal.close();
  } else {
    elements.clientModal.removeAttribute("open");
  }
};

const handleClientModalSave = (event) => {
  event.preventDefault();

  const client = getModalClientFormData();
  const saved = saveClientProfile(client, { notify: false });

  if (!saved) {
    return;
  }

  applyClientProfile(client);
  closeClientModal();
};

const hydrateClientFromDirectory = (preferredField) => {
  const clientName = elements.clientName.value.trim();
  const attentionName = elements.attentionName.value.trim();
  let client = null;

  if (preferredField === "attentionName" && attentionName) {
    client = findClientProfile({ clientName: "", attentionName });
  } else if (preferredField === "clientName" && clientName) {
    client = findClientProfile({ clientName, attentionName: "" });
  } else if (clientName) {
    client = findClientProfile({ clientName, attentionName: "" });
  } else if (attentionName) {
    client = findClientProfile({ clientName: "", attentionName });
  }

  if (client) {
    applyClientProfile(client);
  }
};

const filterSuggestions = (value, source) => {
  const normalized = normalizeLookupValue(value);
  if (!normalized) {
    return source.slice(0, 8);
  }

  return source.filter((item) => normalizeLookupValue(item).includes(normalized)).slice(0, 8);
};

const hideSuggestions = (container) => {
  container.hidden = true;
  container.innerHTML = "";
};

const renderSuggestions = ({ input, container, source, onSelect }) => {
  const suggestions = filterSuggestions(input.value, source);

  if (!suggestions.length) {
    hideSuggestions(container);
    return;
  }

  container.innerHTML = "";
  suggestions.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-item";
    button.textContent = item;

    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });

    button.addEventListener("click", () => {
      input.value = item;
      hideSuggestions(container);
      onSelect();
      recalculate();
    });

    container.appendChild(button);
  });

  container.hidden = false;
};

const bindSearchableField = ({ input, container, sourceGetter, onSelect }) => {
  const refresh = () => {
    renderSuggestions({
      input,
      container,
      source: sourceGetter(),
      onSelect,
    });
  };

  input.addEventListener("focus", refresh);
  input.addEventListener("input", refresh);
  input.addEventListener("blur", () => {
    setTimeout(() => {
      hideSuggestions(container);
      onSelect();
    }, 120);
  });
};

const saveIssuerProfile = () => {
  localStorage.setItem(
    ISSUER_PROFILE_KEY,
    JSON.stringify({
      issuerName: elements.issuerName.value,
      issuerRut: elements.issuerRut.value,
      issuerAddress: elements.issuerAddress.value,
      issuerPhone: elements.issuerPhone.value,
      issuerEmail: elements.issuerEmail.value,
      sellerName: elements.sellerName.value,
    }),
  );

  void pushIssuerProfileToCloud();
};

const setIssuerLocked = (locked) => {
  state.issuerLocked = locked;

  elements.issuerFields.querySelectorAll("input").forEach((input) => {
    input.readOnly = locked;
  });

  elements.issuerFields.classList.toggle("is-locked", locked);
  elements.toggleIssuerBtn.textContent = locked ? "Editar emisor" : "Bloquear emisor";
};

const setIssuerEditorOpen = (open) => {
  state.issuerEditorOpen = open;
  elements.issuerFields.hidden = !open;
};

const getCurrencyLocale = (currency) => {
  if (currency === "CLP") {
    return "es-CL";
  }

  if (currency === "EUR") {
    return "es-ES";
  }

  return "es-MX";
};

const formatMoney = (value) => {
  const amount = Number.isFinite(value) ? value : 0;
  const currency = FIXED_CURRENCY;

  return new Intl.NumberFormat(getCurrencyLocale(currency), {
    style: "currency",
    currency,
  }).format(amount);
};

const formatDateForDisplay = (value) => {
  if (!value) {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  }).format(date);
};

const formatSalesTermsForDisplay = (value) => value.split("|").join("\n");

const getItemTotal = (item) => item.qty * item.price;

const buildPdfFileName = () => {
  const clientName = (elements.clientName.value || "cliente")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "cliente";

  return `${elements.quoteNumber.value || "cotizacion"}-${clientName}.pdf`;
};

const getQuoteTotals = () => {
  const subtotal = state.items.reduce((sum, item) => sum + getItemTotal(item), 0);
  const discountRate = Number(elements.discountRate.value || 0) / 100;
  const taxRate = FIXED_TAX_RATE / 100;
  const discountAmount = subtotal * discountRate;
  const taxableBase = subtotal - discountAmount;
  const taxAmount = taxableBase * taxRate;
  const total = taxableBase + taxAmount;

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
  };
};

const drawLine = (pdf, x1, y1, x2, y2, width = 1) => {
  pdf.setLineWidth(width);
  pdf.line(x1, y1, x2, y2);
};

const drawKeyValue = (pdf, label, value, x, y, options = {}) => {
  const {
    labelWidth = 78,
    valueX = x + labelWidth,
    labelStyle = "normal",
    valueStyle = "bold",
    valueMaxWidth,
  } = options;

  pdf.setFont("helvetica", labelStyle);
  pdf.text(label, x, y);
  pdf.setFont("helvetica", valueStyle);

  if (valueMaxWidth) {
    const lines = pdf.splitTextToSize(value || "-", valueMaxWidth);
    pdf.text(lines, valueX, y);
    return lines.length;
  }

  pdf.text(value || "-", valueX, y);
  return 1;
};

const syncStateFromRows = () => {
  state.items = Array.from(elements.tbody.querySelectorAll("tr")).map((row) => ({
    qty: Number(row.querySelector(".item-qty").value || 0),
    description: row.querySelector(".item-description").value.trim(),
    price: Number(row.querySelector(".item-price").value || 0),
  }));
};

const recalculate = () => {
  syncStateFromRows();

  state.items.forEach((item, index) => {
    const row = elements.tbody.querySelectorAll("tr")[index];
    row.querySelector(".item-total").textContent = formatMoney(getItemTotal(item));
  });

  const totals = getQuoteTotals();

  elements.subtotal.textContent = formatMoney(totals.subtotal);
  elements.discount.textContent = `-${formatMoney(totals.discountAmount)}`;
  elements.discountRow.hidden = totals.discountAmount <= 0;
  elements.tax.textContent = formatMoney(totals.taxAmount);
  elements.total.textContent = formatMoney(totals.total);
  applyLiveValidation();
};

const setFieldError = (field, messageNode, hasError) => {
  field.classList.toggle("input-invalid", hasError);
  messageNode.hidden = !hasError;
};

const getInvalidItems = () =>
  state.items.map((item, index) => ({
    index,
    invalid: !item.description.trim() || item.qty <= 0 || item.price <= 0,
  }));

const getQuoteValidationState = () => {
  const missingSalesTerms = !elements.salesTerms.value.trim();
  const missingAttention = !elements.attentionName.value.trim();
  const invalidItems = getInvalidItems();
  const hasInvalidItems = !invalidItems.length || invalidItems.some((entry) => entry.invalid);

  return {
    missingSalesTerms,
    missingAttention,
    invalidItems,
    hasInvalidItems,
    isValid: !missingSalesTerms && !missingAttention && !hasInvalidItems,
  };
};

const applyLiveValidation = () => {
  const validation = getQuoteValidationState();

  setFieldError(elements.salesTerms, elements.salesTermsError, validation.missingSalesTerms);
  setFieldError(elements.attentionName, elements.attentionNameError, validation.missingAttention);

  elements.itemsError.hidden = !validation.hasInvalidItems;

  const rows = Array.from(elements.tbody.querySelectorAll("tr"));
  rows.forEach((row, index) => {
    const invalid = validation.invalidItems[index]?.invalid ?? true;
    [".item-qty", ".item-description", ".item-price"].forEach((selector) => {
      row.querySelector(selector)?.classList.toggle("input-invalid", invalid);
    });
  });

  elements.saveBtn.disabled = !validation.isValid;
  return validation;
};

const validateQuoteBeforeSave = () => {
  const validation = applyLiveValidation();
  const errors = [];

  if (validation.missingSalesTerms) {
    errors.push("Condicion de venta");
  }

  if (validation.missingAttention) {
    errors.push("Atencion a (Datos del cliente)");
  }

  if (validation.hasInvalidItems) {
    errors.push("Completar cada item de Servicios / Conceptos (descripcion, cantidad y precio)");
  }

  if (!errors.length) {
    return true;
  }

  alert(`No se puede guardar ni generar la cotizacion.\n\nFaltan datos obligatorios:\n- ${errors.join("\n- ")}`);
  return false;
};

const bindRowEvents = (row) => {
  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", recalculate);
  });

  row.querySelector(".delete-row").addEventListener("click", () => {
    row.remove();
    recalculate();
  });
};

const addRow = (item = { qty: 1, description: "", price: 0 }) => {
  const row = elements.rowTemplate.content.firstElementChild.cloneNode(true);

  row.querySelector(".item-qty").value = item.qty;
  row.querySelector(".item-description").value = item.description;
  row.querySelector(".item-price").value = item.price;

  bindRowEvents(row);
  elements.tbody.appendChild(row);
  recalculate();
};

const generatePdf = () => {
  recalculate();

  const previewWindow = window.open("", "_blank");

  if (!window.jspdf?.jsPDF) {
    if (previewWindow) {
      previewWindow.close();
    }
    alert("No fue posible cargar el generador de PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const totals = getQuoteTotals();
  const fileName = buildPdfFileName();
  const brand = [21, 79, 92];
  const brandSoft = [236, 244, 246];
  const ink = [28, 34, 38];
  const muted = [98, 109, 119];
  const line = [217, 224, 228];
  const rows = state.items.length
    ? state.items.map((item) => [
        item.qty.toFixed(2),
        item.description || "Sin descripcion",
        formatMoney(item.price),
        formatMoney(getItemTotal(item)),
      ])
    : [["0.00", "Sin items", formatMoney(0), formatMoney(0)]];

  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, 595, 842, "F");

  pdf.setDrawColor(line[0], line[1], line[2]);
  pdf.setLineWidth(1);
  pdf.roundedRect(28, 28, 539, 786, 10, 10);

  pdf.setFillColor(brandSoft[0], brandSoft[1], brandSoft[2]);
  pdf.roundedRect(40, 40, 515, 118, 8, 8, "F");
  pdf.setFillColor(brand[0], brand[1], brand[2]);
  pdf.rect(40, 40, 515, 8, "F");

  pdf.setTextColor(ink[0], ink[1], ink[2]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(25);
  pdf.text(elements.issuerName.value || "Nombre empresa", 58, 88);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(muted[0], muted[1], muted[2]);
  pdf.text(`R.U.T. ${elements.issuerRut.value || "-"}`, 58, 108);
  pdf.text(elements.issuerAddress.value || "-", 58, 126);
  pdf.text(`Fono: ${elements.issuerPhone.value || "-"}`, 58, 144);
  pdf.text(`Email: ${elements.issuerEmail.value || "-"}`, 58, 162);

  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(line[0], line[1], line[2]);
  pdf.roundedRect(380, 62, 162, 84, 8, 8, "FD");
  pdf.setTextColor(brand[0], brand[1], brand[2]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(FIXED_DOCUMENT_TYPE, 392, 84);
  pdf.setTextColor(muted[0], muted[1], muted[2]);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("FECHA", 392, 106);
  pdf.text("N°", 392, 124);
  pdf.setTextColor(ink[0], ink[1], ink[2]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(formatDateForDisplay(elements.quoteDate.value), 535, 106, { align: "right" });
  pdf.text(elements.quoteNumber.value || "-", 535, 124, { align: "right" });

  pdf.setFillColor(249, 251, 252);
  pdf.setDrawColor(line[0], line[1], line[2]);
  pdf.roundedRect(40, 176, 515, 138, 8, 8, "FD");
  pdf.setLineWidth(0.8);
  pdf.line(297.5, 176, 297.5, 314);
  pdf.line(40, 222, 555, 222);
  pdf.line(40, 268, 555, 268);

  const labelColor = muted;
  const valueColor = ink;
  const leftLabelX = 54;
  const leftValueX = 136;
  const rightLabelX = 312;
  const rightValueX = 382;
  const row1 = 198;
  const row2 = 244;
  const row3 = 290;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
  pdf.text("RAZON SOCIAL", leftLabelX, row1);
  pdf.text("ATENCION", rightLabelX, row1);
  pdf.text("DIRECCION", leftLabelX, row2);
  pdf.text("EMAIL", rightLabelX, row2);
  pdf.text("COND. VENTA", leftLabelX, row3);
  pdf.text("FONO", rightLabelX, row3);

  pdf.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text(pdf.splitTextToSize(elements.clientName.value || "-", 150), leftValueX, row1);
  pdf.text(pdf.splitTextToSize(elements.attentionName.value || "-", 150), rightValueX, row1);
  pdf.text(pdf.splitTextToSize(elements.clientCompany.value || "-", 150), leftValueX, row2);
  pdf.text(pdf.splitTextToSize(elements.clientEmail.value || "-", 150), rightValueX, row2);
  pdf.text(
    pdf.splitTextToSize(formatSalesTermsForDisplay(elements.salesTerms.value || "-"), 150),
    leftValueX,
    row3,
  );
  pdf.text(elements.clientPhone.value || "-", rightValueX, row3);

  pdf.setTextColor(muted[0], muted[1], muted[2]);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("VENDEDOR", 54, 334);
  pdf.setTextColor(ink[0], ink[1], ink[2]);
  pdf.setFont("helvetica", "bold");
  pdf.text(elements.sellerName.value || "-", 112, 334);

  pdf.autoTable({
    startY: 352,
    margin: { left: 40, right: 40 },
    tableWidth: 515,
    head: [["CANTIDAD", "DESCRIPCION", "P. UNITARIO", "TOTAL"]],
    body: rows,
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 10,
      cellPadding: { top: 9, right: 8, bottom: 9, left: 8 },
      textColor: ink,
      lineColor: line,
      lineWidth: 0.6,
    },
    headStyles: {
      fillColor: brandSoft,
      textColor: brand,
      fontStyle: "bold",
      halign: "left",
      lineColor: line,
      lineWidth: 0.8,
    },
    alternateRowStyles: {
      fillColor: [252, 253, 255],
    },
    columnStyles: {
      0: { cellWidth: 80, halign: "right" },
      1: { cellWidth: 239, halign: "left" },
      2: { cellWidth: 98, halign: "right" },
      3: { cellWidth: 98, halign: "right" },
    },
    didParseCell: (hookData) => {
      if (hookData.section !== "head") {
        return;
      }

      if ([0, 2, 3].includes(hookData.column.index)) {
        hookData.cell.styles.halign = "right";
      }
    },
  });

  const tableBottomY = pdf.lastAutoTable?.finalY || 352;
  const totalsBoxWidth = 186;
  const totalsBoxX = 369;
  const totalsBoxY = tableBottomY + 20;
  const rowHeight = 24;
  const totalsRows = totals.discountAmount > 0 ? 4 : 3;
  const totalsBoxHeight = rowHeight * totalsRows + 22;
  let summaryY = totalsBoxY + 18;

  pdf.setFillColor(249, 251, 252);
  pdf.setDrawColor(line[0], line[1], line[2]);
  pdf.roundedRect(totalsBoxX, totalsBoxY, totalsBoxWidth, totalsBoxHeight, 8, 8, "FD");
  pdf.setTextColor(muted[0], muted[1], muted[2]);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.text("Neto", totalsBoxX + 12, summaryY);
  pdf.setTextColor(ink[0], ink[1], ink[2]);
  pdf.text(formatMoney(totals.subtotal), totalsBoxX + totalsBoxWidth - 12, summaryY, { align: "right" });
  summaryY += rowHeight;

  if (totals.discountAmount > 0) {
    pdf.setTextColor(muted[0], muted[1], muted[2]);
    pdf.text("Descuento", totalsBoxX + 12, summaryY);
    pdf.setTextColor(ink[0], ink[1], ink[2]);
    pdf.text(`-${formatMoney(totals.discountAmount)}`, totalsBoxX + totalsBoxWidth - 12, summaryY, {
      align: "right",
    });
    summaryY += rowHeight;
  }

  pdf.setTextColor(muted[0], muted[1], muted[2]);
  pdf.text(`${FIXED_TAX_RATE}% IVA`, totalsBoxX + 12, summaryY);
  pdf.setTextColor(ink[0], ink[1], ink[2]);
  pdf.text(formatMoney(totals.taxAmount), totalsBoxX + totalsBoxWidth - 12, summaryY, { align: "right" });
  summaryY += rowHeight;

  pdf.setFillColor(brand[0], brand[1], brand[2]);
  pdf.roundedRect(totalsBoxX + 8, summaryY - 14, totalsBoxWidth - 16, 26, 6, 6, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.text("Total", totalsBoxX + 18, summaryY + 3);
  pdf.text(formatMoney(totals.total), totalsBoxX + totalsBoxWidth - 18, summaryY + 3, { align: "right" });

  const footerY = Math.min(totalsBoxY + totalsBoxHeight + 30, 760);
  pdf.setDrawColor(line[0], line[1], line[2]);
  pdf.line(40, footerY - 14, 555, footerY - 14);
  pdf.setTextColor(muted[0], muted[1], muted[2]);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);

  if (elements.validity.value.trim()) {
    pdf.text(`Vigencia: ${elements.validity.value.trim()}`, 40, footerY);
  }

  if (elements.notes.value.trim()) {
    pdf.text(pdf.splitTextToSize(`Notas: ${elements.notes.value.trim()}`, 330), 40, footerY + 16);
  }

  pdf.setTextColor(brand[0], brand[1], brand[2]);
  pdf.text("Gracias por confiar en nosotros.", 555, footerY, { align: "right" });

  pdf.save(fileName);

  const blob = pdf.output("blob");
  const blobUrl = URL.createObjectURL(blob);

  void uploadPdfToCloud(blob, toPayload()).then(() => pullQuoteHistoryFromCloud());

  if (previewWindow) {
    previewWindow.location.href = blobUrl;
  } else {
    alert("El navegador bloqueo la vista previa. El PDF se descargo automaticamente.");
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
};

const toPayload = () => ({
  meta: {
    quoteNumber: elements.quoteNumber.value,
    quoteSequence: state.quoteSequence,
    quoteDate: elements.quoteDate.value,
    issuerName: elements.issuerName.value,
    issuerRut: elements.issuerRut.value,
    issuerAddress: elements.issuerAddress.value,
    issuerPhone: elements.issuerPhone.value,
    issuerEmail: elements.issuerEmail.value,
    clientName: elements.clientName.value,
    attentionName: elements.attentionName.value,
    clientCompany: elements.clientCompany.value,
    clientEmail: elements.clientEmail.value,
    clientPhone: elements.clientPhone.value,
    sellerName: elements.sellerName.value,
    discountRate: elements.discountRate.value,
    validity: elements.validity.value,
    salesTerms: elements.salesTerms.value,
    notes: elements.notes.value,
  },
  items: state.items,
});

const loadPayload = (payload) => {
  if (!payload) return;

  const { meta, items } = payload;

  applyIssuerProfile(getIssuerProfile());

  Object.entries(meta || {}).forEach(([key, value]) => {
    if (elements[key]) {
      elements[key].value = value;
    }
  });

  if (!elements.validity.value) {
    elements.validity.value = DEFAULT_VALIDITY;
  }

  state.quoteSequence = meta?.quoteSequence ?? parseQuoteSequence(meta?.quoteNumber);

  if (state.quoteSequence) {
    elements.quoteNumber.value = formatQuoteNumber(state.quoteSequence);
    if (state.quoteSequence >= getStoredSequence()) {
      setStoredSequence(state.quoteSequence + 1);
    }
  } else {
    assignQuoteSequence();
  }

  elements.tbody.innerHTML = "";
  (items && items.length ? items : [{ qty: 1, description: "", price: 0 }]).forEach(addRow);
  recalculate();
};

const clearForm = () => {
  [
    "clientName",
    "attentionName",
    "clientCompany",
    "clientEmail",
    "clientPhone",
    "salesTerms",
    "notes",
  ].forEach((key) => {
    elements[key].value = "";
  });

  elements.validity.value = DEFAULT_VALIDITY;

  applyIssuerProfile(getIssuerProfile());
  assignQuoteSequence();
  elements.quoteDate.value = new Date().toISOString().split("T")[0];
  elements.discountRate.value = 0;

  elements.tbody.innerHTML = "";
  addRow();
  recalculate();
};

const persistQuote = ({ notify } = { notify: true }) => {
  const payload = toPayload();

  saveIssuerProfile();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  void pushQuoteToCloud(payload);

  if (state.quoteSequence === getStoredSequence()) {
    setStoredSequence(state.quoteSequence + 1);
  }

  if (notify) {
    alert("Cotizacion guardada localmente.");
  }
};

const saveAndGeneratePdf = () => {
  recalculate();

  if (!validateQuoteBeforeSave()) {
    return;
  }

  saveClientProfile(getClientFormData(), { notify: false });
  persistQuote({ notify: false });
  generatePdf();
};

const loadQuote = () => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    clearForm();
  } else {
    try {
      loadPayload(JSON.parse(stored));
    } catch {
      clearForm();
    }
  }
};

const syncFromCloud = async () => {
  if (!supabaseClient) {
    return;
  }

  const [cloudIssuer, cloudClients, cloudQuote] = await Promise.all([
    pullIssuerProfileFromCloud(),
    pullClientsFromCloud(),
    pullLatestQuoteFromCloud(),
  ]);

  if (cloudIssuer) {
    applyIssuerProfile({ ...ISSUER_DEFAULTS, ...cloudIssuer });
    localStorage.setItem(
      ISSUER_PROFILE_KEY,
      JSON.stringify({ ...ISSUER_DEFAULTS, ...cloudIssuer }),
    );
  }

  if (cloudClients && cloudClients.length) {
    setClientDirectory(cloudClients);
    renderClientDirectory();
  }

  if (cloudQuote) {
    const currentSequence = state.quoteSequence || 0;
    const cloudSequence = cloudQuote?.meta?.quoteSequence || 0;

    if (cloudSequence >= currentSequence) {
      loadPayload(cloudQuote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudQuote));
    }
  }
};

const initApp = async () => {
  applyIssuerProfile(getIssuerProfile());
  renderClientDirectory();
  setIssuerLocked(true);
  setIssuerEditorOpen(false);
  loadQuote();

  try {
    await syncFromCloud();
    await pullQuoteHistoryFromCloud();
  } catch (error) {
    warnCloudSyncError("init-sync", error);
  }
};

elements.addItemBtn.addEventListener("click", () => addRow());
elements.saveBtn.addEventListener("click", saveAndGeneratePdf);
elements.openClientModalBtn.addEventListener("click", openClientModal);
elements.clearClientBtn.addEventListener("click", clearClientSelection);
elements.closeClientModalBtn.addEventListener("click", closeClientModal);
elements.clientModalForm.addEventListener("submit", handleClientModalSave);
elements.newQuoteBtn.addEventListener("click", clearForm);
elements.historyClientFilter.addEventListener("change", renderQuoteHistory);
elements.toggleIssuerBtn.addEventListener("click", () => {
  if (!state.issuerEditorOpen) {
    setIssuerEditorOpen(true);
    setIssuerLocked(false);
    return;
  }

  if (state.issuerLocked) {
    setIssuerLocked(false);
    return;
  }

  saveIssuerProfile();
  setIssuerLocked(true);
  setIssuerEditorOpen(false);
});

[
  elements.quoteDate,
  elements.issuerName,
  elements.issuerRut,
  elements.issuerAddress,
  elements.issuerPhone,
  elements.issuerEmail,
  elements.clientName,
  elements.attentionName,
  elements.clientCompany,
  elements.clientEmail,
  elements.clientPhone,
  elements.sellerName,
  elements.discountRate,
  elements.validity,
  elements.salesTerms,
  elements.notes,
].forEach((field) => field.addEventListener("input", recalculate));

bindSearchableField({
  input: elements.clientName,
  container: elements.clientNameSuggestions,
  sourceGetter: () => state.clientNameIndex,
  onSelect: () => hydrateClientFromDirectory("clientName"),
});

bindSearchableField({
  input: elements.attentionName,
  container: elements.attentionNameSuggestions,
  sourceGetter: () => state.attentionNameIndex,
  onSelect: () => hydrateClientFromDirectory("attentionName"),
});

document.addEventListener("click", (event) => {
  if (!elements.clientName.closest(".searchable-field")?.contains(event.target)) {
    hideSuggestions(elements.clientNameSuggestions);
  }

  if (!elements.attentionName.closest(".searchable-field")?.contains(event.target)) {
    hideSuggestions(elements.attentionNameSuggestions);
  }
});

elements.loginForm.addEventListener("submit", handleLogin);
elements.logoutBtn.addEventListener("click", handleLogout);

elements.appLayout.hidden = true;

void initAuth().then((session) => {
  setAuthView(Boolean(session));

  if (session) {
    void initApp();
  }
});
