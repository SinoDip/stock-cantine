# Stocklijst Cantine

Een eenvoudige stock-app voor de keuken. Het hele team logt in met één gedeeld wachtwoord.

- **Vandaag:** wat vervalt, wat eerst op moet, wat je moet bijbestellen en bij welke leverancier je vandaag nog moet bestellen (met deadline).
- **Stock:** zoeken, −1 tikken, stockwaarde in euro.
- **Inboeken:** leveringen en prep, met automatische vervaldatum voor prep.
- **Bestellen:** bestellijst per leverancier, geschat bedrag, doorsturen via WhatsApp, mail of kopiëren.
- **Meer:** leveranciers (contact, besteldagen, deadline, leverdagen), allergenen (de 14 EU-allergenen per product), logboek (wie deed wat en wanneer) en instellingen.

- **Next.js 15** (App Router, React 19, TypeScript)
- **Supabase** (Postgres) als database
- **Vercel** om het online te zetten

De stock van 6 oktober 2026 zit al in `supabase/seed.sql`.

---

## Online zetten (ongeveer 30 minuten)

### 1. Database maken bij Supabase

1. Ga naar [supabase.com](https://supabase.com) en maak een gratis account.
2. Klik op **New project**. Kies een naam (bv. `stock-cantine`), een databasewachtwoord (bewaar het ergens) en regio **Frankfurt** of **Paris** (dicht bij België).
3. Wacht tot het project klaar is (1–2 minuten).
4. Open links **SQL Editor** → **New query**.
5. Open het bestand `supabase/schema.sql` uit deze map, kopieer alles, plak het in de editor en klik op **Run**. Je ziet "Success".
6. Doe hetzelfde met `supabase/seed.sql`. Daarmee komt je huidige stock erin.
7. Controleer via **Table Editor**: de tabel `products` heeft 62 rijen.

> **Had je `schema.sql` al uitgevoerd vóór de leveranciers, allergenen en het logboek erbij kwamen?** Voer dan alleen `supabase/update-1.sql` uit (SQL Editor → New query → Run). Je stock blijft gewoon staan.

Nu heb je twee waarden nodig voor stap 3:

- **Project URL**: via **Project Settings → Data API** (of de knop **Connect** bovenaan). Ziet eruit als `https://abcdefgh.supabase.co`.
- **Geheime sleutel**: via **Project Settings → API Keys**. Neem de **secret key** (begint met `sb_secret_`) of, onder *Legacy API keys*, de **service_role**-sleutel.
  ⚠️ Deze sleutel geeft volledige toegang tot je database. Deel hem met niemand en zet hem nooit in de code zelf.

### 2. Code op GitHub zetten

Vercel haalt de code het makkelijkst van GitHub.

1. Maak een gratis account op [github.com](https://github.com).
2. Klik op **New repository**, naam `stock-cantine`, zet hem op **Private**, klik **Create repository**.
3. Klik op **uploading an existing file** en sleep **de inhoud** van deze map erin (alle bestanden en mappen: `app`, `components`, `lib`, `supabase`, `package.json`, …). Klik **Commit changes**.

> Werk je liever met de terminal? `git init`, `git add .`, `git commit -m "Eerste versie"`, en push naar je nieuwe repository.

### 3. Online zetten met Vercel

1. Maak een gratis account op [vercel.com](https://vercel.com) en log in met GitHub.
2. Klik op **Add New… → Project** en kies je repository `stock-cantine` → **Import**.
3. Open **Environment Variables** en voeg deze vier toe:

   | Naam | Waarde |
   |---|---|
   | `SUPABASE_URL` | de Project URL uit stap 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | de geheime sleutel uit stap 1 |
   | `TEAM_PASSWORD` | het wachtwoord dat je team gaat gebruiken |
   | `AUTH_SECRET` | een lange willekeurige tekst van minstens 32 tekens (zie hieronder) |

   Voor `AUTH_SECRET` kun je bv. een wachtwoordgenerator gebruiken (64 tekens, letters en cijfers), of in een terminal:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

4. Klik op **Deploy**. Na 1–2 minuten krijg je een adres zoals `stock-cantine.vercel.app`.
5. Open het adres, log in met het teamwachtwoord, vul je naam in. Klaar.

### 4. Delen met je team

Stuur het adres en het teamwachtwoord door. Op de gsm kun je de app op het beginscherm zetten:

- **iPhone (Safari):** deelknop → **Zet op beginscherm**
- **Android (Chrome):** menu ⋮ → **Toevoegen aan startscherm**

Je blijft 90 dagen ingelogd op een toestel. Wil je iedereen uitloggen (bv. als iemand vertrekt)? Verander `TEAM_PASSWORD` én `AUTH_SECRET` in Vercel (**Settings → Environment Variables**) en klik daarna op **Deployments → Redeploy**.

---

## Lokaal draaien en aanpassen

Je hebt [Node.js](https://nodejs.org) 18.18 of nieuwer nodig.

```bash
npm install
cp .env.example .env.local     # vul de vier waarden in
npm run dev                    # open http://localhost:3000
```

Pas je iets aan en zet je het op GitHub, dan zet Vercel de nieuwe versie vanzelf online.

### Waar staat wat?

| Wat je wilt aanpassen | Bestand |
|---|---|
| Kleuren, lettertypes, afstanden | `app/globals.css` (bovenaan staan alle kleuren, licht en donker) |
| Categorieën en locaties | `lib/stock.ts` → `CATEGORIES` en `LOCATIONS` |
| Lijst van allergenen | `lib/stock.ts` → `ALLERGENS` |
| Leveranciers (lijst en detail) | `components/Suppliers.tsx`, `components/SupplierSheet.tsx` |
| Allergenen opzoeken | `components/Allergens.tsx` |
| Logboek (teksten en filters) | `components/Logboek.tsx` |
| Het menu "Meer" | `components/Meer.tsx` |
| Hoeveel er voorgesteld wordt om te bestellen | `lib/stock.ts` → `suggestOrder` (nu: aanvullen tot 2× het minimum) |
| Het scherm "Vandaag" | `components/Today.tsx` |
| De stocklijst met −1 | `components/StockList.tsx` |
| Inboeken van leveringen en prep | `components/Inboeken.tsx` |
| Bestellijst en WhatsApp-bericht | `components/Bestellen.tsx` |
| Productdetails en -instellingen | `components/ProductSheet.tsx` |
| Hoe vaak de app ververst (nu elke 15 s) | `components/StockApp.tsx` → `setInterval(tick, 15000)` |
| Database-tabellen | `supabase/schema.sql` |

### Hoe het werkt

- De browser praat alleen met de eigen API-routes in `app/api/…`. Die praten met Supabase via de geheime sleutel, die dus nooit in de browser komt.
- `middleware.ts` controleert bij elke aanvraag of je ingelogd bent; zo niet, ga je naar `/login`.
- **−1** gebeurt in één databasefunctie (`use_one` in `schema.sql`) die altijd aftrekt van de levering die het eerst vervalt. Twee mensen die tegelijk tikken, botsen dus niet.
- Een levering die op 0 komt, wordt verwijderd. Elke wijziging heeft een knop **Ongedaan** in de melding onderaan.
- De app ververst elke 15 seconden en telkens je ze terug opent, zodat je ziet wat collega's deden.
- Elke wijziging komt in het logboek (tabel `activity_log`) met de naam die op dat toestel is ingevuld. Het logboek toont de laatste 400 acties. Wil je oude regels opkuisen, dan kan dat in de SQL Editor met:
  `delete from activity_log where created_at < now() - interval '1 year';`
- Een WhatsApp-bestelling naar een leverancier gaat naar zijn telefoonnummer (Belgische nummers zoals 0475 … worden automatisch omgezet). Een vast nummer zonder WhatsApp opent gewoon een lege chat; kopieer dan de lijst of mail ze.

---

## Problemen

| Wat je ziet | Oplossing |
|---|---|
| "De stock kon niet geladen worden" | `SUPABASE_URL` of `SUPABASE_SERVICE_ROLE_KEY` klopt niet, of `schema.sql` (of `update-1.sql`) is niet uitgevoerd. Pas aan in Vercel en klik **Redeploy**. |
| Logboek laadt niet of blijft leeg | `update-1.sql` is nog niet uitgevoerd in Supabase. |
| "TEAM_PASSWORD is niet ingesteld" | Voeg `TEAM_PASSWORD` toe in Vercel en klik **Redeploy**. |
| Inloggen lukt, maar je komt telkens terug op de loginpagina | `AUTH_SECRET` ontbreekt of is korter dan 32 tekens. |
| "Dit product bestaat al" | Er is al een product met die naam (hoofdletters tellen niet mee). |
| Supabase-project staat op pauze | Gratis projecten pauzeren na een week zonder gebruik. Open het project in Supabase en klik **Restore**. Bij dagelijks gebruik gebeurt dit niet. |
# stock-cantine
