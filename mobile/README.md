# PRIME Mobile 0.2.1

App Android/iOS con schermate React Native. L’app usa le API del gestionale e la demo pubblica esistente; non carica il sito in una WebView.

## Workspace

- Menu del gestionale adattato a telefono e tablet; barra rapida per Panoramica, WPS, Agenda e Connect.
- Percorsi vettoriali delle icone e logo tipografico importati dal sito PRIME.
- Icona di avvio Android con il bitmap originale fornito dall’utente, centrato e senza ritagliare le case.
- Selettore Demo/Live e dei cinque piani nella demo.
- Temi Bianco, Pro, Blu VIP, Elite, Secret e anteprime stagionali, salvati con le preferenze della sessione server. I temi disponibili dipendono dal piano.
- Panoramica con contatori, prossime attività, territorio, appuntamenti, scadenze e qualità delle schede.
- Diciannove tipi di schede con campi originali, creazione/modifica e riferimenti alle altre schede, inclusi gli agenti. Il server conserva autorizzazioni e controllo delle versioni.
- Ricerca generale via API; territorio e mappa nativa su cartografia OpenStreetMap.
- PRIME Connect e sezioni dedicate ai servizi; visualizzazione dello stato reale di configurazione e collegamento. OAuth dei servizi supportati si apre nell’autorizzazione esterna del provider.
- Conti e movimenti Wallester dimostrativi provenienti dalla stessa API della demo del sito.
- Portali immobiliari con preparazione delle bozze, registro attività, account e chat testuale collegati agli endpoint esistenti.

## Limiti ancora presenti

La copertura funzionale non è ancora identica al sito in ogni dettaglio. Le operazioni specialistiche dei provider, l’upload dei file, le firme, le funzioni telefoniche/copilot e alcuni flussi avanzati richiedono ulteriore sviluppo nativo. Il controllo di configurazione in Connect non equivale a un test riuscito del provider. Le autorizzazioni e i test con account reali restano necessari.

Login, 2FA e KYB usano gli endpoint esistenti; i documenti KYB e gli accessi OAuth aprono il servizio esterno. Non sono state usate credenziali Live o documenti personali per il collaudo. Nessuna modifica è stata pubblicata al gestionale PRIME.

Gli acquisti dei piani restano disabilitati: l’utente deve ancora creare gli account sviluppatore Apple/Google. Servono prodotti store e endpoint server `/api/mobile/store/config`, `/intent`, `/verify`, con verifica diretta Apple/Google, controllo KYB e titolare, associazione univoca all’agenzia e gestione di rinnovi/rimborsi/revoche. Il client non abilita mai un piano a partire dal solo esito locale del pagamento. Secret resta su preventivo.

L’APK è una build di prova firmata con la chiave di sviluppo, per Android 7+ a 64 bit. Le release di Authenticator rimangono separate. iOS ha il sorgente nativo ma non dispone ancora di un IPA firmato. Per una futura pubblicazione store occorrono firma definitiva e logo ad alta risoluzione: quello fornito misura 73×43 pixel.

## Verifiche e build

```sh
npm ci
npm run typecheck
npm run lint
npm test
npx expo prebuild --platform android --no-install
```

Con `PRIME_LIVE_SMOKE=1`, il test visita la demo pubblica, cambia piani e otto temi, crea/modifica una scheda e legge Connect, conti e movimenti Wallester. I test di sicurezza coprono separazione degli ambienti, CSRF, logout, rifiuto degli acquisti in demo, rifiuto delle transazioni non verificate e del cambio agenzia.

Il workflow GitHub `PRIME Mobile APK` compila e verifica il pacchetto, quindi avvia un emulatore Android e controlla apertura della demo, selezione piano, tema, menu e Connect. Salva screenshot e verifiche nell’artefatto; pubblica la release solo dopo il superamento dei controlli. La prova sul telefono fisico dell’utente rimane distinta.

Per sviluppo locale Android servono JDK e SDK Android; per iOS Xcode/macOS oppure EAS. Gli acquisti richiedono una build nativa, non Expo Go. Le dipendenze degli strumenti presentano avvisi moderati da rivalutare prima della pubblicazione di produzione.
