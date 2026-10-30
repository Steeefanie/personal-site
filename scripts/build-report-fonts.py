"""Build redistributable static subsets for the local PDF report.

Requires fonttools. Supply an OFL-licensed Noto Sans SC variable TTF and its license.
Re-run after changing report wording or questionnaire text; tests check glyph coverage.
"""
from pathlib import Path
import argparse
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

parser = argparse.ArgumentParser()
parser.add_argument('--font', required=True)
parser.add_argument('--license', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
out = root / 'public/fonts/star-report'
out.mkdir(parents=True, exist_ok=True)
sources = list((root / 'src/lib').glob('four-elements*.ts'))
sources += [root / 'src/data/four-elements/question-bank.json']
sources += [root / 'services/four_elements_api/prompt.mjs']
text = ''.join(p.read_text(encoding='utf-8') for p in sources)
characters = set(text) | {chr(i) for i in range(32, 127)} | set('…—–·（）「」【】')
# AI prose is not limited to the current templates. Cover common CJK blocks,
# punctuation and Latin letters, not just characters present in source files.
for lead in range(0xA1, 0xF8):
    for trail in range(0xA1, 0xFF):
        try:
            characters.update(bytes([lead, trail]).decode('gb2312'))
        except UnicodeDecodeError:
            pass
characters |= {chr(i) for i in range(0x2000, 0x2070)}
characters |= {chr(i) for i in range(0xFF00, 0xFFF0)}
for weight, label in [(400, 'Regular'), (600, 'Semibold')]:
    font = TTFont(args.font)
    font = instantiateVariableFont(font, {'wght': weight}, inplace=True)
    options = subset.Options()
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    options.hinting = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes={ord(c) for c in characters})
    subsetter.subset(font)
    for record in font['name'].names:
        names = {1: 'Star Report Sans', 2: label, 3: f'StarReportSans-{label}',
                 4: f'Star Report Sans {label}', 6: f'StarReportSans-{label}',
                 16: 'Star Report Sans', 17: label}
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())
    font.save(out / f'{label.lower()}-cjk.ttf')
    if weight == 400:
        copyrights = sorted({n.toUnicode() for n in font['name'].names if n.nameID == 0})
        (out / 'OFL.txt').write_text('\n'.join(copyrights) + '\n\n' + Path(args.license).read_text(encoding='utf-8'), encoding='utf-8')
    print(label, (out / f'{label.lower()}-cjk.ttf').stat().st_size)
