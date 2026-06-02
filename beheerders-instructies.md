# AW IP Lookup – Beheerders Update Instructies

Deze handleiding beschrijft hoe je een nieuwe versie van de **AW IP Lookup Chrome Extension** publiceert en beschikbaar maakt via het update systeem.

---

## 1. Code pushen naar GitHub

Zorg dat alle wijzigingen getest zijn en push vervolgens de code naar de repository.

```bash
git add .
git commit -m "Release update X.X"
git push origin main
```

---

## 2. Nieuwe GitHub Release aanmaken

Ga naar de repository **aw-ip-lookup** op GitHub.

1. Klik op **Releases**
2. Klik op **Draft a new release**
3. Geef de release een titel
4. Klik op **Publish release**

---

## 3. Source Code ZIP-link kopiëren

Na het publiceren van de release:

1. Scroll naar **Assets**
2. Zoek **Source code (zip)**
3. Klik hier met de rechtermuisknop op
4. Kies **Linkadres kopiëren**

Bewaar deze URL; deze heb je nodig voor de update manager.

---

## 4. Update Manager aanpassen

Ga naar de repository **aw-ip-lookup-update-manager**.

Open het bestand:

```text
version.json
```

Pas de gegevens aan:

```json
{
  "version": "2.1",
  "downloadUrl": "https://github.com/...../archive/refs/tags/v2.1.zip",
  "changelog": "Korte beschrijving van de wijzigingen"
}
```

### Richtlijnen

- Verhoog de versie altijd naar een hogere versie dan de huidige.
- Gebruik de zojuist gekopieerde ZIP-link.
- Schrijf een korte en duidelijke changelog.

Voorbeelden:

- `Bugfixes in IP lookup`
- `Verbeterde update checker`
- `PTR lookup optimalisaties`
- `Diverse prestatieverbeteringen`

---

## 5. Update Manager pushen

Sla het bestand op en push de wijzigingen naar GitHub.

```bash
git add version.json
git commit -m "Update extension version"
git push origin main
```

---

## 🖥️ 6. Plesk Deployment

Normaal gesproken wordt de repository automatisch gepulld door Plesk.

### Automatisch

Wacht enkele minuten totdat de Git-deployment heeft plaatsgevonden.

### Handmatig

Wil je niet wachten, dan kun je handmatig een pull uitvoeren op **Plesk11**.

Ga daar vervolgens in plesk naar het domein iplookup.awdev.nl. daar klik je op het git icoon en vervolgends druk je daar op pull now.

---

## 7. Controle

Controleer vervolgens:

- Of `version.json` online de nieuwe versie bevat. https://iplookup.awdev.nl/version.json 
- Of de `downloadUrl` correct werkt.
- Of de updatebanner verschijnt in de extensie. (LET OP Interval voor update check is 1 keer per 24u)
- Of de changelog correct wordt weergegeven.
