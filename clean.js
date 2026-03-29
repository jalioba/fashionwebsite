const fs = require('fs');
const files = [
  'src/supabase.js',
  'src/main.js',
  'src/other.js',
  'server/index.js',
  'demo.html',
  'dashboards.html',
  'registration.html',
  'home.html',
  'app.html'
];
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');

  // Remove block comments
  c = c.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove single line comments starting with // (and not inside a URL)
  // We match // followed by either space, tab, or drawing chars like ─ and ═
  c = c.replace(/\/\/[ \t─═]+.*$/gm, '');

  // Remove HTML comments
  if (f.endsWith('.html')) {
    c = c.replace(/<!--[\s\S]*?-->/g, '');
  }

  // Compress multiple empty lines to a single empty line
  c = c.replace(/(\n\s*){3,}/g, '\n\n');

  fs.writeFileSync(f, c.trim() + '\n');
});
console.log('Cleaned');
