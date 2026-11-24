import Foundation
import AVFoundation

// =========================================================================
// GoodTake — 通用院线级电影交响原声 + Sound Design 合成器
// macOS CoreAudio (9 轨真实交响) + Swift DSP (BOOM / Riser / Drop / Shutter) + 真人声平滑侧链
//
// 编译与用法：
//   swiftc -O compose_cinema_score.swift -o /tmp/compose_cinema_score
//   /tmp/compose_cinema_score <project_dir>
//
// 输入：
//   <project_dir>/assets/audio/shots.json       （含 totalDurationSec, bpm, fps, shots[]）
//   <project_dir>/assets/audio/vo_master.wav    （48kHz Stereo 人声母带，用于平滑侧链避让）
// 输出：
//   <project_dir>/assets/audio/score_master.wav （48kHz Stereo 院线混音原声）
//   <project_dir>/assets/audio/cinema_beats.json（30fps frameEnergies & impactShake 联动表）
// =========================================================================

guard CommandLine.arguments.count >= 2 else {
    fputs("Usage: compose_cinema_score <project_dir>\n", stderr)
    exit(1)
}
let PROJ = CommandLine.arguments[1]
let SAMPLE_RATE: Double = 48000.0

struct ShotItem: Decodable {
    let id: String
    let act: Int
    let start: Double
    let end: Double
    let trans: String?
    let sfx: [String]?
}
struct ShotsDoc: Decodable {
    let totalDurationSec: Double
    let bpm: Double?
    let fps: Int?
    let shots: [ShotItem]
}
struct MidiEvent {
    let time: Double
    let track: Int
    let note: UInt8
    let vel: UInt8
    let dur: Double
}

func loadShots() -> ShotsDoc {
    let url = URL(fileURLWithPath: "\(PROJ)/assets/audio/shots.json")
    let data = try! Data(contentsOf: url)
    return try! JSONDecoder().decode(ShotsDoc.self, from: data)
}

