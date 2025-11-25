import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const DEMO_URL = "/demo.mp3";

const EQ_BANDS = [
  { label: "SUB", type: "lowshelf", freq: 80 },
  { label: "BASS", type: "peaking", freq: 250 },
  { label: "MID", type: "peaking", freq: 1000 },
  { label: "HIGH MID", type: "peaking", freq: 3500 },
  { label: "TREBLE", type: "highshelf", freq: 8000 },
];

function App() {
  const appRef = useRef(null);
  const audioRef = useRef(null);
  const canvasRef = useRef(null);

  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const bandFiltersRef = useRef([]);
  const outputGainRef = useRef(null); // 🔊 master gain node
  const startedRef = useRef(false);

  const [status, setStatus] = useState("Click play to start audio");
  const [mode, setMode] = useState("Idle");
  const [gains, setGains] = useState(EQ_BANDS.map(() => 0));
  const [volume, setVolume] = useState(0.8); // 0–1

  // 🔊 Load default demo track from /public/demo.mp3
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.src = DEMO_URL;
    setStatus("Demo track loaded — press Play ▶️");
  }, []);

  // 🎨 Canvas + spectrum visualizer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    function draw() {
      requestAnimationFrame(draw);

      const analyser = analyserRef.current;
      const dataArray = dataArrayRef.current;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (!analyser || !dataArray) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "rgba(15,23,42,1)";
        ctx.fillRect(0, 0, width, height);
        return;
      }

      analyser.getByteFrequencyData(dataArray);

      // Background
      const bgGrad = ctx.createLinearGradient(0, height, width, 0);
      bgGrad.addColorStop(0, "#020617");
      bgGrad.addColorStop(0.35, "#020617");
      bgGrad.addColorStop(1, "#000000");
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const barCount = 72; // all bars same style, dense spectrum
      const barWidth = width / barCount;

      // Overall energy for border pulse
      let totalEnergy = 0;
      for (let i = 0; i < dataArray.length; i++) {
        totalEnergy += dataArray[i];
      }
      const overallLevel = totalEnergy / (dataArray.length * 255 || 1); // 0..1

      // Neon frame pulse
      if (appRef.current) {
        const intensity = Math.min(1, overallLevel * 3.0);
        const glow1 = 0.35 + intensity * 0.7;
        const glow2 = 0.3 + intensity * 0.9;
        appRef.current.style.boxShadow = `
          0 0 60px rgba(56,189,248,${glow1}),
          0 0 140px rgba(168,85,247,${glow2}),
          0 0 180px rgba(249,115,22,${intensity * 0.9})
        `;
        appRef.current.style.borderColor = `rgba(56,189,248,${
          0.6 + intensity * 0.35
        })`;
      }

      const maxBarHeight = height * 0.9;
      const minBarHeight = height * 0.04; // bars never completely vanish

      // Draw spectrum bars (all same style, multicolor as they rise)
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * (dataArray.length / barCount));
        const value = dataArray[dataIndex] / 255; // 0..1

        // Boosted height but clamp a minimum
        let barHeight = Math.pow(value, 0.85) * maxBarHeight;
        if (barHeight < minBarHeight) barHeight = minBarHeight;

        const x = i * barWidth + barWidth * 0.1;
        const y = height - barHeight;

        // Hues: vary across bars + with level -> multi-color effect
        const baseHue = (i / barCount) * 300; // 0–300° across spectrum
        const levelHueShift = value * 60; // extra pop when tall
        const hueTop = (baseHue + levelHueShift) % 360;
        const hueMid = (baseHue + levelHueShift + 40) % 360;
        const hueBottom = (baseHue + 120) % 360;

        const radius = barWidth * 0.4;
        const w = barWidth * 0.8;
        const h = barHeight;
        const rx = x;
        const ry = y;

        // Vertical multicolor gradient
        const barGrad = ctx.createLinearGradient(rx, ry, rx, ry + h);
        barGrad.addColorStop(0, `hsl(${hueTop}, 95%, 65%)`);
        barGrad.addColorStop(0.5, `hsl(${hueMid}, 95%, 60%)`);
        barGrad.addColorStop(1, `hsla(${hueBottom}, 95%, 55%, 0.15)`);

        ctx.save();
        ctx.shadowColor = `hsla(${hueMid}, 100%, 65%, ${0.6 + value * 0.6})`;
        ctx.shadowBlur = 22;

        ctx.fillStyle = barGrad;
        ctx.beginPath();
        ctx.moveTo(rx + radius, ry);
        ctx.lineTo(rx + w - radius, ry);
        ctx.quadraticCurveTo(rx + w, ry, rx + w, ry + radius);
        ctx.lineTo(rx + w, ry + h);
        ctx.lineTo(rx, ry + h);
        ctx.lineTo(rx, ry + radius);
        ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Inner white "LED spine" for extra brightness
        const spineX = rx + w / 2;
        const spineGrad = ctx.createLinearGradient(
          spineX,
          ry,
          spineX,
          ry + h
        );
        spineGrad.addColorStop(0, "rgba(255,255,255,0.95)");
        spineGrad.addColorStop(1, "rgba(255,255,255,0)");

        ctx.fillStyle = spineGrad;
        ctx.fillRect(spineX - w * 0.1, ry + h * 0.05, w * 0.2, h * 0.85);
      }
    }

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  // 🎛️ Audio graph + EQ
  const ensureStarted = () => {
    if (startedRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;

    const audioCtx = new (window.AudioContext ||
      window.webkitAudioContext)();
    audioCtxRef.current = audioCtx;

    const source = audioCtx.createMediaElementSource(audio);
    sourceRef.current = source;

    // Create filters for each band
    const filters = EQ_BANDS.map((band) => {
      const f = audioCtx.createBiquadFilter();
      f.type = band.type;
      f.frequency.value = band.freq;
      f.Q.value = band.type === "peaking" ? 1.2 : 0.7;
      f.gain.value = 0;
      return f;
    });
    bandFiltersRef.current = filters;

    // 🔊 Master output gain node
    const outputGain = audioCtx.createGain();
    outputGain.gain.value = volume; // start with current volume state
    outputGainRef.current = outputGain;

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    // Connect: source -> f1 -> f2 -> ... -> outputGain -> analyser -> destination
    let node = source;
    filters.forEach((f) => {
      node.connect(f);
      node = f;
    });
    node.connect(outputGain);
    outputGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    startedRef.current = true;
    setStatus("Equalizer active");
    setMode("Live");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !audioRef.current) return;
    const url = URL.createObjectURL(file);
    audioRef.current.src = url;
    audioRef.current.play().catch(() => {});
    setStatus("Playing local file…");
  };

  const handlePlay = () => {
    ensureStarted();
    const ctx = audioCtxRef.current;
    if (ctx && ctx.state === "suspended") {
      ctx.resume();
    }
    setMode("Live");
    setStatus("Equalizer active");
  };

  const handlePause = () => {
    setMode("Paused");
    setStatus("Audio paused");
  };

  const handleEnded = () => {
    setMode("Ended");
    setStatus("Playback finished");
  };

  const handleGainChange = (index, value) => {
    const v = parseFloat(value);
    setGains((prev) => {
      const next = [...prev];
      next[index] = v;
      return next;
    });
    const filter = bandFiltersRef.current[index];
    if (filter) filter.gain.value = v;
  };

  const handleVolumeChange = (value) => {
    const v = parseFloat(value);
    setVolume(v);
    if (outputGainRef.current) {
      outputGainRef.current.gain.value = v;
    }
  };

  return (
    <div className="app" ref={appRef}>
      <div className="header">
        <div>
          <div className="title">DJ AUDIO VISUALIZER DECK</div>
          <div className="subtitle">
            Multi-band EQ with club-style spectrum lights and reactive
            neon frame.
          </div>
        </div>
        <div className="badge">
          <span className="badge-dot" />
          LIVE AUDIO REACTIVE
        </div>
      </div>

      <div className="grid">
        {/* Visualizer */}
        <div className="visualizer-panel">
          <div className="visualizer-header">
            <span className="visualizer-label">SPECTRUM LIGHTS</span>
            <span className="visualizer-mode">{mode}</span>
          </div>
          <canvas ref={canvasRef} id="visualizer" />
          <div className="glow-ring" />
        </div>

        {/* DJ / EQ Controls */}
        <div className="controls-panel">
          <div className="controls-header">
            <div className="controls-header-title">DJ MIX CONSOLE</div>
            <div className="controls-header-status">{status}</div>
          </div>

          <div className="file-row">
            <label htmlFor="fileInput">TRACK SOURCE</label>
            <input
              id="fileInput"
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
            />
            <div className="hint">
              Load any MP3 / WAV from your laptop or use the demo track.
            </div>
          </div>

          <audio
            ref={audioRef}
            controls
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onError={() => {
              const err = audioRef.current?.error;
              const code = err?.code;
              let msg = "Error loading demo track";
              if (code === 1) msg += " (aborted)";
              else if (code === 2) msg += " (network error)";
              else if (code === 3) msg += " (decode error)";
              else if (code === 4) msg += " (source not supported)";
              setStatus(msg);
            }}
          />

          {/* Volume control */}
          <div className="slider-group">
            <div className="slider-row">
              <span className="slider-label">VOLUME</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => handleVolumeChange(e.target.value)}
              />
              <span className="slider-value">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>

          {/* EQ Sliders */}
          <div className="slider-group dj-sliders">
            {EQ_BANDS.map((band, i) => (
              <div className="slider-row" key={band.label}>
                <span className="slider-label">{band.label}</span>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="1"
                  value={gains[i]}
                  onChange={(e) =>
                    handleGainChange(i, e.target.value)
                  }
                />
                <span className="slider-value">{gains[i]} dB</span>
              </div>
            ))}
          </div>

          <div className="system-note">
            Note: This deck processes audio played here in the browser.
            It does not change system-wide sound for other apps.
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
