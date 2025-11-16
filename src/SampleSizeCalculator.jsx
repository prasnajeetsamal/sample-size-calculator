import React, { useMemo, useState } from "react";
import { Calculator, Users, TrendingUp, Info, CheckCircle2, XCircle, AlertTriangle, Calendar, Settings, BarChart3, BookOpen, FlaskConical, Target, LineChart, Grid3x3, Download } from "lucide-react";
import * as XLSX from "xlsx";

// ===== Helpers: Normal CDF inverse (Acklam approximation) =====
function normSInv(p) {
  const _p = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00,
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01,
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00,
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00,
  ];

  const plow = 0.02425;
  const phigh = 1 - plow;
  let q, r;

  if (_p < plow) {
    q = Math.sqrt(-2 * Math.log(_p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (phigh < _p) {
    q = Math.sqrt(-2 * Math.log(1 - _p));
    return -(
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  q = _p - 0.5;
  r = q * q;
  return (
    (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

function zFromAlpha(alpha, tails) {
  return tails === 2 ? normSInv(1 - alpha / 2) : normSInv(1 - alpha);
}

function ceilPositive(x) {
  return Math.max(0, Math.ceil(x));
}

// ===== Core math =====
function nProportions({ pA, pB, alpha, power, tails, ratio }) {
  const delta = Math.abs(pB - pA);
  if (delta <= 0) return { nA: 0, nB: 0, total: 0 };
  const zAlpha = zFromAlpha(alpha, tails);
  const zBeta = normSInv(power);
  const qA = 1 - pA;
  const qB = 1 - pB;
  const r = ratio;

  const termAlpha = zAlpha * Math.sqrt(pA * qA * (1 + 1 / r));
  const termBeta = zBeta * Math.sqrt(pA * qA + (pB * qB) / r);
  const nA = ((termAlpha + termBeta) ** 2) / (delta ** 2);
  const nB = r * nA;
  return { nA, nB, total: nA + nB };
}

function nMeans({ sdA, sdB, delta, alpha, power, tails, ratio }) {
  const zAlpha = zFromAlpha(alpha, tails);
  const zBeta = normSInv(power);
  const r = ratio;
  const nA = ((zAlpha + zBeta) ** 2) * (sdA ** 2 + (sdB ** 2) / r) / (delta ** 2);
  const nB = r * nA;
  return { nA, nB, total: nA + nB };
}

function NumberInput({ label, value, onChange, step = 0.01, min, max, suffix, helpText, isPercentage = false }) {
  const displayValue = isPercentage ? (value * 100) : value;
  const displayStep = isPercentage ? (step * 100) : step;
  const displayMin = isPercentage && min !== undefined ? (min * 100) : min;
  const displayMax = isPercentage && max !== undefined ? (max * 100) : max;
  
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all"
          value={Number.isFinite(displayValue) ? (isPercentage ? displayValue.toFixed(1) : displayValue) : 0}
          step={displayStep}
          min={displayMin}
          max={displayMax}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            const actualValue = isPercentage ? v / 100 : v;
            onChange(Number.isFinite(actualValue) ? actualValue : 0);
          }}
        />
        {suffix && <span className="text-sm font-medium text-gray-600 whitespace-nowrap">{suffix}</span>}
      </div>
      {helpText && <span className="text-xs text-gray-500 leading-relaxed">{helpText}</span>}
    </label>
  );
}

function TestBadge({ pass, msg }) {
  return (
    <div className={`px-3 py-1.5 rounded-full text-xs font-medium inline-flex items-center gap-1.5 ${
      pass ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
    }`}>
      {pass ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
      {msg}
    </div>
  );
}

function runTests() {
  const alpha = 0.05;
  const power = 0.8;
  const tailsTwo = 2;
  const tailsOne = 1;
  const results = [];

  const base = 0.05;
  const r1 = nProportions({ pA: base, pB: base + 0.01, alpha, power, tails: tailsTwo, ratio: 1 });
  const r2 = nProportions({ pA: base, pB: base + 0.02, alpha, power, tails: tailsTwo, ratio: 1 });
  results.push({ pass: r2.total < r1.total, msg: "Larger MDE → smaller sample" });

  const rTwo = nProportions({ pA: base, pB: base + 0.01, alpha, power, tails: tailsTwo, ratio: 1 });
  const rOne = nProportions({ pA: base, pB: base + 0.01, alpha, power, tails: tailsOne, ratio: 1 });
  results.push({ pass: rOne.total < rTwo.total, msg: "One-tailed < two-tailed" });

  const rEq = nProportions({ pA: base, pB: base + 0.01, alpha, power, tails: tailsTwo, ratio: 1 });
  const rSkew = nProportions({ pA: base, pB: base + 0.01, alpha, power, tails: tailsTwo, ratio: 2 });
  results.push({ pass: rSkew.nA < rEq.nA && rSkew.nB > rEq.nB, msg: "Allocation affects group sizes" });

  return results;
}

function SectionDivider({ icon: Icon, title }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t-2 border-gray-300"></div>
      </div>
      <div className="relative flex justify-center">
        <span className="bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-100 px-6 py-2 rounded-full border-2 border-gray-300 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-lg">
              <Icon size={18} className="text-white" />
            </div>
            <span className="text-lg font-bold text-gray-800">{title}</span>
          </div>
        </span>
      </div>
    </div>
  );
}

// ===== Sample Size Calculator (Single Scenario) =====
function SingleScenarioCalculator() {
  const [mode, setMode] = useState("two-prop");
  const [alpha, setAlpha] = useState(0.05);
  const [power, setPower] = useState(0.8);
  const [tails, setTails] = useState(2);
  const ratio = 1;
  const [baselineRate, setBaselineRate] = useState(0.05);
  const [effectType, setEffectType] = useState("relative");
  const [mdeValue, setMdeValue] = useState(0.05);
  const [meanA, setMeanA] = useState(100);
  const [meanB, setMeanB] = useState(105);
  const [sdA, setSdA] = useState(15);
  const [sdB, setSdB] = useState(15);
  const [numVariations, setNumVariations] = useState(2);
  const [useBonferroni, setUseBonferroni] = useState(true);
  const [dropoffRate, setDropoffRate] = useState(0);
  const [avgDailyTraffic, setAvgDailyTraffic] = useState(100000);

  const { pA, pB } = useMemo(() => {
    if (mode === "two-prop") {
      const pA = baselineRate;
      let pB;
      if (effectType === "relative") {
        pB = pA * (1 + mdeValue);
      } else {
        pB = pA + mdeValue;
      }
      return { pA, pB };
    }
    return { pA: 0, pB: 0 };
  }, [mode, baselineRate, effectType, mdeValue]);

  const computed = useMemo(() => {
    const numComparisons = numVariations;
    const alphaBonf = useBonferroni ? alpha / numComparisons : alpha;

    let baseResult;
    if (mode === "two-prop") {
      baseResult = nProportions({ pA, pB, alpha: alphaBonf, power, tails, ratio });
    } else {
      const delta = Math.abs(meanB - meanA);
      baseResult = nMeans({ sdA, sdB, delta, alpha: alphaBonf, power, tails, ratio });
    }

    const nControl = ceilPositive(baseResult.nA);
    const nPerVariation = ceilPositive(baseResult.nB);
    const subtotal = nControl + nPerVariation * numVariations;

    const nControlWithDropoff = dropoffRate > 0 ? ceilPositive(nControl / (1 - dropoffRate)) : nControl;
    const nPerVariationWithDropoff = dropoffRate > 0 ? ceilPositive(nPerVariation / (1 - dropoffRate)) : nPerVariation;
    const totalWithDropoff = nControlWithDropoff + nPerVariationWithDropoff * numVariations;

    const finalTotal = dropoffRate > 0 ? totalWithDropoff : subtotal;
    const daysNeeded = avgDailyTraffic > 0 ? finalTotal / avgDailyTraffic : 0;
    const weeksNeeded = daysNeeded / 7;

    return {
      nControl,
      nPerVariation,
      subtotal,
      nControlWithDropoff,
      nPerVariationWithDropoff,
      totalWithDropoff,
      numVariations,
      daysNeeded,
      weeksNeeded,
    };
  }, [mode, pA, pB, meanA, meanB, sdA, sdB, alpha, power, tails, ratio, numVariations, useBonferroni, dropoffRate, avgDailyTraffic]);

  const displayMDE = mode === "two-prop" ? Math.abs(pB - pA) : Math.abs(meanB - meanA);

  return (
    <div className="space-y-8">
      <SectionDivider icon={Settings} title="Input Parameters" />

      <div className="grid grid-cols-2 gap-6">
        {/* Test Configuration Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
              <Target size={20} className="text-indigo-600" />
            </div>
            Test Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Metric Type</label>
              <div className="space-y-2">
                <button
                  onClick={() => setMode("two-prop")}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    mode === "two-prop"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Proportions (Conversion Rate)
                </button>
                <button
                  onClick={() => setMode("two-means")}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    mode === "two-means"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Means (Average Value)
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Test Type</label>
              <div className="space-y-2">
                <button
                  onClick={() => setTails(2)}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    tails === 2
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Two-tailed (detects ↑ or ↓)
                </button>
                <button
                  onClick={() => setTails(1)}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    tails === 1
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  One-tailed (detects ↑ only)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Use two-tailed unless you have strong directional hypothesis</p>
            </div>
          </div>
        </div>

        {/* Statistical Parameters Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
              <BarChart3 size={20} className="text-indigo-600" />
            </div>
            Statistical Parameters
          </h3>
          <div className="space-y-4">
            <NumberInput
              label="Significance Level (α)"
              value={alpha}
              onChange={setAlpha}
              step={0.01}
              min={0.01}
              max={0.2}
              isPercentage={true}
              suffix="%"
              helpText="Probability of false positive (Type I error). Common: 5%"
            />
            <NumberInput
              label="Statistical Power (1-β)"
              value={power}
              onChange={setPower}
              step={0.05}
              min={0.5}
              max={0.99}
              isPercentage={true}
              suffix="%"
              helpText="Probability of detecting a true effect. Common: 80%"
            />
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-700">Bonferroni Correction</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setUseBonferroni(!useBonferroni)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    useBonferroni ? "bg-gradient-to-r from-indigo-600 to-purple-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      useBonferroni ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700 font-medium">
                  {useBonferroni ? "Enabled" : "Disabled"}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {useBonferroni 
                  ? "Adjusts α for multiple comparisons to control family-wise error rate"
                  : "No adjustment for multiple variations (increases Type I error risk)"
                }
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Metric Values Card */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
            <TrendingUp size={20} className="text-indigo-600" />
          </div>
          {mode === "two-prop" ? "Conversion Rate Configuration" : "Mean Values Configuration"}
        </h3>
        
        {mode === "two-prop" ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Effect Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setEffectType("relative");
                    setMdeValue(0.05);
                  }}
                  className={`px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    effectType === "relative"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Relative Lift
                </button>
                <button
                  onClick={() => {
                    setEffectType("absolute");
                    setMdeValue(0.005);
                  }}
                  className={`px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    effectType === "absolute"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Absolute Lift
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <NumberInput
                label="Baseline Rate (Control)"
                value={baselineRate}
                onChange={setBaselineRate}
                step={0.01}
                min={0.01}
                max={0.99}
                isPercentage={true}
                suffix="%"
                helpText="Current conversion rate in control group"
              />

              <NumberInput
                label={effectType === "relative" ? "Minimum Detectable Effect (Relative)" : "Minimum Detectable Effect (Absolute)"}
                value={mdeValue}
                onChange={setMdeValue}
                step={effectType === "relative" ? 0.01 : 0.001}
                min={effectType === "relative" ? 0.01 : 0.001}
                max={effectType === "relative" ? 2 : 0.5}
                isPercentage={true}
                suffix="%"
                helpText={
                  effectType === "relative"
                    ? `Relative change from baseline (e.g., 5% means ${(baselineRate * 100).toFixed(1)}% → ${(baselineRate * (1 + mdeValue) * 100).toFixed(2)}%)`
                    : `Absolute change in percentage points (e.g., 0.5pp means ${(baselineRate * 100).toFixed(1)}% → ${((baselineRate + mdeValue) * 100).toFixed(2)}%)`
                }
              />
            </div>

            <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-left">
                  <div className="text-gray-600 font-medium mb-1">Control Rate</div>
                  <div className="text-2xl font-bold text-gray-900">{(pA * 100).toFixed(2)}%</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-600 font-medium mb-1">Variation Rate</div>
                  <div className="text-2xl font-bold text-indigo-700">{(pB * 100).toFixed(2)}%</div>
                </div>
                <div className="text-right">
                  <div className="text-gray-600 font-medium mb-1">Effect Size</div>
                  <div className="text-2xl font-bold text-purple-700">
                    {effectType === "relative" 
                      ? `${(mdeValue * 100).toFixed(1)}%`
                      : `${(Math.abs(pB - pA) * 100).toFixed(2)}pp`
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <NumberInput
                label="Control Mean"
                value={meanA}
                onChange={setMeanA}
                step={1}
                helpText="Average value in control group"
              />
              <NumberInput
                label="Variation Mean"
                value={meanB}
                onChange={setMeanB}
                step={1}
                helpText="Expected average in variation"
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <NumberInput
                label="Control Std Dev (σ)"
                value={sdA}
                onChange={setSdA}
                step={1}
                min={0.1}
                helpText="Standard deviation in control"
              />
              <NumberInput
                label="Variation Std Dev (σ)"
                value={sdB}
                onChange={setSdB}
                step={1}
                min={0.1}
                helpText="Standard deviation in variation"
              />
            </div>
            <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Minimum Detectable Effect (MDE):</span>
                <span className="text-2xl font-bold text-indigo-700">
                  {displayMDE.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Test Variations & Traffic Settings Card */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
            <Users size={20} className="text-indigo-600" />
          </div>
          Test Variations & Traffic
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <NumberInput
            label="Number of Variations"
            value={numVariations}
            onChange={setNumVariations}
            step={1}
            min={1}
            max={10}
            helpText={`Testing ${numVariations} variation${numVariations > 1 ? 's' : ''} against control${useBonferroni && numVariations > 1 ? ' (Bonferroni corrected)' : ''}`}
          />
          <NumberInput
            label="Average Daily Traffic"
            value={avgDailyTraffic}
            onChange={setAvgDailyTraffic}
            step={100}
            min={0}
            helpText="Average number of users per day"
          />
          <NumberInput
            label="Expected Drop-off Rate"
            value={dropoffRate}
            onChange={setDropoffRate}
            step={0.01}
            min={0}
            max={0.5}
            isPercentage={true}
            suffix="%"
            helpText="Users who drop out before test completion"
          />
        </div>
      </div>

      {/* SECTION 2: RESULTS */}
      <SectionDivider icon={Calculator} title="Sample Size Results" />

      <div className="grid grid-cols-2 gap-6">
        {/* Sample Size Results Card */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-2xl p-6 text-white border-4 border-indigo-400">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Users size={28} />
            Required Sample Size
          </h2>
          
          <div className="space-y-4">
            <div className="bg-white/20 backdrop-blur rounded-xl p-5 border border-white/30">
              <div className="text-sm text-indigo-100 mb-3 uppercase tracking-wide font-semibold">Total Sample Needed</div>
              <div className="text-5xl font-bold mb-2">
                {dropoffRate > 0 ? computed.totalWithDropoff.toLocaleString() : computed.subtotal.toLocaleString()}
              </div>
              <div className="text-xs text-indigo-100">
                {computed.numVariations === 1 ? '1 control + 1 variation' : `1 control + ${computed.numVariations} variations`}
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <div className="text-xs uppercase tracking-wide font-semibold mb-3 text-indigo-50">Group Breakdown</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center pb-2 border-b border-white/20">
                  <span className="text-indigo-100">Control</span>
                  <span className="font-semibold">{dropoffRate > 0 ? computed.nControlWithDropoff.toLocaleString() : computed.nControl.toLocaleString()}</span>
                </div>
                {Array.from({ length: numVariations }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-indigo-100">Variation {String.fromCharCode(66 + i)}</span>
                    <span className="font-semibold">{dropoffRate > 0 ? computed.nPerVariationWithDropoff.toLocaleString() : computed.nPerVariation.toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t-2 border-white/30 pt-2 mt-2 flex justify-between items-center font-bold text-base">
                  <span>Total</span>
                  <span>{dropoffRate > 0 ? computed.totalWithDropoff.toLocaleString() : computed.subtotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-white/10 backdrop-blur rounded-xl border border-white/20">
            <div className="flex items-start gap-2">
              <Info size={16} className="mt-0.5 flex-shrink-0" />
              <div className="text-xs text-indigo-50">
                <p className="font-semibold mb-1">Methodology:</p>
                <p>Normal-theory formulas with unpooled variance. Multiple variations use Bonferroni correction.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Test Duration Card */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-2xl p-6 text-white border-4 border-emerald-400">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar size={28} />
            Test Duration
          </h2>
          
          {avgDailyTraffic > 0 && (
            <div className="space-y-3">
              <div className="bg-white/20 backdrop-blur rounded-xl p-5 border border-white/30">
                <div className="text-sm text-emerald-100 mb-3 uppercase tracking-wide">Duration Required</div>
                <div className="flex items-baseline gap-4">
                  <div>
                    <div className="text-5xl font-bold">{Math.ceil(computed.daysNeeded)}</div>
                    <div className="text-sm text-emerald-100 mt-1">days</div>
                  </div>
                  <div className="text-3xl text-emerald-200">≈</div>
                  <div>
                    <div className="text-4xl font-bold">{computed.weeksNeeded.toFixed(1)}</div>
                    <div className="text-sm text-emerald-100 mt-1">weeks</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-sm text-emerald-50 border border-white/20">
                <div className="flex justify-between mb-2">
                  <span>Daily traffic:</span>
                  <span className="font-semibold">{avgDailyTraffic.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Total sample needed:</span>
                  <span className="font-semibold">{(dropoffRate > 0 ? computed.totalWithDropoff : computed.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-white/20">
                  <span>Days to reach sample:</span>
                  <span className="font-semibold">{computed.daysNeeded.toFixed(1)} days</span>
                </div>
              </div>
              
              {computed.daysNeeded < 7 && (
                <div className="bg-yellow-400/20 backdrop-blur rounded-lg p-3 text-xs text-yellow-50 border border-yellow-300/30">
                  <strong>⚠️ Short test duration:</strong> Tests under 1 week may not capture weekly patterns or be affected by day-of-week variations.
                </div>
              )}
              
              {computed.daysNeeded > 28 && (
                <div className="bg-blue-400/20 backdrop-blur rounded-lg p-3 text-xs text-blue-50 border border-blue-300/30">
                  <strong>ℹ️ Long test duration:</strong> Consider increasing traffic allocation or reducing MDE if a {Math.ceil(computed.daysNeeded)}-day test is too long.
                </div>
              )}
            </div>
          )}

          {avgDailyTraffic === 0 && (
            <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
              <p className="text-sm text-emerald-50">
                Enter your average daily traffic in the "Test Variations & Traffic" section to calculate test duration.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== Multiple Scenarios Calculator =====
function MultipleScenarios() {
  const [mode, setMode] = useState("two-prop");
  const [alphaValues, setAlphaValues] = useState("1, 5, 10");
  const [power, setPower] = useState(0.8);
  const [tails, setTails] = useState(2);
  const ratio = 1;
  const [baselineRate, setBaselineRate] = useState(0.05);
  const [effectType, setEffectType] = useState("relative");
  const [mdeValues, setMdeValues] = useState("1, 3, 5, 8");
  const [meanA, setMeanA] = useState(100);
  const [meanB, setMeanB] = useState(105);
  const [sdA, setSdA] = useState(15);
  const [sdB, setSdB] = useState(15);
  const [numVariations, setNumVariations] = useState(2);
  const [useBonferroni, setUseBonferroni] = useState(true);
  const [dropoffRate, setDropoffRate] = useState(0);
  const [avgDailyTraffic, setAvgDailyTraffic] = useState(100000);

  const scenarios = useMemo(() => {
    const alphas = alphaValues.split(',').map(v => parseFloat(v.trim()) / 100).filter(v => !isNaN(v) && v > 0 && v < 1);
    const mdes = mdeValues.split(',').map(v => parseFloat(v.trim()) / 100).filter(v => !isNaN(v) && v > 0);
    
    const results = [];
    
    for (const alpha of alphas) {
      for (const mdeValue of mdes) {
        const alphaBonf = useBonferroni ? alpha / numVariations : alpha;
        
        let pA, pB;
        if (mode === "two-prop") {
          if (effectType === "relative") {
            pA = baselineRate;
            pB = pA * (1 + mdeValue);
          } else {
            pA = baselineRate;
            pB = pA + mdeValue;
          }
          
          const baseResult = nProportions({ pA, pB, alpha: alphaBonf, power, tails, ratio });
          const nControl = ceilPositive(baseResult.nA);
          const nPerVariation = ceilPositive(baseResult.nB);
          const subtotal = nControl + nPerVariation * numVariations;
          
          const nControlWithDropoff = dropoffRate > 0 ? ceilPositive(nControl / (1 - dropoffRate)) : nControl;
          const nPerVariationWithDropoff = dropoffRate > 0 ? ceilPositive(nPerVariation / (1 - dropoffRate)) : nPerVariation;
          const totalWithDropoff = nControlWithDropoff + nPerVariationWithDropoff * numVariations;
          
          const finalTotal = dropoffRate > 0 ? totalWithDropoff : subtotal;
          const daysNeeded = avgDailyTraffic > 0 ? finalTotal / avgDailyTraffic : 0;
          
          results.push({
            alpha: alpha * 100,
            mde: mdeValue * 100,
            controlRate: pA * 100,
            variationRate: pB * 100,
            numVariations: numVariations,
            nControl: dropoffRate > 0 ? nControlWithDropoff : nControl,
            nPerVariation: dropoffRate > 0 ? nPerVariationWithDropoff : nPerVariation,
            totalSample: finalTotal,
            daysNeeded: Math.ceil(daysNeeded),
            weeksNeeded: (daysNeeded / 7).toFixed(1)
          });
        }
      }
    }
    
    return results;
  }, [alphaValues, mdeValues, mode, power, tails, baselineRate, effectType, numVariations, useBonferroni, dropoffRate, avgDailyTraffic]);

  return (
    <div className="space-y-8">
      <SectionDivider icon={Settings} title="Input Parameters" />

      <div className="grid grid-cols-2 gap-6">
        {/* Test Configuration Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
              <Target size={20} className="text-indigo-600" />
            </div>
            Test Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Metric Type</label>
              <div className="space-y-2">
                <button
                  onClick={() => setMode("two-prop")}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    mode === "two-prop"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Proportions (Conversion Rate)
                </button>
                <button
                  onClick={() => setMode("two-means")}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    mode === "two-means"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Means (Average Value)
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Test Type</label>
              <div className="space-y-2">
                <button
                  onClick={() => setTails(2)}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    tails === 2
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Two-tailed (detects ↑ or ↓)
                </button>
                <button
                  onClick={() => setTails(1)}
                  className={`w-full px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    tails === 1
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  One-tailed (detects ↑ only)
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Use two-tailed unless you have strong directional hypothesis</p>
            </div>
          </div>
        </div>

        {/* Statistical Parameters Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
              <BarChart3 size={20} className="text-indigo-600" />
            </div>
            Statistical Parameters
          </h3>
          <div className="space-y-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-700">Significance Levels (α) - comma separated</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all"
                  value={alphaValues}
                  onChange={(e) => setAlphaValues(e.target.value)}
                  placeholder="1, 5, 10"
                />
                <span className="text-sm font-medium text-gray-600 whitespace-nowrap">%</span>
              </div>
              <span className="text-xs text-gray-500">Enter multiple values (e.g., "1, 5, 10" for 1%, 5%, 10%)</span>
            </label>

            <NumberInput
              label="Statistical Power (1-β)"
              value={power}
              onChange={setPower}
              step={0.05}
              min={0.5}
              max={0.99}
              isPercentage={true}
              suffix="%"
              helpText="Probability of detecting a true effect. Common: 80%"
            />
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-gray-700">Bonferroni Correction</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setUseBonferroni(!useBonferroni)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    useBonferroni ? "bg-gradient-to-r from-indigo-600 to-purple-600" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                      useBonferroni ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700 font-medium">
                  {useBonferroni ? "Enabled" : "Disabled"}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {useBonferroni 
                  ? "Adjusts α for multiple comparisons to control family-wise error rate"
                  : "No adjustment for multiple variations (increases Type I error risk)"
                }
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Metric Values Card */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
            <TrendingUp size={20} className="text-indigo-600" />
          </div>
          {mode === "two-prop" ? "Conversion Rate Configuration" : "Mean Values Configuration"}
        </h3>
        
        {mode === "two-prop" ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-3 block">Effect Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setEffectType("relative");
                    setMdeValues("1, 3, 5, 8");
                  }}
                  className={`px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    effectType === "relative"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Relative Lift
                </button>
                <button
                  onClick={() => {
                    setEffectType("absolute");
                    setMdeValues("0.5, 1, 1.5, 2");
                  }}
                  className={`px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    effectType === "absolute"
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Absolute Lift
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <NumberInput
                label="Baseline Rate (Control)"
                value={baselineRate}
                onChange={setBaselineRate}
                step={0.01}
                min={0.01}
                max={0.99}
                isPercentage={true}
                suffix="%"
                helpText="Current conversion rate in control group"
              />

              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-gray-700">
                  {effectType === "relative" ? "MDE (Relative) - comma separated" : "MDE (Absolute) - comma separated"}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 focus:outline-none transition-all"
                    value={mdeValues}
                    onChange={(e) => setMdeValues(e.target.value)}
                    placeholder={effectType === "relative" ? "1, 3, 5, 8" : "0.5, 1, 1.5, 2"}
                  />
                  <span className="text-sm font-medium text-gray-600 whitespace-nowrap">%</span>
                </div>
                <span className="text-xs text-gray-500">
                  {effectType === "relative"
                    ? "Relative lift values (e.g., \"1, 3, 5\" for 1%, 3%, 5% lifts)"
                    : "Absolute lift values (e.g., \"0.5, 1\" for 0.5pp, 1pp lifts)"
                  }
                </span>
              </label>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <NumberInput
                label="Control Mean"
                value={meanA}
                onChange={setMeanA}
                step={1}
                helpText="Average value in control group"
              />
              <NumberInput
                label="Variation Mean"
                value={meanB}
                onChange={setMeanB}
                step={1}
                helpText="Expected average in variation"
              />
            </div>
            <div className="grid grid-cols-2 gap-6">
              <NumberInput
                label="Control Std Dev (σ)"
                value={sdA}
                onChange={setSdA}
                step={1}
                min={0.1}
                helpText="Standard deviation in control"
              />
              <NumberInput
                label="Variation Std Dev (σ)"
                value={sdB}
                onChange={setSdB}
                step={1}
                min={0.1}
                helpText="Standard deviation in variation"
              />
            </div>
          </div>
        )}
      </div>

      {/* Test Variations & Traffic Settings Card */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
        <h3 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg">
            <Users size={20} className="text-indigo-600" />
          </div>
          Test Variations & Traffic
        </h3>
        <div className="grid grid-cols-3 gap-6">
          <NumberInput
            label="Number of Variations"
            value={numVariations}
            onChange={setNumVariations}
            step={1}
            min={1}
            max={10}
            helpText={`Testing ${numVariations} variation${numVariations > 1 ? 's' : ''} against control${useBonferroni && numVariations > 1 ? ' (Bonferroni corrected)' : ''}`}
          />
          <NumberInput
            label="Average Daily Traffic"
            value={avgDailyTraffic}
            onChange={setAvgDailyTraffic}
            step={100}
            min={0}
            helpText="Average number of users per day"
          />
          <NumberInput
            label="Expected Drop-off Rate"
            value={dropoffRate}
            onChange={setDropoffRate}
            step={0.01}
            min={0}
            max={0.5}
            isPercentage={true}
            suffix="%"
            helpText="Users who drop out before test completion"
          />
        </div>
      </div>

      {/* Results Table */}
      <SectionDivider icon={BarChart3} title={`Scenario Results (${scenarios.length} scenarios)`} />

      {scenarios.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => {
              // Prepare data for Excel
              const excelData = scenarios.map(s => ({
                'Significance Level (%)': s.alpha.toFixed(1),
                'MDE (%)': s.mde.toFixed(1),
                'Control Rate (%)': s.controlRate.toFixed(2),
                'Variation Rate (%)': s.variationRate.toFixed(2),
                'Number of Variations': s.numVariations,
                'n (Control)': s.nControl,
                'n (per Variation)': s.nPerVariation,
                'Total Sample Size': s.totalSample,
                'Duration (Days)': s.daysNeeded,
                'Duration (Weeks)': s.weeksNeeded
              }));

              // Create workbook and worksheet
              const ws = XLSX.utils.json_to_sheet(excelData);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Sample Size Scenarios");

              // Set column widths
              ws['!cols'] = [
                { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 17 }, 
                { wch: 20 }, { wch: 12 }, { wch: 18 }, 
                { wch: 18 }, { wch: 15 }, { wch: 16 }
              ];

              // Download
              XLSX.writeFile(wb, "sample_size_scenarios.xlsx");
            }}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-lg"
          >
            <Download size={18} />
            Export to Excel
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Significance Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">MDE (%)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Control</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">Variation</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide"># Variations</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">n (Control)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">n (per Var)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Total Sample</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Days</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">Weeks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {scenarios.map((scenario, idx) => {
                // Color coding based on alpha level
                let bgColor = "bg-white";
                if (scenario.alpha <= 1) {
                  bgColor = idx % 2 === 0 ? "bg-red-50" : "bg-red-100/50";
                } else if (scenario.alpha <= 5) {
                  bgColor = idx % 2 === 0 ? "bg-amber-50" : "bg-amber-100/50";
                } else {
                  bgColor = idx % 2 === 0 ? "bg-blue-50" : "bg-blue-100/50";
                }

                return (
                  <tr key={idx} className={bgColor}>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{scenario.alpha.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm font-semibold text-indigo-700">{scenario.mde.toFixed(1)}%</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{scenario.controlRate.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{scenario.variationRate.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm text-center font-medium text-gray-900">{scenario.numVariations}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{scenario.nControl.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{scenario.nPerVariation.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-indigo-700">{scenario.totalSample.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{scenario.daysNeeded}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{scenario.weeksNeeded}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Color Legend */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-6 text-xs">
            <span className="font-semibold text-gray-700">Color Legend:</span>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-red-50 border border-red-200 rounded"></div>
              <span className="text-gray-600">α ≤ 1% (Very Conservative)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-amber-50 border border-amber-200 rounded"></div>
              <span className="text-gray-600">α ≤ 5% (Standard)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-4 bg-blue-50 border border-blue-200 rounded"></div>
              <span className="text-gray-600">α > 5% (Liberal)</span>
            </div>
          </div>
        </div>
      </div>

      {scenarios.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <p className="text-sm text-yellow-800">
            No valid scenarios generated. Please check your input values.
          </p>
        </div>
      )}
    </div>
  );
}

// ===== Documentation Component =====
function Documentation() {
  const tests = useMemo(() => runTests(), []);

  return (
    <div className="space-y-8">
      <SectionDivider icon={BookOpen} title="Documentation & Reference" />

      {/* Validation Tests */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          Built-in Validation Tests
        </h4>
        <div className="flex flex-wrap gap-2 mb-3">
          {tests.map((t, i) => (
            <TestBadge key={i} pass={t.pass} msg={t.msg} />
          ))}
        </div>
        <p className="text-sm text-gray-600">
          These automated tests verify expected statistical relationships (e.g., larger effect sizes require smaller samples).
        </p>
      </div>

      {/* Formula Reference */}
      <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-5">Statistical Formulas</h4>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <p className="font-semibold text-gray-900 mb-2">Two-sample Proportions (unpooled variance):</p>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-x-auto border border-gray-200">
              n<sub>A</sub> = (z<sub>α</sub> · √[p<sub>A</sub>(1−p<sub>A</sub>)(1+1/r)] + z<sub>β</sub> · √[p<sub>A</sub>(1−p<sub>A</sub>) + p<sub>B</sub>(1−p<sub>B</sub>)/r])² / (p<sub>B</sub>−p<sub>A</sub>)²
              <br />
              n<sub>B</sub> = r · n<sub>A</sub>
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-2">Two-sample Means:</p>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-x-auto border border-gray-200">
              n<sub>A</sub> = (z<sub>α</sub> + z<sub>β</sub>)² · (σ<sub>A</sub>² + σ<sub>B</sub>²/r) / Δ²
              <br />
              n<sub>B</sub> = r · n<sub>A</sub>
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-2">Multiple Variations (Bonferroni correction):</p>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-x-auto border border-gray-200">
              α<sub>adjusted</sub> = α / k, where k = number of variations
              <br />
              Total = n<sub>control</sub> + (n<sub>per_variation</sub> × k)
            </div>
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-2">Drop-off Adjustment & Duration:</p>
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-x-auto border border-gray-200">
              n<sub>recruit</sub> = n<sub>required</sub> / (1 - dropout_rate)
              <br />
              days_needed = n<sub>recruit</sub> / avg_daily_traffic
            </div>
          </div>
          <p className="text-xs text-gray-600 pt-2">
            Where z<sub>α</sub> = Φ⁻¹(1 − α/2) for two-tailed or Φ⁻¹(1 − α) for one-tailed, 
            z<sub>β</sub> = Φ⁻¹(power), r = allocation ratio
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== Sample Size Tab with Nested Tabs =====
function SampleSizeTab() {
  const [activeSubTab, setActiveSubTab] = useState("single");

  const subTabs = [
    { id: "single", label: "Sample Size Calculator", icon: Calculator },
    { id: "multiple", label: "Multiple Scenarios", icon: Grid3x3 },
    { id: "docs", label: "Documentation", icon: BookOpen },
  ];

  return (
    <div>
      {/* Sub-tab Navigation */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-200 mb-6 -mt-2">
        <div className="flex gap-1 px-2 pt-2">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all rounded-t-xl ${
                  activeSubTab === tab.id
                    ? "bg-white text-indigo-700 shadow-sm border-t-2 border-x-2 border-indigo-500"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tab Content */}
      <div>
        {activeSubTab === "single" && <SingleScenarioCalculator />}
        {activeSubTab === "multiple" && <MultipleScenarios />}
        {activeSubTab === "docs" && <Documentation />}
      </div>
    </div>
  );
}

// ===== Placeholder Components for Future Tabs =====
function PlaceholderTab({ title, description, icon: Icon }) {
  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <div className="text-center max-w-md">
        <div className="inline-flex p-6 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-3xl mb-6">
          <Icon size={64} className="text-indigo-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3">{title}</h2>
        <p className="text-gray-600 text-lg">{description}</p>
        <div className="mt-8 inline-block px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold">
          Coming Soon
        </div>
      </div>
    </div>
  );
}

// ===== Main App Component =====
export default function ExperimentationApp() {
  const [activeTab, setActiveTab] = useState("sample-size");

  const tabs = [
    { id: "sample-size", label: "Sample Size", icon: Calculator },
    { id: "analysis", label: "Results Analysis", icon: LineChart },
    { id: "monitoring", label: "Test Monitoring", icon: BarChart3 },
    { id: "repository", label: "Test Repository", icon: BookOpen },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-indigo-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 shadow-2xl border-b-4 border-indigo-400">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur rounded-2xl border-2 border-white/30">
              <FlaskConical size={36} className="text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight">
                E2E Experimentation Platform
              </h1>
              <p className="text-indigo-100 text-sm mt-1">
                Complete toolkit for planning, running, and analyzing A/B tests
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-semibold text-sm transition-all relative ${
                    activeTab === tab.id
                      ? "text-indigo-700 bg-gradient-to-b from-purple-50 to-indigo-50"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Icon size={18} />
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-t-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {activeTab === "sample-size" && <SampleSizeTab />}
        {activeTab === "analysis" && (
          <PlaceholderTab
            title="Results Analysis"
            description="Analyze your experiment results with statistical significance testing, confidence intervals, and effect size calculations."
            icon={LineChart}
          />
        )}
        {activeTab === "monitoring" && (
          <PlaceholderTab
            title="Test Monitoring"
            description="Monitor running experiments in real-time, track sample ratio mismatch, and detect early stopping conditions."
            icon={BarChart3}
          />
        )}
        {activeTab === "repository" && (
          <PlaceholderTab
            title="Test Repository"
            description="Maintain a centralized repository of all your experiments with metadata, results, and learnings."
            icon={BookOpen}
          />
        )}
      </div>
    </div>
  );
}