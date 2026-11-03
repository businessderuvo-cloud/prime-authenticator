# PRIME Authenticator

Versione web installabile 0.3.0, pubblicata per Android, iPhone/iPad e browser desktop.

**Installazione diretta:** [primegestionale.it/authenticator](https://primegestionale.it/authenticator/)

Questa distribuzione è una Progressive Web App (PWA). Si installa dal browser e usa l’origine primegestionale.it per le API di abbinamento e approvazione QR.

## Android

1. Apri il link d’installazione in Chrome.
2. Scegli **Installa app**; se non compare, apri il menu e seleziona **Installa app** o **Aggiungi a schermata Home**.

## iPhone e iPad

1. Apri il link in Safari.
2. Premi **Condividi** → **Aggiungi alla schermata Home** e abilita **Apri come app web** se proposto.

## Altri browser

Su Chrome ed Edge usa il comando di installazione del browser. Firefox e Safari desktop possono eseguire la PWA nel browser; l’installazione come app dipende dal browser e dal sistema.

## Funzioni

- Abbinamento del dispositivo e approvazione dell’accesso PRIME tramite scansione QR.
- Archivio TOTP cifrato localmente e codici utilizzabili offline.
- Sblocco biometrico tramite passkey del dispositivo, dove browser e sistema supportano WebAuthn PRF; password dell’archivio come alternativa.
- Revoca dei dispositivi da PRIME → Sicurezza account.

Il sistema operativo può offrire il PIN/codice del dispositivo come verifica utente. I dati biometrici non vengono inviati a PRIME.

## Download GitHub

[Scarica l’archivio sorgente PWA](https://github.com/businessderuvo-cloud/prime-authenticator/releases/latest/download/prime-authenticator-pwa-v0.3.0.zip)

L’archivio GitHub contiene i file web dell’app. **Non è un APK Android né un IPA iOS e non si installa aprendolo**: per installare sul telefono usa il link HTTPS qui sopra e segui i passaggi Android o iPhone.

## Note tecniche

L’approvazione QR richiede la connessione al servizio PRIME e deve essere avviata dal dominio primegestionale.it. L’archivio cifrato è locale e vincolato all’origine dell’app; un archivio creato su un’altra origine non sostituisce quello dell’app pubblica.

Per la libreria QR di terze parti vedere [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
