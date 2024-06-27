import("stdfaust.lib");

formantFs = par(i, 5, hslider("/h:formants/v:formant_%i/Freq_%i[style:knob]", 100, 0, 4000, 100));
formantBWs = par(i, 5, hslider("/h:formants/v:formant_%i/Bandwidth_%i[style:knob]", 10, 0, 200, 10));
formantGs = par(i, 5, hslider("/h:formants/v:formant_%i/Gain_%i[style:knob]", 0, 0, 1, 0.01));
formantFilterbank = par(i, 5, fi.resonbp(f, q, g) with {
    f = ba.take(i + 1, formantFs) : pm.autobendFreq(i, freq, 4);
    q = f / ba.take(i + 1, formantBWs);
    g = ba.take(i + 1, formantGs) : pm.vocalEffort(freq, 0);
});

noiseVolume = hslider("/h:settings/v:Noise/noiseVolume", 0, 0, 1, 0.01);
wnoise = no.noise : fi.lowpass(2, freq * 5);
pnoise = no.pink_noise : fi.lowpass(2, freq * 5);
noiseType = hslider("/h:settings/v:Noise/noiseType", 0, 0, 1, 1);
selectedNoise = select2(noiseType, wnoise, pnoise);
vibrato_freq = (4 + 4 * no.noise) : si.smoo;
vibrato_effect = os.osc(vibrato_freq) * 0.7 * vibrato;
freq = hslider("/h:settings/v:Voice/Frequency", 100, 20, 600, 0.1) + vibrato_effect + no.noise * 0.9 : si.smoo;
gain = hslider("/h:settings/v:Voice/Gain", 0, 0, 1, 0.01);
gate = checkbox("Gate");
vibrato = checkbox("Vibrato");

process = os.pulsetrain(freq, 0.99) + selectedNoise * noiseVolume <: formantFilterbank :> fi.lowpass(2, freq * 5) * gain * gate;
