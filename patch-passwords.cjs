const fs = require('fs');

// Fix Invoice.jsx
let inv = fs.readFileSync('C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Invoice.jsx', 'utf8');
// Fix import - remove unused useRef
inv = inv.replace(
  'import { useState, useMemo, useRef } from "react";',
  'import { useState, useMemo } from "react";'
);
// Add auth import after existing imports
inv = inv.replace(
  'import { todayStr, money, maxId } from "../utils/helpers";',
  'import { todayStr, money, maxId } from "../utils/helpers";\nimport { checkAdminPassword } from "../utils/auth";'
);
// Fix password check
inv = inv.replace(
  'if (pwInput !== "admin123") { notify("Incorrect password","error"); return; }',
  'if (!checkAdminPassword(pwInput)) { notify("Incorrect password","error"); return; }'
);
fs.writeFileSync('C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Invoice.jsx', inv, 'utf8');
console.log('Invoice.jsx patched');

// Fix AdminFinance.jsx
let af = fs.readFileSync('C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Admin/AdminFinance.jsx', 'utf8');
// Add auth import
af = af.replace(
  'import { money, todayStr, maxId } from "../../utils/helpers";',
  'import { money, todayStr, maxId } from "../../utils/helpers";\nimport { checkAdminPassword } from "../../utils/auth";'
);
// Fix password check in dangerReset
af = af.replace(
  'if (pw !== "admin123") { notify("Incorrect password","error"); return; }',
  'if (!checkAdminPassword(pw)) { notify("Incorrect password","error"); return; }'
);
fs.writeFileSync('C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Admin/AdminFinance.jsx', af, 'utf8');
console.log('AdminFinance.jsx patched');

// Fix AdminStaff.jsx - password check uses 'admin123' too
let as = fs.readFileSync('C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Admin/AdminStaff.jsx', 'utf8');
console.log('AdminStaff has admin123:', as.includes('admin123'));

console.log('All patches done');
