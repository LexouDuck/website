#!/usr/bin/env python3
"""
Extracts some presets of a SoundFont (.sf2, or .sf3 with Ogg Vorbis compressed samples) into a new, smaller SoundFont.

usage: sfsubset.py <input> <output> <preset> [<preset> ...]
  where <preset> is "bank:program", optionally followed by "@key" or "@lowkey-highkey" to only keep the
  zones which play these keys (e.g. "128:0@33" keeps only the metronome click of the standard drum kit).
"""
import struct
import sys

GEN_KEYRANGE = 43
GEN_INSTRUMENT = 41
GEN_SAMPLEID = 53


def chunks(data, offset, end):
    while offset < end:
        cid = data[offset:offset + 4].decode('latin1')
        size = struct.unpack('<I', data[offset + 4:offset + 8])[0]
        yield cid, offset + 8, size
        offset += 8 + size + (size & 1)


def records(blob, fmt):
    n = struct.calcsize(fmt)
    return [list(struct.unpack(fmt, blob[i:i + n])) for i in range(0, len(blob) - n + 1, n)]


def pack(fmt, rows):
    return b''.join(struct.pack(fmt, *row) for row in rows)


def chunk(cid, payload):
    out = cid.encode('latin1') + struct.pack('<I', len(payload)) + payload
    return out + (b'\0' if len(payload) & 1 else b'')


def list_chunk(kind, sub):
    return chunk('LIST', kind.encode('latin1') + b''.join(sub))


def in_keys(gens, keys):
    """whether the zone (list of [oper, amount]) can play one of the keys"""
    if keys is None:
        return True
    for oper, amount in gens:
        if oper == GEN_KEYRANGE:
            low, high = amount & 0xFF, amount >> 8
            return not (high < keys[0] or low > keys[1])
    return True


