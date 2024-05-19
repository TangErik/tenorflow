import("stdfaust.lib");

// freq = hslider("freq", 50, 50, 1000, 0.1);


formantFs = par(i, 5, hslider("formantFreq_%i", 100, 0, 8000, 1));
formantBWs = par(i, 5, hslider("formantBandwidth_%i", 10, 0, 500, 1));
formantGs = par(i, 5, hslider("formantGain_%i", 0, 0, 1, 0.01));

formantFilterbank = par(i, 5, fi.resonbp(f, q, g) with {
    f = ba.take(i + 1, formantFs) : pm.autobendFreq(i, freq, 4);
    q = f / ba.take(i + 1, formantBWs);
    g = ba.take(i + 1, formantGs) : pm.vocalEffort(freq, 0);
});

process = os.pulsetrain(freq, 0.99) <: formantFilterbank :> fi.lowpass(2, freq * 5) * gain * gate;

freq = ba.midikey2hz(ba.hz2midikey(hslider("freq", 100, 20, 1000, 0.1)) + os.osc(5) * 0.3 + no.noise * 0.3 : si.smoo);
gain = hslider("gain", 0, 0, 1, 0.01);
gate = hslider("gate", 0, 0, 1, 1);
vowel = hslider("vowel", 0, 0, 4, 0.01);
// type = hslider("type", 0, 0, 4, 1);
// process = os.pulsetrain(freq, 0.99) : formantFilterbankBP(vowel, freq) * (0.8 + os.osc(3) * 0.1 + no.noise * 0.1 : si.smoo) : fi.lowpass(2, freq * 5) * gain * gate;