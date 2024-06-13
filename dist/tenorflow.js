let faustNode = null;  // 在全局作用域定义 faustNode

/**
 * @typedef {import("./types").FaustDspDistribution} FaustDspDistribution
 * @typedef {import("./faustwasm").FaustAudioWorkletNode} FaustAudioWorkletNode
 * @typedef {import("./faustwasm").FaustDspMeta} FaustDspMeta
 * @typedef {import("./faustwasm").FaustUIDescriptor} FaustUIDescriptor
 * @typedef {import("./faustwasm").FaustUIGroup} FaustUIGroup
 * @typedef {import("./faustwasm").FaustUIItem} FaustUIItem
 */

/** @type {HTMLSpanElement} */
const $spanAudioInput = document.getElementById("audio-input");
/** @type {HTMLSpanElement} */
const $spanMidiInput = document.getElementById("midi-input");
/** @type {HTMLSelectElement} */
const $selectAudioInput = document.getElementById("select-audio-input");
/** @type {HTMLSelectElement} */
const $selectMidiInput = document.getElementById("select-midi-input");
/** @type {HTMLSelectElement} */
const $buttonDsp = document.getElementById("button-dsp");
/** @type {HTMLDivElement} */
const $divFaustUI = document.getElementById("div-faust-ui");
/** @type {HTMLButtonElement} */
const $presetButton = document.getElementById("preset-button");

/** @type {typeof AudioContext} */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioCtx({ latencyHint: 0.00001, echoCancellation: false, autoGainControl: false, noiseSuppression: false });
audioContext.destination.channelInterpretation = "discrete";
audioContext.suspend();

/**
 * @param {FaustAudioWorkletNode} faustNode 
 */
const buildAudioDeviceMenu = async (faustNode) => {
    /** @type {MediaStreamAudioSourceNode} */
    let inputStreamNode;
    const handleDeviceChange = async () => {
        const devicesInfo = await navigator.mediaDevices.enumerateDevices();
        $selectAudioInput.innerHTML = '';
        devicesInfo.forEach((deviceInfo, i) => {
            const { kind, deviceId, label } = deviceInfo;
            if (kind === "audioinput") {
                const option = new Option(label || `microphone ${i + 1}`, deviceId);
                $selectAudioInput.add(option);
            }
        });
    }
    await handleDeviceChange();
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange)
    $selectAudioInput.onchange = async () => {
        const id = $selectAudioInput.value;
        const constraints = {
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                deviceId: id ? { exact: id } : undefined,
            },
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (inputStreamNode) inputStreamNode.disconnect();
        inputStreamNode = audioContext.createMediaStreamSource(stream);
        inputStreamNode.connect(faustNode);
    };

    const defaultConstraints = {
        audio: {
            echoCancellation: false,
            mozNoiseSuppression: false,
            mozAutoGainControl: false
        }
    };
    const defaultStream = await navigator.mediaDevices.getUserMedia(defaultConstraints);
    if (defaultStream) {
        inputStreamNode = audioContext.createMediaStreamSource(defaultStream);
        inputStreamNode.connect(faustNode);
    }
};

/**
 * @param {FaustAudioWorkletNode} faustNode 
 */
const buildMidiDeviceMenu = async (faustNode) => {
    const midiAccess = await navigator.requestMIDIAccess();
    /** @type {WebMidi.MIDIInput} */
    let currentInput;
    /**
     * @param {WebMidi.MIDIMessageEvent} e
     */
    const handleMidiMessage = e => faustNode.midiMessage(e.data);
    const handleStateChange = () => {
        const { inputs } = midiAccess;
        if ($selectMidiInput.options.length === inputs.size + 1) return;
        if (currentInput) currentInput.removeEventListener("midimessage", handleMidiMessage);
        $selectMidiInput.innerHTML = '<option value="-1" disabled selected>Select...</option>';
        inputs.forEach((midiInput) => {
            const { name, id } = midiInput;
            const option = new Option(name, id);
            $selectMidiInput.add(option);
        });
    };
    handleStateChange();
    midiAccess.addEventListener("statechange", handleStateChange);
    $selectMidiInput.onchange = () => {
        if (currentInput) currentInput.removeEventListener("midimessage", handleMidiMessage);
        const id = $selectMidiInput.value;
        currentInput = midiAccess.inputs.get(id);
        currentInput.addEventListener("midimessage", handleMidiMessage);
    };
};

$buttonDsp.disabled = true;
$buttonDsp.onclick = () => {
    if (audioContext.state === "running") {
        $buttonDsp.textContent = "Suspended";
        audioContext.suspend();
    } else if (audioContext.state === "suspended") {
        $buttonDsp.textContent = "Running";
        audioContext.resume();
    }
}

/**
 * Creates a Faust audio node for use in the Web Audio API.
 *
 * @param {AudioContext} audioContext - The Web Audio API AudioContext to which the Faust audio node will be connected.
 * @param {string} dspName - The name of the DSP to be loaded.
 * @param {number} voices - The number of voices to be used for polyphonic DSPs.
 * @param {boolean} sp - Whether to create a ScriptProcessorNode instead of an AudioWorkletNode.
 * @returns {Object} - An object containing the Faust audio node and the DSP metadata.
 */
