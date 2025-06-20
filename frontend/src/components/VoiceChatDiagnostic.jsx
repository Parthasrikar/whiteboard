import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Mic, 
  Volume2,
  Wifi,
  Settings,
  Play,
  Square
} from 'lucide-react';

const VoiceChatDiagnostic = () => {
  const [diagnostics, setDiagnostics] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [audioTest, setAudioTest] = useState({ running: false, result: null });
  const [networkTest, setNetworkTest] = useState({ running: false, result: null });
  const localStreamRef = useRef(null);
  const testPeerRef = useRef(null);

  const runCompleteDiagnostic = async () => {
    setIsRunning(true);
    const results = {};

    try {
      // 1. Check basic WebRTC support
      results.webrtcSupport = checkWebRTCSupport();
      
      // 2. Test audio devices
      results.audioDevices = await testAudioDevices();
      
      // 3. Test microphone access
      results.microphoneTest = await testMicrophone();
      
      // 4. Test STUN servers
      results.stunTest = await testSTUNServers();
      
      // 5. Test peer connection creation
      results.peerConnectionTest = await testPeerConnection();
      
      // 6. Test ICE gathering
      results.iceTest = await testICEGathering();

      setDiagnostics(results);
      
      // Log comprehensive results
      console.log('🔍 COMPLETE VOICE CHAT DIAGNOSTIC RESULTS');
      console.log('==========================================');
      Object.entries(results).forEach(([test, result]) => {
        console.log(`${test}:`, result);
      });
      
    } catch (error) {
      console.error('❌ Diagnostic error:', error);
      setDiagnostics({ error: error.message });
    } finally {
      setIsRunning(false);
    }
  };

  const checkWebRTCSupport = () => {
    const support = {
      RTCPeerConnection: !!window.RTCPeerConnection,
      getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      RTCDataChannel: !!window.RTCDataChannel,
      RTCSessionDescription: !!window.RTCSessionDescription,
      RTCIceCandidate: !!window.RTCIceCandidate
    };
    
    const allSupported = Object.values(support).every(Boolean);
    return {
      supported: allSupported,
      details: support,
      status: allSupported ? 'success' : 'error'
    };
  };

  const testAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      
      return {
        status: audioInputs.length > 0 ? 'success' : 'warning',
        audioInputs: audioInputs.length,
        audioOutputs: audioOutputs.length,
        details: {
          inputs: audioInputs.map(d => ({ id: d.deviceId, label: d.label || 'Unnamed device' })),
          outputs: audioOutputs.map(d => ({ id: d.deviceId, label: d.label || 'Unnamed device' }))
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  };

  const testMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      const tracks = stream.getAudioTracks();
      const track = tracks[0];
      
      // Test audio levels
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      source.connect(analyser);
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Store stream for later cleanup
      localStreamRef.current = stream;
      
      setTimeout(() => {
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
          localStreamRef.current = null;
        }
        audioContext.close();
      }, 5000);
      
      return {
        status: 'success',
        trackLabel: track.label,
        trackEnabled: track.enabled,
        trackReadyState: track.readyState,
        constraints: track.getConstraints(),
        settings: track.getSettings(),
        capabilities: track.getCapabilities ? track.getCapabilities() : 'Not supported'
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        code: error.name
      };
    }
  };

  const testSTUNServers = async () => {
    const stunServers = [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun.stunprotocol.org:3478'
    ];
    
    const results = [];
    
    for (const stunServer of stunServers) {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: stunServer }]
        });
        
        const result = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            resolve({ server: stunServer, status: 'timeout' });
          }, 5000);
          
          pc.onicecandidate = (event) => {
            if (event.candidate && event.candidate.type === 'srflx') {
              clearTimeout(timeout);
              resolve({ 
                server: stunServer, 
                status: 'success',
                candidate: event.candidate.candidate 
              });
            }
          };
          
          // Create dummy data channel to trigger ICE gathering
          pc.createDataChannel('test');
          pc.createOffer().then(offer => pc.setLocalDescription(offer));
        });
        
        results.push(result);
        pc.close();
      } catch (error) {
        results.push({
          server: stunServer,
          status: 'error',
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    return {
      status: successCount > 0 ? 'success' : 'warning',
      results,
      workingServers: successCount
    };
  };

  const testPeerConnection = async () => {
    try {
      const pc1 = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      const pc2 = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      // Test connection establishment
      const connectionTest = new Promise((resolve) => {
        let pc1Connected = false;
        let pc2Connected = false;
        
        const checkBothConnected = () => {
          if (pc1Connected && pc2Connected) {
            resolve({ status: 'success', message: 'Both peers connected' });
          }
        };
        
        pc1.onconnectionstatechange = () => {
          if (pc1.connectionState === 'connected') {
            pc1Connected = true;
            checkBothConnected();
          }
        };
        
        pc2.onconnectionstatechange = () => {
          if (pc2.connectionState === 'connected') {
            pc2Connected = true;
            checkBothConnected();
          }
        };
        
        setTimeout(() => {
          resolve({ 
            status: 'timeout', 
            message: `PC1: ${pc1.connectionState}, PC2: ${pc2.connectionState}` 
          });
        }, 10000);
      });
      
      // Set up ICE candidate exchange
      pc1.onicecandidate = (event) => {
        if (event.candidate) {
          pc2.addIceCandidate(event.candidate);
        }
      };
      
      pc2.onicecandidate = (event) => {
        if (event.candidate) {
          pc1.addIceCandidate(event.candidate);
        }
      };
      
      // Create offer/answer
      const offer = await pc1.createOffer();
      await pc1.setLocalDescription(offer);
      await pc2.setRemoteDescription(offer);
      
      const answer = await pc2.createAnswer();
      await pc2.setLocalDescription(answer);
      await pc1.setRemoteDescription(answer);
      
      const result = await connectionTest;
      
      pc1.close();
      pc2.close();
      
      return result;
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  };

  const testICEGathering = async () => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      
      const candidates = [];
      
      const gatheringComplete = new Promise((resolve) => {
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidates.push({
              type: event.candidate.type,
              protocol: event.candidate.protocol,
              address: event.candidate.address,
              port: event.candidate.port
            });
          } else {
            // ICE gathering complete
            resolve();
          }
        };
        
        // Timeout after 10 seconds
        setTimeout(resolve, 10000);
      });
      
      // Trigger ICE gathering
      pc.createDataChannel('test');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      await gatheringComplete;
      pc.close();
      
      const candidateTypes = candidates.reduce((acc, candidate) => {
        acc[candidate.type] = (acc[candidate.type] || 0) + 1;
        return acc;
      }, {});
      
      return {
        status: candidates.length > 0 ? 'success' : 'warning',
        totalCandidates: candidates.length,
        candidateTypes,
        candidates: candidates.slice(0, 5) // Show first 5 candidates
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  };

  const runAudioLoopbackTest = async () => {
    setAudioTest({ running: true, result: null });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false, // Disable for loopback test
          autoGainControl: false,
          noiseSuppression: false
        } 
      });
      
      // Create audio context for monitoring
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      const gainNode = audioContext.createGain();
      
      source.connect(analyser);
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = 0.1; // Low volume to prevent feedback
      
      analyser.fftSize = 256;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      let maxLevel = 0;
      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        maxLevel = Math.max(maxLevel, average);
      };
      
      const interval = setInterval(checkAudio, 100);
      
      setTimeout(() => {
        clearInterval(interval);
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        
        setAudioTest({
          running: false,
          result: {
            maxLevel,
            working: maxLevel > 10,
            message: maxLevel > 10 ? 'Audio input detected!' : 'No audio input detected'
          }
        });
      }, 3000);
      
    } catch (error) {
      setAudioTest({
        running: false,
        result: {
          working: false,
          error: error.message
        }
      });
    }
  };

  const renderStatus = (status) => {
    switch (status) {
      case 'success':
        return <CheckCircle size={16} className="text-green-500" />;
      case 'warning':
        return <AlertTriangle size={16} className="text-yellow-500" />;
      case 'error':
        return <XCircle size={16} className="text-red-500" />;
      default:
        return <RefreshCw size={16} className="text-gray-400" />;
    }
  };

  const renderDiagnosticResult = (title, result) => {
    if (!result) return null;
    
    return (
      <div className="border rounded-lg p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium flex items-center gap-2">
            {renderStatus(result.status)}
            {title}
          </h4>
        </div>
        
        <div className="text-sm text-gray-600">
          {result.error && (
            <div className="text-red-600 mb-2">Error: {result.error}</div>
          )}
          
          {result.message && (
            <div className="mb-2">{result.message}</div>
          )}
          
          {result.details && (
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-600">Show Details</summary>
              <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                {JSON.stringify(result.details, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (testPeerRef.current) {
        testPeerRef.current.close();
      }
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      <div className="border-2 border-blue-200 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Settings className="text-blue-600" />
          Voice Chat Diagnostic Tool
        </h2>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={runCompleteDiagnostic}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isRunning ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            {isRunning ? 'Running Diagnostics...' : 'Run Full Diagnostic'}
          </button>
          
          <button
            onClick={runAudioLoopbackTest}
            disabled={audioTest.running}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {audioTest.running ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Mic size={16} />
            )}
            {audioTest.running ? 'Testing Audio...' : 'Test Audio Loopback'}
          </button>
        </div>

        {/* Audio Test Result */}
        {audioTest.result && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Volume2 size={16} />
              Audio Loopback Test Result
            </h3>
            <div className={`text-sm ${audioTest.result.working ? 'text-green-600' : 'text-red-600'}`}>
              {audioTest.result.message}
              {audioTest.result.maxLevel && (
                <span className="ml-2">(Level: {audioTest.result.maxLevel.toFixed(1)})</span>
              )}
            </div>
            {audioTest.result.error && (
              <div className="text-red-600 text-sm mt-1">
                Error: {audioTest.result.error}
              </div>
            )}
          </div>
        )}

        {/* Diagnostic Results */}
        {Object.keys(diagnostics).length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
              Diagnostic Results
            </h3>
            
            {diagnostics.error ? (
              <div className="text-red-600 p-4 bg-red-50 rounded-lg">
                Diagnostic Error: {diagnostics.error}
              </div>
            ) : (
              <>
                {renderDiagnosticResult('WebRTC Support', diagnostics.webrtcSupport)}
                {renderDiagnosticResult('Audio Devices', diagnostics.audioDevices)}
                {renderDiagnosticResult('Microphone Test', diagnostics.microphoneTest)}
                {renderDiagnosticResult('STUN Server Test', diagnostics.stunTest)}
                {renderDiagnosticResult('Peer Connection Test', diagnostics.peerConnectionTest)}
                {renderDiagnosticResult('ICE Gathering Test', diagnostics.iceTest)}
              </>
            )}
          </div>
        )}

        {/* Common Issues and Solutions */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-medium text-yellow-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            Common Issues and Solutions
          </h3>
          
          <div className="space-y-3 text-sm text-yellow-700">
            <div>
              <strong>No audio output but peers connected:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Check if remote audio elements are created and playing</li>
                <li>Verify audio tracks are enabled on remote streams</li>
                <li>Test with audio loopback above</li>
              </ul>
            </div>
            
            <div>
              <strong>Peers not connecting (connected: 0):</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Check if socket events are firing (offer, answer, ICE candidates)</li>
                <li>Verify STUN servers are accessible</li>
                <li>Check firewall/network restrictions</li>
                <li>Ensure both users are in the same socket room</li>
              </ul>
            </div>
            
            <div>
              <strong>ICE connection failures:</strong>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Try different STUN servers</li>
                <li>Check for corporate firewall blocking WebRTC</li>
                <li>Test on different networks</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Browser Console Instructions */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-2">Debug in Browser Console</h3>
          <div className="text-sm text-blue-700">
            <p className="mb-2">Open browser console (F12) and look for these log patterns:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><code>🚀 Initiating voice chat with users:</code> - Connection start</li>
              <li><code>📤 Sending offer to</code> / <code>📥 Received voice offer from</code> - SDP exchange</li>
              <li><code>🧊 Sending ICE candidate</code> - ICE candidate exchange</li>
              <li><code>✅ Voice connection established</code> - Successful connection</li>
              <li><code>❌</code> prefixed messages - Error conditions</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceChatDiagnostic;