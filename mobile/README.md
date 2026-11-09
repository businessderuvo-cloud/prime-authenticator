# PRIME Mobile — prima versione nativa

App React Native / Expo per Android e iOS. Nessuna WebView e nessuna schermata HTML del gestionale. Il logo originale fornito è in `assets/prime-logo.png`.

## Cosa è implementato

- Switch Demo / Live con client, cookie e dati separati.
- Demo pubblica reale: inizializzazione della sessione già presente su `https://www.primegestionale.it/demo/`, senza credenziali. Il documento iniziale serve unicamente a ottenere la sessione, non viene mostrato.
- Home, immobili, contatti, agenda, ricerca e schede in consultazione tramite le API esistenti.
- Cambio dei cinque piani nella demo, senza acquisti.
- Login Live, creazione account, richiesta recupero password e verifica 2FA TOTP/email/SMS; sessione conservata nel portachiavi del dispositivo con SecureStore.
- Stato KYB e avvio/aggiornamento della verifica aziendale tramite gli endpoint esistenti. **La raccolta documenti attuale apre il servizio esterno nel browser di sistema**; il gestionale rimane nativo. Per una verifica interamente interna occorre integrare e validare lo SDK nativo del provider.
- Sezione Piani e adattatore di acquisto nativo Apple / Google, prezzi restituiti dallo store e ripristino acquisti. Il client non attiva piani localmente.

## Stato reale e attività ancora necessarie

Questa è una prima versione nativa di prova. Il progetto è pubblicato nella cartella `mobile/` del repository `businessderuvo-cloud/prime-authenticator`; il processo dedicato `PRIME Mobile APK` genera l’APK autonomo e lo pubblica nella release `mobile-android-v0.1.0`. Stato della compilazione e disponibilità del file sono verificabili su GitHub. Non copre ancora tutte le funzioni del gestionale web: modifica delle schede, documenti, integrazioni, telefonia, assistenti, notifiche e operazioni avanzate richiedono ulteriori schermate native.

Gli account sviluppatore Apple e Google Play sono ancora da creare, come confermato dall’utente. Non esistono ancora prodotti store configurati o acquisti reali verificati. Il gestionale attuale non espone gli endpoint `/api/mobile/store/*`: **il completamento e la pubblicazione del backend di acquisto sono ancora necessari**. Il client mostra chiaramente l’indisponibilità e non addebita denaro in questa situazione.

Login, 2FA e KYB sono collegati agli endpoint letti nel sorgente esistente; non sono stati provati con credenziali reali o documenti personali. Gestione dei cookie e portachiavi devono essere provati su entrambi i sistemi operativi. Nessuna modifica è stata pubblicata al gestionale esistente.

L’identificatore provvisorio dell’app è `it.primegestionale.mobile`: verificarne disponibilità e titolarità prima di creare i prodotti negli store. Il logo allegato è molto piccolo (73×43): occorre una versione ufficiale ad alta risoluzione per l’icona finale degli store; non è stata inventata un’icona sostitutiva.

## Esecuzione e build

