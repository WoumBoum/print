"use strict";
const { CONFIG, codeValide, nettoyerCode, prix, euros } = HWP;
const $ = id => document.getElementById(id);

/* ================= état ================= */
const etat = { code: "", infos: {}, designs: [], ticket: null };
const CLE = "hwp-brouillon";
let metaDesigns = [];
try {
  const b = JSON.parse(localStorage.getItem(CLE)) || {};
  etat.code = b.code || ""; etat.infos = b.infos || {}; metaDesigns = b.designs || [];
} catch (e) {}
function sauver() {
  const designs = etat.designs.map(d => ({ id: d.id, qte: d.qte, note: d.note }));
  try { localStorage.setItem(CLE, JSON.stringify({ code: etat.code, infos: etat.infos, designs })); } catch (e) {}
}

/* Les images sont gardées dans IndexedDB : si le client quitte le site pour payer
   (Insta, Wero, Lydia) et que le navigateur recharge la page, sa commande est toujours là. */
const base = new Promise(ok => {
  try {
    const r = indexedDB.open("hwp", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("images");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ok(null);
  } catch (e) { ok(null); }
});
async function stockage(mode, action) {
  const db = await base;
  if (!db) return null;
  return new Promise(ok => {
    try {
      const req = action(db.transaction("images", mode).objectStore("images"));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => ok(null);
    } catch (e) { ok(null); }
  });
}
const garderImage = (id, file) => stockage("readwrite", s => s.put(file, id));
const oublierImage = id => stockage("readwrite", s => s.delete(id));
const viderImages = () => stockage("readwrite", s => s.clear());
async function restaurerDesigns() {
  for (const m of metaDesigns) {
    const file = await stockage("readonly", s => s.get(m.id));
    if (!file) continue;
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      etat.designs.push({ id: m.id, file, url, img, w: img.naturalWidth, h: img.naturalHeight, qte: m.qte || 1, note: m.note || "" });
    } catch (e) { URL.revokeObjectURL(url); }
  }
  sauver();
}

/* ================= navigation ================= */
// Code en dernier : le client a déjà rempli ses infos et choisi ses designs quand on lui demande de payer.
const ORDRE = ["accueil", "etape-infos", "etape-designs", "etape-code", "etape-recap", "fin"];
let courant = "accueil";

function autorise(id) {
  // Empêche d'arriver sur une étape sans avoir rempli la précédente (bouton retour, rechargement…)
  if (ORDRE.indexOf(id) >= 2 && !infosValides(false)) return "etape-infos";
  if (ORDRE.indexOf(id) >= 3 && !etat.designs.length) return "etape-designs";
  if (ORDRE.indexOf(id) >= 4 && !codeValide(etat.code)) return "etape-code";
  if (id === "fin" && !etat.ticket) return "etape-recap";
  return id;
}
function afficher(id, arriere) {
  id = autorise(id);
  document.querySelectorAll(".ecran").forEach(e => e.classList.remove("actif", "arriere"));
  const el = $(id);
  el.classList.add("actif");
  if (arriere) el.classList.add("arriere");
  window.scrollTo(0, 0);
  courant = id;
  entrer(id);
}
function aller(id) {
  history.pushState({ id }, "", "#" + id);
  afficher(id, false);
}
window.addEventListener("popstate", e => {
  const id = (e.state && e.state.id) || "accueil";
  afficher(id, ORDRE.indexOf(id) < ORDRE.indexOf(courant));
});
document.addEventListener("click", e => {
  const a = e.target.closest("[data-aller]");
  if (a) { e.preventDefault(); aller(a.dataset.aller); }
  if (e.target.closest("[data-retour]")) { e.preventDefault(); history.back(); }
});

function entrer(id) {
  if (id === "etape-code") {
    const n = nbAffiches();
    $("total-code").innerHTML = `<span>${n} affiche${n > 1 ? "s" : ""} A3</span><span>${euros(prix(n))}</span>`;
    majCode(false); setTimeout(() => $("code").focus(), 250);
  }
  if (id === "etape-infos") remplirInfos();
  if (id === "etape-designs") rendreDesigns();
  if (id === "etape-recap") rendreRecap();
}

/* ================= toast ================= */
let minuteurToast;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout(minuteurToast);
  minuteurToast = setTimeout(() => t.classList.remove("visible"), 2600);
}

