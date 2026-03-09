import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

export const useWebRTC = (roomName, apiKeyInput = null) => {
    const [status, setStatus] = useState('Idle');
    const [apiKey, setApiKey] = useState(apiKeyInput);
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [inCall, setInCall] = useState(false);
    const [logs, setLogs] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [liveAiInsight, setLiveAiInsight] = useState("AI: Monitoring session start...");

    useEffect(() => {
        if (apiKeyInput) {
            setApiKey(apiKeyInput);
        } else {
            // Fetch the default developer API key from the backend
            const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
            fetch(`${apiUrl}/api/project/apikey/`)
                .then(res => res.json())
                .then(data => {
                    if (data.api_key) setApiKey(data.api_key);
                })
                .catch(err => console.error('Failed to fetch API key:', err));
        }
    }, [apiKeyInput]);

    const socketRef = useRef(null);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const iceQueueRef = useRef([]);
    const remoteAudioRef = useRef(new Audio());

    const recorderRef = useRef(null);
    const chunksRef = useRef([]);

    const log = useCallback((msg) => {
        setLogs(prev => [`${new Date().toLocaleTimeString()}: ${msg}`, ...prev].slice(0, 50));
        console.log(msg);
    }, []);

    const uploadRecording = useCallback(async (blob) => {
        const formData = new FormData();
        formData.append('audio', blob, `call_${Date.now()}.webm`);
        formData.append('room', roomName);

        try {
            log('Uploading recording for AI processing...');
            const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
            const res = await fetch(`${apiUrl}/api/calls/upload/`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            log(`Call logged with ID: ${data.id}. AI processing started.`);
        } catch (err) {
            log('Recording upload failed: ' + err);
        }
    }, [roomName, log]);

    const stopRecording = useCallback(() => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
            recorderRef.current.stop();
            log('Recording stopped');
        }
    }, [log]);

    const startRecording = useCallback((localStream, remoteStream) => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const dest = ctx.createMediaStreamDestination();

            const localSource = ctx.createMediaStreamSource(localStream);
            const remoteSource = ctx.createMediaStreamSource(remoteStream);

            localSource.connect(dest);
            remoteSource.connect(dest);

            const recorder = new MediaRecorder(dest.stream);
            recorderRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                uploadRecording(blob);
            };

            recorder.start();
            log('Call recording started');
        } catch (e) {
            log('Recording setup failed: ' + e);
        }
    }, [uploadRecording, log]);

    const endCall = useCallback((sendSignal = true) => {
        stopRecording();

        if (sendSignal && socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'hangup' }));
        }

        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
        }

        iceQueueRef.current = [];
        setInCall(false);
        setIsMuted(false);
        setLiveAiInsight("AI: Session summary available in history.");
        setStatus('Call Ended');
        log('Call ended locally');
    }, [stopRecording, log]);

    const setupPeerConnection = useCallback(async () => {
        log('Setting up Peer Connection...');
        const pc = new RTCPeerConnection(ICE_CONFIG);
        pcRef.current = pc;

        pc.onicecandidate = (event) => {
            if (event.candidate && socketRef.current) {
                socketRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            }
        };

        pc.ontrack = (event) => {
            log('Remote track received');
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch(e => log('Autoplay block: click to play audio'));

            // Start recording once we have both local and remote streams
            if (localStreamRef.current && event.streams[0]) {
                startRecording(localStreamRef.current, event.streams[0]);
            }
        };

        pc.onconnectionstatechange = () => {
            setStatus(`WebRTC: ${pc.connectionState}`);
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                endCall(false);
            }
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            localStreamRef.current = stream;
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
            log('Microphone access granted');
            return true;
        } catch (err) {
            log('Microphone access denied: ' + err);
            return false;
        }
    }, [endCall, log]);

    const processIceQueue = useCallback(async () => {
        log(`Processing ${iceQueueRef.current.length} queued candidates`);
        while (iceQueueRef.current.length > 0) {
            const candidate = iceQueueRef.current.shift();
            try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                log('Error adding queued candidate: ' + e);
            }
        }
    }, [log]);

    const handleOffer = useCallback(async (offer) => {
        log('Incoming offer received');
        setStatus('Incoming Call');
        await setupPeerConnection();
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        await processIceQueue();

        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        socketRef.current.send(JSON.stringify({ type: 'answer', answer }));
        setInCall(true);
    }, [setupPeerConnection, processIceQueue, log]);

    const handleAnswer = useCallback(async (answer) => {
        log('Answer received');
        setStatus('Connected');
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
        await processIceQueue();
        setInCall(true);
    }, [processIceQueue, log]);

    const handleCandidate = useCallback(async (candidate) => {
        if (pcRef.current?.remoteDescription) {
            try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (e) {
                log('ICE candidate error: ' + e);
            }
        } else {
            iceQueueRef.current.push(candidate);
        }
    }, [log]);

    const connectSignaling = useCallback(() => {
        if (!roomName || !apiKey) return;

        const wsUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:8000').replace(/\/$/, '');
        const ws = new WebSocket(`${wsUrl}/ws/signaling/${roomName}/?api_key=${apiKey}`);
        socketRef.current = ws;

        ws.onopen = () => {
            log(`Connected to room: ${roomName}`);
            setIsConnected(true);
            setStatus('Ready');
        };

        ws.onmessage = async (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'offer') await handleOffer(data.offer);
            else if (data.type === 'answer') await handleAnswer(data.answer);
            else if (data.type === 'candidate') await handleCandidate(data.candidate);
            else if (data.type === 'participant_list') {
                setParticipants(data.participants);
                log(`Participants updated: ${data.participants.join(', ')}`);
            }
            else if (data.type === 'hangup') {
                log('Remote peer hung up');
                endCall(false);
            }
        };

        ws.onclose = () => {
            log('Signaling disconnected');
            setIsConnected(false);
            setStatus('Disconnected');
        };
    }, [roomName, apiKey, handleOffer, handleAnswer, handleCandidate, endCall, log]);

    const startCall = async () => {
        log('Initiating call...');
        const success = await setupPeerConnection();
        if (!success) return;

        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);
        socketRef.current.send(JSON.stringify({ type: 'offer', offer }));
        setStatus('Calling...');
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const tracks = localStreamRef.current.getAudioTracks();
            tracks[0].enabled = !tracks[0].enabled;
            setIsMuted(!tracks[0].enabled);
            log(tracks[0].enabled ? 'Unmuted' : 'Muted');
        }
    };

    // Simulate Live AI Insights
    useEffect(() => {
        if (!inCall) return;

        const insights = [
            "AI: Voice clarity is optimal.",
            "AI: Sentiment detected: Professional & Positive.",
            "AI: Suggestion: Mention the upcoming Q1 milestones.",
            "AI: Real-time translation active: English (detected).",
            "AI: Noise suppression working effectively."
        ];

        let i = 0;
        const interval = setInterval(() => {
            setLiveAiInsight(insights[i % insights.length]);
            i++;
        }, 5000);

        return () => clearInterval(interval);
    }, [inCall]);

    return {
        status,
        isConnected,
        isMuted,
        inCall,
        logs,
        participants,
        liveAiInsight,
        connectSignaling,
        startCall,
        endCall,
        toggleMute,
        localStream: localStreamRef.current
    };
};
