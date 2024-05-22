import("stdfaust.lib");

formantFs = par(i, 5, hslider("/h:formants/v:formant_%i/formantFreq_%i", 100, 0, 8000, 1));
formantBWs = par(i, 5, hslider("/h:formants/v:formant_%i/formantBandwidth_%i", 10, 0, 500, 1));
formantGs = par(i, 5, hslider("/h:formants/v:formant_%i/formantGain_%i", 0, 0, 1, 0.01));
formantFilterbank = par(i, 5, fi.resonbp(f, q, g) with {
    f = ba.take(i + 1, formantFs) : pm.autobendFreq(i, freq, 4);
    q = f / ba.take(i + 1, formantBWs);
    g = ba.take(i + 1, formantGs) : pm.vocalEffort(freq, 0);
});

noiseVolume = hslider("noiseVolume", 0, 0, 20, 0.1);
airnoise = no.noise : fi.highpass(2, freq * 20);
freq = ba.midikey2hz(ba.hz2midikey(hslider("freq", 100, 20, 1000, 0.1)) + os.osc(5) * 0.3 + no.noise * 0.3 : si.smoo);
gain = hslider("gain", 0, 0, 1, 0.01);
gate = hslider("gate", 0, 0, 1, 1);

process = os.pulsetrain(freq, 0.99) + airnoise * noiseVolume <: formantFilterbank :> fi.lowpass(2, freq * 5) * gain * gate;