/* ================= étape 3 : code ================= */
const inputCode = $("code");
let avanceAuto;
function majCode(depuisSaisie) {
  const v = etat.code;
  inputCode.value = v;
  const visu = document.querySelector(".code-visu");
  const cases = visu.querySelectorAll("span");
  cases.forEach((c, i) => {
    c.textContent = v[i] || "";
    c.classList.toggle("curseur-ici", i === v.length);
  });
  visu.classList.remove("ok", "ko");
  $("code-erreur").textContent = "";
  $("code-ok").disabled = true;
  clearTimeout(avanceAuto);
  if (v.length === 4) {
    if (codeValide(v)) {
      visu.classList.add("ok");
      $("code-ok").disabled = false;
      if (depuisSaisie) {
        inputCode.blur();
        avanceAuto = setTimeout(() => { if (courant === "etape-code") aller("etape-recap"); }, 450);
      }
    } else {
      void visu.offsetWidth;
      visu.classList.add("ko");
      $("code-erreur").textContent = "Ce code n'existe pas. Vérifie les caractères avec moi.";
    }
  }
}
inputCode.addEventListener("input", () => {
  const brut = inputCode.value;
  etat.code = nettoyerCode(brut);
  sauver();
  majCode(true);
  if (/[0O1IL2Z5S8B6G]/i.test(brut) && etat.code.length < 4)
    $("code-erreur").textContent = "Les codes n'utilisent jamais 0, O, 1, I, L, 2, Z, 5, S, 6, G, 8, B.";
});
$("code-ok").addEventListener("click", () => aller("etape-recap"));

/* ================= étape 1 : infos ================= */
const form = $("form-infos");
const CHAMPS = ["prenom", "nom", "chambre", "tel", "email", "insta"];
function remplirInfos() {
  CHAMPS.forEach(c => { if (etat.infos[c] && !form[c].value) form[c].value = etat.infos[c]; });
}
form.addEventListener("input", e => {
  if (!e.target.name) return;
  etat.infos[e.target.name] = e.target.value.trim();
  e.target.classList.remove("invalide");
  sauver();
});
function infosValides(marquer) {
  const i = etat.infos, erreurs = [];
  const tests = {
    prenom: !!i.prenom,
    nom: !!i.nom,
    chambre: !!i.chambre,
    tel: (i.tel || "").replace(/\D/g, "").length >= 10,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(i.email || "")
  };
  for (const [k, ok] of Object.entries(tests)) {
    if (!ok) { erreurs.push(k); if (marquer) form[k].classList.add("invalide"); }
  }
  if (marquer) {
    $("infos-erreur").textContent = erreurs.length
      ? (erreurs.includes("email") && erreurs.length === 1 ? "Ton mail a l'air incomplet."
        : erreurs.includes("tel") && erreurs.length === 1 ? "Il manque des chiffres à ton numéro."
        : "Remplis les champs en rouge.")
      : "";
    if (erreurs.length) form[erreurs[0]].focus();
  }
  return erreurs.length === 0;
}
form.addEventListener("submit", e => { e.preventDefault(); $("infos-ok").click(); });
$("infos-ok").addEventListener("click", () => {
  CHAMPS.forEach(c => (etat.infos[c] = form[c].value.trim()));
  if (etat.infos.insta && !etat.infos.insta.startsWith("@")) etat.infos.insta = "@" + etat.infos.insta;
  form.insta.value = etat.infos.insta || "";
  sauver();
  if (infosValides(true)) { document.activeElement.blur(); aller("etape-designs"); }
});

/* ================= étape 2 : designs ================= */
const inputFichiers = $("fichiers");
inputFichiers.addEventListener("change", async () => {
  await ajouterFichiers([...inputFichiers.files]);
  inputFichiers.value = "";
});
const depot = $("depot");
["dragenter", "dragover"].forEach(t => depot.addEventListener(t, e => { e.preventDefault(); depot.classList.add("survol"); }));
["dragleave", "drop"].forEach(t => depot.addEventListener(t, e => { e.preventDefault(); depot.classList.remove("survol"); }));
depot.addEventListener("drop", e => ajouterFichiers([...e.dataTransfer.files].filter(f => f.type.startsWith("image/"))));

async function ajouterFichiers(fichiers) {
  for (const file of fichiers) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const id = crypto.randomUUID ? crypto.randomUUID() : String(Math.random());
      etat.designs.push({ id, file, url, img, w: img.naturalWidth, h: img.naturalHeight, qte: 1, note: "" });
      garderImage(id, file);
    } catch (e) {
      URL.revokeObjectURL(url);
      toast(`« ${file.name} » illisible. Envoie-la en JPG ou PNG.`);
    }
  }
  sauver();
  rendreDesigns();
}