func composeOrchestra(doc: ShotsDoc, bpm: Double) -> [MidiEvent] {
    var ev: [MidiEvent] = []
    let beatSec = 60.0 / bpm
    let barSec = 4.0 * beatSec
    let totalBars = Int(round(doc.totalDurationSec / barSec))

    typealias Chord = (bass: UInt8, notes: [UInt8], arp: [UInt8])
    let Dm9: Chord    = (38, [50, 57, 60, 64, 65], [50, 57, 62, 65, 69, 65, 62, 57])
    let BbMaj7: Chord = (34, [46, 53, 57, 62, 65], [46, 53, 58, 62, 65, 62, 58, 53])
    let FMaj9: Chord  = (41, [53, 57, 60, 64, 67], [53, 60, 65, 69, 72, 69, 65, 60])
    let C69: Chord    = (36, [48, 55, 57, 62, 64], [48, 55, 60, 64, 67, 64, 60, 55])
    let Gm9: Chord    = (43, [55, 58, 62, 65, 69], [55, 62, 67, 70, 74, 70, 67, 62])
    let Asus4: Chord  = (45, [52, 57, 62, 64, 69], [45, 52, 57, 62, 64, 62, 57, 52])
    let A7: Chord     = (45, [52, 55, 61, 64, 69], [45, 52, 57, 61, 64, 61, 57, 52])
    let EbMaj7: Chord = (39, [51, 55, 58, 62, 67], [51, 58, 63, 67, 70, 67, 63, 58])

    let progDefault: [Chord] = [Dm9, BbMaj7, FMaj9, C69, Gm9, Dm9, Asus4, A7]
    let motifA: [(beat: Double, note: UInt8, dur: Double)] = [(0.0, 81, 1.5), (1.5, 79, 0.5), (2.0, 77, 1.5), (3.5, 76, 0.5)]
    let motifB: [(beat: Double, note: UInt8, dur: Double)] = [(0.0, 77, 1.0), (1.0, 79, 1.0), (2.0, 81, 1.5), (3.5, 86, 1.5)]

    // 根据所在小节的镜头情绪动态决定配器强度与色彩
    func barMood(t: Double, bar: Int) -> (chord: Chord, inten: Double, mode: String) {
        let ratio = Double(bar) / Double(max(1, totalBars))
        if bar < 3 { return (Dm9, 0.25, "intimate") }
        if bar >= totalBars - 5 { return (progDefault[bar % 4], 0.28, "solo_piano_end") }
        let activeShot = doc.shots.first(where: { t >= $0.start && t < $0.end })
        let sfx = Set(activeShot?.sfx ?? [])
        if sfx.contains("mega_boom") || (ratio > 0.72 && ratio < 0.84) {
            return (progDefault[bar % progDefault.count], 0.98, "epic_climax")
        }
        if sfx.contains("drop_boom") {
            return (EbMaj7, 0.94, "crisis")
        }
        let inten = 0.50 + 0.35 * sin(ratio * Double.pi)
        return (progDefault[bar % progDefault.count], inten, ratio < 0.5 ? "pulse_story" : "symphony")
    }

    for bar in 0..<totalBars {
        let t0 = Double(bar) * barSec
        if bar == totalBars - 1 {
            // 终章孤独 Dm9 钢琴余韵
            for (idx, n) in [UInt8(38), 50, 57, 64, 69].enumerated() {
                ev.append(MidiEvent(time: t0 + Double(idx) * 0.08, track: 0, note: n, vel: UInt8(54 - idx * 2), dur: barSec * 0.9))
            }
            continue
        }

        let mood = barMood(t: t0 + barSec * 0.5, bar: bar)
        let ch = mood.chord
        let inten = mood.inten

        // 0: Grand Piano（Hans Zimmer 流动八分琶音）
        if mood.mode == "intimate" || mood.mode == "solo_piano_end" {
            ev.append(MidiEvent(time: t0, track: 0, note: ch.bass + 12, vel: 54, dur: barSec * 0.95))
            for step in 0..<4 {
                ev.append(MidiEvent(time: t0 + Double(step) * beatSec, track: 0, note: ch.arp[(step * 2) % ch.arp.count], vel: UInt8(46 + (step == 0 ? 12 : 0)), dur: beatSec * 1.4))
            }
            if mood.mode == "solo_piano_end" {
                let m = (bar % 2 == 1) ? motifA : motifB
                for x in m { ev.append(MidiEvent(time: t0 + x.beat * beatSec, track: 0, note: x.note, vel: 60, dur: x.dur * beatSec * 1.15)) }
            }
        } else {
            let bVel = UInt8(min(114, 60 + Int(inten * 42)))
            ev.append(MidiEvent(time: t0, track: 0, note: ch.bass, vel: bVel, dur: barSec * 0.92))
            ev.append(MidiEvent(time: t0 + 0.01, track: 0, note: ch.bass + 12, vel: bVel - 8, dur: barSec * 0.92))
            for e8 in 0..<8 {
                let v = UInt8(min(106, 48 + Int(inten * 32) + (e8 % 4 == 0 ? 12 : 0)))
                let micro = Double((e8 * 7 + bar * 3) % 5) * 0.002
                ev.append(MidiEvent(time: t0 + Double(e8) * beatSec * 0.5 + micro, track: 0, note: ch.arp[e8 % ch.arp.count], vel: v, dur: beatSec * 0.85))
            }
        }

        // 1: Cello 低音根基
        if mood.mode != "solo_piano_end" {
            let cv = UInt8(min(108, 52 + Int(inten * 44)))
            ev.append(MidiEvent(time: t0, track: 1, note: ch.bass, vel: cv, dur: barSec * 0.96))
        }

        // 2: Slow Strings 宽广弦乐群 + 主题旋律
        if bar >= 2 && mood.mode != "solo_piano_end" {
            let sv = UInt8(min(102, 42 + Int(inten * 48)))
            for (idx, n) in ch.notes.prefix(4).enumerated() {
                ev.append(MidiEvent(time: t0 + Double(idx) * 0.012, track: 2, note: n, vel: sv, dur: barSec * 0.98))
            }
            if (mood.mode == "symphony" || mood.mode == "epic_climax") && bar % 2 == 0 {
                let m = (bar % 4 == 0) ? motifA : motifB
                for x in m { ev.append(MidiEvent(time: t0 + x.beat * beatSec, track: 2, note: x.note - 12, vel: UInt8(min(100, 52 + Int(inten * 36))), dur: x.dur * beatSec * 1.05)) }
            }
        }

        // 3 & 4: French Horns + Pipe Organ（仅高潮庄严响起）
        if inten >= 0.72 {
            let hv = UInt8(min(114, 58 + Int((inten - 0.65) * 140)))
            ev.append(MidiEvent(time: t0, track: 3, note: ch.notes[1], vel: hv, dur: beatSec * 3.6))
        }
        if mood.mode == "epic_climax" || mood.mode == "crisis" {
            let ov = UInt8(min(104, 54 + Int(inten * 42)))
            for n in [ch.bass, ch.notes[0], ch.notes[2]] {
                ev.append(MidiEvent(time: t0, track: 4, note: n, vel: ov, dur: barSec * 0.96))
            }
        }

        // 5 & 6: Harp & Celesta 星尘亮色
        if mood.mode == "pulse_story" || mood.mode == "symphony" || mood.mode == "epic_climax" {
            for b in 0..<4 {
                ev.append(MidiEvent(time: t0 + Double(b) * beatSec, track: 5, note: min(96, ch.arp[(b * 2 + 1) % ch.arp.count] + 12), vel: UInt8(min(92, 46 + Int(inten * 30))), dur: beatSec * 1.2))
            }
            if bar % 2 == 1 {
                ev.append(MidiEvent(time: t0 + beatSec * 1.5, track: 6, note: min(98, ch.notes[3] + 12), vel: 56, dur: beatSec * 1.4))
            }
        }

        // 7 & 8: Timpani & Pizzicato 推进脉冲
        if mood.mode == "pulse_story" || mood.mode == "symphony" {
            for idx in 0..<8 {
                ev.append(MidiEvent(time: t0 + Double(idx) * beatSec * 0.5, track: 8, note: idx % 2 == 0 ? ch.notes[0] : ch.notes[2], vel: UInt8(min(92, 46 + Int(inten * 28))), dur: 0.22))
            }
        }
        if inten >= 0.65 && mood.mode != "solo_piano_end" {
            let tv = UInt8(min(112, 60 + Int((inten - 0.55) * 105)))
            ev.append(MidiEvent(time: t0, track: 7, note: ch.bass, vel: tv, dur: 0.6))
        }
    }
    return ev.sorted { $0.time < $1.time }
}

