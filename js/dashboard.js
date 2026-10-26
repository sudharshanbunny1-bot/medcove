(function () {
  // ---- Auth guard ----------------------------------------------------
  const token = sessionStorage.getItem("hms_token") || localStorage.getItem("hms_token");
  const userRaw = sessionStorage.getItem("hms_user") || localStorage.getItem("hms_user");
  if (!token || !userRaw) {
    window.location.href = "index.html";
    return;
  }
  const user = JSON.parse(userRaw);
  const role = user.role; // "Admin" | "Doctor" | "Patient"
  document.getElementById("userName").textContent = user.name;
  document.getElementById("userRole").textContent = user.role;
  document.getElementById("userAvatar").textContent = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ---- Role-based layout ---------------------------------------------
  const NAV_VISIBILITY = {
    Admin: ["overview", "register", "schedule", "appointments"],
    Doctor: ["overview", "register", "appointments"],
    Patient: ["overview", "register", "schedule", "appointments"],
  };
  document.querySelectorAll(".sidenav button").forEach((btn) => {
    if (!NAV_VISIBILITY[role].includes(btn.dataset.panel)) {
      btn.style.display = "none";
    }
  });

  const PANEL_COPY = {
    Admin: {
      registerHeading: "Register a patient",
      registerDesc: "Creates a new patient record via the patient registration API.",
      patientsListHeading: "Recently registered",
      patientsListSub: "Pulled live from the patients API.",
      scheduleHeading: "Schedule an appointment",
      scheduleDesc: "Books a visit via the appointment scheduling API and checks for doctor/slot conflicts.",
      appointmentsHeading: "Appointments",
      appointmentsDesc: "All scheduled visits, newest first.",
    },
    Doctor: {
      registerHeading: "Patients",
      registerDesc: "Read-only view of patient records. Doctors cannot add or change patient data.",
      appointmentsHeading: "Your appointments",
      appointmentsDesc: "Visits scheduled with you, newest first. Read-only.",
    },
    Patient: {
      registerHeading: "My health record",
      registerDesc: "View and update your own patient record.",
      scheduleHeading: "Book an appointment",
      scheduleDesc: "Books a visit for you and checks for doctor/slot conflicts.",
      appointmentsHeading: "My appointments",
      appointmentsDesc: "Visits you've booked, newest first.",
    },
  };
  Object.entries(PANEL_COPY[role]).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  if (role === "Doctor") {
    document.getElementById("registerFormCard").style.display = "none";
  }
  if (role === "Patient") {
    document.getElementById("patientsListCard").style.display = "none";
    document.getElementById("registerBtnLabel").textContent = "Save changes";
  }

  document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("hms_token");
    sessionStorage.removeItem("hms_user");
    localStorage.removeItem("hms_token");
    localStorage.removeItem("hms_user");
    window.location.href = "index.html";
  });

  // ---- Toasts ----------------------------------------------------------
  function toast(message, type = "success") {
    const stack = document.getElementById("toastStack");
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  // ---- Nav / panel switching --------------------------------------------
  const navButtons = document.querySelectorAll(".sidenav button");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      navButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      document.getElementById(`panel-${btn.dataset.panel}`).classList.add("active");
      if (btn.dataset.panel === "appointments") loadAppointments();
      if (btn.dataset.panel === "overview") refreshStats();
    });
  });

  // ---- Shared helpers ----------------------------------------------------
  function setError(fieldEl, hasError) {
    fieldEl.classList.toggle("has-error", hasError);
  }
  function showBanner(el, message) {
    el.textContent = message;
    el.classList.add("show");
  }
  function hideBanner(el) {
    el.classList.remove("show");
  }
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }
  function isValidPhone(v) {
    return /^[0-9+\-\s()]{7,15}$/.test(v);
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // =========================================================================
  // PATIENT REGISTRATION
  // =========================================================================
  const registerForm = document.getElementById("registerForm");
  const registerBanner = document.getElementById("registerBanner");
  const registerBtn = document.getElementById("registerBtn");
  const registerBtnLabel = document.getElementById("registerBtnLabel");

  const regFields = {
    name: document.getElementById("reg-name"),
    age: document.getElementById("reg-age"),
    gender: document.getElementById("reg-gender"),
    blood: document.getElementById("reg-blood"),
    phone: document.getElementById("reg-phone"),
    email: document.getElementById("reg-email"),
    address: document.getElementById("reg-address"),
  };

  function validateRegisterForm() {
    let valid = true;
    const checks = [
      [regFields.name, document.getElementById("reg-name-field"), regFields.name.value.trim().length >= 2],
      [regFields.age, document.getElementById("reg-age-field"), regFields.age.value !== "" && regFields.age.value >= 0 && regFields.age.value <= 120],
      [regFields.gender, document.getElementById("reg-gender-field"), regFields.gender.value !== ""],
      [regFields.phone, document.getElementById("reg-phone-field"), isValidPhone(regFields.phone.value.trim())],
    ];
    checks.forEach(([, fieldEl, ok]) => {
      setError(fieldEl, !ok);
      if (!ok) valid = false;
    });
    // optional email, validate format only if provided
    const emailField = document.getElementById("reg-email-field");
    if (regFields.email.value.trim() && !isValidEmail(regFields.email.value.trim())) {
      setError(emailField, true);
      valid = false;
    } else {
      setError(emailField, false);
    }
    return valid;
  }

  Object.values(regFields).forEach((input) => {
    input.addEventListener("input", () => {
      const fieldEl = input.closest(".field");
      if (fieldEl) setError(fieldEl, false);
    });
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner(registerBanner);
    if (!validateRegisterForm()) return;

    registerBtn.disabled = true;
    registerBtnLabel.innerHTML = '<span class="spinner"></span> Saving&hellip;';
    const patientPayload = {
      name: regFields.name.value.trim(),
      age: regFields.age.value,
      gender: regFields.gender.value,
      bloodGroup: regFields.blood.value,
      phone: regFields.phone.value.trim(),
      email: regFields.email.value.trim(),
      address: regFields.address.value.trim(),
    };
    try {
      if (role === "Patient" && user.patientId) {
        await Api.updatePatient(user.patientId, patientPayload);
        toast("Your health record was updated.", "success");
      } else {
        const { patient } = await Api.registerPatient(patientPayload);
        toast(`${patient.name} registered as ${patient.id}.`, "success");
        registerForm.reset();
      }
      await loadPatients();
      await populatePatientSelect();
      refreshStats();
    } catch (err) {
      showBanner(registerBanner, err.message);
    } finally {
      registerBtn.disabled = false;
      registerBtnLabel.textContent = role === "Patient" ? "Save changes" : "Register patient";
    }
  });

  // Patients edit their own pre-existing record instead of starting blank.
  async function prefillOwnRecord() {
    if (role !== "Patient") return;
    const { patients } = await Api.getPatients();
    const own = patients[0];
    if (!own) return;
    regFields.name.value = own.name || "";
    regFields.age.value = own.age || "";
    regFields.gender.value = own.gender || "";
    regFields.blood.value = own.bloodGroup || "";
    regFields.phone.value = own.phone || "";
    regFields.email.value = own.email || "";
    regFields.address.value = own.address || "";
  }

  async function loadPatients() {
    const { patients } = await Api.getPatients();
    const tbody = document.querySelector("#patientsTable tbody");
    const empty = document.getElementById("patientsEmpty");
    tbody.innerHTML = "";
    empty.style.display = patients.length ? "none" : "block";
    patients.slice(0, 20).forEach((p) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="id-cell">${p.id}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.age)}</td>
        <td>${escapeHtml(p.gender)}</td>
        <td>${escapeHtml(p.phone)}</td>
        <td>${escapeHtml(p.bloodGroup || "&mdash;")}</td>`;
      tbody.appendChild(tr);
    });
    return patients;
  }

  async function populatePatientSelect() {
    const { patients } = await Api.getPatients();
    const select = document.getElementById("sch-patient");
    const current = select.value;
    select.innerHTML = '<option value="">Select a registered patient&hellip;</option>';
    patients.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = `${p.id}|${p.name}`;
      opt.textContent = `${p.name} (${p.id})`;
      select.appendChild(opt);
    });
    if (role === "Patient") {
      // Patients can only ever book for themselves — lock the field to their own record.
      if (patients[0]) select.value = `${patients[0].id}|${patients[0].name}`;
      select.disabled = true;
    } else if (current) {
      select.value = current;
    }
  }

  // =========================================================================
  // APPOINTMENT SCHEDULING
  // =========================================================================
  const scheduleForm = document.getElementById("scheduleForm");
  const scheduleBanner = document.getElementById("scheduleBanner");
  const scheduleBtn = document.getElementById("scheduleBtn");
  const scheduleBtnLabel = document.getElementById("scheduleBtnLabel");

  const schFields = {
    patient: document.getElementById("sch-patient"),
    department: document.getElementById("sch-department"),
    doctor: document.getElementById("sch-doctor"),
    date: document.getElementById("sch-date"),
    time: document.getElementById("sch-time"),
    reason: document.getElementById("sch-reason"),
  };
  // restrict date picker to today or later
  schFields.date.min = new Date().toISOString().split("T")[0];

  function validateScheduleForm() {
    let valid = true;
    const today = new Date().toISOString().split("T")[0];
    const checks = [
      [schFields.patient, document.getElementById("sch-patient-field"), schFields.patient.value !== ""],
      [schFields.department, document.getElementById("sch-department-field"), schFields.department.value !== ""],
      [schFields.doctor, document.getElementById("sch-doctor-field"), schFields.doctor.value !== ""],
      [schFields.date, document.getElementById("sch-date-field"), schFields.date.value !== "" && schFields.date.value >= today],
      [schFields.time, document.getElementById("sch-time-field"), schFields.time.value !== ""],
    ];
    checks.forEach(([, fieldEl, ok]) => {
      setError(fieldEl, !ok);
      if (!ok) valid = false;
    });
    return valid;
  }

  Object.values(schFields).forEach((input) => {
    input.addEventListener("input", () => {
      const fieldEl = input.closest(".field");
      if (fieldEl) setError(fieldEl, false);
    });
    input.addEventListener("change", () => {
      const fieldEl = input.closest(".field");
      if (fieldEl) setError(fieldEl, false);
    });
  });

  scheduleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideBanner(scheduleBanner);
    if (!validateScheduleForm()) return;

    const [patientId, patientName] = schFields.patient.value.split("|");

    scheduleBtn.disabled = true;
    scheduleBtnLabel.innerHTML = '<span class="spinner"></span> Booking&hellip;';
    try {
      const { appointment } = await Api.scheduleAppointment({
        patientId,
        patientName,
        department: schFields.department.value,
        doctor: schFields.doctor.value,
        date: schFields.date.value,
        time: schFields.time.value,
        reason: schFields.reason.value.trim(),
      });
      toast(`Appointment ${appointment.id} booked with ${appointment.doctor}.`, "success");
      scheduleForm.reset();
      schFields.date.min = new Date().toISOString().split("T")[0];
      await loadAppointments();
      refreshStats();
    } catch (err) {
      showBanner(scheduleBanner, err.message);
    } finally {
      scheduleBtn.disabled = false;
      scheduleBtnLabel.textContent = "Schedule appointment";
    }
  });

  async function loadAppointments() {
    const { appointments } = await Api.getAppointments();
    const tbody = document.querySelector("#appointmentsTable tbody");
    const empty = document.getElementById("appointmentsEmpty");
    tbody.innerHTML = "";
    empty.style.display = appointments.length ? "none" : "block";
    appointments.forEach((a) => {
      const badgeClass =
        a.status === "Cancelled" ? "badge-cancelled" : a.status === "Completed" ? "badge-completed" : "badge-scheduled";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="id-cell">${a.id}</td>
        <td>${escapeHtml(a.patientName)}</td>
        <td>${escapeHtml(a.department)}</td>
        <td>${escapeHtml(a.doctor)}</td>
        <td>${escapeHtml(a.date)}</td>
        <td>${escapeHtml(a.time)}</td>
        <td><span class="badge ${badgeClass}">${a.status}</span></td>
        <td>${a.status === "Scheduled" && role !== "Doctor" ? `<button class="btn btn-ghost btn-sm" data-cancel="${a.id}">Cancel</button>` : ""}</td>`;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Cancelling&hellip;";
        try {
          await Api.updateAppointment(btn.dataset.cancel, { status: "Cancelled" });
          toast(`Appointment ${btn.dataset.cancel} cancelled.`, "success");
          await loadAppointments();
          refreshStats();
        } catch (err) {
          toast(err.message, "error");
        }
      });
    });

    return appointments;
  }

  document.getElementById("refreshAppointments").addEventListener("click", loadAppointments);

  // =========================================================================
  // OVERVIEW STATS
  // =========================================================================
  const STAT_LABELS = {
    Admin: {
      statPatientsLabel: "Registered patients",
      statAppointmentsLabel: "Total appointments",
      statUpcomingLabel: "Scheduled (upcoming)",
      statCancelledLabel: "Cancelled",
    },
    Doctor: {
      statPatientsLabel: "Patients you can view",
      statAppointmentsLabel: "Your appointments",
      statUpcomingLabel: "Your upcoming visits",
      statCancelledLabel: "Your cancelled visits",
    },
    Patient: {
      statPatientsLabel: "Health record on file",
      statAppointmentsLabel: "Your appointments",
      statUpcomingLabel: "Upcoming",
      statCancelledLabel: "Cancelled",
    },
  };
  Object.entries(STAT_LABELS[role]).forEach(([id, text]) => {
    document.getElementById(id).textContent = text;
  });

  async function refreshStats() {
    const [{ patients }, { appointments }] = await Promise.all([Api.getPatients(), Api.getAppointments()]);
    document.getElementById("statPatients").textContent = patients.length;
    document.getElementById("statAppointments").textContent = appointments.length;
    document.getElementById("statUpcoming").textContent = appointments.filter((a) => a.status === "Scheduled").length;
    document.getElementById("statCancelled").textContent = appointments.filter((a) => a.status === "Cancelled").length;
  }

  // ---- Initial load ------------------------------------------------------
  (async function init() {
    await Promise.all([loadPatients(), populatePatientSelect(), loadAppointments(), prefillOwnRecord()]);
    await refreshStats();
  })();
})();
