//AEIOU

formantValues = environment {
	f(0) = (650,400,290,400,350); // formant 0 freqs
	f(1) = (1080,1700,1870,800,600); // formant 1 freqs
	f(2) = (2650,2600,2800,2600,2700); // formant 2 freqs
	f(3) = (2900,3200,3250,2800,2900); // formant 3 freqs
	f(4) = (3250,3580,3540,3000,3300); // formant 4 freqs
	g(0) = (1,1,1,1,1); // formant 0 gains
	g(1) = (0.501187,0.199526,0.177828,0.316228,0.100000); // formant 1 gains
	g(2) = (0.446684,0.251189,0.125893,0.251189,0.141254); // formant 2 gains
	g(3) = (0.398107,0.199526,0.100000,0.251189,0.199526); // formant 3 gains
	g(4) = (0.079433,0.100000,0.031623,0.050119,0.050119); // formant 4 gains
	bw(0) = (50,70,40,70,40); // formant 0 bandwidths
	bw(1) = (90,80,90,80,60); // formant 1 bandwidths
	bw(2) = (120,100,100,100,100); // formant 2 bandwidths
	bw(3) = (130,120,120,130,120); // formant 3 bandwidths
	bw(4) = (140,120,120,135,120); // formant 4 bandwidths
};


// array of values used to multiply BWs by to get attack Bws for FOF version.
// min/max values per vowel (AEIOU) and per gender (M/F). Index by:
// gender*5 + vowel;
// values were chosen based on informal listening tests
bwMultMins = (1.0, 1.25, 1.25, 1.0, 1.5);
bwMultMaxes = (10.0, 2.5, 2.5, 10.0, 4.0);

// minimum/maximum frequency values per gender (M/F) used in the calculation
// of the attack Bws from the release Bws in the FOF version
// values are based on arbitrary maximum/minimum singing values
// in Hz for male/female voices
minGenderFreq = (82.41);
maxGenderFreq = (523.25);

//--------------`(pm.)voiceGender`-----------------
// Calculate the gender for the provided `voiceType` value. (0: male, 1: female)
//
// #### Usage
//
// ```
// voiceGender(voiceType) : _
// ```
//
// Where:
//
// * `voiceType`: the voice type (0: alto, 1: bass, 2: countertenor, 3: soprano, 4: tenor)
//---------------------------------------------
declare voiceGender author "Mike Olsen";

voiceGender(voiceType) = 0;

//-----------`(pm.)skirtWidthMultiplier`------------
// Calculates value to multiply bandwidth to obtain `skirtwidth`
// for a Fof filter.
//
// #### Usage
//
// ```
// skirtWidthMultiplier(vowel,freq,gender) : _
// ```
//
// Where:
//
// * `vowel`: the vowel (0: a, 1: e, 2: i, 3: o, 4: u)
// * `freq`: the fundamental frequency of the excitation signal
// * `gender`: gender of the voice used in the fof filter (0: male, 1: female)
//---------------------------------------------
declare skirtWidthMultiplier author "Mike Olsen";

skirtWidthMultiplier(vowel, freq) = (multMax - multMin) * skirtParam + multMin
with {
    nVowels = 5;
    index = vowel;
    multMin = bwMultMins : ba.selectn(10, index);
    multMax = bwMultMaxes : ba.selectn(10, index);
    freqMin = minGenderFreq : ba.selectn(2, 0); 
    freqMax = maxGenderFreq : ba.selectn(2, 0); 
    skirtParam = ba.if(freq <= freqMin, 0.0, ba.if(freq >= freqMax, 1.0,
                    (1.0 / (freqMax - freqMin)) * (freq - freqMin)));
};


//--------------`(pm.)autobendFreq`-----------------
// Autobends the center frequencies of formants 1 and 2 based on
// the fundamental frequency of the excitation signal and leaves
// all other formant frequencies unchanged. Ported from `chant-lib`.
//
// #### Reference
//
// <https://ccrma.stanford.edu/~rmichon/chantLib/>.
//
// #### Usage
//
// ```
// _ : autobendFreq(n,freq,voiceType) : _
// ```
//
// Where:
//
// * `n`: formant index
// * `freq`: the fundamental frequency of the excitation signal
// * `voiceType`: the voice type (0: alto, 1: bass, 2: countertenor, 3: soprano, 4: tenor)
// * input is the center frequency of the corresponding formant
//---------------------------------------------
declare autobendFreq author "Mike Olsen";

autobendFreq(n,freq) = autobend(n)
with {
    autobend(0) = _ <: ba.if(_ <= freq,freq,_);
    autobend(1) = _ <: ba.if((_ >= 1300)&(freq >= 200),
                                _ -(freq-200)*(_-1300)/1050,
                                ba.if(_ <= (30 + 2*freq),30 + 2*freq,_));
    autobend(n) = _;
};


//--------------`(pm.)vocalEffort`-----------------
// Changes the gains of the formants based on the fundamental
// frequency of the excitation signal. Higher formants are
// reinforced for higher fundamental frequencies.
// Ported from `chant-lib`.
//
// #### Reference
//
// <https://ccrma.stanford.edu/~rmichon/chantLib/>.
//
// #### Usage
//
// ```
// _ : vocalEffort(freq) : _
// ```
//
// Where:
//
// * `freq`: the fundamental frequency of the excitation signal
// * input is the linear amplitude of the formant
//---------------------------------------------
declare vocalEffort author "Mike Olsen";

vocalEffort(freq) = _ <: ba.if(freq <= 400, *(3 + 1.1 * (400 - freq) / 300), *(0.8 + 1.05 * (1000 - freq) / 1250));



//-------------------------`(pm.)fof`--------------------------
// Function to generate a single Formant-Wave-Function.
// 
// #### Reference
//
// <https://ccrma.stanford.edu/~mjolsen/pdfs/smc2016_MOlsenFOF.pdf>.
//
// #### Usage
//
// ```
// _ : fof(fc,bw,a,g) : _
// ```
//
// Where:
//
// * `fc`: formant center frequency,
// * `bw`: formant bandwidth (Hz),
// * `sw`: formant skirtwidth (Hz)
// * `g`: linear scale factor (g=1 gives 0dB amplitude response at fc)
// * input is an impulse signal to excite filter
//---------------------------------------------------------
declare fof author "Mike Olsen";

fof(fc,bw,sw,g) = _ <: (_',_) : (f * s)
with {
	T = 1/ma.SR; 	      	// sample period
	pi = ma.PI;         	// pi
	u1 = exp(-sw*pi*T); 	// exponential controlling rise
	u2 = exp(-bw*pi*T); 	// exponential controlling decay
	a1 = -1*(u1+u2);    	// a1 filter coefficient
	a2 = u1*u2;         	// a2 filter coefficient
	G0 = 1/(1+a1+a2);   	// magnitude at DC
	b0 = g/G0;          	// filter gain
	s  = os.hs_oscsin(fc); 	// hardsyncing wavetable oscillator
	f  = fi.tf2(b0,0,0,a1,a2); // biquad filter
};