Serve Node LTS. Il progetto include `package-lock.json`.

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run prebuild
npm run android
```

Per iOS: `npm run ios` su macOS con Xcode, oppure una build EAS con account configurato. Per Android serve Android SDK / JDK oppure una build EAS. Gli acquisti richiedono un development build o una build store, non Expo Go. Il progetto non ha una destinazione web.

```sh
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile production
```

Il profilo Android preview genera un APK dopo l’autenticazione e la configurazione delle firme; per gli acquisti occorre distribuzione di test tramite lo store. L’account Apple serve per le firme e la distribuzione iOS.

## Contratto backend degli acquisti da implementare

Tutti gli endpoint sono solo Live, autenticati, con controllo CSRF; nessuno è disponibile nella demo. Gli endpoint devono autorizzare il titolare dell’agenzia. Non copiare il client come prova di pagamento.

1. `GET /api/mobile/store/config?platform=ios|android`: ritorna `{ enabled, reason?, products: [{ plan, name, productId, period: 'monthly'|'annual' }], accountToken }`. `enabled` deve essere falso finché verifica server, notifiche e catalogo non sono pronti. `accountToken` è un UUID stabile generato sul server per la specifica agenzia, mai scelto dal client.
2. `POST /api/mobile/store/intent` con `{platform,productId}`: verifica utente, titolare, KYB, id prodotto autorizzato e abbonamento già attivo (anche acquistato sul sito); evita doppi abbonamenti e gestisce cambio piano. Ritorna `{allowed,accountToken,offerToken?}`; l’offerta Android deve appartenere al prodotto e alla periodicità richiesti.
3. `POST /api/mobile/store/verify` con `{platform,purchase}`: verifica la transazione direttamente con Apple/Google, bundle/package, ambiente, stato acquistato, prodotto, scadenza, accountToken e associazione all’agenzia. Non fidarsi di prezzo/stato/piano passati dal telefono. Vincoli unici su transactionId/originalTransactionId e purchaseToken impediscono riuso tra agenzie. Attivazione del piano e registrazione dell’evento devono essere atomiche e idempotenti nel database PRIME. Ritorna `{verified,active}` solo dopo la conferma effettiva. Gestire anche approvazione differita e retry senza perdere gli acquisti pendenti.
4. Notifiche server Apple e Google: rinnovi, disdette, revoche, rimborsi, sospensioni, grace period e riconciliazione. Il server deve riconoscere/acknowledge gli acquisti Google in tempo anche se il telefono si chiude prima di `finishTransaction`.
5. Ripristino e cambi account devono mantenere l’acquisto legato all’agenzia originaria; un account store condiviso non autorizza il trasferimento dell’abbonamento. Configurare URL reali di privacy, condizioni e gestione/disdetta abbonamento prima della distribuzione.

Gli acquisti non devono aggirare il KYB o trasformare una verifica sandbox in approvazione Live. Prezzi fiscali, periodicità, gruppo di abbonamento e offerte vanno configurati dopo la creazione degli account. Secret resta su preventivo finché non viene definito un prodotto acquistabile.

## Verifica effettuabile

`npm test` controlla isolamento delle sessioni, CSRF, cancellazione delle credenziali al logout e gestione degli errori di rete. Per un round trip contro la demo pubblica:

```powershell
$env:PRIME_LIVE_SMOKE='1'
npm test
```

Non inserire credenziali Live, documenti o chiavi dei provider nel progetto.

### Risultati di questa consegna

Il round trip pubblico ha verificato creazione della sessione, lettura di immobili/contatti/appuntamenti, passaggio Standard → Pro → VIP → Elite → Secret → Standard e logout. I controlli automatici includono anche il blocco dei pagamenti in demo, il rifiuto del pagamento senza autorizzazione del server o con un’altra agenzia e il mancato riconoscimento di transazioni non verificate. I bundle JavaScript nativi sono un controllo di compilazione, non APK/IPA e non una prova su telefono.

La distribuzione APK è gestita da un workflow GitHub separato da Authenticator, con verifica della firma, dell’identificatore `it.primegestionale.mobile` e del bundle incluso nell’APK. Il pacchetto di prova è firmato con la chiave di sviluppo del progetto; la pubblicazione Google Play richiede una firma di produzione. iOS richiede la compilazione nativa su macOS/EAS e non è ancora disponibile un IPA. La prova su telefono fisico resta da eseguire. L’analisi delle dipendenze segnala avvisi moderati nella catena degli strumenti Expo e di controllo del codice; la proposta automatica di correzione comporta cambi di versione e non è stata applicata senza verificarne la compatibilità.

Riferimenti: [Expo](https://docs.expo.dev/get-started/create-a-project/), [acquisti nativi](https://hyochan.github.io/react-native-iap/docs/installation/), [verifica server Google](https://developer.android.com/google/play/billing/security), [regole App Store](https://developer.apple.com/app-store/review/guidelines/).
