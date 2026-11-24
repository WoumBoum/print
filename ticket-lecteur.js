/* Lecture d'un ticket PDF du site client (caisse > Vérifier).
   - données de la commande : champ « Sujet » du PDF, "HWP1:<base64 du JSON UTF-8>"
   - aperçus des designs : les images JPEG du PDF (une par page design, dans l'ordre)
   Fonctionne aussi dans Node (tests) : exporte HWPTicket. */
const HWPTicket = (() => {
  const enTexte = octets => new TextDecoder("latin1").decode(octets); // 1 caractère = 1 octet

  function base64VersTexte(b64) {
    const bin = atob(b64), o = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) o[k] = bin.charCodeAt(k);
    return new TextDecoder().decode(o);
  }

  function donnees(texte) {
    const m = texte.match(/HWP1:([A-Za-z0-9+/=]+)/);
    if (!m) return null;
    try { return JSON.parse(base64VersTexte(m[1])); } catch (e) { return null; }
  }

  function apercus(octets, texte) {
    const res = [], re = /<<([^>]*?\/DCTDecode[^>]*?)>>\s*stream\r?\n/g;
    let m;
    while ((m = re.exec(texte))) {
      const debut = m.index + m[0].length;
      const lg = m[1].match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/);
      let fin = lg ? debut + parseInt(lg[1], 10) : texte.indexOf("endstream", debut);
      if (!lg) while (fin > debut && (texte[fin - 1] === "\n" || texte[fin - 1] === "\r")) fin--;
      if (fin > debut) res.push(octets.slice(debut, fin));
    }
    return res;
  }

  // code dans le nom du fichier (anciens tickets sans données) : ticket_ABCD_prenom-nom.pdf
  const codeDuNom = nom => (String(nom).match(/ticket_([A-Z0-9]{4})_/) || [])[1] || null;

  function lire(octets, nomFichier) {
    const texte = enTexte(octets);
    if (!texte.startsWith("%PDF")) return { erreur: "Ce fichier n'est pas un PDF." };
    const d = donnees(texte);
    return { donnees: d, code: d ? d.code : codeDuNom(nomFichier), apercus: apercus(octets, texte) };
  }

  return { lire, codeDuNom };
})();
if (typeof module !== "undefined") module.exports = HWPTicket;
