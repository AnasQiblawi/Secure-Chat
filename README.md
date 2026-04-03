# Secure Anonymous Chat

A zero-knowledge, ephemeral, end-to-end encrypted chat application designed for absolute privacy.

## Overview
This application is designed with **anonymity and zero-knowledge architecture** in mind. The central server acts purely as a "dumb" relay pipe for encrypted packets. It explicitly avoids using a database and does not require passwords or central authentication. This means there is no Personally Identifiable Information (PII) handled by the server, and no chat logs or user records that can be seized or leaked.

## Features
- **True End-to-End Encryption:** Messages are encrypted locally on the browser.
    - **Session Key Exchange:** Handled via Asymmetric Encryption (RSA/JSEncrypt).
    - **Message Payload Crypto:** Handled via Symmetric Encryption (CryptoJS/AES) for performance.
    - **Authenticity:** Digital Signatures guarantee the sender authored the message and it hasn't been tampered with.
- **Ephemeral Server:** Active users are stored in a simple, volatile memory `Map`. Rebooting or terminating the server instantly destroys all traces of the current network state.
- **Local Client State:** Your Identity (Keys) and Chat History are saved exclusively on your own browser using IndexedDB (`localforage`).
- **Data Portability:** You can cleanly export your Identity and Chat History to a local JSON file and import it on a different device to seamlessly resume your sessions.
- **Identity Verification (Safety Numbers):** Mitigate Man-in-the-Middle (MITM) attacks by verifying a user’s 32-character Safety Number (SHA-256 fingerprint of their public key) out-of-band before communicating.
- **Ghost Mode:** Connect to the server and chat privately while hiding your presence from the public online user list.

## Quick Start
1. Clone or download the repository.
2. Install dependencies:
    ```bash
    npm install
    ```
3. Run the server:
    ```bash
    npm start
    ```
4. Open the app in your browser at `http://localhost:3000`.

## Threat Model & Usage Notes
- Anyone can pick any username. The security model relies entirely on **Identity Verification**—ensure you verify the Safety Number of your contact out-of-band before deciding they are who they claim to be.
- If you lose your locally stored keys and do not have an exported backup, your identity and chat history cannot be recovered under any circumstances.
