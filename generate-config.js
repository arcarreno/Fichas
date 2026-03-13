const fs = require('fs');

// Obtener las variables de entorno (suponiendo que Vercel las inyecta)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Contenido del archivo config.js
const content = `
const SUPABASE_URL = '${supabaseUrl}';
const SUPABASE_ANON_KEY = '${supabaseAnonKey}';
`;

// Escribir el archivo
fs.writeFileSync('config.js', content);
console.log('Archivo config.js generado correctamente con las variables de entorno.');
