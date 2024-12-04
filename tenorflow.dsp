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
vibrato_base_freq = hslider("/v:2/h:vibrato/VibratoFreq[style:knob]", 4, 0, 10, 0.1);
vibrato_depth = hslider("/v:2/h:vibrato/VibratoDepth[style:knob]", 0.7, 0, 180, 0.1);
vibrato_freq = (vibrato_base_freq + 4 * no.noise) : si.smoo;
vibrato = checkbox("/v:1/[1]Vibrato");
vibrato_effect = os.osc(vibrato_freq + no.noise * 0.1) * vibrato_depth * vibrato;
vibrato_jitter = hslider("/v:2/h:vibrato/VibratoJitter[style:knob]", 0.9, 0, 1, 0.1);
freq = hslider("/h:settings/v:Voice/freq", 150, 20, 500, 0.1) + vibrato_effect + no.noise * vibrato_jitter : si.smoo;

// Envelop
a = hslider("/v:2/h:envelop/[0]attack[style:knob]", 0.32, 0, 2, 0.01);
d = hslider("/v:2/h:envelop/[1]decay[style:knob]", 0.26, 0, 1, 0.01);
s = hslider("/v:2/h:envelop/[2]sustain[style:knob]", 0.83, 0, 1, 0.01);
r = hslider("/v:2/h:envelop/[3]release[style:knob]", 0.21, 0, 8, 0.01);
t = button("/v:1/[2]trigger");
envelop = en.adsr(a, d, s, r, t);

// Settings
gain = hslider("/h:settings/v:Voice/gain", 0.2, 0, 1, 0.01);
gate = checkbox("/v:1/[0]gate");
duty = hslider("/h:settings/v:Voice/duty", 0.99, 0, 1, 0.01);
wave = os.pulsetrain(freq, duty);

process = wave + selectedBreath * breathVolume <: formantFilterbank :> fi.lowpass(2, freq * 5) * gain * envelop * gate;
