const cloudState = {
  configured: false,
  ready: false,
  session: null,
  supabase: null,
  syncTimer: null,
  syncInFlight: false,
  applyingRemoteSnapshot: false,
  lastSyncedAt: localStorage.getItem("plannerCloudLastSyncedAt") || "",
  status: "Local only",
  message: "Your planner is stored only in this browser right now."
};

function getSupabaseConfig(){
  const config = window.HOMEWORK_PLANNER_SUPABASE_CONFIG;

  if(
    config &&
    typeof config.url === "string" &&
    typeof config.publishableKey === "string" &&
    config.url.trim() &&
    config.publishableKey.trim()
  ){
    return {
      url: config.url.trim(),
      publishableKey: config.publishableKey.trim()
    };
  }

  return null;
}

function getPlannerSettingsSnapshot(){
  const storedBreakMinutes = Number(localStorage.getItem("breakMinutes"));
  const storedWorkMinutes = Number(localStorage.getItem("workMinutesBeforeBreak"));
  const storedLegacyWorkHours = Number(localStorage.getItem("workHoursBeforeBreak"));
  const extendedSnapshot = typeof getPlannerPlusSettingsSnapshot === "function"
    ? getPlannerPlusSettingsSnapshot()
    : {};

  return {
    breakMinutes: Number.isFinite(storedBreakMinutes) && storedBreakMinutes > 0
      ? storedBreakMinutes
      : 10,
    workMinutesBeforeBreak: normalizeWorkMinutesBeforeBreak(
      storedWorkMinutes,
      storedLegacyWorkHours,
      60
    ),
    latestStudyEnd: localStorage.getItem("latestStudyEnd") || "22:00",
    ...extendedSnapshot
  };
}

function getPlannerSnapshot(){
  return {
    schedule,
    assignments,
    busy,
    plannerSettings: getPlannerSettingsSnapshot(),
    weekOffset
  };
}

function applyPlannerSettingsSnapshot(settings){
  const snapshot = settings || {};

  localStorage.setItem("breakMinutes", Number(snapshot.breakMinutes || 10));
  localStorage.setItem(
    "workMinutesBeforeBreak",
    normalizeWorkMinutesBeforeBreak(
      Number(snapshot.workMinutesBeforeBreak),
      Number(snapshot.workHoursBeforeBreak),
      60
    )
  );
  localStorage.removeItem("workHoursBeforeBreak");
  localStorage.setItem("latestStudyEnd", snapshot.latestStudyEnd || "22:00");

  if(typeof applyPlannerPlusSettingsSnapshot === "function"){
    applyPlannerPlusSettingsSnapshot(snapshot);
  }
}

function applyPlannerSnapshot(snapshot){
  cloudState.applyingRemoteSnapshot = true;

  schedule = normalizeScheduleData(snapshot.schedule) || getDefaultSchedule();
  scheduleWasSaved = Boolean(snapshot.schedule);
  assignments = normalizeAssignments(snapshot.assignments || []);
  busy = normalizeBusyItems(snapshot.busy || []);
  weekOffset = Number.isFinite(Number(snapshot.weekOffset))
    ? Number(snapshot.weekOffset)
    : 0;

  saveJSON("schedule", schedule);
  saveJSON("assignments", assignments);
  saveJSON("busy", busy);
  saveJSON("weekOffset", weekOffset);
  applyPlannerSettingsSnapshot(snapshot.plannerSettings);

  if(typeof clearLockedStudyPlan === "function"){
    clearLockedStudyPlan();
  }

  if(typeof populateSetupForm === "function"){
    populateSetupForm();
  }

  if(typeof refreshClassOptions === "function"){
    refreshClassOptions();
  }

  if(typeof populatePlannerSettings === "function"){
    populatePlannerSettings();
  }

  if(typeof setDefaultDates === "function"){
    setDefaultDates();
  }

  if(typeof renderTodayText === "function"){
    renderTodayText();
  }

  renderAll();
  cloudState.applyingRemoteSnapshot = false;
}

function getSignedInUserEmail(){
  return cloudState.session?.user?.email || "";
}

