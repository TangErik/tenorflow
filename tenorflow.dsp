import("stdfaust.lib");

// FormantsBank
formantFs = par(i, 7, hslider("/h:formants/v:formant_%i/Freq_%i[style:knob]", 100, 0, 4000, 1));
formantBWs = par(i, 7, hslider("/h:formants/v:formant_%i/Bandwidth_%i[style:knob]", 10, 0, 200, 1));
formantGs = par(i, 7, hslider("/h:formants/v:formant_%i/Gain_%i[style:knob]", 0, 0, 1, 0.01));
formantFilterbank = par(i, 7, fi.resonbp(f, q, g) with {
    f = ba.take(i + 1, formantFs) : pm.autobendFreq(i, freq, 4);
    q = f / ba.take(i + 1, formantBWs);
    g = ba.take(i + 1, formantGs) : pm.vocalEffort(freq, 0);
});

// Breath
wnoise = no.noise : fi.lowpass(2, freq * 3);
pnoise = no.pink_noise : fi.lowpass(2, freq * 2);
breathType = hslider("/h:settings/v:Noise/breathType", 0, 0, 1, 1);
selectedBreath = select2(breathType, wnoise, pnoise);
breathVolume = hslider("/h:settings/v:Noise/breathVolume", 0, 0, 1, 0.01);

// Vibrato
vibrato_base_freq = hslider("/v:2/h:vibrato/VibratoFreq[style:knob]", 0, 0, 20, 0.1);
vibrato_depth = hslider("/v:2/h:vibrato/VibratoDepth[style:knob]", 0, 0, 180, 0.1);
vibrato_freq = (vibrato_base_freq + 4 * no.noise) : si.smoo;
vibrato = checkbox("/v:1/[1]Vibrato");
vibrato_effect = os.osc(vibrato_freq + no.noise * 0.1) * vibrato_depth * vibrato;
vibrato_jitter = hslider("/v:2/h:vibrato/VibratoJitter[style:knob]", 1, 0, 1, 0.1);
freq = hslider("/h:settings/v:Voice/freq", 150, 20, 500, 0.1) + vibrato_effect + no.noise * vibrato_jitter : si.smoo;

// Envelop
a = hslider("/v:2/h:envelop/[0]attack[style:knob]", 0.32, 0, 2, 0.01);
d = hslider("/v:2/h:envelop/[1]decay[style:knob]", 0.26, 0, 8, 0.01);
s = hslider("/v:2/h:envelop/[2]sustain[style:knob]", 0.83, 0, 1, 0.01);
r = hslider("/v:2/h:envelop/[3]release[style:knob]", 0.21, 0, 8, 0.01);
t = button("/v:1/[2]trigger");
envelop = en.adsr(a, d, s, r, gate);

// Reverb
// dt = hslider("/v:2/h:reverb/h:reverb1/[0]dt[style:knob]", 1, 0.1, 60, 0.1);
damp = hslider("/v:2/h:3/h:reverb/[2]damp[style:knob]", 0.5, 0, 1, 0.01);
// size = hslider("/v:2/h:reverb/h:reverb1/[2]size[style:knob]", 2, 0.5, 3, 0.1);
// early_diff = hslider("/v:2/h:reverb/h:reverb1/[3]early_diff[style:knob]", 0.7, 0, 1, 0.1);
// feedback = hslider("/v:2/h:reverb/h:reverb1/[4]feedback[style:knob]", 0, 0, 1, 0.1);
// mod_depth = hslider("/v:2/h:reverb/h:reverb1/[5]mod_depth[style:knob]", 0.5, 0, 1, 0.1);
// mod_freq = hslider("/v:2/h:reverb/h:reverb1/[6]mod_freq[style:knob]", 1, 0, 10, 0.1);
// low = hslider("/v:2/h:reverb/h:reverb2/[6]low[style:knob]", 0.5, 0, 1, 0.1);
// mid = hslider("/v:2/h:reverb/h:reverb2/[7]mid[style:knob]", 0.5, 0, 1, 0.1);
// high = hslider("/v:2/h:reverb/h:reverb2/[8]high[style:knob]", 0.5, 0, 1, 0.1);
// low_cutoff = hslider("/v:2/h:reverb/h:reverb2/[9]low_cutoff[style:knob]", 100, 100, 6000, 1);
// high_cutoff = hslider("/v:2/h:reverb/h:reverb2/[10]high_cutoff[style:knob]", 1000, 1000, 10000, 1);
fb1 = hslider("/v:2/h:3/h:reverb/[0]fb1[style:knob]", 0, 0, 1, 0.01);
fb2 = hslider("/v:2/h:3/h:reverb/[1]fb2[style:knob]", 0, 0, 1, 0.01);
spread = hslider("/v:2/h:3/h:reverb/[3]spread[style:knob]", 0, 0, 1, 0.01);

Reverb = checkbox("/v:1/[3]Reverb");

// Settings
gain = hslider("/h:settings/v:Voice/gain", 0.2, 0, 1, 0.01) * 0.2;
gate = checkbox("/v:1/[0]gate");
duty = hslider("/h:settings/v:Voice/duty", 0.99, 0, 1, 0.01);
wave = os.pulsetrain(freq, duty);

process = wave + selectedBreath * breathVolume <: formantFilterbank :> fi.lowpass(2, freq * 5) * gain * envelop * gate * t <: _, _;

// <: _, _ : re.jpverb(t60, damp, size, early_diff, mod_depth, mod_freq, low, mid, high, low_cutoff, high_cutoff) : _, _ ;
// <: _, _ : re.greyhole(dt, damp, size, early_diff, feedback, mod_depth, mod_freq) : _, _;
// : re.stereo_freeverb(fb1, fb2, damp, spread) : _, _
