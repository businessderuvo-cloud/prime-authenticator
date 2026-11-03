# PRIME Authenticator

## App Android nativa 1.0.0

[Scarica APK Android](https://github.com/businessderuvo-cloud/prime-authenticator/releases/download/android-v1.0.0/prime-authenticator-android-v1.0.0.apk)

Schermate, archivio, codici TOTP, fotocamera e sblocco sono eseguiti dall’app sul telefono. La versione Android 1.0.0 non contiene WebView, Custom Tabs o TWA e non avvia Chrome. Android 7 o successivo.

- Archivio locale AES-256-GCM, password derivata con PBKDF2-HMAC-SHA256 (600.000 iterazioni).
- Impronta o volto con Android BiometricPrompt e chiave Android Keystore vincolata a una verifica biometrica per operazione. La biometria deve essere registrata nelle impostazioni Android; il riconoscimento del volto è disponibile se Android lo classifica come biometria forte.
- QR tramite fotocamera e codici TOTP utilizzabili offline.
- Abbinamento e approvazione degli accessi QR PRIME tramite API HTTPS, con firma ECDSA P-256 del dispositivo.
- Blocco all’uscita dall’app e dopo un minuto di inattività.
- Backup cifrato compatibile con l’archivio della precedente versione web.

### Passaggio dalla versione precedente

Aggiorna direttamente gli APK 0.4.0/0.4.1: la firma Android è la stessa. Il vecchio archivio era nel profilo del browser. Esporta un backup cifrato dalla versione web e scegli **Importa backup cifrato** nell’app nativa, poi inserisci la password del backup. Dopo lo sblocco premi **Attiva biometria sul telefono**.

La vecchia build debug 0.3.1 usava un’altra firma e va disinstallata prima di installare questa versione.

## iPhone, iPad e browser

La distribuzione disponibile per iOS è ancora la [PWA installabile](https://primegestionale.it/authenticator/). Non è un’app iOS nativa e non è pubblicato un IPA. Su iPhone: Safari → Condividi → Aggiungi alla schermata Home.

## Sorgenti e verifiche

Il progetto Android nativo si trova in `android/`. GitHub Actions compila la build firmata ed esegue su emulatore Android i test di cifratura, password errata, manomissione, compatibilità backup web, TOTP RFC 6238, firme P-256, validazione QR e interfaccia nativa. La scansione di una fotocamera fisica e il sensore biometrico ZTE richiedono la prova sul dispositivo.

Il sorgente PWA rimane nella radice. [Archivio PWA 0.4.1](https://github.com/businessderuvo-cloud/prime-authenticator/releases/download/android-v0.4.1/prime-authenticator-pwa-v0.4.1.zip).

Il backend PRIME non riceve password dell’archivio o dati biometrici. Per i componenti di terze parti vedere `THIRD_PARTY_NOTICES.md`.