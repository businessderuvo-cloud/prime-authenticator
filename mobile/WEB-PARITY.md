# PRIME Mobile · stato versione 0.2.9 (build 11)

Questa versione amplia la ricostruzione nativa del gestionale. È React Native, non usa una WebView e omette il browser assistito. La consegna è una build di verifica: la parità completa non è ancora dimostrata su telefono e non va presentata come completata.

## Copertura implementata

| Area | Comportamento nativo | Stato e limite verificabile |
| --- | --- | --- |
| Menu e icone | Sezioni divise per tipologia; icone e loghi importati dagli asset PRIME | Manca il confronto schermata per schermata con ogni voce e azione del sito |
| Temi | Otto palette, incluse VIP blu scuro, Elite, Secret e temi speciali | Natale è verde bosco e oro su richiesta; animazioni/decorazioni stagionali del web non sono replicate |
| Agenda | Calendario mobile con navigazione mensile e dati appuntamento | Restano da confrontare filtri, permessi e tutte le azioni CRUD sul telefono |
| CRM | Schede e moduli basati sullo schema del gestionale | Restano da verificare relazioni, file, documenti e azioni specifiche di ogni scheda |
| Stripe | Scheda nativa con report, grafici, pagamenti, rimborsi, link, fatture, carte e bonifici demo | I dati demo sono simulati; le azioni Live dipendono dalla configurazione Stripe e dal ruolo server |
| Wallester | Grafici e filtri finanziari, saldi, movimenti, documenti, carte e catalogo operazioni Live | La demo pubblica espone dati analitici fittizi in sola lettura: le API pubbliche carte/operazioni rispondono 404. Le azioni demo in app sono locali e non trasferiscono denaro |
| Connect | Categorie di provider, loghi, stato e attivazione demo; pagine nascoste finché il servizio non è abilitato | Connessioni reali da verificare per ogni provider e account |
| Vanessa | Chat nativa, allegati, Copilot telefonico testuale/vocale e interprete Live con regole piano | Nessuna prova su telefono con chiamata reale, blocco schermo, cambio app o interruzioni audio |
| Sicurezza | Sblocco biometrico facoltativo; configurazione Live SMS, chiamata, Authenticator e policy uno/tutti | Registrazione, recupero e revoca dei fattori non verificati su account reali |
| Piani | UI nativa per selezione/acquisto | Pagamenti store reali bloccati finché non sono creati gli account sviluppatore Apple/Google e configurati prodotti e verifica server |

## Verifiche eseguite

- `npx tsc --noEmit`, `npx expo lint` e `npm test` completati senza errori.
- Test di integrazione sulla demo pubblica completato: accesso anonimo, cambio dei cinque piani, temi, lettura/creazione/aggiornamento di dati dimostrativi, Connect e Wallester.
- Test Copilot automatizzati: isolamento della sessione demo/live, consenso, trascrizione e rilascio delle risorse.
- La compilazione locale Windows non ha prodotto l’APK: il task di `react-native-audio-api` avvia uno script POSIX che, in questa installazione Git Bash, non trova `dirname`, `mkdir` e `rm`. La pipeline Linux GitHub è il percorso di build configurato.
- Le build 0.2.6, 0.2.7 e 0.2.8 hanno superato compilazione e firma. La 0.2.6 aveva un tap demo ambiguo; la 0.2.7 ha confermato l’attivazione Stripe e individuato che il test non scorreva fino al grafico; la 0.2.8 corregge lo scroll. Il suo test emulatore si è però interrotto prima di aprire l’app perché UiAutomator ha restituito un root node vuoto; la 0.2.9 ritenta il dump gerarchia prima di segnare il test come fallito.
- Telefono fisico/iPhone non verificati.

## Requisiti prima della dicitura “parità completa”

1. Confronto visivo sullo stesso piano e tema per ogni pagina, icona e stato del sito.
2. Verifica su Android fisico e iPhone di calendario, allegati, biometria, chiamata in background, Copilot, interprete e interruzioni audio.
3. Verifica Live dei provider e delle API operative, senza confondere dati simulati con chiamate reali.
4. Configurazione degli account/prodotti Apple e Google prima di abilitare acquisti store.
5. Conferma delle API Wallester operative nel gestionale: la demo pubblica corrente restituisce 404 per catalogo operazioni e carte.
