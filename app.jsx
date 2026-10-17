import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Shield, Camera, AlertTriangle, Activity, CheckCircle2, 
  Radio, Lock, Play, RefreshCw, Filter, Search, Download, 
  Eye, Bell, Flame, UserX, Car, Users, HelpCircle, 
  Maximize2, Volume2, VolumeX, Database, Terminal, 
  Clock, MapPin, Check, X, ChevronRight, Zap, ArrowUpRight,
  Sliders, ShieldAlert, Cpu, HardDrive, Wifi, ShieldCheck,
  RadioTower, Radar, EyeOff, AlertOctagon, Plus, Video, Upload, Square, Trash2,
  Package, Sparkles, Sun, Users2, AlertCircle, PhoneCall, Link as LinkIcon, RefreshCcw
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('command');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [sirenMuted, setSirenMuted] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [geminiConsent, setGeminiConsent] = useState(null); // null (ask), true, false
  const [toast, setToast] = useState(null);
  const [urlModalCamId, setUrlModalCamId] = useState(null);
  const [urlInputValue, setUrlInputValue] = useState('');
  const [aiModelLoading, setAiModelLoading] = useState(false);

  // 4 Cameras State
  const [cameras, setCameras] = useState([
    {
      id: 'cam-1',
      name: 'Camera 1',
      sourceType: 'sample',
      sourceUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      status: 'Streaming',
      error: null,
      personsCount: 0,
      bagsCount: 0,
      activeThreat: null,
      riskScore: 0,
      lastSignalTime: 0,
      baselineLearned: false
    },
    {
      id: 'cam-2',
      name: 'Camera 2',
      sourceType: 'none',
      sourceUrl: null,
      status: 'No Source',
      error: null,
      personsCount: 0,
      bagsCount: 0,
      activeThreat: null,
      riskScore: 0,
      lastSignalTime: 0,
      baselineLearned: false
    },
    {
      id: 'cam-3',
      name: 'Camera 3',
      sourceType: 'none',
      sourceUrl: null,
      status: 'No Source',
      error: null,
      personsCount: 0,
      bagsCount: 0,
      activeThreat: null,
      riskScore: 0,
      lastSignalTime: 0,
      baselineLearned: false
    },
    {
      id: 'cam-4',
      name: 'Camera 4',
      sourceType: 'none',
      sourceUrl: null,
      status: 'No Source',
      error: null,
      personsCount: 0,
      bagsCount: 0,
      activeThreat: null,
      riskScore: 0,
      lastSignalTime: 0,
      baselineLearned: false
    }
  ]);

  const [incidents, setIncidents] = useState(() => {
    try {
      const saved = localStorage.getItem('signalone_pro_incidents_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map(t => ({
          ...t,
          status: 'Ended - from previous session',
          subsided: true,
          ongoingSeconds: 0
        }));
      }
    } catch (e) {}
    return [];
  });

  const [auditLog, setAuditLog] = useState([
    { id: 'LOG-101', timestamp: new Date().toLocaleTimeString(), action: 'System Boot', details: 'SIGNALONE Proactive core initialized.' }
  ]);

  const videoRefs = useRef({});
  const canvasRefs = useRef({});
  const modelRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sirenOscRef = useRef(null);
  const lastStorageSaveRef = useRef(0);
  const geminiQueueRef = useRef(false);

  const hasActiveCamera = useMemo(() => {
    return cameras.some(c => c.status === 'Streaming' || c.status === 'Live');
  }, [cameras]);

  // Throttled storage sync
  useEffect(() => {
    const now = Date.now();
    if (now - lastStorageSaveRef.current > 2000) {
      lastStorageSaveRef.current = now;
      try {
        const trimmed = incidents.slice(0, 30);
        localStorage.setItem('signalone_pro_incidents_v1', JSON.stringify(trimmed));
      } catch (e) {}
    }
  }, [incidents]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const unlockAudio = () => {
    if (!userInteracted) {
      setUserInteracted(true);
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
      } catch (e) {}
    }
  };

  const shouldRingSiren = useMemo(() => {
    if (sirenMuted || !audioEnabled || !userInteracted) return false;
    
    const hasRunningHighRiskCam = cameras.some(c => {
      const isRunning = c.status === 'Streaming' || c.status === 'Live';
      return isRunning && c.riskScore >= 85;
    });

    if (!hasRunningHighRiskCam) return false;

    const hasUnacknowledgedHighRiskIncident = incidents.some(t => {
      const isCritical = t.severity === 'CRITICAL' || t.confidence >= 85 || t.severity === 'High';
      const cam = cameras.find(c => c.name === t.zone);
      const isCamRunning = cam && (cam.status === 'Streaming' || cam.status === 'Live');
      return isCritical && isCamRunning && t.status !== 'Resolved' && !t.subsided && !t.acknowledged;
    });

    return hasUnacknowledgedHighRiskIncident || hasRunningHighRiskCam;
  }, [cameras, incidents, sirenMuted, audioEnabled, userInteracted]);

  useEffect(() => {
    if (shouldRingSiren) {
      try {
        const ctx = audioCtxRef.current || new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        if (ctx.state === 'suspended') ctx.resume();

        if (!sirenOscRef.current) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(440, ctx.currentTime);

          let up = true;
          const interval = setInterval(() => {
            if (!osc) return;
            const current = osc.frequency.value;
            if (up) {
              osc.frequency.setValueAtTime(Math.min(880, current + 45), ctx.currentTime);
              if (current >= 880) up = false;
            } else {
              osc.frequency.setValueAtTime(Math.max(440, current - 45), ctx.currentTime);
              if (current <= 440) up = true;
            }
          }, 150);

          gain.gain.setValueAtTime(0.07, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          sirenOscRef.current = { osc, interval };
        }
      } catch (e) {}
    } else {
      if (sirenOscRef.current) {
        clearInterval(sirenOscRef.current.interval);
        try { sirenOscRef.current.osc.stop(); } catch (e) {}
        sirenOscRef.current = null;
      }
    }
  }, [shouldRingSiren]);

  // Load TensorFlow model only when first camera source starts
  useEffect(() => {
    if (!hasActiveCamera) return;
    if (modelRef.current || aiModelLoading) return;

    async function loadAI() {
      setAiModelLoading(true);
      try {
        if (!window.tf) {
          await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js');
        }
        if (!window.cocoSsd) {
          await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.3/dist/coco-ssd.min.js');
        }
        await window.tf.ready();
        const loadedModel = await window.cocoSsd.load({ base: 'lite_mobilenet_v2' });
        modelRef.current = loadedModel;
      } catch (err) {
        console.debug('Model load error:', err);
      } finally {
        setAiModelLoading(false);
      }
    }
    loadAI();
  }, [hasActiveCamera]);

  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  useEffect(() => {
    cameras.forEach(cam => {
      if (cam.sourceType === 'sample' && videoRefs.current[cam.id]) {
        const v = videoRefs.current[cam.id];
        v.crossOrigin = 'anonymous';
        v.src = cam.sourceUrl;
        v.loop = true;
        v.muted = true;
        v.play().catch(() => {});
      }
    });
  }, []);

  const setCameraSource = async (camId, type, customUrl = null) => {
    unlockAudio();
    setSirenMuted(false);

    if (type === 'url' && !customUrl) {
      setUrlModalCamId(camId);
      return;
    }

    const targetUrl = customUrl || (type === 'sample' ? (
      camId === 'cam-1' ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' :
      camId === 'cam-2' ? 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4' :
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4'
    ) : null);

    setCameras(prev => prev.map(c => {
      if (c.id === camId) {
        if (c.stream) {
          c.stream.getTracks().forEach(t => t.stop());
        }
        return { 
          ...c, 
          sourceType: type, 
          sourceUrl: targetUrl, 
          stream: null, 
          status: 'Connecting...', 
          error: null, 
          riskScore: 0, 
          activeThreat: null,
          baselineLearned: false 
        };
      }
      return c;
    }));

    const videoEl = videoRefs.current[camId];
    if (!videoEl) return;

    if (type === 'none') {
      videoEl.srcObject = null;
      videoEl.src = '';
      setCameras(prev => prev.map(c => c.id === camId ? { ...c, status: 'No Source', riskScore: 0, activeThreat: null } : c));
      return;
    }

    if (type === 'webcam') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 480 }, height: { ideal: 270 } }, audio: false });
        videoEl.srcObject = stream;
        videoEl.src = '';
        videoEl.crossOrigin = 'anonymous';
        videoEl.play().catch(() => {});
        setCameras(prev => prev.map(c => c.id === camId ? { ...c, stream, status: 'Live', baselineLearned: false } : c));
        showToast(`${camId.toUpperCase()} webcam connected.`, 'success');
      } catch (err) {
        setCameras(prev => prev.map(c => c.id === camId ? { ...c, status: 'Error', error: 'Camera permission denied.' } : c));
        showToast('Camera permission denied.', 'alert');
      }
    } else if (type === 'file' || type === 'sample' || type === 'url') {
      videoEl.srcObject = null;
      videoEl.crossOrigin = 'anonymous';
      videoEl.src = targetUrl;
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.play().then(() => {
        setCameras(prev => prev.map(c => c.id === camId ? { ...c, status: 'Streaming', sourceUrl: targetUrl, baselineLearned: false } : c));
        showToast(`${camId.toUpperCase()} feed loaded.`, 'success');
      }).catch(err => {
        setCameras(prev => prev.map(c => c.id === camId ? { ...c, status: 'Error', error: 'Could not load URL or video format.' } : c));
      });
    }
  };

  // Gemini AI Analysis in background
  const runGeminiAnalysisForCamera = async (camObj) => {
    if (geminiConsent !== true || geminiQueueRef.current) return;
    const camId = camObj.id;
    const video = videoRefs.current[camId];
    const canvas = canvasRefs.current[camId];
    if (!video || !canvas || video.readyState !== 4) return;

    geminiQueueRef.current = true;
    const ctx = canvas.getContext('2d');
    canvas.width = 480;
    canvas.height = 270;
    
    let base64Image = null;
    try {
      ctx.drawImage(video, 0, 0, 480, 270);
      const frameDataUrl = canvas.toDataURL('image/jpeg', 0.75);
      base64Image = frameDataUrl.split(',')[1];
    } catch (err) {
      geminiQueueRef.current = false;
      return;
    }

    if (!base64Image) {
      geminiQueueRef.current = false;
      return;
    }

    try {
      const apiKey = "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      
      let demoPromptAddon = "";
      if (demoMode) {
        demoPromptAddon = " This is a demo. A threat shown on a phone, tablet, TV or monitor held in front of the camera must be reported as that threat. Do NOT say 'it is just a person holding a phone'. If the screen shows fire, smoke, a car crash, a fall, a fight, theft or other danger, return that threat with the real confidence. In 'reason', write what is visible, for example: 'Fire video shown on a screen'.";
      }

      const promptText = `You are a CCTV safety analyst. Decide if a dangerous or abnormal situation is happening (fire, smoke, theft, violence, accident, weapon, person_down, unusual). Normal people sitting or standing are NOT a threat.${demoPromptAddon} Return JSON only: {"threat": "...", "confidence": 0-100, "severity": "low|medium|high", "reason": "...", "isScreen": false}`;

      const payload = {
        contents: [{ role: 'user', parts: [{ text: promptText }, { inlineData: { mimeType: 'image/jpeg', data: base64Image } }] }]
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      const candidate = result.candidates?.[0];
      const textResponse = candidate?.content?.parts?.[0]?.text || '';
      
      let parsed = { threat: 'none', confidence: 0, severity: 'low', reason: 'No threat', isScreen: false };
      try {
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {}

      processAiThreatResult(camObj, parsed);

    } catch (err) {
      console.debug('Gemini analysis error:', err);
    } finally {
      geminiQueueRef.current = false;
    }
  };

  const processAiThreatResult = (camObj, parsed) => {
    const camId = camObj.id;
    const threatType = parsed.threat;
    const confidence = parsed.confidence || 0;
    const severity = parsed.severity || 'medium';
    let reason = parsed.reason || 'AI scene analysis detection';
    const isScreen = parsed.isScreen || (reason.toLowerCase().includes('screen') || reason.toLowerCase().includes('phone') || reason.toLowerCase().includes('monitor'));

    if (threatType === 'none' || confidence < 50) {
      setCameras(prev => prev.map(c => c.id === camId ? { ...c, riskScore: Math.max(0, c.riskScore - 10), activeThreat: null } : c));
      return;
    }

    let risk = confidence;
    risk = Math.min(100, Math.max(0, risk));
    const formattedThreatName = threatType.replace('_', ' ').toUpperCase();
    
    if (isScreen) {
      reason += ' (Shown on a screen - demo)';
    }

    setCameras(prev => prev.map(c => c.id === camId ? {
      ...c,
      riskScore: risk,
      activeThreat: formattedThreatName,
      lastSignalTime: Date.now()
    } : c));

    if (risk >= 60) {
      maybeTriggerIncident(camObj, formattedThreatName, risk, reason, severity);
    }
  };

  // Single Shared Scheduler for 4 cameras in rotation
  useEffect(() => {
    if (!hasActiveCamera || document.hidden) return;

    let camIndex = 0;
    const interval = setInterval(() => {
      const activeCams = cameras.filter(c => c.status === 'Streaming' || c.status === 'Live');
      if (activeCams.length === 0) return;

      const targetCam = activeCams[camIndex % activeCams.length];
      camIndex++;

      runSingleCameraDetection(targetCam);
    }, 400);

    return () => clearInterval(interval);
  }, [hasActiveCamera, cameras, privacyMode, geminiConsent, demoMode]);

  const runSingleCameraDetection = async (camObj) => {
    const camId = camObj.id;
    const video = videoRefs.current[camId];
    const canvas = canvasRefs.current[camId];
    if (!video || !canvas || video.readyState !== 4) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (privacyMode) {
      try {
        ctx.save();
        ctx.filter = 'blur(16px)';
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        ctx.fillStyle = 'rgba(3, 5, 8, 0.65)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } catch (e) {}
    } else {
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (e) {}
    }

    if (modelRef.current && !privacyMode) {
      try {
        const predictions = await modelRef.current.detect(video, 3, 0.5);
        let personCount = 0;
        let bagCount = 0;

        predictions.forEach(p => {
          if (p.class === 'person') personCount++;
          if (p.class === 'backpack' || p.class === 'handbag' || p.class === 'suitcase') bagCount++;

          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2;
          ctx.strokeRect(p.bbox[0] * (320 / video.videoWidth), p.bbox[1] * (180 / video.videoHeight), p.bbox[2] * (320 / video.videoWidth), p.bbox[3] * (180 / video.videoHeight));
          ctx.fillStyle = '#f43f5e';
          ctx.font = '10px monospace';
          ctx.fillText(`${p.class} (${Math.round(p.score * 100)}%)`, p.bbox[0] * (320 / video.videoWidth), (p.bbox[1] * (180 / video.videoHeight)) - 4);
        });

        setCameras(prev => prev.map(c => c.id === camId ? { ...c, personsCount: personCount, bagsCount: bagCount } : c));
      } catch (err) {}
    }

    if (geminiConsent === true) {
      runGeminiAnalysisForCamera(camObj);
    }
  };

  const maybeTriggerIncident = (cam, threatType, riskScore, reason, severityInput) => {
    const now = Date.now();
    const cooldown = 30000;

    setIncidents(prev => {
      const existingIndex = prev.findIndex(t => t.zone === cam.name && t.status !== 'Resolved' && !t.subsided);
      
      if (existingIndex !== -1) {
        const updated = [...prev];
        const item = updated[existingIndex];
        updated[existingIndex] = {
          ...item,
          ongoingSeconds: (item.ongoingSeconds || 10) + 5,
          subsided: false,
          signals: reason
        };
        return updated;
      }

      if (now - cam.lastAlertTime < cooldown) return prev;
      cam.lastAlertTime = now;

      const isEmergency = ['FIRE', 'ACCIDENT', 'VIOLENCE', 'WEAPON', 'SMOKE'].includes(threatType);
      const teamNotified = isEmergency ? 'Fire Brigade / Rescue 1122' : 'Campus Security';
      const severity = isEmergency ? 'CRITICAL' : (severityInput === 'high' ? 'High' : 'Medium');

      const newIncident = {
        id: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        zone: cam.name,
        threatType: `${threatType} Detected`,
        confidence: riskScore,
        severity,
        teamNotified,
        status: 'Active',
        acknowledged: false,
        ongoingSeconds: 5,
        subsided: false,
        signals: reason,
        reason
      };

      showToast(`Auto-Alert: ${threatType} (${cam.name})`, 'alert');

      const newList = [newIncident, ...prev];
      if (newList.length > 30) newList.pop();
      return newList;
    });
  };

  // Auto-subside timer when threat disappears for 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setCameras(prev => prev.map(c => {
        if (c.riskScore > 0 && now - c.lastSignalTime > 5000) {
          return { ...c, riskScore: 0, activeThreat: null };
        }
        return c;
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAcknowledge = (id) => {
    unlockAudio();
    setSirenMuted(true);
    setIncidents(incidents.map(t => t.id === id ? { ...t, acknowledged: true } : t));
    showToast('Alert acknowledged.', 'success');
  };

  const handleResolve = (id) => {
    unlockAudio();
    setSirenMuted(true);
    setIncidents(incidents.map(t => t.id === id ? { ...t, status: 'Resolved', subsided: true } : t));
    showToast('Incident marked resolved.', 'success');
  };

  const clearAllIncidents = () => {
    setIncidents([]);
    setSirenMuted(true);
    showToast('All threat alerts cleared.', 'success');
  };

  // Top Status Banner: ONLY shown when there IS a threat. NO GREEN BAR when clear.
  const topStatusBanner = useMemo(() => {
    const activeThreats = cameras.filter(c => (c.status === 'Streaming' || c.status === 'Live') && c.riskScore >= 60 && c.activeThreat);
    if (activeThreats.length === 0) return null;

    const highest = activeThreats.reduce((prev, curr) => curr.riskScore > prev.riskScore ? curr : prev, activeThreats[0]);
    return {
      text: `${highest.name}: ${highest.activeThreat} DETECTED`,
      type: highest.riskScore >= 85 ? 'emergency' : 'warning'
    };
  }, [cameras]);

  return (
    <div onClick={unlockAudio} className="min-h-screen bg-[#030508] text-slate-100 font-sans relative">

      {/* ONE-TIME GEMINI CONSENT MODAL */}
      {geminiConsent === null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full space-y-4 text-center">
            <Sparkles className="w-10 h-10 text-purple-400 mx-auto" />
            <h3 className="text-sm font-bold text-white uppercase">AI Scene Analysis Consent</h3>
            <p className="text-xs text-slate-300">AI scene analysis sends small camera frames to Google Gemini. Allow?</p>
            <div className="flex justify-center gap-3 pt-2">
              <button 
                onClick={() => setGeminiConsent(false)}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Not now
              </button>
              <button 
                onClick={() => setGeminiConsent(true)}
                className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
              >
                Allow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOP STATUS BAR: ONLY SHOWN WHEN THERE IS A THREAT */}
      {topStatusBanner && (
        <div className={`px-4 py-2.5 flex items-center justify-between sticky top-0 z-50 font-mono font-bold text-xs sm:text-sm border-b transition-all ${
          topStatusBanner.type === 'emergency' ? 'bg-rose-600 text-white border-rose-400 animate-pulse' : 'bg-amber-600 text-slate-950 border-amber-400'
        }`}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 animate-spin" />
            <span>{topStatusBanner.text}</span>
          </div>
          <button 
            onClick={() => setSirenMuted(true)}
            className="px-3 py-1 bg-black/40 hover:bg-black/60 rounded text-xs font-mono font-bold uppercase border border-rose-300 text-white"
          >
            Mute Siren &amp; Acknowledge
          </button>
        </div>
      )}

      {toast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl">
          <AlertTriangle className="w-5 h-5 text-rose-400" />
          <span className="text-xs font-mono uppercase tracking-wider text-slate-200">{toast.message}</span>
        </div>
      )}

      {/* URL INPUT MODAL */}
      {urlModalCamId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-bold text-white uppercase">Connect CCTV / Live Camera URL</h3>
            <p className="text-xs text-slate-400 font-mono">Paste an HLS (.m3u8), MP4, WebM or MJPEG link.</p>
            <input 
              type="text" 
              placeholder="https://example.com/stream.m3u8" 
              value={urlInputValue}
              onChange={(e) => setUrlInputValue(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-xs font-mono text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setUrlModalCamId(null)} className="px-4 py-2 rounded bg-slate-800 text-slate-300 text-xs">Cancel</button>
              <button onClick={() => {
                const url = urlInputValue;
                const camId = urlModalCamId;
                setUrlModalCamId(null);
                setUrlInputValue('');
                setCameraSource(camId, 'url', url);
              }} className="px-4 py-2 rounded bg-rose-600 text-white text-xs font-bold">Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#030508]">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-rose-500" />
            <h1 className="text-base sm:text-lg font-black tracking-widest text-slate-100 uppercase font-mono">
              SIGNAL<span className="text-rose-500">ONE</span> Live Vision
            </h1>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="hidden sm:flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded border border-slate-800">
              <span className="text-slate-400">Alarm:</span> 
              <span className={shouldRingSiren && !sirenMuted ? 'text-rose-400 font-bold animate-pulse' : 'text-emerald-400 font-bold'}>
                {shouldRingSiren && !sirenMuted ? 'ON' : 'OFF'}
              </span>
            </div>

            <button
              onClick={() => setDemoMode(!demoMode)}
              className={`px-3 py-1.5 rounded border text-xs transition-all ${
                demoMode ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              Demo mode: threats shown on a screen count as real: {demoMode ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setPrivacyMode(!privacyMode)}
              className={`px-3 py-1.5 rounded border text-xs transition-all ${
                privacyMode ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5 inline mr-1" /> Privacy: {privacyMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </header>

      {/* SUBNAV */}
      <div className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('command')}
              className={`px-3 py-1.5 rounded font-mono text-xs uppercase ${
                activeTab === 'command' ? 'bg-rose-500 text-white font-bold' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              Command Grid
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded font-mono text-xs uppercase ${
                activeTab === 'audit' ? 'bg-rose-500 text-white font-bold' : 'bg-slate-900 text-slate-400 border border-slate-800'
              }`}
            >
              Audit Log ({auditLog.length})
            </button>
          </div>

          {activeTab === 'command' && (
            <button
              onClick={clearAllIncidents}
              className="px-3 py-1 rounded bg-slate-900 hover:bg-rose-950 border border-slate-800 text-slate-400 text-xs font-mono"
            >
              Clear All Alerts
            </button>
          )}
        </div>
      </div>

      {/* MAIN */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {activeTab === 'command' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 2x2 GRID */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {cameras.map((cam) => {
                const isCritical = cam.riskScore >= 85;
                const isWarning = cam.riskScore >= 60 && !isCritical;
                const isRunning = cam.status === 'Streaming' || cam.status === 'Live';

                return (
                  <div 
                    key={cam.id}
                    className={`rounded-xl border bg-slate-950 overflow-hidden flex flex-col ${
                      isCritical ? 'border-rose-500' : isWarning ? 'border-amber-500' : 'border-slate-800'
                    }`}
                  >
                    <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-slate-200">{cam.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        isRunning ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {cam.status}
                      </span>
                    </div>

                    <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                      <video 
                        ref={el => videoRefs.current[cam.id] = el}
                        playsInline
                        muted
                        autoPlay
                        crossOrigin="anonymous"
                        onEnded={() => setCameraSource(cam.id, 'none')}
                        onPause={() => setCameraSource(cam.id, 'none')}
                        className="w-full h-full object-cover"
                      />
                      <canvas 
                        ref={el => canvasRefs.current[cam.id] = el}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                      />

                      {aiModelLoading && isRunning && (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-[10px] font-mono text-purple-300 flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 animate-spin" /> Loading AI model...
                        </div>
                      )}

                      {!isRunning && (
                        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
                          <Video className="w-8 h-8 text-slate-600 mb-2" />
                          <div className="flex flex-wrap gap-2 justify-center">
                            <button onClick={() => setCameraSource(cam.id, 'webcam')} className="px-2 py-1 rounded bg-cyan-950 text-cyan-300 text-[10px] font-mono">Webcam</button>
                            <label className="px-2 py-1 rounded bg-slate-900 text-slate-200 text-[10px] font-mono cursor-pointer">
                              Upload
                              <input type="file" accept="video/*" onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setCameraSource(cam.id, 'file', URL.createObjectURL(f));
                              }} className="hidden" />
                            </label>
                            <button onClick={() => setCameraSource(cam.id, 'sample')} className="px-2 py-1 rounded bg-slate-900 text-slate-200 text-[10px] font-mono">Sample</button>
                            <button onClick={() => setCameraSource(cam.id, 'url')} className="px-2 py-1 rounded bg-purple-950 text-purple-300 text-[10px] font-mono">URL</button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* RISK LINE & CONTROLS ONLY */}
                    <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">Risk:</span>
                        <span className={`font-bold ${isCritical ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {cam.riskScore}/100
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <button onClick={() => setCameraSource(cam.id, 'webcam')} className="p-1 rounded bg-slate-800 text-slate-300 text-[10px]">Cam</button>
                        <button onClick={() => setCameraSource(cam.id, 'url')} className="p-1 rounded bg-slate-800 text-slate-300 text-[10px]">URL</button>
                        <button onClick={() => setCameraSource(cam.id, 'none')} className="p-1 rounded bg-rose-950 text-rose-300 text-[10px]">Off</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* THREAT QUEUE */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-mono uppercase tracking-widest text-slate-200 font-bold">Threat Queue ({incidents.length})</h2>
              </div>

              <div className="space-y-4 max-h-[650px] overflow-y-auto pr-1">
                {incidents.length === 0 ? (
                  <div className="text-center py-12 rounded-xl border border-slate-800 bg-slate-900/30">
                    <ShieldCheck className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
                    <p className="text-xs font-mono text-slate-400">No active threats detected.</p>
                  </div>
                ) : (
                  incidents.map((threat) => (
                    <div key={threat.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs space-y-2">
                      <div className="flex justify-between text-slate-400">
                        <span className="text-rose-400 font-bold">{threat.threatType}</span>
                        <span>{threat.timestamp}</span>
                      </div>
                      <p className="text-slate-300"><span className="text-slate-500">Zone:</span> {threat.zone}</p>
                      <p className="text-slate-300"><span className="text-slate-500">Details:</span> {threat.reason}</p>
                      <div className="flex justify-end gap-2 pt-2">
                        {!threat.acknowledged && <button onClick={() => handleAcknowledge(threat.id)} className="px-3 py-1 bg-slate-800 text-slate-200 rounded">Acknowledge</button>}
                        {threat.status !== 'Resolved' && <button onClick={() => handleResolve(threat.id)} className="px-3 py-1 bg-emerald-950 text-emerald-300 rounded">Resolve</button>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-slate-100 font-bold">Audit Log</h2>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 font-mono text-xs space-y-2">
              {auditLog.map(log => (
                <div key={log.id} className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-rose-400">{log.id} ({log.timestamp})</span>
                  <span className="text-slate-300">{log.action}: {log.details}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 py-6 mt-12 border-t border-slate-900 text-center font-mono text-[11px] text-slate-500">
        Person and object detection run on this device. When AI scene analysis is active, single low-resolution frames are sent to Google Gemini. No video is stored. No face recognition. Flags behaviour, never identity.
      </footer>
    </div>
  );
}