function formatSyncTimestamp(value){
  if(!value){
    return "Not synced yet";
  }

  const date = new Date(value);

  if(Number.isNaN(date.getTime())){
    return "Not synced yet";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderAccountPanel(){
  const panel = document.getElementById("accountPanel");

  if(!panel){
    return;
  }

  panel.className = "card";

  panel.innerHTML = `
    <div class="section-title">Account & Sync</div>

    ${
      !cloudState.configured
        ? `
          <div class="auth-state-pill auth-local-pill">Local Only</div>
          <div class="muted-copy">
            Accounts are ready in the code, but cloud sync is not configured yet.
            Add your Supabase project URL and publishable key in <code>supabase-config.js</code>.
          </div>
        `
        : cloudState.session
          ? `
            <div class="auth-state-pill auth-live-pill">Cloud Sync Active</div>
            <div class="row-title">${escapeHTML(getSignedInUserEmail())}</div>
            <div class="muted-copy">${escapeHTML(cloudState.message)}</div>
            <div class="row-sub">Last synced: ${escapeHTML(formatSyncTimestamp(cloudState.lastSyncedAt))}</div>
            <div class="row-actions">
              <button onclick="syncNow()">Sync Now</button>
              <button class="ghost" onclick="signOutAccount()">Sign Out</button>
            </div>
          `
          : `
            <div class="auth-state-pill auth-ready-pill">Cloud Sync Ready</div>
            <div class="muted-copy">
              Sign in to open this planner on multiple devices with the same account.
              Use a real email address you can actually receive mail at. Supabase rejects placeholder addresses like <code>student@example.com</code>.
            </div>

            <label for="accountEmail">Email</label>
            <input id="accountEmail" type="email" placeholder="yourname@school.edu" />

            <label for="accountPassword">Password</label>
            <input id="accountPassword" type="password" placeholder="Choose a password" />

            <div class="row-actions">
              <button onclick="signInAccount()">Sign In</button>
              <button class="ghost" onclick="signUpAccount()">Create Account</button>
            </div>

            <div class="row-sub">${escapeHTML(cloudState.message)}</div>
          `
    }
  `;

}

function getAccountCredentials(){
  const email = document.getElementById("accountEmail")?.value.trim() || "";
  const password = document.getElementById("accountPassword")?.value || "";

  if(!email || !password){
    alert("Please enter both an email and password.");
    return null;
  }

  return { email, password };
}

function getAuthRedirectUrl(){
  return `${window.location.origin}${window.location.pathname}${window.location.search || ""}`;
}

async function saveCloudSnapshot(reason = "sync"){
  if(
    !cloudState.ready ||
    !cloudState.session ||
    cloudState.syncInFlight ||
    cloudState.applyingRemoteSnapshot
  ){
    return;
  }

  cloudState.syncInFlight = true;
  cloudState.status = "Syncing";
  cloudState.message = `Saving ${reason} to your account...`;
  renderAccountPanel();

  const snapshot = getPlannerSnapshot();
  const payload = {
    user_id: cloudState.session.user.id,
    schedule: snapshot.schedule,
    assignments: snapshot.assignments,
    busy: snapshot.busy,
    planner_settings: snapshot.plannerSettings,
    week_offset: snapshot.weekOffset
  };

  const { error } = await cloudState.supabase
    .from("planner_profiles")
    .upsert(payload, { onConflict: "user_id" });

  cloudState.syncInFlight = false;

  if(error){
    cloudState.status = "Sync error";
    cloudState.message = error.message || "Cloud sync failed.";
    renderAccountPanel();
    return;
  }

  cloudState.lastSyncedAt = new Date().toISOString();
  localStorage.setItem("plannerCloudLastSyncedAt", cloudState.lastSyncedAt);
  cloudState.status = "Synced";
  cloudState.message = "Your planner is synced to your account.";
  renderAccountPanel();
}

function queueCloudSync(reason = "changes"){
  if(
    !cloudState.ready ||
    !cloudState.session ||
    cloudState.applyingRemoteSnapshot
  ){
    return;
  }

  if(cloudState.syncTimer){
    clearTimeout(cloudState.syncTimer);
  }

  cloudState.syncTimer = setTimeout(() => {
    cloudState.syncTimer = null;
    void saveCloudSnapshot(reason);
  }, 500);
}

async function loadCloudSnapshot(){
  if(!cloudState.ready || !cloudState.session){
    return;
  }

  cloudState.status = "Loading";
  cloudState.message = "Loading your planner from the cloud...";
  renderAccountPanel();

  const { data, error } = await cloudState.supabase
    .from("planner_profiles")
    .select("schedule, assignments, busy, planner_settings, week_offset, updated_at")
    .eq("user_id", cloudState.session.user.id)
    .maybeSingle();

  if(error){
    cloudState.status = "Sync error";
    cloudState.message = error.message || "Could not load your cloud planner.";
    renderAccountPanel();
    return;
  }

  if(data){
    applyPlannerSnapshot({
      schedule: data.schedule,
      assignments: data.assignments,
      busy: data.busy,
      plannerSettings: data.planner_settings,
      weekOffset: data.week_offset
    });

    cloudState.lastSyncedAt = data.updated_at || new Date().toISOString();
    localStorage.setItem("plannerCloudLastSyncedAt", cloudState.lastSyncedAt);
    cloudState.status = "Synced";
    cloudState.message = "Your planner is synced to your account.";
    renderAccountPanel();
    return;
  }

  await saveCloudSnapshot("first sync");
}

async function syncNow(){
  await saveCloudSnapshot("planner");
}

async function signUpAccount(){
  if(!cloudState.ready){
    return;
  }

  const credentials = getAccountCredentials();

  if(!credentials){
    return;
  }

  cloudState.message = "Creating your account...";
  renderAccountPanel();

  const { data, error } = await cloudState.supabase.auth.signUp({
    ...credentials,
    options: {
      emailRedirectTo: getAuthRedirectUrl()
    }
  });

  if(error){
    if(error.message?.toLowerCase().includes("email address")){
      cloudState.message = "Please use a real email address you can receive mail at.";
    }else{
      cloudState.message = error.message || "Could not create account.";
    }
    renderAccountPanel();
    return;
  }

  if(data.session){
    cloudState.session = data.session;
    await loadCloudSnapshot();
    return;
  }

  cloudState.message = `Account created. Check your email for the confirmation link, then come back here and sign in. If no email arrives, make sure Email auth is enabled in Supabase and the Site URL/Redirect URLs include ${getAuthRedirectUrl()}.`;
  renderAccountPanel();
}

async function signInAccount(){
  if(!cloudState.ready){
    return;
  }

  const credentials = getAccountCredentials();

  if(!credentials){
    return;
  }

  cloudState.message = "Signing you in...";
  renderAccountPanel();

  const { data, error } = await cloudState.supabase.auth.signInWithPassword(credentials);

  if(error){
    if(error.message?.toLowerCase().includes("email not confirmed")){
      cloudState.message = "Your account exists, but the email has not been confirmed yet. Open the confirmation email first, then try signing in again.";
    }else{
      cloudState.message = error.message || "Sign in failed.";
    }
    renderAccountPanel();
    return;
  }

  cloudState.session = data.session;
  await loadCloudSnapshot();
}

async function signOutAccount(){
  if(!cloudState.ready){
    return;
  }

  const { error } = await cloudState.supabase.auth.signOut();

  if(error){
    cloudState.message = error.message || "Could not sign out.";
    renderAccountPanel();
    return;
  }

  cloudState.session = null;
  cloudState.status = "Signed out";
  cloudState.message = "Your planner is back in local-only mode on this device.";
  renderAccountPanel();
}

async function initializeCloudSync(){
  const config = getSupabaseConfig();

  if(!window.supabase || !config){
    cloudState.configured = false;
    cloudState.ready = false;
    cloudState.status = "Local only";
    cloudState.message = "Your planner is stored only in this browser right now.";
    renderAccountPanel();
    return;
  }

  cloudState.supabase = window.supabase.createClient(
    config.url,
    config.publishableKey
  );

  cloudState.configured = true;
  cloudState.ready = true;
  cloudState.message = "Cloud sync is ready. Sign in to use it across devices.";
  renderAccountPanel();

  const {
    data: { session }
  } = await cloudState.supabase.auth.getSession();

  cloudState.session = session;

  cloudState.supabase.auth.onAuthStateChange((event, nextSession) => {
    setTimeout(() => {
      cloudState.session = nextSession;

      if(!nextSession || event === "SIGNED_OUT"){
        cloudState.status = "Signed out";
        cloudState.message = "Your planner is back in local-only mode on this device.";
        renderAccountPanel();
        return;
      }

      void loadCloudSnapshot();
    }, 0);
  });

  if(session){
    await loadCloudSnapshot();
    return;
  }

  renderAccountPanel();
}
