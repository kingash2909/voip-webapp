# VoIP-as-a-Service (VaaS)

A professional, high-performance VoIP infrastructure and dashboard designed for SaaS developers. This project provides a robust signaling server, a premium monitoring dashboard, and a plug-and-play JavaScript SDK.

<img width="1470" height="719" alt="Screenshot 2026-03-10 at 2 25 23 PM" src="https://github.com/user-attachments/assets/dcc192ff-547d-424a-bdc8-bee54d84abda" /><img width="1470" height="719" alt="Screenshot 2026-03-10 at 2 25 47 PM" src="https://github.com/user-attachments/assets/6d31de07-881b-4abc-8604-ff8b2609a90d" />
<img width="1470" height="719" alt="Screenshot 2026-03-10 at 2 26 05 PM" src="https://github.com/user-attachments/assets/4653de6c-229d-43f7-96be-72333bb1c992" /><img width="1470" height="719" alt="Screenshot 2026-03-10 at 2 28 42 PM" src="https://github.com/user-attachments/assets/1250908f-b3eb-48eb-bf47-e0dd4958ce94" />


---

## 🏗 System Architecture & Code Flow
<img width="1536" height="1024" alt="voip architecture" src="https://github.com/user-attachments/assets/cff2a523-af89-46f8-8461-9ee4d4346b7e" />

```mermaid
sequenceDiagram
    participant A as User A (Caller)
    participant S as Signaling Server (Django/Redis/Daphne)
    participant B as User B (Callee)


    Note over A,B: 1. Signaling Handshake
    A->>S: WebSocket Connect (Room: test-room, API_KEY: ...)
    B->>S: WebSocket Connect (Room: test-room, API_KEY: ...)
    S-->>A: Connected (Participant List)
    S-->>B: Connected (Participant List)

    Note over A,S: 2. WebRTC Negotiation
    A->>S: Send Offer (SDP)
    S->>B: Forward Offer (SDP)
    B->>S: Send Answer (SDP)
    S->>A: Forward Answer (SDP)

    Note over A,B: 3. ICE Candidate Exchange
    A->>S: ICE Candidate (Network Path)
    S->>B: Forward Candidate
    B->>S: ICE Candidate (Network Path)
    S->>A: Forward Candidate

    Note over A,B: 4. Peer-to-Peer Connection Established
    A<->>B: P2P Secure Media Stream (Audio/Video)
    Note right of S: Server is now idle (no media load)
```

The application operates on a **Signaling-First Architecture** using WebRTC for peer-to-peer media transport.


### 1. Signaling Process (The "Handshake")
Since WebRTC cannot connect two users directly without knowing their IP addresses and capabilities, this project uses a internal **Signaling Server** (Django + Channels + Redis).

1.  **Connection**: A client (Dashboard or SDK) connects via WebSockets to `ws://server/ws/signaling/[room_name]/?api_key=[key]`.

2.  **Presence**: The `signaling/consumers.py` handles the connection, verifies the API Key against the database, and adds the user to a Redis-backed "Group" (the room).

3.  **Offer/Answer**: 
    -   **Peer A** (Caller) generates an **SDP Offer** (local media capabilities) and sends it over the WebSocket.
    -   **Server** broadcasts this offer to **Peer B** (Callee) within the same room.
    -   **Peer B** receives the offer, generates an **SDP Answer**, and sends it back.
    
4.  **ICE Candidates**: Throughout this process, both peers generate "ICE Candidates" (possible network paths). The signaling server relays these candidates until a direct P2P connection is established.


### 2. Media Transport
- Once signaling is complete, the browser takes over. No voice data goes through the Django server (saving you bandwidth).
- **STUN/TURN**: The project is configured with Google's STUN server for local NAT traversal. For restricted corporate networks, the included `voip-configs/install_coturn.sh` script deploys a **TURN Server** to relay media when P2P fails.


### 3. AI Insights (Mocked)
- During a call, the `useWebRTC.js` hook captures audio chunks and sends them to the `/api/calls/upload/` endpoint.
- In production, this can be hooked into OpenAI Whisper or Google Speech-to-Text for real-time transcription.

---

## 🚀 Production Deployment Guide

### 1. Infrastructure Requirements
- **Server**: A Linux VPS (Ubuntu 22.04 recommended).
- **Database**: Migrate from SQLite to **PostgreSQL**.
- **Message Broker**: Use a managed **Redis** instance (e.g., AWS ElastiCache or Redis Labs).
- **TURN Server**: Deploy the included Coturn script on a **separate** public IP if possible to ensure high-quality media relay.

### 2. Security Hardening (Mandatory)
- **CORS**: Update `settings.py` -> `CORS_ALLOWED_ORIGINS` to only allow your specific frontend domain instead of `True`.
- **SSL/HTTPS**: WebRTC **requires** HTTPS. Use Nginx with Certbot (Let's Encrypt).
- **WSS**: Ensure your WebSocket connections use `wss://` (secure) in production.
- **Admin Password**: Change the default admin gate passphrase in `App.jsx` from `admin123` to a secure secret.

### 3. Deployment Steps
```bash
# 1. Clone & Set Environment
cp backend/.env.example backend/.env
# Edit .env with your PRODUCTION_SECRET_KEY and DB_URL

# 2. Setup Gunicorn/Daphne
# Use Daphne as the ASGI server to handle WebSockets
daphne -b 0.0.0.0 -p 8000 core.asgi:application

# 3. Build Frontend
cd frontend-prime
npm run build
# Serve the 'dist' folder via Nginx
```

---

## 🛠 Project Structure Breakdown

| Folder | Responsibility |
| :--- | :--- |
| `/backend` | Django + Channels. Handles room management, history, and API key verification. |
| `/frontend-prime` | React + Framer Motion. The "Glassmorphism" management dashboard. |
| `/sdk` | `voip-sdk.js`. A class-based wrapper for any external JS app to join calls. |
| `/voip-configs` | Automated bash scripts for infrastructure setup. |

---

## � What's Missing? (Roadmap)
To make this a complete commercial SaaS, consider adding:
1.  **User Authentication**: Replace the simple Admin Gate with Django's built-in User/JWT auth for customers.
2.  **Billing Integration**: Add Stripe to charge users per second of call time.
3.  **Mobile Support**: Use the SDK within a React Native or Flutter app (RTCPeerConnection is supported).
4.  **Multi-Party Calls**: Currently optimized for 1-on-1. For 3+ people, you would need an **SFU (Selective Forwarding Unit)** like Janus or Mediasoup.
