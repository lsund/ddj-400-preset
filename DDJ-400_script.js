// DDJ-400_scripts.js
//
// ****************************************************************************
// * Mixxx mapping script file for the Pioneer DDJ-400.
// * Author: Warker
// * Version 0.1 (April 25 2019)
// * Forum: https://mixxx.org/forums/viewtopic.php?f=7&t=TBD
// * Wiki: https://mixxx.org/wiki/doku.php/pioneer_ddj_400


// Changes to v0.1
// * initial version

//TODO: Functions that could be implemented to the script:
// ****************************************************************************

var DDJ400 = {};

// JogWheel
DDJ400.vinylMode = true;
DDJ400.alpha = 1.0/16;
DDJ400.beta = DDJ400.alpha/64;
DDJ400.highspeedScale = 2;


DDJ400.tempoRanges = [0.06, 0.10, 0.16, 0.25]; // WIDE = 25%?

// Keyboard Mode Variables and Settings
DDJ400.keyboardHotCuePoint = [ 0, 0 ]; // selected HotCue point (eg. PAD) in Keyboard mode per Deck 0 = unset
DDJ400.keyboardModeRefCount = [ 0, 0 ]; // count the currently pressed Pads per Deck
DDJ400.halftoneToPadMap = [4, 5, 6, 7, 0, 1, 2, 3];

// Save the Shift State
DDJ400.shiftState = [0, 0];

DDJ400.init = function() {
    // init controler
    // init tempo Range to 10% (default = 6%)
    engine.setValue('[Channel1]', 'rateRange', DDJ400.tempoRanges[1]);
    engine.setValue('[Channel2]', 'rateRange', DDJ400.tempoRanges[1]);

};


DDJ400.jogTurn = function(channel, control, value, status, group) {
    const deckNum = channel + 1;
    // wheel center at 64; <64 rew >64 fwd
    const newVal = value - 64;

    if(engine.isScratching(deckNum)){
        engine.scratchTick(deckNum, newVal);
    }
    else{ // fallback
        engine.setValue(group, 'jog', newVal);
    }
};


DDJ400.jogSearch = function(channel, control, value, status, group) {
    // "highspeed" (scaleup value) pitch bend
    const newVal = (value - 64) * DDJ400.highspeedScale;
    engine.setValue(group, 'jog', newVal);
};

DDJ400.jogTouch = function(channel, control, value, status, group) {
    const deckNum = channel + 1;
    // on touch jog with vinylmode enabled -> enable scratchmode

    if(value != 0 && DDJ400.vinylMode){
        engine.scratchEnable(deckNum, 800, 33+1/3, DDJ400.alpha, DDJ400.beta);
    }
    else{
        // on release jog (value==0) disable pitch bend mode or scratch mode
        engine.scratchDisable(deckNum);
    }
};

DDJ400.switchTempoRange = function(channel, control, value, status, group){
    const currRange = engine.getValue(group, 'rateRange');
    var idx = 0;

    for(var i = 0; i < DDJ400.tempoRanges.length; i++){
        if(currRange == DDJ400.tempoRanges[i]){
            idx = (i + 1) % DDJ400.tempoRanges.length;
            break;
        }
    }
    engine.setValue('[Channel'+deckNum+']', 'rateRange', DDJ400.tempoRanges[idx]);
};

DDJ400.cueLoopCallLeft = function(channel, control, value, status, group){
    if(value == 0) return; // ignore release
    const loop_on = engine.getValue(group, 'loop_enabled');

    if (loop_on){
        // loop halve
        engine.setValue(group, 'loop_scale', 0.5);
    }
    else{
        engine.setValue(group, 'loop_in_goto', 1);
    }
};

DDJ400.cueLoopCallRight = function(channel, control, value, status, group){
    if(value == 0) return; // ignore release
    const loop_on = engine.getValue(group, 'loop_enabled');
    if (loop_on){
        // loop double
        engine.setValue(group, 'loop_scale', 2.0);
    }
    else{
        engine.setValue(group, 'loop_out_goto', 1);
    }
};

DDJ400.keyboardMode = function(channel, control, value, status, group){
    if(value > 0){
        // clear current set hotcue point and refcount for keyboard mode
        DDJ400.keyboardHotCuePoint[channel] = 0;
        DDJ400.keyboardModeRefCount[channel] = 0;
        // reset pitch
        engine.setValue(group, 'pitch', 0.0);
        // clear PAD LEDs of the Deck
    }
};

DDJ400.keyboardModePad = function(channel, control, value, status, group){
    channel = (channel & 0xf) < 10 ? 0 : 1;
    const padNum = (control & 0xf) + 1;
    var hotcuePad = DDJ400.keyboardHotCuePoint[channel];
    // if no hotcue is set for keyboard mode set on first press on a pad
    if(hotcuePad === 0 && value !== 0){
        hotcuePad = padNum;
        DDJ400.keyboardHotCuePoint[channel] = hotcuePad;
        // if there is no hotcue at this pad, set current play position
        const hotcuePos = engine.getValue(group, 'hotcue_'+hotcuePad+'_position');
        if(hotcuePos < 0){
            engine.setValue(group, 'hotcue_'+hotcuePad+'_set', 1);
        }
        DDJ400.keyboardModeRefCount[channel] = 0; // reset count
        // TODO enable LED of the Pad!
        return;
    }

    // if hotcue point is set perform coresponding halftone operation
    if(value > 0){
        // count pressed Pad per deck
        DDJ400.keyboardModeRefCount[channel] += 1;
        const newValue = DDJ400.halftoneToPadMap[padNum-1];
        engine.setValue(group, 'pitch', newValue);
        engine.setValue(group, 'hotcue_'+hotcuePad+'_gotoandplay', 1);
    }
    else{
        // decrease the number of active Pads, this should minimize unwanted stops
        DDJ400.keyboardModeRefCount[channel] -= 1;
        if(DDJ400.keyboardModeRefCount[channel] <= 0){
            engine.setValue(group, 'hotcue_'+hotcuePad+'_gotoandstop', 1);
            engine.setValue(group, 'pitch', 0.0); // reset pitch
            DDJ400.keyboardModeRefCount[channel] = 0; // reset refcount to 0
        }
    }
};

DDJ400.keyshiftModePad = function(channel, control, value, status, group){
    if(value == 0) return; // ignore release
    const padNum = (control & 0xf) +1;
    engine.setValue(group, 'pitch', DDJ400.halftoneToPadMap[padNum-1]);
};

DDJ400.samplerModeShiftPadPressed = function(channel, control, value, status, group){
    if(value == 0) return; // ignore release
    var playing = engine.getValue(group, 'play');
    // when playing stop and return to start/cue point
    if(playing > 0){
        engine.setValue(group, 'cue_gotoandstop', 1);
    }
    else{ // load selected track
        engine.setValue(group, 'LoadSelectedTrack', 1);
    }
};

DDJ400.shiftPressed = function(channel, control, value, status, group){
    DDJ400.shiftState[channel] = value;
};

DDJ400.waveFormRotate = function(channel, control, value, status, group){
    // select the Waveform to zoom left shift = deck1, right shift = deck2
    const deckNum = DDJ400.shiftState[0] > 0 ? 1 : 2;
    const oldVal = engine.getValue('[Channel'+deckNum+']', 'waveform_zoom');
    const newVal = oldVal + (value > 0x64 ? 1 : -1);
    engine.setValue('[Channel'+deckNum+']', 'waveform_zoom', newVal);
};

DDJ400.shutdown = function() {

};
