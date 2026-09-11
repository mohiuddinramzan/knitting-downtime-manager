// Demo/seed data used the very first time the app runs (fresh install / fresh browser storage).
// Admins can add real users & machines from the Admin Panel afterwards -
// this is only here so the app is immediately usable for a demo/pilot.
window.KDM_RESOLUTIONS = [
  'Repaired', 'Part Replaced', 'Setting Corrected', 'Yarn Changed',
  'Maintenance Completed', 'Quality Issue Corrected', 'Other'
];

window.KDM_SHIFTS = ['A Shift', 'B Shift', 'C Shift', 'General / Day Shift'];

window.KDM_SEED = {
  users: [
    { id: 'ADMIN1', name: 'Factory Admin', pin: '0000', role: 'ADMIN', shift: 'General / Day Shift', active: true },
    { id: 'SUP01', name: 'Karim (Supervisor)', pin: '1111', role: 'SUPERVISOR', shift: 'A Shift', active: true },
    { id: 'TECH05', name: 'Jamal (Technician)', pin: '2222', role: 'TECHNICIAN', shift: 'A Shift', active: true },
    { id: 'OP101', name: 'Rahim', pin: '1010', role: 'OPERATOR', shift: 'A Shift', active: true },
    { id: 'OP102', name: 'Kamal', pin: '1020', role: 'OPERATOR', shift: 'A Shift', active: true },
    { id: 'OP103', name: 'Salma', pin: '1030', role: 'OPERATOR', shift: 'A Shift', active: true }
  ],
  machines: [
    { id: 'K-101', model: 'Mayer & Cie Relanit', order: '34/1 Polyester + Lycra', status: 'GREEN' },
    { id: 'K-102', model: 'Mayer & Cie Relanit', order: '30/1 Cotton', status: 'GREEN' },
    { id: 'K-103', model: 'Fukuhara SC', order: '24/1 CVC', status: 'GREEN' },
    { id: 'K-117', model: 'Terrot S296', order: '20/1 Cotton Lycra', status: 'GREEN' },
    { id: 'K-132', model: 'Pai Lung PL-6', order: 'Pique 180gsm', status: 'GREEN' },
    { id: 'K-109', model: 'Mayer & Cie Relanit', order: 'Single Jersey 160gsm', status: 'GREEN' }
  ],
  // machine -> operatorId, per shift
  assignments: {
    'A Shift': { 'K-101': 'OP101', 'K-102': 'OP102', 'K-103': 'OP103', 'K-117': 'OP101', 'K-132': 'OP102', 'K-109': 'OP103' },
    'B Shift': {},
    'C Shift': {},
    'General / Day Shift': {}
  }
};
