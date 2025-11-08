/* =========================
   Employee Management JS
   ========================= */

(() => {
  // ---- Helpers ----
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const fmtTime = ts => {
    if (!ts) return "-";
    const d = new Date(ts);
    return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  };
  const fmtDate = d => {
    const dt = new Date(d);
    return dt.toLocaleDateString();
  };

  // ---- storage keys & defaults ----
  const KEY = {
    USERS: "ems_users",
    ATT: "ems_attendance",
    LEAVES: "ems_leaves",
    SETTINGS: "ems_settings",
    CURRENT: "ems_current",
  };

  const defaultSettings = { workingDaysPerMonth: 22, workingHoursPerDay: 8 };

  // ---- state ----
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  // ensure admin user exists
  function ensureDemoData() {
    let users = load(KEY.USERS, []);
    if (!users.find(u => u.username === "admin")) {
      users.push({
        username: "admin", name: "Company Admin", email: "admin@company.com", role: "admin",
        department: "Management", joinDate: new Date().toISOString(), salary: 5000, password: "admin"
      });
    }
    if (!users.find(u => u.username === "jdoe")) {
      users.push({
        username: "jdoe", name: "John Doe", email: "john.doe@company.com", role: "employee",
        department: "Engineering", joinDate: new Date().toISOString(), salary: 3000, password: "1234"
      });
    }
    save(KEY.USERS, users);
    const settings = load(KEY.SETTINGS, null) || defaultSettings;
    save(KEY.SETTINGS, settings);
  }

  // ---- UI references ----
  const loginScreen = $("#loginScreen");
  const mainApp = $("#mainApp");
  const loginUser = $("#loginUser");
  const loginPass = $("#loginPass");
  const loginRole = $("#loginRole");
  const loginError = $("#loginError");
  const btnLogin = $("#btnLogin");
  const btnDemo = $("#btnDemo");

  const btnLogout = $("#btnLogout");
  const navItems = $$(".nav-item");
  const views = $$(".view");
  const currentUserCard = $("#currentUserCard");
  const welcomeText = $("#welcomeText");
  const employeeQuick = $("#employeeQuick");
  const statTotal = $("#statTotal");
  const statPresent = $("#statPresent");
  const statLeaves = $("#statLeaves");
  const globalSearch = $("#globalSearch");

  // manage employees area
  const employeesTableBody = $("#employeesTable tbody");
  const btnAddEmp = $("#btnAddEmp");

  // attendance area
  const btnCheckIn = $("#btnCheckIn");
  const btnCheckOut = $("#btnCheckOut");
  const todayStatus = $("#todayStatus");
  const attendanceTableBody = $("#attendanceTable tbody");

  // leave area
  const leaveDate = $("#leaveDate");
  const leaveReason = $("#leaveReason");
  const btnApplyLeave = $("#btnApplyLeave");
  const leaveTableBody = $("#leaveTable tbody");
  const leaveMsg = $("#leaveMsg");

  // salary
  const salaryTableBody = $("#salaryTable tbody");

  // reports
  const reportSummary = $("#reportSummary");
  const reportLeaves = $("#reportLeaves");

  // settings
  const settingWorkingDays = $("#settingWorkingDays");
  const settingWorkingHours = $("#settingWorkingHours");
  const btnSaveSettings = $("#btnSaveSettings");
  const settingsMsg = $("#settingsMsg");

  // modal
  const modalOverlay = $("#modalOverlay");
  const modalContent = $("#modalContent");

  // ---- routing / views ----
  function showView(name) {
    views.forEach(v => v.classList.remove("active"));
    const view = $(`#view-${name}`);
    if (view) view.classList.add("active");
    navItems.forEach(n => n.classList.toggle("active", n.dataset.view === name));
  }
  $$(".nav-item").forEach(n => n.addEventListener("click", () => showView(n.dataset.view)));

  // ---- current user ----
  function getCurrentUser() {
    return load(KEY.CURRENT, null);
  }
  function setCurrentUser(u) {
    if (!u) localStorage.removeItem(KEY.CURRENT);
    else save(KEY.CURRENT, u);
  }

  // ---- login/logout ----
  function showLogin() {
    loginScreen.style.display = "";
    mainApp.style.display = "none";
  }
  function showApp() {
    loginScreen.style.display = "none";
    mainApp.style.display = "";
  }

  btnLogin.addEventListener("click", () => {
    const userVal = loginUser.value.trim();
    const passVal = loginPass.value;
    const roleVal = loginRole.value;

    if (!userVal || !passVal) {
      loginError.textContent = "Enter username/email and password.";
      return;
    }

    const users = load(KEY.USERS, []);
    let found = users.find(u => (u.username === userVal || u.email === userVal) && u.password === passVal && u.role === roleVal);
    if (!found) {
      loginError.textContent = "Invalid credentials or role. Use Demo users for examples.";
      return;
    }
    setCurrentUser(found);
    loginError.textContent = "";
    bootAppForUser(found);
  });

  btnDemo.addEventListener("click", () => {
    // create demo users if missing and show sample info
    ensureDemoData();
    alert("Demo users ensured. Use:\nAdmin: admin / admin\nEmployee: jdoe / 1234\nRole must match selector.");
  });

  btnLogout.addEventListener("click", () => {
    setCurrentUser(null);
    showLogin();
  });

  // ---- boot app for user ----
  function bootAppForUser(user) {
    showApp();
    renderTopUser(user);
    refreshAll();
    // role-specific UI
    if (user.role === "admin") {
      $("#navManage").style.display = "";
      $("#navAttendance").style.display = "";
      $("#navLeave").style.display = "";
      $("#navSalary").style.display = "";
      $("#navReports").style.display = "";
    } else {
      // hide admin-only links
      $("#navManage").style.display = "none";
      $("#navSalary").style.display = "";
      $("#navReports").style.display = "";
    }
    // default view
    showView("dashboard");
  }

  function renderTopUser(user) {
    currentUserCard.textContent = `${user.name || user.username} • ${user.role}`;
    welcomeText.textContent = user.role === "admin"
      ? "Admin Dashboard — manage employees, view attendance and approve leaves."
      : "Employee Dashboard — check in/out, apply for leave and view your attendance.";
    renderEmployeeQuick(user);
  }

  // ---- CRUD: employees ----
  function getUsers() { return load(KEY.USERS, []); }
  function saveUsers(u) { save(KEY.USERS, u); }

  function openModal(html) {
    modalContent.innerHTML = html;
    modalOverlay.style.display = "flex";
  }
  function closeModal() { modalOverlay.style.display = "none"; modalContent.innerHTML = ""; }

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  btnAddEmp.addEventListener("click", () => openAddEditEmployee());

  function openAddEditEmployee(user = null) {
    const title = user ? "Edit Employee" : "Add New Employee";
    const html = `
      <h3>${title}</h3>
      <div class="form-row"><label>Username</label><input id="m_username" value="${user ? user.username : ''}" ${user ? 'disabled' : ''} /></div>
      <div class="form-row"><label>Name</label><input id="m_name" value="${user ? user.name : ''}" /></div>
      <div class="form-row"><label>Email</label><input id="m_email" value="${user ? user.email : ''}" /></div>
      <div class="form-row"><label>Role</label>
        <select id="m_role"><option ${user && user.role==='employee'?'selected':''} value="employee">Employee</option><option ${user && user.role==='admin'?'selected':''} value="admin">Admin</option></select>
      </div>
      <div class="form-row"><label>Department</label><input id="m_dept" value="${user ? user.department || '' : ''}" /></div>
      <div class="form-row"><label>Salary (monthly)</label><input id="m_salary" type="number" value="${user ? user.salary : 0}" /></div>
      <div class="form-row"><label>Password</label><input id="m_pass" type="password" value="${user ? user.password : '1234'}" /></div>
      <div class="actions" style="margin-top:10px;">
        <button id="m_save" class="btn primary">Save</button>
        <button id="m_cancel" class="btn outline">Cancel</button>
        ${user ? '<button id="m_delete" class="btn small" style="background:#ef4444;color:#fff;margin-left:auto">Delete</button>' : ''}
      </div>
    `;
    openModal(html);
    $("#m_cancel").addEventListener("click", closeModal);
    $("#m_save").addEventListener("click", () => {
      const username = $("#m_username").value.trim();
      const name = $("#m_name").value.trim();
      const email = $("#m_email").value.trim();
      const role = $("#m_role").value;
      const department = $("#m_dept").value.trim();
      const salary = Number($("#m_salary").value) || 0;
      const password = $("#m_pass").value || "1234";
      if (!username || !name || !email) return alert("fill required fields");
      const users = getUsers();
      if (user) {
        // update
        const idx = users.findIndex(u => u.username === user.username);
        users[idx] = {...users[idx], name,email,role,department,salary,password};
      } else {
        if (users.find(u=>u.username===username || u.email===email)) return alert("Username/email exists");
        users.push({username,name,email,role,department,joinDate:new Date().toISOString(),salary,password});
      }
      saveUsers(users);
      closeModal();
      refreshAll();
    });

    if (user) {
      $("#m_delete").addEventListener("click", () => {
        if (!confirm("Delete this employee?")) return;
        let users = getUsers().filter(u => u.username !== user.username);
        saveUsers(users);
        closeModal();
        refreshAll();
      });
    }
  }

  function renderEmployeesList(filter = "") {
    const users = getUsers();
    const q = filter.trim().toLowerCase();
    const rows = users.filter(u => u.username !== 'admin' || true).filter(u => {
      if (!q) return true;
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.username||'').toLowerCase().includes(q);
    }).map(u => {
      return `<tr>
        <td>${u.username}</td>
        <td>${u.name||''}</td>
        <td>${u.email||''}</td>
        <td>${u.role}</td>
        <td>${u.department||''}</td>
        <td>${fmtDate(u.joinDate)}</td>
        <td>${u.salary || 0}</td>
        <td>
          <button class="btn small" data-action="edit" data-user="${u.username}">Edit</button>
          <button class="btn outline small" data-action="view" data-user="${u.username}">View</button>
        </td>
      </tr>`;
    }).join("");
    employeesTableBody.innerHTML = rows || "<tr><td colspan='8' class='muted'>No employees</td></tr>";

    // attach actions
    employeesTableBody.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const action = btn.dataset.action;
        const username = btn.dataset.user;
        const user = getUsers().find(x => x.username === username);
        if (action === "edit") openAddEditEmployee(user);
        else if (action === "view") openViewEmployee(user);
      });
    });
  }

  function openViewEmployee(user) {
    if (!user) return;
    const html = `<h3>${user.name} (${user.username})</h3>
      <p><strong>Email:</strong> ${user.email}</p>
      <p><strong>Role:</strong> ${user.role}</p>
      <p><strong>Department:</strong> ${user.department || '-'}</p>
      <p><strong>Join Date:</strong> ${fmtDate(user.joinDate)}</p>
      <p><strong>Salary:</strong> ${user.salary || 0}</p>
      <div class="actions" style="margin-top:12px;"><button id="closeView" class="btn outline">Close</button></div>`;
    openModal(html);
    $("#closeView").addEventListener("click", closeModal);
  }

  // ---- Attendance ----
  function getAttendance() { return load(KEY.ATT, {}); }
  function saveAttendance(att) { save(KEY.ATT, att); }

  function checkIn(user) {
    const att = getAttendance();
    if (!att[user.username]) att[user.username] = [];
    const today = new Date().toLocaleDateString();
    const existing = att[user.username].find(x => x.date === today);
    if (existing && existing.checkIn) return alert("Already checked in for today");
    const entry = existing || {date: today};
    entry.checkIn = Date.now();
    entry.checkOut = entry.checkOut || null;
    if (!existing) att[user.username].push(entry);
    saveAttendance(att);
    refreshAll();
    alert("Checked in at " + fmtTime(entry.checkIn));
  }

  function checkOut(user) {
    const att = getAttendance();
    const today = new Date().toLocaleDateString();
    const entries = att[user.username] || [];
    const entry = entries.find(x => x.date === today);
    if (!entry || !entry.checkIn) return alert("You haven't checked in yet");
    if (entry.checkOut) return alert("Already checked out");
    entry.checkOut = Date.now();
    saveAttendance(att);
    refreshAll();
    alert("Checked out at " + fmtTime(entry.checkOut));
  }

  function renderAttendanceTable(filter = "") {
    const att = getAttendance();
    const users = getUsers();
    const rows = [];
    Object.keys(att).forEach(username => {
      att[username].forEach(rec => {
        const user = users.find(u => u.username === username) || {name: username};
        const hours = rec.checkIn && rec.checkOut ? (((rec.checkOut - rec.checkIn) / (1000*60*60)).toFixed(2)) : "-";
        rows.push(`<tr>
          <td>${user.name || username}</td>
          <td>${rec.date}</td>
          <td>${fmtTime(rec.checkIn)}</td>
          <td>${fmtTime(rec.checkOut)}</td>
          <td>${hours}</td>
        </tr>`);
      });
    });
    attendanceTableBody.innerHTML = rows.join("") || `<tr><td colspan="5" class="muted">No attendance records</td></tr>`;
  }

  // ---- Leaves ----
  function getLeaves() { return load(KEY.LEAVES, []); }
  function saveLeaves(l) { save(KEY.LEAVES, l); }

  btnApplyLeave.addEventListener("click", () => {
    const current = getCurrentUser();
    if (!current) return alert("Not logged in");
    const date = leaveDate.value;
    const reason = leaveReason.value.trim();
    if (!date || !reason) { leaveMsg.textContent = "Fill date & reason"; leaveMsg.style.color = "#b91c1c"; return; }
    const leaves = getLeaves();
    leaves.push({user: current.username, date, reason, status: "Pending", appliedAt: new Date().toISOString()});
    saveLeaves(leaves);
    leaveMsg.textContent = "Applied";
    leaveMsg.style.color = "green";
    leaveDate.value = ""; leaveReason.value = "";
    refreshAll();
  });

  function renderLeavesTable() {
    const leaves = getLeaves();
    const users = getUsers();
    const current = getCurrentUser();
    const rows = leaves.map((L, idx) => {
      const user = users.find(u=>u.username===L.user) || {name:L.user};
      let actions = "";
      if (current && current.role === "admin") {
        if (L.status === "Pending") {
          actions = `<button class="btn small" data-act="approve" data-i="${idx}">Approve</button>
                     <button class="btn outline small" data-act="reject" data-i="${idx}">Reject</button>`;
        } else {
          actions = `<span class="muted">${L.status}</span>`;
        }
      } else {
        actions = `<span class="muted">${L.status}</span>`;
      }
      return `<tr>
        <td>${user.name}</td>
        <td>${L.date}</td>
        <td>${L.reason}</td>
        <td>${L.status}</td>
        <td>${actions}</td>
      </tr>`;
    }).join("");
    leaveTableBody.innerHTML = rows || `<tr><td colspan="5" class="muted">No leave requests</td></tr>`;

    // attach admin actions
    leaveTableBody.querySelectorAll("[data-act]").forEach(b => {
      b.addEventListener("click", () => {
        const i = Number(b.dataset.i);
        const act = b.dataset.act;
        const leaves = getLeaves();
        leaves[i].status = act === "approve" ? "Approved" : "Rejected";
        saveLeaves(leaves);
        refreshAll();
      });
    });
  }

  // ---- Salary calc ----
  function renderSalaryTable() {
    const settings = load(KEY.SETTINGS, defaultSettings);
    const workingDays = settings.workingDaysPerMonth || defaultSettings.workingDaysPerMonth;
    const users = getUsers();
    const att = getAttendance();
    const rows = users.map(u => {
      const records = (att[u.username] || []).length;
      const workedDays = records; // simple
      const calculated = ((u.salary || 0) * (workedDays / workingDays)).toFixed(2);
      return `<tr><td>${u.name}</td><td>${u.salary||0}</td><td>${workedDays}</td><td>${calculated}</td></tr>`;
    }).join("");
    salaryTableBody.innerHTML = rows || `<tr><td colspan="4" class="muted">No salary data</td></tr>`;
  }

  // ---- Reports ----
  function renderReports() {
    const leaves = getLeaves();
    const att = getAttendance();
    const users = getUsers();
    // attendance summary: count per user (this month) simplified
    const summary = users.map(u => {
      const count = (att[u.username] || []).length;
      return `${u.name}: ${count} day(s)`;
    }).join("<br/>");
    reportSummary.innerHTML = summary || "No data";

    const leavesSummary = leaves.reduce((acc,l) => {
      acc[l.status] = (acc[l.status]||0)+1; return acc;
    }, {});
    reportLeaves.innerHTML = Object.entries(leavesSummary).map(([k,v])=>`${k}: ${v}`).join("<br/>") || "No leaves";
  }

  // ---- settings ----
  btnSaveSettings.addEventListener("click", () => {
    const wd = Number(settingWorkingDays.value) || defaultSettings.workingDaysPerMonth;
    const wh = Number(settingWorkingHours.value) || defaultSettings.workingHoursPerDay;
    save(KEY.SETTINGS, {workingDaysPerMonth: wd, workingHoursPerDay: wh});
    settingsMsg.textContent = "Saved";
    setTimeout(()=>settingsMsg.textContent="",1400);
    refreshAll();
  });

  // ---- employee quick area (for employee view) ----
  function renderEmployeeQuick(user) {
    if (!user) { employeeQuick.innerHTML = ""; return; }
    if (user.role === "employee") {
      const att = getAttendance();
      const today = new Date().toLocaleDateString();
      const rec = (att[user.username] || []).find(x => x.date === today);
      const checkedIn = rec && rec.checkIn;
      const checkedOut = rec && rec.checkOut;
      employeeQuick.innerHTML = `
        <div class="muted">Today: ${today}</div>
        <div style="margin-top:8px">
          <button id="empCheckIn" class="btn small ${checkedIn? 'outline': 'primary'}">${checkedIn ? 'Checked In' : 'Check In'}</button>
          <button id="empCheckOut" class="btn small ${checkedOut? 'outline': 'primary'}" style="margin-left:8px">${checkedOut ? 'Checked Out' : 'Check Out'}</button>
          <span class="muted" style="margin-left:12px">Hours: ${rec && rec.checkIn && rec.checkOut ? (((rec.checkOut - rec.checkIn)/(1000*60*60)).toFixed(2)) : '-'}</span>
        </div>
      `;
      $("#empCheckIn").addEventListener("click", () => { if (!checkedIn) { checkIn(user); } else alert("Already checked in"); });
      $("#empCheckOut").addEventListener("click", () => { if (checkedIn && !checkedOut) checkOut(user); else alert("Either not checked in or already checked out"); });
    } else {
      employeeQuick.innerHTML = `<div class="muted">Admin quick: manage employees and approvals.</div>`;
    }
  }

  // ---- global refresh ----
  function refreshAll() {
    const current = getCurrentUser();
    ensureDemoData();
    renderTopUser(current || {name:'',role:''});
    renderEmployeesList(globalSearch.value || "");
    renderAttendanceTable();
    renderLeavesTable();
    renderSalaryTable();
    renderReports();
    renderStats();
    // update settings inputs
    const settings = load(KEY.SETTINGS, defaultSettings);
    settingWorkingDays.value = settings.workingDaysPerMonth;
    settingWorkingHours.value = settings.workingHoursPerDay;
    // check today status
    if (current) {
      const att = getAttendance();
      const today = new Date().toLocaleDateString();
      const rec = (att[current.username] || []).find(x => x.date === today);
      todayStatus.textContent = rec ? `Checked in: ${fmtTime(rec.checkIn)}  |  Checked out: ${fmtTime(rec.checkOut)}` : "Not checked in today";
    }
  }

  function renderStats() {
    const users = getUsers();
    const leaves = getLeaves();
    const att = getAttendance();
    statTotal.textContent = users.length;
    // present today
    const today = new Date().toLocaleDateString();
    const present = Object.keys(att).reduce((s,k) => s + (att[k].find(r => r.date === today && r.checkIn ? 1 : 0), 0), 0);
    // above reduce uses comma operator incorrectly; do proper
    let presentCount = 0;
    Object.keys(att).forEach(u => { if (att[u].find(r => r.date === today && r.checkIn)) presentCount++; });
    statPresent.textContent = presentCount;
    const pendingLeaves = leaves.filter(l => l.status === "Pending").length;
    statLeaves.textContent = pendingLeaves;
  }

  // ---- search handler ----
  globalSearch.addEventListener("input", (e) => {
    renderEmployeesList(e.target.value);
  });

  // ---- attendance buttons for employee view ----
  btnCheckIn.addEventListener("click", () => {
    const user = getCurrentUser();
    if (!user) return alert("Login first");
    checkIn(user);
  });
  btnCheckOut.addEventListener("click", () => {
    const user = getCurrentUser();
    if (!user) return alert("Login first");
    checkOut(user);
  });

  // ---- init app ----
  function init() {
    ensureDemoData();
    const cur = getCurrentUser();
    if (cur) {
      showApp();
      bootAppForUser(cur);
    } else {
      showLogin();
    }
  }

  init();

})();
