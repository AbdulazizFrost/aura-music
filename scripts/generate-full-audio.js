const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050; // 22.05 kHz 16-bit for crisp music and compact APK size
const CHANNELS = 1; // Mono
const BITS = 16;

function createWavHeader(dataLength) {
  const buffer = Buffer.alloc(44);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BITS / 8), 28);
  buffer.writeUInt16LE(CHANNELS * (BITS / 8), 32);
  buffer.writeUInt16LE(BITS, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);
  return buffer;
}

// Frequencies for notes
const noteFreqs = {
  'C2': 65.41, 'D2': 73.42, 'Eb2': 77.78, 'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'Ab2': 103.83, 'A2': 110.00, 'Bb2': 116.54, 'B2': 123.47,
  'C3': 130.81, 'Db3': 138.59, 'D3': 146.83, 'Eb3': 155.56, 'E3': 164.81, 'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'Ab3': 207.65, 'A3': 220.00, 'Bb3': 233.08, 'B3': 246.94,
  'C4': 261.63, 'Db4': 277.18, 'D4': 293.66, 'Eb4': 311.13, 'E4': 329.63, 'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'Ab4': 415.30, 'A4': 440.00, 'Bb4': 466.16, 'B4': 493.88,
  'C5': 523.25, 'Db5': 554.37, 'D5': 587.33, 'Eb5': 622.25, 'E5': 659.25, 'F5': 698.46, 'F#5': 739.99, 'G5': 783.99, 'Ab5': 830.61, 'A5': 880.00, 'Bb5': 932.33, 'B5': 987.77,
  'C6': 1046.50
};

// Track arrangements (duration ~90 seconds)
const tracks = [
  {
    name: 'blinding_lights.wav',
    duration: 90,
    bpm: 171,
    style: 'synthwave',
    chords: [
      ['F3', 'Ab3', 'C4'],
      ['Eb3', 'G3', 'Bb3'],
      ['Db3', 'F3', 'Ab3'],
      ['Eb3', 'G3', 'Bb3']
    ],
    bassNotes: ['F2', 'Eb2', 'Db2', 'Eb2'],
    leadNotes: ['F4', 'Ab4', 'C5', 'Bb4', 'Ab4', 'G4', 'F4', 'Eb4', 'F4', 'C5', 'Bb4', 'Ab4']
  },
  {
    name: 'levitating.wav',
    duration: 90,
    bpm: 103,
    style: 'disco',
    chords: [
      ['B3', 'D4', 'F#4'],
      ['F#3', 'A3', 'C#4'],
      ['E3', 'G3', 'B3'],
      ['B3', 'D4', 'F#4']
    ],
    bassNotes: ['B2', 'F#2', 'E2', 'B2'],
    leadNotes: ['F#4', 'A4', 'B4', 'C#5', 'B4', 'A4', 'F#4', 'D4', 'E4', 'F#4', 'D4', 'B3']
  },
  {
    name: 'peaches.wav',
    duration: 90,
    bpm: 90,
    style: 'rnb',
    chords: [
      ['C3', 'E3', 'G3', 'B3'],
      ['E3', 'G3', 'B3', 'D4'],
      ['A3', 'C4', 'E4', 'G4'],
      ['F3', 'A3', 'C4', 'E4']
    ],
    bassNotes: ['C2', 'E2', 'A2', 'F2'],
    leadNotes: ['E4', 'G4', 'B4', 'C5', 'B4', 'G4', 'E4', 'D4', 'C4', 'D4', 'E4', 'G4']
  },
  {
    name: 'as_it_was.wav',
    duration: 90,
    bpm: 174,
    style: 'indie',
    chords: [
      ['A3', 'C#4', 'E4'],
      ['F#3', 'A3', 'C#4'],
      ['D3', 'F#3', 'A3'],
      ['E3', 'G#3', 'B3']
    ],
    bassNotes: ['A2', 'F#2', 'D2', 'E2'],
    leadNotes: ['A4', 'C#5', 'E5', 'C#5', 'B4', 'A4', 'F#4', 'E4', 'A4', 'B4', 'C#5', 'A4']
  },
  {
    name: 'heat_waves.wav',
    duration: 90,
    bpm: 80,
    style: 'chill',
    chords: [
      ['B3', 'D#4', 'F#4'],
      ['G#3', 'B3', 'D#4'],
      ['E3', 'G#3', 'B3'],
      ['F#3', 'A#3', 'C#4']
    ],
    bassNotes: ['B2', 'G#2', 'E2', 'F#2'],
    leadNotes: ['D#4', 'F#4', 'G#4', 'B4', 'A#4', 'G#4', 'F#4', 'D#4', 'C#4', 'D#4', 'F#4', 'G#4']
  },
  {
    name: 'stay.wav',
    duration: 90,
    bpm: 170,
    style: 'pop',
    chords: [
      ['C#3', 'E3', 'G#3', 'B3'],
      ['A3', 'C#4', 'E4', 'G#4'],
      ['E3', 'G#3', 'B3', 'D#4'],
      ['B3', 'D#4', 'F#4', 'A4']
    ],
    bassNotes: ['C#2', 'A2', 'E2', 'B2'],
    leadNotes: ['G#4', 'B4', 'C#5', 'E5', 'D#5', 'C#5', 'B4', 'G#4', 'A4', 'B4', 'C#5', 'G#4']
  }
];