func renderCoreAudio(events: [MidiEvent], totalSec: Double) -> ([Float], [Float]) {
    let engine = AVAudioEngine()
    let subMixer = AVAudioMixerNode() // 必须汇聚到多输入 Mixer，切忌重复直连单输入 Reverb！
    let reverb = AVAudioUnitReverb()
    reverb.loadFactoryPreset(.cathedral)
    reverb.wetDryMix = 32.0

    let eq = AVAudioUnitEQ(numberOfBands: 3)
    eq.bands[0].filterType = .lowShelf;   eq.bands[0].frequency = 85;   eq.bands[0].gain = 2.5;  eq.bands[0].bypass = false
    eq.bands[1].filterType = .parametric; eq.bands[1].frequency = 1400; eq.bands[1].bandwidth = 1.2; eq.bands[1].gain = -2.2; eq.bands[1].bypass = false
    eq.bands[2].filterType = .highShelf;  eq.bands[2].frequency = 9000; eq.bands[2].gain = 1.5;  eq.bands[2].bypass = false

    engine.attach(subMixer); engine.attach(reverb); engine.attach(eq)
    let format = AVAudioFormat(standardFormatWithSampleRate: SAMPLE_RATE, channels: 2)!
    let bankURL = URL(fileURLWithPath: "/System/Library/Components/CoreAudio.component/Contents/Resources/gs_instruments.dls")

    let programs: [(UInt8, Float, Float)] = [
        (0, 0.88, -0.05), (42, 0.85, -0.15), (49, 0.72, 0.10),
        (60, 0.76, 0.18), (19, 0.56, 0.00), (46, 0.52, -0.25),
        (8, 0.46, 0.28), (47, 0.78, -0.08), (45, 0.56, 0.20)
    ]
    var samplers: [AVAudioUnitSampler] = []
    for (prog, vol, pan) in programs {
        let s = AVAudioUnitSampler()
        engine.attach(s)
        engine.connect(s, to: subMixer, format: format)
        try! s.loadSoundBankInstrument(at: bankURL, program: prog, bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB), bankLSB: 0)
        s.volume = vol; s.pan = pan
        samplers.append(s)
    }
    engine.connect(subMixer, to: eq, format: format)
    engine.connect(eq, to: reverb, format: format)
    engine.connect(reverb, to: engine.mainMixerNode, format: format)

    let maxFrames: AVAudioFrameCount = 512
    try! engine.enableManualRenderingMode(.offline, format: format, maximumFrameCount: maxFrames)
    try! engine.start()

    struct Msg { let frame: Int64; let track: Int; let note: UInt8; let vel: UInt8; let isOn: Bool }
    var msgs: [Msg] = []
    for e in events {
        msgs.append(Msg(frame: Int64(e.time * SAMPLE_RATE), track: e.track, note: e.note, vel: e.vel, isOn: true))
        msgs.append(Msg(frame: Int64((e.time + e.dur) * SAMPLE_RATE), track: e.track, note: e.note, vel: 0, isOn: false))
    }
    msgs.sort { $0.frame < $1.frame }

    let totalFrames = Int64(ceil(totalSec * SAMPLE_RATE))
    var outL = [Float](repeating: 0, count: Int(totalFrames))
    var outR = [Float](repeating: 0, count: Int(totalFrames))
    let buf = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: maxFrames)!
    var mi = 0, cur: Int64 = 0
    while cur < totalFrames {
        let chunk = min(Int64(maxFrames), totalFrames - cur)
        while mi < msgs.count && msgs[mi].frame <= cur + chunk / 2 {
            let m = msgs[mi]
            if m.isOn { samplers[m.track].startNote(m.note, withVelocity: m.vel, onChannel: 0) }
            else { samplers[m.track].stopNote(m.note, onChannel: 0) }
            mi += 1
        }
        if try! engine.renderOffline(AVAudioFrameCount(chunk), to: buf) == .success, let data = buf.floatChannelData {
            let base = Int(cur)
            for i in 0..<Int(chunk) { outL[base + i] = data[0][i]; outR[base + i] = data[1][i] }
        }
        cur += chunk
    }
    engine.stop()
    return (outL, outR)
}

