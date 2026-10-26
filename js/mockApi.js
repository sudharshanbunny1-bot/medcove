/**
 * mockApi.js
 * ---------------------------------------------------------------------------
 * A self-contained "fake backend" that behaves like a real REST API.
 * `mockFetch(url, options)` mirrors the native fetch() signature and returns
 * a Response-like object ({ ok, status, json() }) after a simulated network
 * delay. Swap the body of mockFetch for a real fetch() call to a live
 * backend and the rest of the app (api.js) does not need to change -
 * see the "Going to production" note at the bottom of this file.
 *
 * Role model: every user has a role of "Admin", "Doctor", or "Patient".
 * Admin can read/write everything. Doctor is read-only (can view all
 * patients and their own appointments, keyed by matching doctor name).
 * Patient can only read/write their own patient record (linked via
 * user.patientId) and their own appointments (keyed by patientId).
 * ---------------------------------------------------------------------------
 */

(function (global) {
  const LATENCY_MS = [500, 950]; // simulated network round-trip range

  const DB_KEYS = {
    users: "hms_users",
    patients: "hms_patients",
    appointments: "hms_appointments",
    session: "hms_session",
  };

  // ---- seed data (only runs once) -----------------------------------------
  function seed() {
    if (!localStorage.getItem(DB_KEYS.users)) {
      localStorage.setItem(
        DB_KEYS.users,
        JSON.stringify([
          {
            id: 1,
            name: "Dr. Aditi Rao",
            username: "Doc@123",
            password: "Doc123",
            role: "Doctor",
          },
          {
            id: 2,
            name: "Front Desk Admin",
            username: "Adm@123",
            password: "Adm123",
            role: "Admin",
          },
          {
            id: 3,
            name: "Rahul Verma",
            username: "Pat@123",
            password: "Pat123",
            role: "Patient",
            patientId: "PT-0001",
          },
        ])
      );
    }
    if (!localStorage.getItem(DB_KEYS.patients)) {
      localStorage.setItem(
        DB_KEYS.patients,
        JSON.stringify([
          {
            id: "PT-0001",
            createdAt: new Date(0).toISOString(),
            name: "Rahul Verma",
            age: "29",
            gender: "Male",
            bloodGroup: "B+",
            phone: "+91 90000 00000",
            email: "",
            address: "",
          },
        ])
      );
    }
    if (!localStorage.getItem(DB_KEYS.appointments)) {
      localStorage.setItem(DB_KEYS.appointments, JSON.stringify([]));
    }
  }
  seed();

  function read(key) {
    return JSON.parse(localStorage.getItem(key) || "[]");
  }
  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function delay() {
    const [min, max] = LATENCY_MS;
    return new Promise((res) => setTimeout(res, min + Math.random() * (max - min)));
  }
  function response(status, body) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  }
  function nextId(prefix, list) {
    const n = list.length + 1;
    return `${prefix}-${String(n).padStart(4, "0")}`;
  }
  function fakeToken(username) {
    return btoa(`${username}:${Date.now()}`);
  }

  // ---- current session --------------------------------------------------
  // This mock has no real network boundary, so "who is calling" is derived
  // from the same browser storage the login/dashboard pages already read.
  function getCurrentUser() {
    const raw = sessionStorage.getItem("hms_user") || localStorage.getItem("hms_user");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  function forbidden(message) {
    return response(403, { message });
  }

  /**
   * mockFetch(url, options)
   * Supported routes:
   *  POST   /api/auth/login
   *  POST   /api/patients
   *  GET    /api/patients
   *  PATCH  /api/patients/:id
   *  POST   /api/appointments
   *  GET    /api/appointments
   *  PATCH  /api/appointments/:id
   */
  async function mockFetch(url, options = {}) {
    await delay();
    const method = (options.method || "GET").toUpperCase();
    let payload = {};
    if (options.body) {
      try {
        payload = JSON.parse(options.body);
      } catch (e) {
        return response(400, { message: "Malformed request body." });
      }
    }

    // ---- AUTH ---------------------------------------------------------
    if (url === "/api/auth/login" && method === "POST") {
      const { username, password } = payload;
      const users = read(DB_KEYS.users);
      const user = users.find(
        (u) => u.username.toLowerCase() === String(username).toLowerCase()
      );
      if (!user || user.password !== password) {
        return response(401, { message: "Invalid username or password." });
      }
      const token = fakeToken(user.username);
      const { password: _pw, ...safeUser } = user;
      return response(200, { token, user: safeUser });
    }

    const currentUser = getCurrentUser();

    // ---- PATIENTS -------------------------------------------------------
    if (url === "/api/patients" && method === "POST") {
      if (!currentUser) return response(401, { message: "Please sign in." });
      if (currentUser.role === "Doctor") {
        return forbidden("Doctors have read-only access to patient records.");
      }
      if (currentUser.role === "Patient" && currentUser.patientId) {
        return forbidden("Your record already exists. Use update instead of creating a new one.");
      }
      const required = ["name", "age", "gender", "phone"];
      const missing = required.filter((f) => !payload[f]);
      if (missing.length) {
        return response(422, { message: `Missing required field(s): ${missing.join(", ")}` });
      }
      const patients = read(DB_KEYS.patients);
      const patient = {
        id: nextId("PT", patients),
        createdAt: new Date().toISOString(),
        ...payload,
      };
      patients.unshift(patient);
      write(DB_KEYS.patients, patients);

      // A patient signing up for the first time gets linked to their new record.
      if (currentUser.role === "Patient") {
        const users = read(DB_KEYS.users);
        const idx = users.findIndex((u) => u.username === currentUser.username);
        if (idx !== -1) {
          users[idx].patientId = patient.id;
          write(DB_KEYS.users, users);
        }
      }
      return response(201, { message: "Patient registered successfully.", patient });
    }

    if (url === "/api/patients" && method === "GET") {
      if (!currentUser) return response(401, { message: "Please sign in." });
      const patients = read(DB_KEYS.patients);
      if (currentUser.role === "Patient") {
        return response(200, { patients: patients.filter((p) => p.id === currentUser.patientId) });
      }
      return response(200, { patients });
    }

    if (url.startsWith("/api/patients/") && method === "PATCH") {
      if (!currentUser) return response(401, { message: "Please sign in." });
      if (currentUser.role === "Doctor") {
        return forbidden("Doctors have read-only access to patient records.");
      }
      const id = url.split("/").pop();
      if (currentUser.role === "Patient" && id !== currentUser.patientId) {
        return forbidden("You can only update your own health record.");
      }
      const patients = read(DB_KEYS.patients);
      const idx = patients.findIndex((p) => p.id === id);
      if (idx === -1) return response(404, { message: "Patient not found." });
      patients[idx] = { ...patients[idx], ...payload, id: patients[idx].id };
      write(DB_KEYS.patients, patients);
      return response(200, { patient: patients[idx] });
    }

    // ---- APPOINTMENTS ---------------------------------------------------
    if (url === "/api/appointments" && method === "POST") {
      if (!currentUser) return response(401, { message: "Please sign in." });
      if (currentUser.role === "Doctor") {
        return forbidden("Doctors cannot book appointments.");
      }
      if (currentUser.role === "Patient" && !currentUser.patientId) {
        return forbidden("Add your health record before booking an appointment.");
      }
      // Patients can only ever book for themselves, regardless of what the form sends.
      if (currentUser.role === "Patient") {
        const patients = read(DB_KEYS.patients);
        const own = patients.find((p) => p.id === currentUser.patientId);
        payload = { ...payload, patientId: currentUser.patientId, patientName: own ? own.name : currentUser.name };
      }
      const required = ["patientName", "department", "doctor", "date", "time"];
      const missing = required.filter((f) => !payload[f]);
      if (missing.length) {
        return response(422, { message: `Missing required field(s): ${missing.join(", ")}` });
      }
      const appointments = read(DB_KEYS.appointments);
      const clash = appointments.find(
        (a) =>
          a.doctor === payload.doctor &&
          a.date === payload.date &&
          a.time === payload.time &&
          a.status !== "Cancelled"
      );
      if (clash) {
        return response(409, {
          message: `${payload.doctor} already has an appointment at ${payload.time} on ${payload.date}. Please choose another slot.`,
        });
      }
      const appointment = {
        id: nextId("AP", appointments),
        status: "Scheduled",
        createdAt: new Date().toISOString(),
        ...payload,
      };
      appointments.unshift(appointment);
      write(DB_KEYS.appointments, appointments);
      return response(201, { message: "Appointment scheduled successfully.", appointment });
    }

    if (url === "/api/appointments" && method === "GET") {
      if (!currentUser) return response(401, { message: "Please sign in." });
      const appointments = read(DB_KEYS.appointments);
      if (currentUser.role === "Doctor") {
        return response(200, { appointments: appointments.filter((a) => a.doctor === currentUser.name) });
      }
      if (currentUser.role === "Patient") {
        return response(200, { appointments: appointments.filter((a) => a.patientId === currentUser.patientId) });
      }
      return response(200, { appointments });
    }

    if (url.startsWith("/api/appointments/") && method === "PATCH") {
      if (!currentUser) return response(401, { message: "Please sign in." });
      if (currentUser.role === "Doctor") {
        return forbidden("Doctors cannot modify appointments.");
      }
      const id = url.split("/").pop();
      const appointments = read(DB_KEYS.appointments);
      const idx = appointments.findIndex((a) => a.id === id);
      if (idx === -1) return response(404, { message: "Appointment not found." });
      if (currentUser.role === "Patient" && appointments[idx].patientId !== currentUser.patientId) {
        return forbidden("You can only modify your own appointments.");
      }
      appointments[idx] = { ...appointments[idx], ...payload };
      write(DB_KEYS.appointments, appointments);
      return response(200, { appointment: appointments[idx] });
    }

    return response(404, { message: `No mock route for ${method} ${url}` });
  }

  global.mockFetch = mockFetch;
  global.HMS_DB_KEYS = DB_KEYS;
})(window);

/**
 * Going to production
 * ---------------------------------------------------------------------------
 * Replace calls to `mockFetch(url, options)` inside js/api.js with the native
 * `fetch(BASE_URL + url, options)` where BASE_URL points at your real
 * backend (e.g. https://api.yourhospital.com). Because mockFetch already
 * mirrors the fetch Response contract (ok/status/json()), no other file in
 * this project needs to change. In production, role checks currently done
 * against browser storage (getCurrentUser) must be re-derived server-side
 * from the authenticated session/token instead.
 */
