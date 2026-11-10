# PRIME native: requisiti di corrispondenza al web

L’APK 0.2.4 non soddisfa la richiesta di parità completa. Questa ricostruzione non è pronta per una nuova consegna.

## Vincoli di consegna

- Android/iOS nativi, nessuna WebView.
- Stesse icone vettoriali, loghi, ritratto Vanessa, nomi, categorie, colori e regole di accesso della versione web corrente; impaginazione adattata al telefono.
- Demo pubblica senza credenziali; piano, tema e attivazione dati fittizi seguono il gestionale.
- Le pagine dei servizi compaiono solo dopo attivazione demo o collegamento Live secondo le regole del web.
- Biometria facoltativa sul dispositivo; 2FA Live Authenticator/SMS/chiamata con policy uno qualsiasi/tutti.
- Vanessa vocale continua in background; controllo e notifica della sessione; spettro nascosto senza audio collegato.
- Escludere solo il browser assistito.
- Nessun nuovo APK dichiarato completo prima del confronto e della verifica delle funzioni sottostanti.
- Incrementare versione, build Android/iOS, tag e nome APK a ogni consegna.

## Verifica delle aree

| Area | Evidenza attuale | Lavoro ancora richiesto |
| --- | --- | --- |
| Menu e icone | JSON di icone/schema importati dal sito | Confrontare tutte le voci, pulsanti e azioni; rimuovere simboli sostitutivi |
| Temi | Otto palette native | Confrontare token CSS correnti, temi speciali ed effetti della demo |
| Agenda | Calendario mobile | Confrontare viste, navigazione, filtri, creazione/modifica e permessi |
| Schede CRM | Moduli generici | Confrontare dettagli, relazioni, filtri, allegati, documenti e azioni specifiche |
| Stripe | Importi demo e curva disegnata localmente | Usare la stessa fonte dati e tutte le azioni/grafici del web |
| Wallester | Conti/movimenti API; curva illustrativa | Riprodurre carte, movimenti, filtri, grafici e azioni del web |
| Connect | Categorie e loghi locali | Confrontare configurazione, stato, test e attivazione di ciascun provider |
| Vanessa chat | WebSocket e proposte CRM | Confrontare saluto, scorciatoie, allegati e messaggi ricchi |
| Vanessa voce | WebRTC nativo e foreground service | Verificare telefono fisico, blocco schermo, cambio app e interruzioni |
| Copilot testuale | Solo trascrizione manuale nella 0.2.4 | Acquisire entrambi i canali telefonici live come il web |
| Copilot vocale | Assente nella 0.2.4 | Implementare suggerimenti testo/voce/entrambi durante chiamata |
| Copilot interprete | Assente nella 0.2.4 | Collegare i canali distinti e traduzione bidirezionale, con regole piano |
| Coda chiamate | Aggiunta in lavorazione | Verificare selezione numeri, autorizzazione, avvio, annullo e trascrizioni |
| Consumi Vanessa | Aggiunti in lavorazione | Confrontare quote, ciclo, extra e storico |
| Impostazioni Vanessa | Aggiunte in lavorazione | Completare numeri, agenti aggiuntivi, voci e permessi |
| Sicurezza | Biometria e configurazione 2FA native | Verificare enrollment/accesso/revoca, policy e sessione sul dispositivo |
| Piani/acquisti | Acquisti disabilitati | Account store mancanti; prodotti e verifica server Apple/Google ancora necessari |
| Mail, firme, portali | Copertura parziale | Confrontare singole operazioni, documenti e provider reali |

## Evidenze necessarie per chiudere

Per ogni area: riferimento al componente web corrente, schermata nativa corrispondente, endpoint e permessi usati, prova demo, prova Live quando applicabile e riscontro visivo sul telefono. Un pulsante presente o una risposta configurata non equivalgono a una funzione verificata.
