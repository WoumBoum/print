/* Partagé entre le site client (index.html) et la caisse (caisse.html). */
const HWP = (() => {
  const CONFIG = {
    email: "walid.mehrez06@gmail.com",
    insta: "helloworld_print_",
    site: "https://woumboum.github.io/print/",
    // Lien Wero « Mon QR code » (fixe, ne dépend pas de l'heure) ; le montant est ajouté en centimes : ?a=1999&c=EUR
    wero: "https://share.wero-wallet.eu/p/1/s/bm4pPU940U",
    // Lien Lydia « Mon QR code » (fixe) : ?t=<compte>&a=<centimes>&d=<motif>
    lydia: "https://go.lydia.me/l?t=walidm3bzd",
    // Page web Lydia : paiement par carte / Apple Pay / Google Pay sans compte Lydia
    lydiaWeb: "https://pay.lydia.me/l?t=walidm3bzd",
    // Adresse du script Google (…/exec) : le site y envoie directement la commande du client.
    // Vide = pas d'envoi direct, le client envoie son ticket par mail comme avant.
    base: "https://script.google.com/macros/s/AKfycbyy3fMgzEEsHE7bd_d_jDDZpmCOi4cRPeyCIiQbidepyWsKxPser0BBE59Ys11gwJge/exec",
    prixAilleurs: 12        // prix d'une affiche custom sur un site spécialisé (pour le pitch)
  };

  // 23 caractères sans ambiguïté (pas de 0/O, 1/I/L, 2/Z, 5/S, 8/B, 6/G)
  const ALPHABET = "ACDEFHJKMNPQRTUVWXY3479";

  // 4e caractère = clé de contrôle des 3 premiers : détecte les fautes de frappe.
  function cle(trois) {
    let s = 0;
    const poids = [7, 3, 1];
    for (let i = 0; i < 3; i++) s += (ALPHABET.indexOf(trois[i]) + 1) * poids[i];
    return ALPHABET[s % ALPHABET.length];
  }
  function codeValide(c) {
    if (!/^.{4}$/.test(c)) return false;
    for (const ch of c) if (!ALPHABET.includes(ch)) return false;
    return cle(c.slice(0, 3)) === c[3];
  }
  function nouveauCode() {
    const r = new Uint32Array(3);
    crypto.getRandomValues(r);
    const trois = Array.from(r, v => ALPHABET[v % ALPHABET.length]).join("");
    return trois + cle(trois);
  }
  function nettoyerCode(v) {
    return v.toUpperCase().split("").filter(ch => ALPHABET.includes(ch)).join("").slice(0, 4);
  }

  // 7,99 · 14,99 les 2 · 19,99 les 3 (puis on recommence par paquets de 3)
  function prix(n) {
    const paquets = Math.floor(n / 3), reste = n % 3;
    const c = paquets * 1999 + (reste === 1 ? 799 : reste === 2 ? 1499 : 0);
    return c / 100;
  }
  const euros = v => v.toFixed(2).replace(".", ",") + " €";

  return { CONFIG, ALPHABET, codeValide, nouveauCode, nettoyerCode, prix, euros };
})();
