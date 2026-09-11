// Problem categories & specific problem types.
// Kept as plain data so Admins can extend this later via the Admin Panel
// (see db.js -> Categories store) without touching app logic.
window.KDM_CATEGORIES = [
  {
    id: 'technical',
    label: 'TECHNICAL / BREAKDOWN',
    bn: 'টেকনিক্যাল',
    icon: '🔧',
    items: [
      'Cylinder Problem', 'Dial Problem', 'Cam Problem', 'Needle Bed Problem',
      'Sinker Problem', 'Bearing Problem', 'Gear Problem', 'Belt Problem',
      'Motor Problem', 'Inverter / VFD Problem', 'Sensor Problem', 'Feeder Problem',
      'Take-down Problem', 'Control Panel Problem', 'Machine Alarm',
      'Machine Overheating', 'Excessive Vibration', 'Other Major Breakdown'
    ]
  },
  {
    id: 'yarn',
    label: 'YARN / LYCRA',
    bn: 'সুতা / লাইক্রা',
    icon: '🧵',
    items: [
      'Yarn Shortage', 'Yarn Quality Problem', 'Multiple Yarn Break', 'Yarn Change',
      'Yarn Lot Change', 'Yarn Count Change', 'Lycra Shortage', 'Lycra Break',
      'Lycra Feeder Problem', 'Yarn Tension Problem', 'Other Major Yarn Problem'
    ]
  },
  {
    id: 'quality',
    label: 'QUALITY / FABRIC',
    bn: 'কোয়ালিটি',
    icon: '🧶',
    items: [
      'Fabric Hole', 'Needle Line', 'Drop Stitch', 'Barre', 'Streak',
      'Oil Contamination', 'Lycra Defect', 'GSM Out of Range', 'Width Out of Range',
      'Fabric Structure Problem', 'Repeated Fabric Defect', 'Quality Inspection', 'Quality Hold'
    ]
  },
  {
    id: 'setting',
    label: 'MACHINE SETTING',
    bn: 'সেটিং',
    icon: '⚙️',
    items: [
      'New Style Setting', 'Order Change', 'GSM Change', 'Stitch Length Setting',
      'Cam Setting', 'Feeder Setting', 'Yarn Tension Setting', 'Lycra Setting',
      'Take-down Setting', 'Pattern / Design Change', 'Machine Reset', 'Trial Production'
    ]
  },
  {
    id: 'maintenance',
    label: 'MAINTENANCE',
    bn: 'মেরামত',
    icon: '🛠️',
    items: [
      'Preventive Maintenance', 'Breakdown Maintenance', 'Mechanical Maintenance',
      'Electrical Maintenance', 'Machine Servicing', 'Needle Replacement',
      'Sinker Replacement', 'Cam Replacement', 'Bearing Replacement',
      'Sensor Replacement', 'Feeder Servicing', 'Take-down Servicing', 'Deep Cleaning'
    ]
  },
  {
    id: 'power',
    label: 'POWER / UTILITY',
    bn: 'বিদ্যুৎ',
    icon: '⚡',
    items: [
      'Power Failure', 'Low Voltage', 'High Voltage', 'Voltage Fluctuation',
      'Generator Problem', 'Transformer Problem', 'Electrical Panel Problem',
      'Compressor Problem', 'Low Air Pressure', 'Utility Shutdown'
    ]
  },
  {
    id: 'material',
    label: 'MATERIAL / STORE',
    bn: 'মালামাল',
    icon: '📦',
    items: [
      'Yarn Not Available', 'Lycra Not Available', 'Material Shortage',
      'Wrong Material', 'Material Delivery Delay', 'Yarn Approval Pending'
    ]
  },
  {
    id: 'production',
    label: 'PRODUCTION / ORDER',
    bn: 'প্রোডাকশন',
    icon: '📋',
    items: [
      'No Production Plan', 'Order Finished', 'Waiting for Next Order',
      'Order Change', 'Production Hold', 'Buyer Requirement Change', 'Grey Fabric Stock Full'
    ]
  },
  {
    id: 'manpower',
    label: 'OPERATOR / MANPOWER',
    bn: 'জনবল',
    icon: '👤',
    items: [
      'Operator Absent', 'Operator Shortage', 'Operator Training', 'Shift Change Gap', 'Operator Break'
    ]
  },
  {
    id: 'factory',
    label: 'FACTORY / MANAGEMENT',
    bn: 'ফ্যাক্টরি',
    icon: '🏭',
    items: [
      'Factory Holiday', 'Special Holiday', 'Production Shutdown',
      'Factory Maintenance Shutdown', 'Buyer Inspection', 'Audit', 'Fire Drill',
      'Management Instruction', 'Meeting', 'Approval Pending'
    ]
  },
  {
    id: 'emergency',
    label: 'EMERGENCY',
    bn: 'জরুরি',
    icon: '🚨',
    items: [
      'Fire Emergency', 'Electrical Emergency', 'Water Leakage',
      'Safety Emergency', 'Natural Disaster', 'Other Emergency'
    ]
  }
];
