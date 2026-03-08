/**
 * Vocalis VoIP SDK v1.0
 * Simplified WebRTC for SaaS Builders.
 */
class VoIPClient {
    constructor(config) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || 'ws://localhost:8000';
        this.roomName = null;
        this.socket = null;
        this.pc = null;
        this.localStream = null;
        this.onIncomingCall = config.onIncomingCall || (() => { });
        this.onCallAccepted = config.onCallAccepted || (() => { });
        this.onRemoteStream = config.onRemoteStream || (() => { });
        this.onCallEnded = config.onCallEnded || (() => { });
        this.iceQueue = [];
    }

    async connect(roomName) {
        this.roomName = roomName;
        const url = `${this.baseUrl}/ws/signaling/${roomName}/?api_key=${this.apiKey}`;
        this.socket = new WebSocket(url);

        return new Promise((resolve, reject) => {
            this.socket.onopen = () => {
                console.log('VoIP: Connected to signaling');
                resolve();
            };
            this.socket.onerror = (e) => reject(new Error('Signaling connection failed'));
            this.socket.onmessage = (e) => this._handleSignal(JSON.parse(e.data));
            this.socket.onclose = () => this.onCallEnded();
        });
    }

    async startCall() {
        console.log('VoIP: Initiating call...');
        await this._setupPeerConnection();
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.socket.send(JSON.stringify({ type: 'offer', offer }));
    }

    async endCall() {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'hangup' }));
        }
        this._cleanup();
    }

    async _setupPeerConnection() {
        this.pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        this.pc.onicecandidate = (e) => {
            if (e.candidate) {
                this.socket.send(JSON.stringify({ type: 'candidate', candidate: e.candidate }));
            }
        };

        this.pc.ontrack = (e) => this.onRemoteStream(e.streams[0]);

        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream));
    }

    async _handleSignal(data) {
        if (data.type === 'offer') {
            this.onIncomingCall();
            await this._setupPeerConnection();
            await this.pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            await this._processIceQueue();
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            this.socket.send(JSON.stringify({ type: 'answer', answer }));
        } else if (data.type === 'answer') {
            await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            await this._processIceQueue();
            this.onCallAccepted();
        } else if (data.type === 'candidate') {
            if (this.pc?.remoteDescription) {
                await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } else {
                this.iceQueue.push(data.candidate);
            }
        } else if (data.type === 'hangup') {
            this._cleanup();
            this.onCallEnded();
        }
    }

    async _processIceQueue() {
        while (this.iceQueue.length > 0) {
            const cand = this.iceQueue.shift();
            await this.pc.addIceCandidate(new RTCIceCandidate(cand));
        }
    }

    _cleanup() {
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        this.iceQueue = [];
    }
}

window.VoIPClient = VoIPClient;
