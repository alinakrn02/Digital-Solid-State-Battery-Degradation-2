class SSBRealTimeMonitor {
  constructor() {
    this.isRunning = false;
    this.soh = 100;
    this.cycle = 0;
    this.simulationInterval = null;
    this.dataHistory = {
      soh: [],
      temp: [],
      salt: [],
      dod: [],
      degradation: [],
    };
    this.charts = {};
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.initCharts();
    this.updateSliders();
    console.log("✅ SSB Monitor initialized");
  }

  setupEventListeners() {
    // Slider listeners
    ["tempSlider", "saltSlider", "dodSlider"].forEach((id) => {
      const slider = document.getElementById(id);
      const valueSpan = document.getElementById(id.replace("Slider", "Value"));

      slider.addEventListener("input", (e) => {
        valueSpan.textContent = this.formatValue(
          id,
          parseFloat(e.target.value)
        );
      });
    });

    // Button listener
    document.getElementById("simulateBtn").addEventListener("click", () => {
      console.log("🎛️ Button clicked");
      this.toggleSimulation();
    });
  }

  initCharts() {
    // Fix canvas height
    document.querySelectorAll("canvas").forEach((canvas) => {
      canvas.style.height = "300px";
    });

    // SoH Chart
    const sohCtx = document.getElementById("sohChart").getContext("2d");
    this.charts.soh = new Chart(sohCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "SoH (%)",
            data: [],
            borderColor: "#10b981",
            backgroundColor: "rgba(16,185,129,0.2)",
            tension: 0.4,
            fill: true,
            borderWidth: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { min: 70, max: 100 },
          x: { ticks: { maxTicksLimit: 10 } },
        },
        animation: false,
      },
    });

    // Env Chart
    const envCtx = document.getElementById("envChart").getContext("2d");
    this.charts.env = new Chart(envCtx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Temp (°C)",
            data: [],
            borderColor: "#ef4444",
            yAxisID: "y",
            tension: 0.3,
          },
          {
            label: "Salt (ppm/100)",
            data: [],
            borderColor: "#3b82f6",
            yAxisID: "y1",
            tension: 0.3,
          },
          {
            label: "DoD (%)",
            data: [],
            borderColor: "#f59e0b",
            yAxisID: "y",
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { position: "left", min: 25, max: 90 },
          y1: {
            position: "right",
            min: 8,
            max: 20,
            grid: { drawOnChartArea: false },
          },
        },
        animation: false,
      },
    });
  }

  formatValue(sliderId, value) {
    if (sliderId.includes("temp")) return `${value.toFixed(1)}°C`;
    if (sliderId.includes("salt")) return `${Math.round(value)} ppm`;
    if (sliderId.includes("dod")) return `${value.toFixed(0)}%`;
    return value;
  }

  updateSliders() {
    const values = { tempSlider: 32, saltSlider: 1350, dodSlider: 75 };
    Object.entries(values).forEach(([id, value]) => {
      const slider = document.getElementById(id);
      const span = document.getElementById(id.replace("Slider", "Value"));
      slider.value = value;
      span.textContent = this.formatValue(id, value);
    });
  }

  getCurrentInputs() {
    return {
      temperature: parseFloat(document.getElementById("tempSlider").value),
      salt_ppm: parseFloat(document.getElementById("saltSlider").value),
      dod_percent: parseFloat(document.getElementById("dodSlider").value),
    };
  }

  predictDegradation(inputs) {
    // Physics-based model dari notebook Anda
    const base = 0.028; // 0.028% per cycle
    const tempFactor = 1 + 0.02 * (inputs.temperature - 25);
    const saltFactor = 1 + 0.0005 * (inputs.salt_ppm - 1000);
    const dodFactor = 1 + 0.015 * (inputs.dod_percent / 100);
    const cycleFactor = 1 + 0.0001 * this.cycle;

    let degradation = base * tempFactor * saltFactor * dodFactor * cycleFactor;
    return Math.min(degradation, 1.5); // Cap 1.5%
  }

  updateMetrics(degradation) {
    document.getElementById(
      "degradationRate"
    ).textContent = `${degradation.toFixed(3)}%`;
    document.getElementById("internalResistance").textContent = `${Math.round(
      50 * (1 + degradation / 100)
    )} mΩ`;
    document.getElementById("voltageVariance").textContent = `${(
      0.05 *
      (1 + degradation / 50)
    ).toFixed(3)}V`;
    document.getElementById(
      "currentSoH"
    ).textContent = `SoH: ${this.soh.toFixed(1)}%`;
    document.getElementById(
      "currentCycle"
    ).textContent = `Cycle: ${this.cycle}`;

    const projected = Math.max(70, 100 - degradation * 365 * 3 * 0.8);
    document.getElementById(
      "projection"
    ).textContent = `3 Years: ${projected.toFixed(0)}%`;
  }

  updateCharts(inputs, degradation) {
    const label = `C${this.cycle}`;

    // Update SoH chart
    this.dataHistory.soh.push(this.soh);
    this.charts.soh.data.labels.push(label);
    this.charts.soh.data.datasets[0].data.push(this.soh);

    // Trim history
    if (this.dataHistory.soh.length > 30) {
      this.dataHistory.soh.shift();
      this.charts.soh.data.labels.shift();
      this.charts.soh.data.datasets[0].data.shift();
    }
    this.charts.soh.update("none");

    // Update Env chart
    this.dataHistory.temp.push(inputs.temperature);
    this.dataHistory.salt.push(inputs.salt_ppm / 100);
    this.dataHistory.dod.push(inputs.dod_percent);

    this.charts.env.data.labels.push(label);
    this.charts.env.data.datasets[0].data.push(inputs.temperature);
    this.charts.env.data.datasets[1].data.push(inputs.salt_ppm / 100);
    this.charts.env.data.datasets[2].data.push(inputs.dod_percent);

    if (this.dataHistory.temp.length > 30) {
      this.dataHistory.temp.shift();
      this.dataHistory.salt.shift();
      this.dataHistory.dod.shift();
      this.charts.env.data.labels.shift();
      this.charts.env.data.datasets.forEach((d) => d.data.shift());
    }
    this.charts.env.update("none");
  }

  toggleSimulation() {
    console.log("🔄 Toggle simulation:", this.isRunning ? "STOP" : "START");

    if (this.isRunning) {
      // Stop
      clearInterval(this.simulationInterval);
      this.isRunning = false;
      document.getElementById("simulateBtn").textContent = "🚀 Start Real-time";
      document.getElementById("simulateBtn").className =
        "w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 px-6 py-3 rounded-xl font-bold text-lg mt-6 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1";
      document.getElementById("status").textContent = "🔴 STOPPED";
      document.getElementById("status").className =
        "px-3 py-1 bg-red-500 rounded-full";
    } else {
      // Start
      this.isRunning = true;
      document.getElementById("simulateBtn").textContent = "⏹️ Stop Simulation";
      document.getElementById("simulateBtn").className =
        "w-full bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 px-6 py-3 rounded-xl font-bold text-lg mt-6 transition-all duration-300 shadow-2xl hover:shadow-3xl transform hover:-translate-y-1";
      document.getElementById("status").textContent = "🟢 LIVE";
      document.getElementById("status").className =
        "px-3 py-1 bg-green-500 rounded-full animate-pulse";

      // Mulai loop dengan setInterval (lebih reliable)
      this.simulationInterval = setInterval(() => {
        const inputs = this.getCurrentInputs();
        const degradation = this.predictDegradation(inputs);

        this.soh = Math.max(70, this.soh - degradation / 10); // Slowed untuk demo
        this.cycle++;

        this.updateMetrics(degradation);
        this.updateCharts(inputs, degradation);

        console.log(
          `Cycle ${this.cycle}: SoH=${this.soh.toFixed(
            1
          )}%, Deg=${degradation.toFixed(3)}%`
        );
      }, 800); // 0.8 detik update
    }
  }
}

// Initialize saat DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => new SSBRealTimeMonitor());
} else {
  new SSBRealTimeMonitor();
}