const createFaustNode = async (audioContext, dspName = "template", voices = 0, sp = false) => {
    // Import necessary Faust modules and data
    const { FaustMonoDspGenerator, FaustPolyDspGenerator, instantiateFaustModule, LibFaust, FaustCompiler } = await import("../node_modules/@grame/faustwasm/dist/esm-bundle/index.js");

    const faustModule = await instantiateFaustModule();
    const libFaust = new LibFaust(faustModule);
    const faustCompiler = new FaustCompiler(libFaust);
    // Load DSP file from JSON
    const dspText = await (await fetch("../tenorflow.dsp")).text();

    let dspMeta;
    /** @type {FaustAudioWorkletNode} */
    let faustNode;

    // Create either a polyphonic or monophonic Faust audio node based on the number of voices
    if (voices > 0) {
        const generator = new FaustPolyDspGenerator();
        await generator.compile(faustCompiler, "tenorflow", dspText, "-I libraries/ -ftz 2");
        faustNode = await generator.createNode(
            audioContext,
            voices,
            "FaustPolyDSP",
            undefined,
            undefined,
            undefined,
            sp
        );
        dspMeta = generator.getMeta();
    } else {
        const generator = new FaustMonoDspGenerator();
        await generator.compile(faustCompiler, "tenorflow", dspText, "-I libraries/ -ftz 2");
        faustNode = await generator.createNode(
            audioContext,
            "FaustMonoDSP",
            undefined,
            sp
        );
        dspMeta = generator.getMeta();
    }

    // Return an object with the Faust audio node and the DSP metadata
    return { faustNode, dspMeta };
}

/**
 * @param {FaustAudioWorkletNode} faustNode 
 */
const createFaustUI = async (faustNode) => {
    const { FaustUI } = await import("./faust-ui/index.js");
    const $container = document.createElement("div");
    $container.style.margin = "0";
    $container.style.position = "absolute";
    $container.style.overflow = "auto";
    $container.style.display = "flex";
    $container.style.flexDirection = "column";
    $container.style.width = "100%";
    $container.style.height = "100%";
    $divFaustUI.appendChild($container);
    /** @type {import("@shren/faust-ui").FaustUI} */
    const faustUI = new FaustUI({
        ui: faustNode.getUI(),
        root: $container,
        listenWindowMessage: false,
        listenWindowResize: true,
    });
    faustUI.paramChangeByUI = (path, value) => faustNode.setParamValue(path, value);
    faustNode.setOutputParamHandler((path, value) => faustUI.paramChangeByDSP(path, value));
    $container.style.minWidth = `${faustUI.minWidth}px`;
    $container.style.minHeight = `${faustUI.minHeight}px`;
    faustUI.resize();
    return faustUI;
};

const FORMANT_DATA = {
    A: {
        freq: [650, 1080, 2650, 2900, 3250],
        bandwidth: [50, 90, 120, 130, 140],
        gain: [1, 0.5, 0.44, 0.39, 0.07]
    },
    E: {
        freq: [400, 1700, 2600, 3200, 3580],
        bandwidth: [70, 80, 100, 120, 120],
        gain: [1, 0.2, 0.25, 0.2, 0.1]
    },
    I: {
        freq: [290, 1870, 2800, 3250, 3540],
        bandwidth: [40, 90, 100, 120, 120],
        gain: [1, 0.17, 0.12, 0.1, 0.03]
    },
    O: {
        freq: [400, 800, 2600, 2800, 3000],
        bandwidth: [70, 80, 100, 130, 135],
        gain: [1, 0.31, 0.25, 0.25, 0.05]
    },
    U: {
        freq: [350, 600, 2700, 2900, 3300],
        bandwidth: [40, 60, 100, 120, 120],
        gain: [1, 0.1, 0.14, 0.19, 0.05]
    }
};

/**
 * @param {import("./faustwasm/index").FaustAudioWorkletNode} faustNode
 * @param {import("@shren/faust-ui").FaustUI} faustUI
 **/
const bindButtons = (faustNode, faustUI) => {
    // 绑定每个元音按钮
    ['A', 'E', 'I', 'O', 'U'].forEach(vowel => {
        document.getElementById(vowel + '-button').addEventListener('click', () => {
            // 应用每个参数类型
            ['bandwidth', 'freq', 'gain'].forEach(paramType => {
                FORMANT_DATA[vowel][paramType].forEach((value, index) => {
                    const paramName = `/tenorflow/formants/formant_${index}/${paramType.charAt(0).toUpperCase() + paramType.slice(1)}_${index}`;
                    faustNode.setParamValue(paramName, value);
                    faustUI.paramChangeByDSP(paramName, value);
                });
            });
        });
    });
};

(async () => {
    const { faustNode: localFaustNode, dspMeta: { name } } = await createFaustNode(audioContext, "tenorflow");
    faustNode = localFaustNode;  // 初始化全局的 faustNode
    const faustUI = await createFaustUI(faustNode);
    faustNode.connect(audioContext.destination);
    if (faustNode.numberOfInputs) await buildAudioDeviceMenu(faustNode);
    else $spanAudioInput.hidden = true;
    if (navigator.requestMIDIAccess) await buildMidiDeviceMenu(faustNode);
    else $spanMidiInput.hidden = true;
    $buttonDsp.disabled = false;
    document.title = name;
    bindButtons(faustNode, faustUI);
})();