function qualite(d) {
  const petit = Math.min(d.w, d.h), grand = Math.max(d.w, d.h);
  if (petit >= 2400 && grand >= 3200) return { txt: "HD ✓ prête à imprimer", alerte: false };
  if (petit >= 700) return { txt: "ok, je l'agrandis pour l'A3", alerte: false };
  return { txt: "très petite : si tu as mieux, prends-la", alerte: true };
}
const nbAffiches = () => etat.designs.reduce((s, d) => s + d.qte, 0);
const echapper = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function rendreDesigns() {
  const ul = $("liste-designs");
  const existants = new Map([...ul.children].map(li => [li.dataset.id, li]));
  etat.designs.forEach((d, i) => {
    let li = existants.get(d.id);
    const q = qualite(d);
    if (!li) {
      li = document.createElement("li");
      li.className = "design";
      li.dataset.id = d.id;
      li.innerHTML = `
        <div class="design-img"><img alt="" src="${d.url}"></div>
        <div class="design-corps">
          <div class="design-haut">
            <div style="min-width:0">
              <div class="design-nom"></div>
              <div class="design-dim"></div>
            </div>
            <button class="suppr" aria-label="Retirer">✕</button>
          </div>
          <div class="qte">
            <button type="button" data-q="-1" aria-label="Moins">−</button>
            <span></span>
            <button type="button" data-q="1" aria-label="Plus">+</button>
          </div>
          <textarea rows="1" placeholder="Une précision ? (recadrage, texte…)"></textarea>
        </div>`;
      li.querySelector(".suppr").onclick = () => {
        etat.designs = etat.designs.filter(x => x.id !== d.id);
        URL.revokeObjectURL(d.url);
        oublierImage(d.id);
        sauver();
        li.remove();
        rendreDesigns();
      };
      li.querySelectorAll("[data-q]").forEach(b => b.onclick = () => {
        d.qte = Math.max(1, Math.min(9, d.qte + Number(b.dataset.q)));
        sauver();
        rendreDesigns();
      });
      const zone = li.querySelector("textarea");
      zone.value = d.note;
      zone.oninput = e => { d.note = e.target.value; sauver(); };
      ul.appendChild(li);
    }
    li.querySelector(".design-nom").textContent = `${String(i + 1).padStart(2, "0")} · ${d.file.name}`;
    const dim = li.querySelector(".design-dim");
    dim.textContent = `${d.w}×${d.h}px · ${q.txt}`;
    dim.classList.toggle("alerte", q.alerte);
    li.querySelector(".qte span").textContent = `×${d.qte}`;
    existants.delete(d.id);
  });
  existants.forEach(li => li.remove());

  const n = nbAffiches();
  $("designs-ok").disabled = n === 0;
  const ailleurs = n * CONFIG.prixAilleurs;
  $("total-designs").innerHTML = n
    ? `<span>${n} affiche${n > 1 ? "s" : ""}<span class="eco">au lieu de ~${euros(ailleurs)} ailleurs</span></span><span>${euros(prix(n))}</span>`
    : "";
}
$("designs-ok").addEventListener("click", () => aller("etape-code"));

/* ================= étape 4 : récap ================= */
function rendreRecap() {
  const i = etat.infos, n = nbAffiches();
  const ligne = (k, v, cls = "") => `<div class="recap-ligne ${cls}"><span>${k}</span><span>${v}</span></div>`;
  $("recap").innerHTML =
    ligne("Code", echapper(etat.code), "recap-code") +
    ligne("Nom", echapper(`${i.prenom} ${i.nom}`)) +
    ligne("Chambre", echapper(i.chambre)) +
    ligne("Tél.", echapper(i.tel)) +
    ligne("Mail", echapper(i.email)) +
    (i.insta ? ligne("Insta", echapper(i.insta)) : "") +
    `<div class="recap-vignettes">${etat.designs.map(d => `<img alt="" src="${d.url}">`).join("")}</div>` +
    ligne(`${n} affiche${n > 1 ? "s" : ""} A3`, euros(prix(n)), "recap-total") +
    `<div class="recap-ligne"><button class="recap-modif" data-aller="etape-infos">modifier mes infos</button><button class="recap-modif" data-aller="etape-designs">modifier les designs</button></div>`;
}

