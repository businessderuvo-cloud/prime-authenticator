# PRIME Authenticator

## PRIME Mobile — gestionale Android e iOS

Il gestionale mobile nativo si trova nella cartella [`mobile/`](mobile/README.md), separato da PRIME Authenticator. Include switch Demo/Live e collegamento alla demo pubblica PRIME senza credenziali. È una prima versione: i pagamenti reali e diverse funzioni avanzate richiedono ancora completamento.

[APK PRIME Mobile Android 0.2.1](https://github.com/businessderuvo-cloud/prime-authenticator/releases/tag/mobile-android-v0.2.1) · [Compilazione APK](https://github.com/businessderuvo-cloud/prime-authenticator/actions/workflows/prime-mobile-apk.yml)

La compilazione del gestionale ha un processo dedicato e non modifica gli APK o le firme di Authenticator.

## App Android nativa 1.0.2

[Scarica APK Android](https://github.com/businessderuvo-cloud/prime-authenticator/releases/download/android-v1.0.2/prime-authenticator-android-v1.0.2.apk)

Schermate, archivio, codici TOTP, fotocamera e sblocco sono eseguiti dall’app sul telefono. La versione Android 1.0.2 non contiene WebView, Custom Tabs o TWA e non avvia Chrome. Android 7 o successivo.

- Archivio locale AES-256-GCM, password derivata con PBKDF2-HMAC-SHA256 (600.000 iterazioni).
- Impronta o volto con Android BiometricPrompt e chiave Android Keystore vincolata a una verifica biometrica per operazione. La biometria deve essere registrata nelle impostazioni Android; il riconoscimento del volto è disponibile se Android lo classifica come biometria forte.
- QR tramite fotocamera in verticale e codici TOTP utilizzabili offline.
- Abbinamento e approvazione degli accessi QR PRIME tramite API HTTPS, con firma ECDSA P-256 del dispositivo.
- Blocco all’uscita dall’app e dopo un minuto di inattività.
- Backup cifrato compatibile con l’archivio della precedente versione web.

Con la biometria già attiva, la richiesta del sensore appare automaticamente all’apertura e al ritorno nell’app. Annullando puoi usare la password; il dialogo non si ripresenta finché non riapri l’app o premi il pulsante per riprovare.

### Passaggio dalla versione precedente

Aggiorna direttamente gli APK 0.4.0/0.4.1: la firma Android è la stessa. Il vecchio archivio era nel profilo del browser. Esporta un backup cifrato dalla versione web e scegli **Importa backup cifrato** nell’app nativa, poi inserisci la password del backup. Dopo lo sblocco premi **Attiva biometria sul telefono**.

La vecchia build debug 0.3.1 usava un’altra firma e va disinstallata prima di installare questa versione.

## iPhone, iPad e browser

La distribuzione disponibile per iOS è ancora la [PWA installabile](https://primegestionale.it/authenticator/). Non è un’app iOS nativa e non è pubblicato un IPA. Su iPhone: Safari → Condividi → Aggiungi alla schermata Home.

## Sorgenti e verifiche

Il progetto Android nativo si trova in `android/`. GitHub Actions compila la build firmata ed esegue su emulatore Android i test di cifratura, password errata, manomissione, compatibilità backup web, TOTP RFC 6238, firme P-256, validazione QR e interfaccia nativa. Il collaudo comprende scanner verticale e, con il sensore simulato dell’emulatore, attivazione biometrica, impronta errata, annullamento, sblocco e chiave inutilizzabile senza una nuova autenticazione. La fotocamera fisica e il sensore biometrico ZTE richiedono la prova sul dispositivo.

Il sorgente PWA rimane nella radice. [Archivio PWA 0.4.1](https://github.com/businessderuvo-cloud/prime-authenticator/releases/download/android-v0.4.1/prime-authenticator-pwa-v0.4.1.zip).

Il backend PRIME non riceve password dell’archivio o dati biometrici. Per i componenti di terze parti vedere `THIRD_PARTY_NOTICES.md`.
