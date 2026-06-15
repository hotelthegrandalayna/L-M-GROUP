const fs = require('fs');
const path = 'C:/Users/sharmin/Desktop/group business/hall invoice system/latest/grand-alayna-react/src/components/Invoice.jsx';
let code = fs.readFileSync(path, 'utf8');

// The file has literal \uXXXX (backslash + u + 4 hex digits) in JSX text areas.
// Replace them with actual Unicode characters.
code = code.replace(/\\u00B7/g, '·');   // · middle dot
code = code.replace(/\\u2192/g, '→');   // → rightward arrow
code = code.replace(/\\u2014/g, '—');   // — em dash
code = code.replace(/\\u2666/g, '♦');   // ♦ diamond
code = code.replace(/\\u2705/g, '✅');   // ✅ green check
code = code.replace(/\\u274C/g, '❌');   // ❌ cross
code = code.replace(/\\u23F3/g, '⏳');   // ⏳ hourglass
code = code.replace(/\\u2714/g, '✔');   // ✔ check mark

// ALSO: the HTML builder has \\uXXXX inside JS template-literal strings.
// Those were double-escaped in node script output and should be proper JS Unicode escapes.
// But we already converted them. The moneyH() and formatDate() used in HTML builder
// use direct character concatenation, so the invoiceHTML will be fine.

// Verify
const idx = code.indexOf('#{b.id}');
console.log('Option text after fix:', JSON.stringify(code.slice(idx, idx+60)));

fs.writeFileSync(path, code, 'utf8');
console.log('Done, size:', fs.statSync(path).size);