/* ================= ticket PDF ================= */
const sansAccent = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const latin1 = s => String(s || "").normalize("NFC").replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
const slug = s => sansAccent(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

// Texture trame (points noirs sur fond transparent) posée sur la page 1 :
// des points noirs à opacité réduite = mode « produit » à opacité réduite.
const OPACITE_TEXTURE = 0.2;
const cacheImages = {};
function chargerImage(url) {
  if (!cacheImages[url]) cacheImages[url] = fetch(url)
    .then(r => r.ok ? r.blob() : Promise.reject())
    .then(b => new Promise(ok => { const f = new FileReader(); f.onload = () => ok(f.result); f.readAsDataURL(b); }))
    .catch(() => { delete cacheImages[url]; return null; });
  return cacheImages[url];
}
const chargerTexture = () => chargerImage("texture-ticket.png");
const chargerLogo = () => chargerImage("logo.png");
function vignette(d, max = 1400) {
  const r = Math.min(1, max / Math.max(d.w, d.h));
  const c = document.createElement("canvas");
  c.width = Math.round(d.w * r); c.height = Math.round(d.h * r);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(d.img, 0, 0, c.width, c.height);
  return { data: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height };
}
async function creerTicket() {
  const { jsPDF } = window.jspdf;
  const i = etat.infos, n = nbAffiches(), montant = prix(n);
  const maintenant = new Date();
  const dateTxt = maintenant.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const [texture, logo] = await Promise.all([chargerTexture(), chargerLogo()]);

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16;
  const cw = fs => fs * 0.6 * 0.3528; // largeur d'un caractère Courier en mm

  // --- bandeau noir + logo (le logo a déjà un fond noir : il se fond dans le bandeau)
  pdf.setFillColor(0, 0, 0); pdf.rect(0, 0, W, 46, "F");
  if (logo) {
    pdf.addImage(logo, "PNG", M - 4, 1, 44 * 488 / 498, 44, "logo", "FAST");
  } else {
    // secours si le logo ne charge pas : version texte
    pdf.setFont("courier", "bold"); pdf.setFontSize(20); pdf.setTextColor(255, 255, 255);
    pdf.text('HelloWorld("print")', M, 24);
  }
  pdf.setFont("courier", "bold"); pdf.setFontSize(15); pdf.setTextColor(255, 255, 255);
  pdf.text("TICKET DE COMMANDE", W - M, 20, { align: "right" });
  pdf.setFont("courier", "normal"); pdf.setFontSize(9); pdf.setTextColor(170, 170, 170);
  pdf.text("PREUVE D'ACHAT", W - M, 27, { align: "right" });
  pdf.text(dateTxt, W - M, 34, { align: "right" });

  // --- générique façon affiche de cinéma
  const centre = (txt, y, fs, style = "normal", couleur = [0, 0, 0]) => {
    pdf.setFont("courier", style); pdf.setFontSize(fs); pdf.setTextColor(...couleur);
    pdf.text(txt, W / 2, y, { align: "center" });
  };
  centre('HELLOWORLD("PRINT")  PRESENTE', 55.5, 9, "bold", [90, 90, 90]);

  // --- code géant dans le bloc rouge
  pdf.setFillColor(122, 27, 27); pdf.rect(M, 60, W - 2 * M, 52, "F");
  const fsCode = 132, gap = 9, lc = cw(fsCode);
  let xc = (W - (4 * lc + 3 * gap)) / 2;
  pdf.setFont("courier", "bold"); pdf.setFontSize(fsCode); pdf.setTextColor(255, 255, 255);
  for (const ch of etat.code) { pdf.text(ch, xc, 99.5); xc += lc + gap; }
  centre("CODE DE COMMANDE  -  1 CODE = 1 COMMANDE", 118, 8, "bold", [60, 60, 60]);

  // --- « la commande de » + nom en grand
  centre("LA COMMANDE DE", 133, 9, "bold", [60, 60, 60]);
  const nomGrand = latin1(`${i.prenom} ${i.nom}`).toUpperCase();
  let fsNom = 30;
  while (nomGrand.length * cw(fsNom) > W - 2 * M && fsNom > 12) fsNom--;
  centre(nomGrand, 146, fsNom, "bold");
  centre(latin1(`MAISEL  -  CHAMBRE ${i.chambre}`).toUpperCase(), 156, 12, "bold", [122, 27, 27]);

  // --- infos client
  let y = 172;
  const champ = (k, v) => {
    pdf.setFont("courier", "bold"); pdf.setFontSize(9); pdf.setTextColor(80, 80, 80);
    pdf.text(k.toUpperCase(), M, y);
    pdf.setFont("courier", "bold"); pdf.setFontSize(12); pdf.setTextColor(0, 0, 0);
    pdf.text(latin1(v), M + 38, y);
    pdf.setDrawColor(200, 200, 200); pdf.line(M, y + 3, W - M, y + 3);
    y += 10;
  };
  champ("Telephone", i.tel);
  champ("Mail", i.email);
  champ("Instagram", i.insta || "-");
  champ("Affiches", `${n} x A3 mat`);
  champ("Montant", `${montant.toFixed(2).replace(".", ",")} EUR (paye Wero/Lydia)`);

  // --- liste des designs
  y += 4;
  pdf.setFont("courier", "bold"); pdf.setFontSize(10); pdf.setTextColor(0, 0, 0); pdf.text("DESIGNS", M, y); y += 6;
  pdf.setFont("courier", "normal"); pdf.setFontSize(9);
  etat.designs.forEach((d, k) => {
    if (y > 272) return;
    const nom = latin1(d.file.name).slice(0, 44);
    pdf.text(`${String(k + 1).padStart(2, "0")}  ${nom}`, M, y);
    pdf.text(`${d.w}x${d.h}  x${d.qte}`, W - M, y, { align: "right" });
    y += 5;
    if (d.note && y <= 272) {
      pdf.setTextColor(122, 27, 27);
      pdf.splitTextToSize(latin1("    > " + d.note), W - 2 * M).slice(0, 2).forEach(l => { pdf.text(l, M, y); y += 4.5; });
      pdf.setTextColor(0, 0, 0);
    }
  });

  // --- pied
  pdf.setFillColor(0, 0, 0); pdf.rect(0, 280, W, 17, "F");
  centre("A3 MAT  -  IMPRIME ET LIVRE A LA MAISEL  -  HELLOWORLD(\"PRINT\")", 287, 7.5, "bold", [210, 210, 210]);
  centre("Valable uniquement si le code a ete donne par Walid apres paiement.", 292, 7, "normal", [150, 150, 150]);

  // --- grain : texture en « produit » à opacité réduite sur toute la page 1
  if (texture) {
    pdf.setGState(new pdf.GState({ opacity: OPACITE_TEXTURE }));
    pdf.addImage(texture, "PNG", 0, 0, W, 297, "texture", "FAST");
    pdf.setGState(new pdf.GState({ opacity: 1 }));
  }

  // --- une page par design
  etat.designs.forEach((d, k) => {
    pdf.addPage();
    pdf.setFillColor(0, 0, 0); pdf.rect(0, 0, W, 18, "F");
    if (logo) pdf.addImage(logo, "PNG", M - 2, 0.5, 17 * 488 / 498, 17, "logo", "FAST");
    pdf.setFont("courier", "bold"); pdf.setFontSize(12); pdf.setTextColor(255, 255, 255);
    pdf.text(`${etat.code}  /  design ${k + 1}/${etat.designs.length}  /  x${d.qte}`, M + (logo ? 20 : 0), 11.5);
    pdf.setFont("courier", "normal"); pdf.setFontSize(9);
    pdf.text(latin1(`${i.prenom} ${i.nom} - ${i.chambre}`), W - M, 11.5, { align: "right" });
    const v = vignette(d);
    const boiteW = W - 2 * M, boiteH = 297 - 18 - 34;
    const r = Math.min(boiteW / v.w, boiteH / v.h);
    const iw = v.w * r, ih = v.h * r;
    pdf.addImage(v.data, "JPEG", (W - iw) / 2, 24 + (boiteH - ih) / 2, iw, ih);
    pdf.setTextColor(0, 0, 0); pdf.setFontSize(8);
    pdf.text(latin1(`${d.file.name}  -  original ${d.w}x${d.h}px (fichier joint au mail)`), M, 285);
    if (d.note) pdf.text(latin1("Note : " + d.note).slice(0, 95), M, 290);
  });

  const nomBase = `${etat.code}_${slug(i.prenom)}-${slug(i.nom)}`;
  const originaux = etat.designs.map((d, k) => {
    const ext = (d.file.name.match(/\.[a-z0-9]+$/i) || [".jpg"])[0].toLowerCase();
    return new File([d.file], `${nomBase}_design${k + 1}${d.qte > 1 ? "_x" + d.qte : ""}${ext}`, { type: d.file.type || "image/jpeg" });
  });

  // Données de la commande cachées dans le PDF (champ « Sujet ») : la caisse les relit quand Walid dépose le ticket.
  const donnees = {
    v: 1, code: etat.code, date: maintenant.toISOString(), nb: n, montant,
    infos: { prenom: i.prenom, nom: i.nom, chambre: i.chambre, tel: i.tel, email: i.email, insta: i.insta || "" },
    designs: etat.designs.map((d, k) => ({ fichier: originaux[k].name, original: d.file.name, w: d.w, h: d.h, qte: d.qte, note: d.note || "" }))
  };
  const octets = new TextEncoder().encode(JSON.stringify(donnees));
  let bin = ""; octets.forEach(o => bin += String.fromCharCode(o));
  pdf.setProperties({ title: `Ticket ${etat.code}`, subject: "HWP1:" + btoa(bin), creator: 'HelloWorld("print")' });

  const pdfFile = new File([pdf.output("blob")], `ticket_${nomBase}.pdf`, { type: "application/pdf" });
  return { pdfFile, originaux, nomBase, donnees };
}

$("generer").addEventListener("click", async () => {
  if (!window.jspdf) { toast("Connexion lente… réessaie dans 2 s."); return; }
  $("chargement").classList.add("visible");
  try {
    await new Promise(r => setTimeout(r, 60));
    etat.ticket = await creerTicket();
    if (CONFIG.base) await envoyerCommande();
    preparerFin();
    aller("fin");
  } catch (e) {
    console.error(e);
    toast("Oups, le ticket n'a pas pu être créé. Réessaie.");
  } finally {
    $("chargement").classList.remove("visible");
    $("chargement-etat").textContent = "";
  }
});

/* ================= envoi direct (sans mail) ================= */
// Le site envoie le ticket et les images au script Google de Walid, qui les range dans son Drive.
// Refusé si le code n'a pas été donné à la caisse ou a déjà servi.
const enBase64 = f => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(f); });
async function appelBase(corps) {
  const r = await fetch(CONFIG.base, { method: "POST", body: JSON.stringify(corps) });   // texte brut : pas de pré-vérification CORS
  const j = await r.json();
  if (!j.ok) { const e = new Error(j.erreur || "refusé"); e.raison = j.raison; throw e; }
  return j;
}
async function envoyerCommande() {
  const t = etat.ticket, etatTxt = $("chargement-etat");
  t.envoi = null;
  try {
    etatTxt.textContent = "Envoi de ta commande…";
    const { jeton } = await appelBase({ action: "client_commande", code: etat.code, commande: t.donnees });
    const fichiers = [t.pdfFile, ...t.originaux];
    for (let k = 0; k < fichiers.length; k++) {
      etatTxt.textContent = `Envoi ${k + 1}/${fichiers.length}…`;
      const f = fichiers[k];
      await appelBase({ action: "client_fichier", code: etat.code, jeton, nom: f.name, type: f.type || "image/jpeg", data: await enBase64(f) });
    }
    t.envoi = { ok: true };
    // commande partie : on ne la reproposera pas au prochain chargement (les infos restent pour la suivante)
    viderImages();
    try { localStorage.setItem(CLE, JSON.stringify({ code: "", infos: etat.infos, designs: [] })); } catch (e) {}
  } catch (e) {
    console.error(e);
    t.envoi = {
      ok: false,
      msg: e.raison === "inconnu" ? "Ce code n'est pas encore enregistré chez moi. Envoie-moi le ticket par mail ci-dessous."
        : e.raison === "deja" ? "Ce code a déjà servi pour une commande. Si c'est bien la tienne, envoie-moi le ticket par mail ci-dessous."
        : "L'envoi n'est pas passé (réseau ?). Réessaie, ou envoie-moi le ticket par mail.",
      reessayer: !e.raison
    };
  }
}
$("reessayer").addEventListener("click", async () => {
  $("chargement").classList.add("visible");
  try { await envoyerCommande(); preparerFin(); }
  finally { $("chargement").classList.remove("visible"); $("chargement-etat").textContent = ""; }
});
$("telecharger-recu").addEventListener("click", () => telecharger());