// --- DSP 好莱坞 Sound Design 原语 ---
struct RNG {
    var state: UInt64 = 0x9E3779B97F4A7C15
    mutating func nextFloat() -> Float {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return Float(Double((state >> 33) & 0x7FFFFFFF) / Double(0x7FFFFFFF) * 2.0 - 1.0)
    }
}

func addCinemaBoom(L: inout [Float], R: inout [Float], tSec: Double, gain: Float, durSec: Double, subHz: Double = 36.0) {
    let start = max(0, Int(tSec * SAMPLE_RATE)), len = Int(durSec * SAMPLE_RATE)
    var ph = 0.0, ph2 = 0.0, lp: Float = 0
    var rng = RNG(state: UInt64(max(1, start)) &* 2654435761)
    for i in 0..<len {
        let idx = start + i; if idx >= L.count { break }
        let t = Double(i) / SAMPLE_RATE
        let freq = subHz + (105.0 - subHz) * exp(-t * 14.0)
        ph += 2.0 * Double.pi * freq / SAMPLE_RATE; ph2 += 2.0 * Double.pi * (freq * 1.98) / SAMPLE_RATE
        let env = Float(min(1.0, t / 0.006) * exp(-t * (2.6 / durSec)))
        let sat = tanh((Float(sin(ph)) * 0.85 + Float(sin(ph2)) * 0.25 * Float(exp(-t * 5.0))) * 1.45)
        let n = rng.nextFloat(); lp = lp * 0.86 + n * 0.14
        let s = (sat * env + lp * Float(exp(-t * 6.5)) * 0.48 + n * Float(exp(-t * 38.0)) * 0.25) * gain
        let sp = Float(sin(t * 19.0)) * 0.06 * gain * Float(exp(-t * 3.0))
        L[idx] += s + sp; R[idx] += s - sp
    }
}

