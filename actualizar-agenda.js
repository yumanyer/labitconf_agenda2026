#!/usr/bin/env node
// Uso: node actualizar-agenda.js Agenda-LABC-CLP-2026.html agenda-nueva.json [salida.html]
// Reemplaza agenda, regenera speakers y report; conserva images (fotos).
const fs = require("fs");
const vm = require("vm");
const [htmlPath, jsonPath, outPath = "Agenda-LABC-CLP-2026.actualizada.html"] = process.argv.slice(2);
if (!htmlPath || !jsonPath) { console.error("Uso: node actualizar-agenda.js <html> <agenda.json> [salida.html]"); process.exit(1); }

const html = fs.readFileSync(htmlPath, "utf8");
const agenda = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const start = html.indexOf("window.__LABIT_DATA__ =");
const end = html.indexOf("\n      };\n\n      const state", start);
if (start < 0 || end < 0) throw new Error("No encontré el bloque window.__LABIT_DATA__ en el HTML");
const sandbox = { window: {} };
vm.runInNewContext(html.slice(start, end + 9), sandbox);
const old = sandbox.window.__LABIT_DATA__;
const PH = "assets/placeholder-speaker.svg";

// speakers a partir de las sesiones (los moderadores no cuentan como speakers)
const map = new Map();
for (const s of agenda) for (const p of s.speakers || []) {
  if (!map.has(p.speaker_id)) {
    const r = {};
    for (const k of ["speaker_id","name","bio","company","role","profile_url","image_url","local_image_path","social_links"]) r[k] = p[k] ?? null;
    if (!(r.local_image_path in old.images)) r.local_image_path = PH;
    r.sessions = [];
    map.set(p.speaker_id, r);
  }
  map.get(p.speaker_id).sessions.push(s.session_id);
}
const speakers = [...map.values()];
const count = (f) => agenda.filter(f).length;
const now = new Date().toISOString();
const byDate = {};
agenda.forEach((s) => (byDate[s.date] = (byDate[s.date] || 0) + 1));
const stages = [...new Set(agenda.map((s) => s.stage))];
const noPhoto = speakers.filter((s) => s.local_image_path === PH);
const report = { ...old.report, run_at: now, finished_at: now,
  counts: { sessions: agenda.length, unique_speakers: speakers.length, speaker_profiles_requested: speakers.length, speaker_profiles_recovered: speakers.length },
  official_counts: { ...old.report.official_counts, total_sessions: agenda.length, oct30: byDate["2026-10-30"] || 0, oct31: byDate["2026-10-31"] || 0, stages },
  image_counts: { images_requested: speakers.length, images_downloaded: speakers.length - noPhoto.length, images_using_local_placeholder: noPhoto.length },
  validation: { ...old.report.validation, counts_by_date: byDate,
    duplicate_session_ids: agenda.map((s) => s.session_id).filter((id, i, a) => a.indexOf(id) !== i) },
  examples: agenda.slice(0, 3).map((s) => ({ session_id: s.session_id, title: s.title, date: s.date, start_time: s.start_time, stage: s.stage, speakers: s.speakers.map((p) => p.name) })) };

const js = "window.__LABIT_DATA__ = " + JSON.stringify({ agenda, speakers, report, images: old.images }, null, 2).replace(/<\//g, "<\\/") + ";";
fs.writeFileSync(outPath, html.slice(0, start) + js + html.slice(end + 9));
console.log(`OK -> ${outPath}: ${agenda.length} sesiones, ${speakers.length} speakers`);
if (noPhoto.length) console.log("Sin foto (placeholder):", noPhoto.map((s) => s.name).join(", "));