function generateTrack(track) {
  const totalSamples = Math.floor(track.duration * SAMPLE_RATE);
  const buffer = Buffer.alloc(totalSamples * 2);
  const beatDuration = 60 / track.bpm;
  const barDuration = beatDuration * 4;
  const numChords = track.chords.length;

  console.log(`Synthesizing "${track.name}" (${track.duration}s, ${track.bpm} BPM, style: ${track.style})...`);

  // Simple noise seed
  let noiseSeed = 12345;
  function whiteNoise() {
    noiseSeed = (noiseSeed * 9301 + 49297) % 233280;
    return (noiseSeed / 233280.0) * 2.0 - 1.0;
  }

  // Pre-calculate synth values for each sample
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    const barProgress = (t % (barDuration * numChords)) / barDuration;
    const chordIndex = Math.floor(barProgress) % numChords;
    const chord = track.chords[chordIndex];
    const bassNote = track.bassNotes[chordIndex];
    const beatIndex = (t % barDuration) / beatDuration;
    const beatFraction = beatIndex - Math.floor(beatIndex);
    const sixteenth = Math.floor(beatIndex * 4) % 16;

    let sample = 0;

    // 1. Kick Drum (Beats 1 & 3, or four-on-the-floor for disco/synthwave)
    const isFourOnFloor = track.style === 'synthwave' || track.style === 'disco' || track.style === 'pop';
    const isKickBeat = isFourOnFloor ? true : (Math.floor(beatIndex) === 0 || Math.floor(beatIndex) === 2);
    if (isKickBeat && beatFraction < 0.25) {
      const kickEnv = Math.exp(-beatFraction * 24);
      const kickFreq = 130 * Math.exp(-beatFraction * 32) + 40;
      sample += Math.sin(2 * Math.PI * kickFreq * beatFraction) * kickEnv * 0.42;
    }

    // 2. Snare / Clap (Beats 2 & 4)
    const isSnareBeat = Math.floor(beatIndex) === 1 || Math.floor(beatIndex) === 3;
    if (isSnareBeat && beatFraction < 0.25) {
      const snareEnv = Math.exp(-beatFraction * 20);
      const snareNoise = whiteNoise() * snareEnv * 0.22;
      const snareTone = Math.sin(2 * Math.PI * 180 * beatFraction) * snareEnv * 0.18;
      sample += (snareNoise + snareTone);
    }

    // 3. Hi-hats (every 8th or 16th note)
    const hatFraction = (t % (beatDuration / 2)) / (beatDuration / 2);
    if (hatFraction < 0.08) {
      const hatEnv = Math.exp(-hatFraction * 40);
      sample += whiteNoise() * hatEnv * 0.08;
    }

    // 4. Bass synth (driving 8th-note or 16th-note groove)
    const bassFreq = noteFreqs[bassNote] || 80;
    const bassFraction = (t % (beatDuration / 2)) / (beatDuration / 2);
    const bassEnv = Math.exp(-bassFraction * 4.5);
    const bassWave = Math.sin(2 * Math.PI * bassFreq * t) +
                     0.5 * Math.sin(2 * Math.PI * bassFreq * 2 * t) +
                     0.25 * Math.sin(2 * Math.PI * bassFreq * 3 * t);
    sample += bassWave * bassEnv * 0.24;

    // 5. Chords / Warm Pad
    let chordSample = 0;
    for (const note of chord) {
      const freq = noteFreqs[note];
      if (freq) {
        chordSample += Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * (freq + 1.5) * t);
      }
    }
    sample += (chordSample / chord.length) * 0.18;

    // 6. Lead Melody
    const leadStepDuration = beatDuration / 2;
    const leadIndex = Math.floor(t / leadStepDuration) % track.leadNotes.length;
    const leadNote = track.leadNotes[leadIndex];
    const leadFreq = noteFreqs[leadNote] || 440;
    const leadFraction = (t % leadStepDuration) / leadStepDuration;
    const leadEnv = Math.min(1, leadFraction * 12) * Math.exp(-leadFraction * 2.8);
    const vibrato = 1 + 0.015 * Math.sin(2 * Math.PI * 5.5 * t);
    const leadWave = Math.sin(2 * Math.PI * leadFreq * vibrato * t) +
                     0.25 * Math.sin(2 * Math.PI * leadFreq * 2 * vibrato * t);
    sample += leadWave * leadEnv * 0.15;

    // Master volume fade-in at start (2s) and fade-out at end (3s)
    let masterEnv = 1;
    if (t < 2.0) masterEnv = t / 2.0;
    if (t > track.duration - 3.0) masterEnv = (track.duration - t) / 3.0;
    sample *= masterEnv;

    // Soft clip / limiter
    const clamped = Math.max(-0.95, Math.min(0.95, sample));
    const int16 = Math.floor(clamped * 32767);
    buffer.writeInt16LE(int16, i * 2);
  }

  const header = createWavHeader(buffer.length);
  const fullWav = Buffer.concat([header, buffer]);
  const outPath = path.join(__dirname, '..', 'assets', 'audio', track.name);
  fs.writeFileSync(outPath, fullWav);
  console.log(`Saved ${track.name} (${(fullWav.length / (1024 * 1024)).toFixed(2)} MB, duration: ${track.duration}s)`);
}

for (const track of tracks) {
  generateTrack(track);
}

console.log('All 6 audio tracks generated successfully with full 90-second duration!');