def main(src, dst, wanted):
    data = open(src, 'rb').read()
    assert data[0:4] == b'RIFF' and data[8:12] == b'sfbk', 'not a SoundFont file'
    info, sdta, pdta = [], {}, {}
    for cid, o, s in chunks(data, 12, len(data)):
        if cid != 'LIST':
            continue
        kind = data[o:o + 4]
        for c2, o2, s2 in chunks(data, o + 4, o + s):
            if kind == b'INFO':
                info.append((c2, data[o2:o2 + s2]))
            elif kind == b'sdta':
                sdta[c2] = data[o2:o2 + s2]
            elif kind == b'pdta':
                pdta[c2] = data[o2:o2 + s2]

    phdr = records(pdta['phdr'], '<20sHHHIII')
    pbag = records(pdta['pbag'], '<HH')
    pmod = records(pdta['pmod'], '<HHhHH')
    pgen = records(pdta['pgen'], '<HH')
    inst = records(pdta['inst'], '<20sH')
    ibag = records(pdta['ibag'], '<HH')
    imod = records(pdta['imod'], '<HHhHH')
    igen = records(pdta['igen'], '<HH')
    shdr = records(pdta['shdr'], '<20sIIIIIBbHH')
    smpl = sdta['smpl']
    sm24 = sdta.get('sm24')
    # sf3: samples are Ogg Vorbis streams, start/end are byte offsets, loop points are relative to the sample
    # (shdr fields: name, start, end, loop start, loop end, sample rate, original pitch, pitch correction, link, type)
    compressed = any(s[9] & 0x10 for s in shdr[:-1])

    new_phdr, new_pbag, new_pmod, new_pgen = [], [], [], []
    new_inst, new_ibag, new_imod, new_igen = [], [], [], []
    inst_map = {}    # (old instrument index, keys) -> new index
    sample_map = {}  # old sample index -> new index
    sample_order = []

    def map_sample(index):
        if index not in sample_map:
            sample_map[index] = len(sample_order)
            sample_order.append(index)
            link = shdr[index][8]
            if (shdr[index][9] & 0xF) in (2, 4, 8) and link < len(shdr) - 1:  # stereo: keep the linked sample too
                map_sample(link)
        return sample_map[index]

    def map_instrument(index, keys):
        key = (index, keys)
        if key in inst_map:
            return inst_map[key]
        new_index = len(new_inst)
        inst_map[key] = new_index
        new_inst.append([inst[index][0], len(new_ibag)])
        for b in range(inst[index][1], inst[index + 1][1]):
            gens = [list(igen[g]) for g in range(ibag[b][0], ibag[b + 1][0])]
            mods = [list(imod[m]) for m in range(ibag[b][1], ibag[b + 1][1])]
            is_global = not any(g[0] == GEN_SAMPLEID for g in gens)
            if not is_global and not in_keys(gens, keys):
                continue
            new_ibag.append([len(new_igen), len(new_imod)])
            for g in gens:
                if g[0] == GEN_SAMPLEID:
                    g[1] = map_sample(g[1])
                new_igen.append(g)
            new_imod.extend(mods)
        return new_index

    found = set()
    for i, h in enumerate(phdr[:-1]):
        name, program, bank = h[0], h[1], h[2]
        if (bank, program) not in wanted:
            continue
        keys = wanted[(bank, program)]
        found.add((bank, program))
        new_phdr.append([name, program, bank, len(new_pbag), h[4], h[5], h[6]])
        for b in range(h[3], phdr[i + 1][3]):
            gens = [list(pgen[g]) for g in range(pbag[b][0], pbag[b + 1][0])]
            mods = [list(pmod[m]) for m in range(pbag[b][1], pbag[b + 1][1])]
            is_global = not any(g[0] == GEN_INSTRUMENT for g in gens)
            if not is_global and not in_keys(gens, keys):
                continue
            new_pbag.append([len(new_pgen), len(new_pmod)])
            for g in gens:
                if g[0] == GEN_INSTRUMENT:
                    g[1] = map_instrument(g[1], keys)
                new_pgen.append(g)
            new_pmod.extend(mods)
    missing = set(wanted) - found
    assert not missing, f'presets not found: {missing}'

    # sample data
    new_smpl, new_sm24, new_shdr = bytearray(), bytearray(), []
    for old in sample_order:
        s = list(shdr[old])
        start, end, loop_start, loop_end = s[1], s[2], s[3], s[4]
        if compressed:
            offset = len(new_smpl)
            new_smpl += smpl[start:end]
            s[1], s[2] = offset, offset + (end - start)
        else:
            offset = len(new_smpl) // 2
            new_smpl += smpl[start * 2:end * 2] + b'\0' * (46 * 2)  # 46 zero samples after each sample
            if sm24 is not None:
                new_sm24 += sm24[start:end] + b'\0' * 46
            delta = offset - start
            s[1], s[2], s[3], s[4] = start + delta, end + delta, loop_start + delta, loop_end + delta
        if (s[9] & 0xF) in (2, 4, 8) and s[8] in sample_map:
            s[8] = sample_map[s[8]]
        else:
            s[8] = 0
        new_shdr.append(s)

    # terminal records
    new_phdr.append([b'EOP', 0, 0, len(new_pbag), 0, 0, 0])
    new_pbag.append([len(new_pgen), len(new_pmod)])
    new_pmod.append([0, 0, 0, 0, 0])
    new_pgen.append([0, 0])
    new_inst.append([b'EOI', len(new_ibag)])
    new_ibag.append([len(new_igen), len(new_imod)])
    new_imod.append([0, 0, 0, 0, 0])
    new_igen.append([0, 0])
    new_shdr.append([b'EOS', 0, 0, 0, 0, 0, 0, 0, 0, 0])

    description = 'Subset of ' + src.split('/')[-1] + ': ' + ', '.join(
        f'{b}:{p}' + (f'@{k[0]}-{k[1]}' if k else '') for (b, p), k in wanted.items())
    info_out = []
    for cid, payload in info:
        if cid == 'ICMT':
            continue
        info_out.append(chunk(cid, payload))
    comment = description.encode('latin1') + b'\0'
    if len(comment) % 2:
        comment += b'\0'  # zero-terminated, even length
    info_out.append(chunk('ICMT', comment))

    sdta_out = [chunk('smpl', bytes(new_smpl))]
    if sm24 is not None and not compressed:
        sdta_out.append(chunk('sm24', bytes(new_sm24)))
    pdta_out = [
        chunk('phdr', pack('<20sHHHIII', new_phdr)),
        chunk('pbag', pack('<HH', new_pbag)),
        chunk('pmod', pack('<HHhHH', new_pmod)),
        chunk('pgen', pack('<HH', new_pgen)),
        chunk('inst', pack('<20sH', new_inst)),
        chunk('ibag', pack('<HH', new_ibag)),
        chunk('imod', pack('<HHhHH', new_imod)),
        chunk('igen', pack('<HH', new_igen)),
        chunk('shdr', pack('<20sIIIIIBbHH', new_shdr)),
    ]
    body = b'sfbk' + list_chunk('INFO', info_out) + list_chunk('sdta', sdta_out) + list_chunk('pdta', pdta_out)
    with open(dst, 'wb') as f:
        f.write(b'RIFF' + struct.pack('<I', len(body)) + body)
    print(f'{dst}: {len(new_phdr) - 1} presets, {len(new_inst) - 1} instruments, {len(new_shdr) - 1} samples, '
          f'{len(body) + 8} bytes{" (compressed samples)" if compressed else ""}')


def parse_preset(text):
    keys = None
    if '@' in text:
        text, key_text = text.split('@')
        low, _, high = key_text.partition('-')
        keys = (int(low), int(high or low))
    bank, program = text.split(':')
    return (int(bank), int(program)), keys


if __name__ == '__main__':
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], dict(parse_preset(p) for p in sys.argv[3:]))
