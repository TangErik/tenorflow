/** @type {import("@grame/faustwasm").FaustAudioWorkletNode} */
let faustNode = null;  // 在全局作用域定义 faustNode
let currentParams = [];

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
 * @returns {Promise<{ faustNode: import("@grame/faustwasm").FaustAudioWorkletNode; dspMeta: import("@grame/faustwasm").FaustDspMeta }> }} - An object containing the Faust audio node and the DSP metadata.
 */
const createFaustNode = async (audioContext, dspName = "template", voices = 0, sp = false) => {
    // Import necessary Faust modules and data
    const { FaustMonoDspGenerator, FaustPolyDspGenerator, instantiateFaustModule, LibFaust, FaustCompiler } = await import("./faustwasm/esm-bundle/index.js");

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
    $container.style.overflow = "auto";
    $container.style.display = "flex";
    $container.style.flexDirection = "column";
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
    // $container.style.minWidth = `${faustUI.minWidth}px`;
    // $container.style.minHeight = `${faustUI.minHeight}px`;
    faustUI.resize();
    return faustUI;
};

const FORMANT_DATA = {
    "i": {
        "freq": [240, 2400, 3300, 2800, 3100, 3400, 3500],
        "bandwidth": [60, 90, 120, 120, 120, 120, 120],
        "gain": [1, 0.5, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "y": {
        "freq": [240, 2000, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [60, 80, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ɨ": {
        "freq": [300, 1700, 2400, 2800, 3100, 3400, 3500],
        "bandwidth": [70, 80, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.2, 0.25, 0.25, 0.25, 0.25]
    },
    "ʉ": {
        "freq": [325, 1700, 2300, 2800, 3100, 3400, 3500],
        "bandwidth": [70, 90, 120, 120, 120, 120, 120],
        "gain": [1, 0.3, 0.2, 0.25, 0.25, 0.25, 0.25]
    },
    "w": {
        "freq": [370, 1300, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [80, 100, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "u": {
        "freq": [290, 540, 740, 2800, 3100, 3400, 3500],
        "bandwidth": [80, 100, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ɛ": {
        "freq": [560, 2300, 3000, 2800, 3100, 3400, 3500],
        "bandwidth": [70, 90, 120, 120, 120, 120, 120],
        "gain": [1, 0.5, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ø": {
        "freq": [400, 2000, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [70, 90, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ɘ": {
        "freq": [450, 1750, 2400, 2800, 3100, 3400, 3500],
        "bandwidth": [70, 90, 120, 120, 120, 120, 120],
        "gain": [1, 0.3, 0.2, 0.25, 0.25, 0.25, 0.25]
    },
    "ɵ": {
        "freq": [450, 1500, 2300, 2800, 3100, 3400, 3500],
        "bandwidth": [80, 100, 120, 120, 120, 120, 120],
        "gain": [1, 0.3, 0.2, 0.25, 0.25, 0.25, 0.25]
    },
    "ɤ": {
        "freq": [550, 1200, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [90, 110, 120, 120, 120, 120, 120],
        "gain": [1, 0.3, 0.2, 0.25, 0.25, 0.25, 0.25]
    },
    "o": {
        "freq": [450, 720, 800, 2800, 3100, 3400, 3500],
        "bandwidth": [90, 110, 120, 120, 120, 120, 120],
        "gain": [1, 0.3, 0.2, 0.25, 0.25, 0.25, 0.25]
    },
    "ə": {
        "freq": [500, 1500, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [80, 100, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "e": {
        "freq": [550, 1850, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [80, 100, 120, 120, 120, 120, 120],
        "gain": [1, 0.5, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "œ": {
        "freq": [550, 1500, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [90, 110, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ɜ": {
        "freq": [600, 1600, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [80, 100, 120, 120, 120, 120, 120],
        "gain": [1, 0.5, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ɞ": {
        "freq": [600, 1400, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [80, 100, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ʌ": {
        "freq": [600, 1200, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [80, 100, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ɔ": {
        "freq": [600, 800, 1000, 2800, 3100, 3400, 3500],
        "bandwidth": [90, 110, 120, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "æ": {
        "freq": [700, 2300, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [100, 120, 140, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ɐ": {
        "freq": [750, 1300, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [100, 120, 140, 120, 120, 120, 120],
        "gain": [1, 0.3, 0.2, 0.25, 0.25, 0.25, 0.25]
    },
    "aa": {
        "freq": [1000, 1280, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [110, 130, 150, 120, 120, 120, 120],
        "gain": [1, 0.5, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "ɶ": {
        "freq": [800, 1400, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [110, 130, 150, 120, 120, 120, 120],
        "gain": [1, 0.4, 0.3, 0.25, 0.25, 0.25, 0.25]
    },
    "a": {
        "freq": [850, 900, 2500, 2800, 3100, 3400, 3500],
        "bandwidth": [110, 130, 150, 120, 120, 120, 120],
        "gain": [1, 0.3, 0.2, 0.25, 0.25, 0.25, 0.25]
    },
    "ɒ": {
        "freq": [650, 900, 900, 2800, 3100, 3400, 3500],
        "bandwidth": [110, 130, 150, 120, 120, 120, 120],
        "gain": [1, 0.3, 0.2, 0.25, 0.25, 0.25, 0.25]
    }
};

/**
 * @param {import("./faustwasm/index").FaustAudioWorkletNode} faustNode
 * @param {import("@shren/faust-ui").FaustUI} faustUI
 **/
// 获取滑条和显示的值
const timeSlider = document.getElementById('time-slider');
const timeValue = document.getElementById('time-value');

// 监听滑条变化，更新时间显示
timeSlider.addEventListener('input', () => {
    timeValue.textContent = timeSlider.value;
});

const bindButtons = (faustNode, faustUI) => {
    ['i', 'y', 'ɨ', 'ʉ', 'w', 'u', 
     'e', 'ø', 'ɘ', 'ɵ', 'ɤ', 'o', 
     'ə', 'ɛ', 'œ', 'ɜ', 'ɞ', 'ʌ', 
     'ɔ', 'æ', 'ɐ', 'aa', 'ɶ', 'a', 
     'ɒ'].forEach(vowel => {
        document.getElementById(vowel + '-button').addEventListener('click', () => {
            if (currentParams.length) {
                const previousParams = [...currentParams];
                const targetParams = [...FORMANT_DATA[vowel].freq, ...FORMANT_DATA[vowel].bandwidth, ...FORMANT_DATA[vowel].gain];
                ['bandwidth', 'freq', 'gain'].forEach(paramType => {
                    FORMANT_DATA[vowel][paramType].forEach((value, index) => {
                        const paramName = `/tenorflow/formants/formant_${index}/${paramType.charAt(0).toUpperCase() + paramType.slice(1)}_${index}`;
                        faustNode.parameters.get(paramName).cancelAndHoldAtTime(audioContext.currentTime);
                        faustNode.parameters.get(paramName).value = faustNode.parameters.get(paramName).value;
                        // faustNode.parameters.get(paramName).linearRampToValueAtTime(value, audioContext.currentTime);
                        faustNode.parameters.get(paramName).linearRampToValueAtTime(value, audioContext.currentTime + parseFloat(timeSlider.value));
                        // faustNode.setParamValue(paramName, value);
                        // faustUI.paramChangeByDSP(paramName, value);
                    });
                });
            } else {
                currentParams = [...FORMANT_DATA[vowel].freq, ...FORMANT_DATA[vowel].bandwidth, ...FORMANT_DATA[vowel].gain];
                ['bandwidth', 'freq', 'gain'].forEach(paramType => {
                    FORMANT_DATA[vowel][paramType].forEach((value, index) => {
                        const paramName = `/tenorflow/formants/formant_${index}/${paramType.charAt(0).toUpperCase() + paramType.slice(1)}_${index}`;
                        faustNode.parameters.get(paramName).linearRampToValueAtTime(value, audioContext.currentTime);
                        // faustNode.setParamValue(paramName, value);
                        // faustUI.paramChangeByDSP(paramName, value);
                    });
                });
            }
        });
    });
    // 监听键盘按下事件
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Space') { // 检测左 Shift 键
            event.preventDefault(); // 防止页面产生默认行为
            const paramName = "/tenorflow/1/trigger";
            const value = 1;
            faustNode.setParamValue(paramName, value);
            faustUI.paramChangeByDSP(paramName, value);
        }
    });
    
    // 监听键盘松开事件
    document.addEventListener('keyup', (event) => {
        if (event.code === 'Space') { // 检测左 Shift 键
            event.preventDefault(); // 防止页面产生默认行为
            const paramName = "/tenorflow/1/trigger";
            const value = 0;
            faustNode.setParamValue(paramName, value);
            faustUI.paramChangeByDSP(paramName, value);
        }
    });
};

(async () => {
    const urlParams = new URLSearchParams(location.search);
    let voice = +(urlParams.get("v") ?? 0);

    // 获取按钮元素
    const toggleVoiceButton = document.getElementById("toggleVoice");
    const updateButtonText = () => {
        toggleVoiceButton.textContent = voice === 0 ? "当前模式: Mono（点击切换）" : "当前模式: Poly（点击切换）";
    };

    // 设置 currentVoiceMode 根据 URL 参数
    window.currentVoiceMode = voice === 0 ? "Mono" : "Poly"; // 更新模式状态
    
    // 初始化按钮文本
    updateButtonText();

    // 按钮点击事件：切换模式并刷新页面
    toggleVoiceButton.addEventListener("click", () => {
        voice = voice === 0 ? 8 : 0; // 切换 voice 参数
        window.currentVoiceMode = voice === 0 ? "Mono" : "Poly"; // 更新模式状态
        urlParams.set("v", voice);

        // 更新 URL 并刷新页面
        window.location.search = urlParams.toString();
    });

    // 初始化 Faust 节点
    const { faustNode, dspMeta: { name } } = await createFaustNode(audioContext, "tenorflow", voice);
    window.faustNode = faustNode;  
    const faustUI = await createFaustUI(faustNode);
    faustNode.connect(audioContext.destination);

    if (faustNode.numberOfInputs) await buildAudioDeviceMenu(faustNode);
    else $spanAudioInput.hidden = true;

    if (navigator.requestMIDIAccess) await buildMidiDeviceMenu(faustNode);
    else $spanMidiInput.hidden = true;

    $buttonDsp.disabled = false;
    document.title = name;

    const raf = () => {
        faustNode.getParams().forEach((paramName) => {
            faustUI.paramChangeByDSP(paramName, faustNode.getParamValue(paramName));
        });
        requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    bindButtons(faustNode, faustUI);
})();