/* ================= fin : envoi ================= */
function preparerFin() {
  const t = etat.ticket, i = etat.infos, n = nbAffiches();
  $("fin-code").textContent = etat.code;
  const envoi = t.envoi, recu = !!(envoi && envoi.ok);
  $("fin-titre").textContent = recu ? "Commande reçue" : "Ticket prêt";
  $("fin-texte").textContent = recu
    ? "Ton ticket et tes images sont bien arrivés chez moi. Rien d'autre à faire."
    : "Envoie-le moi. Pas de ticket, pas d'impression.";
  $("envoi-auto").hidden = !envoi;
  $("envoi-erreur").textContent = envoi && !envoi.ok ? envoi.msg : "";
  $("reessayer").hidden = !(envoi && envoi.reessayer);
  $("telecharger-recu").hidden = !recu;
  $("envoi-mail").hidden = recu;
  $("ticket-apercu").innerHTML = `
    <div>
      <div class="t-code">${echapper(etat.code)}</div>
      <div class="t-info"><b>${echapper(i.prenom)} ${echapper(i.nom)}</b><br>Chambre ${echapper(i.chambre)}<br>${n} affiche${n > 1 ? "s" : ""} · ${euros(prix(n))}</div>
    </div>`;
  $("adresse-txt").textContent = CONFIG.email;
  const sujet = `Commande ${etat.code} - ${i.prenom} ${i.nom} (${i.chambre})`;
  const corps = `Salut Walid,\n\nVoici mon ticket de commande ${etat.code} (${n} affiche${n > 1 ? "s" : ""}).\n\n> Pièces jointes : le PDF du ticket + mes images.\n\n${i.prenom}`;
  $("mailto").href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  const to = encodeURIComponent(CONFIG.email), su = encodeURIComponent(sujet), bo = encodeURIComponent(corps);
  liensGmail = {
    web: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${bo}`,
    ios: `googlegmail:///co?to=${to}&subject=${su}&body=${bo}`,
    android: ""
  };
  // Si Gmail n'est pas installé, Chrome Android ouvre la version web au lieu du Play Store
  liensGmail.android = `intent:${CONFIG.email}?subject=${su}&body=${bo}#Intent;scheme=mailto;package=com.google.android.gm;S.browser_fallback_url=${encodeURIComponent(liensGmail.web)};end`;
  $("gmail").href = liensGmail.web;
  const peutPartager = !!(navigator.canShare && navigator.canShare({ files: [t.pdfFile] }));
  $("partager").classList.toggle("cache", !peutPartager);
  $("aide-envoi").textContent = peutPartager
    ? "Tout est déjà joint. Colle juste mon adresse."
    : "Télécharge le PDF, envoie-le avec tes images.";
}

