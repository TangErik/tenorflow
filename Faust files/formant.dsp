import("stdfaust.lib");

freq = ba.midikey2hz(ba.hz2midikey(hslider("freq", 100, 65, 550, 0.1)) + os.osc(4) * 0.3 + no.noise * 0.3 : si.smoo);
vowel = hslider("vowel", 0, 0, 4, 0.01);
type = hslider("type", 0, 0, 4, 1);
voiceVolume = hslider("voiceVolume", 0, 0, 20, 0.1) : si.smoo;
noiseVolume = hslider("noiseVolume", 0, 0, 20, 0.1);

airnoise = no.noise * noiseVolume : fi.highpass(2, freq * 20);
voice = freq * voiceVolume;

process = os.pulsetrain(voice, 0.99) + airnoise : pm.formantFilterbankBP(type, vowel, freq) * (0.8 + os.osc(3) * 0.1 + no.noise * 0.1 : si.smoo) : fi.lowpass(2, freq * 5);