func addCinemaRiser(L: inout [Float], R: inout [Float], endSec: Double, durSec: Double, gain: Float) {
    let start = Int(max(0.0, endSec - durSec) * SAMPLE_RATE), len = Int(durSec * SAMPLE_RATE)
    var rng = RNG(state: UInt64(max(1, start)) &* 1315423911)
    var lp: Float = 0, bp: Float = 0, ph1 = 0.0, ph2 = 0.0
    for i in 0..<len {
        let idx = start + i; if idx >= L.count { break }
        let p = Double(i) / Double(len)
        let env = Float(pow(p, 2.3)) * (p > 0.96 ? Float((1.0 - p) / 0.04) : 1.0)
        ph1 += 2.0 * Double.pi * (146.83 * pow(2.0, p * 0.5)) / SAMPLE_RATE
        ph2 += 2.0 * Double.pi * (220.0 * pow(2.0, p * 0.75)) / SAMPLE_RATE
        let tone = Float(sin(ph1) * 0.24 + sin(ph2) * 0.16)
        let n = rng.nextFloat(); lp += Float(0.03 + 0.42 * p * p) * (n - lp); bp = bp * 0.93 + (n - lp) * 0.07
        let s = (tone + bp * 1.45 + lp * 0.55) * env * gain
        L[idx] += s; R[idx] += s
    }
}

func addShutterClick(L: inout [Float], R: inout [Float], tSec: Double, gain: Float) {
    let start = max(0, Int(tSec * SAMPLE_RATE)), len = Int(0.055 * SAMPLE_RATE)
    var rng = RNG(state: UInt64(max(1, start)) &* 7919), prev: Float = 0
    for i in 0..<len {
        let idx = start + i; if idx >= L.count { break }
        let t = Double(i) / SAMPLE_RATE, n = rng.nextFloat(), hp = n - prev * 0.85; prev = n
        let s = (hp * Float(exp(-t * 140.0)) * 0.7 + Float(sin(2.0 * Double.pi * 1650.0 * t) * exp(-t * 90.0)) * 0.4) * gain
        L[idx] += s * 0.95; R[idx] += s * 1.05
    }
}

