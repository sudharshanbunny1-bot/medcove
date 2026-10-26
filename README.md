# MedCove &mdash; Hospital Management System

> **Live Demo**: [https://agent-6a671dd33be--vermillion-biscochitos-e233bb.netlify.app](https://agent-6a671dd33be--vermillion-biscochitos-e233bb.netlify.app)

MedCove is a modern, fast, and accessible Hospital Operations and Clinic Management portal built for front-desk receptionists, doctors, and patients. It streamlines patient registration, appointment scheduling with real-time conflict checking, and department workload monitoring.

---

## Features

- **Role-Based Access Control (RBAC)**: Dedicated interfaces and permissions for Admin, Doctor, and Patient roles.
- **Patient Registration**: Capture comprehensive patient records (Name, Age, Gender, Blood Group, Phone, Emergency Contact, Medical History).
- **Intelligent Appointment Scheduling**:
  - Filter by medical department and doctor.
  - Automatic collision and slot conflict prevention.
  - Rescheduling and cancellation workflows.
- **Operations Dashboard**:
  - Live summary of total patients, upcoming appointments, and cancelled visits.
  - Responsive layout optimized for tablets and desktops.
- **Zero-Dependency Architecture**: Pure Vanilla JavaScript with mock API persistence using browser LocalStorage and SessionStorage.

---

## Demo Login Credentials

| Role | Username | Password | Access Scope |
|---|---|---|---|
| **Admin** | `Adm@123` | `Adm123` | Full control: Register patients, schedule visits, manage all appointments |
| **Doctor** | `Doc@123` | `Doc123` | Clinical view: Read-only patient records, view assigned appointment queue |
| **Patient** | `Pat@123` | `Pat123` | Patient portal: View own health record, book and cancel personal visits |

---

## Project Structure

```text
medcove/
├── index.html           # Authentication portal (Sign-in page)
├── dashboard.html       # Operations dashboard with modular panels
├── css/
│   └── styles.css       # Design system, CSS custom properties, responsive layout
├── js/
│   ├── mockApi.js       # In-memory mock database & API service with LocalStorage sync
│   ├── api.js           # Client API layer handling network requests and error handling
│   ├── login.js         # Authentication validation, password toggle, session storage
│   └── dashboard.js     # Panel routing, form validation, dynamic tables, toast alerts
└── README.md            # Project documentation and usage guide
```

---

## Quick Start (Run Locally)

No build tools or external package managers required!

1. Clone the repository:
   ```bash
   git clone https://github.com/sudharshanbunny1-bot/medcove.git
   cd medcove
   ```

2. Open in your browser:
   - Double click `index.html` or open via any local server:
   ```bash
   # Python
   python -m http.server 3000

   # Or npx serve
   npx serve .
   ```
3. Visit `http://localhost:3000` in your web browser.
