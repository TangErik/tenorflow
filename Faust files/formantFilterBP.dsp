//-------`(pm.)formantFilterBP`--------------
// Formant filter based on a single resonant bandpass filter.
// Formant parameters are linearly interpolated allowing to go smoothly from
// one vowel to another. Voice type can be selected but must correspond to
// the frequency range of the provided source to be realistic.
//
// #### Usage
//
// ```
// _ : formantFilterBP(voiceType,vowel,nFormants,i,freq) : _
// ```
//
// Where:
//
// * `voiceType`: the voice type (0: alto, 1: bass, 2: countertenor, 3: soprano, 4: tenor)
// * `vowel`: the vowel (0: a, 1: e, 2: i, 3: o, 4: u)
// * `nFormants`: number of formant regions in frequency domain, typically 5
// * `i`: formant index used to index formant data value arrays
// * `freq`: fundamental frequency of excitation signal.
//--------------------------------------
formantFilterBP(voiceType,vowel,nFormants,i,freq) =
	fi.resonbp(formantFreq(i),formantFreq(i)/formantBw(i),
		   formantGain(i))
with{
	index = (voiceType*nFormants)+vowel; // index of formant values
	// formant center frequency using autobend correction
	formantFreq(i) = ba.listInterp(formantValues.f(i),index) : autobendFreq(i,freq,voiceType);
	// formant amplitude using vocal effort correction
	formantGain(i) = ba.listInterp(formantValues.g(i),index) : vocalEffort(freq,gender);
	formantBw(i) = ba.listInterp(formantValues.bw(i),index); // formant bandwidth
	gender = voiceGender(voiceType); // gender of voice
};


//-------`(pm.)formantFilterbank`--------------
// Formant filterbank which can use different types of filterbank
// functions and different excitation signals. Formant parameters are
// linearly interpolated allowing to go smoothly from one vowel to another.
// Voice type can be selected but must correspond to the frequency range
// of the provided source to be realistic.
//
// #### Usage
//
// ```
// _ : formantFilterbank(voiceType,vowel,formantGen,freq) : _
// ```
//
// Where:
//
// * `voiceType`: the voice type (0: alto, 1: bass, 2: countertenor, 3: soprano, 4: tenor)
// * `vowel`: the vowel (0: a, 1: e, 2: i, 3: o, 4: u)
// * `formantGen`: the specific formant filterbank function
//  (i.e. FormantFilterbankBP, FormantFilterbankFof,...)
// * `freq`: fundamental frequency of excitation signal. Needed for FOF
//  version to calculate rise time of envelope
//--------------------------------------
declare formantFilterbank author "Mike Olsen";

formantFilterbank(voiceType,vowel,formantGen,freq) =
	_ <: par(i,nFormants,formantGen(voiceType,vowel,nFormants,i,freq)) :> _
with{
	nFormants = 5;
};

//-------`(pm.)formantFilterbankBP`--------------
// Formant filterbank based on a bank of resonant bandpass filters.
// Formant parameters are linearly interpolated allowing to go smoothly from
// one vowel to another. Voice type can be selected but must correspond to
// the frequency range of the provided source to be realistic.
//
// #### Usage
//
// ```
// _ : formantFilterbankBP(voiceType,vowel,freq) : _
// ```
//
// Where:
//
// * `voiceType`: the voice type (0: alto, 1: bass, 2: countertenor, 3: soprano, 4: tenor)
// * `vowel`: the vowel (0: a, 1: e, 2: i, 3: o, 4: u)
// * `freq`: the fundamental frequency of the excitation signal. Needed for the autobendFreq and vocalEffort functions
//--------------------------------------
formantFilterbankBP(voiceType,vowel,freq) =
formantFilterbank(voiceType,vowel,formantFilterBP,freq);