func readVoiceEnvelope(wavPath: String, totalFrames: Int) -> [Float] {
    guard let data = try? Data(contentsOf: URL(fileURLWithPath: wavPath)) else {
        return [Float](repeating: 0, count: totalFrames)
    }
    var pos = 12, dataStart = 44, numCh = 2
    while pos + 8 <= data.count {
        let id = String(data: data[pos..<(pos + 4)], encoding: .ascii) ?? ""
        let sz = Int(data.withUnsafeBytes { $0.load(fromByteOffset: pos + 4, as: UInt32.self) })
        if id == "fmt " { numCh = Int(data.withUnsafeBytes { $0.load(fromByteOffset: pos + 10, as: UInt16.self) }) }
        else if id == "data" { dataStart = pos + 8; break }
        pos += 8 + sz + (sz % 2)
    }
    var env = [Float](repeating: 0, count: totalFrames)
    var smooth: Float = 0
    data.withUnsafeBytes { raw in
        let ptr = raw.baseAddress!.advanced(by: dataStart).assumingMemoryBound(to: Int16.self)
        let maxS = (data.count - dataStart) / (2 * numCh)
        for i in 0..<totalFrames {
            let amp: Float = i < maxS ? abs(Float(ptr[i * numCh])) / 32768.0 : 0
            smooth += (amp > smooth ? 0.0025 : 0.00018) * (amp - smooth)
            env[i] = smooth
        }
    }
    return env
}

func writeWav(path: String, L: [Float], R: [Float]) {
    let n = L.count, dataSize = UInt32(n * 4)
    var out = Data(capacity: 44 + Int(dataSize))
    func s(_ x: String) { out.append(x.data(using: .ascii)!) }
    func u32(_ v: UInt32) { var x = v.littleEndian; out.append(Data(bytes: &x, count: 4)) }
    func u16(_ v: UInt16) { var x = v.littleEndian; out.append(Data(bytes: &x, count: 2)) }
    s("RIFF"); u32(36 + dataSize); s("WAVE"); s("fmt "); u32(16); u16(1); u16(2)
    u32(UInt32(SAMPLE_RATE)); u32(UInt32(SAMPLE_RATE) * 4); u16(4); u16(16); s("data"); u32(dataSize)
    var pcm = [Int16](repeating: 0, count: n * 2)
    for i in 0..<n {
        pcm[i * 2] = Int16(max(-0.98, min(0.98, L[i])) * 32767.0)
        pcm[i * 2 + 1] = Int16(max(-0.98, min(0.98, R[i])) * 32767.0)
    }
    pcm.withUnsafeBufferPointer { b in
        out.append(UnsafeBufferPointer(start: UnsafeRawPointer(b.baseAddress!).assumingMemoryBound(to: UInt8.self), count: Int(dataSize)))
    }
    try! out.write(to: URL(fileURLWithPath: path))
}

// === MAIN ===
let doc = loadShots()
let bpm = doc.bpm ?? 96.0
let fps = doc.fps ?? 30
let totalSec = doc.totalDurationSec
let totalFrames = Int(ceil(totalSec * SAMPLE_RATE))

let events = composeOrchestra(doc: doc, bpm: bpm)
var (orchL, orchR) = renderCoreAudio(events: events, totalSec: totalSec)
var peak: Float = 0.001
for i in 0..<totalFrames { peak = max(peak, max(abs(orchL[i]), abs(orchR[i]))) }
let norm: Float = 0.56 / peak
for i in 0..<totalFrames { orchL[i] *= norm; orchR[i] *= norm }

var sfxL = [Float](repeating: 0, count: totalFrames)
var sfxR = [Float](repeating: 0, count: totalFrames)
var impacts: [(t: Double, amp: Double)] = []
var dropWindows: [(Double, Double)] = []

