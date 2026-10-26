/**
 * api.js
 * ---------------------------------------------------------------------------
 * Front-end API client. Every function returns a plain JS object/throws an
 * Error with a human-readable message, so UI code never has to think about
 * fetch/response plumbing.
 * ---------------------------------------------------------------------------
 */
const Api = (function () {
  async function request(url, options) {
    const res = await mockFetch(url, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Something went wrong. Please try again.");
    }
    return data;
  }

  return {
    login(username, password) {
      return request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
    },

    registerPatient(patient) {
      return request("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patient),
      });
    },

    getPatients() {
      return request("/api/patients", { method: "GET" });
    },

    updatePatient(id, patch) {
      return request(`/api/patients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },

    scheduleAppointment(appointment) {
      return request("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointment),
      });
    },

    getAppointments() {
      return request("/api/appointments", { method: "GET" });
    },

    updateAppointment(id, patch) {
      return request(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    },
  };
})();