// Gmail : ouvre l'appli Gmail si elle est installée (iPhone / Android), sinon Gmail dans le navigateur.
let liensGmail = null;
$("gmail").addEventListener("click", e => {
  if (!liensGmail) return;
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  if (!ios && !android) return;            // ordinateur : lien web normal (nouvel onglet)
  e.preventDefault();
  let parti = false;
  const quitte = () => { if (document.hidden) parti = true; };
  document.addEventListener("visibilitychange", quitte);
  location.href = ios ? liensGmail.ios : liensGmail.android;
  setTimeout(() => {
    document.removeEventListener("visibilitychange", quitte);
    if (!parti && !document.hidden) location.href = liensGmail.web;   // appli absente → version web
  }, 1500);
});

$("copier-adresse").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(CONFIG.email); }
  catch (e) {
    const r = document.createRange(); r.selectNodeContents($("adresse-txt"));
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy");
  }
  const c = $("copie-etat"); c.textContent = "copié ✓"; c.classList.add("fait");
  setTimeout(() => { c.textContent = "copier"; c.classList.remove("fait"); }, 2000);
});

$("partager").addEventListener("click", async () => {
  const t = etat.ticket, i = etat.infos;
  try { await navigator.clipboard.writeText(CONFIG.email); toast("Adresse copiée, colle-la en destinataire"); } catch (e) {}
  const titre = `Commande ${etat.code} - ${i.prenom} ${i.nom} (${i.chambre})`;
  const texte = `Ticket HelloWorld("print") ${etat.code} - ${i.prenom} ${i.nom}, chambre ${i.chambre}. À envoyer à ${CONFIG.email}`;
  const tous = [t.pdfFile, ...t.originaux];
  const essais = [tous, [t.pdfFile]];
  for (const files of essais) {
    if (!navigator.canShare({ files })) continue;
    try {
      await navigator.share({ files, title: titre, text: texte });
      if (files.length === 1 && tous.length > 1) toast("Seul le PDF est parti : ajoute aussi tes images au message.");
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  telecharger();
});

function telecharger() {
  const t = etat.ticket;
  const url = URL.createObjectURL(t.pdfFile);
  const a = document.createElement("a");
  a.href = url; a.download = t.pdfFile.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  toast("Ticket téléchargé");
}
$("telecharger").addEventListener("click", telecharger);

$("nouvelle").addEventListener("click", () => {
  etat.code = ""; etat.ticket = null;
  etat.designs.forEach(d => URL.revokeObjectURL(d.url));
  etat.designs = [];
  viderImages();
  sauver();
  $("liste-designs").innerHTML = "";
  aller("accueil");
});

/* ================= texte corrompu ================= */
// Les .glitch se réécrivent de temps en temps en motifs (souvent symétriques) ;
// les titres .brouille se corrompent une fraction de seconde puis reviennent.
const GLYPHES = "X.§:|-=#_*+·¦░▒";
const MIROIR = { "/": "\\", "\\": "/", "<": ">", ">": "<", "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{" };
const PAIRES = Object.keys(MIROIR);
const hasard = t => t[Math.floor(Math.random() * t.length)];
function motif(n) {
  if (Math.random() < 0.25) return Array.from({ length: n }, () => hasard(GLYPHES + "/")).join("");
  const moitie = Array.from({ length: Math.floor(n / 2) }, () => Math.random() < 0.3 ? hasard(PAIRES) : hasard(GLYPHES));
  const milieu = n % 2 ? hasard(GLYPHES) : "";
  return moitie.join("") + milieu + moitie.slice().reverse().map(c => MIROIR[c] || c).join("");
}
function animerGlitch(el) {
  const n = el.textContent.length;
  let f = 0;
  const pas = () => {
    el.textContent = motif(n);
    el.classList.toggle("flash", f % 2 === 0 && f < 4);
    if (++f < 6) setTimeout(pas, 55);
    else el.classList.remove("flash");
  };
  pas();
}
function brouiller(el) {
  const vrai = el.dataset.vrai || (el.dataset.vrai = el.textContent);
  const idx = [...vrai].map((c, i) => c.trim() ? i : -1).filter(i => i >= 0);
  const choisis = new Set(Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => hasard(idx)));
  el.textContent = [...vrai].map((c, i) => choisis.has(i) ? hasard(GLYPHES + "/\\") : c).join("");
  el.classList.add("flash");
  setTimeout(() => { el.textContent = vrai; el.classList.remove("flash"); }, 140);
}
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const boucle = () => {
    const ecran = document.querySelector(".ecran.actif");
    if (ecran) {
      const g = [...ecran.querySelectorAll(".glitch")], b = [...ecran.querySelectorAll(".brouille")];
      if (g.length) animerGlitch(hasard(g));
      if (b.length && Math.random() < 0.35) brouiller(hasard(b));
    }
    if ($("chargement").classList.contains("visible")) animerGlitch($("chargement-txt"));
    setTimeout(boucle, 900 + Math.random() * 1600);
  };
  setTimeout(boucle, 600);
}

/* ================= démarrage ================= */
(async function init() {
  chargerTexture(); chargerLogo();
  if (CONFIG.base) $("generer").textContent = "Envoyer ma commande";
  if (CONFIG.insta) {
    ["lien-insta-accueil", "lien-insta-fin"].forEach(id => {
      $(id).href = `https://instagram.com/${CONFIG.insta}`;
      $(id).classList.remove("cache");
    });
  }
  // Lien depuis le QR de la caisse : ?c=K7P2 → code pré-rempli
  const p = new URLSearchParams(location.search);
  const c = nettoyerCode(p.get("c") || "");
  history.replaceState({ id: "accueil" }, "", location.pathname);
  afficher("accueil");
  await restaurerDesigns();
  if (codeValide(c)) {
    if (c !== etat.code) { etat.code = c; sauver(); }
    toast(`Code ${c} récupéré ✓`);
    aller(autorise("etape-recap"));   // reprend à la première étape qui manque
  } else if (etat.designs.length && infosValides(false)) {
    // Retour après paiement : la commande est restée enregistrée, on reprend au code
    toast("Ta commande t'attendait ✓");
    aller(autorise("etape-recap"));
  }
})();