for shot in doc.shots {
    if shot.trans == "drop_boom" { dropWindows.append((max(0, shot.start - 0.22), max(0, shot.start - 0.02))) }
    for fx in (shot.sfx ?? []) {
        switch fx {
        case "boom":       addCinemaBoom(L: &sfxL, R: &sfxR, tSec: shot.start, gain: 0.62, durSec: 1.45, subHz: 37); impacts.append((shot.start, 0.90))
        case "mega_boom":  addCinemaBoom(L: &sfxL, R: &sfxR, tSec: shot.start, gain: 0.82, durSec: 2.10, subHz: 34); impacts.append((shot.start, 1.25))
        case "drop_boom":  addCinemaBoom(L: &sfxL, R: &sfxR, tSec: shot.start, gain: 0.78, durSec: 1.85, subHz: 35); impacts.append((shot.start, 1.15))
        case "boom_soft":  addCinemaBoom(L: &sfxL, R: &sfxR, tSec: shot.start, gain: 0.36, durSec: 1.10, subHz: 42); impacts.append((shot.start, 0.48))
        case "shutter":    addShutterClick(L: &sfxL, R: &sfxR, tSec: shot.start, gain: 0.22)
        case "hit":        addCinemaBoom(L: &sfxL, R: &sfxR, tSec: shot.start, gain: 0.28, durSec: 0.45, subHz: 55); impacts.append((shot.start, 0.38))
        case "riser_end":  addCinemaRiser(L: &sfxL, R: &sfxR, endSec: shot.end - 0.18, durSec: 1.75, gain: 0.30)
        case "riser_epic": addCinemaRiser(L: &sfxL, R: &sfxR, endSec: shot.end - 0.20, durSec: 2.20, gain: 0.42)
        default: break
        }
    }
}

let voEnv = readVoiceEnvelope(wavPath: "\(PROJ)/assets/audio/vo_master.wav", totalFrames: totalFrames)
var outL = [Float](repeating: 0, count: totalFrames), outR = [Float](repeating: 0, count: totalFrames)
for i in 0..<totalFrames {
    let t = Double(i) / SAMPLE_RATE
    let voActive = min(1.0, voEnv[i] * 15.0)
    var duck: Float = 1.0 - 0.64 * voActive
    let sfxDuck: Float = 1.0 - 0.20 * voActive
    for (d0, d1) in dropWindows where t >= d0 && t <= d1 {
        let cut = Float(min(min(1.0, (t - d0) / 0.025), min(1.0, (d1 - t) / 0.020)))
        duck *= (1.0 - 0.88 * cut)
    }
    let fadeEnd: Float = t > totalSec - 3.5 ? max(0.0, Float((totalSec - t) / 3.5)) : 1.0
    outL[i] = tanh((orchL[i] * 0.50 * duck + sfxL[i] * 0.72 * sfxDuck) * fadeEnd * 1.12) * 0.92
    outR[i] = tanh((orchR[i] * 0.50 * duck + sfxR[i] * 0.72 * sfxDuck) * fadeEnd * 1.12) * 0.92
}

writeWav(path: "\(PROJ)/assets/audio/score_master.wav", L: outL, R: outR)

let totalVFrames = Int(round(totalSec * Double(fps)))
let spf = Int(SAMPLE_RATE / Double(fps))
var energies = [Double](repeating: 0, count: totalVFrames)
var shakes = [Double](repeating: 0, count: totalVFrames)
for f in 0..<totalVFrames {
    let s0 = f * spf, s1 = min(totalFrames, s0 + spf)
    var sumSq = 0.0
    for i in s0..<s1 { let v = 0.5 * Double(outL[i] + outR[i]); sumSq += v * v }
    energies[f] = (min(1.0, sqrt(sumSq / Double(max(1, s1 - s0))) * 3.8) * 1000.0).rounded() / 1000.0
    let t = Double(f) / Double(fps)
    var sh = 0.0
    for imp in impacts { let dt = t - imp.t; if dt >= 0 && dt < 0.75 { sh = max(sh, imp.amp * exp(-dt * 7.5)) } }
    shakes[f] = (min(1.5, sh) * 1000.0).rounded() / 1000.0
}

let beatsObj: [String: Any] = ["bpm": bpm, "beatSec": 60.0 / bpm, "fps": fps, "totalFrames": totalVFrames, "frameEnergies": energies, "impactShake": shakes]
try! JSONSerialization.data(withJSONObject: beatsObj, options: []).write(to: URL(fileURLWithPath: "\(PROJ)/assets/audio/cinema_beats.json"))
print("DONE! Wrote score_master.wav & cinema_beats.json (\(totalVFrames) frames).")
